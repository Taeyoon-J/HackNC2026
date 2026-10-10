from collections import Counter

from sqlalchemy import func, select

from app.db import SessionLocal, utcnow
from app.demo_data import UNC, UNIVERSITIES, cohort_profiles, populate_cohort, university_counts
from app.models import Student
from conftest import as_user, assert_invariants


def test_cohort_distribution_and_transcripts():
    profiles = list(cohort_profiles())
    counts = Counter(p[1] for p in profiles)
    assert len(profiles) == 1000
    assert len(UNIVERSITIES) == len(set(UNIVERSITIES)) == len(counts) == 100
    assert counts[UNC] == 150
    assert sum(n for u, n in counts.items() if u != UNC) == 850
    assert dict(counts) == university_counts()
    assert len({p[3] for p in profiles}) == 20
    assert profiles == list(cohort_profiles())
    # The discrete Gaussian is concentrated around the middle of the list.
    assert counts[UNIVERSITIES[49]] > counts[UNIVERSITIES[0]]
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
        assert db.scalar(select(func.count(Student.id))) == 1000
    admin = as_user(client, "ADMIN")
    result = admin("GET", "/api/admin/students?paged=true&university=UNC%20Chapel%20Hill").json()
    assert result["total"] == 150 and result["total_all"] == 1000
    assert len(result["items"]) == 24
    assert len(result["universities"]) == 100 and len(result["majors"]) == 20
    page2 = admin("GET", "/api/admin/students?paged=true&university=UNC%20Chapel%20Hill&page=2").json()
    assert not {s["id"] for s in result["items"]} & {s["id"] for s in page2["items"]}
    assert admin("GET", "/api/admin/students?paged=true&q=STU999").json()["total"] == 1
    assert admin("GET", "/api/admin/students?paged=true&q=NO_SUCH_STUDENT").json()["total"] == 0
    assert admin("GET", "/api/admin/students?paged=true&state=REVIEW").json()["total"] == 1
    assert client.get("/api/markets?paged=true").json()["total_all"] == 999
    assert admin("GET", "/api/admin/markets?paged=true").json()["total_all"] == 1000
    assert client.get("/api/markets?paged=true&page_size=1000").status_code == 422
    assert as_user(client, "TRADER_A")("GET", "/api/admin/students/STU001").status_code == 403

    me = as_user(client, "STUDENT_A")
    updated = me("PUT", "/api/me/student", json={"university": UNC, "year": "Junior", "major": "Computer Science",
        "introduction": "A unique astronomy introduction", "pitch": "Supporting astronomy outreach"}).json()
    assert updated["introduction"] == "A unique astronomy introduction"
    assert client.get("/api/students/STU001").json()["pitch"] == updated["pitch"]
    assert admin("GET", "/api/admin/students/STU001").json()["introduction"] == updated["introduction"]
    assert client.get("/api/markets?paged=true&q=astronomy%20outreach").json()["total"] == 1

    transcript = {"terms": [{"term": "Spring 2026", "gpa": 4, "credits": 99, "courses": [
        {"code": "COMP 201", "name": "Hidden transcript specialword", "credits": 3, "gpa": 4},
        {"code": "MATH 201", "name": "Calculus", "credits": 1, "gpa": 2}]}]}
    own = me("PUT", "/api/me/student/disclosures/GPA_HISTORY", json={"data": transcript}).json()
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
