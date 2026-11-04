import asyncio

from app.services.chat_grounding import clean_chat_answer, finalize_chat_answer, relevant_chat_documents, reviewed_reference
from app.services.ollama_service import OllamaJapaneseLearningService


def test_unrelated_retrieval_is_excluded():
    results = [{"similarity_score": 0.14, "content": "greetings"},
               {"similarity_score": 0.75, "content": "relevant grammar"}]
    assert relevant_chat_documents(results) == [results[1]]


def test_reviewed_reference_is_only_used_for_particle_comparison():
    assert reviewed_reference("こんにちは") == ("", [])
    context, sources = reviewed_reference("Phân biệt は và が")
    assert "は (wa): đánh dấu chủ đề" in context
    assert "が (ga): đánh dấu chủ ngữ" in context
    assert sources[0]["url"].startswith("https://guidetojapanese.org/")


def test_cleaning_preserves_answer_and_removes_internal_labels():
    assert clean_chat_answer("**Intent:** GRAMMAR_EXPLANATION\n\n**Output:**\n\n**は**: chủ đề.") == "**は**: chủ đề."
    assert clean_chat_answer("Đáp án đúng: B. 学生") == "Đáp án đúng: B. 学生"


def test_ollama_chat_uses_one_low_temperature_generation(monkeypatch):
    service = OllamaJapaneseLearningService()
    calls = []

    def generate(prompt, system_prompt, **kwargs):
        calls.append((prompt, system_prompt, kwargs))
        return "**Output:**\n\nHôm nay bạn đã làm gì?"

    monkeypatch.setattr(service, "_call_ollama", generate)
    response = asyncio.run(service.chat_response("今日は何をしましたか。 có nghĩa là gì", "Tài liệu", "N4"))
    assert 'Hôm nay bạn đã làm gì?' in response['answer']
    assert response["jlpt_level"] == "N4"
    assert len(calls) == 1
    assert calls[0][2]["temperature"] == 0


def test_incorrect_particle_answer_uses_cited_reviewed_explanation():
    question = "Hãy giải thích sự khác nhau giữa は và が."
    result = finalize_chat_answer(question, "は chỉ chủ ngữ, が là tân ngữ.")
    assert "は (wa): đánh dấu chủ đề" in result
    assert "が (ga): đánh dấu chủ ngữ" in result
    assert "が là tân ngữ" not in result
    # Keep valid model explanations and unrelated answers intact.
    valid = "は đánh dấu chủ đề; が đánh dấu chủ ngữ."
    assert finalize_chat_answer(question, valid) == valid
    assert finalize_chat_answer("Chào bạn", "Xin chào!") == "Xin chào!"
