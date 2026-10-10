"""Reproducible synthetic cohort; course names/codes are illustrative, not catalogs.

Ten demo campuses: UNC, Duke and NC State plus the seven highest-ranked
other institutions from the existing 2026 US News National Universities snapshot.
The selected demo campuses are not a claim that UNC and NC State rank in the top ten.
Sources: https://www.collegekickstart.com/blog/item/u-s-news-world-report-posts-2026-college-rankings
https://poetsandquants.com/2025/09/23/u-s-news-2026-best-business-schools-ranking-mit-joins-wharton-at-the-top/2/
"""
import math
import random
from datetime import datetime

from sqlalchemy import delete, or_, select, update

from .models import Disclosure, Market, Student, User, Wallet

UNC = "UNC Chapel Hill"
COHORT_SIZE = 50
UNC_COUNT = 8  # Closest whole-student allocation to the previous 15% UNC share.
UNIVERSITIES = """Princeton University
Massachusetts Institute of Technology
Harvard University
Stanford University
Yale University
University of Chicago
Duke University
Johns Hopkins University
UNC Chapel Hill
NC State University""".splitlines()

# The same field-specific courses recur at increasing levels across semesters.
MAJORS = {
    "Computer Science": ("COMP", ["Programming", "Data Structures", "Algorithms", "Operating Systems", "Databases", "Machine Learning"]),
    "Mechanical Engineering": ("MAE", ["Engineering Design", "Statics", "Dynamics", "Thermodynamics", "Fluid Mechanics", "Robotics"]),
    "Economics": ("ECON", ["Microeconomics", "Macroeconomics", "Econometrics", "Labor Economics", "Game Theory", "Public Finance"]),
    "Biology": ("BIO", ["Cell Biology", "Genetics", "Ecology", "Microbiology", "Physiology", "Molecular Biology"]),
    "Statistics": ("STOR", ["Probability", "Statistical Inference", "Regression", "Experimental Design", "Data Analysis", "Optimization"]),
    "Chemistry": ("CHEM", ["General Chemistry", "Organic Chemistry", "Analytical Chemistry", "Physical Chemistry", "Biochemistry", "Chemistry Lab"]),
    "Psychology": ("PSYC", ["Cognitive Psychology", "Social Psychology", "Developmental Psychology", "Research Methods", "Neuroscience", "Behavioral Science"]),
    "Business Administration": ("BUS", ["Management", "Marketing", "Accounting", "Corporate Finance", "Operations", "Entrepreneurship"]),
    "Political Science": ("POLI", ["American Politics", "Comparative Politics", "International Relations", "Political Theory", "Public Policy", "Political Research"]),
    "Mathematics": ("MATH", ["Calculus", "Linear Algebra", "Discrete Mathematics", "Real Analysis", "Abstract Algebra", "Differential Equations"]),
    "Physics": ("PHYS", ["Mechanics", "Electromagnetism", "Modern Physics", "Quantum Mechanics", "Optics", "Physics Lab"]),
    "English": ("ENGL", ["Literary Analysis", "Creative Writing", "American Literature", "British Literature", "Rhetoric", "Contemporary Fiction"]),
    "History": ("HIST", ["World History", "American History", "European History", "Historical Methods", "Public History", "Global History"]),
    "Sociology": ("SOCI", ["Social Theory", "Social Inequality", "Urban Sociology", "Research Methods", "Sociology of Education", "Social Networks"]),
    "Public Health": ("PUBH", ["Epidemiology", "Health Policy", "Environmental Health", "Biostatistics", "Global Health", "Community Health"]),
    "Electrical Engineering": ("ECE", ["Circuit Analysis", "Digital Logic", "Signals and Systems", "Electronics", "Embedded Systems", "Control Systems"]),
    "Environmental Science": ("ENVS", ["Climate Science", "Conservation", "Environmental Policy", "Ecology", "Sustainability", "Environmental Chemistry"]),
    "Communication": ("COMM", ["Media Studies", "Public Speaking", "Digital Media", "Communication Theory", "Journalism", "Interpersonal Communication"]),
    "Philosophy": ("PHIL", ["Logic", "Ethics", "Political Philosophy", "Epistemology", "Metaphysics", "Philosophy of Science"]),
    "Biomedical Engineering": ("BME", ["Biomechanics", "Biomaterials", "Medical Imaging", "Bioinstrumentation", "Systems Physiology", "Biomedical Design"]),
}


def university_counts():
    """Eight UNC students; the other 42 use a discrete Gaussian over nine campuses."""
    others = [(i + 1, u) for i, u in enumerate(UNIVERSITIES) if u != UNC]
    weights = [math.exp(-0.5 * ((i - 5) / 2) ** 2) for i, _ in others]
    available = COHORT_SIZE - UNC_COUNT
    quotas = [(available - len(others)) * w / sum(weights) for w in weights]
    counts = [1 + math.floor(q) for q in quotas]
    for i in sorted(range(len(others)), key=lambda i: quotas[i] % 1, reverse=True)[:available - sum(counts)]:
        counts[i] += 1
    return {UNC: UNC_COUNT, **{u: n for (_, u), n in zip(others, counts)}}


def cohort_profiles():
    from .demo_overrides import PRESETS, retarget_history
    rng = random.Random(2026)
    counts = university_counts()
    # Keep demo accounts A-F and their identifiers stable.
    first = [UNC, "NC State University", "Duke University", "Stanford University", UNC, "Harvard University"]
    for u in first:
        counts[u] -= 1
    remaining = [u for u, count in counts.items() for _ in range(count)]
    rng.shuffle(remaining)
    majors = list(MAJORS)
    for n, university in enumerate(first + remaining, 1):
        major = majors[n - 1] if n <= 6 else majors[(n - 1) % len(majors)]
        year = ["Freshman", "Sophomore", "Junior", "Senior"][(n - 1) % 4]
        if n <= 6:
            year = ["Junior", "Sophomore", "Senior", "Junior", "Junior", "Sophomore"][n - 1]
        prefix, names = MAJORS[major]
        term_count = {"Freshman": 0, "Sophomore": 2, "Junior": 4, "Senior": 6}[year]
        terms = []
        ability = rng.uniform(2.65, 3.85)
        for t in range(term_count):
            term_year = 2026 - term_count // 2 + t // 2
            term = f"{'Fall' if t % 2 == 0 else 'Spring'} {term_year + (t % 2)}"
            courses = []
            for j in range(5):
                name = names[(t * 2 + j) % len(names)] if j < 3 else ["Academic Writing", "Quantitative Reasoning"][j - 3]
                code = f"{prefix if j < 3 else ['ENGL', 'MATH'][j - 3]} {100 + t * 30 + j * 10}"
                courses.append({"code": code, "name": name, "credits": rng.choice([3, 3, 4]),
                                "gpa": round(max(0.0, min(4.0, rng.gauss(ability + t * 0.035, 0.35))), 2)})
            credits = sum(c["credits"] for c in courses)
            gpa = round(sum(c["gpa"] * c["credits"] for c in courses) / credits, 2)
            terms.append({"term": term, "gpa": gpa, "credits": credits, "courses": courses})
        courses = [{"code": f"{prefix} {200 + term_count * 30 + j * 10}", "name": name, "credits": rng.choice([3, 4])}
                   for j, name in enumerate(rng.sample(names, 4))]
        courses.append({"code": "ENGL 105", "name": "Academic Writing", "credits": 3})
        interest = rng.choice(["community health", "accessible technology", "sustainability", "education", "public policy", "creative research"])
        biography = {"introduction": f"I am a {year.lower()} studying {major} at {university}. I enjoy connecting classroom ideas with {interest}.",
                     "pitch": f"My goal is to build stronger skills in {names[0].lower()} and {names[-1].lower()}. I plan weekly study sessions and seek feedback early. A scholarship would help me dedicate more time to my {interest} project."}
        activities = [f"{major} student association: {rng.choice(['member', 'project coordinator', 'peer mentor'])}",
                      f"Community volunteering: {rng.randint(2, 8)} hours/week", f"{interest.title()} project: {rng.randint(3, 10)} hours/week"]
        awards = [{"name": rng.choice(["Undergraduate research poster", "Community impact project", "Academic excellence award", "Innovation challenge"]),
                   "result": rng.choice(["Finalist", "Awarded", "Presented", "Completed"])}]
        if terms and terms[-1]["gpa"] >= 3.5:
            awards.append({"name": f"Dean's List {terms[-1]['term']}", "result": "Awarded"})
        history = {"terms": terms}
        preset = PRESETS.get(f"STU{n:03d}")
        if preset:
            history = retarget_history(history, preset["cumulative"])
        yield n, university, year, major, {"GPA_HISTORY": history, "COURSE_LOAD": {"term": "Fall 2026", "courses": courses},
                                              "ACTIVITY": {"items": activities}, "APPLICATION": {"items": awards}, "BIOGRAPHY": biography}


def populate_cohort(db, now):
    """Expand the demo without dropping tables, orders, balances or settlements."""
    from .services.student_service import DISCLOSURE_TITLES
    students = {s.id: s for s in db.scalars(select(Student)).all()}
    disclosures = {(d.student_id, d.type): d for d in db.scalars(select(Disclosure)).all()}
    market_students = set(db.scalars(select(Market.student_id)).all())
    for n, university, year, major, records in cohort_profiles():
        sid = f"STU{n:03d}"
        uid = f"STUDENT_{chr(64 + n)}" if n <= 5 else f"STUDENT_{n:03d}"
        s = students.get(sid)
        if s is None:
            name = f"Student {chr(64 + n)}" if n <= 26 else f"Student {n}"
            db.add(User(id=uid, role="STUDENT", display_name=name))
            db.add(Wallet(user_id=uid))
            s = Student(id=sid, user_id=uid, university=university, year=year, major=major, verified=n != 6)
            db.add(s)
        else:
            s.university, s.year, s.major = university, year, major
        for dtype, data in records.items():
            d = disclosures.get((sid, dtype))
            if d is None:
                d = Disclosure(student_id=sid, type=dtype, title=DISCLOSURE_TITLES[dtype], data=data)
                db.add(d)
            d.data = data
            d.title = DISCLOSURE_TITLES[dtype]
            d.verified_at = now if s.verified and dtype != "BIOGRAPHY" else None
        if sid not in market_students:
            target = round(min(4.0, max(2.5, (records["GPA_HISTORY"]["terms"][-1]["gpa"] if records["GPA_HISTORY"]["terms"] else 3.3) + 0.15)), 1)
            db.add(Market(id=f"{sid}-GPA-2026F", student_id=sid, threshold=target, term="Fall 2026",
                          initial_price_cents=random.Random(sid).randint(25, 80),
                          deadline=datetime(2026, 12, 20, 23, 59), status="PRICE_DISCOVERY" if s.verified else "DRAFT",
                          question=f"Will Student {n} earn a Fall 2026 GPA of {target} or higher?"))
    db.commit()


def resize_cohort(db, now):
    """Keep the first 50 profiles and their records; remove excess demo data atomically.

    Cancel removed markets' orders, refund human holdings at the last mark, and
    release funding before deleting their related rows. Ledger history remains.
    """
    from .models import (AccountCredentials, Favorite, LedgerEntry, Order, Position,
                         Scholarship, Settlement, Trade, VerificationRequest)
    from .services import invariants, ledger_service as ledger, order_service

    campuses = {f"STU{n:03d}": university for n, university, *_ in cohort_profiles()}
    students = db.scalars(select(Student)).all()
    removed = [s for s in students if s.id not in campuses]
    removed_ids = [s.id for s in removed]
    removed_users = [s.user_id for s in removed]
    try:
        markets = db.scalars(select(Market).where(Market.student_id.in_(removed_ids))).all()
        market_ids = [m.id for m in markets]
        for market in markets:
            order_service.cancel_all_open(db, market.id)
            for p in db.scalars(select(Position).where(Position.market_id == market.id, Position.quantity > 0)).all():
                if p.user_id not in removed_users and p.user_id != "ADMIN" and not p.user_id.startswith("MM_"):
                    mark = market.last_price_cents if market.last_price_cents is not None else 50
                    refund = p.quantity * (mark if p.contract == "YES" else 100 - mark)
                    ledger.post(db, [(ledger.TREASURY, -refund), (ledger.user_account(p.user_id), refund)], "COHORT_HOLDING_REDEMPTION", now=now)
            for account in (ledger.collateral_account(market.id), ledger.scholarship_account(market.id)):
                amount = ledger.balance(db, account)
                if amount:
                    ledger.post(db, [(account, -amount), (ledger.TREASURY, amount)], "COHORT_FUNDING_RELEASE", now=now)
        for student in removed:
            w = db.get(Wallet, student.user_id)
            if w and w.available_cents:
                ledger.post(db, [(ledger.user_account(student.user_id), -w.available_cents),
                                 (ledger.TREASURY, w.available_cents)], "COHORT_ACCOUNT_RELEASE", now=now)

        trades = select(Trade.id).where(Trade.market_id.in_(market_ids))
        db.execute(update(LedgerEntry).where(LedgerEntry.ref_trade_id.in_(trades)).values(ref_trade_id=None))
        db.execute(delete(Favorite).where(or_(Favorite.market_id.in_(market_ids), Favorite.user_id.in_(removed_users))))
        db.execute(delete(VerificationRequest).where(VerificationRequest.student_id.in_(removed_ids)))
        db.execute(delete(Disclosure).where(Disclosure.student_id.in_(removed_ids)))
        db.execute(delete(Settlement).where(or_(Settlement.market_id.in_(market_ids), Settlement.user_id.in_(removed_users))))
        db.execute(delete(Position).where(or_(Position.market_id.in_(market_ids), Position.user_id.in_(removed_users))))
        db.execute(delete(Trade).where(Trade.market_id.in_(market_ids)))
        db.execute(delete(Order).where(or_(Order.market_id.in_(market_ids), Order.user_id.in_(removed_users))))
        db.execute(delete(Scholarship).where(Scholarship.market_id.in_(market_ids)))
        db.execute(delete(Market).where(Market.id.in_(market_ids)))
        db.execute(delete(AccountCredentials).where(AccountCredentials.user_id.in_(removed_users)))
        db.execute(delete(Student).where(Student.id.in_(removed_ids)))
        db.execute(delete(Wallet).where(Wallet.user_id.in_(removed_users)))
        db.execute(delete(User).where(User.id.in_(removed_users)))
        for student in students:
            if student.id not in campuses:
                continue
            previous, student.university = student.university, campuses[student.id]
            bio = db.scalar(select(Disclosure).where(Disclosure.student_id == student.id, Disclosure.type == "BIOGRAPHY"))
            if bio and previous != student.university:
                bio.data = {key: value.replace(previous, student.university) if isinstance(value, str) else value
                            for key, value in bio.data.items()}
            for request in db.scalars(select(VerificationRequest).where(VerificationRequest.student_id == student.id,
                VerificationRequest.type == "UNIVERSITY", VerificationRequest.status == "PENDING")).all():
                request.payload = {**request.payload, "previous": student.university}
        failed = [c for c in invariants.check_all(db) if not c["ok"]]
        if failed:
            raise RuntimeError(f"Cohort resize failed consistency checks: {failed}")
        db.commit()
    except Exception:
        db.rollback()
        raise
    return len(removed)


if __name__ == "__main__":
    import json
    import sqlite3
    from collections import Counter
    from pathlib import Path
    from .db import SessionLocal, engine, utcnow

    with SessionLocal() as db:
        current = db.scalars(select(Student)).all()
        if engine.url.get_backend_name() != "sqlite":
            raise SystemExit("Use the demo SQLite database for this update")
        database = Path(engine.url.database).resolve()
        backup = database.with_name(f"spe.before-cohort-{datetime.now():%Y%m%d-%H%M%S}.db")
        with sqlite3.connect(str(database)) as source, sqlite3.connect(str(backup)) as target:
            source.backup(target)
        print(f"Backup: {backup.name}")
        from .schema import ensure_schema
        ensure_schema()
        if len(current) < COHORT_SIZE:
            populate_cohort(db, utcnow())
        removed = resize_cohort(db, utcnow())
        counts = Counter(db.scalars(select(Student.university)).all())
        print(json.dumps({"students": sum(counts.values()), "universities": len(counts),
                          "unc": counts[UNC], "other_students": sum(counts.values()) - counts[UNC],
                          "removed": removed, "distribution": dict(counts)}))
