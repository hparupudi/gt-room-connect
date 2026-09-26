#!/usr/bin/env python3
"""Place a click target on every room number printed on a Housing floor plan.

The JPEG Nook serves is the same drawing as the PDF (same aspect ratio). Word
boxes from ``pdftotext -bbox`` become normalized rectangles on that image.

    python3 scripts/extract_room_hotspots.py

Writes backend/nook/data/room_hotspots.json. PDFs are read from /tmp/gt-pdfs
(the cache ``scripts/extract_gt_rooms.py`` already fills).
"""

from __future__ import annotations

import html
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "backend" / "nook" / "data" / "floorplans" / "manifest.json"
OUT = ROOT / "backend" / "nook" / "data" / "room_hotspots.json"
CACHE = Path("/tmp/gt-pdfs")

WORD = re.compile(r"<word\b([^>]*)>(.*?)</word>", re.I)
PAGE = re.compile(r'<page\b[^>]*\bwidth="([\d.]+)"[^>]*\bheight="([\d.]+)"', re.I)
ROOM = re.compile(r"^(?:([NSEWB])(\d{2,4})([A-Z]{0,3})|(\d{2,4})([A-Z]{0,3}))$")
ATTR = re.compile(r'(\w+)="([^"]*)"')

# Grow each label into the room around it, but stop at the halfway line to the
# next label so neighboring rooms do not steal each other's click.
MAX_W, MAX_H = 96.0, 72.0
GAP = 2.5


def floor_of(prefix: str, digits: str) -> int | None:
    if prefix == "B":
        return 0
    if len(digits) == 3:
        return int(digits[0])
    if len(digits) == 4:
        return int(digits[:2])
    return None


def room_token(text: str, floor: int) -> str | None:
    token = html.unescape(text).strip().upper()
    match = ROOM.match(token)
    if not match:
        return None
    prefix, digits, suffix, plain_digits, plain_suffix = match.groups()
    if prefix is None:
        prefix, digits, suffix = "", plain_digits, plain_suffix
    if suffix and ("M" in suffix or "T" in suffix):
        return None
    if floor_of(prefix, digits) != floor:
        return None
    return f"{prefix}{digits}{suffix}"


def labels(path: Path, floor: int) -> tuple[float, float, list[dict]]:
    raw = subprocess.check_output(["pdftotext", "-bbox", str(path), "-"], text=True, errors="replace")
    page = PAGE.search(raw)
    if not page:
        return 0, 0, []
    width, height = float(page.group(1)), float(page.group(2))
    found: dict[str, dict] = {}
    for attrs, text in WORD.findall(raw):
        unit = room_token(text, floor)
        if not unit or unit in found:
            continue
        values = dict(ATTR.findall(attrs))
        try:
            box = {key: float(values[key]) for key in ("xMin", "yMin", "xMax", "yMax")}
        except KeyError:
            continue
        found[unit] = {
            "unit": unit,
            "cx": (box["xMin"] + box["xMax"]) / 2,
            "cy": (box["yMin"] + box["yMax"]) / 2,
        }
    return width, height, list(found.values())


def expand(width: float, height: float, spots: list[dict]) -> list[dict]:
    placed = []
    for spot in spots:
        left, right, up, down = 0.0, width, 0.0, height
        for other in spots:
            if other is spot:
                continue
            dx = other["cx"] - spot["cx"]
            dy = other["cy"] - spot["cy"]
            if abs(dx) >= abs(dy):
                mid = (spot["cx"] + other["cx"]) / 2
                if dx < 0:
                    left = max(left, mid + GAP)
                elif dx > 0:
                    right = min(right, mid - GAP)
            else:
                mid = (spot["cy"] + other["cy"]) / 2
                if dy < 0:
                    up = max(up, mid + GAP)
                elif dy > 0:
                    down = min(down, mid - GAP)
        left = max(left, spot["cx"] - MAX_W / 2)
        right = min(right, spot["cx"] + MAX_W / 2)
        up = max(up, spot["cy"] - MAX_H / 2)
        down = min(down, spot["cy"] + MAX_H / 2)
        if right - left < 8 or down - up < 8:
            continue
        placed.append(
            {
                "unit": spot["unit"],
                "x": round(left / width, 4),
                "y": round(up / height, 4),
                "w": round((right - left) / width, 4),
                "h": round((down - up) / height, 4),
            }
        )
    placed.sort(key=lambda item: (item["y"], item["x"], item["unit"]))
    return placed


def main() -> int:
    manifest = json.loads(MANIFEST.read_text())
    catalog: dict[str, dict[str, list[dict]]] = {}
    for hall, info in manifest.items():
        floors: dict[str, list[dict]] = {}
        for floor, item in sorted(info.get("floors", {}).items(), key=lambda pair: int(pair[0])):
            if not item.get("pdf"):
                continue
            path = CACHE / f"{hall}-{floor}.pdf"
            if not path.exists():
                print(f"skip {hall} floor {floor}: no cached pdf")
                continue
            width, height, spots = labels(path, int(floor))
            if width <= 0 or not spots:
                print(f"{hall} floor {floor}: 0 rooms")
                continue
            floors[str(int(floor))] = expand(width, height, spots)
            print(f"{hall} floor {floor}: {len(floors[str(int(floor))])} rooms")
        if floors:
            catalog[hall] = floors
    OUT.write_text(json.dumps(catalog, separators=(",", ":")) + "\n")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
