"""Requested F-J demo values, backed by consistent transcripts and real YES trades."""
import copy
import json
import sqlite3
from datetime import datetime
from pathlib import Path

from sqlalchemy import select

from .db import SessionLocal, engine, utcnow
from .models import Disclosure, Market, Order, Student, User
from .services import invariants, order_service, student_service
from .services.fixed_market_service import quote_market

PRESETS = {
    "STU006": {"cumulative": 3.66, "goal": 3.8, "probability": 80},
    "STU007": {"cumulative": 3.3, "goal": 3.5, "probability": 50},
    "STU008": {"cumulative": 3.4, "goal": 3.4, "probability": 50},
    "STU009": {"cumulative": None, "goal": 3.7, "probability": 30},
    "STU010": {"cumulative": 3.06, "goal": 3.4, "probability": 27},
}


def retarget_history(history, target):
    result = copy.deepcopy(history)
    if target is None:
        result["terms"] = []
        return result
    if student_service.cumulative_gpa(result) == target:
        return result
    if not result.get("terms"):
        raise ValueError("A numeric cumulative GPA requires completed semester records")

    # Shift grades together, retaining variation and course credits. Rounding is
    # included in the search so displayed semester GPAs reproduce the target.
    def shifted(offset):
        data = copy.deepcopy(history)
        for term in data["terms"]:
            courses = term.get("courses", [])
            if courses:
                for course in courses:
                    course["gpa"] = round(max(0, min(4, course["gpa"] + offset)), 2)
                term["credits"] = sum(c["credits"] for c in courses)
                term["gpa"] = round(sum(c["gpa"] * c["credits"] for c in courses) / term["credits"], 2)
            else:
                term["gpa"] = round(max(0, min(4, term["gpa"] + offset)), 2)
        return data

    low, high = -4.0, 4.0
    for _ in range(64):
        offset = (low + high) / 2
        result = shifted(offset)
        actual = student_service.cumulative_gpa(result)
        if actual == target:
            return result
        if actual < target:
            low = offset
        else:
            high = offset
    raise ValueError("Could not reproduce the requested GPA with the existing credits")


def apply_presets(db, now=None):
    now = now or utcnow()
    try:
        for sid, preset in PRESETS.items():
            student = db.get(Student, sid)
            history = db.scalar(select(Disclosure).where(Disclosure.student_id == sid, Disclosure.type == "GPA_HISTORY"))
            market = db.scalar(select(Market).where(Market.student_id == sid, Market.term == "Fall 2026"))
            if not student or not history or not market or not market.total_supply:
                raise ValueError(f"Generate the fixed-share cohort before applying {sid}")
            if market.status not in ("DRAFT", "TRADING"):
                raise ValueError(f"Cannot change the demo values of a completed goal: {sid}")
            history.data = retarget_history(history.data, preset["cumulative"])
            history.verified_at = now
            student.verified = True
            for record in db.scalars(select(Disclosure).where(Disclosure.student_id == sid)).all():
                if record.type != "BIOGRAPHY" and not record.verified_at:
                    record.verified_at = now
            market.threshold = preset["goal"]
            name = db.get(User, student.user_id).display_name
            market.question = f"Will {name} earn a {market.term} GPA of {market.threshold} or higher?"
            opening = market.status == "DRAFT"
            market.status = "TRADING"
            if opening or market.last_price_cents != preset["probability"]:
                orders = db.scalars(select(Order).where(Order.market_id == market.id, Order.status.in_(order_service.OPEN_STATUSES))).all()
                if any(not o.user_id.startswith("MM_") for o in orders):
                    raise ValueError(f"Cancel human pending orders before repricing {sid}")
                order_service.cancel_all_open(db, market.id)
                # A one-share maker/taker transfer supplies an actual latest trade
                # and chart point, without changing human holdings or cost bases.
                price = preset["probability"]
                order_service._place(db, "MM_ALPHA", market.id, "YES", "SELL", "LIMIT", price, 1, now)
                order_service._place(db, "MM_BETA", market.id, "YES", "BUY", "LIMIT", price, 1, now)
                quote_market(db, market)
        failed = [c for c in invariants.check_all(db) if not c["ok"]]
        if failed:
            raise RuntimeError(f"Demo value update failed consistency checks: {failed}")
        db.commit()
    except Exception:
        db.rollback()
        raise


if __name__ == "__main__":
    database = Path(engine.url.database).resolve()
    backup = database.with_name(f"spe.before-overrides-{datetime.now():%Y%m%d-%H%M%S}.db")
    with sqlite3.connect(database) as source, sqlite3.connect(backup) as target:
        source.backup(target)
    print(f"Backup: {backup.name}", flush=True)
    with SessionLocal() as db:
        apply_presets(db)
    print(json.dumps(PRESETS))
