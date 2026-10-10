"""Bounded, server-side directory search shared by trader and admin views."""
from fastapi import Query
from sqlalchemy import String, cast, func, or_, select

from collections import defaultdict
from datetime import timedelta, timezone
import re

from ..db import utcnow
from ..models import Disclosure, Market, Order, Scholarship, Student, Trade, User


def prefetch_page(db, rows, markets):
    """Batch the profile and market data needed by a bounded directory page."""
    student_ids = {row.student_id if markets else row.id for row in rows}
    students = db.scalars(select(Student).where(Student.id.in_(student_ids))).all() if markets else rows
    db.info["directory_students"] = {s.id: s for s in students}
    db.info["directory_users"] = {u.id: u for u in db.scalars(select(User).where(User.id.in_([s.user_id for s in students]))).all()}
    disclosures = db.scalars(select(Disclosure).where(Disclosure.student_id.in_(student_ids))).all()
    db.info["directory_bios"] = {d.student_id: d for d in disclosures if d.type == "BIOGRAPHY"}
    db.info["directory_histories"] = {d.student_id: d for d in disclosures
        if d.type == "GPA_HISTORY" and d.verified_at and d.visibility == "PUBLIC"}
    if not markets:
        pending = defaultdict(int)
        for d in disclosures:
            if d.type not in ("BIOGRAPHY", "COURSE_PROGRESS") and d.verified_at is None:
                pending[d.student_id] += 1
        goals = defaultdict(list)
        for m in db.scalars(select(Market).where(Market.student_id.in_(student_ids)).order_by(Market.created_at)).all():
            goals[m.student_id].append(m)
        db.info["directory_pending"], db.info["directory_student_markets"] = pending, goals
        return
    ids = [m.id for m in rows]
    db.info["directory_scholarships"] = {s.market_id: s for s in db.scalars(select(Scholarship).where(Scholarship.market_id.in_(ids))).all()}
    books, trades = defaultdict(list), defaultdict(list)
    for order in db.scalars(select(Order).where(Order.market_id.in_(ids), Order.status.in_(("OPEN", "PARTIAL")))).all():
        books[order.market_id].append(order)
    since = utcnow() - timedelta(hours=24)
    for trade in db.scalars(select(Trade).where(Trade.market_id.in_(ids)).order_by(Trade.executed_at, Trade.id)).all():
        trades[trade.market_id].append(trade)
    stats = {}
    sparklines = {}
    for m in rows:
        bid = max((o.yes_price_cents for o in books[m.id] if o.book_side == "BID"), default=None)
        ask = min((o.yes_price_cents for o in books[m.id] if o.book_side == "ASK"), default=None)
        recent = [t for t in trades[m.id] if t.executed_at >= since]
        prev = next((t.yes_price_cents for t in reversed(trades[m.id]) if t.executed_at <= since), None)
        volume = sum(t.quantity for t in recent)
        stats[m.id] = {"best_bid": bid, "best_ask": ask, "spread": ask - bid if bid is not None and ask is not None else None,
                       "vwap_24h": round(sum(t.quantity * t.yes_price_cents for t in recent) / volume, 2) if volume else None,
                       "trades_24h": len(recent), "volume_24h": volume,
                       "change_24h": m.last_price_cents - prev if m.last_price_cents is not None and prev is not None else None}
        sparklines[m.id] = [{"t": int(t.executed_at.replace(tzinfo=timezone.utc).timestamp()), "price": t.yes_price_cents, "quantity": t.quantity}
                            for t in trades[m.id][-16:]]
    db.info["directory_stats"] = stats
    db.info["directory_sparklines"] = sparklines


class DirectoryParams:
    def __init__(self, q: str = Query(default="", max_length=200), university: str = "", major: str = "",
                 state: str = "", page: int = Query(default=1, ge=1),
                 page_size: int = Query(default=24, ge=1, le=100), paged: bool = False):
        self.q, self.university, self.major, self.state = q.strip(), university, major, state
        self.page, self.page_size, self.paged = page, page_size, paged


def directory_page(db, stmt, params, serialize, *, markets=False, admin=False):
    base = stmt.join(User, User.id == Student.user_id)
    university_options = db.scalars(select(Student.university).where(Student.id.in_(
        base.with_only_columns(Student.id))).distinct().order_by(Student.university)).all()
    major_options = db.scalars(select(Student.major).where(Student.id.in_(
        base.with_only_columns(Student.id))).distinct().order_by(Student.major)).all()
    total_all = db.scalar(select(func.count()).select_from(base.subquery()))
    filtered = base
    name_match = re.fullmatch(r"student\s*([a-z]|\d+)", params.q.lower())
    if name_match:
        compact = "student" + name_match.group(1)
        filtered = filtered.where(func.replace(func.lower(User.display_name), " ", "") == compact)
    for token in ([] if name_match else params.q.lower().split()):
        fields = [Student.id, Student.university, Student.major, Student.year, User.display_name]
        if markets:
            fields += [Market.id, Market.question, Market.term]
        disclosure_match = select(Disclosure.id).where(Disclosure.student_id == Student.id,
            func.lower(cast(Disclosure.data, String)).contains(token, autoescape=True))
        if not admin:
            disclosure_match = disclosure_match.where(Disclosure.visibility == "PUBLIC",
                or_(Disclosure.verified_at.is_not(None), Disclosure.type.in_(("BIOGRAPHY", "COURSE_PROGRESS"))))
        filtered = filtered.where(or_(*[func.lower(f).contains(token, autoescape=True) for f in fields],
                                       disclosure_match.exists()))
    if params.university:
        filtered = filtered.where(Student.university == params.university)
    if params.major:
        filtered = filtered.where(Student.major == params.major)
    if params.state:
        if markets:
            filtered = filtered.where(Market.status == params.state)
        elif params.state == "REVIEW":
            pending = select(Disclosure.id).where(Disclosure.student_id == Student.id,
                Disclosure.type.notin_(("BIOGRAPHY", "COURSE_PROGRESS")), Disclosure.verified_at.is_(None)).exists()
            filtered = filtered.where(or_(Student.verified.is_(False), pending))
        else:
            filtered = filtered.where(Student.status == params.state)
    ordered = filtered.order_by(Market.id if markets else Student.id)
    if not params.paged:
        return [serialize(db, row) for row in db.scalars(ordered).all()]
    total = db.scalar(select(func.count()).select_from(filtered.subquery()))
    rows = db.scalars(ordered.offset((params.page - 1) * params.page_size).limit(params.page_size)).all()
    prefetch_page(db, rows, markets)
    summary = {}
    if markets:
        ids = base.with_only_columns(Market.id)
        summary = {"pledged_cents": db.scalar(select(func.coalesce(func.sum(Scholarship.promised_cents), 0)).where(Scholarship.market_id.in_(ids))),
                   "paid_cents": db.scalar(select(func.coalesce(func.sum(Scholarship.promised_cents), 0)).where(Scholarship.market_id.in_(ids), Scholarship.status == "PAID"))}
    else:
        eligible = Student.id.in_(base.with_only_columns(Student.id))
        pending = select(Disclosure.id).where(Disclosure.student_id == Student.id,
            Disclosure.type.notin_(("BIOGRAPHY", "COURSE_PROGRESS")), Disclosure.verified_at.is_(None)).exists()
        summary = {"needs_review": db.scalar(select(func.count(Student.id)).where(eligible, or_(Student.verified.is_(False), pending))),
                   "delisted": db.scalar(select(func.count(Student.id)).where(eligible, Student.status == "DELISTED"))}
    return {"items": [serialize(db, row) for row in rows], "total": total, "total_all": total_all,
            "page": params.page, "page_size": params.page_size, "universities": university_options,
            "majors": major_options, "summary": summary}
