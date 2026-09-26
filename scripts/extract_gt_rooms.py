#!/usr/bin/env python3
"""Read room numbers off the official Georgia Tech Housing floor-plan PDFs.

The plans are the same files linked from each hall page on housing.gatech.edu.
A room is bookable when its number is printed on that floor. Mechanical and
telecom closets (a trailing M or T) are left off the list.

    python3 scripts/extract_gt_rooms.py

Writes backend/nook/data/gt_rooms.json.
"""

from __future__ import annotations

import html
import json
import re
import subprocess
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "backend" / "nook" / "data" / "floorplans" / "manifest.json"
OUT = ROOT / "backend" / "nook" / "data" / "gt_rooms.json"
CACHE = Path("/tmp/gt-pdfs")
WORD = re.compile(
    r'<word\b[^>]*\bxMin="([\d.]+)"[^>]*>(.*?)</word>',
    re.I,
)
ROOM = re.compile(r"^(?:([NSEWB])(\d{2,4})([A-Z]{0,3})|(\d{2,4})([A-Z]{0,3}))$")


def floor_of(prefix: str, digits: str) -> int | None:
    """Map a printed room number to the floor it belongs on.

    Floors 0–9 use a three-digit number (101 is floor 1). Floors 10 and up use
    four digits (1204 is floor 12). A leading B is a basement on floor 0.
    Two-digit scraps such as W10 are not room numbers.
    """
    if prefix == "B":
        return 0
    if len(digits) == 3:
        return int(digits[0])
    if len(digits) == 4:
        return int(digits[:2])
    return None


def sort_key(unit: str) -> tuple:
    match = re.match(r"([A-Z]*)(\d+)([A-Z]*)", unit)
    if not match:
        return ("", 0, unit)
    prefix, digits, suffix = match.groups()
    return (prefix, int(digits), suffix)


def rooms_in_pdf(path: Path, floor: int) -> list[str]:
    raw = subprocess.check_output(["pdftotext", "-bbox", str(path), "-"], text=True, errors="replace")
    found: set[str] = set()
    for _xmin, text in WORD.findall(raw):
        token = html.unescape(text).strip().upper()
        match = ROOM.match(token)
        if not match:
            continue
        prefix, digits, suffix, plain_digits, plain_suffix = match.groups()
        if prefix is None:
            prefix, digits, suffix = "", plain_digits, plain_suffix
        if suffix and ("M" in suffix or "T" in suffix):
            continue
        if floor_of(prefix, digits) != floor:
            continue
        found.add(f"{prefix}{digits}{suffix}")
    return sorted(found, key=sort_key)


def ensure_pdf(hall: str, floor: str, url: str) -> Path | None:
    CACHE.mkdir(parents=True, exist_ok=True)
    dest = CACHE / f"{hall}-{floor}.pdf"
    if dest.exists() and dest.stat().st_size > 1000:
        return dest
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "DormsurfFloorplans/1.0"})
        dest.write_bytes(urllib.request.urlopen(request, timeout=40).read())
    except Exception as exc:
        print(f"skip {hall} floor {floor}: {exc}")
        return None
    return dest if dest.stat().st_size > 1000 else None


def main() -> int:
    manifest = json.loads(MANIFEST.read_text())
    catalog: dict[str, dict[str, list[str]]] = {}
    for hall, info in manifest.items():
        floors: dict[str, list[str]] = {}
        for floor, item in sorted(info.get("floors", {}).items(), key=lambda pair: int(pair[0])):
            pdf = item.get("pdf")
            if not pdf:
                continue
            path = ensure_pdf(hall, floor, pdf)
            if path is None:
                continue
            rooms = rooms_in_pdf(path, int(floor))
            floors[str(int(floor))] = rooms
            print(f"{hall} floor {floor}: {len(rooms)} rooms")
        if floors:
            catalog[hall] = floors
    OUT.write_text(json.dumps(catalog, indent=2) + "\n")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
