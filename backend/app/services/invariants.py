"""System-wide consistency checks (spec §7 core invariants plus ledger checks)."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import LedgerEntry, Market, Order, Position, Wallet
from . import ledger_service as ledger
from .matching_engine import BUY, NO, SELL, YES
from .order_service import OPEN_STATUSES


def check_all(db: Session) -> list[dict]:
    checks = []

    def add(name, ok, detail=""):
        checks.append({"name": name, "ok": bool(ok), "detail": detail})

    total = db.scalar(select(func.coalesce(func.sum(LedgerEntry.amount_cents), 0)))
    add("Ledger sums to zero", total == 0, f"sum={total}")

    # Aggregate once so checking a thousand students does not issue thousands
    # of tiny SQLite queries. Missing accounts/positions have a zero balance.
    balances = dict(db.execute(select(LedgerEntry.account, func.sum(LedgerEntry.amount_cents))
                               .group_by(LedgerEntry.account)).all())
    supplies = {(mid, contract): qty for mid, contract, qty in db.execute(
        select(Position.market_id, Position.contract, func.sum(Position.quantity))
        .group_by(Position.market_id, Position.contract)).all()}
    buy_reservations = dict(db.execute(select(Order.user_id, func.sum(Order.remaining * Order.price_cents))
        .where(Order.action == BUY, Order.status.in_(OPEN_STATUSES)).group_by(Order.user_id)).all())
    sell_reservations = {(uid, mid, contract): qty for uid, mid, contract, qty in db.execute(
        select(Order.user_id, Order.market_id, Order.contract, func.sum(Order.remaining))
        .where(Order.action == SELL, Order.status.in_(OPEN_STATUSES))
        .group_by(Order.user_id, Order.market_id, Order.contract)).all()}

    for m in db.scalars(select(Market).order_by(Market.id)).all():
        yes = supplies.get((m.id, YES), 0)
        no = supplies.get((m.id, NO), 0)
        coll = balances.get(ledger.collateral_account(m.id), 0)
        if m.status == "SETTLED":
            add(f"{m.id}: collateral is 0 after settlement", coll == 0 and m.collateral_cents == 0, f"collateral={coll}")
        else:
            add(f"{m.id}: YES supply = NO supply = {m.minted_pairs}", yes == no == m.minted_pairs,
                f"YES={yes}, NO={no}")
            add(f"{m.id}: collateral = minted pairs × 100¢", coll == m.collateral_cents == m.minted_pairs * 100,
                f"ledger={coll}, field={m.collateral_cents}")

    bad_wallets = []
    for w in db.scalars(select(Wallet)).all():
        bal = balances.get(ledger.user_account(w.user_id), 0)
        reserved = buy_reservations.get(w.user_id, 0)
        if bal != w.available_cents + w.reserved_cents or reserved != w.reserved_cents or w.available_cents < 0:
            bad_wallets.append(w.user_id)
    add("Wallets match ledger; reserved = open buy orders", not bad_wallets, ", ".join(bad_wallets))

    bad_positions = []
    for p in db.scalars(select(Position)).all():
        reserved = sell_reservations.get((p.user_id, p.market_id, p.contract), 0)
        if reserved != p.reserved_qty or p.reserved_qty > p.quantity or p.quantity < 0:
            bad_positions.append(f"{p.user_id}/{p.market_id}/{p.contract}")
    add("Holdings ≥ sell reservations; no negative positions", not bad_positions, ", ".join(bad_positions))
    return checks
