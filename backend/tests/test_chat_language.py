import asyncio

import pytest

from app.services.chat_language import answer_needs_revision, detect_chat_language, needs_history, same_language_translation
from app.services.chat_grounding import finalize_chat_answer, relevant_chat_documents
from app.services.ollama_service import OllamaJapaneseLearningService


@pytest.mark.parametrize(('question', 'fallback', 'expected'), [
    ('今日は何をしましたか。 có nghĩa là gì', 'en', 'vi'),
    ('What does 今日は何をしましたか mean?', 'vi', 'en'),
    ('Explain the difference between は and が.', 'vi', 'en'),
    ('Hãy giải thích sự khác nhau giữa は và が.', 'en', 'vi'),
    ('"I want to learn Japanese" dịch sang tiếng Việt', 'en', 'vi'),
    ('Please translate "Tôi là sinh viên" into English.', 'vi', 'en'),
    ('こんにちは', 'en', 'en'),
    ('こんにちは', 'vi', 'vi'),
    ('dich cau nay giup toi', 'en', 'vi'),
    ('Good morning', 'vi', 'en'),
])
def test_question_language_wins_over_interface_language(question, fallback, expected):
    assert detect_chat_language(question, fallback) == expected


def test_independent_questions_do_not_receive_old_answers():
    assert not needs_history('Tôi muốn trở thành một kỹ sư phần mềm trong tương lai. dịch câu này sang tiếng việt')
    assert not needs_history('What is the difference between は and が?')
    assert needs_history('Giải thích thêm câu trên')
    assert needs_history('Can you give more examples of that?')


def test_already_vietnamese_translation_uses_current_sentence():
    question = 'Tôi muốn trở thành một kỹ sư phần mềm trong tương lai. dịch câu này sang tiếng việt'
    result = same_language_translation(question, 'vi')
    assert 'đã là tiếng Việt' in result
    assert 'Tôi muốn trở thành một kỹ sư phần mềm' in result
    assert 'Hôm nay' not in result
    assert same_language_translation('今日は何をしましたか。 dịch sang tiếng Việt', 'vi') is None


def test_reviewed_answers_and_cleaning_follow_language():
    answer = finalize_chat_answer('Explain the difference between は and が.', 'bad answer', 'en')
    assert 'marks the topic' in answer
    assert 'marks the subject' in answer
    assert 'chủ đề' not in answer
    answer = finalize_chat_answer('What does 今日は何をしましたか mean?', 'I cannot access dictionaries.', 'en')
    assert 'What did you do today?' in answer
    assert 'cannot' not in answer


def test_translation_never_uses_unrelated_library_sources():
    assert relevant_chat_documents([{'similarity_score': .95, 'content': 'bowing and greetings'}], '今日は何をしましたか。 có nghĩa là gì') == []
    assert relevant_chat_documents([{'similarity_score': .95, 'content': 'から and ので'}], 'Explain は and が') == []


def test_wrong_language_is_retried_with_current_question_only(monkeypatch):
    service = OllamaJapaneseLearningService()
    calls = []
    answers = iter(['The AI cannot access external dictionaries to answer your question.', 'Bạn có thể dùng ví dụ ngắn để luyện tập.'])

    def generate(prompt, system_prompt, **kwargs):
        calls.append((prompt, system_prompt))
        return next(answers)

    monkeypatch.setattr(service, '_call_ollama', generate)
    result = asyncio.run(service.chat_response('Tôi nên luyện tập thế nào?', 'OLD WRONG ANSWER', response_language='vi'))
    assert result['answer'].startswith('Bạn có thể')
    assert len(calls) == 2
    assert 'OLD WRONG ANSWER' not in calls[1][0]
    assert 'Vietnamese' in calls[1][1]


def test_persistent_generation_failure_is_an_error_not_a_chat_answer(monkeypatch):
    service = OllamaJapaneseLearningService()
    monkeypatch.setattr(service, '_call_ollama', lambda *args, **kwargs: 'The AI cannot access dictionaries to answer your question.')
    with pytest.raises(RuntimeError, match='chat_generation_failed'):
        asyncio.run(service.chat_response('Giải thích giúp tôi', response_language='vi'))


def test_quality_check_allows_explanations_and_detects_mixed_language():
    assert not answer_needs_revision('**は** marks the topic. **が** marks the subject.', 'en')
    assert not answer_needs_revision('**は** đánh dấu chủ đề. **が** đánh dấu chủ ngữ.', 'vi')
    assert answer_needs_revision('The sentence means this and the explanation is in English because the AI cannot answer.', 'vi')


def test_translation_target_is_allowed_but_foreign_explanation_is_not():
    translated = 'This is the book that you asked me to bring.'
    explanation = 'Đây là bản dịch của câu bạn vừa nhập.'
    assert not answer_needs_revision(translated + '\n\n' + explanation, 'vi', 'Dịch câu này sang tiếng Anh')
    mixed = 'Bạn có thể dùng ví dụ này để học.\n\nThe explanation is that the subject is the person who does the action.'
    assert answer_needs_revision(mixed, 'vi')
