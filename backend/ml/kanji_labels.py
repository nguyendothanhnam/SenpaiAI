"""JLPT N5-N4 kanji metadata and dictionary-backed recognition labels."""

from __future__ import annotations

import json
from pathlib import Path

JLPT_N5_KANJI = [
    "\u65e5", "\u4e00", "\u56fd", "\u4eba", "\u5e74", "\u5927", "\u5341", "\u4e8c",
    "\u672c", "\u4e2d", "\u9577", "\u51fa", "\u4e09", "\u6642", "\u884c", "\u898b",
    "\u6708", "\u5f8c", "\u524d", "\u751f", "\u4e94", "\u9593", "\u4e0a", "\u6771",
    "\u56db", "\u4eca", "\u91d1", "\u4e5d", "\u5165", "\u5b66", "\u9ad8", "\u5186",
    "\u5b50", "\u5916", "\u516b", "\u516d", "\u4e0b", "\u6765", "\u6c17", "\u5c0f",
    "\u4e03", "\u5c71", "\u8a71", "\u5973", "\u5317", "\u5348", "\u767e", "\u66f8",
    "\u5148", "\u540d", "\u5ddd", "\u5343", "\u6c34", "\u534a", "\u7537", "\u897f",
    "\u96fb", "\u6821", "\u8a9e", "\u571f", "\u6728", "\u805e", "\u98df", "\u8eca",
    "\u4f55", "\u5357", "\u4e07", "\u6bce", "\u767d", "\u5929", "\u6bcd", "\u706b",
    "\u53f3", "\u8aad", "\u53cb", "\u5de6", "\u4f11", "\u7236", "\u96e8",
]

JLPT_N4_KANJI = [
    "\u4f1a", "\u540c", "\u4e8b", "\u81ea", "\u793e", "\u767a", "\u8005", "\u5730",
    "\u696d", "\u65b9", "\u65b0", "\u5834", "\u54e1", "\u7acb", "\u958b", "\u624b",
    "\u529b", "\u554f", "\u4ee3", "\u660e", "\u52d5", "\u4eac", "\u76ee", "\u901a",
    "\u8a00", "\u7406", "\u4f53", "\u7530", "\u4e3b", "\u984c", "\u610f", "\u4e0d",
    "\u4f5c", "\u7528", "\u5ea6", "\u5f37", "\u516c", "\u6301", "\u91ce", "\u4ee5",
    "\u601d", "\u5bb6", "\u4e16", "\u591a", "\u6b63", "\u5b89", "\u9662", "\u5fc3",
    "\u754c", "\u6559", "\u6587", "\u5143", "\u91cd", "\u8fd1", "\u8003", "\u753b",
    "\u6d77", "\u58f2", "\u77e5", "\u9053", "\u96c6", "\u5225", "\u7269", "\u4f7f",
    "\u54c1", "\u8a08", "\u6b7b", "\u7279", "\u79c1", "\u59cb", "\u671d", "\u904b",
    "\u7d42", "\u53f0", "\u5e83", "\u4f4f", "\u771f", "\u6709", "\u53e3", "\u5c11",
    "\u753a", "\u6599", "\u5de5", "\u5efa", "\u7a7a", "\u6025", "\u6b62", "\u9001",
    "\u5207", "\u8ee2", "\u7814", "\u8db3", "\u7a76", "\u697d", "\u8d77", "\u7740",
    "\u5e97", "\u75c5", "\u8cea", "\u5f85", "\u8a66", "\u65cf", "\u9280", "\u65e9",
    "\u6620", "\u89aa", "\u9a13", "\u82f1", "\u533b", "\u4ed5", "\u53bb", "\u5473",
    "\u5199", "\u5b57", "\u7b54", "\u591c", "\u97f3", "\u6ce8", "\u5e30", "\u53e4",
    "\u6b4c", "\u8cb7", "\u60aa", "\u56f3", "\u9031", "\u5ba4", "\u6b69", "\u98a8",
    "\u7d19", "\u9ed2", "\u82b1", "\u6625", "\u8d64", "\u9752", "\u9928", "\u5c4b",
    "\u8272", "\u8d70", "\u79cb", "\u590f", "\u7fd2", "\u99c5", "\u6d0b", "\u65c5",
    "\u670d", "\u5915", "\u501f", "\u66dc", "\u98f2", "\u8089", "\u8cb8", "\u5802",
    "\u9ce5", "\u98ef", "\u52c9", "\u51ac", "\u663c", "\u8336", "\u5f1f", "\u725b",
    "\u9b5a", "\u5144", "\u72ac", "\u59b9", "\u59c9", "\u6f22",
]

KANJI_METADATA = {
    "\u65e5": {"jlpt": "N5", "stroke_count": 4, "meaning": "sun, day"},
    "\u6708": {"jlpt": "N5", "stroke_count": 4, "meaning": "moon, month"},
    "\u6c34": {"jlpt": "N5", "stroke_count": 4, "meaning": "water"},
    "\u6728": {"jlpt": "N5", "stroke_count": 4, "meaning": "tree, wood"},
    "\u706b": {"jlpt": "N5", "stroke_count": 4, "meaning": "fire"},
    "\u4eba": {"jlpt": "N5", "stroke_count": 2, "meaning": "person"},
    "\u5927": {"jlpt": "N5", "stroke_count": 3, "meaning": "big"},
    "\u5c0f": {"jlpt": "N5", "stroke_count": 3, "meaning": "small"},
    "\u5b66": {"jlpt": "N5", "stroke_count": 8, "meaning": "study"},
    "\u5148": {"jlpt": "N5", "stroke_count": 6, "meaning": "previous, ahead"},
    "\u751f": {"jlpt": "N5", "stroke_count": 5, "meaning": "life, birth"},
    "\u7528": {"jlpt": "N4", "stroke_count": 5, "meaning": "use"},
    "\u76ee": {"jlpt": "N4", "stroke_count": 5, "meaning": "eye"},
    "\u7530": {"jlpt": "N4", "stroke_count": 5, "meaning": "rice field"},
    "\u4f1a": {"jlpt": "N4", "stroke_count": 6, "meaning": "meet"},
    "\u793e": {"jlpt": "N4", "stroke_count": 7, "meaning": "company, shrine"},
    "\u96fb": {"jlpt": "N5", "stroke_count": 13, "meaning": "electricity"},
    "\u8a9e": {"jlpt": "N5", "stroke_count": 14, "meaning": "language"},
    "\u98df": {"jlpt": "N5", "stroke_count": 9, "meaning": "eat"},
    "\u8eca": {"jlpt": "N5", "stroke_count": 7, "meaning": "car"},
}


ML_DIR = Path(__file__).resolve().parent
REPO_DIR = ML_DIR.parents[1]
DICTIONARY_PATH = REPO_DIR / "backend" / "app" / "data" / "kanji_dictionary.json"


def load_dictionary_entries(path: Path = DICTIONARY_PATH) -> list[dict]:
    try:
        with path.open("r", encoding="utf-8") as file:
            rows = json.load(file)
    except (OSError, json.JSONDecodeError):
        return []
    if not isinstance(rows, list):
        return []

    entries = []
    seen = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        kanji = str(row.get("kanji") or "")[:1]
        jlpt = str(row.get("jlpt") or "").upper()
        if not kanji or kanji in seen or jlpt not in {"N5", "N4"}:
            continue
        seen.add(kanji)
        entries.append(row | {"kanji": kanji, "jlpt": jlpt})
    return entries


DICTIONARY_ENTRIES = load_dictionary_entries()
SUPPORTED_KANJI = (
    [entry["kanji"] for entry in DICTIONARY_ENTRIES]
    if DICTIONARY_ENTRIES
    else list(dict.fromkeys(JLPT_N5_KANJI + JLPT_N4_KANJI))
)
FREQUENCY_BY_KANJI = {
    kanji: round(1.0 - (index / max(1, len(SUPPORTED_KANJI) - 1)) * 0.55, 4)
    for index, kanji in enumerate(SUPPORTED_KANJI)
}

DICTIONARY_METADATA = {}
for entry in DICTIONARY_ENTRIES:
    strokes = entry.get("strokes", entry.get("stroke_count"))
    try:
        strokes = int(strokes) if strokes is not None else None
    except (TypeError, ValueError):
        strokes = None
    DICTIONARY_METADATA[entry["kanji"]] = {
        "jlpt": entry.get("jlpt"),
        "stroke_count": strokes,
        "meaning": entry.get("meaning") or entry.get("meaning_vi") or "",
        "onyomi": entry.get("onyomi") if isinstance(entry.get("onyomi"), list) else [],
        "kunyomi": entry.get("kunyomi") if isinstance(entry.get("kunyomi"), list) else [],
        "common_words": entry.get("examples") if isinstance(entry.get("examples"), list) else [],
        "has_handwriting_data": bool(entry.get("has_handwriting_data")),
    }


def get_metadata(kanji: str) -> dict:
    level = "N5" if kanji in JLPT_N5_KANJI else "N4"
    base = {
        "jlpt": level,
        "stroke_count": None,
        "meaning": "",
        "onyomi": [],
        "kunyomi": [],
        "common_words": [],
        "frequency": FREQUENCY_BY_KANJI.get(kanji, 0.5),
    }
    return base | KANJI_METADATA.get(kanji, {}) | DICTIONARY_METADATA.get(kanji, {})
