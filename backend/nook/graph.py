"""Instagram and WhatsApp messaging through the Meta Graph API.

Blank META_GRAPH_TOKEN keeps the in-app thread working. Messages are stored
either way; Graph delivery is attempted only when the token and the account
id for that channel are set.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import re

import requests

GRAPH_HOST = "https://graph.facebook.com"


def graph_version() -> str:
    return os.getenv("META_GRAPH_VERSION", "v21.0").strip() or "v21.0"


def graph_token() -> str:
    return os.getenv("META_GRAPH_TOKEN", "").strip()


def whatsapp_configured() -> bool:
    return bool(graph_token() and os.getenv("WHATSAPP_PHONE_NUMBER_ID", "").strip())


def instagram_configured() -> bool:
    return bool(graph_token() and os.getenv("INSTAGRAM_ACCOUNT_ID", "").strip())


def normalize_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 10:
        digits = "1" + digits
    if 11 <= len(digits) <= 15:
        return digits
    return ""


def _post(url: str, payload: dict) -> dict:
    try:
        response = requests.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {graph_token()}"},
            timeout=12,
        )
    except requests.RequestException as exc:
        return {"ok": False, "id": "", "error": f"Graph API didn't answer: {exc.__class__.__name__}"}
    try:
        data = response.json()
    except ValueError:
        data = {}
    if response.status_code >= 400 or data.get("error"):
        error = data.get("error") or {}
        message = error.get("message") or (response.text or "Graph API rejected the message.")[:240]
        return {"ok": False, "id": "", "error": message}
    graph_id = ""
    messages = data.get("messages") or []
    if messages and isinstance(messages[0], dict):
        graph_id = messages[0].get("id") or ""
    graph_id = graph_id or data.get("message_id") or ""
    return {"ok": True, "id": graph_id, "error": ""}


def send_whatsapp(to_phone: str, text: str) -> dict:
    phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "").strip()
    if not whatsapp_configured():
        return {"ok": False, "id": "", "error": "WhatsApp isn't configured."}
    url = f"{GRAPH_HOST}/{graph_version()}/{phone_id}/messages"
    body = text[:4000]
    result = _post(
        url,
        {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to_phone,
            "type": "text",
            "text": {"preview_url": False, "body": body},
        },
    )
    template = os.getenv("WHATSAPP_TEMPLATE_NAME", "").strip()
    if result["ok"] or not template:
        return result
    language = os.getenv("WHATSAPP_TEMPLATE_LANG", "en_US").strip() or "en_US"
    templated = _post(
        url,
        {
            "messaging_product": "whatsapp",
            "to": to_phone,
            "type": "template",
            "template": {
                "name": template,
                "language": {"code": language},
                "components": [
                    {"type": "body", "parameters": [{"type": "text", "text": body[:900]}]},
                ],
            },
        },
    )
    if templated["ok"]:
        return templated
    return result


def send_instagram(recipient_id: str, text: str) -> dict:
    account = os.getenv("INSTAGRAM_ACCOUNT_ID", "").strip()
    if not instagram_configured():
        return {"ok": False, "id": "", "error": "Instagram isn't configured."}
    url = f"{GRAPH_HOST}/{graph_version()}/{account}/messages"
    return _post(url, {"recipient": {"id": recipient_id}, "message": {"text": text[:1000]}})


def signature_ok(body: bytes, header: str | None) -> bool:
    secret = os.getenv("META_APP_SECRET", "").strip()
    if not secret:
        return True
    if not header or not header.startswith("sha256="):
        return False
    digest = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, header.split("=", 1)[1])


def verify_subscription(mode: str, token: str, challenge: str) -> str | None:
    expected = os.getenv("META_WEBHOOK_VERIFY_TOKEN", "").strip()
    if not expected or mode != "subscribe" or not hmac.compare_digest(token or "", expected):
        return None
    return challenge
