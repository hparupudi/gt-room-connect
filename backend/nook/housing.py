"""Room furniture, dimensions, and building amenities published by GT Housing."""

from __future__ import annotations

import json
from pathlib import Path

from .dorms import HALLS

_FACTS: dict | None = None

# "How Do I Learn More About Rooms?" on the first-year FAQ.
_FAQ = "https://housing.gatech.edu/first-time-residents/faq"
_FURNITURE = "Bed, desk, chair, dresser, and wardrobe are the inch sizes Housing publishes."

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


def _foot(
    width_ft: int,
    depth_ft: int,
    depth_extra_in: int,
    width_label: str,
    depth_label: str,
    summary: str,
    drawing: str,
    ranged: bool,
    approximate: bool,
    occupants: int,
    note: str,
) -> dict:
    return {
        "width_in": width_ft * 12,
        "depth_in": depth_ft * 12 + depth_extra_in,
        "width_label": width_label,
        "depth_label": depth_label,
        "summary": summary,
        "drawing": drawing,
        "range": ranged,
        "approximate": approximate,
        "occupants": occupants,
        "source": _FAQ,
        "note": note,
    }


# First number in Housing's "A' X B'" pair is the plan width; the second is the depth.
_EAST = _foot(
    15,
    11,
    0,
    "15'",
    "11'",
    "approximately 12' × 10' to 15' × 11'",
    "15' × 11'",
    True,
    True,
    2,
    "East Campus traditional rooms are approximately 12' × 10' to 15' × 11'. "
    "This drawing is the larger end, 15' × 11'. " + _FURNITURE,
)
_WEST = _foot(
    15,
    11,
    0,
    "15'",
    "11'",
    "approximately 15' × 11'",
    "15' × 11'",
    False,
    True,
    2,
    "West Campus traditional rooms are approximately 15' × 11'. " + _FURNITURE,
)
_HARRIS = _foot(
    12,
    10,
    0,
    "12'",
    "10'",
    "12' × 10'",
    "12' × 10'",
    False,
    False,
    2,
    "Harris suite bedrooms are 12' × 10'. " + _FURNITURE,
)
_WOODRUFF = _foot(
    15,
    12,
    0,
    "15'",
    "12'",
    "15' × 12'",
    "15' × 12'",
    False,
    False,
    2,
    "Woodruff suite bedrooms are 15' × 12'. " + _FURNITURE,
)
_APARTMENT = _foot(
    11,
    8,
    10,
    "11'",
    "8' 10\"",
    "approximately 11' × 8' 10\"",
    "11' × 8' 10\"",
    False,
    True,
    1,
    "Apartment bedrooms are approximately 11' × 8' 10\". This drawing is that bedroom. " + _FURNITURE,
)


def room_footprint(dorm_id: str) -> dict | None:
    row = next((item for item in HALLS if item[0] == dorm_id), None)
    if row is None:
        return None
    campus, style = row[3], row[4]
    if dorm_id == "harris":
        return _HARRIS
    if dorm_id in {"woodruff-north", "woodruff-south"}:
        return _WOODRUFF
    if style == "apartment":
        return _APARTMENT
    if style == "suite":
        return _HARRIS if campus == "east" else _WOODRUFF
    if campus == "west":
        return _WEST
    return _EAST


def _load() -> dict:
    global _FACTS
    if _FACTS is None:
        path = Path(__file__).resolve().parent / "data" / "hall_facts.json"
        _FACTS = json.loads(path.read_text()) if path.exists() else {"dimensions": [], "halls": {}, "source": ""}
    return _FACTS


def housing_for(dorm_id: str) -> dict | None:
    data = _load()
    hall = (data.get("halls") or {}).get(dorm_id)
    room = room_footprint(dorm_id)
    if not hall and not room:
        return None
    catalog = {item["name"]: item for item in data.get("dimensions") or []}
    dimensions = []
    seen: set[str] = set()
    pieces = (hall or {}).get("furniture") or []
    if not pieces and room:
        pieces = [{"name": name} for name in ("Bed", "Desk", "Chair", "Dresser", "Wardrobe")]
    for piece in pieces:
        label = (piece.get("name") or "").lower()
        for needle, catalog_name in _MATCH:
            if needle in label and catalog_name not in seen and catalog_name in catalog:
                dimensions.append(catalog[catalog_name])
                seen.add(catalog_name)
                break
    style_name = {"traditional": "Double Traditional", "suite": "Suite", "apartment": "Apartment"}
    row = next((item for item in HALLS if item[0] == dorm_id), None)
    fallback_style = style_name.get(row[4], "") if row else ""
    return {
        "page": (hall or {}).get("page") or "",
        "room_style": (hall or {}).get("room_style") or fallback_style,
        "amenities": (hall or {}).get("amenities") or [],
        "furniture": (hall or {}).get("furniture") or [],
        "furniture_note": (hall or {}).get("furniture_note") or "",
        "dimensions": dimensions,
        "dimensions_source": data.get("source") or "",
        "room": room,
    }
