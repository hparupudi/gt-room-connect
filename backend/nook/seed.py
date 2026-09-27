"""Demo Yellow Jackets so the campus isn't empty on first launch."""

from datetime import date, timedelta

from .constants import YEAR_LABELS
from .db import get_db
from .dorms import get_dorm
from .embed import axes_from_signals
from .housing import room_footprint
from .security import hash_password

DEMO_PASSWORD = "WeekendNook!"


def _days(offsets: list[int]) -> list[str]:
    today = date.today()
    return [(today + timedelta(days=offset)).isoformat() for offset in offsets]


def _person(
    user_id: str,
    email: str,
    name: str,
    gender: str,
    age: int,
    major: str,
    year: str,
    hometown: str,
    dorm_id: str,
    floor: int,
    unit: str,
    dates: list[int],
    interests: list[str],
    hobbies: list[str],
    cleanliness: str,
    sleep: str,
    sleep_start: str,
    wake: str,
    noise: str,
    guest_notes: str,
    bio: str,
    socials: dict,
    password_hash: str,
) -> dict:
    dorm = get_dorm(dorm_id)
    if not dorm or not any(item["id"] == unit and item["floor"] == floor for item in dorm["units"]):
        raise RuntimeError(f"Seed unit missing: {dorm_id} {floor} {unit}")
    lifestyle = {
        "interests": interests,
        "hobbies": hobbies,
        "cleanliness": cleanliness,
        "sleep_timing": sleep,
        "sleep_start": sleep_start,
        "wake_time": wake,
        "noise": noise,
        "guest_notes": guest_notes,
        "bio": bio,
        "tags": [],
    }
    signal = " ".join([bio, name, major, hometown, " ".join(interests), " ".join(hobbies), guest_notes])
    embedding = axes_from_signals(signal, sleep, cleanliness, major, hometown, noise)
    tags: list[str] = []
    for tag in [
        YEAR_LABELS[year],
        gender if gender != "undisclosed" else "",
        major,
        {"traditional": "Traditional", "suite": "Suite", "apartment": "Apartment"}[dorm["style"]],
        cleanliness,
        sleep,
        *interests[:3],
    ]:
        if tag and tag not in tags:
            tags.append(tag)
    lifestyle["tags"] = tags[:12]
    return {
        "id": user_id,
        "email": email,
        "password_hash": password_hash,
        "email_verified": True,
        "name": name,
        "gender": gender,
        "age": age,
        "major": major,
        "year": year,
        "hometown": hometown,
        "socials": socials,
        "dorm_id": dorm_id,
        "floor": floor,
        "unit": unit,
        "open_dates": _days(dates),
        "lifestyle": lifestyle,
        "transcript": bio,
        "embedding": embedding,
        "embedding_model": "local-lifestyle-v1",
        "onboarding_complete": True,
        "created_at": date.today().isoformat(),
    }


def seed_if_empty() -> None:
    db = get_db()
    if db.find_all("users"):
        return
    password_hash = hash_password(DEMO_PASSWORD)
    people = [
        _person(
            "maya-chen", "maya.chen@gatech.edu", "Maya Chen", "woman", 19,
            "Computer Science", "2", "Duluth, GA", "glenn", 3, "314", [0, 1, 7, 8],
            ["climbing", "design", "coffee"], ["bouldering", "studio work"],
            "tidy", "early", "22:30", "07:00", "quiet",
            "Wipe the counter if you use the French press, and shoes stay by the door.",
            "Maya is a second-year computer science major from Duluth who treats a Friday night like a studio session that ends at the climbing gym. She keeps Glenn tidy, is out by 11, and will share the French press.",
            {"instagram": "maya.climbs", "phone": "404-555-0142", "discord": "maya#3140"},
            password_hash,
        ),
        _person(
            "andre-wallace", "andre.wallace@gatech.edu", "Andre Wallace", "man", 21,
            "Mechanical Engineering", "3", "Decatur, GA", "north-ave-east", 5, "E507", [5, 6],
            ["music", "basketball", "cooking"], ["producing", "pickup basketball"],
            "average", "late", "01:00", "09:30", "moderate",
            "The bed is real. Text before you come up so he can move the MIDI keyboard.",
            "Andre is a third-year mechanical engineering major from Decatur. He produces music after basketball, keeps late hours, and doesn't mind a mug in the sink if the bed is actually free.",
            {"instagram": "andre.wav", "phone": "404-555-0177", "discord": "andrewallace"},
            password_hash,
        ),
        _person(
            "priya-shah", "priya.shah@gatech.edu", "Priya Shah", "woman", 18,
            "Biomedical Engineering", "1", "Edison, NJ", "woodruff-south", 4, "N402A", [2, 3, 4],
            ["dance", "reading", "running"], ["bharatanatyam", "lab reading"],
            "spotless", "early", "22:15", "06:45", "quiet",
            "The suite stays spotless. Lights out means lights out, and the shared bath gets a two-minute warning.",
            "Priya is a first-year biomedical engineering student from Edison who dances, runs before class, and keeps a spotless suite in Woodruff South. Early hours, quiet building, no surprise guests.",
            {"instagram": "priya.studies", "phone": "404-555-0108", "discord": "priyashah"},
            password_hash,
        ),
        _person(
            "luis-ortega", "luis.ortega@gatech.edu", "Luis Ortega", "man", 22,
            "Computer Engineering", "4", "Miami, FL", "crecine", 2, "204", [0, 1, 9],
            ["gaming", "soccer", "cooking"], ["ranked nights", "intramural soccer"],
            "relaxed", "nocturnal", "02:30", "10:30", "social",
            "Headset on after midnight. The spare bed is clear if you don't mind a glowing monitor.",
            "Luis is a fourth-year computer engineering major from Miami living in Crecine. Gaming nights run late, the apartment is relaxed rather than spotless, and he cooks arroz on Sundays.",
            {"instagram": "luis.orbits", "phone": "404-555-0194", "discord": "luisortega"},
            password_hash,
        ),
        _person(
            "hannah-brooks", "hannah.brooks@gatech.edu", "Hannah Brooks", "woman", 21,
            "Architecture", "3", "Savannah, GA", "eighth-east", 3, "E305", [1, 2, 3],
            ["design", "film", "coffee"], ["studio critiques", "campus films"],
            "tidy", "early", "23:00", "07:30", "quiet",
            "Models and chipboard live on the desk. The bed is yours if you keep drinks off the drawings.",
            "Hannah is a third-year architecture student from Savannah. Eighth Street East stays tidy, she watches films on weeknights, and she is up early for studio.",
            {"instagram": "hannah.draws", "phone": "404-555-0115", "discord": "hbrooks"},
            password_hash,
        ),
        _person(
            "sam-okonkwo", "sam.okonkwo@gatech.edu", "Sam Okonkwo", "man", 20,
            "Industrial Engineering", "2", "Marietta, GA", "towers", 2, "208", [0, 4, 5],
            ["cooking", "basketball", "music"], ["intramurals", "sunday stew"],
            "average", "typical", "23:30", "08:00", "social",
            "Come hungry. He'll leave a bowl if you do the dishes.",
            "Sam is a second-year industrial engineering major from Marietta in Towers. He cooks, plays intramurals, and keeps ordinary hours with the door open for people he likes.",
            {"instagram": "sam.cooks", "phone": "404-555-0160", "discord": "samokonkwo"},
            password_hash,
        ),
        _person(
            "elena-vasquez", "elena.vasquez@gatech.edu", "Elena Vasquez", "woman", 20,
            "Computational Media", "2", "Houston, TX", "field", 4, "405", [0, 1, 2],
            ["music", "photography", "film"], ["concert photos", "editing"],
            "tidy", "late", "01:15", "09:45", "moderate",
            "Text before you head over. She'll leave a spare key under the planter if the show runs long.",
            "Elena studies computational media and spends weekends shooting concerts around Atlanta, then editing late in Field. The room stays tidy. The hours don't.",
            {"instagram": "elena.frames", "phone": "404-555-0133", "discord": "elenav"},
            password_hash,
        ),
        _person(
            "chris-dalton", "chris.dalton@gatech.edu", "Chris Dalton", "man", 22,
            "Business", "4", "Charlotte, NC", "maulding", 4, "W407", [3, 4, 10],
            ["startups", "golf", "coffee"], ["pitch practice", "early range"],
            "relaxed", "typical", "00:00", "08:30", "social",
            "The apartment is lived-in. Grab a pillow from the closet and don't reschedule his morning calls.",
            "Chris is a fourth-year business major from Charlotte in Maulding. He talks startups, plays golf when the weather holds, and keeps a relaxed apartment with typical hours.",
            {"instagram": "chris.builds", "phone": "404-555-0188", "discord": "cdalton"},
            password_hash,
        ),
        _person(
            "noah-kim", "noah.kim@gatech.edu", "Noah Kim", "man", 24,
            "Physics", "grad", "Seoul, South Korea", "center-north", 3, "N304", [0, 6, 7],
            ["running", "chess", "reading"], ["morning miles", "blitz chess"],
            "spotless", "early", "22:00", "06:15", "quiet",
            "Shoes off. He's asleep early and the kitchen is shared, so label your food.",
            "Noah is a physics grad student in Center Street North. He runs at sunrise, plays chess, and keeps a spotless quiet apartment.",
            {"instagram": "noah.runs", "phone": "404-555-0121", "discord": "noahkim"},
            password_hash,
        ),
        _person(
            "aisha-rahman", "aisha.rahman@gatech.edu", "Aisha Rahman", "woman", 21,
            "Public Policy", "3", "Birmingham, AL", "freeman", 2, "206", [1, 2, 8],
            ["volunteering", "reading", "cooking"], ["campus orgs", "novels"],
            "tidy", "typical", "23:15", "07:45", "moderate",
            "She's glad to host someone who wants to actually talk, not just crash.",
            "Aisha is a third-year public policy major from Birmingham in Freeman. She volunteers, reads, cooks, and keeps a tidy room on a normal schedule.",
            {"instagram": "aisha.reads", "phone": "404-555-0154", "discord": "aishar"},
            password_hash,
        ),
        _person(
            "jordan-hale", "jordan.hale@gatech.edu", "Jordan Hale", "nonbinary", 18,
            "Aerospace Engineering", "1", "Colorado Springs, CO", "armstrong", 2, "208", [0, 1, 2],
            ["rockets", "climbing", "music"], ["design build fly", "bouldering"],
            "average", "late", "01:00", "09:00", "moderate",
            "The room is a normal freshman double. Don't touch the rocket parts on the desk.",
            "Jordan is a first-year aerospace engineering student from Colorado Springs in Armstrong. They climb, build rockets, listen to music, and stay up late.",
            {"instagram": "jordan.lifts.off", "phone": "404-555-0190", "discord": "jordanhale"},
            password_hash,
        ),
        _person(
            "brooke-lin", "brooke.lin@gatech.edu", "Brooke Lin", "woman", 20,
            "Industrial Design", "2", "Portland, OR", "harris", 3, "301", [0, 4, 5],
            ["design", "cycling", "coffee"], ["ceramics", "beltline rides"],
            "spotless", "early", "22:30", "07:10", "quiet",
            "The suite is calm and spotless. A cyclist who is up early will feel at home.",
            "Brooke is a second-year industrial design major from Portland in a Harris suite. She cycles, throws ceramics, and keeps early, spotless hours.",
            {"instagram": "brooke.forms", "phone": "404-555-0104", "discord": "brookelin"},
            password_hash,
        ),
    ]
    for person in people:
        db.insert("users", person)
    backfill_demo_consents()


DEMO_IDS = {
    "maya-chen",
    "andre-wallace",
    "priya-shah",
    "luis-ortega",
    "hannah-brooks",
    "sam-okonkwo",
    "elena-vasquez",
    "chris-dalton",
    "noah-kim",
    "aisha-rahman",
    "jordan-hale",
    "brooke-lin",
}


# People who already agreed to the seeded shared rooms. They are not hosts.
ROOMMATE_NAMES = {
    "maya-chen": "Taylor Nguyen",
    "priya-shah": "Casey Morales",
    "sam-okonkwo": "Devon Clarke",
    "elena-vasquez": "Riley Santos",
    "aisha-rahman": "Morgan Blake",
    "jordan-hale": "Quinn Adler",
    "brooke-lin": "Avery Singh",
}


def _seed_roommate(db, host: dict) -> dict:
    roommate_id = f"roommate-{host['id']}"
    existing = db.find_one("users", id=roommate_id)
    if existing:
        return existing
    email = f"roommate.{host['id']}@gatech.edu"
    by_email = db.find_one("users", email=email)
    if by_email:
        return by_email
    roommate = {
        "id": roommate_id,
        "email": email,
        "password_hash": host.get("password_hash") or "",
        "email_verified": True,
        "name": ROOMMATE_NAMES.get(host["id"], "Roommate"),
        "gender": "undisclosed",
        "age": None,
        "major": "",
        "year": "",
        "hometown": "",
        "socials": {},
        "dorm_id": "",
        "floor": None,
        "unit": "",
        "open_dates": [],
        "lifestyle": None,
        "transcript": "",
        "embedding": [],
        "embedding_model": "",
        "onboarding_complete": False,
        "room_skipped": True,
        "created_at": date.today().isoformat(),
    }
    db.insert("users", roommate)
    return roommate


def refresh_demo_copy() -> None:
    """Demo profiles seeded before the bed wording still say couch. Rewrite those lines in place."""
    db = get_db()
    for user in db.find_all("users"):
        if user.get("id") not in DEMO_IDS:
            continue
        changed = False
        transcript = user.get("transcript") or ""
        if "couch" in transcript.lower():
            transcript = transcript.replace("couch", "bed").replace("Couch", "Bed")
            changed = True
        life = dict(user.get("lifestyle") or {})
        for key in ("guest_notes", "bio"):
            text = life.get(key) or ""
            if "couch" in text.lower():
                life[key] = text.replace("couch", "bed").replace("Couch", "Bed")
                changed = True
        if changed:
            db.update("users", user["id"], {"transcript": transcript, "lifestyle": life})


def backfill_demo_consents() -> None:
    """Shared demo rooms already have open nights, so record the roommate agreement those nights assume."""
    db = get_db()
    hosts = [user for user in db.find_all("users") if user.get("id") in DEMO_IDS and user.get("dorm_id")]
    if not hosts:
        return
    covered = {
        (row.get("host_id"), row.get("dorm_id"), row.get("unit"))
        for row in db.find_all("consents")
        if row.get("status") != "withdrawn"
    }
    for host in hosts:
        foot = room_footprint(host.get("dorm_id") or "") or {}
        if int(foot.get("occupants") or 1) < 2:
            continue
        key = (host.get("id"), host.get("dorm_id"), host.get("unit"))
        if key in covered:
            continue
        roommate = _seed_roommate(db, host)
        db.insert(
            "consents",
            {
                "id": f"seed-{host['id']}",
                "host_id": host["id"],
                "dorm_id": host.get("dorm_id") or "",
                "unit": host.get("unit") or "",
                "floor": host.get("floor"),
                "roommate_id": roommate["id"],
                "roommate_email": roommate.get("email") or "",
                "status": "accepted",
                "created_at": date.today().isoformat(),
                "responded_at": date.today().isoformat(),
            },
        )


# Saturday of the weekend that is ending. Later Saturdays and Sundays move with it.
_ENDING_SATURDAY = date(2026, 9, 26)
_WEEKEND_SHIFT = "weekend-shift-2026-09-26"


def _later_weekend(day: date) -> date:
    if day.weekday() not in (5, 6):
        return day
    saturday = day - timedelta(days=day.weekday() - 5)
    if saturday >= _ENDING_SATURDAY:
        return day + timedelta(days=7)
    return day


def shift_ending_weekend() -> None:
    """Move open nights off the weekend of September 26 onto the next one, and the weekends after it."""
    db = get_db()
    if db.find_one("meta", id=_WEEKEND_SHIFT):
        return
    touched = False
    for user in db.find_all("users"):
        current = list(user.get("open_dates") or [])
        if "2026-09-26" in current:
            touched = True
            break
    if not touched:
        return
    for user in db.find_all("users"):
        current = list(user.get("open_dates") or [])
        if not current:
            continue
        shifted = sorted({_later_weekend(date.fromisoformat(day)).isoformat() for day in current})
        if shifted != sorted(current):
            db.update("users", user["id"], {"open_dates": shifted})
    db.insert("meta", {"id": _WEEKEND_SHIFT})
