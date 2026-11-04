import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api import analysis as analysis_api
from app.models.schemas import GrammarAnalysisRequest
from app.services.llm_service import JapaneseLearningService
from app.services.grammar_analyzer import deterministic_grammar_analysis


def test_api_uses_ui_language_and_never_overwrites_analysis_with_second_translation(monkeypatch):
    calls = []

    async def analyze(text, **kwargs):
        calls.append((text, kwargs))
        return deterministic_grammar_analysis(text, response_language=kwargs['response_language'])

    async def unexpected(**kwargs):
        pytest.fail('Grammar analysis must not translate again through an unrelated model prompt')

    monkeypatch.setattr(analysis_api.japanese_service, 'analyze_grammar', analyze)
    monkeypatch.setattr(analysis_api.japanese_service, 'translate_text', unexpected)
    user = SimpleNamespace(ui_language='vi')
    response = asyncio.run(analysis_api.analyze_grammar(GrammarAnalysisRequest(text='今日は何をしましたか。'), user))
    assert calls[0][1]['response_language'] == 'vi'
    assert response.sentence_meaning == 'Hôm nay bạn đã làm gì?'
    assert response.translation is None


def test_explicit_language_wins_over_saved_profile(monkeypatch):
    async def analyze(text, **kwargs):
        assert kwargs['response_language'] == 'en'
        return deterministic_grammar_analysis(text, response_language='en')

    monkeypatch.setattr(analysis_api.japanese_service, 'analyze_grammar', analyze)
    response = asyncio.run(analysis_api.analyze_grammar(GrammarAnalysisRequest(text='今日は何をしましたか。', response_language='en'), SimpleNamespace(ui_language='vi')))
    assert response.sentence_meaning == 'What did you do today?'


def test_cache_is_separated_by_language_and_reviewed_data_needs_no_model_call(monkeypatch):
    service = JapaneseLearningService()

    async def unexpected(*args, **kwargs):
        pytest.fail('Reviewed sentence should not need generation')

    monkeypatch.setattr(service.service, 'analyze_grammar', unexpected)
    vi = asyncio.run(service.analyze_grammar('今日は何をしましたか。', response_language='vi'))
    en = asyncio.run(service.analyze_grammar('今日は何をしましたか。', response_language='en'))
    assert vi['sentence_meaning'] == 'Hôm nay bạn đã làm gì?'
    assert en['sentence_meaning'] == 'What did you do today?'
    vi['vocabulary'].clear()
    assert asyncio.run(service.analyze_grammar('今日は何をしましたか。', response_language='vi'))['vocabulary']


def test_persistent_english_returns_grounded_partial_without_caching_wrong_language(monkeypatch):
    service = JapaneseLearningService()
    calls = []

    async def wrong_language(*args, **kwargs):
        calls.append(kwargs)
        return {'sentence_meaning': 'I read a book.', 'vocabulary': [{'term': '本', 'meaning': 'book'}],
                'jlpt_level': 'N5', 'grammar_patterns': [], 'suggestions': ['Read more books.']}

    monkeypatch.setattr(service.service, 'analyze_grammar', wrong_language)
    result = asyncio.run(service.analyze_grammar('難しい記事を翻訳したいと思っています。', response_language='vi'))
    assert result['analysis_status'] == 'partial'
    assert result['sentence_meaning'] is None
    assert result['vocabulary'] == []
    assert 'Chưa xác minh' in result['analysis_note']
    assert '～と思う' in [point['pattern'] for point in result['grammar_patterns']]
    assert len(calls) == 2
    assert len(service._grammar_analysis_cache) == 0


def test_api_rejects_non_japanese_input():
    with pytest.raises(HTTPException) as error:
        asyncio.run(analysis_api.analyze_grammar(GrammarAnalysisRequest(text='hello'), SimpleNamespace(ui_language='vi')))
    assert error.value.status_code == 422
