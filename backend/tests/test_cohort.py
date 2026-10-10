from collections import Counter

from sqlalchemy import func, select

from app.db import SessionLocal, utcnow
from app.demo_data import COHORT_SIZE, UNC, UNC_COUNT, UNIVERSITIES, cohort_profiles, populate_cohort, resize_cohort, university_counts
from app.models import Student
from app.seed import TRADER_CREDITS
from conftest import as_user, assert_invariants


def test_cohort_distribution_and_transcripts():
    profiles = list(cohort_profiles())
    counts = Counter(p[1] for p in profiles)
    assert len(profiles) == COHORT_SIZE == 50
    assert len(UNIVERSITIES) == len(set(UNIVERSITIES)) == len(counts) == 10
    assert {UNC, "Duke University", "NC State University"} <= set(counts)
    assert counts[UNC] == UNC_COUNT == 8
    assert sum(n for u, n in counts.items() if u != UNC) == 42
    assert dict(counts) == university_counts()
    assert len({p[3] for p in profiles}) == 20
    assert profiles == list(cohort_profiles())
    # The discrete Gaussian is concentrated around the middle of the list.
    assert counts[UNIVERSITIES[4]] > counts[UNIVERSITIES[0]]
    for _, _, year, _, records in profiles:
        assert records["BIOGRAPHY"]["introduction"] and records["BIOGRAPHY"]["pitch"]
        assert records["APPLICATION"]["items"] and records["ACTIVITY"]["items"]
        assert len(records["COURSE_LOAD"]["courses"]) == 5
        terms = records["GPA_HISTORY"]["terms"]
        assert len(terms) == {"Freshman": 0, "Sophomore": 2, "Junior": 4, "Senior": 6}[year]
        for term in terms:
            assert len(term["courses"]) == 5
            assert term["credits"] == sum(c["credits"] for c in term["courses"])
            assert term["gpa"] == round(sum(c["gpa"] * c["credits"] for c in term["courses"]) / term["credits"], 2)
            assert all(0 <= c["gpa"] <= 4 for c in term["courses"])


def test_full_cohort_search_and_role_visibility(client):
    with SessionLocal() as db:
        populate_cohort(db, utcnow())
        assert db.scalar(select(func.count(Student.id))) == 50
    admin = as_user(client, "ADMIN")
    result = admin("GET", "/api/admin/students?paged=true&university=UNC%20Chapel%20Hill").json()
    assert result["total"] == 8 and result["total_all"] == 50
    assert len(result["items"]) == 8
    assert len(result["universities"]) == 10 and len(result["majors"]) == 20
    page1 = admin("GET", "/api/admin/students?paged=true").json()
    page2 = admin("GET", "/api/admin/students?paged=true&page=2").json()
    assert len(page1["items"]) == len(page2["items"]) == 24
    assert not {s["id"] for s in page1["items"]} & {s["id"] for s in page2["items"]}
    assert admin("GET", "/api/admin/students?paged=true&q=STU050").json()["total"] == 1
    assert admin("GET", "/api/admin/students?paged=true&q=NO_SUCH_STUDENT").json()["total"] == 0
    assert admin("GET", "/api/admin/students?paged=true&state=REVIEW").json()["total"] == 1
    assert client.get("/api/markets?paged=true").json()["total_all"] == 49
    assert admin("GET", "/api/admin/markets?paged=true").json()["total_all"] == 50
    assert client.get("/api/markets?paged=true&page_size=1000").status_code == 422
    assert as_user(client, "TRADER_A")("GET", "/api/admin/students/STU001").status_code == 403

    me = as_user(client, "STUDENT_A")
    me("PUT", "/api/me/student", json={"university": UNC, "year": "Junior", "major": "Computer Science",
        "introduction": "A unique astronomy introduction", "pitch": "Supporting astronomy outreach"})
    # Profile edits wait in the admin queue and apply only on approval.
    assert client.get("/api/students/STU001").json()["introduction"] != "A unique astronomy introduction"
    bio = next(r for r in me("GET", "/api/me/verifications").json() if r["type"] == "BIOGRAPHY")
    assert bio["status"] == "PENDING" and bio["payload"]["data"]["pitch"] == "Supporting astronomy outreach"
    admin("POST", f"/api/admin/verifications/{bio['id']}/approve", json={})
    updated = me("GET", "/api/me/student").json()
    assert updated["introduction"] == "A unique astronomy introduction"
    assert client.get("/api/students/STU001").json()["pitch"] == updated["pitch"]
    assert admin("GET", "/api/admin/students/STU001").json()["introduction"] == updated["introduction"]
    assert client.get("/api/markets?paged=true&q=astronomy%20outreach").json()["total"] == 1

    transcript = {"terms": [{"term": "Spring 2026", "gpa": 4, "credits": 99, "courses": [
        {"code": "COMP 201", "name": "Hidden transcript specialword", "credits": 3, "gpa": 4},
        {"code": "MATH 201", "name": "Calculus", "credits": 1, "gpa": 2}]}]}
    assert me("PUT", "/api/me/student/disclosures/GPA_HISTORY", json={"data": transcript}).status_code == 403
    # Exercise the legacy transcript verifier with an internal fixture update;
    # students themselves must now use evidence-backed verification requests.
    from app.services.student_service import upsert_disclosure
    with SessionLocal() as db:
        upsert_disclosure(db, db.get(Student, "STU001"), "GPA_HISTORY", transcript)
    own = me("GET", "/api/me/student").json()
    term = next(d for d in own["disclosures"] if d["type"] == "GPA_HISTORY")["data"]["terms"][0]
    assert term["gpa"] == 3.5 and term["credits"] == 4
    assert not any(d["type"] == "GPA_HISTORY" for d in client.get("/api/students/STU001").json()["disclosures"])
    raw = admin("GET", "/api/admin/students/STU001").json()
    assert next(d for d in raw["disclosures"] if d["type"] == "GPA_HISTORY")["verified_at"] is None
    assert client.get("/api/markets?paged=true&q=specialword").json()["total"] == 0
    assert admin("GET", "/api/admin/markets?paged=true&q=specialword").json()["total"] == 1
    admin("POST", "/api/admin/students/STU001/verify")
    assert any(d["type"] == "GPA_HISTORY" for d in client.get("/api/students/STU001").json()["disclosures"])
    assert_invariants(client)


def test_resize_preserves_retained_records_and_releases_removed_market(client):
    from sqlalchemy import text
    from app.models import Favorite, LedgerEntry, Market, Position, User, VerificationRequest
    from app.services.fixed_market_service import upgrade_demo
    from conftest import order

    with SessionLocal() as db:
        populate_cohort(db, utcnow())
        upgrade_demo(db)
    admin = as_user(client, "ADMIN")
    me = as_user(client, "STUDENT_A")
    original = me("GET", "/api/me/student").json()
    trader_a = as_user(client, "TRADER_A")("GET", "/api/portfolio").json()
    from test_registration import registration
    extra = client.post("/api/students", json=registration(university="Wake Forest University", year="Junior", major="Economics")).json()
    admin("POST", f"/api/admin/students/{extra['id']}/verify")
    extra_me = as_user(client, extra["user_id"])
    goal = extra_me("GET", "/api/me/student").json()["markets"][0]
    assert goal["status"] == "TRADING"
    assert order(client, "TRADER_B", "YES", "BUY", None, 5, market=goal["id"], order_type="MARKET").status_code == 200
    assert order(client, "TRADER_B", "YES", "BUY", 5, 3, market=goal["id"]).status_code == 200
    as_user(client, "TRADER_B")("PUT", f"/api/favorites/{goal['id']}")
    extra_me("POST", "/api/me/verifications", json={"type": "MAJOR", "payload": {"value": "Statistics"}, "evidence": "Advisor record"})
    with SessionLocal() as db:
        assert resize_cohort(db, utcnow()) == 1
        assert db.scalar(select(func.count(Student.id))) == 50
        assert db.get(User, extra["user_id"]) is None and db.get(Market, goal["id"]) is None
        for model in (Favorite, Position):
            assert not db.scalars(select(model).where(model.market_id == goal["id"])).all()
        assert not db.scalars(select(VerificationRequest).where(VerificationRequest.student_id == extra["id"])).all()
        assert db.scalar(select(func.count(LedgerEntry.id)).where(LedgerEntry.entry_type == "COHORT_HOLDING_REDEMPTION")) == 2
        assert db.execute(text("PRAGMA foreign_key_check")).all() == []
        assert resize_cohort(db, utcnow()) == 0
    updated = me("GET", "/api/me/student").json()
    assert updated["disclosures"] == original["disclosures"]
    after_a = as_user(client, "TRADER_A")("GET", "/api/portfolio").json()
    assert after_a == trader_a
    after_b = as_user(client, "TRADER_B")("GET", "/api/portfolio").json()
    assert after_b["available_cents"] == TRADER_CREDITS and after_b["reserved_cents"] == 0
    assert after_b["positions"] == after_b["open_orders"] == []
    assert_invariants(client)
