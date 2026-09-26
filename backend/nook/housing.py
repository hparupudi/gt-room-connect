"""Room furniture, dimensions, and building amenities published by GT Housing."""

from __future__ import annotations

import json
from pathlib import Path

_FACTS: dict | None = None

# Longer phrases first so "desk chair" is a chair, not a desk.
_MATCH = (
    ("desk chair", "Chair"),
    ("wardrobe", "Wardrobe"),
    ("dresser", "Dresser/Chest"),
    ("chest", "Dresser/Chest"),
    ("chair", "Chair"),
    ("bed", "Bed"),
    ("desk", "Desk"),
)


def _load() -> dict:
    global _FACTS
    if _FACTS is None:
        path = Path(__file__).resolve().parent / "data" / "hall_facts.json"
        _FACTS = json.loads(path.read_text()) if path.exists() else {"dimensions": [], "halls": {}, "source": ""}
    return _FACTS


def housing_for(dorm_id: str) -> dict | None:
    data = _load()
    hall = (data.get("halls") or {}).get(dorm_id)
    if not hall:
        return None
    catalog = {item["name"]: item for item in data.get("dimensions") or []}
    dimensions = []
    seen: set[str] = set()
    for piece in hall.get("furniture") or []:
        label = (piece.get("name") or "").lower()
        for needle, catalog_name in _MATCH:
            if needle in label and catalog_name not in seen and catalog_name in catalog:
                dimensions.append(catalog[catalog_name])
                seen.add(catalog_name)
                break
    return {
        "page": hall.get("page") or "",
        "room_style": hall.get("room_style") or "",
        "amenities": hall.get("amenities") or [],
        "furniture": hall.get("furniture") or [],
        "furniture_note": hall.get("furniture_note") or "",
        "dimensions": dimensions,
        "dimensions_source": data.get("source") or "",
    }
