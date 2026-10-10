"""Endpoints for the logged-in student to manage their own profile and goal."""
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Disclosure, Market, Scholarship, User
from ..services import ledger_service as ledger
from ..services import student_service
from . import serializers as ser
from .deps import current_user

router = APIRouter(prefix="/api/me", tags=["me"])


class ProfileRequest(BaseModel):
    university: str = Field(min_length=1, max_length=120)
    year: str = Field(min_length=1, max_length=40)
    major: str = Field(min_length=1, max_length=120)


class DisclosureRequest(BaseModel):
    data: dict[str, Any]


class GoalRequest(BaseModel):
    threshold: float
    term: str


def _profile(db: Session, user: User) -> dict:
    s = student_service.student_for_user(db, user.id)
    disclosures = db.scalars(select(Disclosure).where(Disclosure.student_id == s.id).order_by(Disclosure.id)).all()
    markets = db.scalars(select(Market).where(Market.student_id == s.id).order_by(Market.created_at.desc())).all()
    wallet = ledger.wallet(db, user.id)
    return {
        **ser.student_brief(db, s),
        "user_id": user.id,
        "wallet_cents": wallet.available_cents,
        "disclosures": [{"id": d.id, "type": d.type, "title": d.title, "data": d.data,
                         "verified_at": ser.iso(d.verified_at)} for d in disclosures],
        "markets": [{**ser.market(db, m),
                     "scholarship": ser.scholarship(db.scalar(select(Scholarship)
                                                              .where(Scholarship.market_id == m.id)))}
                    for m in markets],
    }


@router.get("/student")
async def my_student(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _profile(db, user)


@router.put("/student")
async def update_profile(req: ProfileRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    s = student_service.student_for_user(db, user.id)
    student_service.update_profile(db, s, req.university, req.year, req.major)
    return _profile(db, user)


@router.put("/student/disclosures/{dtype}")
async def upsert_disclosure(dtype: str, req: DisclosureRequest, user: User = Depends(current_user),
                            db: Session = Depends(get_db)):
    s = student_service.student_for_user(db, user.id)
    student_service.upsert_disclosure(db, s, dtype, req.data)
    return _profile(db, user)


@router.post("/goals")
async def propose_goal(req: GoalRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    s = student_service.student_for_user(db, user.id)
    student_service.propose_goal(db, s, req.threshold, req.term)
    return _profile(db, user)


