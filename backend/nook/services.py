"""Profiles, search, and bookings."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

from .constants import GENDERS, MAJORS, SLEEP, STYLES, YEAR_LABELS, YEARS
from .db import get_db
from .dorms import DORMS, floor_plan, get_dorm, map_payload, public_dorm, walking_route
from .embed import normalize
from .errors import ApiError
from .models import LifestyleProfile
from .rank import order_scored, score_pair
from .vectors import fetch_vectors, upsert_vector

GENDER_IDS = {item["id"] for item in GENDERS}
SLEEP_IDS = {item["id"] for item in SLEEP}
STYLE_IDS = {item["id"] for item in STYLES}
YEAR_IDS = set(YEAR_LABELS)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def today() -> date:
    return date.today()


def parse_dates(values: list[str], require: bool = True) -> list[str]:
    if require and not values:
        raise ApiError("Pick at least one date. That's how Nook knows which couch is free.")
    cleaned = []
    for value in values:
        try:
            parsed = date.fromisoformat(value)
        except ValueError as exc:
            raise ApiError("Dates need to look like YYYY-MM-DD.") from exc
        if parsed < today():
            raise ApiError("Dates need to be today or later.")
        if parsed > today() + timedelta(days=120):
            raise ApiError("Nook only books the next four months.")
        iso = parsed.isoformat()
        if iso not in cleaned:
            cleaned.append(iso)
    return cleaned


def _style_label(style: str | None) -> str:
    return {"traditional": "Traditional", "suite": "Suite", "apartment": "Apartment"}.get(style or "", "")


def tag_list(user: dict, extras: list[str] | None = None) -> list[str]:
    life = user.get("lifestyle") or {}
    dorm = get_dorm(user.get("dorm_id") or "") or {}
    gender = user.get("gender")
    items: list[str] = []
    for tag in [
        YEAR_LABELS.get(user.get("year"), ""),
        gender if gender and gender != "undisclosed" else "",
        user.get("major") or "",
        _style_label(dorm.get("style")),
        life.get("cleanliness") or "",
        life.get("sleep_timing") or "",
        *(extras or []),
        *(life.get("interests") or []),
    ]:
        if tag and tag not in items:
            items.append(str(tag))
    return items[:12]


def matched(viewer_id: str | None, other_id: str) -> bool:
    if not viewer_id or viewer_id == other_id:
        return False
    for booking in get_db().find_all("bookings"):
        if booking.get("status") != "accepted":
            continue
        pair = {booking.get("guest_id"), booking.get("host_id")}
        if viewer_id in pair and other_id in pair:
            return True
    return False


def serialize_user(user: dict, viewer_id: str | None = None, force_socials: bool = False) -> dict:
    life = user.get("lifestyle") or {}
    dorm = get_dorm(user.get("dorm_id") or "") or {}
    show_socials = force_socials or (viewer_id == user.get("id")) or matched(viewer_id, user.get("id"))
    payload = {
        "id": user.get("id"),
        "name": user.get("name"),
        "gender": user.get("gender"),
        "age": user.get("age"),
        "major": user.get("major"),
        "year": user.get("year"),
        "year_label": YEAR_LABELS.get(user.get("year"), ""),
        "hometown": user.get("hometown"),
        "dorm_id": user.get("dorm_id"),
        "dorm_name": dorm.get("name"),
        "dorm_code": dorm.get("code"),
        "floor": user.get("floor"),
        "unit": user.get("unit"),
        "style": dorm.get("style"),
        "campus": dorm.get("campus"),
        "address": dorm.get("address"),
        "open_dates": user.get("open_dates") or [],
        "bio": life.get("bio") or "",
        "tags": life.get("tags") or [],
        "interests": life.get("interests") or [],
        "hobbies": life.get("hobbies") or [],
        "cleanliness": life.get("cleanliness"),
        "sleep_timing": life.get("sleep_timing"),
        "sleep_start": life.get("sleep_start"),
        "wake_time": life.get("wake_time"),
        "noise": life.get("noise"),
        "guest_notes": life.get("guest_notes") or "",
        "onboarding_complete": bool(user.get("onboarding_complete")),
        "onboarding_step": onboarding_step(user),
        "embedding_model": user.get("embedding_model"),
        "socials_visible": show_socials,
    }
    if show_socials:
        payload["socials"] = user.get("socials") or {"instagram": "", "phone": "", "discord": ""}
    if viewer_id == user.get("id"):
        payload["email"] = user.get("email")
        payload["transcript"] = user.get("transcript") or ""
    return payload


def onboarding_step(user: dict) -> str:
    if not user.get("dorm_id") or not user.get("unit"):
        return "room"
    if not user.get("name") or not user.get("major") or not user.get("year"):
        return "about"
    if not user.get("lifestyle"):
        return "voice"
    return "done"


def store_embedding(user: dict, vector: list[float], model: str) -> dict:
    vector = normalize(vector)
    dorm = get_dorm(user.get("dorm_id") or "") or {}
    upsert_vector(
        user["id"],
        vector,
        {
            "name": user.get("name") or "",
            "major": user.get("major") or "",
            "year": user.get("year") or "",
            "gender": user.get("gender") or "",
            "dorm_id": user.get("dorm_id") or "",
            "style": dorm.get("style") or "",
            "sleep": (user.get("lifestyle") or {}).get("sleep_timing") or "",
            "cleanliness": (user.get("lifestyle") or {}).get("cleanliness") or "",
        },
    )
    return {"embedding": vector, "embedding_model": model}


def apply_lifestyle(user: dict, profile: LifestyleProfile, model: str, transcript: str) -> dict:
    lifestyle = profile.model_dump()
    axes = lifestyle.pop("axes")
    user = {**user, "lifestyle": lifestyle, "transcript": transcript}
    lifestyle["tags"] = tag_list(user, lifestyle.get("tags") or [])
    patch = {
        "lifestyle": lifestyle,
        "transcript": transcript,
        "onboarding_complete": bool(user.get("dorm_id") and user.get("name")),
        **store_embedding({**user, "lifestyle": lifestyle}, list(axes.values()) if isinstance(axes, dict) else profile.axes.as_vector(), model),
    }
    # store_embedding used lifestyle sleep from user; axes vector is explicit
    vector = normalize(profile.axes.as_vector())
    patch["embedding"] = vector
    patch["embedding_model"] = model
    store_embedding({**user, "lifestyle": lifestyle}, vector, model)
    return patch


def keyword_match(user: dict, query: str) -> bool:
    if not query.strip():
        return True
    dorm = get_dorm(user.get("dorm_id") or "") or {}
    life = user.get("lifestyle") or {}
    haystack = " ".join(
        [
            user.get("name") or "",
            user.get("major") or "",
            user.get("hometown") or "",
            user.get("unit") or "",
            dorm.get("name") or "",
            dorm.get("code") or "",
            dorm.get("id") or "",
            life.get("bio") or "",
            " ".join(life.get("interests") or []),
            " ".join(life.get("hobbies") or []),
            " ".join(life.get("tags") or []),
        ]
    ).lower()
    return all(token in haystack for token in query.lower().split())


def _allowed(selected: list, universe: set | None = None) -> list:
    if not selected:
        return []
    if universe and set(selected) >= universe:
        return []
    return selected


def search(seeker: dict, body: dict) -> dict:
    dates = parse_dates(body.get("dates") or [])
    query = (body.get("query") or "").strip()
    sleep = _allowed(body.get("sleep") or [], SLEEP_IDS)
    cleanliness = _allowed(body.get("cleanliness") or [], {"spotless", "tidy", "average", "relaxed", "messy"})
    years = _allowed(body.get("years") or [], YEAR_IDS)
    majors = _allowed(body.get("majors") or [], set(MAJORS))
    genders = _allowed(body.get("genders") or [], GENDER_IDS)
    floors = [int(item) for item in body.get("floors") or []]
    styles = _allowed(body.get("styles") or [], STYLE_IDS)
    mode = body.get("sort") or "match"
    if mode not in ("match", "distance"):
        raise ApiError("Sort by match or distance.")
    page = max(1, int(body.get("page") or 1))
    page_size = min(12, max(1, int(body.get("page_size") or 6)))

    hosts = []
    for user in get_db().find_all("users"):
        if user["id"] == seeker["id"] or not user.get("onboarding_complete"):
            continue
        if not set(dates).issubset(set(user.get("open_dates") or [])):
            continue
        life = user.get("lifestyle") or {}
        if sleep and life.get("sleep_timing") not in sleep:
            continue
        if cleanliness and life.get("cleanliness") not in cleanliness:
            continue
        if years and user.get("year") not in years:
            continue
        if majors and user.get("major") not in majors:
            continue
        if genders and user.get("gender") not in genders:
            continue
        if floors and user.get("floor") not in floors:
            continue
        dorm = get_dorm(user.get("dorm_id") or "") or {}
        if styles and dorm.get("style") not in styles:
            continue
        if not keyword_match(user, query):
            continue
        hosts.append(user)

    vectors = {seeker["id"]: seeker.get("embedding") or []}
    remote = fetch_vectors([host["id"] for host in hosts])
    for host in hosts:
        vectors[host["id"]] = remote.get(host["id"]) or host.get("embedding") or []

    scored = []
    for host in hosts:
        scored.append({"host": host, **score_pair(seeker, host, vectors)})
    scored = order_scored(scored, mode)

    ranker = "local-lifestyle-v1"
    if mode == "match":
        from .muse import match_sentence, muse_configured, muse_rerank

        if muse_configured() and len(scored) == 1:
            sentence, model = match_sentence(seeker, scored[0]["host"])
            scored[0]["reason"] = sentence
            scored[0]["reason_model"] = model
            if model == "muse-spark-1.3":
                ranker = model
        elif muse_configured() and len(scored) > 1:
            head = scored[:12]
            try:
                ranking = muse_rerank(seeker, [item["host"] for item in head])
                by_id = {item["host"]["id"]: item for item in head}
                reranked = []
                seen = set()
                for row in ranking.rankings:
                    item = by_id.get(row.user_id)
                    if not item or row.user_id in seen:
                        continue
                    item["reason"] = " ".join((row.reason or "").split())
                    if item["reason"] and item["reason"][-1] not in ".!?":
                        item["reason"] += "."
                    item["reason_model"] = "muse-spark-1.3"
                    item["local"] = float(row.score)
                    reranked.append(item)
                    seen.add(row.user_id)
                for item in head:
                    if item["host"]["id"] not in seen:
                        reranked.append(item)
                scored = reranked + scored[12:]
                ranker = "muse-spark-1.3"
            except Exception as exc:
                print(f"Muse rerank failed, keeping lifestyle order: {exc}")

    total = len(scored)
    start = (page - 1) * page_size
    page_items = scored[start : start + page_size]
    results = []
    for item in page_items:
        results.append(
            {
                "host": serialize_user(item["host"], seeker["id"]),
                "scores": {
                    "cosine": round(item["cosine"], 3),
                    "match": round(item["local"], 3),
                    "meters": item["meters"],
                    "minutes": item["minutes"],
                    "reason": item["reason"],
                    "reason_model": item.get("reason_model") or "local-lifestyle-v1",
                },
            }
        )
    return {
        "results": results,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, (total + page_size - 1) // page_size),
        "sort": mode,
        "ranker": ranker,
        "dates": dates,
    }


def _residents() -> dict[tuple[str, str], list[dict]]:
    grouped: dict[tuple[str, str], list[dict]] = {}
    for user in get_db().find_all("users"):
        if user.get("dorm_id") and user.get("unit") and user.get("onboarding_complete"):
            grouped.setdefault((user["dorm_id"], user["unit"]), []).append(user)
    return grouped


def _pending_for(host_id: str, dates: list[str]) -> bool:
    wanted = set(dates)
    for booking in get_db().find_all("bookings"):
        if booking.get("host_id") == host_id and booking.get("status") == "pending":
            if not wanted or wanted.intersection(booking.get("dates") or []):
                return True
    return False


def unit_view(residents: list[dict], viewer_id: str | None, dates: list[str]) -> dict:
    hosts = []
    yours = False
    for resident in residents:
        if resident["id"] == viewer_id:
            yours = True
        open_dates = set(resident.get("open_dates") or [])
        if dates:
            if not set(dates).issubset(open_dates):
                continue
            shown = dates
        else:
            shown = sorted(day for day in open_dates if day >= today().isoformat())
            if not shown:
                continue
        life = resident.get("lifestyle") or {}
        hosts.append(
            {
                "id": resident["id"],
                "name": resident.get("name"),
                "open_dates": shown,
                "sleep_timing": life.get("sleep_timing"),
                "cleanliness": life.get("cleanliness"),
                "pending": _pending_for(resident["id"], shown),
            }
        )
    if yours and not hosts:
        status = "yours"
    elif any(not host["pending"] for host in hosts):
        status = "open"
    elif hosts:
        status = "pending"
    elif yours:
        status = "yours"
    else:
        status = "idle"
    if yours and status == "open":
        status = "yours"
    return {"status": status, "hosting": bool(hosts) or yours and bool(hosts), "hosts": hosts, "yours": yours}


def dorm_detail(dorm_id: str, viewer: dict | None, dates: list[str]) -> dict:
    dorm = get_dorm(dorm_id)
    if not dorm:
        raise ApiError("That hall isn't on the Nook map.", 404)
    grouped = _residents()
    floors = []
    open_units = 0
    for floor in dorm["floors"]:
        plan = floor_plan(dorm_id, floor)
        floor_open = 0
        for room in plan["rooms"]:
            residents = grouped.get((dorm_id, room["unit"]), [])
            view = unit_view(residents, viewer["id"] if viewer else None, dates)
            room.update(view)
            if view["status"] in ("open", "pending", "yours") and view["hosts"]:
                floor_open += 1
        open_units += floor_open
        floors.append({"floor": floor, "open_units": floor_open, **plan})
    payload = public_dorm(dorm)
    payload["open_units"] = open_units
    payload["floors"] = floors
    if viewer and viewer.get("dorm_id"):
        payload["directions"] = walking_route(viewer["dorm_id"], dorm_id)
    return payload


def map_overview(viewer: dict | None, dates: list[str]) -> dict:
    grouped = _residents()
    payload = map_payload()
    for dorm in payload["dorms"]:
        full = DORMS[dorm["id"]]
        open_units = 0
        yours = False
        for unit in full["units"]:
            residents = grouped.get((dorm["id"], unit["id"]), [])
            view = unit_view(residents, viewer["id"] if viewer else None, dates)
            if view["yours"]:
                yours = True
            if view["hosts"]:
                open_units += 1
        dorm["open_units"] = open_units
        dorm["yours"] = yours
    if viewer and viewer.get("dorm_id"):
        payload["home"] = viewer["dorm_id"]
    return payload


def create_booking(guest: dict, host_id: str, dates: list[str], message: str) -> dict:
    if not guest.get("onboarding_complete"):
        raise ApiError("Finish your profile before requesting a couch.")
    if guest["id"] == host_id:
        raise ApiError("You already live there.")
    host = get_db().find_one("users", id=host_id)
    if not host or not host.get("onboarding_complete"):
        raise ApiError("That couch isn't available.", 404)
    dates = parse_dates(dates)
    if not set(dates).issubset(set(host.get("open_dates") or [])):
        raise ApiError("Those nights aren't open. Pick from the dates on their card.")
    message = (message or "").strip()
    if len(message) > 400:
        raise ApiError("Keep the note under 400 characters.")
    for booking in get_db().find_all("bookings"):
        if booking.get("guest_id") != guest["id"]:
            continue
        if booking.get("status") in ("pending", "accepted") and set(booking.get("dates") or []).intersection(dates):
            raise ApiError("You already have a request covering one of those nights.")
    vectors = {
        guest["id"]: guest.get("embedding") or [],
        host["id"]: host.get("embedding") or [],
    }
    scores = score_pair(guest, host, vectors)
    from .muse import match_sentence

    sentence, reason_model = match_sentence(guest, host)
    booking = {
        "id": uuid.uuid4().hex,
        "guest_id": guest["id"],
        "host_id": host["id"],
        "dorm_id": host.get("dorm_id"),
        "unit": host.get("unit"),
        "dates": dates,
        "status": "pending",
        "message": message,
        "match": round(scores["local"], 3),
        "minutes": scores["minutes"],
        "reason": sentence,
        "reason_model": reason_model,
        "created_at": now_iso(),
    }
    get_db().insert("bookings", booking)
    return serialize_booking(booking, guest["id"])


def serialize_booking(booking: dict, viewer_id: str) -> dict:
    db = get_db()
    guest = db.find_one("users", id=booking["guest_id"])
    host = db.find_one("users", id=booking["host_id"])
    accepted = booking.get("status") == "accepted"
    return {
        "id": booking["id"],
        "status": booking["status"],
        "dates": booking.get("dates") or [],
        "message": booking.get("message") or "",
        "match": booking.get("match"),
        "minutes": booking.get("minutes"),
        "reason": booking.get("reason") or "",
        "reason_model": booking.get("reason_model") or "local-lifestyle-v1",
        "decline_reason": booking.get("decline_reason") or "",
        "created_at": booking.get("created_at"),
        "guest": serialize_user(guest, viewer_id, force_socials=accepted) if guest else None,
        "host": serialize_user(host, viewer_id, force_socials=accepted) if host else None,
        "role": "host" if viewer_id == booking.get("host_id") else "guest",
    }


def list_bookings(user_id: str, direction: str) -> list[dict]:
    rows = []
    for booking in get_db().find_all("bookings"):
        if direction == "incoming" and booking.get("host_id") == user_id:
            rows.append(booking)
        elif direction == "outgoing" and booking.get("guest_id") == user_id:
            rows.append(booking)
    rows.sort(key=lambda item: item.get("created_at") or "", reverse=True)
    return [serialize_booking(item, user_id) for item in rows]


def get_booking(booking_id: str, viewer_id: str) -> dict:
    booking = get_db().find_one("bookings", id=booking_id)
    if not booking:
        raise ApiError("That request doesn't exist.", 404)
    if viewer_id not in (booking.get("guest_id"), booking.get("host_id")):
        raise ApiError("That request isn't yours.", 403)
    return serialize_booking(booking, viewer_id)


def accept_booking(host: dict, booking_id: str) -> dict:
    db = get_db()
    booking = db.find_one("bookings", id=booking_id)
    if not booking or booking.get("host_id") != host["id"]:
        raise ApiError("That request isn't yours to review.", 404)
    if booking.get("status") != "pending":
        raise ApiError("That request has already been reviewed.")
    dates = set(booking.get("dates") or [])
    open_dates = set(host.get("open_dates") or [])
    if not dates.issubset(open_dates):
        raise ApiError("Those nights aren't open anymore.")
    db.update("users", host["id"], {"open_dates": sorted(open_dates - dates)})
    db.update(
        "bookings",
        booking_id,
        {"status": "accepted", "responded_at": now_iso()},
    )
    for other in db.find_all("bookings"):
        if other["id"] == booking_id or other.get("host_id") != host["id"] or other.get("status") != "pending":
            continue
        if dates.intersection(other.get("dates") or []):
            db.update(
                "bookings",
                other["id"],
                {
                    "status": "declined",
                    "decline_reason": "Those nights were just booked.",
                    "responded_at": now_iso(),
                },
            )
    fresh = db.find_one("bookings", id=booking_id)
    return serialize_booking(fresh, host["id"])


def decline_booking(host: dict, booking_id: str) -> dict:
    db = get_db()
    booking = db.find_one("bookings", id=booking_id)
    if not booking or booking.get("host_id") != host["id"]:
        raise ApiError("That request isn't yours to review.", 404)
    if booking.get("status") != "pending":
        raise ApiError("That request has already been reviewed.")
    db.update(
        "bookings",
        booking_id,
        {"status": "declined", "decline_reason": "The host passed this time.", "responded_at": now_iso()},
    )
    fresh = db.find_one("bookings", id=booking_id)
    return serialize_booking(fresh, host["id"])


def cancel_booking(guest: dict, booking_id: str) -> dict:
    db = get_db()
    booking = db.find_one("bookings", id=booking_id)
    if not booking or booking.get("guest_id") != guest["id"]:
        raise ApiError("That request isn't yours.", 404)
    if booking.get("status") != "pending":
        raise ApiError("Only a pending request can be cancelled.")
    db.update("bookings", booking_id, {"status": "cancelled", "responded_at": now_iso()})
    fresh = db.find_one("bookings", id=booking_id)
    return serialize_booking(fresh, guest["id"])


def set_availability(user: dict, dates: list[str]) -> dict:
    dates = parse_dates(dates, require=False)
    accepted = set()
    for booking in get_db().find_all("bookings"):
        if booking.get("host_id") == user["id"] and booking.get("status") == "accepted":
            accepted.update(booking.get("dates") or [])
    overlap = sorted(set(dates).intersection(accepted))
    if overlap:
        raise ApiError("You already accepted a guest for " + ", ".join(overlap) + ".")
    updated = get_db().update("users", user["id"], {"open_dates": dates})
    return serialize_user(updated, user["id"])


def save_room(user: dict, dorm_id: str, floor: int, unit: str, open_dates: list[str] | None) -> dict:
    dorm = get_dorm(dorm_id)
    if not dorm:
        raise ApiError("Pick a residence hall on the map.")
    if not any(item["id"] == unit and item["floor"] == floor for item in dorm["units"]):
        raise ApiError("That unit isn't on this floor.")
    patch = {"dorm_id": dorm_id, "floor": floor, "unit": unit}
    if open_dates is not None:
        patch["open_dates"] = parse_dates(open_dates, require=False)
    updated = get_db().update("users", user["id"], patch)
    return serialize_user(updated, user["id"])


def messaging_status(user: dict) -> dict:
    from .graph import instagram_configured, normalize_phone, whatsapp_configured

    socials = user.get("socials") or {}
    messaging = user.get("messaging") or {}
    phone = normalize_phone(socials.get("phone") or "")
    return {
        "phone": socials.get("phone") or "",
        "phone_ready": bool(phone),
        "instagram": socials.get("instagram") or "",
        "instagram_linked": bool(messaging.get("instagram_id")),
        "instagram_code": messaging.get("instagram_code") or "",
        "whatsapp_api": whatsapp_configured(),
        "instagram_api": instagram_configured(),
    }


def issue_instagram_code(user: dict) -> dict:
    import secrets

    messaging = dict(user.get("messaging") or {})
    messaging["instagram_code"] = secrets.token_hex(3).upper()
    updated = get_db().update("users", user["id"], {"messaging": messaging})
    return messaging_status(updated)


def _accepted_booking(user_id: str, booking_id: str) -> dict:
    booking = get_db().find_one("bookings", id=booking_id)
    if not booking or user_id not in (booking.get("guest_id"), booking.get("host_id")):
        raise ApiError("That stay isn't yours.", 404)
    if booking.get("status") != "accepted":
        raise ApiError("Messages open after the host accepts.")
    return booking


def _serialize_message(item: dict, viewer_id: str) -> dict:
    return {
        "id": item.get("id"),
        "sender_id": item.get("sender_id"),
        "channel": item.get("channel") or "nook",
        "text": item.get("text") or "",
        "created_at": item.get("created_at"),
        "delivery": item.get("delivery") or "stored",
        "detail": item.get("detail") or "",
        "mine": item.get("sender_id") == viewer_id,
    }


def list_messages(user: dict, booking_id: str) -> list[dict]:
    booking = _accepted_booking(user["id"], booking_id)
    rows = [item for item in get_db().find_all("messages") if item.get("booking_id") == booking["id"]]
    rows.sort(key=lambda item: item.get("created_at") or "")
    return [_serialize_message(item, user["id"]) for item in rows]


def send_message(user: dict, booking_id: str, channel: str, text: str) -> dict:
    from .graph import instagram_configured, normalize_phone, send_instagram, send_whatsapp, whatsapp_configured

    booking = _accepted_booking(user["id"], booking_id)
    channel = (channel or "nook").strip().lower()
    if channel not in ("nook", "whatsapp", "instagram"):
        raise ApiError("Pick Nook, WhatsApp, or Instagram.")
    text = " ".join((text or "").split())
    if not text:
        raise ApiError("Write a message first.")
    if len(text) > 1000:
        raise ApiError("Keep the message under 1000 characters.")
    other_id = booking["host_id"] if user["id"] == booking.get("guest_id") else booking["guest_id"]
    other = get_db().find_one("users", id=other_id)
    if not other:
        raise ApiError("That person isn't on Nook anymore.", 404)
    delivery = "stored"
    detail = "Saved in Nook."
    graph_id = ""
    sender_name = ((user.get("name") or "Someone").split() or ["Someone"])[0]
    outbound = f"{sender_name} on Nook: {text}"
    if channel == "whatsapp":
        phone = normalize_phone((other.get("socials") or {}).get("phone") or "")
        if not phone:
            delivery = "local"
            detail = "They haven't added a phone number, so this stays in Nook."
        elif not whatsapp_configured():
            delivery = "local"
            detail = "WhatsApp sends once META_GRAPH_TOKEN and WHATSAPP_PHONE_NUMBER_ID are set. This stays in Nook."
        else:
            result = send_whatsapp(phone, outbound)
            delivery = "sent" if result["ok"] else "failed"
            detail = "Sent on WhatsApp." if result["ok"] else (result["error"] or "WhatsApp didn't take the message.")
            graph_id = result.get("id") or ""
    elif channel == "instagram":
        ig_id = (other.get("messaging") or {}).get("instagram_id") or ""
        handle = (other.get("socials") or {}).get("instagram") or ""
        if not ig_id:
            delivery = "local"
            who = f"@{handle.lstrip('@')}" if handle else "They"
            detail = f"{who} still needs to link Instagram. This stays in Nook."
        elif not instagram_configured():
            delivery = "local"
            detail = "Instagram sends once META_GRAPH_TOKEN and INSTAGRAM_ACCOUNT_ID are set. This stays in Nook."
        else:
            result = send_instagram(ig_id, outbound)
            delivery = "sent" if result["ok"] else "failed"
            detail = "Sent on Instagram." if result["ok"] else (result["error"] or "Instagram didn't take the message.")
            graph_id = result.get("id") or ""
    doc = {
        "id": uuid.uuid4().hex,
        "booking_id": booking["id"],
        "sender_id": user["id"],
        "channel": channel,
        "text": text,
        "created_at": now_iso(),
        "delivery": delivery,
        "detail": detail,
        "graph_id": graph_id,
    }
    get_db().insert("messages", doc)
    return _serialize_message(doc, user["id"])


def _latest_accepted(user_id: str) -> dict | None:
    rows = [
        item
        for item in get_db().find_all("bookings")
        if item.get("status") == "accepted" and user_id in (item.get("guest_id"), item.get("host_id"))
    ]
    if not rows:
        return None
    rows.sort(key=lambda item: item.get("created_at") or "", reverse=True)
    return rows[0]


def _claim_instagram(igsid: str, text: str) -> bool:
    import re

    folded = (text or "").upper()
    if not folded:
        return False
    db = get_db()
    for user in db.find_all("users"):
        messaging = dict(user.get("messaging") or {})
        code = (messaging.get("instagram_code") or "").upper()
        if not code or not re.search(rf"(?<![A-Z0-9]){re.escape(code)}(?![A-Z0-9])", folded):
            continue
        messaging["instagram_id"] = igsid
        messaging["instagram_code"] = ""
        db.update("users", user["id"], {"messaging": messaging})
        return True
    return False


def _record_inbound(channel: str, sender_key: str, text: str, graph_id: str) -> bool:
    from .graph import normalize_phone

    db = get_db()
    if graph_id and any(item.get("graph_id") == graph_id for item in db.find_all("messages")):
        return False
    user = None
    if channel == "whatsapp":
        target = normalize_phone(sender_key)
        if not target:
            return False
        for candidate in db.find_all("users"):
            if normalize_phone((candidate.get("socials") or {}).get("phone") or "") == target:
                user = candidate
                break
    else:
        for candidate in db.find_all("users"):
            if (candidate.get("messaging") or {}).get("instagram_id") == sender_key:
                user = candidate
                break
    if not user:
        return False
    booking = _latest_accepted(user["id"])
    if not booking:
        return False
    cleaned = " ".join((text or "").split())[:1000]
    if not cleaned:
        return False
    db.insert(
        "messages",
        {
            "id": uuid.uuid4().hex,
            "booking_id": booking["id"],
            "sender_id": user["id"],
            "channel": channel,
            "text": cleaned,
            "created_at": now_iso(),
            "delivery": "sent",
            "detail": "Replied on WhatsApp." if channel == "whatsapp" else "Replied on Instagram.",
            "graph_id": graph_id,
        },
    )
    return True


def ingest_graph_webhook(payload: dict) -> int:
    saved = 0
    kind = payload.get("object")
    if kind == "whatsapp_business_account":
        for entry in payload.get("entry") or []:
            for change in entry.get("changes") or []:
                value = change.get("value") or {}
                for message in value.get("messages") or []:
                    if message.get("type") not in (None, "text"):
                        continue
                    text = ((message.get("text") or {}).get("body") or "").strip()
                    sender = message.get("from") or ""
                    if text and _record_inbound("whatsapp", sender, text, message.get("id") or ""):
                        saved += 1
    elif kind == "instagram":
        for entry in payload.get("entry") or []:
            for event in entry.get("messaging") or []:
                message = event.get("message") or {}
                if message.get("is_echo"):
                    continue
                text = (message.get("text") or "").strip()
                sender = (event.get("sender") or {}).get("id") or ""
                if not text or not sender:
                    continue
                if _claim_instagram(sender, text):
                    saved += 1
                    continue
                if _record_inbound("instagram", sender, text, message.get("mid") or ""):
                    saved += 1
    return saved
