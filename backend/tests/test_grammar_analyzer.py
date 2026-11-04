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
        "は",
        "どういう意味ですか",
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


def test_today_question_ignores_unrelated_model_output_and_is_n5():
    result = sanitize_grammar_analysis('今日は何をしましたか。', {
        'sentence_meaning': 'This translates to: What did you do today?',
        'vocabulary': [{'term': 'がくせい', 'meaning': 'student'}],
        'grammar_patterns': [{'pattern': '学生', 'explanation': 'Student', 'example': ''}],
        'suggestions': ['Review English articles'], 'jlpt_level': 'N4',
    }, response_language='vi')
    assert result['sentence_meaning'] == 'Hôm nay bạn đã làm gì?'
    assert result['jlpt_level'] == 'N5'
    assert [item['term'] for item in result['vocabulary']] == ['今日', '何', 'しました']
    assert [point['pattern'] for point in result['grammar_patterns']] == ['は', 'を', 'Vました', 'か']
    assert result['grammar_points'] == result['grammar_patterns']
    assert result['translation'] is None


def test_reviewed_analysis_has_a_separate_english_version():
    result = sanitize_grammar_analysis('今日は何をしましたか。', {}, response_language='en')
    assert result['sentence_meaning'] == 'What did you do today?'
    assert result['vocabulary'][1]['meaning'] == 'what'
    assert 'past' in result['grammar_patterns'][2]['explanation']
    assert 'Dạng' not in result['grammar_patterns'][2]['explanation']


def test_unrelated_vocab_and_grammar_cannot_survive_sanitization():
    result = sanitize_grammar_analysis('本を読みたいと思っています。', {
        'sentence_meaning': 'Tôi đọc sách.', 'jlpt_level': 'N5',
        'vocabulary': [{'term': '学生', 'meaning': 'sinh viên'}, {'term': '本', 'meaning': 'sách'}],
        'grammar_patterns': [
            {'pattern': 'どういう意味', 'explanation': 'nghĩa là gì', 'evidence': 'どういう意味'},
            {'pattern': 'を', 'explanation': 'Đánh dấu tân ngữ.', 'evidence': '本を'},
        ],
    }, response_language='vi')
    assert '本' in [item['term'] for item in result['vocabulary']]
    assert all(item['term'] in '本を読みたいと思っています。' for item in result['vocabulary'])
    assert 'を' in [item['pattern'] for item in result['grammar_patterns']]
    assert 'どういう意味' not in [item['pattern'] for item in result['grammar_patterns']]


def test_reviewed_basic_clauses_have_grounded_words_and_patterns():
    school = sanitize_grammar_analysis('私は毎日学校へ行きます。', {}, response_language='vi')
    assert school['sentence_meaning'] == 'Tôi đi đến trường học mỗi ngày.'
    assert [item['term'] for item in school['vocabulary']] == ['私', '毎日', '学校', '行きます']
    assert [point['pattern'] for point in school['grammar_patterns']] == ['は', 'へ', 'Vます']
    reading = sanitize_grammar_analysis('彼女は昨日新聞を読みました。', {}, response_language='en')
    assert reading['sentence_meaning'] == 'She read a newspaper yesterday.'
    assert reading['grammar_patterns'][-1]['pattern'] == 'Vました'
    home = sanitize_grammar_analysis('私は家へ帰ります。', {}, response_language='en')
    assert home['sentence_meaning'] == 'I return home.'
