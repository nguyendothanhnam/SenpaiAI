"""Offline grammar snapshots, deterministic adaptation and non-destructive seed sync.

The source data retain their licenses; combined adapted catalog: CC BY-SA 4.0.
See app/data/grammar_sources/README.md and the pinned manifest.
"""
from collections import Counter
from functools import lru_cache
import hashlib
import json
from pathlib import Path
import re
import unicodedata

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from ..models.database import GrammarLesson, GrammarRule
from .grammar_lessons import LessonInput

DATA_DIRECTORY = Path(__file__).resolve().parents[1] / 'data/grammar_sources'
PREFIX = 'bundled-grammar-v1-'


def pattern_key(pattern: str) -> str:
    """Only normalize whitespace/Unicode/placeholder tildes, never infer synonyms."""
    return re.sub(r'\s+', '', unicodedata.normalize('NFKC', pattern)).replace('~', '').replace('〜', '')


def hanabira_pattern(title: str) -> str:
    match = re.search(r'\s+\(([^()]*)\)\s*$', title)
    if match and re.search(r'[a-zA-Z]', match[1]) and not re.search(r'[\u3040-\u30ff\u3400-\u9fff]', match[1]):
        return title[:match.start()].strip()
    return title.strip()


def lesson_key(level: str, pattern: str) -> str:
    digest = hashlib.sha256(pattern_key(pattern).encode('utf-8')).hexdigest()[:20]
    return f'{PREFIX}{level.lower()}-{digest}'


def _lesson_values(record, rule_id):
    return {key: value for key, value in record.items() if key in LessonInput.model_fields} | {'grammar_rule_id': rule_id}


def load_catalog(directory: Path = DATA_DIRECTORY):
    """Verify every pinned file before returning any importable records."""
    manifest = json.loads((directory / 'manifest.json').read_text(encoding='utf-8'))
    if manifest['schema_version'] != 1 or manifest['language'] != 'en':
        raise ValueError('Unsupported bundled grammar manifest')
    entries = {}
    for source_id, source in manifest['sources'].items():
        if source_id not in {'hanabira', 'openjlpt'}:
            raise ValueError('Unknown grammar source adapter')
        for filename, metadata in source['files'].items():
            if Path(filename).name != filename:
                raise ValueError('Invalid bundled grammar file name')
            raw = (directory / source_id / filename).read_bytes()
            if hashlib.sha256(raw).hexdigest() != metadata['sha256'] or len(raw) != metadata['bytes']:
                raise ValueError(f'Bundled grammar checksum mismatch: {source_id}/{filename}')
            if 'level' not in metadata:
                continue
            level = metadata['level']
            if level not in {'N5', 'N4', 'N3', 'N2', 'N1'}:
                raise ValueError('Invalid grammar source level')
            rows = json.loads(raw)
            if len(rows) != metadata['count']:
                raise ValueError('Grammar source count differs from manifest')
            for row in rows:
                if source_id == 'hanabira':
                    pattern = hanabira_pattern(row['title'])
                    title, meaning, formation, notes = row['title'], row['short_explanation'], row['formation'], row['long_explanation']
                    examples = [{'ja': item['jp'], 'en': item['en'], 'romaji': item.get('romaji', '')} for item in row['examples']]
                else:
                    if row['level'] != level:
                        raise ValueError('OpenJLPT level does not match its file')
                    pattern, title = row['pattern'], row['pattern']
                    meaning, formation, notes = row['meaning'], row['formation'], row.get('notes', '')
                    examples = [{'ja': item['ja'], 'en': item['en']} for item in row['examples']]
                if not pattern_key(pattern):
                    raise ValueError('Empty grammar pattern')
                key = lesson_key(level, pattern)
                source_info = {
                    'name': source['name'], 'url': source['url'], 'license': source['license'],
                    'license_url': source['license_url'], 'revision': source['revision'],
                    'data_url': metadata['url'],
                    'notice_url': f"https://github.com/{source['repository']}/blob/{source['revision']}/{'NOTICE.md' if source_id == 'openjlpt' else 'README.md'}",
                }
                if key not in entries:
                    entries[key] = dict(source_key=key, pattern=pattern, title=title, jlpt_level=level,
                        formation=formation, meaning=meaning, usage_notes=notes, examples=[],
                        common_errors=[], comparisons=[], sources=[], content_language='en', sort_order=0)
                entry = entries[key]
                if source_info not in entry['sources']:
                    entry['sources'].append(source_info)
                # Keep both sources' wording when matching patterns are merged.
                if (formation, meaning, notes) != (entry['formation'], entry['meaning'], entry['usage_notes']):
                    supplement = f"{source['name']}\n{meaning}\n{formation}" + (f'\n{notes}' if notes else '')
                    if supplement not in entry['usage_notes']:
                        entry['usage_notes'] = '\n\n'.join(filter(None, [entry['usage_notes'], supplement]))
                for example in examples:
                    if not any((old['ja'], old.get('en', '')) == (example['ja'], example.get('en', '')) for old in entry['examples']):
                        entry['examples'].append(example)
    records = sorted(entries.values(), key=lambda item: (int(item['jlpt_level'][1]), pattern_key(item['pattern'])))
    for index, record in enumerate(records):
        record['sort_order'] = index
        # Validate the full catalog before performing database writes. A dummy FK is only for schema validation.
        parsed = LessonInput.model_validate(_lesson_values(record, 1))
        if any(example.tokens and ''.join(token.text for token in example.tokens) != example.ja for example in parsed.examples):
            raise ValueError('Invalid furigana in bundled grammar data')
    return records


@lru_cache(maxsize=1)
def catalog_index():
    return {entry['source_key']: entry for entry in load_catalog()}


def lesson_sources(source_key: str):
    if not source_key.startswith(PREFIX):
        return {}
    entry = catalog_index().get(source_key)
    return {'content_language': entry['content_language'], 'sources': entry['sources']} if entry else {}


def sync_bundled_grammar(db: Session, records=None):
    """Upsert managed lessons, retaining IDs/progress, custom lessons and question banks.

    The caller owns commit/rollback. Concurrent PostgreSQL starts share one transaction lock.
    """
    records = list(catalog_index().values()) if records is None else records
    # Validate all input before adding any rules or lessons.
    for record in records:
        LessonInput.model_validate(_lesson_values(record, 1))
        if record['source_key'] != lesson_key(record['jlpt_level'], record['pattern']):
            raise ValueError('Bundled grammar key does not match its pattern')
    if len({record['source_key'] for record in records}) != len(records):
        raise ValueError('Duplicate bundled grammar source keys')
    if db.bind.dialect.name == 'postgresql':
        db.execute(text('SELECT pg_advisory_xact_lock(916572603)'))
    if not {'grammar_rules', 'grammar_lessons'}.issubset(inspect(db.bind).get_table_names()):
        raise RuntimeError('Run alembic upgrade head before importing bundled grammar')
    lessons = db.query(GrammarLesson).all()
    by_source = {lesson.source_key: lesson for lesson in lessons}
    used_rules = {lesson.grammar_rule_id for lesson in lessons}
    rules = {}
    for rule in db.query(GrammarRule).order_by(GrammarRule.id).all():
        rules.setdefault((rule.jlpt_level, pattern_key(rule.japanese_pattern)), []).append(rule)
    planned, new_rules = [], []
    report = dict(created=0, updated=0, unchanged=0, skipped=0, rules_created=0)
    for record in records:
        existing = by_source.get(record['source_key'])
        key = (record['jlpt_level'], pattern_key(record['pattern']))
        if existing:
            rule = db.get(GrammarRule, existing.grammar_rule_id)
            if not rule or rule.jlpt_level != record['jlpt_level'] or pattern_key(rule.japanese_pattern) != key[1]:
                raise ValueError('A managed grammar lesson was reassigned; refusing to overwrite it')
        else:
            candidates = rules.get(key, [])
            rule = next((candidate for candidate in candidates if candidate.id not in used_rules), None)
            if candidates and rule is None:
                # A supplied/custom lesson already teaches this exact pattern; preserve it.
                report['skipped'] += 1
                continue
            if rule is None:
                rule = GrammarRule(rule_name=record['title'], japanese_pattern=record['pattern'],
                    jlpt_level=record['jlpt_level'], meaning=record['meaning'], usage_notes=record['usage_notes'],
                    examples=[{'japanese': item['ja'], 'english': item.get('en', '')} for item in record['examples']])
                new_rules.append(rule)
            elif rule.id is not None:
                used_rules.add(rule.id)
        planned.append((record, rule, existing))
    db.add_all(new_rules)
    db.flush()
    report['rules_created'] = len(new_rules)
    for record, rule, existing in planned:
        values = LessonInput.model_validate(_lesson_values(record, rule.id)).model_dump()
        if existing is None:
            db.add(GrammarLesson(**values)); report['created'] += 1
        elif any(getattr(existing, key) != value for key, value in values.items()):
            for key, value in values.items():
                setattr(existing, key, value)
            report['updated'] += 1
        else:
            report['unchanged'] += 1
    db.flush()
    return report | {'levels': dict(Counter(record['jlpt_level'] for record, _, _ in planned))}
