import os
import re
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from .errors import ApiError

GT_EMAIL = re.compile(r"^[a-z0-9._%+\-]+@gatech\.edu$")


def secret() -> str:
    return os.getenv("FLASK_SECRET_KEY", "").strip() or "dev-nook-secret-change-me"


def normalize_email(email: str) -> str:
    cleaned = (email or "").strip().lower()
    if not GT_EMAIL.match(cleaned):
        raise ApiError("Use your Georgia Tech email — it needs to end in @gatech.edu.")
    return cleaned


def validate_password(password: str) -> None:
    if len(password or "") < 8 or not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise ApiError("Use at least 8 characters with a letter and a number.")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=10)).decode()


def check_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False


def make_token(sub: str, minutes: int = 60 * 24 * 7, **extra) -> str:
    payload = {
        "sub": sub,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=minutes),
        **extra,
    }
    return jwt.encode(payload, secret(), algorithm="HS256")


def read_token(token: str) -> dict:
    return jwt.decode(token, secret(), algorithms=["HS256"])
