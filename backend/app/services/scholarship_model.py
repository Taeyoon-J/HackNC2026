"""Scholarship-priced YES shares (Students A–E).

Each student has a scholarship S ($30,000–$50,000) split into 100 shares. A share is
worth S/100 if the goal is met, so it opens at S/100 × p, where p is the student's
fixed probability of reaching the goal GPA.

Student payout once the final GPA is verified:
    goal met:     S × ((final GPA − goal GPA) / p + 1)
    goal missed:  final share price × 100
"""
import math
import random
from datetime import datetime, timedelta

from sqlalchemy import delete, select

from ..db import utcnow
from ..models import Market, Order, Position, Scholarship, Trade
from . import ledger_service as ledger
from . import order_service
from .matching_engine import BUY, LIMIT, SELL, YES

STOCK_COUNT = 100
MAX_GPA = 4.0
HISTORY_START = datetime(2026, 8, 1, 9, 0)
TRADERS = ("TRADER_A", "TRADER_B", "TRADER_C")
PARTICIPANTS = TRADERS + ("MM_ALPHA", "MM_BETA")

# student_id -> (goal GPA, probability). Goals and probabilities are fixed inputs.
STUDENTS = {
    "STU001": (3.8, 0.62),
    "STU002": (3.5, 0.73),
    "STU003": (3.9, 0.19),
    "STU004": (3.6, 0.46),
    "STU005": (3.7, 0.44),
}


def payout_cents(market: Market, final_gpa: float) -> int:
    p = market.probability_bp / 10000
    if final_gpa >= market.threshold:
        return round(market.initial_scholarship_cents * ((final_gpa - market.threshold) / p + 1))
    return market.final_price_cents * market.total_supply


def max_payout_cents(market: Market) -> int:
    """Largest possible payout (final GPA 4.0), reserved up front so settlement never falls short."""
    p = market.probability_bp / 10000
    success = round(market.initial_scholarship_cents * ((MAX_GPA - market.threshold) / p + 1))
    return max(success, market.share_value_cents * market.total_supply)


def apply(db, now=None, *, rebuild=False) -> list[str]:
    """List Students A–E on scholarship-priced shares. Idempotent per market unless
    `rebuild` is set, which regenerates the trade history of already-listed markets."""
    now = now or utcnow()
    listed = []
    for sid, (goal, probability) in STUDENTS.items():
        market = db.scalar(select(Market).where(Market.student_id == sid, Market.term == "Fall 2026"))
        if market is None:
            market = _create_fall_market(db, sid, goal)
        if (market.probability_bp and not rebuild) or market.status not in ("DRAFT", "TRADING", "PRICE_DISCOVERY"):
            continue
        _relist(db, market, goal, probability, now)
        listed.append(market.id)
    db.commit()
    return listed


def _create_fall_market(db, sid, goal):
    """Student E's earlier goal is already settled; give E a Fall 2026 goal on the new model."""
    from ..models import Student, User
    from .student_service import term_deadline
    name = db.get(User, db.get(Student, sid).user_id).display_name
    market = Market(id=f"{sid}-GPA-2026F", student_id=sid, threshold=goal, term="Fall 2026",
                    deadline=term_deadline("Fall 2026"), status="TRADING",
                    question=f"Will {name} earn a Fall 2026 GPA of {goal} or higher?")
    db.add(market)
    db.flush()
    return market


def _relist(db, market, goal, probability, now):
    rng = random.Random(market.id)
    scholarship_cents = rng.randrange(30_000, 50_001, 500) * 100
    old_price = market.last_price_cents or 50

    # 1. Unwind the old ¢-scale market: release reservations, buy back holders at the
    #    last ¢ price, and return old collateral and reserves to the treasury.
    order_service.cancel_all_open(db, market.id)
    for pos in db.scalars(select(Position).where(Position.market_id == market.id)).all():
        if pos.quantity and not pos.user_id.startswith("MM_"):
            refund = pos.quantity * old_price
            ledger.post(db, [(ledger.TREASURY, -refund), (ledger.user_account(pos.user_id), refund)],
                        "SHARE_MODEL_BUYBACK", now=now)
        pos.quantity = pos.reserved_qty = pos.cost_basis_cents = 0
    for account in (ledger.collateral_account(market.id), ledger.scholarship_account(market.id)):
        balance = ledger.balance(db, account)
        if balance:
            ledger.post(db, [(account, -balance), (ledger.TREASURY, balance)], "SHARE_MODEL_RELEASE", now=now)
    db.execute(delete(Trade).where(Trade.market_id == market.id))
    db.execute(delete(Order).where(Order.market_id == market.id))

    # 2. Issue 100 shares worth S/100 each, backed in full, plus the maximum scholarship.
    market.threshold = goal
    market.total_supply = STOCK_COUNT
    market.share_value_cents = scholarship_cents // STOCK_COUNT
    market.probability_bp = round(probability * 10000)
    market.initial_scholarship_cents = scholarship_cents
    market.minted_pairs = 0
    market.last_price_cents = None
    market.final_price_cents = None
    market.volume = 0
    market.status = "TRADING"
    market.collateral_cents = STOCK_COUNT * market.share_value_cents
    ledger.post(db, [(ledger.TREASURY, -market.collateral_cents),
                     (ledger.collateral_account(market.id), market.collateral_cents)], "YES_SHARE_ISSUANCE", now=now)
    reserve = max_payout_cents(market)
    ledger.post(db, [(ledger.TREASURY, -reserve), (ledger.scholarship_account(market.id), reserve)],
                "SCHOLARSHIP_RESERVE", now=now)
    issuer = order_service.position(db, "MM_ALPHA", market.id, YES)
    issuer.quantity = STOCK_COUNT
    scholarship = db.scalar(select(Scholarship).where(Scholarship.market_id == market.id))
    if scholarship is None:
        scholarship = Scholarship(market_id=market.id, locked_probability_bp=0, promised_cents=0, status="INITIAL")
        db.add(scholarship)
    scholarship.promised_cents, scholarship.status = scholarship_cents, "INITIAL"
    scholarship.locked_probability_bp, scholarship.paid_at = market.probability_bp, None
    db.flush()

    # 3. Trades since August 1, starting at the opening price, then a deep current book.
    opening = round(market.share_value_cents * probability)
    last = _history(db, rng, market, opening, probability, now)
    _book(db, rng, market, last, now)


def _available(db, user, market):
    pos = order_service.position(db, user, market.id, YES)
    return pos.quantity - pos.reserved_qty


def _history(db, rng, market, opening, probability, now):
    """Mean-reverting walk of the share price from HISTORY_START to now.

    Every trade is a real seller/buyer pair through the matching engine, so cash,
    holdings and the ledger stay consistent. The issuer distributes shares first;
    afterwards traders and market makers trade among themselves."""
    value = market.share_value_cents
    days = max(1, (now - HISTORY_START).days)
    times = sorted(HISTORY_START + timedelta(days=rng.uniform(0, days), minutes=rng.uniform(0, 600))
                   for _ in range(days * rng.randint(5, 8)))
    times = [t for t in times if t < now - timedelta(minutes=30)]
    fraction = probability
    price = opening
    for i, t in enumerate(times):
        if i:
            fraction += 0.04 * (probability - fraction) + rng.gauss(0, 0.012)
            fraction = min(0.95, max(0.05, fraction))
            price = max(1, min(value - 1, round(value * fraction)))
        sellers = [u for u in PARTICIPANTS if _available(db, u, market) > 0]
        # The issuer sells most early trades so the 100 shares spread across traders.
        seller = "MM_ALPHA" if "MM_ALPHA" in sellers and rng.random() < 0.6 else rng.choice(sellers)
        qty = min(rng.choice([1, 1, 1, 2, 2, 3, 4, 5]), _available(db, seller, market))
        buyers = [u for u in PARTICIPANTS if u != seller and ledger.wallet(db, u).available_cents >= price * qty * 2]
        if not buyers:
            continue
        buyer = rng.choice(buyers)
        order_service._place(db, seller, market.id, YES, SELL, LIMIT, price, qty, t)
        order_service._place(db, buyer, market.id, YES, BUY, LIMIT, price, qty, t)
    return price


def _book(db, rng, market, last, now):
    """Many resting buy and sell orders around the last price from all participants."""
    value = market.share_value_cents
    t0 = now - timedelta(hours=6)
    for user in PARTICIPANTS:
        available = _available(db, user, market)
        sell_qty = math.ceil(available * rng.uniform(0.4, 0.8)) if available else 0
        while sell_qty > 0:
            qty = min(sell_qty, rng.randint(1, 4))
            ask = min(value - 1, round(last * (1 + rng.uniform(0.004, 0.09))))
            order_service._place(db, user, market.id, YES, SELL, LIMIT, ask, qty, t0 + timedelta(minutes=rng.uniform(0, 340)))
            sell_qty -= qty
    for user in TRADERS + ("MM_BETA",):
        for _ in range(rng.randint(3, 6)):
            pos = order_service.position(db, user, market.id, YES)
            queued = sum(o.remaining for o in db.scalars(select(Order).where(
                Order.market_id == market.id, Order.user_id == user, Order.action == BUY,
                Order.status.in_(order_service.OPEN_STATUSES))))
            qty = min(rng.randint(1, 4), STOCK_COUNT - pos.quantity - queued)
            bid = max(1, round(last * (1 - rng.uniform(0.004, 0.09))))
            if qty <= 0 or ledger.wallet(db, user).available_cents < bid * qty:
                break
            order_service._place(db, user, market.id, YES, BUY, LIMIT, bid, qty, t0 + timedelta(minutes=rng.uniform(0, 340)))
