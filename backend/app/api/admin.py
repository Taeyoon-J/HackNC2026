from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import get_db
from ..realtime.ws_manager import ALL, manager
from ..services import invariants, market_service, scholarship_service, settlement_service
from . import serializers as ser
from .deps import admin_user

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(admin_user)])


class LockRequest(BaseModel):
    probability: Optional[float] = Field(default=None, gt=0, lt=1)


class ResolveRequest(BaseModel):
    value: float


async def _status_changed(db, market):
    await manager.broadcast("MARKET_STATUS_CHANGED", market.id, {"status": market.status})
    await manager.broadcast("ORDERBOOK_UPDATED", market.id)
    return ser.market(db, market, detail=True)


@router.post("/markets/{market_id}/open")
async def open_market(market_id: str, db: Session = Depends(get_db)):
    market = market_service.get_market(db, market_id)
    market_service.open_market(db, market)
    return await _status_changed(db, market)


@router.get("/markets/{market_id}/lock-preview")
async def lock_preview(market_id: str, db: Session = Depends(get_db)):
    return scholarship_service.lock_preview(db, market_service.get_market(db, market_id))


@router.post("/markets/{market_id}/lock")
async def lock(market_id: str, req: LockRequest, db: Session = Depends(get_db)):
    market = market_service.get_market(db, market_id)
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
