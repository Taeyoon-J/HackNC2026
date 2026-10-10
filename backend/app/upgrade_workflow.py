"""Back up and upgrade the existing local demo to the verification workflow."""
import base64
import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from sqlalchemy import select
from .db import SessionLocal, engine, utcnow
from .models import Disclosure, Market, Student, VerificationRequest
from .schema import ensure_schema
from .services.fixed_market_service import upgrade_demo
from .services.verification_service import submit


def seed_requests(db):
    if db.scalar(select(VerificationRequest.id).limit(1)):
        return
    now = utcnow()
    specs = [("STU007", "UNIVERSITY", {"value": "Duke University"}),
             ("STU002", "MAJOR", {"value": "Statistics"}),
             ("STU008", "COURSE_LOAD", None), ("STU001", "FINAL_GPA", None), ("STU004", "FINAL_GPA", None)]
    for i, (sid, dtype, payload) in enumerate(specs):
        s = db.get(Student, sid)
        if s is None:
            continue
        load = db.scalar(select(Disclosure).where(Disclosure.student_id == sid, Disclosure.type == "COURSE_LOAD"))
        if dtype == "COURSE_LOAD":
            payload = {"term": "Fall 2026", "courses": [*load.data["courses"], {"code": "MATH 210", "name": "Linear Algebra", "credits": 3}]}
        if dtype == "FINAL_GPA":
            market = db.scalar(select(Market).where(Market.student_id == sid, Market.status == "TRADING"))
            payload = {"market_id": market.id, "courses": [{**c, "gpa": 3.95 if sid == "STU001" else 3.0} for c in load.data["courses"]]}
        text = f"Synthetic evidence for {sid}: {json.dumps(payload, indent=2)}\nDemo document only."
        r = submit(db, s, dtype, payload, "Synthetic registrar/advisor document supporting this demo request.",
                   {"name": f"{sid}-{dtype.lower()}-evidence.txt", "content_type": "text/plain", "data_base64": base64.b64encode(text.encode()).decode()})
        r.created_at = now - timedelta(hours=5 - i)
        db.commit()


if __name__ == "__main__":
    database = Path(engine.url.database).resolve()
    backup = database.with_name(f"spe.before-workflow-{datetime.now():%Y%m%d-%H%M%S}.db")
    with sqlite3.connect(str(database)) as source, sqlite3.connect(str(backup)) as target:
        source.backup(target)
    print(f"Backup: {backup.name}")
    ensure_schema()
    with SessionLocal() as db:
        count = upgrade_demo(db)
        seed_requests(db)
        print(json.dumps({"converted_markets": count, "pending_requests": len(db.scalars(select(VerificationRequest).where(VerificationRequest.status == "PENDING")).all())}))
