"""Scholarship-priced shares for Students A–E."""
import pytest

from app.db import SessionLocal
from app.services import scholarship_model
from app.services.fixed_market_service import upgrade_demo
from conftest import M1, as_user, assert_invariants, order


@pytest.fixture
def priced(client):
    with SessionLocal() as db:
        upgrade_demo(db, seed_holdings=False)
        assert set(scholarship_model.apply(db)) >= {M1, "STU005-GPA-2026F"}
    return client


def test_initial_price_is_share_value_times_probability(priced):
    for sid, (goal, p) in scholarship_model.STUDENTS.items():
        m = priced.get(f"/api/markets/{sid}-GPA-2026F").json()
        s = m["initial_scholarship_cents"]
        assert 30_000_00 <= s <= 50_000_00 and m["total_supply"] == 100
        assert m["share_value_cents"] == s // 100 and m["probability"] == p and m["threshold"] == goal
        assert m["last_price"] == round(s / 100 * p)
    assert_invariants(priced)


def test_price_bounds_follow_share_value(priced):
    m = priced.get(f"/api/markets/{M1}").json()
    assert order(priced, "TRADER_A", "YES", "BUY", m["share_value_cents"], 1).status_code == 400
    assert order(priced, "TRADER_A", "YES", "BUY", m["share_value_cents"] - 1, 1).status_code == 200


def _settle(client, final_gpa):
    me, admin = as_user(client, "STUDENT_A"), as_user(client, "ADMIN")
    load = next(d for d in me("GET", "/api/me/student").json()["disclosures"] if d["type"] == "COURSE_LOAD")
    req = me("POST", "/api/me/verifications", json={"type": "FINAL_GPA", "payload": {
        "market_id": M1, "courses": [{**c, "gpa": final_gpa} for c in load["data"]["courses"]]}}).json()
    before = client.get(f"/api/markets/{M1}").json()
    held = next(p["quantity"] for p in as_user(client, "TRADER_A")("GET", "/api/portfolio").json()["positions"]
                if p["market_id"] == M1)
    cash = as_user(client, "TRADER_A")("GET", "/api/portfolio").json()["available_cents"]
    assert admin("POST", f"/api/admin/verifications/{req['id']}/approve", json={}).status_code == 200
    return before, held, cash


def test_goal_met_pays_bonus_scaled_by_probability(priced):
    before, held, cash = _settle(priced, 3.95)
    s, p, goal = before["initial_scholarship_cents"], before["probability"], before["threshold"]
    expected = round(s * ((3.95 - goal) / p + 1))
    assert as_user(priced, "STUDENT_A")("GET", "/api/me/student").json()["wallet_cents"] == expected
    trader = as_user(priced, "TRADER_A")("GET", "/api/portfolio").json()
    assert trader["available_cents"] - cash >= held * before["share_value_cents"]
    assert_invariants(priced)


def test_goal_missed_pays_final_price_times_shares(priced):
    before, _, _ = _settle(priced, 3.0)
    settled = priced.get(f"/api/markets/{M1}").json()
    assert settled["outcome"] == "NO" and settled["final_price"] == before["last_price"]
    expected = settled["final_price"] * 100
    assert as_user(priced, "STUDENT_A")("GET", "/api/me/student").json()["wallet_cents"] == expected
    assert_invariants(priced)
