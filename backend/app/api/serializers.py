from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Disclosure, Market, Order, Scholarship, Student, Trade, User
from ..services import market_service, student_service


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat() + "Z" if dt else None


def student_brief(db: Session, student: Student) -> dict:
    user = db.info.get("directory_users", {}).get(student.user_id) or db.get(User, student.user_id)
    bios = db.info.get("directory_bios")
    bio = bios.get(student.id) if bios is not None else db.scalar(select(Disclosure).where(Disclosure.student_id == student.id, Disclosure.type == "BIOGRAPHY"))
    histories = db.info.get("directory_histories")
    history = histories.get(student.id) if histories is not None else db.scalar(select(Disclosure).where(
        Disclosure.student_id == student.id, Disclosure.type == "GPA_HISTORY", Disclosure.visibility == "PUBLIC", Disclosure.verified_at.is_not(None)))
    return {"id": student.id, "name": user.display_name, "university": student.university,
            "year": student.year, "major": student.major, "verified": student.verified,
            "status": student.status, "introduction": bio.data.get("introduction", "") if bio else "",
            "pitch": bio.data.get("pitch", "") if bio else "",
            "cumulative_gpa": student_service.cumulative_gpa(history.data) if history else None}


def scholarship(s: Scholarship | None) -> dict | None:
    if s is None:
        return None
    return {"probability": s.locked_probability_bp / 10000, "promised_cents": s.promised_cents,
            "status": s.status, "locked_at": iso(s.locked_at), "paid_at": iso(s.paid_at)}


def market(db: Session, m: Market, detail: bool = False) -> dict:
    scholarships = db.info.get("directory_scholarships")
    s = scholarships.get(m.id) if scholarships is not None else db.scalar(select(Scholarship).where(Scholarship.market_id == m.id))
    out = {
        "id": m.id, "question": m.question, "metric": m.metric, "term": m.term,
        "total_supply": m.total_supply, "initial_scholarship_cents": m.initial_scholarship_cents,
        "public_float": max(0, m.total_supply - m.admin_reserve_shares),
        "admin_reserve_shares": m.admin_reserve_shares,
        "final_price": m.final_price_cents,
        "share_value_cents": m.share_value_cents,
        "probability": m.probability_bp / 10000 if m.probability_bp else None,
        "threshold": m.threshold, "deadline": iso(m.deadline), "status": m.status,
        "outcome": m.outcome, "resolved_value": m.resolved_value,
        "last_price": m.last_price_cents, "volume": m.volume,
        "initial_price": m.initial_price_cents,
        "student": student_brief(db, db.info.get("directory_students", {}).get(m.student_id) or db.get(Student, m.student_id)),
        "scholarship": scholarship(s),
        "sparkline": db.info.get("directory_sparklines", {}).get(m.id, []),
        **(db.info["directory_stats"][m.id] if "directory_stats" in db.info else market_service.stats(db, m)),
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
