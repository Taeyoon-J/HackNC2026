from conftest import as_user, assert_invariants


def registration(**changes):
    return {"username": "new.student", "password": "academic123", "university": "UNC Chapel Hill",
            "year": "Sophomore", "major": "Computer Science",
            "academic_history": {"terms": [{"term": "Spring 2026", "courses": [
                {"code": "COMP 110", "name": "Programming", "credits": 3, "gpa": 3.6}]}]},
            "current_course_load": {"term": "Fall 2026", "courses": [
                {"code": "COMP 210", "name": "Data structures", "credits": 3}]}, **changes}


def test_registration_activation_and_admin_goal(client):
    result = client.post("/api/students", json=registration())
    assert result.status_code == 200, result.text
    student = result.json()
    assert student["name"] == "new.student"
    assert student["status"] == "PENDING_VERIFICATION" and not student["verified"]
    assert "Requires verification" in student["message"]
    credentials = {"username": "new.student", "password": "academic123"}
    assert client.post("/api/account/login", json=credentials).status_code == 403
    me, admin = as_user(client, student["user_id"]), as_user(client, "ADMIN")
    assert me("GET", "/api/me/student").status_code == 403
    request = admin("GET", "/api/admin/verifications?type=REGISTRATION").json()["items"][0]
    assert request["payload"]["academic_history"]["terms"][0]["gpa"] == 3.6
    assert request["payload"]["current_course_load"]["courses"][0]["code"] == "COMP 210"
    assert admin("POST", f"/api/admin/students/{student['id']}/restore").status_code == 400
    assert as_user(client, "TRADER_A")("POST", f"/api/admin/verifications/{request['id']}/approve", json={}).status_code == 403
    assert admin("POST", f"/api/admin/verifications/{request['id']}/approve", json={}).status_code == 200
    assert client.post("/api/account/login", json=credentials).status_code == 200
    profile = me("GET", "/api/me/student").json()
    assert profile["verified"] and profile["status"] == "ACTIVE"
    goal = profile["markets"][0]
    assert goal["status"] == "TRADING" and 2 <= goal["threshold"] <= 4
    assert 20 <= goal["last_price"] <= 80
    assert goal["total_supply"] == 100
    assert me("POST", "/api/me/goals", json={"threshold": 4, "term": "Spring 2027"}).status_code == 403
    assert admin("POST", f"/api/admin/verifications/{request['id']}/approve", json={}).status_code == 400
    assert me("GET", "/api/me/student").json()["markets"] == profile["markets"]
    assert_invariants(client)


def test_registration_required_fields_and_duplicates(client):
    for key in ("username", "password", "university", "year", "major", "academic_history", "current_course_load"):
        data = registration()
        del data[key]
        assert client.post("/api/students", json=data).status_code == 422
    for changes in ({"university": "  "}, {"password": "short"}, {"academic_history": {"terms": []}},
                    {"current_course_load": {"term": "Fall 2026", "courses": []}},
                    {"academic_history": {"terms": [{"term": "Spring 2026", "courses": [
                        {"code": "COMP 110", "name": "Programming", "credits": 3, "gpa": 4.1}]}]}}):
        assert client.post("/api/students", json=registration(**changes)).status_code >= 400
    assert client.post("/api/students", json=registration()).status_code == 200
    assert client.post("/api/students", json=registration(username="NEW.STUDENT")).status_code == 400


def test_freshman_rejected_registration_stays_inactive(client):
    student = client.post("/api/students", json=registration(year="Freshman", academic_history={"terms": []})).json()
    admin = as_user(client, "ADMIN")
    request = admin("GET", "/api/admin/verifications?type=REGISTRATION").json()["items"][0]
    assert admin("POST", f"/api/admin/verifications/{request['id']}/reject", json={"note": "Transcript needed"}).status_code == 200
    assert client.post("/api/account/login", json={"username": "new.student", "password": "academic123"}).status_code == 403
    assert admin("POST", f"/api/admin/students/{student['id']}/verify").status_code == 400


def test_profile_verify_also_activates_registration(client):
    student = client.post("/api/students", json=registration()).json()
    admin = as_user(client, "ADMIN")
    assert admin("POST", f"/api/admin/students/{student['id']}/verify").status_code == 200
    assert admin("GET", "/api/admin/verifications?type=REGISTRATION&status=APPROVED").json()["total"] == 1
    assert as_user(client, student["user_id"])("GET", "/api/me/student").json()["markets"][0]["status"] == "TRADING"
