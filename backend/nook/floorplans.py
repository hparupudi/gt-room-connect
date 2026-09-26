"""Official Georgia Tech Housing floor-plan images.

`scripts/fetch_gt_floorplans.py` curls housing.gatech.edu and writes
`data/floorplans/manifest.json` plus the JPEGs. Those images are the published
plans (rooms, bathrooms, study spaces, kitchens), not the schematic fallback.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "data" / "floorplans"
MANIFEST = ROOT / "manifest.json"
HOTSPOTS = Path(__file__).resolve().parent / "data" / "room_hotspots.json"


@lru_cache(maxsize=1)
def _manifest() -> dict:
    if not MANIFEST.exists():
        return {}
    return json.loads(MANIFEST.read_text())


def official_floors(dorm_id: str) -> dict[int, dict]:
    hall = _manifest().get(dorm_id) or {}
    found: dict[int, dict] = {}
    for key, item in (hall.get("floors") or {}).items():
        path = ROOT / item["file"]
        if not path.is_file():
            continue
        found[int(key)] = {
            "file": item["file"],
            "pdf": item.get("pdf") or "",
            "page": hall.get("page") or "",
            "label": item.get("label") or f"Floor {key}",
        }
    return found


def image_file(dorm_id: str, floor: int) -> Path | None:
    item = official_floors(dorm_id).get(floor)
    if not item:
        return None
    path = ROOT / item["file"]
    return path if path.is_file() else None


@lru_cache(maxsize=1)
def _hotspots() -> dict:
    if not HOTSPOTS.exists():
        return {}
    return json.loads(HOTSPOTS.read_text())


def room_hotspots(dorm_id: str, floor: int) -> list[dict]:
    """Normalized click boxes for room numbers on the published floor image."""
    hall = _hotspots().get(dorm_id) or {}
    return list(hall.get(str(floor)) or [])
