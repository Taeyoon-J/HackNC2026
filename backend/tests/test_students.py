"""Student self-service and admin student management."""
from conftest import M1, as_user, assert_invariants, order


def test_activated_profile_academic_fields_remain_readonly(client):
    from test_registration import registration
    student = client.post("/api/students", json=registration()).json()
    admin = as_user(client, "ADMIN")
    admin("POST", f"/api/admin/students/{student['id']}/verify")
    me = as_user(client, student["user_id"])
    assert me("PUT", "/api/me/student", json={"university": "UNC Chapel Hill", "year": "Junior", "major": "Computer Science"}).status_code == 400
    assert me("GET", "/api/me/student").json()["year"] == "Sophomore"
    assert me("PUT", "/api/me/student/disclosures/GPA_HISTORY", json={"data": {"terms": []}}).status_code == 403
    assert me("POST", "/api/me/goals", json={"threshold": 3.7, "term": "Spring 2027"}).status_code == 403


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


def test_record_edits_go_to_admin_queue(client):
    me, admin = as_user(client, "STUDENT_A"), as_user(client, "ADMIN")
    me("PUT", "/api/me/student/disclosures/ACTIVITY", json={"data": {"items": ["Robotics club"]}})
    me("PUT", "/api/me/student/disclosures/ACTIVITY", json={"data": {"items": ["Robotics club", "Tutor"]}})
    pending = [r for r in me("GET", "/api/me/verifications").json() if r["type"] == "ACTIVITY"]
    assert len(pending) == 1 and pending[0]["payload"]["data"]["items"] == ["Robotics club", "Tutor"]

    queue = admin("GET", "/api/admin/verifications?status=PENDING&type=ACTIVITY").json()["items"]
    assert pending[0]["id"] in {r["id"] for r in queue}
    profile = client.get("/api/students/STU001").json()
    assert all("Tutor" not in str(d["data"]) for d in profile["disclosures"])

    admin("POST", f"/api/admin/verifications/{pending[0]['id']}/approve", json={})
    activity = next(d for d in client.get("/api/students/STU001").json()["disclosures"] if d["type"] == "ACTIVITY")
    assert activity["data"]["items"] == ["Robotics club", "Tutor"]
