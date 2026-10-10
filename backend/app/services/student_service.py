"""Student self-service (profile, disclosures, goal proposals) and admin student management."""
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import DomainError, utcnow
from ..models import Disclosure, Market, Student, User, Wallet
from . import order_service

DISCLOSURE_TITLES = {
    "GPA_HISTORY": "Term GPA (transcript verified)",
    "COURSE_LOAD": "Current course load",
    "ACTIVITY": "Activities",
    "APPLICATION": "Applications & awards",
}
FINAL_STATUSES = ("SETTLED",)


def student_for_user(db: Session, user_id: str) -> Student:
    student = db.scalar(select(Student).where(Student.user_id == user_id))
    if student is None:
        raise DomainError("No student profile for this account", 404)
    return student


def create_student(db: Session, university: str, year: str, major: str) -> Student:
    """Students are listed anonymously as 'Student <letter>' in signup order."""
    n = db.scalar(select(func.count(Student.id))) + 1
    student_id = f"STU{n:03d}"
    user_id = f"STUDENT_{n:03d}"
    letter = chr(ord("A") + n - 1) if n <= 26 else str(n)
    db.add(User(id=user_id, role="STUDENT", display_name=f"Student {letter}"))
    db.add(Wallet(user_id=user_id))
    db.add(Student(id=student_id, user_id=user_id, university=university, year=year, major=major,
                   verified=False))
    db.commit()
    return db.get(Student, student_id)


def update_profile(db: Session, student: Student, university: str, year: str, major: str) -> Student:
    student.university, student.year, student.major = university, year, major
    db.commit()
    return student


def upsert_disclosure(db: Session, student: Student, dtype: str, data: dict) -> Disclosure:
    """Any edit clears verification; it stays hidden from traders until an admin re-verifies."""
    if dtype not in DISCLOSURE_TITLES:
        raise DomainError(f"Unknown disclosure type {dtype}")
    d = db.scalar(select(Disclosure).where(Disclosure.student_id == student.id, Disclosure.type == dtype))
    if d is None:
        d = Disclosure(student_id=student.id, type=dtype, title=DISCLOSURE_TITLES[dtype], data=data)
        db.add(d)
    d.data = data
    d.verified_at = None
    db.commit()
    return d


def term_deadline(term: str) -> datetime:
    season, _, year = term.partition(" ")
    if season not in ("Fall", "Spring") or not year.isdigit():
        raise DomainError("Term must look like 'Fall 2026' or 'Spring 2027'")
    return datetime(int(year), 12, 20, 23, 59) if season == "Fall" else datetime(int(year), 5, 15, 23, 59)


def propose_goal(db: Session, student: Student, threshold: float, term: str) -> Market:
    if student.status != "ACTIVE":
        raise DomainError("Delisted students cannot propose goals")
    active = db.scalar(select(Market).where(Market.student_id == student.id,
                                            Market.status.not_in(FINAL_STATUSES)))
    if active is not None:
        raise DomainError("You already have an active goal")
    if not 2.0 <= threshold <= 4.0:
        raise DomainError("GPA target must be between 2.0 and 4.0")
    deadline = term_deadline(term)
    season, _, year = term.partition(" ")
    market_id = f"{student.id}-GPA-{year}{season[0]}"
    if db.get(Market, market_id):
        raise DomainError(f"A goal for {term} already exists")
    name = db.get(User, student.user_id).display_name
    market = Market(id=market_id, student_id=student.id, threshold=threshold, term=term, deadline=deadline,
                    question=f"Will {name} earn a {term} GPA of {threshold} or higher?", status="DRAFT")
    db.add(market)
    db.commit()
    return market


def verify(db: Session, student: Student) -> Student:
    now = utcnow()
    student.verified = True
    for d in db.scalars(select(Disclosure).where(Disclosure.student_id == student.id)).all():
        d.verified_at = d.verified_at or now
    db.commit()
    return student


def delist(db: Session, student: Student) -> int:
    """Hide the student from traders and cancel resting orders so reservations are released."""
    student.status = "DELISTED"
    cancelled = 0
    for m in db.scalars(select(Market).where(Market.student_id == student.id)).all():
        cancelled += order_service.cancel_all_open(db, m.id)
    db.commit()
    return cancelled


def restore(db: Session, student: Student) -> Student:
    student.status = "ACTIVE"
    db.commit()
    return student
