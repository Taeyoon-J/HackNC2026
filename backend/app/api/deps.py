from fastapi import Depends, Header
from sqlalchemy.orm import Session

from ..db import DomainError, get_db
from ..models import User


def current_user(x_user_id: str = Header(default="TRADER_A"), db: Session = Depends(get_db)) -> User:
    """Demo auth: the frontend's user switcher sends X-User-Id."""
    user = db.get(User, x_user_id)
    if user is None:
        raise DomainError(f"Unknown user {x_user_id}", 401)
    if user.status != "ACTIVE":
        raise DomainError("Requires verification. Your account is unavailable until an admin approves it.", 403)
    return user


def admin_user(user: User = Depends(current_user)) -> User:
    if user.role != "ADMIN":
        raise DomainError("Admin only", 403)
    return user
