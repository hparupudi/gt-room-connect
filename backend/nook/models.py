"""Pydantic models for the voice interview and Muse Spark structured output.

LifestyleAxes is the embedding. Meta's Model API does not expose a separate
embeddings endpoint, so Muse Spark 1.3 fills these 32 axes via JSON schema
constrained decoding. The values are L2-normalized and stored in Pinecone
(or the local vector store) for cosine similarity.
"""

from typing import Literal

from pydantic import BaseModel, Field

from .constants import AXIS_NAMES


class LifestyleAxes(BaseModel):
    outdoors: float = Field(ge=0, le=1)
    music: float = Field(ge=0, le=1)
    gaming: float = Field(ge=0, le=1)
    design: float = Field(ge=0, le=1)
    sports: float = Field(ge=0, le=1)
    food: float = Field(ge=0, le=1)
    nightlife: float = Field(ge=0, le=1)
    quiet_nights: float = Field(ge=0, le=1)
    early_riser: float = Field(ge=0, le=1)
    night_owl: float = Field(ge=0, le=1)
    spotless: float = Field(ge=0, le=1)
    relaxed_clean: float = Field(ge=0, le=1)
    stem: float = Field(ge=0, le=1)
    humanities: float = Field(ge=0, le=1)
    introvert: float = Field(ge=0, le=1)
    extrovert: float = Field(ge=0, le=1)
    cooking: float = Field(ge=0, le=1)
    film: float = Field(ge=0, le=1)
    reading: float = Field(ge=0, le=1)
    fitness: float = Field(ge=0, le=1)
    volunteering: float = Field(ge=0, le=1)
    travel: float = Field(ge=0, le=1)
    tech: float = Field(ge=0, le=1)
    art: float = Field(ge=0, le=1)
    conversation: float = Field(ge=0, le=1)
    low_noise: float = Field(ge=0, le=1)
    guests_ok: float = Field(ge=0, le=1)
    study: float = Field(ge=0, le=1)
    spontaneous: float = Field(ge=0, le=1)
    atlanta: float = Field(ge=0, le=1)
    planner: float = Field(ge=0, le=1)
    performance: float = Field(ge=0, le=1)

    def as_vector(self) -> list[float]:
        return [float(getattr(self, name)) for name in AXIS_NAMES]


class LifestyleProfile(BaseModel):
    interests: list[str] = Field(min_length=1, max_length=8)
    hobbies: list[str] = Field(min_length=1, max_length=8)
    cleanliness: Literal["spotless", "tidy", "average", "relaxed", "messy"]
    sleep_timing: Literal["early", "typical", "late", "nocturnal"]
    sleep_start: str = Field(description="Typical lights-out, 24h HH:MM")
    wake_time: str = Field(description="Typical wake time, 24h HH:MM")
    noise: Literal["quiet", "moderate", "social"]
    guest_notes: str
    bio: str = Field(description="Two or three warm sentences in the third person.")
    tags: list[str] = Field(max_length=10)
    axes: LifestyleAxes


class HostRank(BaseModel):
    user_id: str
    score: float = Field(ge=0, le=1)
    reason: str = Field(
        description="Exactly one sentence naming concrete things the guest and this host have in common."
    )


class RerankResponse(BaseModel):
    rankings: list[HostRank]


class MatchSentence(BaseModel):
    sentence: str = Field(
        description="Exactly one sentence, under 200 characters, naming what these two students have in common."
    )
