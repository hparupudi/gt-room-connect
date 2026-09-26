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
    other = client.get("/api/directions?from=north-ave-east&from_unit=508&to=woodruff-south&to_unit=402A", headers=auth(token))
    assert other.status_code == 200
    assert other.get_json()["from"]["dorm_name"] == "North Avenue East"
    bad = client.get("/api/directions?to=glenn&to_unit=999", headers=auth(token))
    assert bad.status_code == 400
