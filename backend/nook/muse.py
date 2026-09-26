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

from .constants import AXIS_NAMES, INTERVIEW_QUESTIONS
from .embed import axes_from_signals
from .models import LifestyleAxes, LifestyleProfile, RerankResponse

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
        "keywords": ["Georgia Tech", "Yellow Jacket", "Nook", "couch", "dorm", "suite"],
    }
    response = requests.post(
        "https://api.meta.ai/v1/asr/transcribe",
        params={"sessionId": f"nook-{uuid.uuid4().hex[:12]}"},
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
    elif _has_any(text, ("messy", "clutter", "relaxed about")):
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

    first = (questionnaire.get("name") or "They").split()[0]
    year = (questionnaire.get("year_label") or "student").lower()
    major = questionnaire.get("major") or "their major"
    hometown = questionnaire.get("hometown") or "out of town"
    shown = interests[:3]
    if len(shown) == 1:
        interest_phrase = shown[0]
    elif len(shown) == 2:
        interest_phrase = f"{shown[0]} and {shown[1]}"
    else:
        interest_phrase = ", ".join(shown[:-1]) + f", and {shown[-1]}"
    sleep_phrase = {
        "early": "keeps early hours",
        "typical": "keeps typical college hours",
        "late": "keeps late hours",
        "nocturnal": "is basically nocturnal",
    }[sleep]
    bio = (
        f"{first} is a {year} {major} student from {hometown} who's into {interest_phrase}. "
        f"They keep a {cleanliness} space and {sleep_phrase}. {guest_notes}"
    )
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
        bio=bio,
        tags=interests[:4] + [cleanliness, sleep],
        axes=axes,
    )


def muse_extract(transcript: str, questionnaire: dict) -> LifestyleProfile:
    client = _client()
    questions = "\n".join(f"{index}. {question}" for index, question in enumerate(INTERVIEW_QUESTIONS, start=1))
    system = (
        "You write structured roommate profiles for Nook, a Georgia Tech weekend couch-surfing app. "
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


def extract_profile(transcript: str, questionnaire: dict) -> tuple[LifestyleProfile, str]:
    if muse_configured():
        try:
            return muse_extract(transcript, questionnaire), "muse-spark-1.3"
        except Exception as exc:
            print(f"Muse Spark extraction failed, using local parser: {exc}")
    return local_extract(transcript, questionnaire), "local-lifestyle-v1"


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
                "bio": life.get("bio"),
                "interests": life.get("interests"),
                "cleanliness": life.get("cleanliness"),
                "sleep_timing": life.get("sleep_timing"),
                "guest_notes": life.get("guest_notes"),
            }
        )
    system = (
        "Rank potential weekend hosts for a Georgia Tech student. "
        "Score each host from 0 to 1 for how comfortably the guest would share their room, "
        "using interests, cleanliness, sleep, and the tone of the bios. "
        "Include every user_id exactly once. reason is one sentence the guest will read."
    )
    user = json.dumps(
        {
            "guest": {
                "name": seeker.get("name"),
                "major": seeker.get("major"),
                "bio": seeker_life.get("bio"),
                "interests": seeker_life.get("interests"),
                "cleanliness": seeker_life.get("cleanliness"),
                "sleep_timing": seeker_life.get("sleep_timing"),
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
