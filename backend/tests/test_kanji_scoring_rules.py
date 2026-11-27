import pytest
from app.api.kanji_writing import rules
from app.core import kanji_writing_config as cfg
from app.services.kanji_stroke_geometry import evaluate


@pytest.fixture
def strokes():
    return [[(0, 0), (100, 0)], [(100, 0), (100, 100)], [(0, 100), (100, 100)]]


@pytest.mark.parametrize('profile', ['easy', 'standard', 'strict'])
def test_perfect_trace_uses_published_rules(profile, strokes):
    result = evaluate(strokes, strokes, strictness=profile)
    assert result['passed'] and result['overall_score'] == 100
    assert all(row['criterion_scores'] == {'order': 100, 'direction': 100, 'shape': 100} for row in result['strokes'])
    assert result['thresholds'] == rules()['profiles'][profile]
    assert result['score_weights'] == rules()['weights']


def test_scores_follow_configuration_instead_of_hardcoded_weights(strokes, monkeypatch):
    monkeypatch.setattr(cfg, 'SCORE_WEIGHTS', {'order': 0, 'direction': 0, 'shape': 0, 'completeness': 1})
    result = evaluate(strokes[:-1], strokes)
    assert result['overall_score'] == result['scores']['completeness']
    assert result['overall_score'] == 67 and not result['passed']


def test_missing_extra_and_uncertain_are_explained(strokes):
    missing = evaluate(strokes[:-1], strokes)
    assert missing['scores']['completeness'] == 67
    assert next(r for r in missing['strokes'] if r['status'] == 'missing')['criterion_scores']['shape'] == 0
    extra = evaluate(strokes + [[(50, 30), (60, 40)]], strokes)
    assert extra['scores']['completeness'] == 67 and not extra['passed']
    assert next(r for r in extra['strokes'] if r['status'] == 'extra')['criterion_scores']['shape'] is None
    empty = evaluate([], strokes)
    assert empty['evidence_counts'] == {'order': 0, 'direction': 0, 'matched': 0}
    assert not empty['passed']


def test_reversed_and_reordered_strokes_report_independent_criteria(strokes):
    reversed_result = evaluate([list(reversed(strokes[0])), *strokes[1:]], strokes)
    assert reversed_result['strokes'][0]['criterion_scores']['direction'] == 0
    assert reversed_result['strokes'][0]['criterion_scores']['shape'] == 100
    assert not reversed_result['passed']
    swapped = evaluate([strokes[1], strokes[0], strokes[2]], strokes)
    assert any(row['criterion_scores']['order'] == 0 for row in swapped['strokes'])
    assert not swapped['passed']


def test_legacy_levels_still_available_and_public_rules_show_three_levels():
    assert set(rules()['profiles']) == {'easy', 'standard', 'strict'}
    assert {'very_easy', 'very_strict'} <= cfg.PROFILES.keys()


def test_pass_threshold_uses_config(strokes, monkeypatch):
    monkeypatch.setattr(cfg, 'PASS_SCORE', 101)
    result = evaluate(strokes, strokes)
    assert result['overall_score'] == 100 and result['pass_score'] == 101
    assert not result['passed']
