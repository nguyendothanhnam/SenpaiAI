from __future__ import annotations

import json
import random
import base64
from pathlib import Path
from typing import Any


APP_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DICTIONARY_PATH = APP_DIR / "data" / "kanji_dictionary.json"
DEFAULT_ETL10_DIR = APP_DIR.parents[1] / "ml" / "data" / "etl10_processed"


class KanjiDictionaryService:
    def __init__(
        self,
        dictionary_path: Path = DEFAULT_DICTIONARY_PATH,
        etl10_dir: Path = DEFAULT_ETL10_DIR,
    ) -> None:
        self.dictionary_path = Path(dictionary_path)
        self.etl10_dir = Path(etl10_dir)

    def list_entries(
        self,
        jlpt: str | None = None,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict[str, Any]], int]:
        entries = self._load_entries()
        filtered = self._filter_jlpt(entries, jlpt)
        if search:
            query = search.casefold().strip()
            filtered = [entry for entry in filtered if self._matches(entry, query)]

        total = len(filtered)
        return filtered[offset : offset + limit], total

    def get_entry(self, kanji: str) -> dict[str, Any] | None:
        key = (kanji or "").strip()[:1]
        if not key:
            return None
        for entry in self._load_entries():
            if entry.get("kanji") == key:
                return entry
        return None

    def all_labels(self, levels: set[str] | None = None) -> list[str]:
        entries = self._load_entries()
        if levels:
            entries = [entry for entry in entries if entry.get("jlpt") in levels]
        return [entry["kanji"] for entry in entries if entry.get("kanji")]

    def quiz(self, mode: str = "meaning_match", jlpt: str | None = None, count: int = 10) -> list[dict[str, Any]]:
        if mode == "matching_grid":
            return self.matching_pairs(jlpt=jlpt, count=count)

        entries = [
            entry
            for entry in self._filter_jlpt(self._load_entries(), jlpt)
            if entry.get("kanji") and self._answer_for_mode(entry, mode)
        ]
        if not entries:
            return []

        random.shuffle(entries)
        questions = []
        for entry in entries[: max(1, count)]:
            correct = self._answer_for_mode(entry, mode)
            if not correct:
                continue
            distractors = [
                self._answer_for_mode(other, mode)
                for other in entries
                if other.get("kanji") != entry.get("kanji")
            ]
            options = [item for item in dict.fromkeys(distractors) if item and item != correct]
            random.shuffle(options)
            options = options[:3] + [correct]
            random.shuffle(options)
            questions.append(
                {
                    "question": self._question_for_mode(entry, mode),
                    "correct_answer": correct,
                    "options": options,
                    "kanji": entry,
                }
            )
        return questions

    def matching_pairs(self, jlpt: str | None = None, count: int = 6) -> list[dict[str, Any]]:
        entries = [
            entry
            for entry in self._filter_jlpt(self._load_entries(), jlpt)
            if entry.get("kanji") and self._display_meaning(entry)
        ]
        random.shuffle(entries)
        pairs = []
        for entry in entries[: max(2, min(count, len(entries)))]:
            readings = entry.get("onyomi", []) + entry.get("kunyomi", [])
            reading_text = " / ".join(readings)
            meaning = self._display_meaning(entry)
            right = " / ".join(part for part in [reading_text, meaning] if part)
            pairs.append(
                {
                    "id": entry["kanji"],
                    "left": entry["kanji"],
                    "right": right,
                    "reading": "、".join(readings),
                    "meaning": meaning,
                    "jlpt": entry.get("jlpt"),
                }
            )
        return pairs

    def matching_grid(self, jlpt: str | None = None, count: int = 6) -> dict[str, Any]:
        entries = [
            entry
            for entry in self._filter_jlpt(self._load_entries(), jlpt)
            if entry.get("kanji") and self._display_meaning(entry)
        ]
        random.shuffle(entries)
        selected = entries[: max(2, min(count, len(entries)))]
        meanings = [
            {"id": entry["kanji"], "text": self._display_meaning(entry)}
            for entry in selected
        ]
        random.shuffle(meanings)
        return {
            "kanji": [
                {
                    "id": entry["kanji"],
                    "kanji": entry["kanji"],
                    "meaning": self._display_meaning(entry),
                    "onyomi": entry.get("onyomi", []),
                    "kunyomi": entry.get("kunyomi", []),
                    "example": (entry.get("examples") or [None])[0],
                }
                for entry in selected
            ],
            "meanings": meanings,
        }

    def word_matching_grid(self, jlpt: str | None = None, count: int = 6) -> dict[str, Any]:
        words = []
        for entry in self._filter_jlpt(self._load_entries(), jlpt):
            for example in entry.get("examples", []):
                word = example.get("word")
                meaning = example.get("meaning")
                if word and meaning:
                    words.append(
                        {
                            "id": word,
                            "word": word,
                            "reading": example.get("reading") or "",
                            "meaning": meaning,
                            "example": example,
                        }
                    )
        random.shuffle(words)
        selected = words[: max(2, min(count, len(words)))]
        meanings = [{"id": item["id"], "text": item["meaning"]} for item in selected]
        random.shuffle(meanings)
        return {"words": selected, "meanings": meanings}

    def handwriting_samples(self, kanji: str, limit: int = 5) -> dict[str, Any]:
        key = (kanji or "").strip()[:1]
        if not key:
            return {"kanji": key, "items": [], "total": 0}
        class_dir = self.etl10_dir / key
        if not class_dir.is_dir():
            return {"kanji": key, "items": [], "total": 0}
        image_paths = sorted(
            path for path in class_dir.iterdir()
            if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
        )
        items = []
        for path in image_paths[:limit]:
            media_type = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
            try:
                encoded = base64.b64encode(path.read_bytes()).decode("ascii")
            except OSError:
                continue
            items.append({"filename": path.name, "image_data": f"data:{media_type};base64,{encoded}"})
        return {"kanji": key, "items": items, "total": len(image_paths)}

    def validate(self) -> dict[str, Any]:
        rows = self._raw_rows()
        seen = set()
        duplicates = []
        valid_entries = 0
        missing_metadata = []
        for row in rows:
            entry = self._normalize_entry(row)
            kanji = entry.get("kanji")
            if not kanji:
                missing_metadata.append({"kanji": "", "missing": ["kanji"]})
                continue
            if kanji in seen:
                duplicates.append(kanji)
            seen.add(kanji)
            missing = []
            if not self._display_meaning(entry):
                missing.append("meaning")
            if not entry.get("onyomi") and not entry.get("kunyomi"):
                missing.append("readings")
            if not isinstance(entry.get("strokes"), int) or entry.get("strokes") <= 0:
                missing.append("strokes")
            if entry.get("jlpt") not in {"N5", "N4"}:
                missing.append("jlpt")
            if missing:
                missing_metadata.append({"kanji": kanji, "missing": missing})
            else:
                valid_entries += 1
        return {
            "total_entries": len(rows),
            "valid_entries": valid_entries,
            "missing_metadata": missing_metadata,
            "missing_metadata_count": len(missing_metadata),
            "duplicate_kanji": duplicates,
            "duplicate_count": len(duplicates),
        }

    def _load_entries(self) -> list[dict[str, Any]]:
        raw = self._raw_rows()
        entries = []
        seen = set()
        for item in raw:
            entry = self._normalize_entry(item)
            kanji = entry.get("kanji")
            if not kanji or kanji in seen:
                continue
            seen.add(kanji)
            entries.append(entry)
        return entries

    def _raw_rows(self) -> list[Any]:
        try:
            with self.dictionary_path.open("r", encoding="utf-8") as file:
                raw = json.load(file)
        except (OSError, json.JSONDecodeError):
            return []
        if not isinstance(raw, list):
            return []
        return raw

    def _normalize_entry(self, item: Any) -> dict[str, Any]:
        if not isinstance(item, dict):
            return {}
        kanji = str(item.get("kanji") or "")[:1]
        strokes = item.get("strokes", item.get("stroke_count"))
        try:
            strokes = int(strokes) if strokes is not None else None
        except (TypeError, ValueError):
            strokes = None
        examples = item.get("examples") if isinstance(item.get("examples"), list) else []
        entry = {
            "kanji": kanji,
            "meaning": str(item.get("meaning") or item.get("meaning_vi") or ""),
            "meaning_vi": str(item.get("meaning_vi") or item.get("meaning") or ""),
            "onyomi": self._string_list(item.get("onyomi")),
            "kunyomi": self._string_list(item.get("kunyomi")),
            "jlpt": str(item.get("jlpt") or "").upper(),
            "strokes": strokes,
            "stroke_count": strokes,
            "examples": [example for example in examples if isinstance(example, dict)],
        }
        entry["has_handwriting_data"] = bool(
            item.get("has_handwriting_data") or (kanji and (self.etl10_dir / kanji).is_dir())
        )
        entry["metadata_complete"] = bool(
            self._display_meaning(entry)
            and (entry["onyomi"] or entry["kunyomi"])
            and isinstance(entry["strokes"], int)
            and entry["strokes"] > 0
        )
        return entry

    def _string_list(self, value: Any) -> list[str]:
        if isinstance(value, list):
            return [str(item) for item in value if item]
        if isinstance(value, str) and value:
            return [value]
        return []

    def _filter_jlpt(self, entries: list[dict[str, Any]], jlpt: str | None) -> list[dict[str, Any]]:
        level = (jlpt or "all").upper()
        if level in {"", "ALL"}:
            return entries
        return [entry for entry in entries if entry.get("jlpt") == level]

    def _matches(self, entry: dict[str, Any], query: str) -> bool:
        fields = [
            entry.get("kanji"),
            entry.get("meaning"),
            entry.get("meaning_vi"),
            *entry.get("onyomi", []),
            *entry.get("kunyomi", []),
        ]
        for example in entry.get("examples", []):
            fields.extend([example.get("word"), example.get("reading"), example.get("meaning")])
        return any(query in str(value).casefold() for value in fields if value)

    def _answer_for_mode(self, entry: dict[str, Any], mode: str) -> str:
        if mode == "reading_match":
            return ", ".join(entry.get("onyomi", []) + entry.get("kunyomi", []))
        if mode == "kanji_match":
            return entry.get("kanji") or ""
        return self._display_meaning(entry)

    def _question_for_mode(self, entry: dict[str, Any], mode: str) -> str:
        if mode == "reading_match":
            return entry.get("kanji") or ""
        if mode == "kanji_match":
            return self._display_meaning(entry)
        return entry.get("kanji") or ""

    def _display_meaning(self, entry: dict[str, Any]) -> str:
        return entry.get("meaning") or entry.get("meaning_vi") or ""


kanji_dictionary_service = KanjiDictionaryService()
