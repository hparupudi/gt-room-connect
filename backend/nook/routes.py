import os
import uuid
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from pathlib import Path

from flask import Flask, jsonify, request, send_file

from .constants import (
    CLEANLINESS,
    GENDERS,
    INTERVIEW_QUESTIONS,
    MAJORS,
    SLEEP,
    STYLES,
    YEAR_LABELS,
    YEARS,
)
from .db import get_db
from .errors import ApiError
from .mailer import send_verification, smtp_configured
from .floorplans import image_file
from .muse import (
    bio_fields,
    compose_bio,
    convert_to_wav,
    extract_profile,
    direct_entry_error,
    direct_entry_transcript,
    habit_gaps,
    is_template_bio,
    question_gap,
    match_sentence,
    muse_configured,
    transcribe_wav,
)
from .security import (
    check_password,
    hash_password,
    make_token,
    normalize_email,
    read_token,
    secret,
    validate_password,
)
from .seed import DEMO_PASSWORD
from .socials import HANDLE, normalize_socials
from .services import (
    accept_booking,
    apply_lifestyle,
    cancel_booking,
    create_booking,
    decline_booking,
    delete_message,
    dorm_detail,
    edit_message,
    get_booking,
    inbox_for,
    list_bookings,
    list_messages,
    message_image_path,
    map_overview,
    onboarding_step,
    parse_dates,
    save_room,
    react_message,
    search,
    send_message,
    serialize_user,
    set_availability,
    tag_list,
)
from .vectors import pinecone_configured


def _viewer():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    try:
        payload = read_token(header[7:].strip())
    except Exception:
        return None
    if payload.get("purpose"):
        return None
    return get_db().find_one("users", id=payload.get("sub"))


def _require():
    user = _viewer()
    if not user:
        raise ApiError("Log in to continue.", 401)
    return user


def _hash_code(code: str) -> str:
    return sha256(f"{secret()}:{code}".encode()).hexdigest()


def _rewrite_bio(host: dict) -> dict:
    """Replace a broken local blurb with one Muse writes from the structured profile."""
    life = dict(host.get("lifestyle") or {})
    bio = (life.get("bio") or "").strip()
    if bio and not is_template_bio(bio):
        return host
    if not muse_configured():
        return host
    fields = bio_fields(host, life)
    fields["year"] = YEAR_LABELS.get(host.get("year"), "") or fields["year"]
    try:
        written = compose_bio(fields)
    except Exception as exc:
        print(f"Muse Spark description failed, leaving it off: {exc}")
        return host
    life["bio"] = written
    updated = get_db().update("users", host["id"], {"lifestyle": life})
    return updated or host


def _me_payload(user: dict) -> dict:
    payload = serialize_user(user, user["id"])
    payload["incoming_pending"] = sum(
        1
        for booking in get_db().find_all("bookings")
        if booking.get("host_id") == user["id"] and booking.get("status") == "pending"
    )
    payload["inbox_unread"] = inbox_for(user)["unread"]
    return payload


def register_routes(app: Flask) -> None:
    @app.errorhandler(ApiError)
    def _api_error(exc: ApiError):
        return jsonify(error=exc.message), exc.status

    @app.errorhandler(404)
    def _missing(_exc):
        return jsonify(error="Not found."), 404

    @app.get("/api/health")
    def health():
        db = get_db()
        return jsonify(
            ok=True,
            store=db.mode,
            muse=muse_configured(),
            pinecone=pinecone_configured(),
            smtp=smtp_configured(),
            demo=os.getenv("DEMO_LOGIN", "1") != "0",
        )

    @app.get("/api/meta")
    def meta():
        payload = {
            "majors": MAJORS,
            "years": YEARS,
            "genders": GENDERS,
            "sleep": SLEEP,
            "cleanliness": CLEANLINESS,
            "styles": STYLES,
            "questions": INTERVIEW_QUESTIONS,
            "demo": os.getenv("DEMO_LOGIN", "1") != "0",
        }
        if payload["demo"]:
            payload["demo_password"] = DEMO_PASSWORD
            payload["demo_accounts"] = [
                {
                    "name": "Maya Chen",
                    "email": "maya.chen@gatech.edu",
                    "blurb": "Hosting in Glenn this weekend",
                },
                {
                    "name": "Andre Wallace",
                    "email": "andre.wallace@gatech.edu",
                    "blurb": "Looking for a couch",
                },
            ]
        return jsonify(payload)

    @app.post("/api/auth/email/start")
    def email_start():
        email = normalize_email((request.get_json(silent=True) or {}).get("email", ""))
        if get_db().find_one("users", email=email):
            raise ApiError("That email already has a Nook account. Log in instead.", 409)
        recent = datetime.now(timezone.utc) - timedelta(hours=1)
        sent = 0
        for code in get_db().find_all("codes"):
            if code.get("email") != email:
                continue
            try:
                created = datetime.fromisoformat(code.get("created_at"))
            except Exception:
                continue
            if created >= recent:
                sent += 1
        if sent >= 5:
            raise ApiError("Too many codes for that email. Wait a bit and try again.", 429)
        code_value = f"{uuid.uuid4().int % 1_000_000:06d}"
        get_db().insert(
            "codes",
            {
                "id": uuid.uuid4().hex,
                "email": email,
                "code_hash": _hash_code(code_value),
                "expires": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat(),
                "attempts": 0,
                "used": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        try:
            delivery = send_verification(email, code_value)
        except Exception as exc:
            print(f"SMTP failed, showing the code in the app instead: {exc}")
            delivery = "preview"
        body = {"ok": True, "email": email, "delivery": delivery}
        print(body, "that's the body")
        if delivery == "preview" or os.getenv("DEV_EXPOSE_EMAIL_CODES") == "1":
            body["preview_code"] = code_value
        return jsonify(body)

    @app.post("/api/auth/email/verify")
    def email_verify():
        data = request.get_json(silent=True) or {}
        email = normalize_email(data.get("email", ""))
        code_value = str(data.get("code", "")).strip()
        matches = [
            item
            for item in get_db().find_all("codes")
            if item.get("email") == email and not item.get("used")
        ]
        matches.sort(key=lambda item: item.get("created_at") or "", reverse=True)
        record = matches[0] if matches else None
        if not record:
            raise ApiError("Request a new code first.")
        try:
            expires = datetime.fromisoformat(record["expires"])
        except Exception:
            expires = datetime.now(timezone.utc) - timedelta(seconds=1)
        if expires < datetime.now(timezone.utc):
            raise ApiError("That code expired. Request a new one.")
        if record.get("attempts", 0) >= 5:
            raise ApiError("Too many tries. Request a new code.")
        if _hash_code(code_value) != record.get("code_hash"):
            get_db().update("codes", record["id"], {"attempts": record.get("attempts", 0) + 1})
            raise ApiError("That code doesn't match.")
        get_db().update("codes", record["id"], {"used": True})
        token = make_token(email, minutes=30, purpose="verify")
        return jsonify(ok=True, verification_token=token, email=email)

    @app.post("/api/auth/register")
    def register():
        data = request.get_json(silent=True) or {}
        email = normalize_email(data.get("email", ""))
        password = data.get("password") or ""
        token = data.get("verification_token") or ""
        try:
            payload = read_token(token)
        except Exception as exc:
            raise ApiError("Verify your email again before creating a password.") from exc
        if payload.get("purpose") != "verify" or payload.get("sub") != email:
            raise ApiError("Verify your email again before creating a password.")
        if get_db().find_one("users", email=email):
            raise ApiError("That email already has a Nook account. Log in instead.", 409)
        validate_password(password)
        user = {
            "id": uuid.uuid4().hex,
            "email": email,
            "password_hash": hash_password(password),
            "email_verified": True,
            "name": "",
            "gender": "",
            "age": None,
            "major": "",
            "year": "",
            "hometown": "",
            "socials": {"instagram": "", "phone": "", "discord": ""},
            "dorm_id": "",
            "floor": None,
            "unit": "",
            "open_dates": [],
            "lifestyle": None,
            "transcript": "",
            "embedding": [],
            "embedding_model": "",
            "onboarding_complete": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        get_db().insert("users", user)
        return jsonify(token=make_token(user["id"]), user=_me_payload(user))

    @app.post("/api/auth/login")
    def login():
        data = request.get_json(silent=True) or {}
        email = normalize_email(data.get("email", ""))
        password = data.get("password") or ""
        user = get_db().find_one("users", email=email)
        if not user or not user.get("password_hash"):
            raise ApiError("Email or password is wrong.", 401)
        if not check_password(password, user["password_hash"]):
            raise ApiError("Email or password is wrong.", 401)
        return jsonify(token=make_token(user["id"]), user=_me_payload(user))

    @app.get("/api/auth/me")
    def me():
        return jsonify(user=_me_payload(_require()))

    @app.post("/api/me/room")
    def update_room():
        user = _require()
        data = request.get_json(silent=True) or {}
        try:
            floor = int(data.get("floor"))
        except (TypeError, ValueError) as exc:
            raise ApiError("Pick a floor.") from exc
        open_dates = data.get("open_dates") if "open_dates" in data else None
        profile = save_room(user, data.get("dorm_id") or "", floor, str(data.get("unit") or ""), open_dates)
        return jsonify(user=profile)

    @app.post("/api/me/questionnaire")
    def questionnaire():
        user = _require()
        if onboarding_step(user) == "room":
            raise ApiError("Claim your room before the questionnaire.")
        data = request.get_json(silent=True) or {}
        name = (data.get("name") or "").strip()
        if len(name) < 2 or len(name) > 80:
            raise ApiError("Add the name you go by.")
        gender = data.get("gender") or ""
        if gender not in {item["id"] for item in GENDERS}:
            raise ApiError("Pick a gender option.")
        try:
            age = int(data.get("age"))
        except (TypeError, ValueError) as exc:
            raise ApiError("Add your age.") from exc
        if age < 16 or age > 40:
            raise ApiError("Age should be between 16 and 40.")
        major = data.get("major") or ""
        if major not in MAJORS:
            raise ApiError("Pick a major from the list.")
        year = data.get("year") or ""
        if year not in YEAR_LABELS:
            raise ApiError("Pick your year.")
        hometown = (data.get("hometown") or "").strip()
        if len(hometown) < 2 or len(hometown) > 80:
            raise ApiError("Add your hometown.")
        socials_in = data.get("socials") or {}
        socials = normalize_socials(socials_in)
        if str(socials_in.get("instagram") or "").strip() and not HANDLE.fullmatch(socials["instagram"]):
            raise ApiError("Instagram handles use letters, numbers, periods, and underscores.")
        if str(socials_in.get("discord_id") or "").strip() and not socials["discord_id"]:
            raise ApiError("A Discord user ID is the long number from Copy User ID, or a discord.com/users link.")
        patch = {
            "name": name,
            "gender": gender,
            "age": age,
            "major": major,
            "year": year,
            "hometown": hometown,
            "socials": socials,
        }
        updated = get_db().update("users", user["id"], patch)
        if updated.get("lifestyle"):
            from .embed import axes_from_signals

            life = updated["lifestyle"]
            signal = " ".join(
                [
                    updated.get("name") or "",
                    major,
                    hometown,
                    life.get("bio") or "",
                    " ".join(life.get("interests") or []),
                    updated.get("transcript") or "",
                ]
            )
            vector = axes_from_signals(
                signal,
                life.get("sleep_timing") or "typical",
                life.get("cleanliness") or "average",
                major,
                hometown,
                life.get("noise") or "moderate",
            )
            if updated.get("embedding_model") != "muse-spark-1.3":
                life["tags"] = tag_list(updated)
                embed_patch = {
                    "lifestyle": life,
                    **__import__("nook.services", fromlist=["store_embedding"]).store_embedding(updated, vector, "local-lifestyle-v1"),
                }
                updated = get_db().update("users", user["id"], embed_patch)
            else:
                life["tags"] = tag_list(updated)
                updated = get_db().update("users", user["id"], {"lifestyle": life})
        return jsonify(user=serialize_user(updated, user["id"]))

    def _ready_for_interview(person: dict) -> None:
        step = onboarding_step(person)
        if step == "room":
            raise ApiError("Claim your room before the interview.")
        if step == "about":
            raise ApiError("Finish the questionnaire before the interview.")

    def _save_interview(person: dict, transcript: str, source: str):
        gaps = habit_gaps(transcript)
        if gaps:
            missing = "; ".join(gaps)
            raise ApiError(f"Tell Nook the rest of your habits before this can be saved. Still missing: {missing}.")
        questionnaire = {
            "name": person.get("name") or "",
            "major": person.get("major") or "",
            "year": person.get("year") or "",
            "year_label": YEAR_LABELS.get(person.get("year") or "", ""),
            "hometown": person.get("hometown") or "",
            "gender": person.get("gender") or "",
            "age": person.get("age"),
        }
        profile, model = extract_profile(transcript, questionnaire)
        patch = apply_lifestyle(person, profile, model, transcript)
        updated = get_db().update("users", person["id"], patch)
        body = serialize_user(updated, person["id"])
        body["transcript_source"] = source
        return jsonify(user=body, transcript_source=source, embedding_model=model)

    @app.post("/api/me/interview")
    def interview():
        user = _require()
        step = onboarding_step(user)
        if step == "room":
            raise ApiError("Claim your room before the interview.")
        if step == "about":
            raise ApiError("Finish the questionnaire before the interview.")
        try:
            duration = float(request.form.get("duration_sec") or 0)
        except ValueError as exc:
            raise ApiError("The recording length didn't come through.") from exc
        if duration < 0:
            raise ApiError("That recording length doesn't look right.")
        transcript = (request.form.get("transcript") or "").strip()
        source = "browser"
        audio = request.files.get("audio")
        if audio and audio.filename and not transcript:
            folder = Path(__file__).resolve().parents[1] / "data" / "audio"
            folder.mkdir(parents=True, exist_ok=True)
            raw_path = folder / f"{user['id']}-{uuid.uuid4().hex[:8]}"
            suffix = Path(audio.filename).suffix.lower() or ".webm"
            if suffix not in {".webm", ".wav", ".mp3", ".m4a", ".ogg"}:
                suffix = ".webm"
            raw_path = raw_path.with_suffix(suffix)
            audio.save(raw_path)
            wav = raw_path.read_bytes() if suffix == ".wav" else convert_to_wav(raw_path)
            if wav and muse_configured():
                try:
                    heard = transcribe_wav(wav)
                    if heard:
                        transcript = heard
                        source = "muse-voice-transcribe-1.0"
                except Exception as exc:
                    print(f"Muse Voice Transcribe failed, using the browser transcript: {exc}")
        return _save_interview(user, transcript, source)

    @app.post("/api/me/interview/answer")
    def interview_answer():
        user = _require()
        _ready_for_interview(user)
        data = request.get_json(silent=True) or {}
        try:
            index = int(data.get("index"))
        except (TypeError, ValueError) as exc:
            raise ApiError("Pick a question first.") from exc
        gap = question_gap(index, data.get("answer") or "")
        if gap:
            raise ApiError(gap)
        return jsonify(ok=True)

    @app.post("/api/me/interview/direct")
    def interview_direct():
        user = _require()
        _ready_for_interview(user)
        data = request.get_json(silent=True) or {}
        interests = data.get("interests") or ""
        cleanliness = data.get("cleanliness") or ""
        sleep_timing = data.get("sleep_timing") or ""
        noise = data.get("noise") or ""
        guest_notes = data.get("guest_notes") or ""
        gap = direct_entry_error(interests, cleanliness, sleep_timing, noise, guest_notes)
        if gap:
            raise ApiError(gap)
        transcript = direct_entry_transcript(interests, cleanliness, sleep_timing, noise, guest_notes)
        return _save_interview(user, transcript, "typed")

    @app.patch("/api/me")
    def patch_me():
        return questionnaire()

    @app.put("/api/me/availability")
    def availability():
        user = _require()
        if not user.get("onboarding_complete"):
            raise ApiError("Finish your profile before opening your couch.")
        data = request.get_json(silent=True) or {}
        return jsonify(user=set_availability(user, data.get("dates") or []))

    @app.post("/api/search")
    def search_rooms():
        user = _require()
        if not user.get("onboarding_complete"):
            raise ApiError("Finish your profile before searching.")
        return jsonify(search(user, request.get_json(silent=True) or {}))

    @app.get("/api/map")
    def campus_map():
        user = _require()
        dates = [item for item in (request.args.get("dates") or "").split(",") if item]
        if dates:
            dates = parse_dates(dates)
        return jsonify(map_overview(user, dates))

    @app.get("/api/dorms/<dorm_id>")
    def one_dorm(dorm_id: str):
        user = _require()
        dates = [item for item in (request.args.get("dates") or "").split(",") if item]
        if dates:
            dates = parse_dates(dates)
        return jsonify(dorm=dorm_detail(dorm_id, user, dates))

    @app.get("/api/floorplans/<dorm_id>/<int:floor>")
    def floorplan_image(dorm_id: str, floor: int):
        path = image_file(dorm_id, floor)
        if path is None:
            raise ApiError("Housing hasn't published a floor plan for that level.", 404)
        kind = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
            ".gif": "image/gif",
        }.get(path.suffix.lower(), "image/jpeg")
        return send_file(path, mimetype=kind, max_age=86_400)

    @app.get("/api/directions")
    def directions():
        user = _require()
        from .dorms import find_unit, get_dorm
        from .routing import room_route

        from_id = request.args.get("from") or user.get("dorm_id") or ""
        from_unit = request.args.get("from_unit")
        if from_unit is None and from_id == user.get("dorm_id"):
            from_unit = user.get("unit") or None
        if not get_dorm(from_id):
            raise ApiError("Claim your room first so Nook knows where to start.")
        target = request.args.get("to") or ""
        if not get_dorm(target):
            raise ApiError("Pick a hall on the map.")
        to_unit = request.args.get("to_unit") or None
        if to_unit and not find_unit(target, to_unit):
            raise ApiError("That unit isn't in this hall.")
        if from_unit and not find_unit(from_id, from_unit):
            from_unit = None
        return jsonify(room_route(from_id, target, from_unit or None, to_unit))

    @app.get("/api/hosts/<host_id>")
    def host_profile(host_id: str):
        user = _require()
        host = get_db().find_one("users", id=host_id)
        if not host or not host.get("onboarding_complete"):
            raise ApiError("That profile isn't available.", 404)
        host = _rewrite_bio(host)
        payload = {"host": serialize_user(host, user["id"])}
        sentence, model = match_sentence(user, host)
        scores_payload = {
            "cosine": 0,
            "match": 0,
            "meters": 0,
            "minutes": 0,
            "reason": sentence,
            "reason_model": model,
        }
        if user.get("embedding") and host.get("embedding") and user.get("dorm_id") and host.get("dorm_id"):
            from .rank import score_pair

            scores = score_pair(user, host, {user["id"]: user["embedding"], host["id"]: host["embedding"]})
            scores_payload.update(
                {
                    "cosine": round(scores["cosine"], 3),
                    "match": round(scores["local"], 3),
                    "meters": scores["meters"],
                    "minutes": scores["minutes"],
                }
            )
        payload["scores"] = scores_payload
        return jsonify(payload)

    @app.post("/api/bookings")
    def book():
        user = _require()
        data = request.get_json(silent=True) or {}
        return jsonify(booking=create_booking(user, data.get("host_id") or "", data.get("dates") or [], data.get("message") or "")), 201

    @app.get("/api/inbox")
    def inbox():
        user = _require()
        return jsonify(inbox_for(user, request.args.get("q") or ""))

    @app.get("/api/bookings/incoming")
    def incoming():
        user = _require()
        return jsonify(bookings=list_bookings(user["id"], "incoming"))

    @app.get("/api/bookings/outgoing")
    def outgoing():
        user = _require()
        return jsonify(bookings=list_bookings(user["id"], "outgoing"))

    @app.get("/api/bookings/<booking_id>")
    def booking_detail(booking_id: str):
        user = _require()
        return jsonify(booking=get_booking(booking_id, user["id"]))

    @app.post("/api/bookings/<booking_id>/accept")
    def accept(booking_id: str):
        user = _require()
        return jsonify(booking=accept_booking(user, booking_id))

    @app.post("/api/bookings/<booking_id>/decline")
    def decline(booking_id: str):
        user = _require()
        return jsonify(booking=decline_booking(user, booking_id))

    @app.post("/api/bookings/<booking_id>/cancel")
    def cancel(booking_id: str):
        user = _require()
        return jsonify(booking=cancel_booking(user, booking_id))

    @app.get("/api/bookings/<booking_id>/messages")
    def booking_messages(booking_id: str):
        return jsonify(messages=list_messages(_require(), booking_id))

    @app.post("/api/bookings/<booking_id>/messages")
    def booking_message_send(booking_id: str):
        user = _require()
        if request.files or (request.content_type and "multipart/form-data" in request.content_type):
            text = request.form.get("text") or ""
            channel = request.form.get("channel") or "nook"
            image = request.files.get("image")
        else:
            data = request.get_json(silent=True) or {}
            text = data.get("text") or ""
            channel = data.get("channel") or "nook"
            image = None
        message = send_message(user, booking_id, channel, text, image)
        return jsonify(message=message), 201

    @app.patch("/api/bookings/<booking_id>/messages/<message_id>")
    def booking_message_edit(booking_id: str, message_id: str):
        user = _require()
        data = request.get_json(silent=True) or {}
        return jsonify(message=edit_message(user, booking_id, message_id, data.get("text") or ""))

    @app.delete("/api/bookings/<booking_id>/messages/<message_id>")
    def booking_message_delete(booking_id: str, message_id: str):
        user = _require()
        return jsonify(message=delete_message(user, booking_id, message_id))

    @app.post("/api/bookings/<booking_id>/messages/<message_id>/reactions")
    def booking_message_react(booking_id: str, message_id: str):
        user = _require()
        data = request.get_json(silent=True) or {}
        return jsonify(message=react_message(user, booking_id, message_id, data.get("emoji") or ""))

    @app.get("/api/bookings/<booking_id>/messages/<message_id>/image")
    def booking_message_image(booking_id: str, message_id: str):
        user = _require()
        path, kind = message_image_path(user["id"], booking_id, message_id)
        return send_file(path, mimetype=kind, max_age=0)
