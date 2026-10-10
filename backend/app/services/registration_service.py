"""Student registration and atomic admin activation with temporary demo targets."""
import secrets

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from ..db import DomainError, utcnow
from ..models import AccountCredentials, Disclosure, Market, Student, User, VerificationRequest, Wallet
from . import fixed_market_service, student_service, verification_service


def register(db, req):
    from ..api.account import password_hash
    username = req.username.lower()
    if db.scalar(select(AccountCredentials).where(AccountCredentials.username == username)) or db.scalar(
        select(User).where(func.lower(User.id) == username)
    ):
        raise DomainError("This account ID is already in use")
    university, major = req.university.strip(), req.major.strip()
    if not university or not major:
        raise DomainError("University and major are required")
    term = req.current_course_load.get("term", "")
    if not isinstance(term, str):
        raise DomainError("Provide the current academic term")
    if student_service.term_deadline(term) <= utcnow():
        raise DomainError("Current academic term must have a future deadline")
    load = {"term": term, "courses": verification_service.courses(req.current_course_load)}
    terms = req.academic_history.get("terms")
    if not isinstance(terms, list) or len(terms) > 30:
        raise DomainError("Academic history must include a list of completed semesters")
    if not terms and req.year != "Freshman":
        raise DomainError("Academic history is required; only freshmen may declare no completed semesters")
    history, seen = [], set()
    for item in terms:
        if not isinstance(item, dict) or not isinstance(item.get("term"), str):
            raise DomainError("Each completed semester requires a term and graded courses")
        past = item["term"]
        if past in seen or student_service.term_deadline(past) >= student_service.term_deadline(term):
            raise DomainError("Completed semesters must be unique and precede the current term")
        seen.add(past)
        rows = verification_service.courses(item, graded=True)
        credits = sum(c["credits"] for c in rows)
        history.append({"term": past, "courses": rows, "credits": credits,
                        "gpa": round(sum(c["gpa"] * c["credits"] for c in rows) / credits, 2)})
    token = secrets.token_hex(8)
    sid, uid = f"STU_{token}", f"STUDENT_{token}"
    try:
        db.add(User(id=uid, role="STUDENT", display_name=req.username, status="PENDING_VERIFICATION"))
        db.flush()
        db.add(Wallet(user_id=uid))
        db.add(AccountCredentials(user_id=uid, username=username, password_hash=password_hash(req.password)))
        student = Student(id=sid, user_id=uid, university=university, year=req.year, major=major,
                          status="PENDING_VERIFICATION", verified=False)
        db.add(student)
        db.flush()
        records = {"GPA_HISTORY": {"terms": history}, "COURSE_LOAD": load,
                   "BIOGRAPHY": {"introduction": req.introduction, "pitch": req.pitch}}
        for dtype, data in records.items():
            db.add(Disclosure(student_id=sid, type=dtype, title=student_service.DISCLOSURE_TITLES[dtype], data=data))
        db.add(VerificationRequest(student_id=sid, type="REGISTRATION", status="PENDING", evidence="",
            payload={"university": university, "year": req.year, "major": major,
                     "academic_history": {"terms": history}, "current_course_load": load}))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise DomainError("This account ID is already in use")
    return student


def activate(db, student):
    if student.status != "PENDING_VERIFICATION":
        raise DomainError("This student is not awaiting account activation")
    load = db.scalar(select(Disclosure).where(Disclosure.student_id == student.id, Disclosure.type == "COURSE_LOAD"))
    term = load.data["term"]
    deadline = student_service.term_deadline(term)
    if deadline <= utcnow():
        raise DomainError("The submitted semester has ended; register with a current semester")
    threshold = (secrets.randbelow(21) + 20) / 10
    probability = secrets.randbelow(61) + 20
    name = db.get(User, student.user_id).display_name
    market = Market(id=f"{student.id}-GPA-{term.replace(' ', '')}", student_id=student.id,
        threshold=threshold, term=term, deadline=deadline, status="TRADING", last_price_cents=probability,
        question=f"Will {name} earn a {term} GPA of {threshold} or higher?")
    student.status, student.verified = "ACTIVE", True
    db.get(User, student.user_id).status = "ACTIVE"
    for disclosure in db.scalars(select(Disclosure).where(Disclosure.student_id == student.id)):
        disclosure.verified_at = utcnow()
    db.add(market)
    db.flush()
    fixed_market_service.initialize_market(db, market)
    db.flush()
    if market.total_supply:
        fixed_market_service.quote_market(db, market)
    return market
