import asyncio
from types import SimpleNamespace

import pytest
import httpx
import json

from app.api.analysis import analyze_grammar
from app.models.schemas import GrammarAnalysisRequest
from app.services.grammar_analyzer import (
    deterministic_grammar_analysis, grammar_analysis_is_valid, grounded_model_analysis, prose_matches_language,
)
from app.services.grammar_grounded import grounded_patterns, partial_analysis
from app.services.llm_service import JapaneseLearningService
from app.services.ollama_service import OllamaJapaneseLearningService, GRAMMAR_SCHEMA


@pytest.mark.parametrize('language', ['vi', 'en'])
def test_reported_sentences_have_complete_grounded_bilingual_analysis(language):
    question = deterministic_grammar_analysis('好きな日本料理は何ですか。', response_language=language)
    conditional = deterministic_grammar_analysis('この漢字は難しいですが、何度も書けば覚えられると思います。', response_language=language)
    assert grammar_analysis_is_valid(question, language)
    assert grammar_analysis_is_valid(conditional, language)
    assert question['jlpt_level'] == 'N5'
    assert conditional['jlpt_level'] == 'N4'
    forms = {point['pattern'] for point in conditional['grammar_patterns']}
    assert {'～ですが', 'Vば', '～と思う'} <= forms
    assert any('られる' in point for point in forms)
    if language == 'vi':
        assert question['sentence_meaning'] == 'Món ăn Nhật bạn yêu thích là gì?'
        assert conditional['sentence_meaning'] == 'Tôi nghĩ rằng tuy chữ Kanji này khó, nhưng nếu viết nhiều lần thì có thể nhớ được.'
    else:
        assert 'favorite Japanese dish' in question['sentence_meaning']
        assert 'if you write it repeatedly' in conditional['sentence_meaning']


def test_composition_covers_changed_words_but_does_not_translate_uncovered_clauses():
    question = deterministic_grammar_analysis('好きなスポーツは何ですか。', response_language='vi')
    assert 'Môn thể thao' in question['sentence_meaning']
    changed = deterministic_grammar_analysis('日本語は複雑ですが、毎日練習すれば話せると思います。', response_language='vi')
    assert 'luyện tập mỗi ngày thì có thể nói được' in changed['sentence_meaning']
    assert deterministic_grammar_analysis('好きな日本料理は何ですか。でも食べられません。') is None
    assert deterministic_grammar_analysis('この漢字は難しいですが、書けば忘れると思います。') is None


@pytest.mark.parametrize(('text', 'meaning', 'form'), [
    ('本を読みたいです。', 'Tôi muốn đọc sách.', 'Vたい'),
    ('彼女は映画を見たくないです。', 'Cô ấy không muốn xem phim.', 'Vたい'),
    ('私は昨日学校へ行きませんでした。', 'Tôi đã không đi đến trường học hôm qua.', 'Vませんでした'),
])
def test_desire_negation_and_implicit_subject_are_preserved(text, meaning, form):
    result = deterministic_grammar_analysis(text)
    assert result['sentence_meaning'] == meaning
    assert form in {point['pattern'] for point in result['grammar_patterns']}


@pytest.mark.parametrize(('text', 'expected', 'excluded'), [
    ('雨が降っています。', 'Vている', 'Vます'),
    ('宿題をしなければなりません。', 'Vなければならない', 'Vません'),
    ('日本語を話すことができます。', 'Vることができる', 'Vます'),
    ('本を読みたいと思っています。', '～と思う', 'Vている'),
])
def test_longer_forms_take_priority(text, expected, excluded):
    forms = {point['pattern'] for point in grounded_patterns(text)}
    assert expected in forms
    assert excluded not in forms


def test_unknown_or_lexical_kana_is_not_fabricated_as_grammar():
    assert grounded_patterns('こんにちは。') == []
    assert grounded_patterns('ますます難しい。') == []
    assert partial_analysis('猫。', 'vi') is None


def test_language_detection_accepts_quoted_glosses_but_rejects_foreign_prose():
    assert prose_matches_language('「yêu thích」', 'vi')
    assert prose_matches_language('nghề nghiệp', 'vi')
    assert not prose_matches_language('The subject is marked by は.', 'vi')
    assert not prose_matches_language('The meaning is "yêu thích".', 'vi')
    assert not prose_matches_language('Đánh dấu chủ đề.', 'en')


def test_bad_model_patterns_are_replaced_and_lost_desire_blocks_translation():
    result = grounded_model_analysis('雑誌を読みたいです。', {
        'sentence_meaning': 'Tôi đọc tạp chí.', 'jlpt_level': 'N5',
        'grammar_patterns': [{'pattern': 'を', 'evidence': 'を', 'explanation': 'Đánh dấu chủ ngữ.'}],
        'vocabulary': [{'term': '雑誌', 'meaning': 'magazine'}],
    }, 'vi')
    assert result['sentence_meaning'] == ''
    assert result['vocabulary'] == []
    assert 'tân ngữ' in next(point['explanation'] for point in result['grammar_patterns'] if point['pattern'] == 'を')


def test_prompt_echo_is_not_a_sentence_translation():
    result = grounded_model_analysis('新しい技術を学ぶことができます。', {
        'sentence_meaning': 'Mọi nghĩa từ, nghĩa câu, giải thích phải viết bằng tiếng Việt có dấu.',
        'jlpt_level': 'N5',
    }, 'vi')
    assert not grammar_analysis_is_valid(result, 'vi')


def test_api_exposes_partial_status_and_keeps_original_input(monkeypatch):
    from app.api import analysis as api

    async def partial(text, **kwargs):
        return partial_analysis(text, kwargs['response_language'])

    monkeypatch.setattr(api.japanese_service, 'analyze_grammar', partial)
    text = '雨が降っています。'
    response = asyncio.run(analyze_grammar(GrammarAnalysisRequest(text=text), SimpleNamespace(ui_language='vi')))
    assert response.text == text
    assert response.analysis_status == 'partial'
    assert response.analysis_note
    assert response.sentence_meaning is None
    assert response.grammar_patterns


def test_unsupported_sentence_still_reports_failure_when_model_is_unavailable(monkeypatch):
    service = JapaneseLearningService()

    async def offline(*args, **kwargs):
        raise RuntimeError('offline')

    monkeypatch.setattr(service.service, 'analyze_grammar', offline)
    with pytest.raises(RuntimeError, match='grammar_analysis_failed'):
        asyncio.run(service.analyze_grammar('猫。', response_language='vi'))


def test_ollama_receives_schema_and_input_specific_grammar_hints(monkeypatch):
    service = OllamaJapaneseLearningService()
    calls = []

    def generate(prompt, system, **kwargs):
        calls.append((prompt, kwargs))
        return '{"sentence_meaning":"Tôi muốn đọc tạp chí.","jlpt_level":"N5"}'

    monkeypatch.setattr(service, '_call_ollama', generate)
    asyncio.run(service.analyze_grammar('雑誌を読みたいです。', response_language='vi'))
    assert calls[0][1]['response_format'] == GRAMMAR_SCHEMA
    assert '読みたい' in calls[0][0]
    assert calls[0][1]['max_retries'] == 0


def test_structured_generation_uses_configured_url_without_legacy_sdk(monkeypatch):
    from app.services import ollama_service as module

    service = OllamaJapaneseLearningService()
    service.base_url = 'http://configured-ollama:11434/'
    requests = []
    original_client = httpx.Client

    def respond(request):
        requests.append(request)
        return httpx.Response(200, json={'done': True, 'done_reason': 'stop', 'message': {'content': '{"ok":true}'}})

    def unexpected(*args, **kwargs):
        pytest.fail('Structured generation must not use the legacy default host or SDK')

    monkeypatch.setattr(service, 'check_ollama_connection', unexpected)
    monkeypatch.setattr(module.httpx, 'Client', lambda **kwargs: original_client(transport=httpx.MockTransport(respond), **kwargs))
    response = service._call_ollama('input', 'system', response_format=GRAMMAR_SCHEMA)
    assert response == '{"ok":true}'
    assert str(requests[0].url) == 'http://configured-ollama:11434/api/chat'
    payload = json.loads(requests[0].content)
    assert payload['format'] == GRAMMAR_SCHEMA
    assert payload['model'] == service.model
