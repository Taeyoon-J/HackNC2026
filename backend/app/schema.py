"""Small additive migrations for the local demo SQLite database."""
from sqlalchemy import inspect, text
from .db import Base, engine


def ensure_schema():
    Base.metadata.create_all(engine)
    columns = {c["name"] for c in inspect(engine).get_columns("markets")}
    additions = {"total_supply": "INTEGER NOT NULL DEFAULT 0",
                 "initial_scholarship_cents": "INTEGER NOT NULL DEFAULT 0", "final_price_cents": "INTEGER",
                 "initial_price_cents": "INTEGER",
                 "share_value_cents": "INTEGER NOT NULL DEFAULT 100", "probability_bp": "INTEGER",
                 "admin_reserve_shares": "INTEGER NOT NULL DEFAULT 0", "last_auto_quote_at": "DATETIME"}
    with engine.begin() as conn:
        for name, definition in additions.items():
            if name not in columns:
                conn.execute(text(f"ALTER TABLE markets ADD COLUMN {name} {definition}"))
        order_columns = {c["name"] for c in inspect(engine).get_columns("orders")}
        if "admin_backed" not in order_columns:
            conn.execute(text("ALTER TABLE orders ADD COLUMN admin_backed BOOLEAN NOT NULL DEFAULT 0"))
    from .models import Disclosure
    for index in Disclosure.__table__.indexes:
        index.create(engine, checkfirst=True)
    # Upgrade accounts created by the previous anonymous signup flow.
    from sqlalchemy import select
    from .db import SessionLocal
    from .models import AccountCredentials, Market, Student, Trade, User
    with SessionLocal() as db:
        # Existing demo databases were seeded with $5,000 per trader. Bring
        # their A/B/C starting budgets up to the new $25,000 without applying
        # the top-up more than once or disturbing trades already made.
        from sqlalchemy import func
        from .models import LedgerEntry, Wallet
        trader_budget = 25_000_00
        old_trader_budget = 5_000_00
        top_up = trader_budget - old_trader_budget
        for trader_id in ("TRADER_A", "TRADER_B", "TRADER_C"):
            marker_exists = db.scalar(select(LedgerEntry.id).where(
                LedgerEntry.account == f"user:{trader_id}",
                LedgerEntry.entry_type == "TRADER_BUDGET_X5_TOPUP").limit(1))
            seeded_amount = db.scalar(select(func.coalesce(func.sum(LedgerEntry.amount_cents), 0)).where(
                LedgerEntry.account == f"user:{trader_id}", LedgerEntry.entry_type == "FUNDING"))
            if not marker_exists and seeded_amount == old_trader_budget and db.get(Wallet, trader_id):
                from .services import ledger_service as ledger
                ledger.post(db, [(ledger.TREASURY, -top_up),
                                 (ledger.user_account(trader_id), top_up)],
                            "TRADER_BUDGET_X5_TOPUP")
        db.commit()

        rows = db.execute(select(User, AccountCredentials).join(AccountCredentials,
            AccountCredentials.user_id == User.id).where(User.role == "STUDENT",
            User.display_name.like("Student %"), AccountCredentials.password_hash != "")).all()
        for user, credentials in rows:
            user.display_name = credentials.username
            student = db.scalar(select(Student).where(Student.user_id == user.id))
            if student:
                for market in db.scalars(select(Market).where(Market.student_id == student.id)):
                    market.question = f"Will {user.display_name} earn a {market.term} GPA of {market.threshold} or higher?"
        for market in db.scalars(select(Market).where(Market.initial_price_cents.is_(None))):
            first_trade = db.scalar(select(Trade).where(Trade.market_id == market.id).order_by(Trade.executed_at, Trade.id).limit(1))
            market.initial_price_cents = first_trade.yes_price_cents if first_trade else market.last_price_cents
        if rows or db.new or db.dirty:
            db.commit()
        from .services.registration_service import repair_untouched_legacy_registrations
        repair_untouched_legacy_registrations(db)
        from .services.fixed_market_service import migrate_admin_reserves
        migrate_admin_reserves(db)
