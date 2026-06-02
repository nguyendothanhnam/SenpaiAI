from __future__ import annotations

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DICTIONARY = ROOT / "backend" / "app" / "data" / "kanji_dictionary.json"
DEFAULT_KANJIVG_SVG_DIR = ROOT / "backend" / "app" / "data" / "kanjivg" / "kanji"
DEFAULT_FALLBACK_JSON = ROOT / "backend" / "app" / "data" / "kanjivg_strokes.json"


def load_dictionary(path: Path) -> list[str]:
    try:
        rows = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    labels = []
    seen = set()
    for row in rows if isinstance(rows, list) else []:
        kanji = str(row.get("kanji") or "")[:1] if isinstance(row, dict) else ""
        if kanji and kanji not in seen:
            seen.add(kanji)
            labels.append(kanji)
    return labels


def has_svg(kanji: str, svg_dir: Path) -> bool:
    code = f"{ord(kanji):05x}"
    return (svg_dir / f"{code}.svg").exists() or (svg_dir / f"{code.lstrip('0')}.svg").exists()


def load_fallback_supported(path: Path) -> set[str]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return set()
    return set(data.keys()) if isinstance(data, dict) else set()


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate KanjiVG stroke-order coverage for dictionary kanji.")
    parser.add_argument("--dictionary", type=Path, default=DEFAULT_DICTIONARY)
    parser.add_argument("--svg-dir", type=Path, default=DEFAULT_KANJIVG_SVG_DIR)
    parser.add_argument("--fallback-json", type=Path, default=DEFAULT_FALLBACK_JSON)
    args = parser.parse_args()

    dictionary_kanji = load_dictionary(args.dictionary)
    fallback = load_fallback_supported(args.fallback_json)
    supported = [kanji for kanji in dictionary_kanji if has_svg(kanji, args.svg_dir) or kanji in fallback]
    missing = [kanji for kanji in dictionary_kanji if kanji not in supported]
    total = len(dictionary_kanji)
    percent = (len(supported) / total * 100) if total else 0

    print(f"Dictionary Kanji: {total}")
    print(f"KanjiVG Supported: {len(supported)}")
    print(f"Missing: {len(missing)}")
    print("")
    print(f"Stroke Order Coverage: {len(supported)} / {total} ({percent:.1f}%)")
    if missing:
        print("Missing Kanji:")
        print(" ".join(missing))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
