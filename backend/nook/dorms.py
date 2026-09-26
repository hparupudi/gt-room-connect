"""Georgia Tech residence halls, schematic floor layouts, and walking estimates.

Building positions, outlines, and floor counts come from OpenStreetMap
(data/gt_halls.json, ODbL). Floor diagrams are original schematics for this
app, not copies of official housing plans. Live walking routes are in
routing.py; the estimate here is the offline fallback and the ranking metric.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

OSM = json.loads((Path(__file__).resolve().parent / "data" / "gt_halls.json").read_text())

# id, name, code, campus, style, units per floor, floors override (None = use OSM levels)
HALLS: list[tuple] = [
    ("glenn", "Glenn", "GLN", "east", "traditional", 16, None),
    ("field", "Field", "FLD", "east", "traditional", 16, None),
    ("hopkins", "Hopkins", "HOP", "east", "traditional", 16, None),
    ("matheson", "Matheson", "MAT", "east", "traditional", 12, None),
    ("perry", "Perry", "PRY", "east", "traditional", 12, None),
    ("hanson", "Hanson", "HAN", "east", "traditional", 12, None),
    ("harrison", "Harrison", "HAR", "east", "traditional", 12, None),
    ("howell", "Howell", "HOW", "east", "traditional", 12, None),
    ("towers", "Towers", "TWR", "east", "traditional", 12, None),
    ("cloudman", "Cloudman", "CLD", "east", "traditional", 12, None),
    ("smith", "Smith", "SMT", "east", "traditional", 12, None),
    ("brown", "Brown", "BRN", "east", "traditional", 12, None),
    ("harris", "Harris", "HRS", "east", "suite", 4, None),
    ("armstrong", "Armstrong", "ARM", "west", "traditional", 12, None),
    ("caldwell", "Caldwell", "CAL", "west", "traditional", 12, None),
    ("folk", "Folk", "FLK", "west", "traditional", 12, None),
    ("fitten", "Fitten", "FIT", "west", "traditional", 12, None),
    ("freeman", "Freeman", "FRE", "west", "traditional", 12, None),
    ("fulmer", "Fulmer", "FUL", "west", "traditional", 12, None),
    ("hefner", "Hefner", "HEF", "west", "traditional", 12, None),
    ("montag", "Montag", "MON", "west", "traditional", 12, None),
    ("woodruff-north", "Woodruff North", "WDN", "west", "suite", 4, None),
    ("woodruff-south", "Woodruff South", "WDS", "west", "suite", 4, None),
    ("crecine", "Crecine", "CRE", "west", "apartment", 8, (1, 2, 3, 4)),
    ("eighth-east", "Eighth Street East", "8E", "west", "apartment", 8, (1, 2, 3, 4)),
    ("eighth-west", "Eighth Street West", "8W", "west", "apartment", 8, (1, 2, 3, 4)),
    ("eighth-south", "Eighth Street South", "8S", "west", "apartment", 8, (1, 2, 3, 4)),
    ("center-north", "Center Street North", "CSN", "west", "apartment", 8, (1, 2, 3, 4, 5)),
    ("center-south", "Center Street South", "CSS", "west", "apartment", 8, (1, 2, 3, 4, 5)),
    ("maulding", "Maulding", "MAU", "west", "apartment", 8, None),
    ("nelson-shell", "Nelson Shell", "NSH", "west", "apartment", 8, None),
    ("zbar", "Zbar", "ZBR", "west", "apartment", 6, None),
    ("graduate-living", "Graduate Living Center", "GLC", "west", "apartment", 8, None),
    ("north-ave-east", "North Avenue East", "NAE", "east", "apartment", 8, None),
    ("north-ave-north", "North Avenue North", "NAN", "east", "apartment", 8, None),
    ("north-ave-south", "North Avenue South", "NAS", "east", "apartment", 8, None),
    ("north-ave-west", "North Avenue West", "NAW", "east", "apartment", 8, None),
]

NOTES = {
    "fulmer": "Fulmer is the traditional hall that houses undergraduate women.",
    "towers": "Traditional doubles, plus a few quads, just up the hill from Bobby Dodd.",
    "harris": "Suite-style rooms with a shared bath between the pair.",
    "woodruff-north": "Four-person suites on the west side, near Curran.",
    "woodruff-south": "Suites, including a handful of single-room suites.",
    "north-ave-east": "Apartment-style, across North Avenue from the east campus hill.",
    "graduate-living": "Apartments for graduate students on 10th Street.",
}

STYLE_SPECS = {
    "traditional": {
        "room": "Two-person room",
        "bath": "Community bath on the hall",
        "kitchen": "Shared floor kitchen",
        "guest_space": "Floor space or a spare bed when a roommate is away",
    },
    "suite": {
        "room": "Two bedrooms sharing a bath",
        "bath": "Private bath inside the suite",
        "kitchen": "Shared floor kitchen and lounge",
        "guest_space": "Suite common area or an open bedroom",
    },
    "apartment": {
        "room": "Two to four bedrooms with a living room",
        "bath": "One or two baths inside the apartment",
        "kitchen": "Full kitchen in the unit",
        "guest_space": "Living-room couch",
    },
}

CAMPUS_CENTER = {"lat": 33.7756, "lng": -84.3975}


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlng / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


def _units(style: str, floors: tuple[int, ...], per_floor: int) -> list[dict]:
    units = []
    for floor in floors:
        if style == "suite":
            for suite in range(1, per_floor + 1):
                for letter in ("A", "B"):
                    units.append({"id": f"{floor}{suite:02d}{letter}", "floor": floor, "suite": suite})
        else:
            for number in range(1, per_floor + 1):
                units.append({"id": f"{floor}{number:02d}", "floor": floor})
    return units


def _build() -> dict[str, dict]:
    dorms = {}
    for hall_id, name, code, campus, style, per_floor, floors in HALLS:
        osm = OSM[hall_id]
        if floors is None:
            floors = tuple(range(1, (osm.get("levels") or 4) + 1))
        dorms[hall_id] = {
            "id": hall_id,
            "name": name,
            "code": code,
            "campus": campus,
            "style": style,
            "lat": osm["lat"],
            "lng": osm["lng"],
            "floors": list(floors),
            "units_per_floor": per_floor if style != "suite" else per_floor * 2,
            "address": osm.get("address") or ("Georgia Tech West Campus" if campus == "west" else "Georgia Tech East Campus"),
            "note": NOTES.get(hall_id, ""),
            "osm_name": osm.get("name"),
            "osm": osm.get("osm"),
            "footprint": osm["footprint"],
            "specs": STYLE_SPECS[style],
            "units": _units(style, floors, per_floor),
        }
    return dorms


DORMS = _build()


def get_dorm(dorm_id: str) -> dict | None:
    return DORMS.get(dorm_id)


def find_unit(dorm_id: str, unit: str) -> dict | None:
    dorm = DORMS.get(dorm_id)
    if not dorm:
        return None
    return next((item for item in dorm["units"] if item["id"] == unit), None)


def public_dorm(dorm: dict) -> dict:
    keys = ("id", "name", "code", "campus", "style", "lat", "lng", "floors", "units_per_floor", "address", "note", "osm_name", "osm", "footprint", "specs")
    return {key: dorm[key] for key in keys}


def floor_plan(dorm_id: str, floor: int) -> dict[str, Any]:
    dorm = DORMS[dorm_id]
    units = [unit for unit in dorm["units"] if unit["floor"] == floor]
    style = dorm["style"]
    if style == "suite":
        return _suite_plan(units)
    if style == "apartment":
        return _apartment_plan(units)
    return _traditional_plan(units)


def _traditional_plan(units: list[dict]) -> dict:
    half = (len(units) + 1) // 2
    pad, gap = 28, 8
    width = 960
    inner = width - pad * 2
    room_w = (inner - gap * (half - 1)) / max(half, 1)
    room_h = 112
    top_y = 24
    hall_y = top_y + room_h + 14
    hall_h = 58
    bot_y = hall_y + hall_h + 14
    height = bot_y + room_h + 28
    rooms = []
    for index, unit in enumerate(units):
        row = 0 if index < half else 1
        col = index if row == 0 else index - half
        rooms.append(
            {
                "unit": unit["id"],
                "x": round(pad + col * (room_w + gap), 1),
                "y": top_y if row == 0 else bot_y,
                "w": round(room_w, 1),
                "h": room_h,
                "kind": "double",
            }
        )
    return {
        "style": "traditional",
        "viewBox": [0, 0, width, height],
        "hall": {"x": pad, "y": hall_y, "w": inner, "h": hall_h, "label": "Corridor"},
        "fixtures": [],
        "rooms": rooms,
    }


def _suite_plan(units: list[dict]) -> dict:
    suites: dict[int, list[dict]] = {}
    for unit in units:
        suites.setdefault(unit["suite"], []).append(unit)
    width, height = 960, 390
    rooms = []
    fixtures = []
    ordered = sorted(suites)
    block = 230
    for index, suite in enumerate(ordered):
        x0 = 16 + index * block
        pair = suites[suite]
        rooms.append({"unit": pair[0]["id"], "x": x0 + 8, "y": 36, "w": 128, "h": 150, "kind": "bedroom"})
        rooms.append({"unit": pair[1]["id"], "x": x0 + 8, "y": 210, "w": 128, "h": 150, "kind": "bedroom"})
        fixtures.append({"x": x0 + 144, "y": 140, "w": 70, "h": 100, "label": "Bath"})
        fixtures.append({"x": x0 + 8, "y": 8, "w": 200, "h": 22, "label": f"Suite {suite}"})
    return {
        "style": "suite",
        "viewBox": [0, 0, width, height],
        "hall": {"x": 16, "y": 192, "w": width - 32, "h": 14, "label": ""},
        "fixtures": fixtures,
        "rooms": rooms,
    }


def _apartment_plan(units: list[dict]) -> dict:
    cols = 2
    rows = math.ceil(len(units) / cols)
    width = 960
    room_w, room_h, gap_x, gap_y = 450, 118, 20, 14
    pad = 20
    height = pad * 2 + rows * room_h + (rows - 1) * gap_y
    rooms = []
    for index, unit in enumerate(units):
        col = index % cols
        row = index // cols
        rooms.append(
            {
                "unit": unit["id"],
                "x": pad + col * (room_w + gap_x),
                "y": pad + row * (room_h + gap_y),
                "w": room_w,
                "h": room_h,
                "kind": "apartment",
            }
        )
    return {
        "style": "apartment",
        "viewBox": [0, 0, width, height],
        "hall": None,
        "fixtures": [],
        "rooms": rooms,
    }


def maps_url(origin: dict, dest: dict) -> str:
    return (
        "https://www.google.com/maps/dir/?api=1"
        f"&origin={origin['lat']},{origin['lng']}"
        f"&destination={dest['lat']},{dest['lng']}"
        "&travelmode=walking"
    )


def walking_estimate(from_id: str, to_id: str) -> dict:
    """Straight-line distance with a campus detour factor. No network."""
    origin = DORMS[from_id]
    dest = DORMS[to_id]
    if from_id == to_id:
        return {
            "source": "estimate",
            "meters": 0,
            "minutes": 0,
            "steps": [f"You're already in {origin['name']}."],
            "points": [[origin["lat"], origin["lng"]]],
            "maps_url": maps_url(origin, dest),
        }
    meters = haversine(origin["lat"], origin["lng"], dest["lat"], dest["lng"]) * 1.3
    return {
        "source": "estimate",
        "meters": round(meters),
        "minutes": max(1, round(meters / 80)),
        "steps": [f"Leave {origin['name']}", f"Walk toward {dest['name']}", f"Arrive at {dest['name']}"],
        "points": [[origin["lat"], origin["lng"]], [dest["lat"], dest["lng"]]],
        "maps_url": maps_url(origin, dest),
        "note": "Straight-line estimate. Live walking directions weren't reachable.",
    }


# Ranking uses the offline estimate so search never waits on the network.
walking_route = walking_estimate


def map_payload() -> dict:
    return {
        "center": CAMPUS_CENTER,
        "dorms": [public_dorm(dorm) for dorm in DORMS.values()],
    }
