"""Student self-service and admin student management."""
from conftest import M1, as_user, assert_invariants, order


def test_signup_profile_goal_and_admin_open(client):
    r = client.post("/api/students", json={"university": "UNC Charlotte", "year": "Freshman", "major": "History"})
    me = as_user(client, r.json()["user_id"])
    assert r.json()["name"] == "Student G"  # A–E seeded, F is the pending newcomer

    p = me("PUT", "/api/me/student", json={"university": "UNC Charlotte", "year": "Sophomore", "major": "History"}).json()
    assert p["year"] == "Sophomore"

    p = me("PUT", "/api/me/student/disclosures/GPA_HISTORY",
           json={"data": {"terms": [{"term": "Fall 2025", "gpa": 3.5, "credits": 15}]}}).json()
    assert p["disclosures"][0]["verified_at"] is None
    # Unverified records are hidden from the public profile.
    assert client.get(f"/api/students/{p['id']}").json()["disclosures"] == []

    p = me("POST", "/api/me/goals", json={"threshold": 3.7, "term": "Fall 2026"}).json()
    market_id = p["markets"][0]["id"]
    assert p["markets"][0]["status"] == "DRAFT"
    assert me("POST", "/api/me/goals", json={"threshold": 3.5, "term": "Spring 2027"}).status_code == 400
    assert market_id not in {m["id"] for m in client.get("/api/markets").json()}

    admin = as_user(client, "ADMIN")
    assert admin("POST", f"/api/admin/markets/{market_id}/open").status_code == 400  # not verified yet
    admin("POST", f"/api/admin/students/{p['id']}/verify")
    assert admin("POST", f"/api/admin/markets/{market_id}/open").json()["status"] == "PRICE_DISCOVERY"
    assert market_id in {m["id"] for m in client.get("/api/markets").json()}
    assert len(client.get(f"/api/students/{p['id']}").json()["disclosures"]) == 1


def test_delist_hides_market_and_releases_orders(client):
    admin = as_user(client, "ADMIN")
    order(client, "TRADER_A", "YES", "BUY", 60, 100)
    r = admin("POST", "/api/admin/students/STU001/delist").json()
    assert r["status"] == "DELISTED" and r["cancelled_orders"] >= 1
    assert M1 not in {m["id"] for m in client.get("/api/markets").json()}
    assert as_user(client, "TRADER_A")("GET", "/api/portfolio").json()["reserved_cents"] == 0
    assert order(client, "TRADER_A", "YES", "BUY", 60, 10).status_code == 400
    assert_invariants(client)

    admin("POST", "/api/admin/students/STU001/restore")
    assert M1 in {m["id"] for m in client.get("/api/markets").json()}
    assert order(client, "TRADER_A", "YES", "BUY", 60, 10).status_code == 200


def test_admin_student_endpoints_require_admin(client):
    assert as_user(client, "TRADER_A")("POST", "/api/admin/students/STU001/delist").status_code == 403
    rows = as_user(client, "ADMIN")("GET", "/api/admin/students").json()
    newcomer = next(r for r in rows if r["name"] == "Student F")
    assert not newcomer["verified"] and newcomer["pending_disclosures"] == 2
