"""Recognized .edu schools.

`data/edu_schools.json` is the .edu slice of the Hipo university-domains list.
A US .edu domain is issued to an accredited postsecondary institution, so a
match here means the school named by the address is one we can recognize.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_PATH = Path(__file__).resolve().parent / "data" / "edu_schools.json"


@lru_cache(maxsize=1)
def edu_schools() -> dict[str, str]:
    raw = json.loads(_PATH.read_text(encoding="utf-8"))
    return {str(domain).lower(): str(name) for domain, name in raw.items()}


def school_for_domain(domain: str) -> str | None:
    """Return the school name for a domain, walking from the full host up to the .edu stem."""
    domain = (domain or "").strip().lower().rstrip(".")
    labels = [part for part in domain.split(".") if part]
    if len(labels) < 2 or labels[-1] != "edu":
        return None
    schools = edu_schools()
    for start in range(len(labels) - 1):
        name = schools.get(".".join(labels[start:]))
        if name:
            return name
    return None
