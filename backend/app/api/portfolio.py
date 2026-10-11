from fastapi import APIRouter, Depends
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AccountCredentials, Market, Order, Position, Settlement, Student, Trade, User, Wallet
from ..services import ledger_service as ledger
from ..services.matching_engine import contract_price
from ..services.order_service import OPEN_STATUSES
from . import serializers as ser
from .deps import current_user

router = APIRouter(prefix="/api", tags=["portfolio"])


@router.get("/users")
async def list_users(db: Session = Depends(get_db)):
    out = []
    credentials = {c.user_id: c for c in db.scalars(select(AccountCredentials)).all()}
    for u, w in db.execute(select(User, Wallet).outerjoin(Wallet, Wallet.user_id == User.id)
                          .order_by(User.role, User.id)).all():
        out.append({"id": u.id, "role": u.role, "display_name": u.display_name,
                    "username": credentials[u.id].username if u.id in credentials else u.id,
                    "has_password": bool(u.id in credentials and credentials[u.id].password_hash),
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
            "student": ser.student_brief(db, db.get(Student, m.student_id)),
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
    held_by_market = {p.market_id: p for p in db.scalars(select(Position).where(
        Position.user_id == user.id, Position.contract == "YES")).all()}
    settled_by_market = {s.market_id: s for s in settlements if s.contract == "YES"}
    realized: dict[str, dict[str, int]] = {}
    held_basis: dict[str, int] = {}
    replay_qty: dict[str, int] = {}
    replay_basis: dict[str, int] = {}
    trades = db.execute(select(Trade, Order).join(Order, or_(Order.id == Trade.maker_order_id,
        Order.id == Trade.taker_order_id)).where(Order.user_id == user.id, Order.contract == "YES")
        .order_by(Trade.executed_at, Trade.id)).all()
    for trade, order in trades:
        market_id = trade.market_id
        qty, price_cents = trade.quantity, trade.yes_price_cents
        result = realized.setdefault(market_id, {"profit": 0, "loss": 0})
        if order.action == "BUY":
            replay_qty[market_id] = replay_qty.get(market_id, 0) + qty
            replay_basis[market_id] = replay_basis.get(market_id, 0) + price_cents * qty
        else:
            before = replay_qty.get(market_id, 0)
            cost = min(replay_basis.get(market_id, 0), replay_basis.get(market_id, 0) * qty // before) if before else 0
            replay_qty[market_id] = max(0, before - qty)
            replay_basis[market_id] = max(0, replay_basis.get(market_id, 0) - cost)
            pnl = price_cents * qty - cost
            result["profit"] += max(0, pnl)
            result["loss"] += max(0, -pnl)
    impact_ids = set(held_by_market) | set(settled_by_market) | set(realized)
    impact = []
    for market_id in impact_ids:
        market = db.get(Market, market_id)
        if market is None:
            continue
        position = held_by_market.get(market_id)
        settlement = settled_by_market.get(market_id)
        quantity = settlement.quantity if settlement else (position.quantity if position else 0)
        basis = replay_basis.get(market_id, 0) if settlement else (position.cost_basis_cents if position else 0)
        price = market.final_price_cents if market.status == "SETTLED" and market.final_price_cents is not None else market.last_price_cents
        additional, reduced = 0, 0
        if quantity and basis and price is not None:
            additional = max(0, price * quantity - basis)
            reduced = max(0, basis - price * quantity)
        student = db.get(Student, market.student_id)
        impact.append({"market_id": market.id, "student_name": db.get(User, student.user_id).display_name,
            "question": market.question, "term": market.term, "initial_expected_value_cents": basis,
            "additional_impact_cents": additional, "reduced_impact_cents": reduced,
            "trading_profit_cents": realized.get(market_id, {}).get("profit", 0),
            "trading_loss_cents": realized.get(market_id, {}).get("loss", 0),
            "held_quantity": quantity, "final_price_cents": price,
            "settled": market.status == "SETTLED"})
    impact.sort(key=lambda row: (row["student_name"].lower(), row["term"]))
    orders = []
    for o in open_orders:
        m = db.get(Market, o.market_id)
        orders.append({**ser.order(o), "student": ser.student_brief(db, db.get(Student, m.student_id))})
    return {
        "user": {"id": user.id, "role": user.role, "display_name": user.display_name},
        "available_cents": w.available_cents, "reserved_cents": w.reserved_cents,
        "positions_value_cents": total_value,
        "impact": impact,
        "positions": positions,
        "open_orders": orders,
        "settlements": [{"market_id": s.market_id, "contract": s.contract, "quantity": s.quantity,
                         "payout_cents": s.payout_cents, "created_at": ser.iso(s.created_at)}
                        for s in settlements],
    }
