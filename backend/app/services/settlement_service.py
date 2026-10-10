"""Event resolution and final settlement of contracts and the scholarship."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import DomainError, utcnow
from ..models import Market, Position, Scholarship, Settlement, Student
from . import ledger_service as ledger
from . import market_service, order_service
from .matching_engine import NO, YES


def resolve(db: Session, market: Market, value: float, *, commit=True) -> Market:
    if not 0 <= value <= 4:
        raise DomainError("Final GPA must be between 0 and 4")
    if market.total_supply:
        if market.status not in ("TRADING", "PRICE_DISCOVERY", "CLOSED"):
            raise DomainError("Only active or closed markets can be resolved")
        market.final_price_cents = market.final_price_cents or market.last_price_cents
        if market.final_price_cents is None:
            bid, ask = market_service.best_prices(db, market.id)
            market.final_price_cents = round((bid + ask) / 2) if bid is not None and ask is not None else bid or ask
        if market.final_price_cents is None:
            raise DomainError("A final trade or quote price is required before GPA settlement")
        order_service.cancel_all_open(db, market.id)
        market.status = "CLOSED"
    if market.status == "TRADING":
        market_service.close_market(db, market, commit=False)
    market_service.transition(market, "RESOLVED")
    market.resolved_value = value
    market.outcome = YES if value >= market.threshold else NO
    if commit:
        db.commit()
    return market


def settle(db: Session, market: Market, now=None, *, commit=True) -> dict:
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

    if market.total_supply:
        # Failed YES shares pay zero; their backing returns to the issuer treasury.
        if market.collateral_cents:
            ledger.post(db, [(ledger.collateral_account(market.id), -market.collateral_cents),
                             (ledger.TREASURY, market.collateral_cents)], "YES_COLLATERAL_RELEASE", now=now)
            market.collateral_cents = 0
        scholarship = db.scalar(select(Scholarship).where(Scholarship.market_id == market.id))
        sign = 1 if market.outcome == YES else -1
        amount = market.initial_scholarship_cents + sign * market.final_price_cents * 100
        reserve = ledger.scholarship_account(market.id)
        balance = ledger.balance(db, reserve)
        if balance < amount:
            raise DomainError("Scholarship reserve is insufficient")
        student = db.get(Student, market.student_id)
        entries = [(reserve, -balance), (ledger.user_account(student.user_id), amount)]
        if balance > amount:
            entries.append((ledger.TREASURY, balance - amount))
        ledger.post(db, entries, "SCHOLARSHIP_PAYOUT", now=now)
        scholarship.promised_cents, scholarship.status, scholarship.paid_at = amount, "PAID", now
        scholarship.locked_probability_bp = market.final_price_cents * 100
        if commit:
            db.commit()
        return {"contracts_paid_cents": total_paid, "scholarship_paid_cents": amount, "outcome": market.outcome}

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

    if commit:
        db.commit()
    return {"contracts_paid_cents": total_paid, "scholarship_paid_cents": scholarship_paid,
            "outcome": market.outcome}
