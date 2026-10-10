from conftest import as_user, order, assert_invariants, M1


def test_admin_student_detail_contains_goals_and_holders(client):
    from app.db import SessionLocal
    from app.services.fixed_market_service import upgrade_demo
    with SessionLocal() as db:
        upgrade_demo(db, seed_holdings=False)
    assert order(client, "TRADER_A", "YES", "BUY", None, 5, order_type="MARKET").status_code == 200
    response = as_user(client, "ADMIN")("GET", "/api/admin/students/STU001")
    assert response.status_code == 200
    detail = response.json()
    market = next(m for m in detail["market_details"] if m["id"] == M1)
    assert market["threshold"] == 3.8 and market["last_price"] is not None
    assert detail["disclosures"] and market["total_supply"] == 100
    holder = next(h for h in detail["holders"] if h["user_id"] == "TRADER_A")
    assert holder["quantity"] == 5 and holder["cost_basis_cents"] > 0
    assert all(not h["user_id"].startswith("MM_") for h in detail["holders"])
    assert as_user(client, "TRADER_A")("GET", "/api/admin/students/STU001").status_code == 403
    assert "holders" not in client.get("/api/students/STU001").json()
    assert_invariants(client)


def test_username_appears_in_all_views_and_existing_signup_is_upgraded(client):
    from test_registration import registration
    from app.db import SessionLocal
    from app.models import User
    from app.schema import ensure_schema
    student = client.post("/api/students", json=registration(username="CampusCoder")).json()
    assert student["name"] == "CampusCoder"
    pending = as_user(client, "ADMIN")("GET", f"/api/admin/students/{student['id']}").json()
    assert pending["name"] == "CampusCoder" and pending["cumulative_gpa"] == 3.6
    assert pending["holders"] == pending["market_details"] == []
    as_user(client, "ADMIN")("POST", f"/api/admin/students/{student['id']}/verify")
    me = as_user(client, student["user_id"])
    assert me("GET", "/api/me/student").json()["name"] == "CampusCoder"
    goal = me("GET", "/api/me/student").json()["markets"][0]
    assert "CampusCoder" in goal["question"]
    assert client.get(f"/api/students/{student['id']}").json()["name"] == "CampusCoder"
    with SessionLocal() as db:
        db.get(User, student["user_id"]).display_name = "Student 51"
        db.commit()
    ensure_schema()
    upgraded = me("GET", "/api/me/student").json()
    assert upgraded["name"] == "campuscoder" and "campuscoder" in upgraded["markets"][0]["question"]
