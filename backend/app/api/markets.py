from datetime import timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Market, Order, Trade
from ..services import market_service
from ..services.matching_engine import aggregate_levels
from ..services.order_service import OPEN_STATUSES
from . import serializers as ser

router = APIRouter(prefix="/api/markets", tags=["markets"])


@router.get("")
async def list_markets(db: Session = Depends(get_db)):
    return [ser.market(db, m) for m in db.scalars(select(Market).order_by(Market.id)).all()]


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
