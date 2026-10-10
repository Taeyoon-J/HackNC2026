from datetime import timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Favorite, Market, Order, Student, Trade, User
from .deps import current_user
from ..services import market_service
from ..services.matching_engine import aggregate_levels
from ..services.order_service import OPEN_STATUSES
from . import serializers as ser
from .directory import DirectoryParams, directory_page

router = APIRouter(prefix="/api/markets", tags=["markets"])


@router.get("")
async def list_markets(favorites: bool = False, params: DirectoryParams = Depends(), user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Public directory: hides draft goals and delisted students."""
    stmt = select(Market).join(Student, Student.id == Market.student_id).where(
        Market.status != "DRAFT", Student.status == "ACTIVE", Student.verified.is_(True))
    if favorites:
        stmt = stmt.where(select(Favorite.market_id).where(Favorite.market_id == Market.id, Favorite.user_id == user.id).exists())
    return directory_page(db, stmt, params, ser.market, markets=True)


@router.get("/{market_id}")
async def get_market(market_id: str, db: Session = Depends(get_db)):
    return ser.market(db, market_service.get_market(db, market_id), detail=True)


@router.get("/{market_id}/orderbook")
async def orderbook(market_id: str, db: Session = Depends(get_db)):
    market_service.get_market(db, market_id)
    resting = db.scalars(select(Order).where(Order.market_id == market_id,
                                             Order.status.in_(OPEN_STATUSES))).all()
    book = aggregate_levels(resting)
    return {k: [vars(level) for level in v] for k, v in book.items()}


@router.get("/{market_id}/trades")
async def trades(market_id: str, limit: int = 50, db: Session = Depends(get_db)):
    rows = db.scalars(select(Trade).where(Trade.market_id == market_id)
                      .order_by(Trade.executed_at.desc(), Trade.id.desc()).limit(limit)).all()
    return [ser.trade(t) for t in rows]


@router.get("/{market_id}/history")
async def history(market_id: str, db: Session = Depends(get_db)):
    rows = db.scalars(select(Trade).where(Trade.market_id == market_id)
                      .order_by(Trade.executed_at.asc(), Trade.id.asc())).all()
    return [{"t": int(t.executed_at.replace(tzinfo=timezone.utc).timestamp()),
             "price": t.yes_price_cents, "quantity": t.quantity} for t in rows]
