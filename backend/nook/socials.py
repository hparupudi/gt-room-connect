"""Social handles and the links opened after a stay is accepted.

Instagram and WhatsApp go straight to a message. A private Instagram goes to
the profile instead, so the other person can request to follow. Discord opens
the profile from a user id: Message if they are already friends, or a friend
request when the profile says they are not.
"""

from __future__ import annotations

import re

HANDLE = re.compile(r"^[A-Za-z0-9._]{1,30}$")
SNOWFLAKE = re.compile(r"^\d{17,20}$")
DISCORD_URL = re.compile(r"discord(?:app)?\.com/users/(\d{17,20})")


def normalize_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 10:
        digits = "1" + digits
    if 11 <= len(digits) <= 15:
        return digits
    return ""


def _discord_id(value: str) -> str:
    text = (value or "").strip()
    found = DISCORD_URL.search(text)
    if found:
        return found.group(1)
    if SNOWFLAKE.fullmatch(text):
        return text
    return ""


def normalize_socials(raw: dict | None) -> dict:
    raw = raw or {}
    instagram = str(raw.get("instagram") or "").strip().lstrip("@")[:30]
    phone = str(raw.get("phone") or "").strip()[:40]
    discord = str(raw.get("discord") or "").strip().lstrip("@")[:80]
    discord_id = _discord_id(str(raw.get("discord_id") or "")) or _discord_id(discord)
    if discord_id and discord == discord_id:
        discord = ""
    if DISCORD_URL.search(discord):
        discord = ""
    return {
        "instagram": instagram,
        "instagram_private": bool(raw.get("instagram_private")),
        "phone": phone,
        "discord": discord,
        "discord_id": discord_id,
        "discord_friend_request": bool(raw.get("discord_friend_request")),
    }


def social_links(socials: dict) -> dict:
    links: dict[str, dict] = {}
    handle = socials.get("instagram") or ""
    if handle and HANDLE.fullmatch(handle):
        if socials.get("instagram_private"):
            links["instagram"] = {
                "href": f"https://instagram.com/{handle}",
                "label": f"Request to follow @{handle} on Instagram",
                "kind": "profile",
            }
        else:
            links["instagram"] = {
                "href": f"https://ig.me/m/{handle}",
                "label": f"Message @{handle} on Instagram",
                "kind": "message",
            }
    phone = normalize_phone(socials.get("phone") or "")
    if phone:
        links["whatsapp"] = {
            "href": f"https://wa.me/{phone}",
            "label": "Message them on WhatsApp",
            "kind": "message",
        }
    discord_id = socials.get("discord_id") or ""
    name = socials.get("discord") or "them"
    if discord_id:
        if socials.get("discord_friend_request"):
            links["discord"] = {
                "href": f"https://discord.com/users/{discord_id}",
                "label": f"Send {name} a Discord friend request",
                "kind": "profile",
            }
        else:
            links["discord"] = {
                "href": f"https://discord.com/users/{discord_id}",
                "label": f"Message {name} on Discord",
                "kind": "message",
            }
    return links


def present_socials(raw: dict | None) -> dict:
    socials = normalize_socials(raw)
    return {**socials, "links": social_links(socials)}
