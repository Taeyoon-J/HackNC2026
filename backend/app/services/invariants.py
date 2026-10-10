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

    for m in db.scalars(select(Market).order_by(Market.id)).all():
        yes = db.scalar(select(func.coalesce(func.sum(Position.quantity), 0))
                        .where(Position.market_id == m.id, Position.contract == YES))
        no = db.scalar(select(func.coalesce(func.sum(Position.quantity), 0))
                       .where(Position.market_id == m.id, Position.contract == NO))
        coll = ledger.balance(db, ledger.collateral_account(m.id))
        if m.status == "SETTLED":
            add(f"{m.id}: collateral is 0 after settlement", coll == 0 and m.collateral_cents == 0, f"collateral={coll}")
        else:
            add(f"{m.id}: YES supply = NO supply = {m.minted_pairs}", yes == no == m.minted_pairs,
                f"YES={yes}, NO={no}")
            add(f"{m.id}: collateral = minted pairs × 100¢", coll == m.collateral_cents == m.minted_pairs * 100,
                f"ledger={coll}, field={m.collateral_cents}")

    bad_wallets = []
    for w in db.scalars(select(Wallet)).all():
        bal = ledger.balance(db, ledger.user_account(w.user_id))
        reserved = db.scalar(select(func.coalesce(func.sum(Order.remaining * Order.price_cents), 0))
                             .where(Order.user_id == w.user_id, Order.action == BUY,
                                    Order.status.in_(OPEN_STATUSES)))
        if bal != w.available_cents + w.reserved_cents or reserved != w.reserved_cents or w.available_cents < 0:
            bad_wallets.append(w.user_id)
    add("Wallets match ledger; reserved = open buy orders", not bad_wallets, ", ".join(bad_wallets))

    bad_positions = []
    for p in db.scalars(select(Position)).all():
        reserved = db.scalar(select(func.coalesce(func.sum(Order.remaining), 0))
                             .where(Order.user_id == p.user_id, Order.market_id == p.market_id,
                                    Order.contract == p.contract, Order.action == SELL,
                                    Order.status.in_(OPEN_STATUSES)))
        if reserved != p.reserved_qty or p.reserved_qty > p.quantity or p.quantity < 0:
            bad_positions.append(f"{p.user_id}/{p.market_id}/{p.contract}")
    add("Holdings ≥ sell reservations; no negative positions", not bad_positions, ", ".join(bad_positions))
    return checks
