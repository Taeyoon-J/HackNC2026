"""Market lifecycle state machine and read-side stats."""
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import DomainError, utcnow
from ..models import Market, Order, Trade
from . import order_service
from .matching_engine import ASK, BID

STATUS_FLOW = ["DRAFT", "PRICE_DISCOVERY", "SCHOLARSHIP_LOCKED", "TRADING", "CLOSED",
               "RESOLVED", "SETTLED"]
TRANSITIONS = {a: {b} for a, b in zip(STATUS_FLOW, STATUS_FLOW[1:])}


def get_market(db: Session, market_id: str) -> Market:
    market = db.get(Market, market_id)
    if market is None:
        raise DomainError("Market not found", 404)
    return market


def transition(market: Market, to: str) -> None:
    if to not in TRANSITIONS.get(market.status, set()):
        raise DomainError(f"Transition {market.status} → {to} is not allowed")
    market.status = to


def open_market(db: Session, market: Market) -> None:
    if market.total_supply:
        if market.status != "DRAFT":
            raise DomainError("Only draft markets can be opened")
        market.status = "TRADING"
        from .fixed_market_service import quote_market
        quote_market(db, market)
        db.commit()
        return
    transition(market, "PRICE_DISCOVERY")
    db.commit()


def start_trading(db: Session, market: Market) -> None:
    transition(market, "TRADING")
    db.commit()


def close_market(db: Session, market: Market, commit: bool = True) -> int:
    if market.total_supply:
        bid, ask = best_prices(db, market.id)
        market.final_price_cents = market.last_price_cents or (round((bid + ask) / 2) if bid is not None and ask is not None else bid or ask)
    transition(market, "CLOSED")
    cancelled = order_service.cancel_all_open(db, market.id)
    if commit:
        db.commit()
    return cancelled


def best_prices(db: Session, market_id: str) -> tuple[int | None, int | None]:
    open_q = (Order.market_id == market_id, Order.status.in_(order_service.OPEN_STATUSES))
    best_bid = db.scalar(select(func.max(Order.yes_price_cents)).where(*open_q, Order.book_side == BID))
    best_ask = db.scalar(select(func.min(Order.yes_price_cents)).where(*open_q, Order.book_side == ASK))
    return best_bid, best_ask


def vwap(db: Session, market_id: str, since) -> tuple[float | None, int, int]:
    """Returns (vwap_cents, trade_count, volume) for trades executed after `since`."""
    row = db.execute(select(func.sum(Trade.yes_price_cents * Trade.quantity),
                            func.sum(Trade.quantity), func.count(Trade.id))
                     .where(Trade.market_id == market_id, Trade.executed_at >= since)).one()
    notional, volume, count = row
    if not volume:
        return None, 0, 0
    return notional / volume, count, volume


def price_at(db: Session, market_id: str, at) -> int | None:
    return db.scalar(select(Trade.yes_price_cents)
                     .where(Trade.market_id == market_id, Trade.executed_at <= at)
                     .order_by(Trade.executed_at.desc(), Trade.id.desc()).limit(1))


def stats(db: Session, market: Market, now=None) -> dict:
    now = now or utcnow()
    best_bid, best_ask = best_prices(db, market.id)
    vwap24, count24, volume24 = vwap(db, market.id, now - timedelta(hours=24))
    prev = price_at(db, market.id, now - timedelta(hours=24))
    change = (market.last_price_cents - prev) if (prev is not None and market.last_price_cents is not None) else None
    return {
        "best_bid": best_bid,
        "best_ask": best_ask,
        "spread": (best_ask - best_bid) if best_bid is not None and best_ask is not None else None,
        "vwap_24h": round(vwap24, 2) if vwap24 is not None else None,
        "trades_24h": count24,
        "volume_24h": volume24,
        "change_24h": change,
    }
