import hashlib
import hmac
import secrets

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import DomainError, get_db
from ..models import AccountCredentials, User
from .deps import current_user

router = APIRouter(prefix="/api/account", tags=["account"])


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 260_000).hex()
    return f"{salt}:{digest}"


def matches(password, stored):
    return bool(stored) and hmac.compare_digest(password_hash(password, stored.split(":")[0]), stored)


class AccountChange(BaseModel):
    username: str = Field(min_length=3, max_length=80, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(default="", max_length=128)
    current_password: str = Field(default="", max_length=128)


class Login(BaseModel):
    username: str = Field(max_length=80)
    password: str = Field(max_length=128)


@router.get("")
async def account(user: User = Depends(current_user), db: Session = Depends(get_db)):
    credentials = db.get(AccountCredentials, user.id)
    return {"user_id": user.id, "username": credentials.username if credentials else user.id,
            "has_password": bool(credentials and credentials.password_hash)}


@router.put("")
async def update(req: AccountChange, user: User = Depends(current_user), db: Session = Depends(get_db)):
    credentials = db.get(AccountCredentials, user.id)
    if credentials and credentials.password_hash and not matches(req.current_password, credentials.password_hash):
        raise DomainError("Current password is incorrect", 403)
    if req.password and len(req.password) < 8:
        raise DomainError("Password must contain at least 8 characters")
    username = req.username.lower()
    existing = db.scalar(select(User).where(func.lower(User.id) == username, User.id != user.id))
    if existing:
        raise DomainError("This account ID is already in use")
    if credentials is None:
        credentials = AccountCredentials(user_id=user.id, username=username)
        db.add(credentials)
    credentials.username = username
    if req.password:
        credentials.password_hash = password_hash(req.password)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise DomainError("This account ID is already in use")
    return {"user_id": user.id, "username": credentials.username, "has_password": bool(credentials.password_hash)}


@router.post("/login")
async def login(req: Login, db: Session = Depends(get_db)):
    credentials = db.scalar(select(AccountCredentials).where(AccountCredentials.username == req.username.lower()))
    if credentials is None or not matches(req.password, credentials.password_hash):
        raise DomainError("Incorrect account ID or password", 401)
    user = db.get(User, credentials.user_id)
    if user.status != "ACTIVE":
        raise DomainError("Requires verification. Your account is unavailable until an admin approves it.", 403)
    return {"user_id": user.id, "role": user.role}
