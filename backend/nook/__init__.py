import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

from .db import init_db, reset_state
from .routes import register_routes
from .seed import backfill_demo_consents, refresh_demo_copy, seed_if_empty, shift_ending_weekend

ROOT = Path(__file__).resolve().parents[2]


def cors_origins() -> str | list[str]:
    """Origins allowed to call /api. Comma-separated in CORS_ORIGINS, "*" when unset.

    The browser sends the session as an Authorization header, never a cookie, so
    "*" stays a legal answer for a preflight.
    """
    raw = os.getenv("CORS_ORIGINS", "").strip()
    if not raw or raw == "*":
        return "*"
    origins = [item.strip().rstrip("/") for item in raw.split(",") if item.strip()]
    return origins or "*"


def create_app() -> Flask:
    load_dotenv(ROOT / ".env")
    load_dotenv(ROOT / "backend" / ".env")
    app = Flask(__name__)
    app.secret_key = os.getenv("FLASK_SECRET_KEY", "").strip() or "dev-nook-secret-change-me"
    app.config["JSON_SORT_KEYS"] = False
    CORS(
        app,
        resources={r"/api/*": {"origins": cors_origins()}},
        allow_headers=["Authorization", "Content-Type"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        max_age=86_400,
    )
    init_db()
    seed_if_empty()
    refresh_demo_copy()
    backfill_demo_consents()
    shift_ending_weekend()
    register_routes(app)
    return app


__all__ = ["cors_origins", "create_app", "reset_state"]
