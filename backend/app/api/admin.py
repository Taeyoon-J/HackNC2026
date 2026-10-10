from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from sqlalchemy import func, select

from ..db import DomainError, get_db
from ..models import Disclosure, Market, Position, Student, User, VerificationRequest
from ..realtime.ws_manager import ALL, manager
from ..services import (invariants, market_service, scholarship_service, settlement_service,
                        student_service)
from . import serializers as ser
from .deps import admin_user
from .directory import DirectoryParams, directory_page

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(admin_user)])


class LockRequest(BaseModel):
    probability: Optional[float] = Field(default=None, gt=0, lt=1)


class ResolveRequest(BaseModel):
    value: float


async def _status_changed(db, market):
    await manager.broadcast("MARKET_STATUS_CHANGED", market.id, {"status": market.status})
    await manager.broadcast("ORDERBOOK_UPDATED", market.id)
    return ser.market(db, market, detail=True)


@router.get("/markets")
async def all_markets(params: DirectoryParams = Depends(), db: Session = Depends(get_db)):
    return directory_page(db, select(Market).join(Student, Student.id == Market.student_id),
                          params, ser.market, markets=True, admin=True)


@router.post("/markets/{market_id}/open")
async def open_market(market_id: str, db: Session = Depends(get_db)):
    market = market_service.get_market(db, market_id)
    student = db.get(Student, market.student_id)
    if not student.verified or student.status != "ACTIVE":
        raise DomainError("Verify and list the student before opening their market")
    market_service.open_market(db, market)
    return await _status_changed(db, market)


@router.get("/markets/{market_id}/lock-preview")
async def lock_preview(market_id: str, db: Session = Depends(get_db)):
    return scholarship_service.lock_preview(db, market_service.get_market(db, market_id))


@router.post("/markets/{market_id}/lock")
async def lock(market_id: str, req: LockRequest, db: Session = Depends(get_db)):
    market = market_service.get_market(db, market_id)
    if market.total_supply:
        raise DomainError("Initial scholarships are already assigned; probability locking is no longer used")
    s = scholarship_service.lock(db, market, req.probability)
    await manager.broadcast("SCHOLARSHIP_LOCKED", market.id, ser.scholarship(s))
    return await _status_changed(db, market)


@router.post("/markets/{market_id}/start-trading")
async def start_trading(market_id: str, db: Session = Depends(get_db)):
    market = market_service.get_market(db, market_id)
    market_service.start_trading(db, market)
    return await _status_changed(db, market)


@router.post("/markets/{market_id}/close")
async def close(market_id: str, db: Session = Depends(get_db)):
    market = market_service.get_market(db, market_id)
    market_service.close_market(db, market)
    return await _status_changed(db, market)


@router.post("/markets/{market_id}/resolve")
async def resolve(market_id: str, req: ResolveRequest, db: Session = Depends(get_db)):
    market = market_service.get_market(db, market_id)
    if market.total_supply:
        raise DomainError("Approve a final-GPA verification request to settle this market")
    settlement_service.resolve(db, market, req.value)
    return await _status_changed(db, market)


@router.post("/markets/{market_id}/settle")
async def settle(market_id: str, db: Session = Depends(get_db)):
    market = market_service.get_market(db, market_id)
    result = settlement_service.settle(db, market)
    await manager.broadcast("MARKET_SETTLED", market.id, result)
    await _status_changed(db, market)
    return result


@router.get("/invariants")
async def check_invariants(db: Session = Depends(get_db)):
    return invariants.check_all(db)


@router.post("/reset")
async def reset():
    from ..seed import reset_and_seed
    reset_and_seed()
    await manager.broadcast("MARKET_STATUS_CHANGED", ALL, {"reset": True})
    return {"ok": True}


def _student(db: Session, student_id: str) -> Student:
    s = db.get(Student, student_id)
    if s is None:
        raise DomainError("Student not found", 404)
    return s


def _student_row(db: Session, s: Student) -> dict:
    pending_cache = db.info.get("directory_pending")
    pending = pending_cache.get(s.id, 0) if pending_cache is not None else db.scalar(select(func.count(Disclosure.id)).where(Disclosure.student_id == s.id,
                                                                Disclosure.type != "BIOGRAPHY",
                                                                Disclosure.verified_at.is_(None)))
    markets_cache = db.info.get("directory_student_markets")
    markets = markets_cache.get(s.id, []) if markets_cache is not None else db.scalars(select(Market).where(Market.student_id == s.id).order_by(Market.created_at)).all()
    return {**ser.student_brief(db, s), "user_id": s.user_id, "pending_disclosures": pending,
            "markets": [{"id": m.id, "status": m.status, "threshold": m.threshold, "term": m.term}
                        for m in markets]}


@router.get("/students")
async def list_students(params: DirectoryParams = Depends(), db: Session = Depends(get_db)):
    return directory_page(db, select(Student), params, _student_row, admin=True)


@router.get("/students/{student_id}")
async def student_detail(student_id: str, db: Session = Depends(get_db)):
    s = _student(db, student_id)
    disclosures = db.scalars(select(Disclosure).where(Disclosure.student_id == s.id).order_by(Disclosure.id)).all()
    markets = db.scalars(select(Market).where(Market.student_id == s.id).order_by(Market.created_at.desc())).all()
    holdings = db.execute(select(Position, User).join(User, User.id == Position.user_id).where(
        Position.market_id.in_([m.id for m in markets]), Position.quantity > 0,
        User.role == "TRADER", ~User.id.startswith("MM_"))).all()
    history = next((d for d in disclosures if d.type == "GPA_HISTORY"), None)
    return {**_student_row(db, s), "market_details": [ser.market(db, m, detail=True) for m in markets],
            "cumulative_gpa": student_service.cumulative_gpa(history.data) if history else None,
            "holders": [{"market_id": p.market_id, "user_id": u.id, "name": u.display_name,
                         "contract": p.contract, "quantity": p.quantity, "reserved_qty": p.reserved_qty,
                         "cost_basis_cents": p.cost_basis_cents} for p, u in holdings],
            "disclosures": [{"id": d.id, "type": d.type, "title": d.title,
            "data": d.data, "verified_at": ser.iso(d.verified_at)} for d in disclosures]}


@router.post("/students/{student_id}/verify")
async def verify_student(student_id: str, user: User = Depends(admin_user), db: Session = Depends(get_db)):
    s = _student(db, student_id)
    if s.status == "PENDING_VERIFICATION":
        from ..services import verification_service
        request = db.scalar(select(VerificationRequest).where(VerificationRequest.student_id == s.id,
            VerificationRequest.type == "REGISTRATION", VerificationRequest.status == "PENDING"))
        if request is None:
            raise DomainError("No pending registration request")
        verification_service.approve(db, request, s, user)
        await manager.broadcast("VERIFICATION_UPDATED", ALL, {"id": request.id})
    else:
        s = student_service.verify(db, s)
    await manager.broadcast("STUDENT_UPDATED", ALL, {"student_id": s.id})
    return _student_row(db, s)


@router.post("/students/{student_id}/delist")
async def delist_student(student_id: str, db: Session = Depends(get_db)):
    s = _student(db, student_id)
    cancelled = student_service.delist(db, s)
    await manager.broadcast("STUDENT_UPDATED", ALL, {"student_id": s.id})
    return {**_student_row(db, s), "cancelled_orders": cancelled}


@router.post("/students/{student_id}/restore")
async def restore_student(student_id: str, db: Session = Depends(get_db)):
    s = student_service.restore(db, _student(db, student_id))
    await manager.broadcast("STUDENT_UPDATED", ALL, {"student_id": s.id})
    return _student_row(db, s)
