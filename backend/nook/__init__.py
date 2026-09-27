import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

from .db import init_db, reset_state
from .routes import register_routes
from .seed import backfill_demo_consents, refresh_demo_copy, seed_if_empty, shift_ending_weekend

ROOT = Path(__file__).resolve().parents[2]


def create_app() -> Flask:
    load_dotenv(ROOT / ".env")
    load_dotenv(ROOT / "backend" / ".env")
    app = Flask(__name__)
    app.secret_key = os.getenv("FLASK_SECRET_KEY", "").strip() or "dev-nook-secret-change-me"
    app.config["JSON_SORT_KEYS"] = False
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    init_db()
    seed_if_empty()
    refresh_demo_copy()
    backfill_demo_consents()
    shift_ending_weekend()
    register_routes(app)
    return app


__all__ = ["create_app", "reset_state"]
