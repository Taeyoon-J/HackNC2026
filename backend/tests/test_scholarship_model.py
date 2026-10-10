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
        history = priced.get(f"/api/markets/{sid}-GPA-2026F/history").json()
        assert history[0]["price"] == round(s / 100 * p)  # opens at S/100 × p on Aug 1
        assert len(history) > 200
        book = priced.get(f"/api/markets/{sid}-GPA-2026F/orderbook").json()
        assert sum(l["orders"] for l in book["bids"]) >= 8 and sum(l["orders"] for l in book["asks"]) >= 8
    assert_invariants(priced)


def test_price_bounds_follow_share_value(priced):
    m = priced.get(f"/api/markets/{M1}").json()
    too_high = order(priced, "TRADER_A", "YES", "BUY", m["share_value_cents"], 1)
    assert too_high.status_code == 400 and "Price must be between" in too_high.json()["detail"]
    # The ceiling itself is a legal price (it may still be refused for other reasons, e.g. self-trade).
    at_ceiling = order(priced, "TRADER_A", "YES", "BUY", m["share_value_cents"] - 1, 1)
    assert "Price must be between" not in at_ceiling.json().get("detail", "")


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


def test_admin_liquidity_run_reports_and_lists_quotes(priced):
    admin = as_user(priced, "ADMIN")
    assert as_user(priced, "TRADER_A")("POST", "/api/admin/liquidity/run", json={}).status_code == 403
    report = admin("POST", "/api/admin/liquidity/run", json={"market_id": "STU002-GPA-2026F"}).json()["quoted"]
    assert len(report) == 1 and report[0]["student"]["name"] == "Student B"
    row = report[0]
    if row["ask_qty"]:
        assert row["ask_cents"] >= row["current_cents"] + row["tick_cents"] + row["adjustment_cents"]
    # Running again replaces, rather than stacks, the market maker's quotes.
    admin("POST", "/api/admin/liquidity/run", json={"market_id": "STU002-GPA-2026F"})
    resting = admin("GET", "/api/admin/liquidity?market_id=STU002-GPA-2026F").json()
    assert len(resting) == 1 and resting[0]["market_id"] == "STU002-GPA-2026F"
    assert_invariants(priced)


def test_live_simulation_trades_without_nessie(priced):
    import time
    admin = as_user(priced, "ADMIN")
    assert admin("POST", "/api/admin/simulation/start", json={"minutes": 1, "nessie": False}).status_code == 200
    assert admin("POST", "/api/admin/simulation/start", json={"minutes": 1, "nessie": False}).status_code == 400
    time.sleep(6)
    status = admin("POST", "/api/admin/simulation/stop").json()
    assert not status["running"] and len(status["markets"]) == 5
    assert all(e["nessie"] == "off" for e in status["events"])
    assert_invariants(priced)
