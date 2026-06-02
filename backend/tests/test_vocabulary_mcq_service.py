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


if __name__ == "__main__":
    unittest.main()
