"""Measure standard handwriting cases and count gaps at every stroke position.

Run before and after changes with the same source/seed. Synthetic only; no AI,
learner database, real handwriting traces or threshold fitting.
"""
import argparse
import hashlib
import inspect
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.calibrate_kanji_writing import cases, measure
from scripts.reproduce_kanji_writing_issue import reproduction
from app.core.kanji_writing_config import VERSION
from app.services.kanji_writing_templates import templates
from app.services.kanji_stroke_geometry import evaluate


def gap_cases():
    keys = sorted({key for key, kind, _, _ in cases() if kind == 'correct'})
    for key in keys:
        raw = templates()[key]['raw']
        for index in range(len(raw)):
            yield key, 'missing_position', index + 1, raw[:index] + raw[index + 1:]
        # A short crossing scribble stays inside the character's bbox; it is
        # deliberately not a plausible duplicate of an ordinary Kanji stroke.
        x = [point[0] for stroke in raw for point in stroke]
        y = [point[1] for stroke in raw for point in stroke]
        cx, cy = (min(x) + max(x)) / 2, (min(y) + max(y)) / 2
        size = max(max(x) - min(x), max(y) - min(y)) * .035
        extra = [(cx-size, cy-size), (cx+size, cy+size), (cx-size, cy+size), (cx+size, cy-size)]
        for index in range(len(raw) + 1):
            yield key, 'extra_position', index + 1, raw[:index] + [extra] + raw[index:]


def measure_gaps(strictness):
    groups, failures = {}, []
    samples = []
    for key, kind, index, trace in gap_cases():
        samples.append([key, kind, index, trace])
        result = evaluate(trace, templates()[key]['raw'], strictness=strictness)
        error = 'missing' if kind == 'missing_position' else 'extra'
        found = [row for row in result['strokes'] if row['status'] == error]
        positioned = len(found) == 1 and (found[0]['expected_index'] if error == 'missing' else found[0]['index']) == index
        no_false_order = result['scores']['order'] == 100
        success = positioned and no_false_order and not result['passed']
        group = groups.setdefault(kind, {'total': 0, 'success': 0, 'correct_location': 0, 'no_false_order_penalty': 0})
        group['total'] += 1
        group['success'] += int(success)
        group['correct_location'] += int(positioned)
        group['no_false_order_penalty'] += int(no_false_order)
        if not success:
            failures.append({'kanji': key, 'kind': kind, 'position': index, 'scores': result['scores'],
                'rows': [{k: row.get(k) for k in ('index', 'status', 'expected_index', 'matched_index')} for row in result['strokes']]})
    for group in groups.values():
        group['rate'] = round(group['success'] / group['total'], 4)
    return {'dataset_sha256': hashlib.sha256(json.dumps(samples, ensure_ascii=True).encode()).hexdigest(),
            'groups': groups, 'failures': failures}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    report = {'phase': args.phase, 'version': VERSION, 'reproduction': reproduction(), 'profiles': {},
        'evaluate_source_sha256': hashlib.sha256(inspect.getsource(evaluate).encode()).hexdigest(),
        'limitations': ['Synthetic templates and fixed noise, not handwritten-user accuracy.',
            'A missing/extra position is unobservable for identical overlapping strokes; do not treat the generator position as a human gold label.']}
    for profile in ('easy', 'standard', 'strict'):
        report['profiles'][profile] = {'existing_calibration': measure(profile), 'gap_calibration': measure_gaps(profile)}
        print(profile, json.dumps(report['profiles'][profile]['gap_calibration']['groups']), flush=True)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
