import base64
import pytest
from sqlalchemy import select
from app.db import SessionLocal
from app.models import AccountCredentials, Disclosure, Market, Position, VerificationRequest
from app.services.fixed_market_service import upgrade_demo
from conftest import M1, as_user, assert_invariants, order


@pytest.fixture
def fixed(client):
    with SessionLocal() as db:
        upgrade_demo(db, seed_holdings=False)
    return client


def submit(me, dtype, payload, evidence="Synthetic registrar supporting record"):
    result = me("POST", "/api/me/verifications", json={"type": dtype, "payload": payload, "evidence": evidence})
    assert result.status_code == 200, result.text
    return result.json()


def test_readonly_profile_and_approval_queue(fixed):
    me, admin = as_user(fixed, "STUDENT_A"), as_user(fixed, "ADMIN")
    profile = me("GET", "/api/me/student").json()
    for field in ("year", "university", "major"):
        fields = {key: profile[key] for key in ("year", "university", "major")}
        fields[field] = "Changed"
        assert me("PUT", "/api/me/student", json=fields).status_code == 400
    for dtype in ("GPA_HISTORY", "COURSE_LOAD"):
        assert me("PUT", f"/api/me/student/disclosures/{dtype}", json={"data": {}}).status_code == 403
    req = submit(me, "UNIVERSITY", {"value": "Stanford University"})
    assert me("GET", "/api/me/student").json()["university"] == profile["university"]
    assert me("POST", "/api/me/verifications", json={"type": "UNIVERSITY", "payload": {"value": "Duke University"}, "evidence": "Proof"}).status_code == 400
    assert admin("GET", "/api/admin/verifications?q=Stanford&type=UNIVERSITY").json()["total"] == 1
    assert admin("GET", "/api/admin/verifications?q=StudentA").json()["total"] == 1
    assert as_user(fixed, "TRADER_A")("POST", f"/api/admin/verifications/{req['id']}/approve", json={}).status_code == 403
    assert admin("POST", f"/api/admin/verifications/{req['id']}/approve", json={}).status_code == 200
    assert me("GET", "/api/me/student").json()["university"] == "Stanford University"
    assert fixed.get("/api/students/STU001").json()["university"] == "Stanford University"
    assert admin("POST", f"/api/admin/verifications/{req['id']}/approve", json={}).status_code == 400
    req = submit(me, "MAJOR", {"value": "Statistics"})
    assert admin("POST", f"/api/admin/verifications/{req['id']}/reject", json={}).status_code == 400
    assert admin("POST", f"/api/admin/verifications/{req['id']}/reject", json={"note": "Missing advisor approval"}).status_code == 200
    assert me("GET", "/api/me/student").json()["major"] == profile["major"]
    own = me("PUT", "/api/me/student", json={"university": "Stanford University", "year": profile["year"], "major": profile["major"], "introduction": "My new introduction", "pitch": "My plan"})
    assert own.status_code == 200 and fixed.get("/api/students/STU001").json()["introduction"] != "My new introduction"
    bio = next(r for r in me("GET", "/api/me/verifications").json() if r["type"] == "BIOGRAPHY" and r["status"] == "PENDING")
    admin("POST", f"/api/admin/verifications/{bio['id']}/approve", json={})
    assert fixed.get("/api/students/STU001").json()["introduction"] == "My new introduction"
    assert_invariants(fixed)


def test_fixed_supply_only_yes_and_pending_capacity(fixed):
    assert order(fixed, "TRADER_A", "NO", "BUY", 40, 1).status_code == 400
    assert order(fixed, "TRADER_A", "YES", "BUY", 99, 150).status_code == 400
    assert order(fixed, "TRADER_A", "YES", "SELL", 50, 1).status_code == 400
    buy = order(fixed, "TRADER_A", "YES", "BUY", 99, 10).json()
    assert buy["filled_quantity"] == 10 and {t["trade_type"] for t in buy["trades"]} == {"TRANSFER_YES"}
    pending = order(fixed, "TRADER_A", "YES", "BUY", 5, 90).json()
    assert pending["order"]["status"] == "OPEN"
    assert order(fixed, "TRADER_A", "YES", "BUY", 5, 1).status_code == 400
    as_user(fixed, "TRADER_A")("DELETE", f"/api/orders/{pending['order']['id']}")
    assert order(fixed, "TRADER_A", "YES", "BUY", 5, 1).status_code == 200
    with SessionLocal() as db:
        assert sum(db.scalars(select(Position.quantity).where(Position.market_id == M1, Position.contract == "YES")).all()) == 100
    assert_invariants(fixed)


@pytest.mark.parametrize("grade, outcome, sign", [(3.95, "YES", 1), (3.0, "NO", -1)])
def test_final_gpa_atomic_settlement_both_scholarships(fixed, grade, outcome, sign):
    me, admin = as_user(fixed, "STUDENT_A"), as_user(fixed, "ADMIN")
    order(fixed, "TRADER_A", "YES", "BUY", 99, 12)
    order(fixed, "TRADER_A", "YES", "BUY", 5, 3)
    profile = me("GET", "/api/me/student").json()
    market = next(m for m in profile["markets"] if m["id"] == M1)
    load = next(d for d in profile["disclosures"] if d["type"] == "COURSE_LOAD")["data"]["courses"]
    grades = [{**c, "gpa": grade} for c in load]
    req = submit(me, "FINAL_GPA", {"market_id": M1, "courses": grades})
    assert fixed.get(f"/api/markets/{M1}").json()["status"] == "TRADING"
    cash_before = as_user(fixed, "TRADER_A")("GET", "/api/portfolio").json()["available_cents"]
    assert admin("POST", f"/api/admin/markets/{M1}/lock", json={"probability": .5}).status_code == 400
    assert admin("POST", f"/api/admin/markets/{M1}/resolve", json={"value": grade}).status_code == 400
    result = admin("POST", f"/api/admin/verifications/{req['id']}/approve", json={})
    assert result.status_code == 200, result.text
    settled = fixed.get(f"/api/markets/{M1}").json()
    amount = market["initial_scholarship_cents"] + sign * settled["final_price"] * 100
    assert settled["status"] == "SETTLED" and settled["outcome"] == outcome
    assert settled["collateral_cents"] == 0
    after = me("GET", "/api/me/student").json()
    assert after["wallet_cents"] == amount
    assert settled["scholarship"]["promised_cents"] == amount and settled["scholarship"]["status"] == "PAID"
    history = next(d for d in after["disclosures"] if d["type"] == "GPA_HISTORY")["data"]["terms"]
    assert history[-1]["term"] == "Fall 2026" and history[-1]["gpa"] == grade
    trader = as_user(fixed, "TRADER_A")("GET", "/api/portfolio").json()
    assert trader["reserved_cents"] == 0 and not trader["open_orders"]
    assert trader["available_cents"] == cash_before + 15 + (1200 if outcome == "YES" else 0)
    assert not any(p["market_id"] == M1 for p in trader["positions"])
    assert order(fixed, "TRADER_A", "YES", "BUY", 50, 1).status_code == 400
    assert admin("POST", f"/api/admin/verifications/{req['id']}/approve", json={}).status_code == 400
    assert me("GET", "/api/me/student").json()["wallet_cents"] == amount
    assert_invariants(fixed)


def test_evidence_validation_course_change_and_rollback(fixed):
    me, admin = as_user(fixed, "STUDENT_A"), as_user(fixed, "ADMIN")
    # Evidence is optional: a request with neither text nor a file still reaches the admin queue.
    bare = me("POST", "/api/me/verifications", json={"type": "MAJOR", "payload": {"value": "Statistics"}})
    assert bare.status_code == 200
    queue = admin("GET", "/api/admin/verifications?status=PENDING").json()["items"]
    assert bare.json()["id"] in {r["id"] for r in queue}
    admin("POST", f"/api/admin/verifications/{bare.json()['id']}/reject", json={"note": "Test"})
    invalid = me("POST", "/api/me/verifications", json={"type": "MAJOR", "payload": {"value": "Statistics"}, "evidence": "Proof",
        "evidence_file": {"name": "payload.html", "content_type": "text/html", "data_base64": base64.b64encode(b"Hello").decode()}})
    assert invalid.status_code == 400
    profile = me("GET", "/api/me/student").json()
    load = next(d for d in profile["disclosures"] if d["type"] == "COURSE_LOAD")["data"]["courses"]
    final = submit(me, "FINAL_GPA", {"market_id": M1, "courses": [{**c, "gpa": 3.9} for c in load]})
    changed = submit(me, "COURSE_LOAD", {"term": "Fall 2026", "courses": [{"code": "NEW 101", "name": "New Course", "credits": 3}]})
    admin("POST", f"/api/admin/verifications/{changed['id']}/approve", json={})
    assert admin("POST", f"/api/admin/verifications/{final['id']}/approve", json={}).status_code == 400
    assert fixed.get(f"/api/markets/{M1}").json()["status"] == "TRADING"
    assert admin("GET", f"/api/admin/verifications/{final['id']}").json()["status"] == "PENDING"
    assert me("GET", "/api/me/student").json()["wallet_cents"] == 0
    assert_invariants(fixed)


def test_historic_semesters_and_goal_term_are_protected(fixed):
    me, admin = as_user(fixed, "STUDENT_A"), as_user(fixed, "ADMIN")
    profile = me("GET", "/api/me/student").json()
    records = {d["type"]: d["data"] for d in profile["disclosures"]}
    current = records["COURSE_LOAD"]["courses"]
    past = records["GPA_HISTORY"]["terms"][0]["term"]
    assert me("POST", "/api/me/verifications", json={"type": "COURSE_LOAD", "payload": {"term": past, "courses": current}, "evidence": "Proof"}).status_code == 400
    changed = submit(me, "COURSE_LOAD", {"term": "Spring 2027", "courses": current})
    assert admin("POST", f"/api/admin/verifications/{changed['id']}/approve", json={}).status_code == 200
    assert me("POST", "/api/me/verifications", json={"type": "FINAL_GPA", "payload": {"market_id": M1, "courses": [{**c, "gpa": 4} for c in current]}, "evidence": "Proof"}).status_code == 400
    assert fixed.get(f"/api/markets/{M1}").json()["status"] == "TRADING"
    assert_invariants(fixed)


def test_name_search_favorites_and_account_credentials(fixed):
    trader = as_user(fixed, "TRADER_A")
    for name in ("Student A", "StudentA", "student a"):
        result = trader("GET", f"/api/markets?paged=true&q={name}").json()
        assert result["total"] == 1 and result["items"][0]["student"]["name"] == "Student A"
    assert trader("PUT", f"/api/favorites/{M1}").status_code == 200
    assert trader("PUT", f"/api/favorites/{M1}").status_code == 200
    assert trader("GET", "/api/markets?paged=true&favorites=true").json()["total"] == 1
    assert as_user(fixed, "TRADER_B")("GET", "/api/markets?paged=true&favorites=true").json()["total"] == 0
    assert trader("DELETE", f"/api/favorites/{M1}").status_code == 200
    assert trader("GET", "/api/favorites").json() == []
    me = as_user(fixed, "STUDENT_A")
    assert me("PUT", "/api/account", json={"username": "student_a_new", "password": "LongDemoPassword1"}).status_code == 200
    with SessionLocal() as db:
        assert db.get(AccountCredentials, "STUDENT_A").password_hash != "LongDemoPassword1"
    assert fixed.post("/api/account/login", json={"username": "student_a_new", "password": "wrong"}).status_code == 401
    assert fixed.post("/api/account/login", json={"username": "student_a_new", "password": "LongDemoPassword1"}).json()["user_id"] == "STUDENT_A"
    assert me("PUT", "/api/account", json={"username": "student_a_new", "password": "AnotherPassword2"}).status_code == 403
    assert me("PUT", "/api/account", json={"username": "student_a_new", "password": "AnotherPassword2", "current_password": "LongDemoPassword1"}).status_code == 200
