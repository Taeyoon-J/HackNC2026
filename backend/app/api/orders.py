from typing import Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..realtime.ws_manager import manager
from ..services import order_service
from ..services.matching_engine import contract_price
from . import serializers as ser
from .deps import current_user

router = APIRouter(prefix="/api/orders", tags=["orders"])


class OrderRequest(BaseModel):
    market_id: str
    contract: Literal["YES", "NO"]
    action: Literal["BUY", "SELL"]
    order_type: Literal["LIMIT", "MARKET"] = "LIMIT"
    price_cents: Optional[int] = Field(default=None, ge=1)  # upper bound is per market
    quantity: int = Field(gt=0)


@router.post("")
async def place_order(req: OrderRequest, user: User = Depends(current_user),
                      db: Session = Depends(get_db)):
    order, trades = order_service.place_order(db, user.id, req.market_id, req.contract, req.action,
                                              req.order_type, req.price_cents, req.quantity)
    for t in trades:
        await manager.broadcast("TRADE_EXECUTED", req.market_id, ser.trade(t))
    await manager.broadcast("ORDERBOOK_UPDATED", req.market_id)
    await manager.broadcast("ORDER_UPDATED", req.market_id, ser.order(order))

    filled = sum(t.quantity for t in trades)
    cost = sum(contract_price(order.contract, t.yes_price_cents) * t.quantity for t in trades)
    return {"order": ser.order(order), "trades": [ser.trade(t) for t in trades],
            "filled_quantity": filled,
            "avg_price_cents": round(cost / filled, 2) if filled else None,
            "total_cents": cost}


@router.delete("/{order_id}")
async def cancel_order(order_id: int, user: User = Depends(current_user),
                       db: Session = Depends(get_db)):
    order = order_service.cancel_order(db, user.id, order_id)
    await manager.broadcast("ORDERBOOK_UPDATED", order.market_id)
    await manager.broadcast("ORDER_UPDATED", order.market_id, ser.order(order))
    return ser.order(order)
