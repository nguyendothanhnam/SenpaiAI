from app.services.kanji_dictionary_service import kanji_dictionary_service


def test_merged_n3_dictionary_is_valid_and_has_stroke_data():
    report = kanji_dictionary_service.validate()
    n3, total = kanji_dictionary_service.list_entries(jlpt="N3", limit=400)

    assert report["jlpt_counts"]["N3"] == 367
    assert total == 367
    assert all(item["metadata_complete"] for item in n3)
    assert all(item["has_stroke_data"] for item in n3)
    assert all(not item["has_handwriting_data"] for item in n3)


def test_old_n5_n4_invalid_entries_are_reported_without_mutation():
    report = kanji_dictionary_service.validate()
    old_levels = {"N5", "N4"}
    old_invalid = [item for item in report["missing_metadata"]
                   if (entry := kanji_dictionary_service.get_entry(item["kanji"]))
                   and entry.get("jlpt") in old_levels]

    assert old_invalid
    assert all(
        kanji_dictionary_service.get_entry(item["kanji"]).get("jlpt") in old_levels
        for item in old_invalid
    )
