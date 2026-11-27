"""Audit dictionary content and add missing N5/N4 records from import_kanjivg.

No learner data, runtime algorithms, JLPT labels or existing stroke records change.
Examples are checked for populated fields, not claimed to be linguistically valid.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import tempfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "app/data"
TARGET_LEVELS = {"N5", "N4"}
SOURCE = {
    "source": "KanjiVG",
    "license": "CC BY-SA 3.0",
    "source_url": "https://kanjivg.tagaini.net",
}


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()


def nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def has_reading(values):
    return isinstance(values, list) and any(nonempty(value) for value in values)


def complete_example(example):
    return isinstance(example, dict) and all(nonempty(value) for value in (
        example.get("word"), example.get("reading"), example.get("meaning_vi") or example.get("meaning")))


def inspect_dictionary(rows, strokes, svg_directory):
    levels = {}
    missing_content = []
    examples_to_review = []
    mismatches = []
    for level in ("N5", "N4", "N3"):
        group = [row for row in rows if row.get("jlpt") == level]
        stats = {"total": len(group), "core_metadata_complete": 0, "with_complete_example": 0,
                 "all_fields_complete": 0, "json_stroke_records": 0, "local_svg_records": 0,
                 "effective_stroke_records": 0}
        for row in group:
            char = row["kanji"]
            count = row.get("stroke_count") or row.get("strokes")
            meaning = row.get("meaning_vi") or row.get("meaning")
            missing = []
            if not nonempty(meaning):
                missing.append("meaning_vi")
            if not (has_reading(row.get("onyomi")) or has_reading(row.get("kunyomi"))):
                missing.append("readings")
            if type(count) is not int or count <= 0:
                missing.append("stroke_count")
            core = not missing
            examples = row.get("examples") or []
            has_example = any(complete_example(example) for example in examples)
            if not has_example:
                missing.append("examples")
            stats["core_metadata_complete"] += core
            stats["with_complete_example"] += has_example
            stats["all_fields_complete"] += not missing
            if level in TARGET_LEVELS and missing:
                missing_content.append({"kanji": char, "jlpt": level, "missing": missing,
                    "current_meaning_vi": meaning, "examples": examples})
            if level in TARGET_LEVELS and any(complete_example(ex) and
                    (ex.get("meaning_vi") or ex.get("meaning")) == meaning for ex in examples):
                examples_to_review.append({"kanji": char, "jlpt": level,
                    "reason": "Example meaning repeats the character gloss; sentence translation needs human review.",
                    "examples": examples})
            record = strokes.get(char, {})
            paths = record.get("strokes") or []
            json_count = len(paths) if paths else None
            svg_path = svg_directory / f"{ord(char):05x}.svg"
            svg_count = None
            if svg_path.is_file():
                root = ET.parse(svg_path).getroot()
                svg_count = sum(1 for path in root.iter() if path.tag.rsplit("}", 1)[-1] == "path" and path.get("d"))
            stats["json_stroke_records"] += bool(json_count)
            stats["local_svg_records"] += bool(svg_count)
            stats["effective_stroke_records"] += bool(json_count or svg_count)
            if level in TARGET_LEVELS and any(value is not None and value != count for value in
                    (json_count, svg_count, record.get("stroke_count"), row.get("strokes"))):
                mismatches.append({"kanji": char, "jlpt": level, "dictionary_stroke_count": count,
                    "dictionary_strokes": row.get("strokes"), "json_path_count": json_count,
                    "json_declared_count": record.get("stroke_count"), "local_svg_path_count": svg_count})
        total = len(group)
        stats["core_metadata_percent"] = round(100 * stats["core_metadata_complete"] / total, 2) if total else 0
        stats["all_fields_percent"] = round(100 * stats["all_fields_complete"] / total, 2) if total else 0
        levels[level] = stats
    n3_rows = [row for row in rows if row.get("jlpt") == "N3"]
    return {"levels": levels, "missing_content": missing_content, "examples_needing_human_review": examples_to_review,
        "stroke_count_mismatches": mismatches,
        "n3_dictionary_fingerprint": fingerprint(n3_rows),
        "n3_strokes_fingerprint": fingerprint({row["kanji"]: strokes.get(row["kanji"]) for row in n3_rows}),
        "completeness_definition": "Nonempty Vietnamese meaning, at least one On/Kun reading, positive stroke count; all_fields also requires an example word, reading and Vietnamese meaning. Populated fields do not prove semantic correctness."}


def merge_missing(existing, incoming, dictionary):
    allowed = {row["kanji"] for row in dictionary if row.get("jlpt") in TARGET_LEVELS}
    result = dict(existing)
    added = []
    for char, record in incoming.items():
        if char not in allowed or char in existing:
            continue
        paths = record.get("strokes") if isinstance(record, dict) else None
        if (not isinstance(record, dict) or record.get("kanji") != char or not isinstance(paths, list) or not paths
                or type(record.get("stroke_count")) is not int or record["stroke_count"] != len(paths)
                or not all(isinstance(path, dict) for path in paths)
                or [path.get("index") for path in paths] != list(range(1, len(paths) + 1))
                or not all(nonempty(path.get("path")) for path in paths)
                or not all(record.get(key) == value for key, value in SOURCE.items())):
            raise ValueError(f"Invalid or unattributed KanjiVG record: {char}")
        result[char] = record
        added.append(char)
    return result, added


def write_with_backup(path, value):
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    backup = path.with_name(path.name + ".bak-" + stamp)
    # Exclusive creation never overwrites a previous backup.
    with path.open("rb") as source, backup.open("xb") as destination:
        shutil.copyfileobj(source, destination)
    descriptor, name = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as output:
            json.dump(value, output, ensure_ascii=False, indent=2)
            output.write("\n")
        os.replace(name, path)
    finally:
        if Path(name).exists():
            Path(name).unlink()
    return backup


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dictionary", type=Path, default=DATA / "kanji_dictionary.json")
    parser.add_argument("--strokes", type=Path, default=DATA / "kanjivg_strokes.json")
    parser.add_argument("--svg-directory", type=Path, default=DATA / "kanjivg/kanji")
    parser.add_argument("--merge-from", type=Path, help="Staging JSON produced by the existing import_kanjivg.py")
    parser.add_argument("--write", action="store_true", help="Apply missing N5/N4 records only, after making a backup")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    if args.write and not args.merge_from:
        parser.error("--write requires --merge-from")
    if args.report and args.report.resolve() in {args.dictionary.resolve(), args.strokes.resolve(),
            args.merge_from.resolve() if args.merge_from else None}:
        parser.error("Report must not overwrite an input file")
    rows = json.loads(args.dictionary.read_text(encoding="utf-8"))
    strokes = json.loads(args.strokes.read_text(encoding="utf-8"))
    if len({row["kanji"] for row in rows}) != len(rows):
        raise ValueError("Duplicate dictionary characters")
    result = inspect_dictionary(rows, strokes, args.svg_directory)
    if args.merge_from:
        incoming = json.loads(args.merge_from.read_text(encoding="utf-8"))
        merged, added = merge_missing(strokes, incoming, rows)
        print(f"Missing N5/N4 stroke records to add: {len(added)}")
        result["merge"] = {"added_characters": added, "applied": args.write, "backup": None}
        if args.write and added:
            result["merge"]["backup"] = str(write_with_backup(args.strokes, merged))
            print("Backup:", result["merge"]["backup"])
            result = {**inspect_dictionary(rows, merged, args.svg_directory), "merge": result["merge"]}
    result["dictionary_sha256"] = hashlib.sha256(args.dictionary.read_bytes()).hexdigest()
    result["strokes_sha256"] = hashlib.sha256(args.strokes.read_bytes()).hexdigest()
    for level, stats in result["levels"].items():
        print(level, json.dumps(stats))
    print("N5/N4 stroke-count mismatches:", len(result["stroke_count_mismatches"]))
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
