import base64
import os
from datetime import date, timedelta
from io import BytesIO

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
    unknown = client.post("/api/auth/email/start", json={"email": "maya@notaschool.edu"})
    assert unknown.status_code == 400
    stanford = client.post("/api/auth/email/start", json={"email": "guest@cs.stanford.edu"})
    assert stanford.status_code == 200
    assert stanford.get_json()["email"] == "guest@cs.stanford.edu"
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
    message_id = sent.get_json()["message"]["id"]
    assert sent.get_json()["message"]["channel"] == "dormsurf"
    assert sent.get_json()["message"]["delivery"] == "stored"
    assert sent.get_json()["message"]["deleted"] is False

    edited = client.patch(
        f"/api/bookings/{booking_id}/messages/{message_id}",
        json={"text": "I'll be at Glenn around 9."},
        headers=auth(andre),
    )
    assert edited.status_code == 200
    assert edited.get_json()["message"]["text"] == "I'll be at Glenn around 9."
    assert edited.get_json()["message"]["edited_at"]
    blocked = client.patch(
        f"/api/bookings/{booking_id}/messages/{message_id}",
        json={"text": "Changing someone else's message."},
        headers=auth(maya),
    )
    assert blocked.status_code == 400

    reacted = client.post(
        f"/api/bookings/{booking_id}/messages/{message_id}/reactions",
        json={"emoji": "👍"},
        headers=auth(maya),
    )
    assert reacted.status_code == 200
    reaction = reacted.get_json()["message"]["reactions"][0]
    assert reaction["emoji"] == "👍"
    assert reaction["count"] == 1
    assert reaction["mine"] is True
    switched = client.post(
        f"/api/bookings/{booking_id}/messages/{message_id}/reactions",
        json={"emoji": "❤️"},
        headers=auth(maya),
    )
    assert switched.status_code == 200
    only = switched.get_json()["message"]["reactions"]
    assert len(only) == 1
    assert only[0]["emoji"] == "❤️"
    assert only[0]["count"] == 1
    assert only[0]["mine"] is True
    andre_react = client.post(
        f"/api/bookings/{booking_id}/messages/{message_id}/reactions",
        json={"emoji": "👍"},
        headers=auth(andre),
    )
    pair = andre_react.get_json()["message"]["reactions"]
    assert {item["emoji"] for item in pair} == {"❤️", "👍"}
    assert next(item for item in pair if item["emoji"] == "👍")["mine"] is True
    moved = client.post(
        f"/api/bookings/{booking_id}/messages/{message_id}/reactions",
        json={"emoji": "❤️"},
        headers=auth(andre),
    )
    shared = moved.get_json()["message"]["reactions"]
    assert len(shared) == 1
    assert shared[0]["emoji"] == "❤️"
    assert shared[0]["count"] == 2
    assert shared[0]["mine"] is True
    cleared = client.post(
        f"/api/bookings/{booking_id}/messages/{message_id}/reactions",
        json={"emoji": "❤️"},
        headers=auth(maya),
    )
    left = cleared.get_json()["message"]["reactions"]
    assert len(left) == 1
    assert left[0]["emoji"] == "❤️"
    assert left[0]["count"] == 1
    assert left[0]["mine"] is False

    png = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    )
    photo = client.post(
        f"/api/bookings/{booking_id}/messages",
        data={"text": "The room", "image": (BytesIO(png), "room.png")},
        headers=auth(andre),
    )
    assert photo.status_code == 201, photo.get_json()
    photo_id = photo.get_json()["message"]["id"]
    assert photo.get_json()["message"]["image_url"].endswith("/image")
    fetched = client.get(photo.get_json()["message"]["image_url"], headers=auth(maya))
    assert fetched.status_code == 200
    assert fetched.mimetype == "image/png"
    assert fetched.data.startswith(b"\x89PNG")

    removed = client.delete(f"/api/bookings/{booking_id}/messages/{photo_id}", headers=auth(andre))
    assert removed.status_code == 200
    assert removed.get_json()["message"]["deleted"] is True
    assert removed.get_json()["message"]["text"] == ""
    gone = client.get(photo.get_json()["message"]["image_url"], headers=auth(maya))
    assert gone.status_code == 404
    outsider = client.delete(f"/api/bookings/{booking_id}/messages/{message_id}", headers=auth(elena))
    assert outsider.status_code == 404

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
    assert user["bio"] == ""
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

    long_take = client.post(
        "/api/me/interview",
        data={
            "duration_sec": "99999",
            "transcript": (
                "I'm into climbing and jazz. I keep a tidy room, fall asleep around midnight, and wake at 9. "
                "I like it quiet, and a weekend guest should text me first."
            ),
        },
        headers=auth(token),
    )
    assert long_take.status_code == 200, long_take.get_json()

    typed = client.post(
        "/api/me/interview/direct",
        json={
            "interests": "I love climbing and jazz concerts",
            "cleanliness": "tidy",
            "sleep_timing": "late",
            "noise": "quiet",
            "guest_notes": "Text me before you come over.",
        },
        headers=auth(token),
    )
    assert typed.status_code == 200, typed.get_json()
    typed_user = typed.get_json()["user"]
    assert typed.get_json()["transcript_source"] == "typed"
    assert typed_user["cleanliness"] == "tidy"
    assert typed_user["sleep_timing"] == "late"
    assert "climbing" in typed_user["interests"]


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
    thin = client.post(
        "/api/me/interview/answer",
        json={"index": 0, "answer": "idk"},
        headers=auth(token),
    )
    assert thin.status_code == 400
    good = client.post(
        "/api/me/interview/answer",
        json={"index": 0, "answer": "I love climbing and jazz on Friday nights."},
        headers=auth(token),
    )
    assert good.status_code == 200
    missing_clean = client.post(
        "/api/me/interview/direct",
        json={
            "interests": "I love climbing and jazz",
            "cleanliness": "",
            "sleep_timing": "late",
            "noise": "quiet",
            "guest_notes": "Text me before you head over.",
        },
        headers=auth(token),
    )
    assert missing_clean.status_code == 400

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
    glenn_body = client.get("/api/dorms/glenn", headers=auth(token)).get_json()["dorm"]
    housing = glenn_body["housing"]
    assert housing["room_style"] == "Double Traditional"
    glenn_three = next(level for level in glenn_body["floors"] if level["floor"] == 3)
    spot = next(item for item in glenn_three["hotspots"] if item["unit"] == "314")
    assert 0 <= spot["x"] < 1 and 0 <= spot["y"] < 1
    assert 0 < spot["w"] < 0.25 and 0 < spot["h"] < 0.25
    assert any(item["name"] == "Laundry" and "floors" in item["detail"] for item in housing["amenities"])
    assert any(item["name"] == "Bed" and any("38 in" in line for line in item["lines"]) for item in housing["dimensions"])
    assert housing["room"]["width_in"] == 180
    assert housing["room"]["depth_in"] == 132
    assert housing["room"]["range"] is True
    assert housing["room"]["drawing"] == "15' × 11'"
    assert "12'" in housing["room"]["summary"] and "15'" in housing["room"]["summary"]


def test_published_room_sizes(client):
    token = login(client, "maya.chen@gatech.edu")

    def room(dorm_id: str) -> dict:
        response = client.get(f"/api/dorms/{dorm_id}", headers=auth(token))
        assert response.status_code == 200
        return response.get_json()["dorm"]["housing"]["room"]

    west = room("armstrong")
    assert west["width_in"] == 15 * 12 and west["depth_in"] == 11 * 12
    assert west["range"] is False
    assert west["summary"] == "approximately 15' × 11'"
    harris = room("harris")
    assert harris["width_in"] == 12 * 12 and harris["depth_in"] == 10 * 12
    assert harris["occupants"] == 2 and harris["range"] is False
    woodruff = room("woodruff-south")
    assert woodruff["width_in"] == 15 * 12 and woodruff["depth_in"] == 12 * 12
    assert woodruff["drawing"] == "15' × 12'"
    apartment = room("crecine")
    assert apartment["width_in"] == 11 * 12 and apartment["depth_in"] == 8 * 12 + 10
    assert apartment["occupants"] == 1
    assert apartment["depth_label"] == "8' 10\""
    smith = room("smith")
    assert smith["width_in"] == 15 * 12 and smith["range"] is True


def test_inbox_after_a_request_is_accepted(client):
    andre = login(client, "andre.wallace@gatech.edu")
    maya = login(client, "maya.chen@gatech.edu")
    elena = login(client, "elena.vasquez@gatech.edu")

    quiet = client.get("/api/inbox", headers=auth(andre))
    assert quiet.status_code == 200
    assert quiet.get_json()["threads"] == []
    assert quiet.get_json()["unread"] == 0

    requested = client.post(
        "/api/bookings",
        json={"host_id": "maya-chen", "dates": [day(7)], "message": "Friday night?"},
        headers=auth(andre),
    )
    assert requested.status_code == 201, requested.get_json()
    booking_id = requested.get_json()["booking"]["id"]

    waiting = client.get("/api/inbox", headers=auth(maya)).get_json()
    assert waiting["threads"] == []
    assert waiting["notifications"][0]["kind"] == "request"
    assert waiting["notifications"][0]["title"] == "Andre Wallace asked to stay"
    assert waiting["unread"] == 1
    me = client.get("/api/auth/me", headers=auth(maya)).get_json()["user"]
    assert me["inbox_unread"] == 1
    assert me["incoming_pending"] == 1
    assert client.get("/api/inbox", headers=auth(andre)).get_json()["threads"] == []

    accepted = client.post(f"/api/bookings/{booking_id}/accept", headers=auth(maya))
    assert accepted.status_code == 200

    opened = client.get("/api/inbox", headers=auth(andre)).get_json()
    assert opened["threads"][0]["person"]["name"] == "Maya Chen"
    assert opened["threads"][0]["person"]["unit"] == "314"
    assert opened["threads"][0]["last_message"] is None
    assert opened["notifications"][0]["kind"] == "accepted"
    assert client.get("/api/inbox", headers=auth(andre), query_string={"q": "glenn 314"}).get_json()["threads"]
    assert client.get("/api/inbox", headers=auth(andre), query_string={"q": "priya"}).get_json()["threads"] == []
    # A search hides people, not the alerts.
    filtered = client.get("/api/inbox", headers=auth(andre), query_string={"q": "zzzz"}).get_json()
    assert filtered["threads"] == []
    assert filtered["notifications"][0]["kind"] == "accepted"

    sent = client.post(
        f"/api/bookings/{booking_id}/messages",
        json={"text": "Door's open after 8."},
        headers=auth(maya),
    )
    assert sent.status_code == 201
    guest = client.get("/api/inbox", headers=auth(andre)).get_json()
    assert guest["threads"][0]["unread"] == 1
    assert guest["notifications"][0]["kind"] == "message"
    assert "Door's open" in guest["notifications"][0]["body"]

    read = client.get(f"/api/bookings/{booking_id}/messages", headers=auth(andre))
    assert read.status_code == 200
    cleared = client.get("/api/inbox", headers=auth(andre)).get_json()
    assert cleared["threads"][0]["unread"] == 0
    assert cleared["threads"][0]["opened"] is True
    assert cleared["notifications"] == []
    assert client.get("/api/auth/me", headers=auth(andre)).get_json()["user"]["inbox_unread"] == 0

    outsider = client.get("/api/inbox", headers=auth(elena)).get_json()
    assert all(thread["booking_id"] != booking_id for thread in outsider["threads"])
    assert client.get(f"/api/bookings/{booking_id}/messages", headers=auth(elena)).status_code == 404


def _register(client, email: str) -> str:
    started = client.post("/api/auth/email/start", json={"email": email})
    assert started.status_code == 200, started.get_json()
    verified = client.post(
        "/api/auth/email/verify",
        json={"email": email, "code": started.get_json()["preview_code"]},
    )
    created = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "Jacket123",
            "verification_token": verified.get_json()["verification_token"],
        },
    )
    assert created.status_code == 200, created.get_json()
    return created.get_json()["token"]


def test_off_campus_skip_still_searches(client):
    token = _register(client, "off.campus@stanford.edu")
    blocked = client.post(
        "/api/me/questionnaire",
        json={
            "name": "Off Campus",
            "gender": "woman",
            "age": 20,
            "major": "Computer Science",
            "year": "2",
            "hometown": "Palo Alto, CA",
            "socials": {"instagram": "", "phone": "", "discord": ""},
        },
        headers=auth(token),
    )
    assert blocked.status_code == 400
    skipped = client.post("/api/me/room", json={"skip": True}, headers=auth(token))
    assert skipped.status_code == 200, skipped.get_json()
    profile = skipped.get_json()["user"]
    assert profile["onboarding_step"] == "about"
    assert profile["room_skipped"] is True
    assert not profile["dorm_id"]
    about = client.post(
        "/api/me/questionnaire",
        json={
            "name": "Off Campus",
            "gender": "woman",
            "age": 20,
            "major": "Computer Science",
            "year": "2",
            "hometown": "Palo Alto, CA",
            "socials": {"instagram": "off.campus", "phone": "404-555-0199", "discord": "off"},
        },
        headers=auth(token),
    )
    assert about.status_code == 200, about.get_json()
    assert about.get_json()["user"]["onboarding_step"] == "voice"
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
    assert interview.get_json()["user"]["onboarding_complete"] is True
    found = client.post(
        "/api/search",
        json={"dates": [day(0)], "query": "", "sort": "match", "page_size": 6},
        headers=auth(token),
    )
    assert found.status_code == 200, found.get_json()
    assert found.get_json()["results"]
    hosting = client.put("/api/me/availability", json={"dates": [day(0)]}, headers=auth(token))
    assert hosting.status_code == 400


def test_typing_indicator_is_visible_to_the_other_person(client):
    andre = login(client, "andre.wallace@gatech.edu")
    maya = login(client, "maya.chen@gatech.edu")
    requested = client.post(
        "/api/bookings",
        json={"host_id": "maya-chen", "dates": [day(8)], "message": "Saturday?"},
        headers=auth(andre),
    )
    assert requested.status_code == 201, requested.get_json()
    booking_id = requested.get_json()["booking"]["id"]
    too_soon = client.post(f"/api/bookings/{booking_id}/typing", json={"active": True}, headers=auth(andre))
    assert too_soon.status_code == 400
    assert client.post(f"/api/bookings/{booking_id}/accept", headers=auth(maya)).status_code == 200
    typing = client.post(f"/api/bookings/{booking_id}/typing", json={"active": True}, headers=auth(maya))
    assert typing.status_code == 200
    seen = client.get(f"/api/bookings/{booking_id}/typing", headers=auth(andre)).get_json()
    assert seen["typing"] == [{"id": "maya-chen", "name": "Maya Chen"}]
    assert client.get(f"/api/bookings/{booking_id}/typing", headers=auth(maya)).get_json()["typing"] == []
    legacy = client.post(
        f"/api/bookings/{booking_id}/messages",
        json={"channel": "nook", "text": "Still here."},
        headers=auth(andre),
    )
    assert legacy.status_code == 201
    assert legacy.get_json()["message"]["channel"] == "dormsurf"
    cleared = client.post(f"/api/bookings/{booking_id}/typing", json={"active": False}, headers=auth(maya))
    assert cleared.status_code == 200
    assert client.get(f"/api/bookings/{booking_id}/typing", headers=auth(andre)).get_json()["typing"] == []


def test_console_says_when_muse_spark_extracts(monkeypatch, capsys):
    from nook import muse

    monkeypatch.setattr(muse, "muse_configured", lambda: True)
    monkeypatch.setattr(muse, "muse_extract", lambda transcript, questionnaire: muse.local_extract(transcript, questionnaire))
    monkeypatch.setattr(muse, "compose_bio", lambda fields: "Maya keeps a tidy room. She climbs on Fridays.")
    _profile, model = muse.extract_profile(
        "I love climbing, keep a tidy quiet room, and fall asleep at 10pm.",
        {"name": "Maya", "major": "Computer Science"},
    )
    assert model == "muse-spark-1.3"
    assert "Muse Spark 1.3 is extracting this interview profile." in capsys.readouterr().out

    monkeypatch.setattr(muse, "muse_configured", lambda: False)
    muse.extract_profile(
        "I love climbing, keep a tidy quiet room, and fall asleep at 10pm.",
        {"name": "Maya", "major": "Computer Science"},
    )
    keyword = capsys.readouterr().out
    assert "Keyword detection is extracting this interview profile." in keyword
    assert "Muse Spark 1.3 is extracting this interview profile." not in keyword


def test_ending_weekend_moves_forward_once(client):
    from nook.db import get_db
    from nook.seed import shift_ending_weekend

    store = get_db()
    store.data["meta"] = [row for row in store.data.get("meta", []) if row.get("id") != "weekend-shift-2026-09-26"]
    store.update(
        "users",
        "maya-chen",
        {"open_dates": ["2026-09-26", "2026-09-27", "2026-09-28", "2026-10-03", "2026-10-04"]},
    )
    shift_ending_weekend()
    shifted = get_db().find_one("users", id="maya-chen")["open_dates"]
    assert shifted == ["2026-09-28", "2026-10-03", "2026-10-04", "2026-10-10", "2026-10-11"]
    get_db().update("users", "maya-chen", {"open_dates": ["2026-09-26", "2026-10-03"]})
    shift_ending_weekend()
    assert get_db().find_one("users", id="maya-chen")["open_dates"] == ["2026-09-26", "2026-10-03"]


def test_shared_room_stays_hidden_until_roommate_agrees(client):
    maya = login(client, "maya.chen@gatech.edu")
    andre = login(client, "andre.wallace@gatech.edu")
    me = client.get("/api/auth/me", headers=auth(maya)).get_json()["user"]
    assert me["roommates_needed"] == 1
    assert me["room_bookable"] is True
    assert me["roommates"][0]["status"] == "accepted"
    assert me["roommates"][0]["name"] == "Taylor Nguyen"
    assert me["open_dates"]

    solo = client.get("/api/auth/me", headers=auth(andre)).get_json()["user"]
    assert solo["roommates_needed"] == 0
    assert solo["room_bookable"] is True
    assert solo["roommates"] == []

    removed = client.delete("/api/me/roommates/seed-maya-chen", headers=auth(maya))
    assert removed.status_code == 200, removed.get_json()
    closed = removed.get_json()["user"]
    assert closed["open_dates"] == []
    assert closed["room_bookable"] is False

    blocked = client.put("/api/me/availability", json={"dates": [day(0)]}, headers=auth(maya))
    assert blocked.status_code == 400
    assert "roommate" in blocked.get_json()["error"].lower()

    self_invite = client.post("/api/me/roommates", json={"email": "maya.chen@gatech.edu"}, headers=auth(maya))
    assert self_invite.status_code == 400
    unknown = client.post("/api/me/roommates", json={"email": "nobody@gatech.edu"}, headers=auth(maya))
    assert unknown.status_code == 400
    assert "account" in unknown.get_json()["error"].lower()

    invited = client.post("/api/me/roommates", json={"email": "andre.wallace@gatech.edu"}, headers=auth(maya))
    assert invited.status_code == 201, invited.get_json()
    pending = invited.get_json()["user"]
    assert pending["room_bookable"] is False
    assert pending["roommates"][0]["status"] == "pending"
    consent_id = pending["roommates"][0]["id"]

    hidden = client.post(
        "/api/bookings",
        json={"host_id": "maya-chen", "dates": [day(0)]},
        headers=auth(andre),
    )
    assert hidden.status_code == 404

    asks = client.get("/api/roommate-asks", headers=auth(andre)).get_json()["asks"]
    assert [item["id"] for item in asks] == [consent_id]
    declined = client.post(f"/api/roommate-asks/{consent_id}/decline", headers=auth(andre))
    assert declined.status_code == 200
    assert declined.get_json()["ask"]["status"] == "declined"
    again = client.post("/api/me/roommates", json={"email": "andre.wallace@gatech.edu"}, headers=auth(maya))
    assert again.status_code == 400

    cleared = client.delete(f"/api/me/roommates/{consent_id}", headers=auth(maya))
    assert cleared.status_code == 200
    reinvited = client.post("/api/me/roommates", json={"email": "Andre.Wallace@gatech.edu"}, headers=auth(maya))
    assert reinvited.status_code == 201, reinvited.get_json()
    new_id = reinvited.get_json()["user"]["roommates"][0]["id"]
    accepted = client.post(f"/api/roommate-asks/{new_id}/accept", headers=auth(andre))
    assert accepted.status_code == 200
    assert accepted.get_json()["ask"]["status"] == "accepted"

    opened = client.put("/api/me/availability", json={"dates": [day(0)]}, headers=auth(maya))
    assert opened.status_code == 200, opened.get_json()
    assert opened.get_json()["user"]["room_bookable"] is True
    found = client.post(
        "/api/search",
        json={"dates": [day(0)], "query": "Glenn 314", "sort": "match"},
        headers=auth(andre),
    )
    assert [item["host"]["id"] for item in found.get_json()["results"]] == ["maya-chen"]
