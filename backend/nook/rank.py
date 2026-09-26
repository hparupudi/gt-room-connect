from .constants import YEAR_LABELS
from .dorms import walking_route
from .embed import cosine

CLEAN_ORDER = ["messy", "relaxed", "average", "tidy", "spotless"]
SLEEP_ORDER = ["early", "typical", "late", "nocturnal"]


def _scale(order: list[str], left: str | None, right: str | None) -> float:
    if left not in order or right not in order:
        return 0.5
    return 1 - abs(order.index(left) - order.index(right)) / (len(order) - 1)


def _join(items: list[str]) -> str:
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    if len(items) == 2:
        return f"{items[0]} and {items[1]}"
    return ", ".join(items[:-1]) + f", and {items[-1]}"


def match_reason(seeker: dict, host: dict) -> str:
    seeker_life = seeker.get("lifestyle") or {}
    host_life = host.get("lifestyle") or {}
    seeker_interests = {item.lower() for item in (seeker_life.get("interests") or []) + (seeker_life.get("hobbies") or [])}
    shared = []
    for item in (host_life.get("interests") or []) + (host_life.get("hobbies") or []):
        if item.lower() in seeker_interests and item.lower() not in shared:
            shared.append(item.lower())
    parts = []
    if shared:
        parts.append(f"you both are into {_join(shared[:3])}")
    if seeker_life.get("sleep_timing") and seeker_life.get("sleep_timing") == host_life.get("sleep_timing"):
        parts.append(f"you keep {host_life['sleep_timing']} hours")
    if seeker_life.get("cleanliness") and seeker_life.get("cleanliness") == host_life.get("cleanliness"):
        parts.append(f"you both keep a {host_life['cleanliness']} room")
    if seeker.get("major") and seeker.get("major") == host.get("major"):
        parts.append(f"you both study {host.get('major')}")
    seeker_home = (seeker.get("hometown") or "").strip().lower()
    host_home = (host.get("hometown") or "").strip()
    if seeker_home and seeker_home == host_home.lower():
        parts.append(f"you're both from {host_home}")
    if not parts:
        year = YEAR_LABELS.get(host.get("year"), "")
        return f"Your dates line up with {host.get('name', 'this host').split()[0]}, a {year.lower()} in {host.get('major')}."
    sentence = parts[0][0].upper() + parts[0][1:]
    if len(parts) > 1:
        sentence = f"{sentence}, and " + " and ".join(parts[1:])
    return sentence + "."


def score_pair(seeker: dict, host: dict, vectors: dict[str, list[float]]) -> dict:
    seeker_life = seeker.get("lifestyle") or {}
    host_life = host.get("lifestyle") or {}
    similarity = cosine(vectors.get(seeker["id"]), vectors.get(host["id"]))
    if seeker.get("dorm_id") and host.get("dorm_id"):
        route = walking_route(seeker["dorm_id"], host["dorm_id"])
    else:
        route = {"meters": 99_000, "minutes": 999}
    clean = _scale(CLEAN_ORDER, seeker_life.get("cleanliness"), host_life.get("cleanliness"))
    sleep = _scale(SLEEP_ORDER, seeker_life.get("sleep_timing"), host_life.get("sleep_timing"))
    local = 0.72 * similarity + 0.18 * clean + 0.10 * sleep
    return {
        "cosine": similarity,
        "local": local,
        "meters": route["meters"],
        "minutes": route["minutes"],
        "reason": match_reason(seeker, host),
        "reason_model": "local-lifestyle-v1",
    }


def order_scored(scored: list[dict], mode: str) -> list[dict]:
    if mode == "distance":
        return sorted(scored, key=lambda item: (item["meters"], -item["local"]))
    return sorted(scored, key=lambda item: (-item["local"], item["meters"]))
