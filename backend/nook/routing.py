"""Room-to-room walking directions.

Outdoor legs come from a free routing server, no API key needed:

1. Valhalla pedestrian profile (VALHALLA_URL, default FOSSGIS public server).
   Follows walkways, stairs, and crosswalks.
2. OSRM (OSRM_URL, default the project demo server). The public server only
   has a car profile, so distance is used and time is recomputed at walking pace.
3. Straight-line estimate from dorms.py when nothing is reachable.

Indoor steps are added on both ends so a route reads as unit to unit.
"""

from __future__ import annotations

import os
import threading
import time

import requests

from .dorms import DORMS, find_unit, maps_url, walking_estimate

_cache: dict[tuple[str, str], tuple[float, dict]] = {}
_lock = threading.Lock()
CACHE_SECONDS = 60 * 60 * 6
WALK_METERS_PER_MINUTE = 80
UA = {"User-Agent": "dormsurf-campus/0.1 (student housing map)"}


def valhalla_url() -> str:
    return os.getenv("VALHALLA_URL", "https://valhalla1.openstreetmap.de").rstrip("/")


def osrm_url() -> str:
    return os.getenv("OSRM_URL", "https://router.project-osrm.org").rstrip("/")


def routing_enabled() -> bool:
    return os.getenv("LIVE_ROUTING", "1") != "0"


def _cached(key: tuple[str, str]) -> dict | None:
    with _lock:
        hit = _cache.get(key)
        if hit and time.time() - hit[0] < CACHE_SECONDS:
            return hit[1]
    return None


def _remember(key: tuple[str, str], value: dict) -> dict:
    with _lock:
        _cache[key] = (time.time(), value)
    return value


def decode_polyline(encoded: str, precision: int = 6) -> list[list[float]]:
    factor = 10**precision
    points: list[list[float]] = []
    index = lat = lng = 0
    while index < len(encoded):
        for which in ("lat", "lng"):
            shift = result = 0
            while True:
                byte = ord(encoded[index]) - 63
                index += 1
                result |= (byte & 0x1F) << shift
                shift += 5
                if byte < 0x20:
                    break
            delta = ~(result >> 1) if result & 1 else result >> 1
            if which == "lat":
                lat += delta
            else:
                lng += delta
        points.append([round(lat / factor, 6), round(lng / factor, 6)])
    return points


def _valhalla(origin: dict, dest: dict) -> dict | None:
    body = {
        "locations": [
            {"lat": origin["lat"], "lon": origin["lng"]},
            {"lat": dest["lat"], "lon": dest["lng"]},
        ],
        "costing": "pedestrian",
        "directions_options": {"units": "kilometers"},
    }
    try:
        response = requests.post(f"{valhalla_url()}/route", json=body, headers=UA, timeout=6)
        response.raise_for_status()
        trip = response.json()["trip"]
    except Exception as exc:
        print(f"Valhalla unavailable: {exc}")
        return None
    legs = trip.get("legs") or []
    if not legs:
        return None
    points: list[list[float]] = []
    steps: list[str] = []
    for leg in legs:
        points.extend(decode_polyline(leg.get("shape", "")))
        for maneuver in leg.get("maneuvers", []):
            text = (maneuver.get("instruction") or "").rstrip(".")
            meters = round((maneuver.get("length") or 0) * 1000)
            if maneuver.get("type") in (4, 5, 6):
                continue
            if meters < 25 and steps:
                continue
            steps.append(f"{text} ({meters} m)" if meters else text)
    summary = trip.get("summary") or {}
    meters = round((summary.get("length") or 0) * 1000)
    return {
        "source": "valhalla",
        "meters": meters,
        "minutes": max(1, round((summary.get("time") or meters / WALK_METERS_PER_MINUTE * 60) / 60)),
        "steps": steps,
        "points": points,
    }


def _osrm(origin: dict, dest: dict) -> dict | None:
    coords = f"{origin['lng']},{origin['lat']};{dest['lng']},{dest['lat']}"
    try:
        response = requests.get(
            f"{osrm_url()}/route/v1/foot/{coords}",
            params={"overview": "full", "geometries": "geojson", "steps": "true"},
            headers=UA,
            timeout=6,
        )
        response.raise_for_status()
        body = response.json()
    except Exception as exc:
        print(f"OSRM unavailable: {exc}")
        return None
    if body.get("code") != "Ok" or not body.get("routes"):
        return None
    route = body["routes"][0]
    points = [[round(lat, 6), round(lng, 6)] for lng, lat in route["geometry"]["coordinates"]]
    steps = []
    for leg in route.get("legs", []):
        for step in leg.get("steps", []):
            text = _describe_osrm(step)
            if text and (not steps or steps[-1] != text):
                steps.append(text)
    meters = round(route["distance"])
    return {
        "source": "osrm",
        "meters": meters,
        "minutes": max(1, round(meters / WALK_METERS_PER_MINUTE)),
        "steps": steps,
        "points": points,
    }


def _describe_osrm(step: dict) -> str:
    maneuver = step.get("maneuver") or {}
    kind = maneuver.get("type")
    modifier = (maneuver.get("modifier") or "").replace("slight ", "").strip()
    name = (step.get("name") or "").strip()
    meters = round(step.get("distance") or 0)
    tail = f" ({meters} m)" if meters else ""
    if kind == "depart":
        return f"Head {_compass(maneuver.get('bearing_after'))}{' on ' + name if name else ''}{tail}"
    if kind == "arrive":
        return ""
    if modifier in ("left", "right"):
        return f"Turn {modifier}{' onto ' + name if name else ''}{tail}"
    if modifier in ("sharp left", "sharp right"):
        return f"Make a {modifier}{' onto ' + name if name else ''}{tail}"
    if modifier == "uturn":
        return f"Turn around{' onto ' + name if name else ''}"
    return f"Continue{' on ' + name if name else ''}{tail}"


def _compass(bearing: float | None) -> str:
    if bearing is None:
        return "out"
    names = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"]
    return names[int(((bearing % 360) + 22.5) // 45) % 8]


def outdoor_route(origin: dict, dest: dict) -> dict:
    if origin["id"] == dest["id"]:
        return walking_estimate(origin["id"], dest["id"])
    key = (origin["id"], dest["id"])
    hit = _cached(key)
    if hit:
        return hit
    if routing_enabled():
        result = _valhalla(origin, dest) or _osrm(origin, dest)
        if result:
            return _remember(key, result)
    return walking_estimate(origin["id"], dest["id"])


def room_route(from_id: str, to_id: str, from_unit: str | None = None, to_unit: str | None = None) -> dict:
    origin = DORMS[from_id]
    dest = DORMS[to_id]
    outdoor = outdoor_route(origin, dest)
    from_room = find_unit(from_id, from_unit) if from_unit else None
    to_room = find_unit(to_id, to_unit) if to_unit else None

    steps: list[str] = []
    indoor_minutes = 0
    if from_id == to_id:
        if from_room and to_room:
            steps.append(
                f"Stay in {origin['name']}: go from {from_room['id']} on floor {from_room['floor']} "
                f"to {to_room['id']} on floor {to_room['floor']}"
            )
            indoor_minutes = 2 if from_room["floor"] != to_room["floor"] else 1
        else:
            steps.append(f"You're already in {origin['name']}.")
    else:
        if from_room:
            steps.append(f"Leave {origin['name']} {from_room['id']} on floor {from_room['floor']} and head down to the entrance")
            indoor_minutes += 1
        else:
            steps.append(f"Leave {origin['name']}")
        steps.extend(outdoor["steps"] if outdoor["source"] != "estimate" else outdoor["steps"][1:-1])
        steps.append(f"Enter {dest['name']}" + (f", {dest['address']}" if dest.get("address") else ""))
        if to_room:
            steps.append(f"Go up to floor {to_room['floor']} and find unit {to_room['id']}")
            indoor_minutes += 1
        else:
            steps.append(f"Arrive at {dest['name']}")

    return {
        "source": outdoor["source"],
        "meters": outdoor["meters"],
        "minutes": outdoor["minutes"] + indoor_minutes,
        "walk_minutes": outdoor["minutes"],
        "steps": steps,
        "points": outdoor["points"],
        "maps_url": maps_url(origin, dest),
        "note": outdoor.get("note", ""),
        "from": _endpoint(origin, from_room),
        "to": _endpoint(dest, to_room),
    }


def _endpoint(dorm: dict, room: dict | None) -> dict:
    return {
        "dorm_id": dorm["id"],
        "dorm_name": dorm["name"],
        "unit": room["id"] if room else None,
        "floor": room["floor"] if room else None,
        "lat": dorm["lat"],
        "lng": dorm["lng"],
    }
