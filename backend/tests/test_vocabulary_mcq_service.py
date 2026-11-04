import unittest

from app.services.vocab_mcq_service import try_answer


class VocabularyMcqServiceTest(unittest.TestCase):
    def assert_answer(self, question: str, expected: str) -> None:
        result = try_answer(question)
        self.assertIsNotNone(result)
        self.assertIn(expected, result.answer)

    def test_gakusei(self):
        self.assert_answer(
            "「がくせい」 có nghĩa là gì? A. Giáo viên B. Học sinh / sinh viên C. Nhân viên D. Bác sĩ",
            "Đáp án đúng: B. Học sinh / sinh viên",
        )

    def test_sensei(self):
        self.assert_answer(
            "「せんせい」 có nghĩa là gì? A. Giáo viên B. Học sinh C. Nhân viên D. Bác sĩ",
            "Đáp án đúng: A. Giáo viên",
        )

    def test_isha(self):
        self.assert_answer(
            "「いしゃ」 có nghĩa là gì? A. Giáo viên B. Học sinh C. Nhân viên D. Bác sĩ",
            "Đáp án đúng: D. Bác sĩ",
        )

    def test_plain_vocab_question(self):
        self.assert_answer(
            "「がくせい」 có nghĩa là gì?",
            "JLPT: N5 Vocabulary",
        )

    def test_sentence_meaning_falls_through_to_llm(self):
        for question in [
            "今日は何をしましたか。 có nghĩa là gì",
            "「今日は何をしましたか。」 có nghĩa là gì?",
            "「図書館」 có nghĩa là gì?",
            "「図書館」 có nghĩa là gì? A. Thư viện B. Trường học C. Nhà D. Ga",
        ]:
            with self.subTest(question=question):
                self.assertIsNone(try_answer(question))


if __name__ == "__main__":
    unittest.main()
