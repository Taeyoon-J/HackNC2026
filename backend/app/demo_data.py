"""Reproducible synthetic cohort; course names/codes are illustrative, not catalogs.

100 institutions selected in 2026 US News National Universities order. Ties at
the boundary are broken by name (Colorado Boulder is the 101st institution).
Sources: https://www.collegekickstart.com/blog/item/u-s-news-world-report-posts-2026-college-rankings
https://poetsandquants.com/2025/09/23/u-s-news-2026-best-business-schools-ranking-mit-joins-wharton-at-the-top/2/
"""
import math
import random
from datetime import datetime

from sqlalchemy import select

from .models import Disclosure, Market, Student, User, Wallet

UNC = "UNC Chapel Hill"
UNIVERSITIES = """Princeton University
Massachusetts Institute of Technology
Harvard University
Stanford University
Yale University
University of Chicago
Duke University
Johns Hopkins University
Northwestern University
University of Pennsylvania
California Institute of Technology
Cornell University
Brown University
Dartmouth College
Columbia University
University of California, Berkeley
Rice University
University of California, Los Angeles
Vanderbilt University
Carnegie Mellon University
University of Michigan, Ann Arbor
University of Notre Dame
Washington University in St. Louis
Emory University
Georgetown University
UNC Chapel Hill
University of Virginia
University of Southern California
University of California, San Diego
University of Florida
University of Texas at Austin
Georgia Institute of Technology
New York University
University of California, Davis
University of California, Irvine
Boston College
Tufts University
University of Illinois Urbana-Champaign
University of Wisconsin-Madison
University of California, Santa Barbara
Ohio State University
Boston University
Rutgers University-New Brunswick
University of Maryland, College Park
University of Washington
Lehigh University
Northeastern University
Purdue University
University of Georgia
University of Rochester
Case Western Reserve University
Florida State University
Texas A&M University
Virginia Tech
Wake Forest University
William & Mary
University of California, Merced
Villanova University
George Washington University
Santa Clara University
Stony Brook University
Pennsylvania State University
University of Minnesota, Twin Cities
Michigan State University
NC State University
Rensselaer Polytechnic Institute
University of Massachusetts Amherst
University of Miami
Brandeis University
Tulane University
University of Connecticut
University of Pittsburgh
Binghamton University
Indiana University Bloomington
Clemson University
Rutgers University-Newark
Syracuse University
University at Buffalo
University of California, Riverside
Colorado School of Mines
Drexel University
New Jersey Institute of Technology
Stevens Institute of Technology
Pepperdine University
University of Illinois Chicago
Worcester Polytechnic Institute
Yeshiva University
American University
Baylor University
Howard University
Marquette University
Rochester Institute of Technology
Southern Methodist University
University of California, Santa Cruz
University of Delaware
University of South Florida
Florida International University
Fordham University
Rutgers University-Camden
Texas Christian University""".splitlines()

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
    """150 UNC; 850 across the other 99, discrete Gaussian mu=50, sigma=22.

    Reserve one place per campus, then allocate the remaining 751 using largest
    remainders. This gives exactly 1,000 students and represents every campus.
    """
    others = [(i + 1, u) for i, u in enumerate(UNIVERSITIES) if u != UNC]
    weights = [math.exp(-0.5 * ((i - 50) / 22) ** 2) for i, _ in others]
    quotas = [751 * w / sum(weights) for w in weights]
    counts = [1 + math.floor(q) for q in quotas]
    for i in sorted(range(99), key=lambda i: quotas[i] % 1, reverse=True)[:850 - sum(counts)]:
        counts[i] += 1
    return {UNC: 150, **{u: n for (_, u), n in zip(others, counts)}}


def cohort_profiles():
    rng = random.Random(2026)
    counts = university_counts()
    # Keep demo accounts A-F and their identifiers stable.
    first = [UNC, "NC State University", "Duke University", "Wake Forest University", UNC, "University of Miami"]
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
        yield n, university, year, major, {"GPA_HISTORY": {"terms": terms}, "COURSE_LOAD": {"term": "Fall 2026", "courses": courses},
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
                          deadline=datetime(2026, 12, 20, 23, 59), status="PRICE_DISCOVERY" if s.verified else "DRAFT",
                          question=f"Will Student {n} earn a Fall 2026 GPA of {target} or higher?"))
    db.commit()


if __name__ == "__main__":
    import json
    import sqlite3
    from collections import Counter
    from pathlib import Path
    from .db import SessionLocal, engine, utcnow

    with SessionLocal() as db:
        current = db.scalars(select(Student)).all()
        if len(current) < 1000:
            if engine.url.get_backend_name() != "sqlite":
                raise SystemExit("Use the demo SQLite database for this expansion")
            database = Path(engine.url.database).resolve()
            backup = database.with_name(f"spe.before-cohort-{datetime.now():%Y%m%d-%H%M%S}.db")
            with sqlite3.connect(str(database)) as source, sqlite3.connect(str(backup)) as target:
                source.backup(target)
            print(f"Backup: {backup.name}")
            populate_cohort(db, utcnow())
        counts = Counter(db.scalars(select(Student.university)).all())
        print(json.dumps({"students": sum(counts.values()), "universities": len(counts),
                          "unc": counts[UNC], "other_students": sum(counts.values()) - counts[UNC]}))
