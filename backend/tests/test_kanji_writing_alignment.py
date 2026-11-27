"""Regression cases for count gaps, separate from the frozen v1 reproduction."""
import pytest
from app.services.kanji_stroke_geometry import evaluate
from app.services.kanji_writing_templates import templates
from app.core.kanji_writing_config import PROFILES


@pytest.mark.parametrize('profile', list(PROFILES))
@pytest.mark.parametrize('missing', [0, 1, 2])
def test_missing_stroke_is_not_an_order_error_and_identifies_the_real_gap(profile, missing):
    raw = templates()['土']['raw']
    result = evaluate(raw[:missing] + raw[missing+1:], raw, strictness=profile)
    gaps = [row for row in result['strokes'] if row['status'] == 'missing']
    assert len(gaps) == 1 and gaps[0]['expected_index'] == missing + 1
    for criterion in ('order', 'direction'):
        assert result['scores'][criterion] == (100 if result['evidence_counts'][criterion] else 0)
    assert not any(row.get('order_error') or row.get('direction_error') for row in result['strokes'])
    assert not result['passed'] and len({row['index'] for row in result['strokes']}) == len(result['strokes'])


@pytest.mark.parametrize('profile', list(PROFILES))
@pytest.mark.parametrize('position', [0, 1, 2, 3])
def test_extra_line_at_any_position_does_not_replace_a_valid_later_stroke(profile, position):
    raw = templates()['土']['raw']
    scribble = [(43,42), (49,48), (43,48), (49,42)]
    result = evaluate(raw[:position] + [scribble] + raw[position:], raw, strictness=profile)
    extras = [row for row in result['strokes'] if row['status'] == 'extra']
    assert len(extras) == 1 and extras[0]['index'] == position + 1
    assert result['scores']['order'] == result['scores']['direction'] == 100
    assert not result['passed']


def test_swapped_and_reversed_strokes_are_still_detected_with_a_count_gap():
    raw = [[(0,0),(100,0)], [(100,0),(100,100)], [(0,100),(100,100)], [(0,0),(100,100)]]
    result = evaluate([raw[1], raw[0], raw[2]], raw)
    assert sum(row['status'] == 'wrong_order' for row in result['strokes']) == 2
    assert any(row['status'] == 'missing' for row in result['strokes'])
    reversed_result = evaluate([list(reversed(raw[0])), raw[1], raw[2]], raw)
    assert reversed_result['strokes'][0]['status'] == 'wrong_direction'


def test_identical_duplicate_strokes_do_not_produce_order_accusations():
    reference = [[(0,0),(100,0)], [(0,0),(100,0)], [(0,100),(100,100)]]
    for trace in (reference[:1] + reference[2:], reference + [reference[0]]):
        result = evaluate(trace, reference)
        assert result['scores']['order'] == result['scores']['direction'] == 100
        assert not result['passed']


def test_empty_submission_and_preview_keep_existing_contract():
    raw = templates()['土']['raw']
    empty = evaluate([], raw)
    assert len(empty['strokes']) == len(raw) and all(row['status'] == 'missing' for row in empty['strokes'])
    assert not empty['passed']
    preview = evaluate(raw[:1], raw, final=False)
    assert preview['provisional'] and not preview['passed']
    assert not any(row['status'] == 'missing' for row in preview['strokes'])
