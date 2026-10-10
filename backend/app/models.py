"""SQLAlchemy models. Every money amount is an integer number of cents."""
from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base, utcnow


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    role: Mapped[str]  # STUDENT | TRADER | ADMIN
    display_name: Mapped[str]
    status: Mapped[str] = mapped_column(default="ACTIVE")


class Wallet(Base):
    __tablename__ = "wallets"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    available_cents: Mapped[int] = mapped_column(default=0)
    reserved_cents: Mapped[int] = mapped_column(default=0)


class Student(Base):
    __tablename__ = "students"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    university: Mapped[str]
    year: Mapped[str]
    major: Mapped[str]
    verified: Mapped[bool] = mapped_column(default=False)
    status: Mapped[str] = mapped_column(default="ACTIVE")  # ACTIVE | DELISTED


class Disclosure(Base):
    __tablename__ = "disclosures"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id"))
    type: Mapped[str]  # GPA_HISTORY | COURSE_LOAD | ACTIVITY | APPLICATION
    title: Mapped[str]
    data: Mapped[dict] = mapped_column(JSON)
    visibility: Mapped[str] = mapped_column(default="PUBLIC")
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    __table_args__ = (Index("ix_disclosures_student_type", "student_id", "type"),)


class Market(Base):
    __tablename__ = "markets"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id"))
    question: Mapped[str]
    metric: Mapped[str] = mapped_column(default="GPA")
    term: Mapped[str]
    threshold: Mapped[float] = mapped_column(Float)
    deadline: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(default="DRAFT")
    outcome: Mapped[Optional[str]] = mapped_column(nullable=True)
    resolved_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    minted_pairs: Mapped[int] = mapped_column(default=0)
    collateral_cents: Mapped[int] = mapped_column(default=0)
    last_price_cents: Mapped[Optional[int]] = mapped_column(nullable=True)
    volume: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    total_supply: Mapped[int] = mapped_column(default=0)
    initial_scholarship_cents: Mapped[int] = mapped_column(default=0)
    final_price_cents: Mapped[Optional[int]] = mapped_column(nullable=True)
    # Value of one YES share if the goal is met; also the price ceiling. Legacy markets: $1.
    share_value_cents: Mapped[int] = mapped_column(default=100)
    # Fixed goal probability for the scholarship formula (basis points); None = legacy formula.
    probability_bp: Mapped[Optional[int]] = mapped_column(nullable=True)


class Order(Base):
    __tablename__ = "orders"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    market_id: Mapped[str] = mapped_column(ForeignKey("markets.id"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    contract: Mapped[str]  # YES | NO  (original intent, never rewritten)
    action: Mapped[str]  # BUY | SELL
    order_type: Mapped[str]  # LIMIT | MARKET
    price_cents: Mapped[int]  # in the order's own contract terms
    book_side: Mapped[str]  # BID | ASK on the normalized YES book
    yes_price_cents: Mapped[int]
    quantity: Mapped[int]
    remaining: Mapped[int]
    status: Mapped[str]  # OPEN | PARTIAL | FILLED | CANCELLED
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    __table_args__ = (
        Index("ix_orders_book", "market_id", "book_side", "status", "yes_price_cents", "created_at"),
    )


class Trade(Base):
    __tablename__ = "trades"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    market_id: Mapped[str] = mapped_column(ForeignKey("markets.id"), index=True)
    maker_order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"))
    taker_order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"))
    trade_type: Mapped[str]  # MINT | TRANSFER_YES | TRANSFER_NO | BURN
    taker_side: Mapped[str]  # BID | ASK
    yes_price_cents: Mapped[int]
    quantity: Mapped[int]
    executed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Position(Base):
    __tablename__ = "positions"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    market_id: Mapped[str] = mapped_column(ForeignKey("markets.id"), primary_key=True)
    contract: Mapped[str] = mapped_column(primary_key=True)
    quantity: Mapped[int] = mapped_column(default=0)
    reserved_qty: Mapped[int] = mapped_column(default=0)
    cost_basis_cents: Mapped[int] = mapped_column(default=0)


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    transaction_id: Mapped[str] = mapped_column(index=True)
    account: Mapped[str] = mapped_column(index=True)
    amount_cents: Mapped[int]
    entry_type: Mapped[str]
    ref_trade_id: Mapped[Optional[int]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Scholarship(Base):
    __tablename__ = "scholarships"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    market_id: Mapped[str] = mapped_column(ForeignKey("markets.id"), unique=True)
    locked_probability_bp: Mapped[int]  # basis points, 3000 = 30%
    promised_cents: Mapped[int]
    status: Mapped[str]  # LOCKED | PAID | VOID
    locked_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class Settlement(Base):
    __tablename__ = "settlements"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    market_id: Mapped[str] = mapped_column(ForeignKey("markets.id"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    contract: Mapped[str]
    quantity: Mapped[int]
    payout_cents: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    __table_args__ = (UniqueConstraint("market_id", "user_id", "contract"),)


class VerificationRequest(Base):
    __tablename__ = "verification_requests"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id"), index=True)
    type: Mapped[str]  # UNIVERSITY | MAJOR | COURSE_LOAD | FINAL_GPA
    payload: Mapped[dict] = mapped_column(JSON)
    evidence: Mapped[str]
    evidence_file: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(default="PENDING", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    reviewed_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)
    review_note: Mapped[str] = mapped_column(default="")


class AccountCredentials(Base):
    __tablename__ = "account_credentials"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    username: Mapped[str] = mapped_column(unique=True)
    password_hash: Mapped[str] = mapped_column(default="")


class Favorite(Base):
    __tablename__ = "favorites"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    market_id: Mapped[str] = mapped_column(ForeignKey("markets.id"), primary_key=True)
