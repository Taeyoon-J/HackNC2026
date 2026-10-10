"""Fixed YES share issuance, initial scholarships and demo portfolio holdings."""
import random
from datetime import timedelta

from sqlalchemy import select

from ..db import utcnow
from ..models import Disclosure, Market, Order, Position, Scholarship, User
from . import ledger_service as ledger, order_service


def initialize_market(db, market, *, retained=0):
    if market.total_supply or market.status == "SETTLED":
        return
    if not db.get(User, "MM_ALPHA"):
        return  # Isolated legacy matching fixtures do not use issuance.
    market.total_supply = max(100, retained)
    market.minted_pairs = 0
    market.initial_scholarship_cents = random.Random(market.id).randint(1000, 1500) * 100
    market.collateral_cents = market.total_supply * 100
    ledger.post(db, [(ledger.TREASURY, -market.collateral_cents),
                     (ledger.collateral_account(market.id), market.collateral_cents)], "YES_SHARE_ISSUANCE")
    issuer = order_service.position(db, "MM_ALPHA", market.id, "YES")
    issuer.quantity = market.total_supply - retained
    issuer.cost_basis_cents = 0
    scholarship = db.scalar(select(Scholarship).where(Scholarship.market_id == market.id))
    if scholarship is None:
        scholarship = Scholarship(market_id=market.id, locked_probability_bp=0,
                                  promised_cents=market.initial_scholarship_cents, status="INITIAL")
        db.add(scholarship)
    else:
        scholarship.promised_cents = market.initial_scholarship_cents
        scholarship.locked_probability_bp = 0
        scholarship.status = "INITIAL"
    reserve = market.initial_scholarship_cents + 100_00
    ledger.post(db, [(ledger.TREASURY, -reserve), (ledger.scholarship_account(market.id), reserve)], "INITIAL_SCHOLARSHIP_RESERVE")
    if market.status not in ("DRAFT", "CLOSED", "RESOLVED"):
        market.status = "TRADING"


def quote_market(db, market):
    price = market.last_price_cents or 50
    pos = order_service.position(db, "MM_ALPHA", market.id, "YES")
    available = pos.quantity - pos.reserved_qty
    if available:
        order_service._place(db, "MM_ALPHA", market.id, "YES", "SELL", "LIMIT", min(98, price + 1), available, utcnow())
    order_service._place(db, "MM_BETA", market.id, "YES", "BUY", "LIMIT", max(1, price - 2), min(40, market.total_supply), utcnow())


def upgrade_demo(db, *, seed_holdings=True):
    """One-time conversion; existing trader YES holdings and transaction history remain.

    Cancel binary quotes, redeem retired NO inventory at its last mark, return old
    reserves and issue a fixed pool. Re-running does not reissue shares.
    """
    now = utcnow()
    markets = db.scalars(select(Market).order_by(Market.id)).all()
    converted = []
    for market in markets:
        if market.total_supply or market.status == "SETTLED":
            continue
        order_service.cancel_all_open(db, market.id)
        positions = db.scalars(select(Position).where(Position.market_id == market.id)).all()
        retained = 0
        for pos in positions:
            if pos.contract == "YES" and not pos.user_id.startswith("MM_"):
                retained += pos.quantity
                continue
            if pos.contract == "NO" and pos.quantity and not pos.user_id.startswith("MM_"):
                refund = pos.quantity * (100 - (market.last_price_cents or 50))
                ledger.post(db, [(ledger.TREASURY, -refund), (ledger.user_account(pos.user_id), refund)], "RETIRED_NO_REDEMPTION")
            pos.quantity = pos.reserved_qty = pos.cost_basis_cents = 0
        if market.collateral_cents:
            ledger.post(db, [(ledger.collateral_account(market.id), -market.collateral_cents),
                             (ledger.TREASURY, market.collateral_cents)], "BINARY_COLLATERAL_RELEASE")
        scholarship = db.scalar(select(Scholarship).where(Scholarship.market_id == market.id))
        if scholarship and scholarship.status == "LOCKED":
            reserve = ledger.balance(db, ledger.scholarship_account(market.id))
            if reserve:
                ledger.post(db, [(ledger.scholarship_account(market.id), -reserve), (ledger.TREASURY, reserve)], "BINARY_SCHOLARSHIP_RELEASE")
        initialize_market(db, market, retained=retained)
        load = db.scalar(select(Disclosure).where(Disclosure.student_id == market.student_id, Disclosure.type == "COURSE_LOAD"))
        if load and not load.data.get("term"):
            load.data = {**load.data, "term": market.term}
        converted.append(market)
    db.commit()
    # Establish two-sided quotes from issued inventory; buys never mint shares.
    for market in converted:
        if market.status != "TRADING":
            continue
        price = market.last_price_cents or random.Random(market.id).randint(35, 80)
        available = order_service.position(db, "MM_ALPHA", market.id, "YES").quantity
        if available:
            # Bulk create the initial resting quotes without one commit per market.
            pos = order_service.position(db, "MM_ALPHA", market.id, "YES")
            pos.reserved_qty += available
            ask = min(98, price + 1)
            db.add(Order(market_id=market.id, user_id="MM_ALPHA", contract="YES", action="SELL", order_type="LIMIT",
                         price_cents=ask, book_side="ASK", yes_price_cents=ask, quantity=available, remaining=available,
                         status="OPEN", created_at=now - timedelta(days=1)))
        bid = max(1, price - 2)
        ledger.reserve_cash(db, "MM_BETA", bid * 40)
        db.add(Order(market_id=market.id, user_id="MM_BETA", contract="YES", action="BUY", order_type="LIMIT",
                     price_cents=bid, book_side="BID", yes_price_cents=bid, quantity=40, remaining=40,
                     status="OPEN", created_at=now - timedelta(days=1)))
    db.commit()
    if seed_holdings and converted:
        for sid, qty in [("STU001", 18), ("STU002", 12), ("STU003", 16), ("STU004", 10), ("STU007", 22), ("STU008", 14)]:
            market = next((m for m in markets if m.student_id == sid and m.status == "TRADING"), None)
            if market and order_service.position(db, "TRADER_A", market.id, "YES").quantity == 0:
                order_service.place_order(db, "TRADER_A", market.id, "YES", "BUY", "MARKET", None, qty,
                                          now=now - timedelta(minutes=15))
        # Demonstrate two unfilled limit orders in the dedicated Orders tab.
        for sid in ("STU001", "STU002"):
            market = next((m for m in markets if m.student_id == sid and m.status == "TRADING"), None)
            if market:
                order_service.place_order(db, "TRADER_A", market.id, "YES", "BUY", "LIMIT", 5, 3)
    return len(converted)
