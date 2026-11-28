"""Deterministic synthetic calibration, not a substitute for handwritten validation."""
import argparse
import json
import math
import random
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.kanji_stroke_geometry import resample
from app.services.kanji_writing_templates import templates, comparison_templates, evaluate_character
from app.core.kanji_writing_config import VERSION, PROFILES


def cases():
    bank = templates()
    selected = []
    for level in ('N5', 'N4', 'N3'):
        keys = sorted((k for k, v in bank.items() if v['level'] == level and 3 <= len(v['raw']) <= 12), key=ord)
        selected.extend(keys[round(i * (len(keys) - 1) / 9)] for i in range(10))
    selected = list(dict.fromkeys([chr(0x6708), chr(0x65e5), *selected]))
    for key in selected:
        raw = bank[key]['raw']
        for variant in range(8):
            rng = random.Random(ord(key) * 100 + variant)
            scale = (.45, .7, 1., 1.3, .8, 1., .65, 1.15)[variant]
            transformed = []
            for stroke in raw:
                sampled = resample(stroke, (9, 17, 40, 64, 24, 12, 17, 40)[variant])
                drift = 4.5 if variant >= 6 else 2
                dx, dy = rng.uniform(-drift, drift), rng.uniform(-drift, drift)
                points = []
                for i, (x, y) in enumerate(sampled):
                    bow = math.sin(math.pi * i / (len(sampled) - 1)) * (1.8 if variant >= 3 else 0)
                    points.append(((x * (1.10 if variant == 4 else 1) + dx + bow + rng.uniform(-.45, .45)) * scale + 17,
                                   (y * (.94 if variant == 4 else 1) + dy + rng.uniform(-.45, .45)) * scale - 8))
                transformed.append(points)
            yield key, 'correct', variant, transformed
        index = ord(key) % (len(raw) - 1)
        swapped = list(raw); swapped[index], swapped[index + 1] = swapped[index + 1], swapped[index]
        yield key, 'wrong_order', index, swapped
        index = ord(key) % len(raw)
        reversed_strokes = list(raw); reversed_strokes[index] = list(reversed(raw[index]))
        yield key, 'wrong_direction', index, reversed_strokes
        yield key, 'missing', 0, raw[:-1]
        yield key, 'extra', 0, raw + [raw[0]]
        bad = list(raw); bad[0] = [(0, 0), (100, 100), (0, 100), (100, 0)]
        yield key, 'wrong_shape', 0, bad
    for target, other in ((0x672a,0x672b),(0x571f,0x58eb),(0x5927,0x72ac),(0x5927,0x592a),(0x65e5,0x76ee),(0x4eba,0x5165)):
        yield chr(target), 'confusion', other, comparison_templates()[chr(other)]['raw']


def measure(strictness='standard'):
    groups, failures, characters, correct_characters = {}, [], set(), set()
    false_warnings = 0
    started = time.perf_counter()
    for key, kind, variant, strokes in cases():
        result = evaluate_character(key, strokes, strictness=strictness)
        if kind == 'correct' and result['confusion']:
            false_warnings += 1
        characters.add(key)
        if kind == 'correct':
            correct_characters.add(key)
        statuses = [r['status'] for r in result['strokes']]
        ok = result['passed'] if kind == 'correct' else (
            bool(result['confusion']) if kind == 'confusion' else kind in statuses)
        row = groups.setdefault(kind, {'success': 0, 'total': 0})
        row['success'] += int(ok); row['total'] += 1
        if not ok:
            failures.append({'kanji': key, 'kind': kind, 'variant': variant, 'score': result['overall_score'], 'scores': result['scores'], 'statuses': statuses})
    for row in groups.values():
        row['rate'] = round(row['success'] / row['total'], 4)
    return {'version':VERSION,'strictness':strictness,'seed': 'codepoint*100+variant', 'character_count': len(characters), 'groups': groups, 'failures': failures,
            'correct_character_count':len(correct_characters),
            'correct_characters_by_level':{level:sorted(k for k in correct_characters if templates()[k]['level']==level) for level in ('N5','N4','N3')},
            'false_confusion_warnings_on_correct':false_warnings,'elapsed_seconds':round(time.perf_counter()-started,3),
            'limitations': 'Synthetic KanjiVG transforms; no claim about real handwriting accuracy. Error detection requires the corresponding error label, not merely failing the whole character.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--strictness',choices=tuple(PROFILES),default='standard')
    args = parser.parse_args(); report = measure(args.strictness)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k != 'failures'}, ensure_ascii=True))
