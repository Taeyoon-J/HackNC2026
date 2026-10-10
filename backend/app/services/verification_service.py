"""Evidence-backed, atomic approval of student changes and final GPA settlement."""
import base64
import math

from sqlalchemy import select

from ..db import DomainError, utcnow
from ..models import Disclosure, Market, VerificationRequest
from . import settlement_service, student_service

# Profile edits made on the student's own page; applied to the record only on approval.
RECORD_TYPES = {"BIOGRAPHY", "ACTIVITY", "APPLICATION"}
TYPES = {"UNIVERSITY", "MAJOR", "COURSE_LOAD", "FINAL_GPA"} | RECORD_TYPES
FILE_TYPES = {"application/pdf", "image/png", "image/jpeg", "text/plain"}


def ensure_editable_term(db, student_id, term):
    history = db.scalar(select(Disclosure).where(Disclosure.student_id == student_id, Disclosure.type == "GPA_HISTORY"))
    finalized = db.scalar(select(Market).where(Market.student_id == student_id, Market.term == term, Market.status == "SETTLED"))
    if finalized or (history and any(t.get("term") == term for t in history.data.get("terms", []))):
        raise DomainError("A finalized semester cannot be changed")


def courses(payload, *, graded=False):
    rows = payload.get("courses")
    if not isinstance(rows, list) or not 1 <= len(rows) <= 30:
        raise DomainError("Provide between 1 and 30 courses")
    result = []
    codes = set()
    for c in rows:
        if not isinstance(c, dict):
            raise DomainError("Each course must include its code, name and credits")
        code, name = str(c.get("code", "")).strip(), str(c.get("name", "")).strip()
        credits = c.get("credits")
        if not code or not name or len(code) > 40 or len(name) > 200 or code.casefold() in codes:
            raise DomainError("Course codes and names are required; duplicate codes are not allowed")
        if not isinstance(credits, (int, float)) or isinstance(credits, bool) or not math.isfinite(credits) or not 0 < credits <= 12:
            raise DomainError("Course credits must be greater than 0 and at most 12")
        row = {"code": code, "name": name, "credits": credits}
        if graded or "gpa" in c:
            grade = c.get("gpa")
            if not isinstance(grade, (int, float)) or isinstance(grade, bool) or not math.isfinite(grade) or not 0 <= grade <= 4:
                raise DomainError("Every course grade must be between 0 and 4")
            row["gpa"] = grade
        result.append(row)
        codes.add(code.casefold())
    return result


def validate_file(file):
    if not file:
        return None
    if file.get("content_type") not in FILE_TYPES or not isinstance(file.get("name"), str) or len(file["name"]) > 150:
        raise DomainError("Evidence must be a PDF, PNG, JPEG or text file")
    try:
        encoded = file["data_base64"]
        if len(encoded) > 4_200_000:
            raise ValueError()
        decoded = base64.b64decode(encoded, validate=True)
        if not decoded or len(decoded) > 3 * 1024 * 1024:
            raise ValueError()
    except (KeyError, ValueError, TypeError):
        raise DomainError("Evidence file must be valid and at most 3 MB")
    return {"name": file["name"], "content_type": file["content_type"], "data_base64": encoded}


def submit(db, student, dtype, payload, evidence, evidence_file=None):
    if dtype not in TYPES:
        raise DomainError("Unknown verification request type")
    if student.status != "ACTIVE":
        raise DomainError("A delisted student cannot submit verification")
    file = validate_file(evidence_file)
    evidence = evidence.strip()  # optional: a description and a file are both nice-to-have
    pending = db.scalar(select(VerificationRequest).where(VerificationRequest.student_id == student.id,
        VerificationRequest.type == dtype, VerificationRequest.status == "PENDING"))
    if pending and dtype not in RECORD_TYPES:
        raise DomainError("A request of this type is already awaiting review")
    if dtype in RECORD_TYPES:
        payload = {"data": record_data(dtype, payload.get("data")), "previous": _current_record(db, student.id, dtype)}
        if payload["data"] == payload["previous"]:
            raise DomainError("No changes to submit")
        if pending:
            # A newer edit supersedes the one still waiting for review.
            pending.payload, pending.evidence, pending.evidence_file, pending.created_at = payload, evidence, file, utcnow()
            db.commit()
            return pending
    elif dtype in ("UNIVERSITY", "MAJOR"):
        value = payload.get("value")
        if not isinstance(value, str) or not 1 <= len(value.strip()) <= 120:
            raise DomainError("Provide a university or major name")
        payload = {"value": value.strip(), "previous": getattr(student, dtype.lower())}
        if payload["value"] == payload["previous"]:
            raise DomainError("The proposed value matches the current profile")
    elif dtype == "COURSE_LOAD":
        term = payload.get("term", "")
        if not isinstance(term, str):
            raise DomainError("Provide an academic term")
        student_service.term_deadline(term)
        ensure_editable_term(db, student.id, term)
        payload = {"term": term, "courses": courses(payload)}
    else:
        market = db.get(Market, payload.get("market_id", ""))
        if market is None or market.student_id != student.id or not market.total_supply or market.status not in ("TRADING", "CLOSED"):
            raise DomainError("Select your current active GPA goal")
        load = db.scalar(select(Disclosure).where(Disclosure.student_id == student.id, Disclosure.type == "COURSE_LOAD"))
        if load is None or not load.verified_at:
            raise DomainError("Verify the current course load first")
        if load.data.get("term") != market.term:
            raise DomainError("The verified course load must match the goal semester")
        rows = courses(payload, graded=True)
        current = {c["code"]: c for c in load.data.get("courses", [])}
        if set(current) != {c["code"] for c in rows}:
            raise DomainError("Final grades must include exactly the verified current courses")
        for c in rows:
            c["credits"], c["name"] = current[c["code"]]["credits"], current[c["code"]]["name"]
        credits = sum(c["credits"] for c in rows)
        payload = {"market_id": market.id, "term": market.term, "courses": rows, "credits": credits,
                   "gpa": round(sum(c["gpa"] * c["credits"] for c in rows) / credits, 2)}
    request = VerificationRequest(student_id=student.id, type=dtype, payload=payload,
                                  evidence=evidence, evidence_file=file, status="PENDING")
    db.add(request)
    db.commit()
    return request


def record_data(dtype, data):
    if not isinstance(data, dict):
        raise DomainError("Invalid profile data")
    if dtype == "BIOGRAPHY":
        out = {k: data.get(k, "") for k in ("introduction", "pitch")}
        if any(not isinstance(v, str) or len(v) > 4000 for v in out.values()):
            raise DomainError("Introduction and personal statement must be text of at most 4,000 characters each")
        return {k: v.strip() for k, v in out.items()}
    items = data.get("items")
    if not isinstance(items, list) or len(items) > 30:
        raise DomainError("Provide at most 30 entries")
    if dtype == "ACTIVITY":
        if any(not isinstance(i, str) or not i.strip() or len(i) > 200 for i in items):
            raise DomainError("Each activity must be text of at most 200 characters")
        return {"items": [i.strip() for i in items]}
    if any(not isinstance(i, dict) or not str(i.get("name", "")).strip() or len(str(i.get("name"))) > 200
           or len(str(i.get("result", ""))) > 100 for i in items):
        raise DomainError("Each application needs a program name")
    return {"items": [{"name": str(i["name"]).strip(), "result": str(i.get("result", "")).strip()} for i in items]}


def _current_record(db, sid, dtype):
    d = db.scalar(select(Disclosure).where(Disclosure.student_id == sid, Disclosure.type == dtype))
    if d is None:
        return {"introduction": "", "pitch": ""} if dtype == "BIOGRAPHY" else {"items": []}
    return d.data


def approve(db, request, student, reviewer, note=""):
    if request.status != "PENDING":
        raise DomainError("This request has already been reviewed")
    try:
        if request.type == "REGISTRATION":
            from .registration_service import activate
            activate(db, student)
        elif request.type in RECORD_TYPES:
            _save_record(db, student.id, request.type, request.payload["data"])
        elif request.type in ("UNIVERSITY", "MAJOR"):
            setattr(student, request.type.lower(), request.payload["value"])
        elif request.type == "COURSE_LOAD":
            ensure_editable_term(db, student.id, request.payload["term"])
            _save_record(db, student.id, "COURSE_LOAD", request.payload)
        elif request.type == "FINAL_GPA":
            market = db.get(Market, request.payload["market_id"])
            load = db.scalar(select(Disclosure).where(Disclosure.student_id == student.id, Disclosure.type == "COURSE_LOAD"))
            if market is None or load is None or load.data.get("term") != market.term:
                raise DomainError("The verified course load must match the goal semester")
            expected = {(c["code"], c["credits"]) for c in load.data.get("courses", [])} if load else set()
            actual = {(c["code"], c["credits"]) for c in request.payload["courses"]}
            if expected != actual:
                raise DomainError("Course load changed after submission. Reject this request and ask for updated grades.")
            history = db.scalar(select(Disclosure).where(Disclosure.student_id == student.id, Disclosure.type == "GPA_HISTORY"))
            terms = list(history.data.get("terms", [])) if history else []
            if any(t["term"] == market.term for t in terms):
                raise DomainError("Grades for this semester have already been finalized")
            terms.append({k: request.payload[k] for k in ("term", "gpa", "credits", "courses")})
            _save_record(db, student.id, "GPA_HISTORY", {"terms": terms})
            _save_record(db, student.id, "COURSE_LOAD", {k: request.payload[k] for k in ("term", "courses")})
            settlement_service.resolve(db, market, request.payload["gpa"], commit=False)
            settlement_service.settle(db, market, commit=False)
        request.status, request.reviewed_at, request.reviewed_by = "APPROVED", utcnow(), reviewer.id
        request.review_note = note
        db.commit()
    except Exception:
        db.rollback()
        raise
    return request


def _save_record(db, sid, dtype, data):
    d = db.scalar(select(Disclosure).where(Disclosure.student_id == sid, Disclosure.type == dtype))
    if d is None:
        d = Disclosure(student_id=sid, type=dtype, title=student_service.DISCLOSURE_TITLES[dtype], data=data)
        db.add(d)
    d.data, d.verified_at = data, utcnow()
