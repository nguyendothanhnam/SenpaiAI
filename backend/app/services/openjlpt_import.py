"""Merge real OpenJLPT vocabulary into the existing catalog, without translating."""
from collections import Counter
from copy import deepcopy
import re
import unicodedata
from sqlalchemy.orm import selectinload
from ..models.database import Kanji, Vocabulary, VocabularyKanji
from .vocabulary_text import fold

SOURCE = 'OpenJLPT'
SOURCE_URL = 'https://github.com/evanclan/OpenJLPT'
LICENSE = 'CC-BY-SA-4.0'
LEVELS = ('N5', 'N4', 'N3', 'N2', 'N1')


def identity(word, reading):
    return unicodedata.normalize('NFKC', word).strip(), fold(reading).strip()


def normalize_entry(raw):
    if not isinstance(raw, dict):
        raise ValueError('entry_not_object')
    for field, maximum in (('word', 128), ('reading', 128), ('romaji', 256)):
        if not isinstance(raw.get(field), str) or not 0 < len(raw[field].strip()) <= maximum:
            raise ValueError('invalid_' + field)
    if not re.fullmatch('[0-9a-f]{10}', str(raw.get('id', ''))):
        raise ValueError('invalid_source_id')
    if raw.get('level') not in LEVELS:
        raise ValueError('invalid_level')
    if not re.fullmatch(r'[\u3041-\u3096\u309d\u309e\u30a1-\u30fa\u30fc\u30fd\u30fe]+', raw['reading']):
        raise ValueError('invalid_kana_reading')
    for field in ('meanings', 'pos', 'other_forms', 'other_readings'):
        values = raw.get(field, [])
        if not isinstance(values, list) or any(not isinstance(v, str) or not v.strip() or len(v) > 2000 for v in values):
            raise ValueError('invalid_' + field)
    if not raw.get('meanings'):
        raise ValueError('missing_english_meaning')
    if raw.get('jmdict_id') is not None and (type(raw['jmdict_id']) is not int or raw['jmdict_id'] < 1000000):
        raise ValueError('invalid_jmdict_id')
    examples = raw.get('examples', [])
    if not isinstance(examples, list):
        raise ValueError('invalid_examples')
    for example in examples:
        if not isinstance(example, dict) or any(not isinstance(example.get(k), str) or not example[k].strip() for k in ('ja', 'en')):
            raise ValueError('invalid_example_text')
        furigana = example.get('furigana')
        if furigana is not None and (not isinstance(furigana, str) or re.sub(r'\{([^|{}]+)\|[^{}]+\}', r'\1', furigana) != example['ja']):
            raise ValueError('invalid_furigana')
        if example.get('tatoeba_id') is not None and (type(example['tatoeba_id']) is not int or example['tatoeba_id'] <= 0):
            raise ValueError('invalid_tatoeba_id')
    result = deepcopy(raw)
    for field in ('word', 'reading', 'romaji'):
        result[field] = unicodedata.normalize('NFKC', result[field]).strip()
    return result


def merge_examples(old, incoming):
    result = list(old or [])
    for item in incoming:
        # Retain the original sentence ID and per-field attribution.
        item = {**item, 'source': 'Tatoeba', 'license': 'CC BY 2.0 FR'}
        if not any(isinstance(ex, dict) and ex.get('ja') == item['ja'] and ex.get('en') == item['en'] for ex in result):
            result.append(item)
    return result


def import_entries(db, entries, version, *, dry_run=True, batch_size=500, upstream=None):
    if not version or len(version) > 120 or not 1 <= batch_size <= 2000:
        raise ValueError('invalid_import_configuration')
    existing = db.query(Vocabulary).options(selectinload(Vocabulary.kanji_links)).all()
    by_key = {}
    for row in existing:
        by_key.setdefault(identity(row.japanese_word, row.reading), []).append(row)
    by_source = {row.source_id: row for row in existing if row.source == SOURCE and row.source_id}
    kanji = {row.character: row for row in db.query(Kanji).all()}
    report = {'dry_run': dry_run, 'version': version, 'levels': {level: dict(added=0, updated=0, skipped=0, invalid=0) for level in (*LEVELS, 'unknown')}, 'errors': [], 'reasons': Counter()}
    seen_keys, seen_ids = set(), set()
    for number, raw in enumerate(entries, 1):
        level = raw.get('level') if isinstance(raw, dict) else None
        stats = report['levels'].get(level, report['levels']['unknown'])
        try:
            item = normalize_entry(raw)
        except ValueError as exc:
            stats['invalid'] += 1
            report['reasons'][str(exc)] += 1
            if len(report['errors']) < 200:
                report['errors'].append({'row': number, 'id': raw.get('id') if isinstance(raw, dict) else None, 'reason': str(exc)})
            continue
        key, source_id = identity(item['word'], item['reading']), item['id']
        if key in seen_keys or source_id in seen_ids:
            stats['skipped'] += 1; report['reasons']['duplicate_input'] += 1; continue
        seen_keys.add(key); seen_ids.add(source_id)
        matches = by_key.get(key, [])
        row = matches[0] if len(matches) == 1 else None
        if len(matches) > 1 or source_id in by_source and by_source[source_id] is not row or row and row.source_id and (row.source != SOURCE or row.source_id != source_id):
            stats['skipped'] += 1; report['reasons']['identity_conflict_preserved'] += 1; continue
        if row is not None and row.jlpt_level != item['level']:
            report['reasons']['existing_level_preserved'] += 1
        metadata = {**(row.source_metadata or {} if row else {}),
            'english_meanings': item['meanings'], 'pos': item.get('pos', []),
            'other_forms': item.get('other_forms', []), 'other_readings': item.get('other_readings', []),
            'source_level': item['level'], 'license': LICENSE, 'source_url': SOURCE_URL,
            'upstream': upstream or {}}
        values = {'source': SOURCE, 'source_id': source_id, 'jmdict_id': item.get('jmdict_id'),
            'dataset_version': version, 'source_metadata': metadata,
            'example_sentences': merge_examples(row.example_sentences if row else [], item.get('examples', []))}
        if row is None or not row.meaning_en or row.source == SOURCE:
            values['meaning_en'] = '; '.join(item['meanings'])
        for field, value in (('romaji', item['romaji']), ('part_of_speech', ','.join(item.get('pos', [])) or None)):
            if row is None or not getattr(row, field):
                values[field] = value
        if row is None:
            values.update(japanese_word=item['word'], reading=item['reading'], meaning='', meaning_vi_status='missing',
                          meaning_vi_source='none', jlpt_level=item['level'])
        links = {(link.kanji_id, link.position_in_word) for link in row.kanji_links} if row else set()
        additions = [(kanji[char], pos) for pos, char in enumerate(item['word'], 1)
                     if char in kanji and (kanji[char].id, pos) not in links]
        changed = row is None or additions or any(getattr(row, field) != value for field, value in values.items())
        stats['added' if row is None else 'updated' if changed else 'skipped'] += 1
        if dry_run or not changed:
            continue
        if row is None:
            row = Vocabulary(**values); db.add(row)
            by_key[key] = [row]; by_source[source_id] = row
        else:
            for field, value in values.items():
                setattr(row, field, value)
        for character, position in additions:
            row.kanji_links.append(VocabularyKanji(kanji=character, position_in_word=position))
        if number % batch_size == 0:
            db.flush()
    if not dry_run:
        db.flush()
    report['reasons'] = dict(report['reasons'])
    return report
