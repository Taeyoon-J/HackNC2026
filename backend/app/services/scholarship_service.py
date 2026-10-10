"""Scholarship pricing and lock. The promised amount is fixed at lock time and
funded from the treasury into a per-market reserve, separate from contract collateral."""
from datetime import timedelta

from sqlalchemy.orm import Session

from ..db import DomainError, utcnow
from ..models import Market, Scholarship
from . import ledger_service as ledger
from . import market_service

MIN_TRADES_FOR_LOCK = 3
MIN_VOLUME_FOR_LOCK = 100


def calculate_scholarship(probability: float) -> float:
    p = max(0.10, probability)
    scholarship = 1000 * (0.5 / p) ** 0.75
    return min(3000, round(scholarship, 2))


def scholarship_cents(probability: float) -> int:
    return round(calculate_scholarship(probability) * 100)


def lock_preview(db: Session, market: Market, now=None) -> dict:
    now = now or utcnow()
    vwap, count, volume = market_service.vwap(db, market.id, now - timedelta(hours=24))
    sufficient = vwap is not None and count >= MIN_TRADES_FOR_LOCK and volume >= MIN_VOLUME_FOR_LOCK
    probability = vwap / 100 if vwap is not None else None
    return {
        "vwap_24h": round(vwap, 2) if vwap is not None else None,
        "trades_24h": count,
        "volume_24h": volume,
        "sufficient": sufficient,
        "min_trades": MIN_TRADES_FOR_LOCK,
        "min_volume": MIN_VOLUME_FOR_LOCK,
        "suggested_probability": round(probability, 4) if probability is not None else None,
        "suggested_cents": scholarship_cents(probability) if probability is not None else None,
    }


def lock(db: Session, market: Market, probability: float | None = None, now=None) -> Scholarship:
    """Lock the scholarship. `probability` is an admin override; otherwise the 24h VWAP is used."""
    now = now or utcnow()
    if market.status != "PRICE_DISCOVERY":
        raise DomainError("Scholarship can only be locked during PRICE_DISCOVERY")
    if probability is None:
        preview = lock_preview(db, market, now)
        if not preview["sufficient"]:
            raise DomainError("Not enough valid trades in the last 24h; lock deferred")
        probability = preview["suggested_probability"]
    if not 0.01 <= probability <= 0.99:
        raise DomainError("Probability must be between 0.01 and 0.99")

    bp = round(probability * 10000)
    promised = scholarship_cents(bp / 10000)
    ledger.post(db, [(ledger.TREASURY, -promised), (ledger.scholarship_account(market.id), promised)],
                "SCHOLARSHIP_RESERVE", now=now)
    scholarship = Scholarship(market_id=market.id, locked_probability_bp=bp, promised_cents=promised,
                              status="LOCKED", locked_at=now)
    db.add(scholarship)
    market_service.transition(market, "SCHOLARSHIP_LOCKED")
    db.commit()
    return scholarship
