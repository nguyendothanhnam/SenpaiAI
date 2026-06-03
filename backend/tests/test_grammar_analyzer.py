from app.services.grammar_analyzer import sanitize_grammar_analysis


def test_known_gakusei_meaning_analysis_is_vietnamese_and_n5():
    result = sanitize_grammar_analysis(
        "「がくせい」はどういう意味ですか。",
        raw_result={
            "sentence_meaning": '"がくせい" means book.',
            "vocabulary": [{"term": "がくせい", "meaning": "book"}],
            "grammar_points": [{"pattern": "がくせい", "explanation": "book", "example": ""}],
            "jlpt_level": "N3",
            "difficulty_score": 5.0,
            "suggestions": ["Review articles"],
        },
        include_vietnamese=True,
    )

    assert result["sentence_meaning"] == '"がくせい" có nghĩa là gì?'
    assert result["jlpt_level"] == "N5"
    assert result["difficulty_score"] == 2.5
    assert result["vocabulary"] == [
        {"term": "がくせい / 学生", "meaning": "học sinh, sinh viên", "jlpt_level": "N5"},
        {"term": "意味", "meaning": "ý nghĩa, nghĩa", "jlpt_level": "N5"},
    ]
    assert [point["pattern"] for point in result["grammar_patterns"]] == [
        "A は B ですか",
        "どういう意味",
    ]
    assert result["suggestions"] == [
        "Ôn mẫu câu 「〜はどういう意味ですか」",
        "Ôn từ vựng N5 về người và nghề nghiệp",
    ]


def test_uncertain_vocab_does_not_invent_meaning():
    result = sanitize_grammar_analysis(
        "これはテストです。",
        raw_result={
            "vocabulary": [{"term": "テスト", "meaning": ""}],
            "grammar_points": [{"pattern": "A は B です", "explanation": "A là B", "example": ""}],
            "suggestions": ["Review prepositions", "Ôn mẫu câu 「A は B です」"],
            "jlpt_level": "N5",
        },
        include_vietnamese=True,
    )

    assert result["vocabulary"][0]["meaning"] == "Chưa chắc chắn về từ này"
    assert result["suggestions"] == ["Ôn mẫu câu 「A は B です」"]


def test_common_vocab_overrides_bad_model_meaning():
    result = sanitize_grammar_analysis(
        "がくせいです。",
        raw_result={
            "vocabulary": [{"term": "がくせい", "meaning": "book"}],
            "grammar_points": [],
            "suggestions": [],
            "jlpt_level": "N5",
        },
        include_vietnamese=True,
    )

    assert result["vocabulary"][0] == {
        "term": "がくせい / 学生",
        "meaning": "học sinh, sinh viên",
        "jlpt_level": "N5",
    }
