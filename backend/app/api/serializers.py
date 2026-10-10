from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Market, Order, Scholarship, Student, Trade, User
from ..services import market_service


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat() + "Z" if dt else None


def student_brief(db: Session, student: Student) -> dict:
    user = db.get(User, student.user_id)
    return {"id": student.id, "name": user.display_name, "university": student.university,
            "year": student.year, "major": student.major, "verified": student.verified,
            "status": student.status}


def scholarship(s: Scholarship | None) -> dict | None:
    if s is None:
        return None
    return {"probability": s.locked_probability_bp / 10000, "promised_cents": s.promised_cents,
            "status": s.status, "locked_at": iso(s.locked_at), "paid_at": iso(s.paid_at)}


def market(db: Session, m: Market, detail: bool = False) -> dict:
    s = db.scalar(select(Scholarship).where(Scholarship.market_id == m.id))
    out = {
        "id": m.id, "question": m.question, "metric": m.metric, "term": m.term,
        "threshold": m.threshold, "deadline": iso(m.deadline), "status": m.status,
        "outcome": m.outcome, "resolved_value": m.resolved_value,
        "last_price": m.last_price_cents, "volume": m.volume,
        "student": student_brief(db, db.get(Student, m.student_id)),
        "scholarship": scholarship(s),
        **market_service.stats(db, m),
    }
    if detail:
        out.update({"minted_pairs": m.minted_pairs, "collateral_cents": m.collateral_cents})
    return out


def order(o: Order) -> dict:
    return {"id": o.id, "market_id": o.market_id, "user_id": o.user_id, "contract": o.contract,
            "action": o.action, "order_type": o.order_type, "price_cents": o.price_cents,
            "book_side": o.book_side, "yes_price_cents": o.yes_price_cents,
            "quantity": o.quantity, "remaining": o.remaining, "filled": o.quantity - o.remaining,
            "status": o.status, "created_at": iso(o.created_at)}


def trade(t: Trade) -> dict:
    return {"id": t.id, "market_id": t.market_id, "trade_type": t.trade_type,
            "taker_side": t.taker_side, "yes_price": t.yes_price_cents, "quantity": t.quantity,
            "executed_at": iso(t.executed_at)}
