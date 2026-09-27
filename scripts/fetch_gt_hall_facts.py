#!/usr/bin/env python3
"""Save room furniture, dimensions, and building amenities from Housing.

Each hall page on housing.gatech.edu lists the furniture in the room and the
building amenities. Furniture dimensions live on the room-and-furniture page.
This script curls those pages once and writes backend/nook/data/hall_facts.json.

    python3 scripts/fetch_gt_hall_facts.py
"""

from __future__ import annotations

import html
import importlib.util
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "backend" / "nook" / "data" / "hall_facts.json"


def _floorplans():
    path = ROOT / "scripts" / "fetch_gt_floorplans.py"
    spec = importlib.util.spec_from_file_location("fetch_gt_floorplans", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def plain(fragment: str) -> str:
    text = re.sub(r"<[^>]+>", " ", fragment)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def named_items(page: str, item_class: str) -> list[dict]:
    pattern = re.compile(
        rf'class="{item_class}"[^>]*>\s*<div class="location__sub-desc">([^<]*)'
        rf'(?:</div>\s*<div class="location__sub-info">([^<]*))?',
        re.I,
    )
    items = []
    for name, detail in pattern.findall(page):
        label = plain(name)
        if not label:
            continue
        items.append({"name": label, "detail": plain(detail or "")})
    return items


def room_style(page: str) -> str:
    match = re.search(
        r'location__sub-title">\s*Room Style\s*</div>\s*<div class="location__sub-desc">([^<]+)',
        page,
        re.I,
    )
    return plain(match.group(1)) if match else ""


def furniture_note(page: str) -> str:
    match = re.search(r'location__room-note">([\s\S]*?)</p>', page)
    return plain(match.group(1)) if match else ""


def furniture_dimensions(page: str) -> list[dict]:
    pieces = []
    for block in re.findall(r'<div class="feature-section__item">([\s\S]*?)</div>\s*</div>\s*</div>', page):
        heading = re.search(r'feature-section__item-heading">([^<]+)', block)
        if not heading:
            continue
        lines = []
        for label, value in re.findall(r"<strong>([^<]+)</strong>\s*:\s*([^<]+)", block):
            lines.append(f"{plain(label)}: {plain(value)}")
        if lines:
            pieces.append({"name": plain(heading.group(1)), "lines": lines})
    return pieces


def main() -> int:
    plans = _floorplans()
    furniture_page = plans.curl("https://housing.gatech.edu/room-and-furniture").decode("utf-8", "replace")
    dimensions = furniture_dimensions(furniture_page)
    if not dimensions:
        print("No furniture dimensions found.", file=sys.stderr)
        return 1
    halls = {}
    for dorm_id, slug in plans.SLUGS.items():
        page_url = f"https://housing.gatech.edu/locations/{slug}"
        try:
            page = plans.curl(page_url).decode("utf-8", "replace")
        except Exception as exc:
            print(f"skip {dorm_id}: {exc}", file=sys.stderr)
            continue
        halls[dorm_id] = {
            "page": page_url,
            "room_style": room_style(page),
            "amenities": named_items(page, "location__amenities-item"),
            "furniture": named_items(page, "location__room-item"),
            "furniture_note": furniture_note(page),
        }
        print(f"{dorm_id}: {len(halls[dorm_id]['amenities'])} amenities, {len(halls[dorm_id]['furniture'])} furniture")
    OUT.write_text(
        json.dumps(
            {
                "source": "https://housing.gatech.edu/room-and-furniture",
                "dimensions": dimensions,
                "halls": halls,
            },
            indent=2,
        )
        + "\n"
    )
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
