from app.services.kanji_dictionary_service import kanji_dictionary_service


def test_merged_n3_dictionary_is_valid_and_has_stroke_data():
    report = kanji_dictionary_service.validate()
    n3, total = kanji_dictionary_service.list_entries(jlpt="N3", limit=400)

    assert report["jlpt_counts"]["N3"] == 367
    assert total == 367
    assert all(item["metadata_complete"] for item in n3)
    assert all(item["has_stroke_data"] for item in n3)
    assert all(not item["has_handwriting_data"] for item in n3)


def test_n5_n4_metadata_is_complete_without_changing_levels():
    for level, expected in [('N5', 79), ('N4', 166)]:
        rows, total = kanji_dictionary_service.list_entries(jlpt=level, limit=500)
        assert total == expected
        assert all(row['metadata_complete'] for row in rows)
        assert all(row['meaning_en'] for row in rows)
    assert kanji_dictionary_service.validate()['missing_metadata_count'] == 0
    for char in ['\u540c', '\u4e8b', '\u81ea', '\u767a']:
        row = kanji_dictionary_service.get_entry(char)
        assert row['jlpt'] == 'N4'
        assert row['meaning_vi'] and row['strokes'] > 0


def test_repair_is_idempotent_and_does_not_touch_n3():
    import json
    from scripts.repair_kanji_n5_n4 import DATA, DICTIONARY, repair
    rows = json.loads(DICTIONARY.read_text(encoding='utf-8'))
    metadata = json.loads((DATA / 'kanji_n5_n4_metadata.json').read_text(encoding='utf-8'))
    meanings = json.loads((DATA / 'kanji_n5_n4_vi.json').read_text(encoding='utf-8'))
    repaired = repair(rows, metadata, meanings)
    assert repaired == rows
    assert [row for row in repaired if row['jlpt'] == 'N3'] == [row for row in rows if row['jlpt'] == 'N3']


def test_incomplete_fixture_is_reported_without_mutation(tmp_path):
    import json
    from app.services.kanji_dictionary_service import KanjiDictionaryService
    path = tmp_path / 'dictionary.json'
    original = json.dumps([{'kanji': '\u540c', 'jlpt': 'N4'}])
    path.write_text(original, encoding='utf-8')
    service = KanjiDictionaryService(path, tmp_path / 'no-samples')
    assert service.validate()['missing_metadata_count'] == 1
    assert path.read_text(encoding='utf-8') == original
