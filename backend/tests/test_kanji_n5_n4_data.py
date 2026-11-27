"""Data-tool safety: preserve existing/N3 data, attribution and real backups."""
from copy import deepcopy
import json
from pathlib import Path

import pytest

from scripts.audit_kanji_n5_n4 import SOURCE, inspect_dictionary, merge_missing, write_with_backup


def entry(char="一", level="N5", count=1):
    return {"kanji": char, "jlpt": level, "meaning_vi": "một", "onyomi": ["イチ"],
            "kunyomi": [], "strokes": count, "stroke_count": count, "examples": []}


def stroke(char="一"):
    return {"kanji": char, "stroke_count": 1, "viewBox": "0 0 109 109",
            "strokes": [{"index": 1, "path": "M1,1 L9,1", "type": "horizontal"}], **SOURCE}


def test_metadata_and_example_completeness_are_separate_and_one_reading_is_enough(tmp_path):
    row = entry()
    before = deepcopy(row)
    report = inspect_dictionary([row], {}, tmp_path)
    assert report["levels"]["N5"]["core_metadata_complete"] == 1
    assert report["levels"]["N5"]["all_fields_complete"] == 0
    assert report["missing_content"][0]["missing"] == ["examples"]
    assert row == before
    row["examples"] = [{"word": "一人", "reading": "ひとり", "meaning": "một người"}]
    report = inspect_dictionary([row], {}, tmp_path)
    assert report["levels"]["N5"]["all_fields_complete"] == 1
    assert not report["missing_content"]


def test_populated_sentence_with_repeated_character_gloss_is_flagged_for_review(tmp_path):
    row = entry()
    row["examples"] = [{"word": "一人です。", "reading": "ひとりです", "meaning": "một"}]
    report = inspect_dictionary([row], {}, tmp_path)
    assert report["levels"]["N5"]["all_fields_complete"] == 1
    assert report["examples_needing_human_review"][0]["kanji"] == "一"


def test_audit_counts_actual_paths_in_json_and_svg_and_reports_mismatch(tmp_path):
    (tmp_path / "04e00.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg"><path d="M1 1L2 2"/><path d="M1 2L3 4"/></svg>')
    report = inspect_dictionary([entry(count=2)], {"一": stroke()}, tmp_path)
    assert report["levels"]["N5"]["json_stroke_records"] == 1
    assert report["levels"]["N5"]["local_svg_records"] == 1
    mismatch = report["stroke_count_mismatches"][0]
    assert mismatch["json_path_count"] == 1 and mismatch["local_svg_path_count"] == 2
    assert mismatch["dictionary_stroke_count"] == 2


def test_merge_only_adds_missing_target_levels_and_is_idempotent_without_mutation():
    existing = {"一": {**stroke(), "custom": "keep"}, "才": stroke("才")}
    incoming = {char: stroke(char) for char in ("一", "会", "才", "非")}
    rows = [entry(), entry("会", "N4"), entry("才", "N3")]
    original, original_incoming = deepcopy(existing), deepcopy(incoming)
    merged, added = merge_missing(existing, incoming, rows)
    assert added == ["会"] and merged["一"] == original["一"] and merged["才"] == original["才"]
    assert existing == original and incoming == original_incoming
    again, added_again = merge_missing(merged, incoming, rows)
    assert again == merged and not added_again


@pytest.mark.parametrize("change", [
    {"license": "unknown"}, {"source": "other"}, {"source_url": "https://invalid.example"},
    {"stroke_count": 2}, {"kanji": "二"}, {"strokes": []},
    {"strokes": [{"index": 2, "path": "M1 1 L2 2"}]},
    {"strokes": [{"index": 1, "path": " "}]}, {"strokes": [None]},
])
def test_merge_rejects_malformed_or_unattributed_new_records(change):
    with pytest.raises(ValueError, match="Invalid or unattributed"):
        merge_missing({}, {"一": {**stroke(), **change}}, [entry()])


def test_merge_rejects_non_object_records():
    with pytest.raises(ValueError):
        merge_missing({}, {"一": None}, [entry()])


def test_atomic_write_preserves_exact_original_bytes_in_distinct_backups(tmp_path):
    target = tmp_path / "strokes.json"
    original = b'{"old": true}\r\n'
    target.write_bytes(original)
    first = write_with_backup(target, {"一": stroke()})
    assert first.read_bytes() == original
    previous = target.read_bytes()
    second = write_with_backup(target, {"一": stroke(), "会": stroke("会")})
    assert first != second and second.read_bytes() == previous and first.read_bytes() == original
    assert len(json.loads(target.read_text(encoding="utf8"))) == 2


def test_packaged_dictionary_has_all_n5_n4_strokes_and_attribution():
    data = Path(__file__).resolve().parents[1] / "app/data"
    rows = json.loads((data / "kanji_dictionary.json").read_text(encoding="utf8"))
    records = json.loads((data / "kanjivg_strokes.json").read_text(encoding="utf8"))
    for row in rows:
        if row["jlpt"] not in {"N5", "N4"}:
            continue
        record = records[row["kanji"]]
        assert record["stroke_count"] == len(record["strokes"]) > 0
        assert all(record[key] == value for key, value in SOURCE.items())


def test_n5_n4_stroke_api_data_is_available_without_local_svg_checkout(tmp_path, monkeypatch):
    from app.services import kanjivg_service
    monkeypatch.setattr(kanjivg_service, "KANJIVG_SVG_DIR", tmp_path)
    data = Path(__file__).resolve().parents[1] / "app/data"
    rows = json.loads((data / "kanji_dictionary.json").read_text(encoding="utf8"))
    for row in rows:
        if row["jlpt"] in {"N5", "N4"}:
            response = kanjivg_service.get_stroke_order_response(row["kanji"])
            assert response["available"] and response["jlpt"] == row["jlpt"]
            assert response["stroke_count"] == len(response["strokes"]) > 0
            assert all(response[key] == value for key, value in SOURCE.items())
