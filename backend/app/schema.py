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
