from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import DomainError, get_db
from ..models import Disclosure, Market, Student
from ..services import student_service
from . import serializers as ser

router = APIRouter(prefix="/api/students", tags=["students"])


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
    university: str = Field(min_length=1, max_length=120)
    year: str = Field(min_length=1, max_length=40)
    major: str = Field(min_length=1, max_length=120)


@router.post("")
async def create_student(req: NewStudent, db: Session = Depends(get_db)):
    """Demo signup: no credentials; the frontend logs in as the returned user_id."""
    s = student_service.create_student(db, req.university, req.year, req.major)
    return {**ser.student_brief(db, s), "user_id": s.user_id}
