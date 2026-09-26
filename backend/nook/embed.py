"""Local lifestyle vectors used when MODEL_API_KEY is empty.

The axis order matches LifestyleAxes so a Muse Spark vector and a local
vector live in the same space and can be compared with cosine similarity.
"""

from __future__ import annotations

import re

import numpy as np

from .constants import AXIS_NAMES, DESIGN_MAJORS, STEM_MAJORS

METRO = (
    "atlanta",
    "decatur",
    "marietta",
    "duluth",
    "sandy springs",
    "smyrna",
    "brookhaven",
    "east point",
    "chamblee",
)

RULES: list[tuple[str, tuple[str, ...]]] = [
    ("outdoors", ("climb", "bouldering", "hiking", "outdoor", "trail", "cycling", "bike")),
    ("music", ("music", "concert", "jazz", "guitar", "piano", "dj", "band", "produce")),
    ("gaming", ("gaming", "video game", "xbox", "steam", "nintendo")),
    ("design", ("design", "drawing", "studio", "ceramic", "sketch")),
    ("sports", ("basketball", "soccer", "intramural", "golf", "sport")),
    ("food", ("food", "restaurant", "cooking", "baking", "coffee")),
    ("nightlife", ("nightlife", "party", "bar", "show", "concert")),
    ("quiet_nights", ("quiet", "library", "headphones", "low key", "low-key")),
    ("cooking", ("cooking", "baking", "cook")),
    ("film", ("film", "movie", "cinema", "editing")),
    ("reading", ("reading", "novel", "book")),
    ("fitness", ("running", "climb", "gym", "fitness", "cycling", "basketball")),
    ("volunteering", ("volunteer", "service")),
    ("travel", ("travel", "hometown", "trip")),
    ("tech", ("code", "hack", "programming", "engineer", "startup")),
    ("art", ("photo", "ceramic", "drawing", "art", "design", "architecture")),
    ("conversation", ("talk", "people", "friends", "host")),
    ("performance", ("music", "dance", "concert", "dj", "band")),
    ("spontaneous", ("spontaneous", "last minute", "last-minute")),
    ("planner", ("planner", "calendar", "ahead")),
    ("study", ("study", "research", "exam", "pset")),
    ("gaming", ("gaming",)),
]


def normalize(vec: list[float]) -> list[float]:
    arr = np.asarray(vec, dtype=float)
    norm = float(np.linalg.norm(arr))
    if norm == 0:
        return arr.tolist()
    return (arr / norm).tolist()


def cosine(a: list[float] | None, b: list[float] | None) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    va = np.asarray(a, dtype=float)
    vb = np.asarray(b, dtype=float)
    na = float(np.linalg.norm(va))
    nb = float(np.linalg.norm(vb))
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(va, vb) / (na * nb))


def axes_from_signals(
    text: str,
    sleep: str,
    cleanliness: str,
    major: str,
    hometown: str,
    noise: str,
) -> list[float]:
    blob = text.lower()
    values = {name: 0.08 for name in AXIS_NAMES}

    def bump(axis: str, amount: float = 0.82) -> None:
        values[axis] = min(1.0, values[axis] + amount)

    def mentioned(phrase: str) -> bool:
        return re.search(rf"(?<![a-z0-9]){re.escape(phrase)}", blob) is not None

    for axis, words in RULES:
        if any(mentioned(word) for word in words):
            bump(axis)

    if sleep == "early":
        values["early_riser"] = 0.98
        values["night_owl"] = 0.04
        values["quiet_nights"] = max(values["quiet_nights"], 0.72)
    elif sleep == "typical":
        values["early_riser"] = 0.48
        values["night_owl"] = 0.32
    elif sleep == "late":
        values["early_riser"] = 0.08
        values["night_owl"] = 0.92
        values["nightlife"] = max(values["nightlife"], 0.55)
    else:
        values["early_riser"] = 0.04
        values["night_owl"] = 0.98
        values["nightlife"] = max(values["nightlife"], 0.72)

    if cleanliness == "spotless":
        values["spotless"] = 0.98
        values["relaxed_clean"] = 0.05
    elif cleanliness == "tidy":
        values["spotless"] = 0.74
        values["relaxed_clean"] = 0.18
    elif cleanliness == "average":
        values["spotless"] = 0.4
        values["relaxed_clean"] = 0.46
    elif cleanliness == "relaxed":
        values["spotless"] = 0.16
        values["relaxed_clean"] = 0.86
    else:
        values["spotless"] = 0.05
        values["relaxed_clean"] = 0.96

    if major in STEM_MAJORS:
        bump("stem", 0.85)
        bump("tech", 0.35)
        bump("study", 0.25)
    if major in DESIGN_MAJORS or major in {"Public Policy", "Business", "Economics", "Psychology"}:
        bump("humanities", 0.7)
    if major in {"Architecture", "Industrial Design"}:
        bump("art", 0.6)
        bump("design", 0.5)

    home = hometown.lower()
    if any(city in home for city in METRO):
        values["atlanta"] = 0.92

    if noise == "quiet":
        values["low_noise"] = 0.9
        values["introvert"] = max(values["introvert"], 0.62)
        values["guests_ok"] = max(values["guests_ok"], 0.35)
    elif noise == "social":
        values["extrovert"] = max(values["extrovert"], 0.8)
        values["guests_ok"] = 0.88
        values["conversation"] = max(values["conversation"], 0.7)
        values["low_noise"] = 0.15
    else:
        values["guests_ok"] = max(values["guests_ok"], 0.58)
        values["conversation"] = max(values["conversation"], 0.4)
        values["low_noise"] = max(values["low_noise"], 0.4)

    return normalize([values[name] for name in AXIS_NAMES])
