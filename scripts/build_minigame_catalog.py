"""Build the single offline game catalog from the existing dictionary; no backend writes."""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def build():
    sys.path.insert(0, str(ROOT / 'backend'))
    from app.services.kanjivg_service import get_stroke_order_response
    rows = json.loads((ROOT / 'backend/app/data/kanji_dictionary.json').read_text(encoding='utf-8'))
    kanji, words, seen, glyphs, notices = [], [], set(), [], set()
    for row in rows:
        level = row.get('jlpt')
        readings = list(dict.fromkeys(r for r in row.get('onyomi', []) + row.get('kunyomi', []) if re.fullmatch('[ぁ-ゖァ-ヺー]+', r)))
        kanji.append({'id': row['kanji'], 'level': level, 'readings': readings, 'meaning': row.get('meaning_vi') or row.get('meaning') or ''})
        for example in row.get('examples', []):
            word, reading = example.get('word', ''), example.get('reading', '')
            if word in seen or not re.fullmatch('[ぁ-ゖァ-ヺ一-龯々ー]+', word) or not re.fullmatch('[ぁ-ゖァ-ヺー]+', reading):
                continue
            seen.add(word)
            words.append({'id': word, 'word': word, 'reading': reading, 'level': level, 'meaning': example.get('meaning_vi') or example.get('meaning') or ''})
        stroke = get_stroke_order_response(row['kanji'])
        if stroke.get('available') and stroke.get('strokes'):
            paths = [item['path'] for item in stroke['strokes'] if item.get('path')]
            glyphs.append({'id': row['kanji'], 'level': level, 'viewBox': stroke['viewBox'], 'paths': paths})
            notices.update(re.findall(r'Copyright[^\n]+', stroke.get('svg', '')))
    target = ROOT / 'shared-games/catalog.json'
    target.parent.mkdir(exist_ok=True)
    metadata = [{'id': item['id'], 'level': item['level'], 'count': len(item['paths'])} for item in glyphs]
    target.write_text(json.dumps({'kanji': kanji, 'words': words, 'strokeMetadata': metadata}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (ROOT / 'shared-games/stroke-catalog.json').write_text(json.dumps({'source': 'KanjiVG', 'license': 'CC BY-SA 3.0', 'glyphs': glyphs}, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    (ROOT / 'shared-games/KANJIVG_LICENSE.md').write_text('# KanjiVG stroke data\n\nSource: https://kanjivg.tagaini.net/\n\nLicense: Creative Commons Attribution-ShareAlike 3.0: https://creativecommons.org/licenses/by-sa/3.0/\n\nThe paths in stroke-catalog.json are extracted from the existing KanjiVG files shipped with SenpaiAI. They retain their original coordinates; the game hides individual paths and displays alternatives. This data remains under CC BY-SA 3.0.\n\nOriginal copyright notices:\n\n' + '\n'.join(sorted(notices)) + '\n', encoding='utf-8')
    print(f'Catalog: {len(kanji)} kanji, {len(words)} standalone words, {len(glyphs)} stroke glyphs')


if __name__ == '__main__':
    if '--audit' in sys.argv:
        sys.path.insert(0, str(ROOT / 'backend'))
        from app.services.kanjivg_service import get_stroke_order_response
        rows = json.loads((ROOT / 'backend/app/data/kanji_dictionary.json').read_text(encoding='utf-8'))
        for level in ['N5', 'N4', 'N3', 'N2', 'N1']:
            group = [row for row in rows if row.get('jlpt') == level]
            examples = [e for row in group for e in row.get('examples', []) if e.get('word') and e.get('reading')]
            playable = {e['word']: e for e in examples if re.fullmatch('[ぁ-ゖァ-ヺ一-龯々ー]+', e['word']) and re.fullmatch('[ぁ-ゖァ-ヺー]+', e['reading'])}
            chars = {row['kanji'] for row in group}
            pairs = [e for e in playable.values() if (e.get('meaning_vi') or e.get('meaning') or '').strip()]
            strokes = [get_stroke_order_response(row['kanji']) for row in group]
            print(level, {'kanji': len(group), 'readable': sum(bool(row.get('onyomi') or row.get('kunyomi')) for row in group), 'examples_with_reading': len(examples), 'playable_words': len(playable), 'pairs': len(pairs), 'distinct_meanings': len({(e.get('meaning_vi') or e.get('meaning')).strip() for e in pairs}), 'two_kanji': sum(len(re.findall('[一-龯々]', word)) >= 2 for word in playable), 'same_level_compounds': sum(bool(re.fullmatch('[一-龯々]{2,}', word)) and set(word) <= chars for word in playable), 'stroke_data': sum(bool(s.get('available')) for s in strokes), 'two_strokes': sum(bool(s.get('available')) and len(s.get('strokes', [])) >= 2 for s in strokes)})
    else:
        build()
