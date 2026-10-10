from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Market, Order, Position, Settlement, User, Wallet
from ..services import ledger_service as ledger
from ..services.matching_engine import contract_price
from ..services.order_service import OPEN_STATUSES
from . import serializers as ser
from .deps import current_user

router = APIRouter(prefix="/api", tags=["portfolio"])


@router.get("/users")
async def list_users(db: Session = Depends(get_db)):
    out = []
    for u in db.scalars(select(User).order_by(User.role, User.id)).all():
        w = db.get(Wallet, u.id)
        out.append({"id": u.id, "role": u.role, "display_name": u.display_name,
                    "available_cents": w.available_cents if w else 0,
                    "reserved_cents": w.reserved_cents if w else 0})
    return out


@router.get("/portfolio")
async def portfolio(user: User = Depends(current_user), db: Session = Depends(get_db)):
    w = ledger.wallet(db, user.id)
    positions = []
    total_value = 0
    for p in db.scalars(select(Position).where(Position.user_id == user.id, Position.quantity > 0)
                        .order_by(Position.market_id, Position.contract)).all():
        m = db.get(Market, p.market_id)
        mark = contract_price(p.contract, m.last_price_cents) if m.last_price_cents is not None else None
        value = mark * p.quantity if mark is not None else 0
        total_value += value
        positions.append({
            "market_id": m.id, "question": m.question, "market_status": m.status,
            "contract": p.contract, "quantity": p.quantity, "reserved_qty": p.reserved_qty,
            "cost_basis_cents": p.cost_basis_cents,
            "avg_cost_cents": round(p.cost_basis_cents / p.quantity, 2),
            "mark_cents": mark, "market_value_cents": value,
            "unrealized_pnl_cents": value - p.cost_basis_cents,
        })
    open_orders = db.scalars(select(Order).where(Order.user_id == user.id, Order.status.in_(OPEN_STATUSES))
                             .order_by(Order.created_at.desc())).all()
    settlements = db.scalars(select(Settlement).where(Settlement.user_id == user.id)
                             .order_by(Settlement.created_at.desc())).all()
    return {
        "user": {"id": user.id, "role": user.role, "display_name": user.display_name},
        "available_cents": w.available_cents, "reserved_cents": w.reserved_cents,
        "positions_value_cents": total_value,
        "positions": positions,
        "open_orders": [ser.order(o) for o in open_orders],
        "settlements": [{"market_id": s.market_id, "contract": s.contract, "quantity": s.quantity,
                         "payout_cents": s.payout_cents, "created_at": ser.iso(s.created_at)}
                        for s in settlements],
    }
