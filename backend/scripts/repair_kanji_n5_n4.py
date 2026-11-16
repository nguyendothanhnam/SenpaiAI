"""Fill missing N5/N4 metadata from the checked-in source snapshot; never relabel kanji."""
import argparse
import json
import os
from pathlib import Path
import tempfile

ROOT = Path(__file__).resolve().parents[1]
DICTIONARY = ROOT / 'app/data/kanji_dictionary.json'
DATA = Path(__file__).resolve().parent / 'data'


def repair(rows, metadata, meanings):
    result = []
    for original in rows:
        row = dict(original)
        if row.get('jlpt') in {'N5', 'N4'}:
            char = row['kanji']
            source = metadata[char]
            for field in ('meaning', 'meaning_vi'):
                if not row.get(field):
                    row[field] = meanings[char]
            if not row.get('meaning_en'):
                row['meaning_en'] = ', '.join(source['meanings'])
            if not row.get('onyomi'):
                row['onyomi'] = [to_katakana(value) for value in source['readings_on'] or []]
            if not row.get('kunyomi'):
                row['kunyomi'] = source['readings_kun'] or []
            for field in ('strokes', 'stroke_count'):
                if not row.get(field):
                    row[field] = source['strokes']
            if not row.get('grade'):
                row['grade'] = source['grade']
            if not row.get('frequency'):
                row['frequency'] = source['freq']
        result.append(row)
    return result


def to_katakana(value):
    return ''.join(chr(ord(char) + 0x60) if '\u3041' <= char <= '\u3096' else char for char in value)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true', help='Apply repairs; otherwise only report')
    args = parser.parse_args()
    rows = json.loads(DICTIONARY.read_text(encoding='utf-8'))
    metadata = json.loads((DATA / 'kanji_n5_n4_metadata.json').read_text(encoding='utf-8'))
    meanings = json.loads((DATA / 'kanji_n5_n4_vi.json').read_text(encoding='utf-8'))
    repaired = repair(rows, metadata, meanings)
    print('Changed entries:', sum(before != after for before, after in zip(rows, repaired)))
    if args.write:
        descriptor, name = tempfile.mkstemp(dir=DICTIONARY.parent, suffix='.tmp')
        try:
            with os.fdopen(descriptor, 'w', encoding='utf-8') as output:
                json.dump(repaired, output, ensure_ascii=False, indent=2)
                output.write('\n')
            os.replace(name, DICTIONARY)
        finally:
            if Path(name).exists():
                Path(name).unlink()
