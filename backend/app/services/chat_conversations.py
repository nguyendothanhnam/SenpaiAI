"""Shared utilities for text and voice chat conversation records."""

from datetime import datetime, timedelta, timezone
from typing import Iterable
from uuid import uuid4

from ..core.config import settings


def normalize_title(text: str, max_length: int | None = None) -> str:
    """Build a short title from the first non-empty line without calling an LLM."""
    limit = max_length or settings.chat_conversation_title_max_length
    lines = (line.strip() for line in (text or "").splitlines())
    first_line = next((" ".join(line.split()) for line in lines if line.strip()), "")
    if len(first_line) > limit:
        return first_line[: max(0, limit - 1)].rstrip() + "…"
    return first_line or "New conversation"


def _as_utc(value: datetime) -> datetime:
    if value is None:
        return datetime.min.replace(tzinfo=timezone.utc)
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def group_legacy_chat_rows(rows: Iterable, gap_hours: int | None = None) -> list[dict]:
    """Group unassigned history by user and mode, splitting after a long idle gap."""
    gap = timedelta(hours=gap_hours or settings.chat_history_group_gap_hours)
    grouped: list[dict] = []
    active_by_user: dict[int, dict] = {}

    ordered = sorted(
        (row for row in rows if not row.conversation_id),
        key=lambda row: (row.user_id, _as_utc(row.created_at), row.id),
    )
    for row in ordered:
        created_at = _as_utc(row.created_at)
        mode = "voice" if row.input_mode == "voice" else "text"
        group_key = (row.user_id, mode)
        current = active_by_user.get(group_key)
        if current is None or created_at - current["last_activity_at"] > gap:
            current = {
                "id": uuid4(),
                "user_id": row.user_id,
                "title": normalize_title(row.question),
                "title_is_auto": True,
                "is_pinned": False,
                "mode": mode,
                "created_at": created_at,
                "last_activity_at": created_at,
                "rows": [],
            }
            grouped.append(current)
            active_by_user[group_key] = current
        current["rows"].append(row)
        current["last_activity_at"] = created_at
    return grouped


def build_recent_chat_context(rows: Iterable, max_turns: int | None = None,
                              max_chars: int | None = None) -> str:
    turns_limit = max_turns or settings.chat_context_max_turns
    chars_limit = max_chars or settings.chat_context_max_chars
    selected = list(rows)[-turns_limit:]
    text = "\n".join(f"Learner: {row.question}\nSenpaiAI: {row.answer}" for row in selected)
    return text[-chars_limit:] if len(text) > chars_limit else text
