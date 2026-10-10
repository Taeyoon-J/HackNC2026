from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import DomainError, get_db
from ..models import Disclosure, Market, Student
from ..services import student_service, registration_service
from . import serializers as ser

router = APIRouter(prefix="/api/students", tags=["students"])


@router.get("/gpa-averages")
async def gpa_averages(db: Session = Depends(get_db)):
    totals = {}
    for disclosure in db.scalars(select(Disclosure).where(Disclosure.type == "GPA_HISTORY",
        Disclosure.verified_at.is_not(None), Disclosure.visibility == "PUBLIC")).all():
        for term in disclosure.data.get("terms", []):
            bucket = totals.setdefault(term["term"], [])
            bucket.append(term["gpa"])
    return [{"term": term, "gpa": round(sum(values) / len(values), 3), "students": len(values)}
            for term, values in totals.items()]


@router.get("/{student_id}")
async def get_student(student_id: str, db: Session = Depends(get_db)):
    s = db.get(Student, student_id)
    if s is None:
        raise DomainError("Student not found", 404)
    disclosures = db.scalars(select(Disclosure).where(Disclosure.student_id == s.id,
                                                      Disclosure.visibility == "PUBLIC",
                                                      Disclosure.verified_at.is_not(None))
                             .order_by(Disclosure.id)).all()
    markets = db.scalars(select(Market).where(Market.student_id == s.id, Market.status != "DRAFT")).all()
    return {
        **ser.student_brief(db, s),
        "disclosures": [{"id": d.id, "type": d.type, "title": d.title, "data": d.data,
                         "verified_at": ser.iso(d.verified_at)} for d in disclosures],
        "markets": [{"id": m.id, "question": m.question, "status": m.status} for m in markets],
    }


class NewStudent(BaseModel):
    username: str = Field(min_length=3, max_length=80, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=8, max_length=128)
    academic_history: dict
    current_course_load: dict
    university: str = Field(min_length=1, max_length=120)
    year: str = Field(pattern=r"^(Freshman|Sophomore|Junior|Senior|Graduate)$")
    major: str = Field(min_length=1, max_length=120)
    introduction: str = Field(default="", max_length=4000)
    pitch: str = Field(default="", max_length=4000)


@router.post("")
async def create_student(req: NewStudent, db: Session = Depends(get_db)):
    s = registration_service.register(db, req)
    return {**ser.student_brief(db, s), "user_id": s.user_id, "message": "Requires verification. Your account is unavailable until an admin approves it."}
