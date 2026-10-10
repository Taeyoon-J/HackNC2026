"""Fixed YES share issuance, initial scholarships and demo portfolio holdings."""
import random
from datetime import timedelta

from sqlalchemy import func, select

from ..db import utcnow
from ..models import Disclosure, Market, Order, Position, Scholarship, Trade, User
from . import ledger_service as ledger, order_service


def initialize_market(db, market, *, retained=0, initial_scholarship_cents=None, probability_percent=None):
    if market.total_supply or market.status == "SETTLED":
        return
    if not db.get(User, "MM_ALPHA"):
        return  # Isolated legacy matching fixtures do not use issuance.
    market.total_supply = max(100, retained)
    if initial_scholarship_cents is not None:
        market.initial_scholarship_cents = initial_scholarship_cents
        market.share_value_cents = initial_scholarship_cents // market.total_supply
        probability_percent = max(0, min(100, probability_percent or 0))
        market.initial_price_cents = round(market.share_value_cents * probability_percent / 100)
        market.last_price_cents = market.initial_price_cents
    else:
        market.initial_scholarship_cents = random.Random(market.id).randint(1000, 1500) * 100
        market.share_value_cents = 100
    if market.initial_price_cents is None:
        market.initial_price_cents = market.last_price_cents
    market.minted_pairs = 0
    market.collateral_cents = market.total_supply * market.share_value_cents
    ledger.post(db, [(ledger.TREASURY, -market.collateral_cents),
                     (ledger.collateral_account(market.id), market.collateral_cents)], "YES_SHARE_ISSUANCE")
    issuer = order_service.position(db, "MM_ALPHA", market.id, "YES")
    public_float = max(0, market.total_supply - 30)
    issuer.quantity = max(0, public_float - retained)
    issuer.cost_basis_cents = 0
    market.admin_reserve_shares = 30
    admin_position = order_service.position(db, "ADMIN", market.id, "YES")
    admin_position.quantity = 30
    admin_position.reserved_qty = admin_position.cost_basis_cents = 0
    scholarship = db.scalar(select(Scholarship).where(Scholarship.market_id == market.id))
    if scholarship is None:
        scholarship = Scholarship(market_id=market.id, locked_probability_bp=0,
                                  promised_cents=market.initial_scholarship_cents, status="INITIAL")
        db.add(scholarship)
    else:
        scholarship.promised_cents = market.initial_scholarship_cents
        scholarship.locked_probability_bp = 0
        scholarship.status = "INITIAL"
    reserve = market.initial_scholarship_cents + market.total_supply * market.share_value_cents
    ledger.post(db, [(ledger.TREASURY, -reserve), (ledger.scholarship_account(market.id), reserve)], "INITIAL_SCHOLARSHIP_RESERVE")
    if market.status not in ("DRAFT", "CLOSED", "RESOLVED"):
        market.status = "TRADING"


def quote_market(db, market):
    price = market.last_price_cents or max(1, market.share_value_cents // 2)
    tick = max(1, market.share_value_cents // 100)
    ceiling = market.share_value_cents - 1
    pos = order_service.position(db, "MM_ALPHA", market.id, "YES")
    available = pos.quantity - pos.reserved_qty
    if available:
        order_service._place(db, "MM_ALPHA", market.id, "YES", "SELL", "LIMIT", min(ceiling, price + tick), available, utcnow())
    bid = max(1, price - 2 * tick)
    beta_cash = ledger.wallet(db, "MM_BETA").available_cents
    bid_quantity = min(40, max(0, market.total_supply - 30), beta_cash // bid)
    if bid_quantity > 0:
        order_service._place(db, "MM_BETA", market.id, "YES", "BUY", "LIMIT", bid, bid_quantity, utcnow())


def migrate_admin_reserves(db):
    """Migrate fixed markets to a 70-share public float and a 30-share admin reserve."""
    changed = []
    admin = db.get(User, "ADMIN")
    if not admin:
        return
    for market in db.scalars(select(Market).where(Market.total_supply == 100,
            Market.admin_reserve_shares == 0, Market.status.notin_(("SETTLED", "RESOLVED")))).all():
        # Preserve the 100-share pool while shifting any already seeded excess float to admin custody.
        total_yes = db.scalar(select(func.coalesce(func.sum(Position.quantity), 0)).where(
            Position.market_id == market.id, Position.contract == "YES")) or 0
        if total_yes != market.total_supply:
            continue
        reserve = order_service.position(db, "ADMIN", market.id, "YES")
        circulating = total_yes - reserve.quantity
        order_service.cancel_all_open(db, market.id)
        excess = max(0, circulating - 70)
        positions = db.scalars(select(Position).where(Position.market_id == market.id,
            Position.contract == "YES", Position.quantity > 0)).all()
        positions.sort(key=lambda p: (p.user_id != "MM_ALPHA", p.user_id != "MM_BETA", p.user_id))
        for p in positions:
            if excess <= 0:
                break
            take = min(excess, p.quantity)
            cost = p.cost_basis_cents * take // p.quantity
            p.quantity -= take
            p.cost_basis_cents -= cost
            reserve.quantity += take
            reserve.cost_basis_cents += cost
            excess -= take
            if cost:
                ledger.post(db, [(ledger.TREASURY, -cost), (ledger.user_account(p.user_id), cost)],
                            "ADMIN_SHARE_RESERVE_REBALANCE")
        issuer = order_service.position(db, "MM_ALPHA", market.id, "YES")
        issuer.reserved_qty = 0
        if reserve.quantity != 30:
            if reserve.quantity > 30:
                move_back = reserve.quantity - 30
                reserve.quantity -= move_back
                issuer.quantity += move_back
            else:
                continue
        market.admin_reserve_shares = 30
        changed.append(market)
    db.commit()
    for market in changed:
        quote_market(db, market)
    if changed:
        db.commit()

    # Some earlier demo markets accumulated more than 100 YES positions before the
    # reserve existed. Retire that synthetic over-issuance once, before auto quoting.
    repaired = []
    for market in db.scalars(select(Market).where(Market.total_supply == 100,
            Market.admin_reserve_shares == 30, Market.last_auto_quote_at.is_(None),
            Market.status.notin_(("SETTLED", "RESOLVED")))).all():
        reserve = order_service.position(db, "ADMIN", market.id, "YES")
        if reserve.quantity != 30:
            continue
        public = db.scalar(select(func.coalesce(func.sum(Position.quantity), 0)).where(
            Position.market_id == market.id, Position.contract == "YES", Position.user_id != "ADMIN")) or 0
        excess = public - 70
        if excess <= 0:
            continue
        order_service.cancel_all_open(db, market.id)
        positions = db.scalars(select(Position).where(Position.market_id == market.id,
            Position.contract == "YES", Position.quantity > 0, Position.user_id != "ADMIN")).all()
        positions.sort(key=lambda p: (p.user_id != "MM_ALPHA", p.user_id != "MM_BETA", p.user_id))
        for p in positions:
            if excess <= 0:
                break
            take = min(excess, p.quantity)
            cost = p.cost_basis_cents * take // p.quantity
            p.quantity -= take
            p.cost_basis_cents -= cost
            excess -= take
            if cost:
                ledger.post(db, [(ledger.TREASURY, -cost), (ledger.user_account(p.user_id), cost)],
                            "ADMIN_SHARE_RESERVE_REBALANCE")
        repaired.append(market)
    if repaired:
        db.commit()
        for market in repaired:
            quote_market(db, market)
        db.commit()


def run_stale_market_liquidity(db, now=None):
    """After 72 idle hours, quote modest student-progress-based treasury liquidity."""
    from sqlalchemy import func
    from ..services.order_service import OPEN_STATUSES
    now = now or utcnow()
    cutoff = now - timedelta(days=3)
    markets = db.scalars(select(Market).where(Market.total_supply == 100,
        Market.status == "TRADING", Market.admin_reserve_shares > 0)).all()
    quoted = 0
    for market in markets:
        last_trade = db.scalar(select(Trade.executed_at).where(Trade.market_id == market.id)
                               .order_by(Trade.executed_at.desc(), Trade.id.desc()).limit(1))
        idle_since = last_trade or market.created_at
        if idle_since > cutoff or (market.last_auto_quote_at and market.last_auto_quote_at > cutoff):
            continue
        for old in db.scalars(select(Order).where(Order.market_id == market.id,
                Order.admin_backed.is_(True), Order.status.in_(OPEN_STATUSES))).all():
            order_service._release(db, old)
            order_service._return_admin_backed_inventory(db, old)
            old.status = "CANCELLED"
        current = market.last_price_cents or max(1, market.initial_price_cents or market.share_value_cents // 2)
        tick = max(1, market.share_value_cents // 100)
        ceiling = max(1, market.share_value_cents - 1)
        load = db.scalar(select(Disclosure).where(Disclosure.student_id == market.student_id,
                                                  Disclosure.type == "COURSE_PROGRESS"))
        scores = [a["earned"] / a["possible"] for c in (load.data.get("courses", []) if load else [])
                  for a in c.get("assessments", []) if a.get("possible", 0) > 0]
        progress_pct = (sum(scores) / len(scores) * 100) if scores else None
        adjustment = round(max(0, progress_pct - 50) * market.share_value_cents / 5000) if progress_pct is not None else 0
        estimate = min(ceiling, max(1, current + tick + adjustment))

        treasury = order_service.position(db, "ADMIN", market.id, "YES")
        available = min(max(0, treasury.quantity - treasury.reserved_qty), market.admin_reserve_shares)
        if available:
            moved_cost = treasury.cost_basis_cents * available // treasury.quantity if treasury.quantity else 0
            treasury.quantity -= available
            treasury.cost_basis_cents -= moved_cost
            issuer = order_service.position(db, "MM_ALPHA", market.id, "YES")
            issuer.quantity += available
            issuer.cost_basis_cents += moved_cost
            order_service._place(db, "MM_ALPHA", market.id, "YES", "SELL", "LIMIT",
                                 estimate, available, now, admin_backed=True)
        beta_cash = ledger.wallet(db, "MM_BETA").available_cents
        bid = max(1, estimate - tick)
        buy_qty = min(30, beta_cash // bid)
        if buy_qty:
            order_service._place(db, "MM_BETA", market.id, "YES", "BUY", "LIMIT", bid, buy_qty, now, admin_backed=True)
        market.last_auto_quote_at = now
        quoted += 1
    if quoted:
        db.commit()
    return quoted


def repair_registered_market(db, market, *, scholarship_cents, probability_percent):
    """Reprice an untouched pre-fix registration market without altering any human holdings."""
    order_service.cancel_all_open(db, market.id)
    supply = market.total_supply or 100
    value = scholarship_cents // supply
    old_reserve = ledger.balance(db, ledger.scholarship_account(market.id))
    new_reserve = scholarship_cents * 2
    ledger.post(db, [(ledger.collateral_account(market.id), -market.collateral_cents),
                     (ledger.TREASURY, market.collateral_cents)], "REGISTRATION_COLLATERAL_REBASE")
    new_collateral = value * supply
    ledger.post(db, [(ledger.TREASURY, -new_collateral),
                     (ledger.collateral_account(market.id), new_collateral)], "REGISTRATION_COLLATERAL_REBASE")
    if old_reserve != new_reserve:
        ledger.post(db, [(ledger.scholarship_account(market.id), new_reserve - old_reserve),
                         (ledger.TREASURY, old_reserve - new_reserve)], "REGISTRATION_SCHOLARSHIP_REBASE")
    market.total_supply = supply
    market.initial_scholarship_cents = scholarship_cents
    market.share_value_cents = value
    market.initial_price_cents = market.last_price_cents = round(value * probability_percent / 100)
    market.volume = 0
    market.collateral_cents = new_collateral
    scholarship = db.scalar(select(Scholarship).where(Scholarship.market_id == market.id))
    if scholarship:
        scholarship.promised_cents = scholarship_cents
        scholarship.status = "INITIAL"
        scholarship.locked_probability_bp = 0
    quote_market(db, market)


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
