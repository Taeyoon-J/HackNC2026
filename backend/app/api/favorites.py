from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..db import DomainError, get_db
from ..models import Favorite, Market, Student, User
from .deps import current_user

router = APIRouter(prefix="/api/favorites", tags=["favorites"])


def trader(user):
    if user.role != "TRADER":
        raise DomainError("Trader account required", 403)


@router.get("")
async def favorites(user: User = Depends(current_user), db: Session = Depends(get_db)):
    trader(user)
    return db.scalars(select(Favorite.market_id).where(Favorite.user_id == user.id)).all()


@router.put("/{market_id}")
async def add(market_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    trader(user)
    market = db.get(Market, market_id)
    if market is None or market.status == "DRAFT":
        raise DomainError("Listed market not found", 404)
    student = db.get(Student, market.student_id)
    if not student.verified or student.status != "ACTIVE":
        raise DomainError("This student is not currently listed")
    if db.get(Favorite, (user.id, market_id)) is None:
        db.add(Favorite(user_id=user.id, market_id=market_id))
        db.commit()
    return {"market_id": market_id, "favorite": True}


@router.delete("/{market_id}")
async def remove(market_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    trader(user)
    row = db.get(Favorite, (user.id, market_id))
    if row:
        db.delete(row)
        db.commit()
    return {"market_id": market_id, "favorite": False}
