"""Small additive migrations for the local demo SQLite database."""
from sqlalchemy import inspect, text
from .db import Base, engine


def ensure_schema():
    Base.metadata.create_all(engine)
    columns = {c["name"] for c in inspect(engine).get_columns("markets")}
    additions = {"total_supply": "INTEGER NOT NULL DEFAULT 0",
                 "initial_scholarship_cents": "INTEGER NOT NULL DEFAULT 0", "final_price_cents": "INTEGER"}
    with engine.begin() as conn:
        for name, definition in additions.items():
            if name not in columns:
                conn.execute(text(f"ALTER TABLE markets ADD COLUMN {name} {definition}"))
    from .models import Disclosure
    for index in Disclosure.__table__.indexes:
        index.create(engine, checkfirst=True)
