import asyncio
import json

import pytest

from app.services import internship_service as interview


@pytest.mark.parametrize(("coverage", "cap"), [("off_topic", 25), ("partial", 69), ("full", 100)])
def test_interview_caps_content_scores_by_coverage(monkeypatch, coverage, cap):
    model_calls = []

    async def completion(system, prompt, *, response_schema):
        model_calls.append(prompt)
        assert json.loads(prompt)["criteria"] == "Explain the indexing tradeoff"
        return json.dumps({
            "grammar_score": 92, "keigo_score": 91, "manner_score": 100,
            "technical_score": 100, "cv_alignment_score": 100, "coverage": coverage,
            "evidence": 1, "corrected_sentence": "SQLを使いました。",
            "strength_vi": "Bạn đã nêu công nghệ sử dụng.",
            "improvement_vi": "Hãy giải thích vì sao chọn chỉ mục.",
        })

    monkeypatch.setattr(interview.japanese_service, "voice_completion", completion)
    result = asyncio.run(interview.evaluate_turn_with_ai(
        "IT", {"expected_criteria": "Explain the indexing tradeoff"}, "SQLを使いました。", {},
    ))
    assert result["technical_score"] == result["manner_score"] == result["cv_alignment_score"] == cap
    assert result["grammar_score"] == 92
    assert "Cần cải thiện" in result["advice_vi"]
    assert ("Điểm làm tốt" in result["advice_vi"]) == (coverage != "off_topic")
    repeated = asyncio.run(interview.evaluate_turn_with_ai(
        "IT", {"message_ja": "SQLを使いましたか？", "expected_criteria": "Explain the indexing tradeoff"},
        "SQLを使いましたか", {},
    ))
    assert repeated["score_cap"] == 0
    assert repeated["grammar_score"] == repeated["technical_score"] == 0
    assert len(model_calls) == 1


@pytest.mark.parametrize("score", [None, True])
def test_interview_rejects_invalid_scores(monkeypatch, score):
    async def completion(*args, **kwargs):
        return json.dumps({
            "grammar_score": score, "keigo_score": 70, "manner_score": 70,
            "coverage": "full", "evidence": 1, "corrected_sentence": "SQLを使いました。",
            "strength_vi": None, "improvement_vi": "Hãy nêu lý do.",
        })

    monkeypatch.setattr(interview.japanese_service, "voice_completion", completion)
    with pytest.raises(interview.InterviewEvaluationUnavailable):
        asyncio.run(interview.evaluate_turn_with_ai("IT", {}, "SQLを使いました。"))


def test_interview_localizes_feedback_without_regrading(monkeypatch):
    async def completion(*args, **kwargs):
        return json.dumps({
            "grammar_score": 84, "keigo_score": 85, "manner_score": 80,
            "coverage": "full", "evidence": 1, "corrected_sentence": None,
            "strength_vi": "技術の選択がよく説明されています。",
            "improvement_vi": "選択した理由をもう少し詳しく説明してください。",
        })

    monkeypatch.setattr(interview.japanese_service, "voice_completion", completion)
    result = asyncio.run(interview.evaluate_turn_with_ai("IT", {}, "SQLを使いました。"))
    assert result["grammar_score"] == 84
    assert result["evidence"] == "SQLを使いました。"
    assert "giải thích lý do" in result["advice_vi"]
    assert "説明" not in result["advice_vi"]


@pytest.mark.parametrize("evidence", [0, 8, "invented quote"])
def test_interview_can_grade_when_evidence_selection_fails(monkeypatch, evidence):
    async def completion(*args, **kwargs):
        return json.dumps({
            "grammar_score": 84, "keigo_score": 85, "manner_score": 80,
            "coverage": "partial", "evidence": evidence, "corrected_sentence": "Unverified correction",
            "strength_vi": "Bạn đã nêu công nghệ.", "improvement_vi": "Nhận xét chưa đối chiếu.",
        })

    monkeypatch.setattr(interview.japanese_service, "voice_completion", completion)
    result = asyncio.run(interview.evaluate_turn_with_ai("IT", {}, "SQLを使いました。"))
    assert result["evidence"] == ""
    assert result["corrected_sentence"] is None
    assert result["score_cap"] == 69
    assert "Nhận xét chưa đối chiếu" not in result["advice_vi"]


@pytest.mark.parametrize("evidence", [2, 0])
def test_compact_interview_requires_valid_evidence(monkeypatch, evidence):
    calls = []

    async def completion(system, prompt, *, response_schema, output_tokens=360):
        calls.append(output_tokens)
        if output_tokens == 100:
            return json.dumps({
                "grammar": 80, "keigo": 90, "manner": 70,
                "coverage": "full", "evidence": evidence, "point": "reason",
            })
        return json.dumps({
            "grammar_score": 80, "keigo_score": 90, "manner_score": 70, "coverage": "partial",
            "evidence": 1, "corrected_sentence": None, "strength_vi": None, "improvement_vi": "Nêu lý do.",
        })

    monkeypatch.setattr(interview.japanese_service, "voice_completion", completion)
    sentence = "検索条件に使う列にインデックスを加え、応答時間を二秒から一秒に短縮しました。"
    answer = "実行計画を確認し、全表走査を特定しました。" + sentence
    result = asyncio.run(interview.evaluate_turn_with_ai("IT", {}, answer))
    if evidence:
        assert calls == [100]
        assert result["evidence"] == sentence
        assert "điểm đánh đổi" in result["advice_vi"]
        assert "［方法］を選びました" in result["advice_vi"]
    else:
        assert calls == [100, 360]
        assert result["score_cap"] == 69
