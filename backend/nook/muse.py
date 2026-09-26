"""Voice transcription and structured extraction via Meta Model API.

Blank MODEL_API_KEY keeps the interview working: the browser transcript is
parsed locally into the same LifestyleProfile schema.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import uuid
from pathlib import Path

import requests
from pydantic import BaseModel, Field

from .constants import AXIS_NAMES, CLEANLINESS, INTERVIEW_QUESTIONS, SLEEP
from .embed import axes_from_signals
from .models import LifestyleAxes, LifestyleProfile, MatchSentence, RerankResponse

SLEEP_CLOCK = {
    "early": ("22:30", "07:00"),
    "typical": ("23:30", "08:00"),
    "late": ("01:00", "09:30"),
    "nocturnal": ("02:30", "10:30"),
}

INTEREST_LEXICON = [
    ("climbing", ("climb", "bouldering")),
    ("music", ("music", "concert", "jazz", "guitar", "piano", "dj", "band")),
    ("gaming", ("gaming", "video game", "xbox", "steam")),
    ("design", ("design", "drawing", "studio", "ceramic", "sketch")),
    ("basketball", ("basketball",)),
    ("cooking", ("cooking", "baking")),
    ("photography", ("photo", "camera")),
    ("reading", ("reading", "novel", "book")),
    ("running", ("running", "jog")),
    ("dance", ("dance",)),
    ("film", ("film", "movie", "cinema")),
    ("soccer", ("soccer",)),
    ("volunteering", ("volunteer",)),
    ("rockets", ("rocket", "aerospace")),
    ("startups", ("startup", "founder")),
    ("cycling", ("cycling", "bike")),
    ("chess", ("chess",)),
    ("coffee", ("coffee", "espresso")),
]


def muse_configured() -> bool:
    return bool(os.getenv("MODEL_API_KEY", "").strip())


def _client():
    from openai import OpenAI

    return OpenAI(base_url="https://api.meta.ai/v1", api_key=os.environ["MODEL_API_KEY"].strip())


def convert_to_wav(source: Path) -> bytes | None:
    if shutil.which("ffmpeg") is None:
        return None
    target = source.with_suffix(".wav")
    proc = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(source),
            "-ac",
            "1",
            "-ar",
            "24000",
            "-c:a",
            "pcm_s16le",
            "-map_metadata",
            "-1",
            str(target),
        ],
        capture_output=True,
    )
    if proc.returncode != 0 or not target.exists():
        return None
    data = target.read_bytes()
    target.unlink(missing_ok=True)
    return data


def transcribe_wav(wav_bytes: bytes) -> str | None:
    if not muse_configured() or not wav_bytes:
        return None
    request_body = {
        "mode": "PUSH_TO_TALK",
        "model": "muse-voice-transcribe-1.0",
        "audioEncoding": "WAV",
        "languageBias": ["English"],
        "keywords": ["Georgia Tech", "Yellow Jacket", "Dormsurf", "bed", "space", "dorm", "suite"],
    }
    response = requests.post(
        "https://api.meta.ai/v1/asr/transcribe",
        params={"sessionId": f"dormsurf-{uuid.uuid4().hex[:12]}"},
        headers={"Authorization": f"Bearer {os.environ['MODEL_API_KEY'].strip()}"},
        files={
            "request": (None, json.dumps(request_body), "application/json"),
            "audio": ("interview.wav", wav_bytes, "audio/wav"),
        },
        timeout=60,
    )
    response.raise_for_status()
    payload = response.json()
    transcript = (payload.get("transcript") or "").strip()
    return transcript or None


def _has(text: str, phrase: str) -> bool:
    return re.search(rf"(?<![a-z0-9]){re.escape(phrase)}", text) is not None


def _has_any(text: str, phrases: tuple[str, ...]) -> bool:
    return any(_has(text, phrase) for phrase in phrases)


def local_extract(transcript: str, questionnaire: dict) -> LifestyleProfile:
    text = transcript.lower()
    interests = [label for label, words in INTEREST_LEXICON if _has_any(text, words)]
    if not interests:
        interests = ["meeting new people"]

    if _has_any(text, ("spotless", "very clean", "immaculate")):
        cleanliness = "spotless"
    elif _has_any(text, ("messy", "dirty")):
        cleanliness = "messy"
    elif _has_any(text, ("clutter", "relaxed about")):
        cleanliness = "relaxed"
    elif _has_any(text, ("tidy", "neat", "pretty clean")):
        cleanliness = "tidy"
    else:
        cleanliness = "average"

    if _has_any(text, ("nocturnal", "night owl", "3am", "3 am", "after 2")):
        sleep = "nocturnal"
    elif _has_any(text, ("late", "after midnight", "1am", "1 am", "2am", "2 am")):
        sleep = "late"
    elif _has_any(text, ("early", "sunrise", "before 11", "10pm", "10 pm", "11pm")):
        sleep = "early"
    else:
        sleep = "typical"

    if _has_any(text, ("quiet", "headphones", "library")):
        noise = "quiet"
    elif _has_any(text, ("party", "social", "guests over", "people over")):
        noise = "social"
    else:
        noise = "moderate"

    sleep_start, wake_time = SLEEP_CLOCK[sleep]
    guest_notes = {
        "quiet": "A quiet guest who tidies up after themselves will fit right in.",
        "social": "They're fine with a guest who wants to talk, as long as plans are clear.",
        "moderate": "They're easy about a weekend guest who texts before coming up.",
    }[noise]
    if _has(text, "key") or _has(text, "text"):
        guest_notes = "Text before you head over and leave the room the way you found it."

    major = questionnaire.get("major") or ""
    hometown = questionnaire.get("hometown") or ""
    signal = " ".join([transcript, major, hometown, " ".join(interests)])
    vector = axes_from_signals(signal, sleep, cleanliness, major, hometown, noise)
    axes = LifestyleAxes(**dict(zip(AXIS_NAMES, vector)))
    return LifestyleProfile(
        interests=interests[:8],
        hobbies=interests[:8],
        cleanliness=cleanliness,
        sleep_timing=sleep,
        sleep_start=sleep_start,
        wake_time=wake_time,
        noise=noise,
        guest_notes=guest_notes,
        bio="",
        tags=interests[:4] + [cleanliness, sleep],
        axes=axes,
    )


def muse_extract(transcript: str, questionnaire: dict) -> LifestyleProfile:
    client = _client()
    questions = "\n".join(f"{index}. {question}" for index, question in enumerate(INTERVIEW_QUESTIONS, start=1))
    system = (
        "You write structured roommate profiles for Dormsurf, a weekend bed-sharing app for Georgia Tech halls. "
        "Turn the interview transcript into the schema. The axes are a 32-dimensional lifestyle embedding "
        "between 0 and 1: higher means the person more strongly fits that trait. "
        "Make the bio two or three specific sentences in the third person. Do not invent social media handles."
    )
    user = (
        f"Questions they were asked:\n{questions}\n\n"
        f"Questionnaire: {json.dumps(questionnaire)}\n\n"
        f"Transcript:\n{transcript}"
    )
    response = client.beta.chat.completions.parse(
        model="muse-spark-1.3",
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        response_format=LifestyleProfile,
    )
    parsed = response.choices[0].message.parsed
    if parsed is None:
        raise RuntimeError("Muse Spark returned an empty profile")
    return parsed


_CLEAN_WORDS = ("clean", "tidy", "messy", "clutter", "spotless", "neat", "organized", "dirty", "immaculate")
_SLEEP_WORDS = ("sleep", "asleep", "wake", "waking", "awake", "midnight", "bedtime", "night owl", "nocturnal", "sunrise")
_NOISE_WORDS = (
    "quiet",
    "loud",
    "noise",
    "noisy",
    "headphone",
    "party",
    "guest",
    "people over",
    "crash",
    "visitor",
    "weekend",
)
_FILLER = {
    "idk",
    "i don't know",
    "i dont know",
    "nothing",
    "n/a",
    "na",
    "pass",
    "skip",
    "ok",
    "okay",
    "yes",
    "no",
    "sure",
    "whatever",
}


def _named_interest(text: str) -> bool:
    interests = [label for label, words in INTEREST_LEXICON if _has_any(text, words)]
    if interests or _has_any(text, ("into", "hobby", "hobbies", "club", "clubs")):
        return True
    if re.search(r"\bi (?:really |also )?(?:love|enjoy)\b", text):
        return True
    return re.search(r"\bi (?:really |also )?like (?!it\b|to keep\b|things\b)", text) is not None


def _named_clean(text: str) -> bool:
    return _has_any(text, _CLEAN_WORDS)


def _named_sleep(text: str) -> bool:
    if re.search(r"\b\d{1,2}(?::\d{2})?\s*(a\.?m\.?|p\.?m\.?)\b", text):
        return True
    return _has_any(text, _SLEEP_WORDS)


def _named_noise(text: str) -> bool:
    return _has_any(text, _NOISE_WORDS)


def habit_gaps(transcript: str) -> list[str]:
    """Topics the interview still needs before a profile can be saved.

    Length does not matter. A short take is complete when it covers interests,
    cleanliness, sleep, and how the person feels about noise or weekend guests.
    """
    text = transcript.lower()
    gaps: list[str] = []
    if not _named_interest(text):
        gaps.append("what you're into")
    if not _named_clean(text):
        gaps.append("how clean you keep a shared room")
    if not _named_sleep(text):
        gaps.append("when you fall asleep and wake up")
    if not _named_noise(text):
        gaps.append("how you feel about noise and weekend guests")
    return gaps


def question_gap(index: int, answer: str) -> str | None:
    """Why this one answer is not enough to leave the question, or None."""
    text = " ".join((answer or "").split())
    lowered = text.lower().strip(" .!?")
    if index < 0 or index >= len(INTERVIEW_QUESTIONS):
        return "That question isn't part of the interview."
    if len(text) < 12 or lowered in _FILLER:
        return "Add a real answer before going on."
    if index == 0 and not _named_interest(lowered):
        return "Say what you're into — a club, hobby, or the kind of Friday you actually want."
    if index == 1:
        missing = []
        if not _named_clean(lowered):
            missing.append("how clean you keep a shared room")
        if not _named_noise(lowered):
            missing.append("how you feel about noise or guests")
        if missing:
            return "This question still needs " + " and ".join(missing) + "."
    if index == 2 and not _named_sleep(lowered):
        return "Say when you fall asleep and when you wake up."
    if index == 3 and len(text) < 20:
        return "Say what a weekend guest should know before you save."
    return None


def direct_entry_error(interests: str, cleanliness: str, sleep_timing: str, noise: str, guest_notes: str) -> str | None:
    """Validate a typed habit form. Returns one message, or None when it is complete."""
    gap = question_gap(0, interests)
    if gap:
        return gap
    if cleanliness not in {item["id"] for item in CLEANLINESS}:
        return "Pick how clean you keep a shared room."
    if sleep_timing not in {item["id"] for item in SLEEP}:
        return "Pick when you usually fall asleep."
    if noise not in {"quiet", "moderate", "social"}:
        return "Pick how you feel about noise and guests."
    return question_gap(3, guest_notes)


def direct_entry_transcript(interests: str, cleanliness: str, sleep_timing: str, noise: str, guest_notes: str) -> str:
    clean_phrase = {
        "spotless": "I keep a spotless, very clean shared room.",
        "tidy": "I keep a tidy, neat shared room.",
        "average": "I keep a shared room at an average level of clean.",
        "relaxed": "I'm relaxed about clutter in the shared room.",
        "messy": "I keep a messy shared room.",
    }[cleanliness]
    sleep_phrase = {
        "early": "I fall asleep early and wake up early.",
        "typical": "I fall asleep and wake up on a typical schedule.",
        "late": "I stay up late and wake up late.",
        "nocturnal": "I'm nocturnal and fall asleep after 2.",
    }[sleep_timing]
    noise_phrase = {
        "quiet": "I like quiet nights and a quiet weekend guest.",
        "moderate": "I'm moderate about noise and weekend guests.",
        "social": "I'm social and fine with guests over on the weekend.",
    }[noise]
    return (
        f"I'm into {interests.strip()}. {clean_phrase} {sleep_phrase} {noise_phrase} "
        f"A weekend guest should know: {guest_notes.strip()}"
    )


class ProfileBio(BaseModel):
    bio: str = Field(description="Exactly two grammatical sentences in the third person.")


def is_template_bio(bio: str) -> bool:
    """The old local blurb disagrees with itself ('keep a average', 'keeps early hours')."""
    text = (bio or "").lower()
    return "who's into" in text and "they keep a" in text


def compose_bio(fields: dict) -> str:
    """Ask Muse to write the blurb from structured fields. Raises if the model is off or fails."""
    client = _client()
    system = (
        "Write a roommate blurb for Dormsurf from the structured fields only. "
        "Exactly two sentences, third person, grammatically correct. "
        "Use the person's name. Do not invent interests, hours, hometowns, or habits that are not in the fields. "
        "Leave a field out when it is empty. Do not mention social media."
    )
    response = client.beta.chat.completions.parse(
        model="muse-spark-1.3",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(fields)},
        ],
        response_format=ProfileBio,
    )
    parsed = response.choices[0].message.parsed
    if parsed is None or not parsed.bio.strip():
        raise RuntimeError("Muse Spark returned an empty description")
    sentence = " ".join(parsed.bio.split())
    if sentence[-1] not in ".!?":
        sentence += "."
    return sentence


def bio_fields(person: dict, life: dict | None = None) -> dict:
    habits = life if life is not None else (person.get("lifestyle") or {})
    return {
        "name": person.get("name") or "",
        "year": person.get("year_label") or person.get("year") or "",
        "major": person.get("major") or "",
        "hometown": person.get("hometown") or "",
        "interests": habits.get("interests") or [],
        "hobbies": habits.get("hobbies") or [],
        "cleanliness": habits.get("cleanliness") or "",
        "sleep_timing": habits.get("sleep_timing") or "",
        "sleep_start": habits.get("sleep_start") or "",
        "wake_time": habits.get("wake_time") or "",
        "noise": habits.get("noise") or "",
        "guest_notes": habits.get("guest_notes") or "",
    }


def extract_profile(transcript: str, questionnaire: dict) -> tuple[LifestyleProfile, str]:
    model_name = "local-lifestyle-v1"
    profile = None
    if muse_configured():
        try:
            profile = muse_extract(transcript, questionnaire)
            model_name = "muse-spark-1.3"
        except Exception as exc:
            print(f"Muse Spark extraction failed, using local parser: {exc}")
    if profile is None:
        profile = local_extract(transcript, questionnaire)
    profile.bio = ""
    if muse_configured():
        try:
            profile.bio = compose_bio(bio_fields(questionnaire, profile.model_dump()))
        except Exception as exc:
            print(f"Muse Spark description failed, leaving it off: {exc}")
            profile.bio = ""
    return profile, model_name


def muse_rerank(seeker: dict, hosts: list[dict]) -> RerankResponse:
    client = _client()
    seeker_life = seeker.get("lifestyle") or {}
    packets = []
    for host in hosts:
        life = host.get("lifestyle") or {}
        packets.append(
            {
                "user_id": host["id"],
                "name": host.get("name"),
                "year": host.get("year"),
                "major": host.get("major"),
                "hometown": host.get("hometown"),
                "bio": life.get("bio"),
                "interests": life.get("interests"),
                "hobbies": life.get("hobbies"),
                "cleanliness": life.get("cleanliness"),
                "sleep_timing": life.get("sleep_timing"),
                "noise": life.get("noise"),
                "guest_notes": life.get("guest_notes"),
            }
        )
    system = (
        "Rank potential weekend hosts for a Georgia Tech student. "
        "Score each host from 0 to 1 for how comfortably the guest would share their room. "
        "Include every user_id exactly once. "
        "reason is exactly one sentence the guest will read, naming concrete things they have in common "
        "(shared interests or hobbies, similar sleep, cleanliness, noise, major, or hometown). "
        "Do not invent overlap. If they share little, name the closest real alignment. No second sentence."
    )
    user = json.dumps(
        {
            "guest": {
                "name": seeker.get("name"),
                "major": seeker.get("major"),
                "hometown": seeker.get("hometown"),
                "bio": seeker_life.get("bio"),
                "interests": seeker_life.get("interests"),
                "hobbies": seeker_life.get("hobbies"),
                "cleanliness": seeker_life.get("cleanliness"),
                "sleep_timing": seeker_life.get("sleep_timing"),
                "noise": seeker_life.get("noise"),
            },
            "hosts": packets,
        }
    )
    response = client.beta.chat.completions.parse(
        model="muse-spark-1.3",
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        response_format=RerankResponse,
    )
    parsed = response.choices[0].message.parsed
    if parsed is None:
        raise RuntimeError("Muse Spark returned an empty ranking")
    return parsed


def _packet(person: dict) -> dict:
    life = person.get("lifestyle") or {}
    return {
        "name": person.get("name"),
        "major": person.get("major"),
        "hometown": person.get("hometown"),
        "year": person.get("year"),
        "bio": life.get("bio"),
        "interests": life.get("interests"),
        "hobbies": life.get("hobbies"),
        "cleanliness": life.get("cleanliness"),
        "sleep_timing": life.get("sleep_timing"),
        "noise": life.get("noise"),
        "guest_notes": life.get("guest_notes"),
    }


def muse_match_sentence(seeker: dict, host: dict) -> str:
    client = _client()
    system = (
        "You explain why two Georgia Tech students matched for a weekend room share. "
        "Write exactly one sentence naming concrete things they have in common: shared interests or hobbies, "
        "similar sleep, cleanliness, noise, the same major, or the same hometown. "
        "Use only facts in the profiles. Do not invent overlap. "
        "If they share little, name the closest real alignment. No greeting and no second sentence."
    )
    response = client.beta.chat.completions.parse(
        model="muse-spark-1.3",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps({"guest": _packet(seeker), "host": _packet(host)})},
        ],
        response_format=MatchSentence,
    )
    parsed = response.choices[0].message.parsed
    if parsed is None or not parsed.sentence.strip():
        raise RuntimeError("Muse Spark returned an empty match sentence")
    sentence = " ".join(parsed.sentence.split())
    if sentence[-1] not in ".!?":
        sentence += "."
    return sentence


def match_sentence(seeker: dict, host: dict) -> tuple[str, str]:
    from .rank import match_reason

    local = match_reason(seeker, host)
    if muse_configured():
        try:
            return muse_match_sentence(seeker, host), "muse-spark-1.3"
        except Exception as exc:
            print(f"Muse Spark match sentence failed, using the local one: {exc}")
    return local, "local-lifestyle-v1"
