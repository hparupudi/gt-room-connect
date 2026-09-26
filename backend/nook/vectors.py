"""Pinecone is the vector store when PINECONE_API_KEY is set.

Vectors are always kept on the user record as well, so cosine match still
works with a blank key. Dimension is 32 (LifestyleAxes), metric cosine.
"""

from __future__ import annotations

import os


def pinecone_configured() -> bool:
    return bool(os.getenv("PINECONE_API_KEY", "").strip())


def _index():
    from pinecone import Pinecone

    client = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
    return client.Index(os.getenv("PINECONE_INDEX", "nook"))


def upsert_vector(user_id: str, vector: list[float], metadata: dict) -> bool:
    if not pinecone_configured():
        return False
    clean = {key: value for key, value in metadata.items() if value not in (None, "")}
    try:
        _index().upsert(vectors=[{"id": user_id, "values": vector, "metadata": clean}])
        return True
    except Exception as exc:
        print(f"Pinecone upsert skipped: {exc}")
        return False


def fetch_vectors(ids: list[str]) -> dict[str, list[float]]:
    if not pinecone_configured() or not ids:
        return {}
    try:
        result = _index().fetch(ids=ids)
        vectors = getattr(result, "vectors", None) or result.get("vectors", {})
        found = {}
        for key, item in vectors.items():
            values = getattr(item, "values", None)
            if values is None and isinstance(item, dict):
                values = item.get("values")
            if values:
                found[key] = list(values)
        return found
    except Exception as exc:
        print(f"Pinecone fetch skipped: {exc}")
        return {}
