"""Versioned exam content. Only published items enter attempts; demo remains explicit."""
import json
import random
from collections import Counter
from pathlib import Path

from ..core import placement_config as policy
from ..core.config import settings
from ..models.database import ListeningLesson, PlacementQuestionBank, PlacementStimulus


def localized(value, language):
    return value.get(language) or value.get("ja") or value.get("en") or "" if isinstance(value, dict) else value


def validate_question(payload, answer, skill, level):
    options = payload.get("options", [])
    ids = [option.get("id") for option in options]
    if level not in policy.LEVELS or skill not in policy.SKILLS or len(options) != 4 or len(set(ids)) != 4 or any(not value for value in ids):
        raise ValueError("A question requires a valid level/skill and four unique option IDs.")
    if answer not in ids or not payload.get("prompt"):
        raise ValueError("The answer must reference an option, and the prompt must be present.")
    for language in ("vi", "en"):
        texts = [localized(option.get("text", ""), language) for option in options]
        if any(not text for text in texts) or len(set(texts)) != 4:
            raise ValueError("Options must have four distinct nonempty localized texts.")


def bank_snapshots(db, language):
    rows = db.query(PlacementQuestionBank).filter_by(publication_status="published").order_by(PlacementQuestionBank.version.desc()).all()
    seen, result = set(), []
    for row in rows:
        if row.source_key in seen:
            continue
        seen.add(row.source_key)
        payload = row.payload
        validate_question(payload, row.answer_key["option_id"], row.skill, row.level)
        public = {"key": f"bank:{row.id}:v{row.version}", "skill": row.skill, "level": row.level,
                  "question_type": "mcq", "prompt": localized(payload["prompt"], language),
                  "choices": [{"id": option["id"], "text": localized(option["text"], language)} for option in payload["options"]]}
        stimulus = db.get(PlacementStimulus, row.stimulus_id) if row.stimulus_id else None
        private_media = None
        if row.skill == "reading":
            if not stimulus or stimulus.kind != "reading" or not stimulus.content.get("text"):
                continue
            public["passage"] = stimulus.content["text"]
            public["stimulus_key"] = f"stimulus:{stimulus.id}:v{stimulus.version}"
        if row.skill == "listening":
            if not stimulus or stimulus.kind != "listening":
                continue
            content = stimulus.content
            root = Path(settings.listening_media_dir).resolve()
            path = (root / content.get("audio_path", "")).resolve()
            if not path.is_relative_to(root) or not path.is_file() or not 0 <= content.get("start_ms", -1) < content.get("end_ms", -1):
                continue
            public.update(start_ms=content["start_ms"], end_ms=content["end_ms"], stimulus_key=f"stimulus:{stimulus.id}:v{stimulus.version}")
            private_media = content["audio_path"]
        result.append(dict(key=public["key"], source_key=row.source_key, question_id=row.id, level=row.level,
                           skill=row.skill, public=public, answer=row.answer_key["option_id"],
                           explanation=localized(row.explanation, language), is_demo=row.is_demo, audio_path=private_media))
    return result


def level_availability(bank):
    result = []
    for level in policy.LEVELS:
        pool = [item for item in bank if item["level"] == level]
        counts = Counter(item["skill"] for item in pool)
        missing = [skill for skill in policy.SKILLS if counts[skill] < policy.MIN_BANK_PER_SKILL]
        result.append(dict(level=level, available=not missing, counts={skill: counts[skill] for skill in policy.SKILLS},
                           missing_skills=missing, is_demo=any(item["is_demo"] for item in pool)))
    return result


def import_demo_n5(db):
    """Explicit, idempotent offline import. Never pretends demonstration content is calibrated."""
    data = json.loads((Path(__file__).parents[1] / "data/placement_demo_n5.json").read_text(encoding="utf-8"))
    added = 0
    def stimulus(key, kind, content):
        existing = db.query(PlacementStimulus).filter_by(source_key=key).order_by(PlacementStimulus.version.desc()).first()
        if existing and existing.kind == kind and existing.content == content:
            return existing
        row = PlacementStimulus(source_key=key, version=existing.version + 1 if existing else 1, kind=kind, content=content)
        db.add(row); db.flush()
        return row
    def add(key, skill, prompt, texts, correct, explanation=None, media=None):
        nonlocal added
        key = "senpai-demo-n5:" + key
        options = [{"id": str(index), "text": text} for index, text in enumerate(texts)]
        payload = {"prompt": prompt, "options": options}
        validate_question(payload, str(correct), skill, "N5")
        existing = db.query(PlacementQuestionBank).filter_by(source_key=key).order_by(PlacementQuestionBank.version.desc()).first()
        if existing and existing.payload == payload and existing.answer_key == {"option_id": str(correct)} and existing.stimulus_id == (media.id if media else None) and (not explanation or existing.explanation == explanation):
            return
        db.add(PlacementQuestionBank(source_key=key, version=existing.version + 1 if existing else 1, level="N5", skill=skill, payload=payload,
               question_type="mcq", answer_key={"option_id": str(correct)},
               explanation=explanation or {"vi": "Đáp án được xác định từ nội dung câu hoặc đoạn văn mẫu.", "en": "The answer follows from the demonstration sentence or passage."},
               difficulty=1, source={"name": data["source"], "review": "structural validation; demonstration only"},
               publication_status="published", is_demo=True, stimulus_id=media.id if media else None))
        added += 1
        db.flush()
    rng = random.Random(512)
    for skill in ("vocab", "kanji"):
        for index, entry in enumerate(data[skill]):
            others = [value for value in data[skill] if value != entry]
            selected = [entry, *rng.sample(others, 3)]
            texts = [{"vi": value[1], "en": value[2]} if skill == "vocab" else value[1] for value in selected]
            add(f"{skill}:{index}", skill,
                {"vi": f"Chọn nghĩa của từ: {entry[0]}" if skill == "vocab" else f"Chọn cách đọc: {entry[0]}",
                 "en": f"Choose the meaning: {entry[0]}" if skill == "vocab" else f"Choose the reading: {entry[0]}"}, texts, 0)
    for index, (prompt, options, correct, vi, en) in enumerate(data["grammar"]):
        add(f"grammar:{index}", "grammar", prompt, options, options.index(correct), {"vi": vi, "en": en})
    for passage in data["reading"]:
        media = stimulus("senpai-demo-n5:reading:" + passage["key"], "reading", {"text": passage["text"]})
        for index, (prompt, options, correct) in enumerate(passage["questions"]):
            add(f"reading:{passage['key']}:{index}", "reading", prompt, options, options.index(correct), media=media)
    lessons = db.query(ListeningLesson).filter_by(jlpt_level="N5", is_published=True, source="seed").order_by(ListeningLesson.id).all()
    segments = []
    root = Path(settings.listening_media_dir).resolve()
    for lesson in lessons:
        path = (root / lesson.audio_path).resolve() if lesson.audio_path else None
        if not path or not path.is_relative_to(root) or not path.is_file():
            continue
        for index, segment in enumerate(lesson.segments or []):
            if segment.get("ja") and isinstance(segment.get("start_ms"), (int, float)) and isinstance(segment.get("end_ms"), (int, float)) and 0 <= segment["start_ms"] < segment["end_ms"]:
                segments.append((lesson, index, segment))
    # Spread selected clips across lessons rather than consuming a single passage first.
    segments.sort(key=lambda value: (value[1], value[0].id))
    for lesson, index, segment in segments[:10]:
        alternatives = sorted({other[2]["ja"] for other in segments if other[2]["ja"] != segment["ja"]})
        if len(alternatives) < 3:
            continue
        media = stimulus(f"senpai-demo-n5:audio:{lesson.id}:{index}", "listening",
                         {"audio_path": lesson.audio_path, "start_ms": segment["start_ms"], "end_ms": segment["end_ms"], "transcript": segment["ja"]})
        add(f"listening:{lesson.id}:{index}", "listening", {"vi": "Chọn câu bạn nghe được.", "en": "Choose the sentence you hear."},
            [segment["ja"], *rng.sample(alternatives, 3)], 0, media=media)
    return added
