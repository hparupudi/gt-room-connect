"""Georgia Tech undergrad residence halls, original floor diagrams, and walking routes.

Floor diagrams are schematic layouts for this app, not copies of official
housing floor plans. Coordinates are approximate campus positions so the
map and walking estimates agree.
"""

from __future__ import annotations

import math
from typing import Any

BOUNDS = {"north": 33.7838, "south": 33.7694, "west": -84.4098, "east": -84.3886}

# id, name, code, campus, style, lat, lng, floors, per_floor, address
HALLS: list[tuple] = [
    ("glenn", "Glenn", "GLN", "east", "traditional", 33.7768, -84.3925, (1, 2, 3, 4), 16, "118 Bobby Dodd Way"),
    ("field", "Field", "FLD", "east", "traditional", 33.7775, -84.3915, (1, 2, 3, 4), 16, "711 Techwood Dr NW"),
    ("hopkins", "Hopkins", "HOP", "east", "traditional", 33.7779, -84.3930, (1, 2, 3, 4), 16, "Techwood Dr NW"),
    ("matheson", "Matheson", "MAT", "east", "traditional", 33.7771, -84.3935, (1, 2, 3, 4), 12, "Fowler St"),
    ("perry", "Perry", "PRY", "east", "traditional", 33.7785, -84.3917, (1, 2, 3, 4), 12, "Techwood Dr NW"),
    ("hanson", "Hanson", "HAN", "east", "traditional", 33.7783, -84.3907, (1, 2, 3, 4), 12, "Techwood Dr NW"),
    ("harrison", "Harrison", "HAR", "east", "traditional", 33.7789, -84.3903, (1, 2, 3, 4), 12, "Techwood Dr NW"),
    ("howell", "Howell", "HOW", "east", "traditional", 33.7793, -84.3911, (1, 2, 3, 4), 12, "Techwood Dr NW"),
    ("towers", "Towers", "TWR", "east", "traditional", 33.7778, -84.3921, (1, 2, 3, 4), 12, "112 Bobby Dodd Way"),
    ("cloudman", "Cloudman", "CLD", "east", "traditional", 33.7763, -84.3939, (1, 2, 3, 4), 12, "Bobby Dodd Way"),
    ("harris", "Harris", "HRS", "east", "suite", 33.7757, -84.3945, (1, 2, 3, 4), 4, "Fowler St"),
    ("armstrong", "Armstrong", "ARM", "west", "traditional", 33.7803, -84.4074, (1, 2, 3), 12, "Hemphill Ave"),
    ("caldwell", "Caldwell", "CAL", "west", "traditional", 33.7811, -84.4066, (1, 2, 3), 12, "Hemphill Ave"),
    ("folk", "Folk", "FLK", "west", "traditional", 33.7813, -84.4054, (1, 2, 3), 12, "6th St"),
    ("fitten", "Fitten", "FIT", "west", "traditional", 33.7805, -84.4036, (1, 2, 3, 4), 12, "Hemphill Ave"),
    ("freeman", "Freeman", "FRE", "west", "traditional", 33.7809, -84.4046, (1, 2, 3, 4), 12, "Hemphill Ave"),
    ("fulmer", "Fulmer", "FUL", "west", "traditional", 33.7816, -84.4032, (1, 2, 3), 12, "Hemphill Ave"),
    ("hefner", "Hefner", "HEF", "west", "traditional", 33.7797, -84.4078, (1, 2, 3), 12, "6th St"),
    ("montag", "Montag", "MON", "west", "traditional", 33.7815, -84.4048, (1, 2, 3), 12, "Hemphill Ave"),
    ("woodruff-north", "Woodruff North", "WDN", "west", "suite", 33.7804, -84.4062, (1, 2, 3, 4, 5), 4, "890 Curran St NW"),
    ("woodruff-south", "Woodruff South", "WDS", "west", "suite", 33.7797, -84.4056, (1, 2, 3, 4, 5), 4, "Curran St NW"),
    ("crecine", "Crecine", "CRE", "west", "apartment", 33.7786, -84.4024, (1, 2, 3, 4), 8, "Hemphill Ave"),
    ("eighth-east", "Eighth Street East", "8E", "west", "apartment", 33.7788, -84.4036, (1, 2, 3, 4), 8, "8th St"),
    ("eighth-west", "Eighth Street West", "8W", "west", "apartment", 33.7791, -84.4052, (1, 2, 3, 4), 8, "8th St"),
    ("eighth-south", "Eighth Street South", "8S", "west", "apartment", 33.7782, -84.4044, (1, 2, 3, 4), 8, "8th St"),
    ("center-north", "Center Street North", "CSN", "west", "apartment", 33.7772, -84.4046, (2, 3, 4, 5), 8, "Center St"),
    ("center-south", "Center Street South", "CSS", "west", "apartment", 33.7764, -84.4042, (2, 3, 4, 5), 8, "Center St"),
    ("maulding", "Maulding", "MAU", "west", "apartment", 33.7758, -84.4062, (2, 3, 4, 5, 6), 8, "10th St"),
    ("nelson-shell", "Nelson Shell", "NSH", "west", "apartment", 33.7752, -84.4050, (2, 3, 4, 5), 8, "Ferst Dr"),
    ("zbar", "Zbar", "ZBR", "west", "apartment", 33.7776, -84.4076, (1, 2, 3, 4), 6, "Hemphill Ave"),
    ("graduate-living", "Graduate Living Center", "GLC", "west", "apartment", 33.7822, -84.3990, (1, 2, 3, 4, 5), 8, "10th St"),
    ("north-ave-east", "North Avenue East", "NAE", "east", "apartment", 33.7709, -84.3906, (3, 4, 5, 6, 7, 8), 8, "North Ave NE"),
    ("north-ave-north", "North Avenue North", "NAN", "east", "apartment", 33.7714, -84.3916, (3, 4, 5, 6, 7, 8), 8, "North Ave NW"),
    ("north-ave-south", "North Avenue South", "NAS", "east", "apartment", 33.7706, -84.3924, (3, 4, 5, 6, 7), 8, "North Ave NW"),
    ("north-ave-west", "North Avenue West", "NAW", "east", "apartment", 33.7712, -84.3934, (3, 4, 5, 6, 7, 8), 8, "North Ave NW"),
]

NOTES = {
    "fulmer": "Fulmer is the traditional hall that houses undergraduate women.",
    "towers": "Traditional doubles, plus a few quads, just up the hill from Bobby Dodd.",
    "harris": "Suite-style rooms with a shared bath between the pair.",
    "woodruff-north": "Four-person suites on the west side, near Curran.",
    "woodruff-south": "Suites, including a handful of single-room suites.",
    "north-ave-east": "Apartment-style, across North Avenue from the east campus hill.",
}

LANDMARKS = [
    {"id": "tech-tower", "name": "Tech Tower", "lat": 33.7726, "lng": -84.3949},
    {"id": "bobby-dodd", "name": "Bobby Dodd", "lat": 33.7725, "lng": -84.3928},
    {"id": "clough", "name": "Clough", "lat": 33.7749, "lng": -84.3964},
    {"id": "crc", "name": "CRC", "lat": 33.7756, "lng": -84.4038},
    {"id": "student-center", "name": "Student Center", "lat": 33.7738, "lng": -84.3986},
    {"id": "north-ave-dining", "name": "North Ave Dining", "lat": 33.7715, "lng": -84.3918},
]

HUBS = {
    "east": {"id": "east", "name": "East Campus", "lat": 33.7776, "lng": -84.3924},
    "west": {"id": "west", "name": "West Campus", "lat": 33.7794, "lng": -84.4050},
    "central": {"id": "central", "name": "Clough Commons", "lat": 33.7752, "lng": -84.3972},
    "north": {"id": "north", "name": "North Avenue", "lat": 33.7711, "lng": -84.3920},
}

HUB_EDGES = [
    ("east", "central"),
    ("central", "west"),
    ("east", "north"),
    ("central", "north"),
]


def project(lat: float, lng: float) -> tuple[float, float]:
    x = (lng - BOUNDS["west"]) / (BOUNDS["east"] - BOUNDS["west"]) * 100
    y = (BOUNDS["north"] - lat) / (BOUNDS["north"] - BOUNDS["south"]) * 100
    return round(x, 2), round(y, 2)


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
    for item in HALLS:
        hall_id, name, code, campus, style, lat, lng, floors, per_floor, address = item
        x, y = project(lat, lng)
        dorms[hall_id] = {
            "id": hall_id,
            "name": name,
            "code": code,
            "campus": campus,
            "style": style,
            "lat": lat,
            "lng": lng,
            "x": x,
            "y": y,
            "floors": list(floors),
            "address": address,
            "note": NOTES.get(hall_id, ""),
            "units": _units(style, floors, per_floor),
        }
    return dorms


DORMS = _build()


def get_dorm(dorm_id: str) -> dict | None:
    return DORMS.get(dorm_id)


def public_dorm(dorm: dict) -> dict:
    return {key: dorm[key] for key in ("id", "name", "code", "campus", "style", "lat", "lng", "x", "y", "floors", "address", "note")}


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


def _nearest_hub(lat: float, lng: float) -> str:
    return min(HUBS, key=lambda hub: haversine(lat, lng, HUBS[hub]["lat"], HUBS[hub]["lng"]))


def _hub_path(start: str, end: str) -> list[str]:
    if start == end:
        return [start]
    graph: dict[str, list[tuple[str, float]]] = {hub: [] for hub in HUBS}
    for a, b in HUB_EDGES:
        dist = haversine(HUBS[a]["lat"], HUBS[a]["lng"], HUBS[b]["lat"], HUBS[b]["lng"])
        graph[a].append((b, dist))
        graph[b].append((a, dist))
    dist_map = {hub: math.inf for hub in HUBS}
    prev: dict[str, str | None] = {hub: None for hub in HUBS}
    dist_map[start] = 0
    left = set(HUBS)
    while left:
        current = min(left, key=lambda hub: dist_map[hub])
        left.remove(current)
        if current == end:
            break
        for nxt, weight in graph[current]:
            alt = dist_map[current] + weight
            if alt < dist_map[nxt]:
                dist_map[nxt] = alt
                prev[nxt] = current
    path = [end]
    while path[-1] != start:
        parent = prev[path[-1]]
        if parent is None:
            return [start, end]
        path.append(parent)
    path.reverse()
    return path


def walking_route(from_id: str, to_id: str) -> dict:
    origin = DORMS[from_id]
    dest = DORMS[to_id]
    if from_id == to_id:
        point = {"lat": origin["lat"], "lng": origin["lng"], "x": origin["x"], "y": origin["y"], "label": origin["name"]}
        return {"meters": 0, "minutes": 0, "steps": [f"You're already at {origin['name']}."], "points": [point], "maps_url": _maps_url(origin, dest)}

    start_hub = _nearest_hub(origin["lat"], origin["lng"])
    end_hub = _nearest_hub(dest["lat"], dest["lng"])
    hubs = _hub_path(start_hub, end_hub)
    points = [{"lat": origin["lat"], "lng": origin["lng"], "x": origin["x"], "y": origin["y"], "label": origin["name"]}]
    for hub_id in hubs:
        hub = HUBS[hub_id]
        x, y = project(hub["lat"], hub["lng"])
        points.append({"lat": hub["lat"], "lng": hub["lng"], "x": x, "y": y, "label": hub["name"]})
    points.append({"lat": dest["lat"], "lng": dest["lng"], "x": dest["x"], "y": dest["y"], "label": dest["name"]})

    meters = 0.0
    for a, b in zip(points, points[1:]):
        meters += haversine(a["lat"], a["lng"], b["lat"], b["lng"])
    minutes = max(1, round(meters / 80))
    via = [HUBS[hub]["name"] for hub in hubs]
    steps = [f"Leave {origin['name']}"]
    if via:
        steps.append("Walk via " + " → ".join(via))
    steps.append(f"Arrive at {dest['name']}")
    return {
        "meters": round(meters),
        "minutes": minutes,
        "steps": steps,
        "points": points,
        "maps_url": _maps_url(origin, dest),
        "note": "Walking estimate along campus hubs, not a turn-by-turn GPS trace.",
    }


def _maps_url(origin: dict, dest: dict) -> str:
    return (
        "https://www.google.com/maps/dir/?api=1"
        f"&origin={origin['lat']},{origin['lng']}"
        f"&destination={dest['lat']},{dest['lng']}"
        "&travelmode=walking"
    )


def map_payload() -> dict:
    landmarks = []
    for item in LANDMARKS:
        x, y = project(item["lat"], item["lng"])
        landmarks.append({**item, "x": x, "y": y})
    hubs = []
    for hub in HUBS.values():
        x, y = project(hub["lat"], hub["lng"])
        hubs.append({**hub, "x": x, "y": y})
    return {
        "bounds": BOUNDS,
        "landmarks": landmarks,
        "hubs": hubs,
        "dorms": [public_dorm(dorm) for dorm in DORMS.values()],
    }
