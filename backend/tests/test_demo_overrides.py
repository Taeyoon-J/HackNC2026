from sqlalchemy import func, select

from app.db import SessionLocal, utcnow
from app.demo_data import populate_cohort
from app.demo_overrides import PRESETS, apply_presets
from app.models import Position, Trade, Wallet
from app.services.fixed_market_service import upgrade_demo
from app.services.student_service import cumulative_gpa
from conftest import as_user, assert_invariants


def test_requested_values_in_directory_details_profiles_and_history(client):
    with SessionLocal() as db:
        populate_cohort(db, utcnow())
        upgrade_demo(db)
        holdings = {(p.market_id, p.quantity, p.cost_basis_cents) for p in db.scalars(select(Position).where(Position.user_id == "TRADER_A", Position.quantity > 0)).all()}
        cash = db.get(Wallet, "TRADER_A").available_cents
        apply_presets(db)
        assert {(p.market_id, p.quantity, p.cost_basis_cents) for p in db.scalars(select(Position).where(Position.user_id == "TRADER_A", Position.quantity > 0)).all()} == holdings
        assert db.get(Wallet, "TRADER_A").available_cents == cash
        trades = db.scalar(select(func.count(Trade.id)))
        apply_presets(db)
        assert db.scalar(select(func.count(Trade.id))) == trades

    trader, admin = as_user(client, "TRADER_A"), as_user(client, "ADMIN")
    assert trader("GET", "/api/markets?paged=true").json()["total"] == 50
    for sid, expected in PRESETS.items():
        name = f"Student {chr(64 + int(sid[3:]))}"
        found = trader("GET", f"/api/markets?paged=true&q={name}").json()
        assert found["total"] == 1
        m = found["items"][0]
        detail = trader("GET", f"/api/markets/{m['id']}").json()
        assert m["threshold"] == detail["threshold"] == expected["goal"]
        assert name in detail["question"] and str(expected["goal"]) in detail["question"]
        assert m["last_price"] == detail["last_price"] == expected["probability"]
        assert m["student"]["cumulative_gpa"] == expected["cumulative"]
        public = trader("GET", f"/api/students/{sid}").json()
        assert public["cumulative_gpa"] == admin("GET", f"/api/admin/students/{sid}").json()["cumulative_gpa"] == expected["cumulative"]
        history = next(d["data"] for d in public["disclosures"] if d["type"] == "GPA_HISTORY")
        assert cumulative_gpa(history) == expected["cumulative"]
        if expected["cumulative"] is None:
            assert history["terms"] == []
        for term in history["terms"]:
            assert term["gpa"] == round(sum(c["gpa"] * c["credits"] for c in term["courses"]) / term["credits"], 2)
        chart = trader("GET", f"/api/markets/{m['id']}/history").json()
        assert chart[-1]["price"] == expected["probability"]
        assert detail["best_bid"] == expected["probability"] - 2
        assert detail["best_ask"] == expected["probability"] + 1
    assert_invariants(client)
