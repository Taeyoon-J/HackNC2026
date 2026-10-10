"""Scholarship-priced YES shares (Students A–E).

Each student has a scholarship S ($30,000–$50,000) split into 100 shares. A share is
worth S/100 if the goal is met, so it opens at S/100 × p, where p is the student's
fixed probability of reaching the goal GPA.

Student payout once the final GPA is verified:
    goal met:     S × ((final GPA − goal GPA) / p + 1)
    goal missed:  final share price × 100
"""
import random
from datetime import timedelta

from sqlalchemy import delete, select

from ..db import utcnow
from ..models import Market, Order, Position, Scholarship, Trade
from . import ledger_service as ledger
from . import order_service
from .matching_engine import BUY, LIMIT, SELL, YES

STOCK_COUNT = 100
MAX_GPA = 4.0

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


def apply(db, now=None) -> list[str]:
    """List Students A–E on scholarship-priced shares. Idempotent per market."""
    now = now or utcnow()
    listed = []
    for sid, (goal, probability) in STUDENTS.items():
        market = db.scalar(select(Market).where(Market.student_id == sid, Market.term == "Fall 2026"))
        if market is None:
            market = _create_fall_market(db, sid, goal)
        if market.probability_bp or market.status not in ("DRAFT", "TRADING", "PRICE_DISCOVERY"):
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

    # 3. Three days of market-maker trades around the opening price, ending at it.
    opening = round(market.share_value_cents * probability)
    _history(db, rng, market, opening, now)

    # 4. A small demo holding for Trader A, filled at the opening price, then two-sided quotes.
    if market.student_id != "STU005":
        t = now - timedelta(minutes=12)
        order_service._place(db, "MM_ALPHA", market.id, YES, SELL, LIMIT, opening, 2, t)
        order_service._place(db, "TRADER_A", market.id, YES, BUY, LIMIT, opening, 2, t)
    _quote(db, market, opening, now)
    if market.student_id in ("STU001", "STU002"):
        order_service._place(db, "TRADER_A", market.id, YES, BUY, LIMIT, round(opening * 0.8), 1, now - timedelta(minutes=4))


def _history(db, rng, market, opening, now, n=24, hours=72):
    for i in range(n):
        frac = i / (n - 1)
        drift = 1 + 0.06 * (frac - 1) + rng.uniform(-0.03, 0.03)
        price = opening if i == n - 1 else max(1, min(market.share_value_cents - 1, round(opening * drift)))
        qty = rng.choice([1, 1, 2, 3])
        t = now - timedelta(hours=hours * (1 - frac)) - timedelta(minutes=30)
        seller, buyer = ("MM_ALPHA", "MM_BETA") if i % 3 else ("MM_BETA", "MM_ALPHA")
        if order_service.position(db, seller, market.id, YES).quantity < qty:
            seller, buyer = buyer, seller
        order_service._place(db, seller, market.id, YES, SELL, LIMIT, price, qty, t)
        order_service._place(db, buyer, market.id, YES, BUY, LIMIT, price, qty, t)


def _quote(db, market, price, now):
    t = now - timedelta(minutes=10)
    for maker in ("MM_ALPHA", "MM_BETA"):
        pos = order_service.position(db, maker, market.id, YES)
        available = pos.quantity - pos.reserved_qty
        if available:
            ask = min(market.share_value_cents - 1, round(price * 1.02))
            order_service._place(db, maker, market.id, YES, SELL, LIMIT, ask, available, t)
    order_service._place(db, "MM_BETA", market.id, YES, BUY, LIMIT, max(1, round(price * 0.98)), 5, t)
