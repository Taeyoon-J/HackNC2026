"""Event resolution and final settlement of contracts and the scholarship."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import DomainError, utcnow
from ..models import Market, Position, Scholarship, Settlement, Student
from . import ledger_service as ledger
from . import market_service
from .matching_engine import NO, YES


def resolve(db: Session, market: Market, value: float) -> Market:
    if market.status == "TRADING":
        market_service.close_market(db, market, commit=False)
    market_service.transition(market, "RESOLVED")
    market.resolved_value = value
    market.outcome = YES if value >= market.threshold else NO
    db.commit()
    return market


def settle(db: Session, market: Market, now=None) -> dict:
    now = now or utcnow()
    if market.status != "RESOLVED":
        raise DomainError("Only RESOLVED markets can be settled (prevents double settlement)")
    market_service.transition(market, "SETTLED")

    positions = db.scalars(select(Position).where(Position.market_id == market.id,
                                                  Position.quantity > 0)).all()
    total_paid = 0
    for pos in positions:
        if pos.reserved_qty:
            raise AssertionError("open sell reservations remain after close")
        payout = pos.quantity * 100 if pos.contract == market.outcome else 0
        if payout:
            ledger.post(db, [(ledger.collateral_account(market.id), -payout),
                             (ledger.user_account(pos.user_id), payout)], "SETTLEMENT", now=now)
        db.add(Settlement(market_id=market.id, user_id=pos.user_id, contract=pos.contract,
                          quantity=pos.quantity, payout_cents=payout, created_at=now))
        total_paid += payout
        pos.quantity = 0
        pos.cost_basis_cents = 0
    market.collateral_cents -= total_paid

    scholarship = db.scalar(select(Scholarship).where(Scholarship.market_id == market.id))
    scholarship_paid = 0
    if scholarship and scholarship.status == "LOCKED":
        reserve = ledger.scholarship_account(market.id)
        if market.outcome == YES:
            student = db.get(Student, market.student_id)
            ledger.post(db, [(reserve, -scholarship.promised_cents),
                             (ledger.user_account(student.user_id), scholarship.promised_cents)],
                        "SCHOLARSHIP_PAYOUT", now=now)
            scholarship.status = "PAID"
            scholarship_paid = scholarship.promised_cents
        else:
            ledger.post(db, [(reserve, -scholarship.promised_cents),
                             (ledger.TREASURY, scholarship.promised_cents)],
                        "SCHOLARSHIP_RELEASE", now=now)
            scholarship.status = "VOID"
        scholarship.paid_at = now

    db.commit()
    return {"contracts_paid_cents": total_paid, "scholarship_paid_cents": scholarship_paid,
            "outcome": market.outcome}
