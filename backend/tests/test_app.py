import os
from datetime import date, timedelta

import pytest

os.environ.setdefault("MONGODB_URI", "")
os.environ.setdefault("MODEL_API_KEY", "")
os.environ.setdefault("PINECONE_API_KEY", "")
os.environ.setdefault("SMTP_HOST", "")
os.environ.setdefault("FLASK_SECRET_KEY", "test-secret")


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_PATH", str(tmp_path / "db.json"))
    monkeypatch.setenv("MONGODB_URI", "")
    monkeypatch.setenv("MODEL_API_KEY", "")
    monkeypatch.setenv("PINECONE_API_KEY", "")
    monkeypatch.setenv("SMTP_HOST", "")
    monkeypatch.setenv("FLASK_SECRET_KEY", "test-secret")
    monkeypatch.setenv("DEMO_LOGIN", "1")
    monkeypatch.setenv("LIVE_ROUTING", "0")
    from nook.db import reset_state

    reset_state()
    from nook import create_app

    app = create_app()
    app.config["TESTING"] = True
    return app.test_client()


def day(offset: int) -> str:
    return (date.today() + timedelta(days=offset)).isoformat()


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def login(client, email: str) -> str:
    response = client.post("/api/auth/login", json={"email": email, "password": "WeekendNook!"})
    assert response.status_code == 200, response.get_json()
    return response.get_json()["token"]


def test_gatech_email_and_verification(client):
    rejected = client.post("/api/auth/email/start", json={"email": "maya@gmail.com"})
    assert rejected.status_code == 400
    started = client.post("/api/auth/email/start", json={"email": "new.jacket@gatech.edu"})
    assert started.status_code == 200
    body = started.get_json()
    assert body["delivery"] == "preview"
    assert len(body["preview_code"]) == 6
    wrong = client.post(
        "/api/auth/email/verify",
        json={"email": "new.jacket@gatech.edu", "code": "000000"},
    )
    assert wrong.status_code == 400
    verified = client.post(
        "/api/auth/email/verify",
        json={"email": "new.jacket@gatech.edu", "code": body["preview_code"]},
    )
    assert verified.status_code == 200
    token = verified.get_json()["verification_token"]
    short = client.post(
        "/api/auth/register",
        json={"email": "new.jacket@gatech.edu", "password": "short", "verification_token": token},
    )
    assert short.status_code == 400
    created = client.post(
        "/api/auth/register",
        json={"email": "new.jacket@gatech.edu", "password": "Jacket123", "verification_token": token},
    )
    assert created.status_code == 200
    user = created.get_json()["user"]
    assert "password" not in user
    assert user["email"] == "new.jacket@gatech.edu"
    assert user["onboarding_step"] == "room"
    assert user["socials_visible"] is True


def test_search_keyword_filters_and_sort(client):
    token = login(client, "andre.wallace@gatech.edu")
    missing = client.post("/api/search", json={"query": "glenn"}, headers=auth(token))
    assert missing.status_code == 400

    match = client.post(
        "/api/search",
        json={"dates": [day(0)], "query": "", "sort": "match", "page_size": 12},
        headers=auth(token),
    )
    assert match.status_code == 200
    payload = match.get_json()
    assert payload["ranker"] == "local-lifestyle-v1"
    assert payload["results"][0]["scores"]["reason"].endswith(".")
    assert "\n" not in payload["results"][0]["scores"]["reason"]
    assert payload["results"][0]["scores"]["reason_model"] == "local-lifestyle-v1"
    ids = [item["host"]["id"] for item in payload["results"]]
    assert "andre-wallace" not in ids
    assert "elena-vasquez" in ids
    assert "maya-chen" in ids
    assert ids.index("elena-vasquez") < ids.index("maya-chen")
    assert "socials" not in payload["results"][0]["host"]
    assert payload["results"][0]["host"]["socials_visible"] is False

    distance = client.post(
        "/api/search",
        json={"dates": [day(0)], "sort": "distance", "page_size": 12},
        headers=auth(token),
    )
    order = [item["host"]["id"] for item in distance.get_json()["results"]]
    assert order.index("elena-vasquez") < order.index("luis-ortega")

    named = client.post(
        "/api/search",
        json={"dates": [day(0)], "query": "Glenn 314", "sort": "match"},
        headers=auth(token),
    )
    found = [item["host"]["id"] for item in named.get_json()["results"]]
    assert found == ["maya-chen"]

    tidy = client.post(
        "/api/search",
        json={"dates": [day(0)], "cleanliness": ["spotless"], "sort": "match", "page_size": 12},
        headers=auth(token),
    )
    for item in tidy.get_json()["results"]:
        assert item["host"]["cleanliness"] == "spotless"


def test_booking_hides_socials_until_accept(client):
    andre = login(client, "andre.wallace@gatech.edu")
    elena = login(client, "elena.vasquez@gatech.edu")
    maya = login(client, "maya.chen@gatech.edu")

    own = client.post(
        "/api/bookings",
        json={"host_id": "andre-wallace", "dates": [day(5)]},
        headers=auth(andre),
    )
    assert own.status_code == 400

    requested = client.post(
        "/api/bookings",
        json={"host_id": "maya-chen", "dates": [day(0), day(1)], "message": "In town for the concert."},
        headers=auth(andre),
    )
    assert requested.status_code == 201
    booking_id = requested.get_json()["booking"]["id"]
    pending = client.get(f"/api/bookings/{booking_id}", headers=auth(andre))
    assert pending.get_json()["booking"]["host"]["socials_visible"] is False

    other = client.post(
        "/api/bookings",
        json={"host_id": "maya-chen", "dates": [day(0)], "message": "Climbing buddy."},
        headers=auth(elena),
    )
    assert other.status_code == 201
    other_id = other.get_json()["booking"]["id"]

    accepted = client.post(f"/api/bookings/{booking_id}/accept", headers=auth(maya))
    assert accepted.status_code == 200
    body = accepted.get_json()["booking"]
    assert body["status"] == "accepted"
    assert body["guest"]["socials"]["instagram"] == "andre.wav"
    assert body["host"]["socials"]["instagram"] == "maya.climbs"

    declined = client.get(f"/api/bookings/{other_id}", headers=auth(elena))
    assert declined.get_json()["booking"]["status"] == "declined"

    guest_view = client.get(f"/api/bookings/{booking_id}", headers=auth(andre))
    assert guest_view.get_json()["booking"]["host"]["socials_visible"] is True
    assert guest_view.get_json()["booking"]["reason"].endswith(".")


def test_messages_stay_in_nook_and_socials_link_out(client):
    andre = login(client, "andre.wallace@gatech.edu")
    maya = login(client, "maya.chen@gatech.edu")
    elena = login(client, "elena.vasquez@gatech.edu")
    requested = client.post(
        "/api/bookings",
        json={"host_id": "maya-chen", "dates": [day(7)], "message": "Friday?"},
        headers=auth(andre),
    )
    assert requested.status_code == 201, requested.get_json()
    booking = requested.get_json()["booking"]
    booking_id = booking["id"]
    assert booking["reason"].endswith(".")
    assert booking["reason_model"] == "local-lifestyle-v1"

    too_soon = client.post(
        f"/api/bookings/{booking_id}/messages",
        json={"channel": "nook", "text": "hey"},
        headers=auth(andre),
    )
    assert too_soon.status_code == 400

    accepted = client.post(f"/api/bookings/{booking_id}/accept", headers=auth(maya))
    assert accepted.status_code == 200
    links = accepted.get_json()["booking"]["host"]["socials"]["links"]
    assert links["instagram"]["href"] == "https://ig.me/m/maya.climbs"
    assert links["instagram"]["kind"] == "message"
    assert links["whatsapp"]["href"] == "https://wa.me/14045550142"
    assert "discord" not in links

    outside = client.post(
        f"/api/bookings/{booking_id}/messages",
        json={"channel": "whatsapp", "text": "I'll be at Glenn around 8."},
        headers=auth(andre),
    )
    assert outside.status_code == 400

    sent = client.post(
        f"/api/bookings/{booking_id}/messages",
        json={"text": "I'll be at Glenn around 8."},
        headers=auth(andre),
    )
    assert sent.status_code == 201
    assert sent.get_json()["message"]["channel"] == "nook"
    assert sent.get_json()["message"]["delivery"] == "stored"

    updated = client.post(
        "/api/me/questionnaire",
        json={
            "name": "Maya Chen",
            "gender": "woman",
            "age": 19,
            "major": "Computer Science",
            "year": "2",
            "hometown": "Duluth, GA",
            "socials": {
                "instagram": "maya.climbs",
                "instagram_private": True,
                "phone": "404-555-0142",
                "discord": "maya",
                "discord_id": "123456789012345678",
                "discord_friend_request": True,
            },
        },
        headers=auth(maya),
    )
    assert updated.status_code == 200
    guest_view = client.get(f"/api/bookings/{booking_id}", headers=auth(andre)).get_json()["booking"]["host"]["socials"]
    assert guest_view["links"]["instagram"]["href"] == "https://instagram.com/maya.climbs"
    assert guest_view["links"]["instagram"]["kind"] == "profile"
    assert guest_view["links"]["discord"]["href"] == "https://discord.com/users/123456789012345678"
    assert guest_view["links"]["discord"]["kind"] == "profile"
    opened = client.post(
        "/api/me/questionnaire",
        json={
            "name": "Maya Chen",
            "gender": "woman",
            "age": 19,
            "major": "Computer Science",
            "year": "2",
            "hometown": "Duluth, GA",
            "socials": {
                "instagram": "maya.climbs",
                "instagram_private": False,
                "phone": "404-555-0142",
                "discord": "maya",
                "discord_id": "https://discord.com/users/123456789012345678",
                "discord_friend_request": False,
            },
        },
        headers=auth(maya),
    )
    assert opened.status_code == 200
    open_links = client.get(f"/api/bookings/{booking_id}", headers=auth(andre)).get_json()["booking"]["host"]["socials"]["links"]
    assert open_links["instagram"]["kind"] == "message"
    assert open_links["discord"]["kind"] == "message"
    assert open_links["discord"]["href"] == "https://discord.com/users/123456789012345678"

    hidden = client.get(f"/api/bookings/{booking_id}/messages", headers=auth(elena))
    assert hidden.status_code == 404
    assert client.get("/api/webhooks/meta").status_code == 404


def test_voice_interview_structures_a_profile(client):
    started = client.post("/api/auth/email/start", json={"email": "voice.jacket@gatech.edu"})
    code = started.get_json()["preview_code"]
    verified = client.post(
        "/api/auth/email/verify",
        json={"email": "voice.jacket@gatech.edu", "code": code},
    )
    created = client.post(
        "/api/auth/register",
        json={
            "email": "voice.jacket@gatech.edu",
            "password": "Jacket123",
            "verification_token": verified.get_json()["verification_token"],
        },
    )
    token = created.get_json()["token"]
    room = client.post(
        "/api/me/room",
        json={"dorm_id": "glenn", "floor": 2, "unit": "208"},
        headers=auth(token),
    )
    assert room.status_code == 200
    about = client.post(
        "/api/me/questionnaire",
        json={
            "name": "Voice Jacket",
            "gender": "woman",
            "age": 20,
            "major": "Computer Science",
            "year": "2",
            "hometown": "Decatur, GA",
            "socials": {"instagram": "voice.jacket", "phone": "404-555-0100", "discord": "voice"},
        },
        headers=auth(token),
    )
    assert about.status_code == 200
    interview = client.post(
        "/api/me/interview",
        data={
            "duration_sec": "42",
            "transcript": (
                "I love climbing and jazz concerts. I stay up late, usually after midnight, "
                "and I'm pretty relaxed about clutter. A guest should text me first."
            ),
        },
        headers=auth(token),
    )
    assert interview.status_code == 200, interview.get_json()
    user = interview.get_json()["user"]
    assert user["onboarding_complete"] is True
    assert "climbing" in user["interests"]
    assert user["sleep_timing"] == "late"
    assert user["cleanliness"] == "relaxed"
    assert user["embedding_model"] == "local-lifestyle-v1"
    assert user["bio"]
    me = client.get("/api/auth/me", headers=auth(token))
    assert "password_hash" not in me.get_json()["user"]

    short = client.post(
        "/api/me/interview",
        data={
            "duration_sec": "8",
            "transcript": (
                "I'm into climbing and jazz. I keep a tidy room, fall asleep around midnight, and wake at 9. "
                "I like it quiet, and a weekend guest should text me first."
            ),
        },
        headers=auth(token),
    )
    assert short.status_code == 200, short.get_json()


def test_voice_interview_rejects_incomplete_habits(client):
    started = client.post("/api/auth/email/start", json={"email": "partial.jacket@gatech.edu"})
    code = started.get_json()["preview_code"]
    verified = client.post(
        "/api/auth/email/verify",
        json={"email": "partial.jacket@gatech.edu", "code": code},
    )
    created = client.post(
        "/api/auth/register",
        json={
            "email": "partial.jacket@gatech.edu",
            "password": "Jacket123",
            "verification_token": verified.get_json()["verification_token"],
        },
    )
    token = created.get_json()["token"]
    client.post(
        "/api/me/room",
        json={"dorm_id": "glenn", "floor": 2, "unit": "208"},
        headers=auth(token),
    )
    client.post(
        "/api/me/questionnaire",
        json={
            "name": "Partial Jacket",
            "gender": "man",
            "age": 19,
            "major": "Computer Science",
            "year": "1",
            "hometown": "Savannah, GA",
            "socials": {},
        },
        headers=auth(token),
    )
    early = client.post(
        "/api/me/interview",
        data={"duration_sec": "6", "transcript": "I love climbing and that's about it."},
        headers=auth(token),
    )
    assert early.status_code == 400
    message = early.get_json()["error"]
    assert "habits" in message
    assert "how clean you keep a shared room" in message
    assert "when you fall asleep and wake up" in message
    assert "noise and weekend guests" in message
    me = client.get("/api/auth/me", headers=auth(token))
    assert me.get_json()["user"]["onboarding_complete"] is False


def test_map_and_directions(client):
    token = login(client, "maya.chen@gatech.edu")
    campus = client.get("/api/map", headers=auth(token), query_string={"dates": day(0)})
    assert campus.status_code == 200
    dorms = {item["id"]: item for item in campus.get_json()["dorms"]}
    assert dorms["glenn"]["yours"] is True
    assert dorms["field"]["open_units"] >= 1
    detail = client.get(f"/api/dorms/field?dates={day(0)}", headers=auth(token))
    assert detail.status_code == 200
    floors = detail.get_json()["dorm"]["floors"]
    room = next(room for floor in floors for room in floor["rooms"] if room["unit"] == "405")
    assert room["status"] == "open"
    published = next(level for level in floors if level.get("official"))
    assert published["image"].startswith("/api/floorplans/field/")
    drawing = client.get(published["image"])
    assert drawing.status_code == 200
    assert drawing.mimetype.startswith("image/")
    assert room["hosts"][0]["name"] == "Elena Vasquez"
    assert dorms["glenn"]["footprint"][0][0][0] > 33.77
    assert dorms["glenn"]["specs"]["bath"]
    route = client.get("/api/directions?to=crecine&to_unit=204", headers=auth(token))
    body = route.get_json()
    assert body["source"] == "estimate"
    assert body["minutes"] >= 1
    assert len(body["points"]) >= 2
    assert body["from"] == {"dorm_id": "glenn", "dorm_name": "Glenn", "unit": "314", "floor": 3, "lat": body["from"]["lat"], "lng": body["from"]["lng"]}
    assert body["to"]["unit"] == "204" and body["to"]["floor"] == 2
    assert body["steps"][0].startswith("Leave Glenn 314 on floor 3")
    assert body["steps"][-1] == "Go up to floor 2 and find unit 204"
    near = client.get("/api/directions?to=field", headers=auth(token))
    assert near.get_json()["meters"] < body["meters"]
    other = client.get("/api/directions?from=north-ave-east&from_unit=E507&to=woodruff-south&to_unit=N402A", headers=auth(token))
    assert other.status_code == 200
    assert other.get_json()["from"]["dorm_name"] == "North Avenue East"
    bad = client.get("/api/directions?to=glenn&to_unit=999", headers=auth(token))
    assert bad.status_code == 400
    armstrong = client.get("/api/dorms/armstrong", headers=auth(token))
    floor_one = next(level for level in armstrong.get_json()["dorm"]["floors"] if level["floor"] == 1)
    numbers = [room["unit"] for room in floor_one["rooms"]]
    assert "101" in numbers and "126" in numbers and "119" in numbers
    assert "120" not in numbers
    assert len(numbers) > 12
    glenn = client.get("/api/dorms/glenn", headers=auth(token))
    glenn_one = next(level for level in glenn.get_json()["dorm"]["floors"] if level["floor"] == 1)
    glenn_numbers = [room["unit"] for room in glenn_one["rooms"]]
    assert "179A" in glenn_numbers or "178A" in glenn_numbers
    assert len(glenn_numbers) > 16
