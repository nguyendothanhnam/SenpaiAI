"""Conservative text deduplication; no embeddings, provider or answer key required."""
import hashlib
import re
import unicodedata
from difflib import SequenceMatcher

from ..core.exercise_selection_config import SIMILARITY_THRESHOLD


def normalize_content(text):
    text = unicodedata.normalize("NFKC", str(text)).casefold()
    return "".join(char for char in text if not unicodedata.category(char).startswith(("P", "Z", "C")))


def content_fingerprint(text):
    return hashlib.sha256(normalize_content(text).encode("utf-8")).hexdigest()


def similar_content(left, right, threshold=SIMILARITY_THRESHOLD):
    left, right = normalize_content(left), normalize_content(right)
    return similar_normalized(left, right, threshold)


def numeric_signature(text):
    return tuple(re.findall(r"\d+", text))


def similar_normalized(left, right, threshold=SIMILARITY_THRESHOLD):
    if not left or not right:
        return False
    if left == right:
        return True
    # Different numbers and short Japanese words are meaningful, not boilerplate.
    if min(len(left), len(right)) < 12 or numeric_signature(left) != numeric_signature(right):
        return False
    if min(len(left), len(right)) / max(len(left), len(right)) < threshold:
        return False
    return SequenceMatcher(None, left, right, autojunk=False).ratio() >= threshold


def grammar_content(question):
    payload = question.payload or {}
    if question.question_type == "reorder":
        return "".join(payload.get("tokens", [])) or question.prompt
    if question.question_type == "true_false":
        return payload.get("statement") or question.prompt
    return question.prompt + " " + " ".join(str(payload.get(key, "")) for key in ("base_form", "target_form"))
