import re
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session

from ..db import DomainError, get_db, utcnow
from ..models import Market, Student, User, VerificationRequest
from ..realtime.ws_manager import ALL, manager
from ..services import student_service, verification_service
from .deps import admin_user, current_user
from . import serializers as ser

router = APIRouter(prefix="/api", tags=["verification"])


class Submission(BaseModel):
    type: str
    payload: dict
    evidence: str = Field(default="", max_length=8000)
    evidence_file: dict | None = None


class Review(BaseModel):
    note: str = Field(default="", max_length=4000)


def serialize(db, r, *, detail=False):
    student = db.get(Student, r.student_id)
    out = {"id": r.id, "student": ser.student_brief(db, student), "type": r.type, "payload": r.payload,
           "status": r.status, "created_at": ser.iso(r.created_at), "reviewed_at": ser.iso(r.reviewed_at),
           "review_note": r.review_note, "evidence": r.evidence,
           "file_name": r.evidence_file.get("name") if r.evidence_file else None}
    if detail:
        out["evidence_file"] = r.evidence_file
    return out


def get_request(db, rid):
    r = db.get(VerificationRequest, rid)
    if r is None:
        raise DomainError("Verification request not found", 404)
    return r


@router.get("/me/verifications")
async def my_requests(user: User = Depends(current_user), db: Session = Depends(get_db)):
    student = student_service.student_for_user(db, user.id)
    return [serialize(db, r) for r in db.scalars(select(VerificationRequest).where(
        VerificationRequest.student_id == student.id).order_by(VerificationRequest.created_at.desc())).all()]


@router.post("/me/verifications")
async def submit(req: Submission, user: User = Depends(current_user), db: Session = Depends(get_db)):
    r = verification_service.submit(db, student_service.student_for_user(db, user.id), req.type, req.payload, req.evidence, req.evidence_file)
    await manager.broadcast("VERIFICATION_UPDATED", ALL, {"id": r.id})
    return serialize(db, r)


@router.get("/admin/verifications")
async def list_requests(q: str = Query(default="", max_length=200), type: str = "", status: str = "PENDING",
                        page: int = Query(default=1, ge=1), user: User = Depends(admin_user), db: Session = Depends(get_db)):
    stmt = select(VerificationRequest).join(Student, Student.id == VerificationRequest.student_id).join(User, User.id == Student.user_id)
    name = re.fullmatch(r"student\s*([a-z]|\d+)", q.strip(), re.IGNORECASE)
    if name:
        stmt = stmt.where(func.lower(User.display_name) == f"student {name.group(1).lower()}")
    for token in ([] if name else q.lower().split()):
        stmt = stmt.where(or_(*[func.lower(field).contains(token, autoescape=True) for field in
            (User.display_name, Student.id, Student.university, Student.major, VerificationRequest.type,
             VerificationRequest.evidence, cast(VerificationRequest.payload, String))]))
    if type:
        stmt = stmt.where(VerificationRequest.type == type)
    if status:
        stmt = stmt.where(VerificationRequest.status == status)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(VerificationRequest.created_at, VerificationRequest.id).offset((page - 1) * 20).limit(20)).all()
    return {"items": [serialize(db, r) for r in rows], "total": total, "page": page, "page_size": 20}


@router.get("/admin/verifications/{rid}")
async def detail(rid: int, user: User = Depends(admin_user), db: Session = Depends(get_db)):
    return serialize(db, get_request(db, rid), detail=True)


@router.post("/admin/verifications/{rid}/approve")
async def approve(rid: int, req: Review, user: User = Depends(admin_user), db: Session = Depends(get_db)):
    r = get_request(db, rid)
    verification_service.approve(db, r, db.get(Student, r.student_id), user, req.note)
    await manager.broadcast("STUDENT_UPDATED", ALL, {"student_id": r.student_id})
    await manager.broadcast("VERIFICATION_UPDATED", ALL, {"id": r.id})
    if r.type == "FINAL_GPA":
        await manager.broadcast("MARKET_SETTLED", r.payload["market_id"], {"verified_gpa": r.payload["gpa"], "outcome": db.get(Market, r.payload["market_id"]).outcome})
    return serialize(db, r)


@router.post("/admin/verifications/{rid}/reject")
async def reject(rid: int, req: Review, user: User = Depends(admin_user), db: Session = Depends(get_db)):
    r = get_request(db, rid)
    if r.status != "PENDING":
        raise DomainError("This request has already been reviewed")
    if not req.note.strip():
        raise DomainError("Provide a reason for rejection")
    r.status, r.reviewed_at, r.reviewed_by, r.review_note = "REJECTED", utcnow(), user.id, req.note.strip()
    db.commit()
    await manager.broadcast("VERIFICATION_UPDATED", ALL, {"id": r.id})
    return serialize(db, r)
