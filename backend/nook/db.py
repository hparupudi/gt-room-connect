"""Persistence. Uses MongoDB when MONGODB_URI connects, otherwise a JSON file."""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path

_db = None
_lock = threading.Lock()


def data_file() -> Path:
    raw = os.getenv("DATA_PATH", "").strip()
    if raw:
        return Path(raw)
    return Path(__file__).resolve().parents[1] / "data" / "db.json"


class FileStore:
    def __init__(self, path: Path):
        self.path = path
        self.mode = "file"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if self.path.exists():
            self.data = json.loads(self.path.read_text())
        else:
            self.data = {"users": [], "codes": [], "bookings": []}
            self._flush()

    def _flush(self):
        self.path.write_text(json.dumps(self.data, indent=2))

    def insert(self, col: str, doc: dict) -> dict:
        with _lock:
            self.data.setdefault(col, []).append(doc)
            self._flush()
        return doc

    def find_all(self, col: str) -> list[dict]:
        return list(self.data.get(col, []))

    def find_one(self, col: str, **query) -> dict | None:
        for doc in self.data.get(col, []):
            if all(doc.get(k) == v for k, v in query.items()):
                return doc
        return None

    def update(self, col: str, doc_id: str, patch: dict) -> dict | None:
        with _lock:
            for doc in self.data.get(col, []):
                if doc.get("id") == doc_id:
                    doc.update(patch)
                    self._flush()
                    return doc
        return None


class MongoStore:
    def __init__(self, uri: str):
        from pymongo import MongoClient

        self.client = MongoClient(uri, serverSelectionTimeoutMS=2000)
        self.client.admin.command("ping")
        self.db = self.client[os.getenv("MONGODB_DB", "nook")]
        self.mode = "mongo"

    def insert(self, col: str, doc: dict) -> dict:
        self.db[col].insert_one(dict(doc))
        return doc

    def find_all(self, col: str) -> list[dict]:
        rows = []
        for doc in self.db[col].find():
            doc.pop("_id", None)
            rows.append(doc)
        return rows

    def find_one(self, col: str, **query) -> dict | None:
        doc = self.db[col].find_one(query)
        if not doc:
            return None
        doc.pop("_id", None)
        return doc

    def update(self, col: str, doc_id: str, patch: dict) -> dict | None:
        self.db[col].update_one({"id": doc_id}, {"$set": patch})
        return self.find_one(col, id=doc_id)


def init_db():
    global _db
    uri = os.getenv("MONGODB_URI", "").strip()
    if uri:
        try:
            _db = MongoStore(uri)
            return _db
        except Exception as exc:
            print(f"MongoDB unavailable ({exc}); using the local file store.")
    _db = FileStore(data_file())
    return _db


def get_db():
    if _db is None:
        return init_db()
    return _db


def reset_state():
    global _db
    _db = None
