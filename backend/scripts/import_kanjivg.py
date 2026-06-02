from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.services.kanjivg_service import parse_kanjivg_svg  # noqa: E402
from app.services.kanji_dictionary_service import KanjiDictionaryService  # noqa: E402


def load_metadata(path: Path | None) -> dict:
    if not path:
        return {}
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def main() -> None:
    parser = argparse.ArgumentParser(description="Import KanjiVG SVG files into normalized JSON.")
    parser.add_argument("source", type=Path, help="KanjiVG SVG file or directory.")
    parser.add_argument("--metadata", type=Path, default=None, help="Optional metadata JSON keyed by kanji.")
    parser.add_argument("--dictionary", type=Path, default=ROOT / "app" / "data" / "kanji_dictionary.json", help="Dictionary JSON used to enrich and filter KanjiVG records.")
    parser.add_argument("--all-kanjivg", action="store_true", help="Import every SVG instead of filtering to dictionary kanji.")
    parser.add_argument("--output", type=Path, default=ROOT / "app" / "data" / "kanjivg_strokes.json")
    args = parser.parse_args()

    metadata = load_metadata(args.metadata)
    dictionary_entries = KanjiDictionaryService(dictionary_path=args.dictionary)._load_entries() if args.dictionary.exists() else []
    dictionary_by_kanji = {entry["kanji"]: entry for entry in dictionary_entries}
    allowed = set(dictionary_by_kanji) if dictionary_by_kanji and not args.all_kanjivg else None
    svg_files = [args.source] if args.source.is_file() else sorted(args.source.rglob("*.svg"))
    records = {}
    for svg_path in svg_files:
        kanji_meta = {}
        # KanjiVG file names are usually unicode code points, so parse once to learn the kanji.
        parsed = parse_kanjivg_svg(svg_path)
        if allowed is not None and parsed["kanji"] not in allowed:
            continue
        kanji_meta = metadata.get(parsed["kanji"], {})
        dictionary_meta = dictionary_by_kanji.get(parsed["kanji"], {})
        merged_meta = {
            "jlpt": dictionary_meta.get("jlpt"),
            "meaning_vi": dictionary_meta.get("meaning_vi") or dictionary_meta.get("meaning"),
            "onyomi": dictionary_meta.get("onyomi", []),
            "kunyomi": dictionary_meta.get("kunyomi", []),
            **kanji_meta,
            "kanji": parsed["kanji"],
        }
        parsed = parse_kanjivg_svg(svg_path, merged_meta)
        records[parsed["kanji"]] = parsed

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as file:
        json.dump(records, file, ensure_ascii=False, indent=2)
        file.write("\n")
    print(f"Imported {len(records)} KanjiVG records into {args.output}")


if __name__ == "__main__":
    main()
