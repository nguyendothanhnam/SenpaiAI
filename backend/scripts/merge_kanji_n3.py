#!/usr/bin/env python3
"""
Gộp dữ liệu kanji N3 vào từ điển và dữ liệu nét viết hiện có của dự án.

Đầu vào (mặc định nằm cạnh các file đích trong backend/app/data/):
  - kanji_dictionary_n3.json  (danh sách 367 chữ N3, cùng định dạng kanji_dictionary.json)
  - kanjivg_strokes_n3.json   (nét viết từ KanjiVG, cùng định dạng kanjivg_strokes.json)

Đích:
  - kanji_dictionary.json     (danh sách)
  - kanjivg_strokes.json      (từ điển khóa theo chữ kanji)

An toàn:
  - Mặc định KHÔNG ghi đè chữ đã có (chạy lại nhiều lần không hại).
  - Tạo bản sao lưu *.bak-<thời gian> trước khi ghi (tắt bằng --no-backup).
  - Ghi qua file tạm rồi thay thế để không để lại file dở dang.
  - --dry-run chỉ kiểm tra và báo cáo, không ghi gì.

Cách chạy (từ thư mục backend):
    python scripts/merge_kanji_n3.py --dry-run
    python scripts/merge_kanji_n3.py
    python scripts/merge_kanji_n3.py --overwrite     # thay cả chữ đã có bằng bản mới
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import tempfile
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "app" / "data"
REQUIRED_DICT_FIELDS = ("kanji", "meaning_vi", "jlpt", "stroke_count", "examples")


def load_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json_atomic(path: Path, data) -> None:
    fd, tmp_name = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.replace(tmp_name, path)
    except Exception:
        if os.path.exists(tmp_name):
            os.remove(tmp_name)
        raise


def backup(path: Path) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = path.with_name(f"{path.name}.bak-{stamp}")
    shutil.copy2(path, target)
    return target


def validate_new_dictionary(entries) -> list[str]:
    errors: list[str] = []
    if not isinstance(entries, list):
        return ["kanji_dictionary_n3.json phải là một danh sách"]
    seen = set()
    for index, entry in enumerate(entries, start=1):
        kanji = entry.get("kanji")
        label = f"#{index} {kanji!r}"
        for field in REQUIRED_DICT_FIELDS:
            if entry.get(field) in (None, "", []):
                errors.append(f"{label}: thiếu {field}")
        if entry.get("jlpt") != "N3":
            errors.append(f"{label}: jlpt phải là N3 (hiện là {entry.get('jlpt')!r})")
        if not entry.get("onyomi") and not entry.get("kunyomi"):
            errors.append(f"{label}: thiếu âm đọc")
        if kanji in seen:
            errors.append(f"{label}: trùng chữ trong file")
        seen.add(kanji)
    return errors


def validate_new_strokes(records, dictionary_kanji: set[str]) -> list[str]:
    errors: list[str] = []
    if not isinstance(records, dict):
        return ["kanjivg_strokes_n3.json phải là một từ điển khóa theo chữ kanji"]
    for kanji, record in records.items():
        strokes = record.get("strokes") or []
        if not strokes or record.get("stroke_count") != len(strokes):
            errors.append(f"{kanji!r}: số nét không khớp hoặc rỗng")
        if kanji not in dictionary_kanji:
            errors.append(f"{kanji!r}: có nét viết nhưng không có trong từ điển N3")
    for kanji in dictionary_kanji - set(records):
        errors.append(f"{kanji!r}: có trong từ điển N3 nhưng thiếu nét viết")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Gộp dữ liệu kanji N3 vào dữ liệu hiện có.")
    parser.add_argument("--dictionary-new", type=Path, default=DATA / "kanji_dictionary_n3.json")
    parser.add_argument("--strokes-new", type=Path, default=DATA / "kanjivg_strokes_n3.json")
    parser.add_argument("--dictionary-target", type=Path, default=DATA / "kanji_dictionary.json")
    parser.add_argument("--strokes-target", type=Path, default=DATA / "kanjivg_strokes.json")
    parser.add_argument("--overwrite", action="store_true", help="thay cả chữ đã có")
    parser.add_argument("--no-backup", action="store_true", help="không tạo bản sao lưu")
    parser.add_argument("--dry-run", action="store_true", help="chỉ kiểm tra, không ghi")
    args = parser.parse_args()

    for path in (args.dictionary_new, args.strokes_new, args.dictionary_target):
        if not path.exists():
            print(f"Không tìm thấy file: {path}")
            return 1

    new_dict = load_json(args.dictionary_new)
    new_strokes = load_json(args.strokes_new)
    errors = validate_new_dictionary(new_dict)
    if not errors:
        errors = validate_new_strokes(new_strokes, {entry["kanji"] for entry in new_dict})
    if errors:
        print("Dữ liệu N3 không hợp lệ:")
        for error in errors[:50]:
            print(f"  - {error}")
        return 1

    target_dict = load_json(args.dictionary_target)
    if not isinstance(target_dict, list):
        print("kanji_dictionary.json hiện có không phải danh sách; dừng để không làm hỏng dữ liệu.")
        return 1
    target_strokes = load_json(args.strokes_target) if args.strokes_target.exists() else {}
    if not isinstance(target_strokes, dict):
        print("kanjivg_strokes.json hiện có không phải từ điển; dừng để không làm hỏng dữ liệu.")
        return 1

    index_by_kanji = {entry.get("kanji"): i for i, entry in enumerate(target_dict)}
    added_dict = replaced_dict = skipped_dict = 0
    for entry in new_dict:
        position = index_by_kanji.get(entry["kanji"])
        if position is None:
            target_dict.append(entry)
            index_by_kanji[entry["kanji"]] = len(target_dict) - 1
            added_dict += 1
        elif args.overwrite:
            target_dict[position] = entry
            replaced_dict += 1
        else:
            skipped_dict += 1

    added_strokes = replaced_strokes = skipped_strokes = 0
    for kanji, record in new_strokes.items():
        if kanji not in target_strokes:
            target_strokes[kanji] = record
            added_strokes += 1
        elif args.overwrite:
            target_strokes[kanji] = record
            replaced_strokes += 1
        else:
            skipped_strokes += 1

    print(
        f"Từ điển: thêm {added_dict}, thay thế {replaced_dict}, bỏ qua {skipped_dict} "
        f"(tổng sau gộp: {len(target_dict)})"
    )
    print(
        f"Nét viết: thêm {added_strokes}, thay thế {replaced_strokes}, bỏ qua {skipped_strokes} "
        f"(tổng sau gộp: {len(target_strokes)})"
    )

    if args.dry_run:
        print("Chế độ --dry-run: không ghi gì.")
        return 0
    if added_dict + replaced_dict + added_strokes + replaced_strokes == 0:
        print("Không có thay đổi nào cần ghi.")
        return 0

    if not args.no_backup:
        print("Sao lưu:", backup(args.dictionary_target).name)
        if args.strokes_target.exists():
            print("Sao lưu:", backup(args.strokes_target).name)
    write_json_atomic(args.dictionary_target, target_dict)
    write_json_atomic(args.strokes_target, target_strokes)
    print("Hoàn tất.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
