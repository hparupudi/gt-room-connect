#!/usr/bin/env python3
"""Download official Georgia Tech Housing floor plans with curl.

Each residence-hall page on housing.gatech.edu embeds the published floor-plan
image (bathrooms, study rooms, kitchens, and bedrooms as drawn by Housing) and
a matching PDF. This script curls those pages and saves the images the site
already serves. No browser is required.

    python3 scripts/fetch_gt_floorplans.py
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "backend" / "nook" / "data" / "floorplans"
USER_AGENT = "DormsurfFloorplans/1.0 (educational; +https://housing.gatech.edu)"

# Dormsurf hall id -> housing.gatech.edu location slug.
SLUGS = {
    "glenn": "glenn",
    "field": "field",
    "hopkins": "hopkins",
    "matheson": "matheson",
    "perry": "perry",
    "hanson": "hanson",
    "harrison": "harrison",
    "howell": "howell",
    "towers": "towers",
    "cloudman": "cloudman",
    "smith": "smith",
    "brown": "brown",
    "harris": "harris",
    "armstrong": "armstrong",
    "caldwell": "caldwell",
    "folk": "folk",
    "fitten": "fitten",
    "freeman": "freeman",
    "fulmer": "fulmer",
    "hefner": "hefner",
    "montag": "montag",
    "woodruff-north": "woodruff-north",
    "woodruff-south": "woodruff-south",
    "crecine": "crecine",
    "eighth-east": "eighth-street-east",
    "eighth-west": "eighth-street-west",
    "eighth-south": "eighth-street-south",
    "center-north": "center-street-north",
    "center-south": "center-street-south",
    "maulding": "maulding",
    "nelson-shell": "nelson-shell",
    "zbar": "zbar-apartments",
    "graduate-living": "glc",
    "north-ave-east": "north-avenue-east",
    "north-ave-north": "north-avenue-north",
    "north-ave-south": "north-avenue-south",
    "north-ave-west": "north-avenue-west",
}

ITEM = re.compile(
    r'location__floor-num">([^<]*)</p>\s*'
    r'<div class="location__floor-image-wrapper">\s*'
    r'<img class="location__floor-image"\s+src="([^"]+)"[^>]*>\s*'
    r'</div>\s*'
    r'<a href="([^"]+)"',
    re.I,
)


def curl(url: str, dest: Path | None = None) -> bytes:
    cmd = [
        "curl",
        "-fsSL",
        "--retry",
        "3",
        "--retry-delay",
        "1",
        "--max-time",
        "60",
        "-A",
        USER_AGENT,
        url,
    ]
    if dest is None:
        return subprocess.check_output(cmd)
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([*cmd, "-o", str(dest)], check=True)
    return b""


def mime(path: Path) -> str:
    return subprocess.check_output(["file", "-b", "--mime-type", str(path)], text=True).strip()


def floor_number(label: str) -> int | None:
    numbers = re.findall(r"\d+", label)
    if not numbers:
        return None
    return int(numbers[-1])


def fetch_hall(dorm_id: str, slug: str) -> dict | None:
    page = f"https://housing.gatech.edu/locations/{slug}"
    try:
        html = curl(page).decode("utf-8", "replace")
    except subprocess.CalledProcessError as exc:
        print(f"skip {dorm_id}: {page} ({exc.returncode})", file=sys.stderr)
        return None
    floors: dict[str, dict] = {}
    for label, image_url, pdf_url in ITEM.findall(html):
        floor = floor_number(label)
        if floor is None or not image_url:
            continue
        suffix = Path(image_url.split("?")[0]).suffix.lower() or ".jpg"
        relative = f"{dorm_id}/{floor}.jpg"
        dest = OUT / relative
        try:
            if suffix == ".pdf":
                pdf_path = dest.with_suffix(".pdf")
                curl(image_url, pdf_path)
                prefix = dest.with_suffix("")
                subprocess.run(
                    ["pdftoppm", "-jpeg", "-r", "130", "-singlefile", str(pdf_path), str(prefix)],
                    check=True,
                )
                pdf_path.unlink(missing_ok=True)
                if not dest.exists():
                    raise subprocess.CalledProcessError(1, "pdftoppm")
            else:
                if suffix not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
                    suffix = ".jpg"
                relative = f"{dorm_id}/{floor}{suffix if suffix != '.jpeg' else '.jpg'}"
                dest = OUT / relative
                curl(image_url, dest)
        except subprocess.CalledProcessError as exc:
            print(f"skip {dorm_id} floor {floor}: {image_url} ({exc.returncode})", file=sys.stderr)
            continue
        kind = mime(dest)
        if not kind.startswith("image/"):
            dest.unlink(missing_ok=True)
            print(f"skip {dorm_id} floor {floor}: {image_url} was {kind}", file=sys.stderr)
            continue
        floors[str(floor)] = {
            "label": re.sub(r"\s+", " ", label).strip(),
            "file": relative,
            "image_url": image_url,
            "pdf": pdf_url,
            "mime": kind,
        }
        print(f"{dorm_id} floor {floor} <- {image_url}")
    if not floors:
        print(f"no floor plans on {page}", file=sys.stderr)
        return None
    return {"slug": slug, "page": page, "floors": floors}


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    wanted = set(sys.argv[1:])
    manifest_path = OUT / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() and wanted else {}
    halls = {key: value for key, value in SLUGS.items() if not wanted or key in wanted}
    for dorm_id, slug in halls.items():
        hall = fetch_hall(dorm_id, slug)
        if hall:
            manifest[dorm_id] = hall
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"wrote {len(manifest)} halls to {OUT / 'manifest.json'}")
    return 0 if manifest else 1


if __name__ == "__main__":
    raise SystemExit(main())
