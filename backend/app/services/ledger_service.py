"""Double-entry ledger and wallet reservations.

Accounts: user:{id}, market:{id}:collateral, scholarship:{market_id}, platform:treasury.
Each posted transaction sums to zero. A user's ledger balance always equals
wallet.available + wallet.reserved; reservations move cash inside the wallet only.
"""
import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import DomainError, utcnow
from ..models import LedgerEntry, Wallet

TREASURY = "platform:treasury"


def user_account(user_id: str) -> str:
    return f"user:{user_id}"


def collateral_account(market_id: str) -> str:
    return f"market:{market_id}:collateral"


def scholarship_account(market_id: str) -> str:
    return f"scholarship:{market_id}"


def wallet(db: Session, user_id: str) -> Wallet:
    w = db.get(Wallet, user_id)
    if w is None:
        raise DomainError(f"No wallet for {user_id}", 404)
    return w


def reserve_cash(db: Session, user_id: str, amount: int) -> None:
    w = wallet(db, user_id)
    if w.available_cents < amount:
        raise DomainError(
            f"Insufficient balance: need ${amount / 100:,.2f}, available ${w.available_cents / 100:,.2f}"
        )
    w.available_cents -= amount
    w.reserved_cents += amount


def release_cash(db: Session, user_id: str, amount: int) -> None:
    w = wallet(db, user_id)
    if w.reserved_cents < amount:
        raise AssertionError(f"reserved underflow for {user_id}")
    w.reserved_cents -= amount
    w.available_cents += amount


def post(db: Session, entries: list[tuple[str, int]], entry_type: str,
         ref_trade_id: int | None = None, now=None) -> str:
    if sum(amount for _, amount in entries) != 0:
        raise AssertionError(f"unbalanced ledger transaction: {entries}")
    tx_id = uuid.uuid4().hex
    now = now or utcnow()
    for account, amount in entries:
        if amount == 0:
            continue
        db.add(LedgerEntry(transaction_id=tx_id, account=account, amount_cents=amount,
                           entry_type=entry_type, ref_trade_id=ref_trade_id, created_at=now))
        if account.startswith("user:"):
            w = wallet(db, account.removeprefix("user:"))
            w.available_cents += amount
            if w.available_cents < 0:
                raise DomainError("Insufficient balance")
    return tx_id


def balance(db: Session, account: str) -> int:
    return db.scalar(select(func.coalesce(func.sum(LedgerEntry.amount_cents), 0))
                     .where(LedgerEntry.account == account))


def fund_user(db: Session, user_id: str, amount: int, now=None) -> None:
    post(db, [(TREASURY, -amount), (user_account(user_id), amount)], "FUNDING", now=now)
