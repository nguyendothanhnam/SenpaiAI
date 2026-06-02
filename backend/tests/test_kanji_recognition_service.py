import unittest

from app.models.schemas import KanjiRecognitionRequest, KanjiStrokePoint
import app.services.kanji_recognition_service as recognition_module
from app.services.kanji_recognition_service import kanji_recognition_service


def stroke(points, stroke_id):
    return [
        KanjiStrokePoint(x=x, y=y, timestamp=idx, pressure=0.5, strokeId=stroke_id)
        for idx, (x, y) in enumerate(points)
    ]


class KanjiRecognitionServiceTest(unittest.TestCase):
    def test_cnn_predictions_are_reranked_with_stroke_count(self):
        original_predict = recognition_module.predict_kanji
        recognition_module.predict_kanji = lambda image_data, strokes, jlpt_level, top_k=20: [
            {"kanji": "\u5c0f", "confidence": 0.90},
            {"kanji": "\u6708", "confidence": 0.86},
            {"kanji": "\u6c34", "confidence": 0.70},
        ]
        payload = KanjiRecognitionRequest(
            image_data="data:image/png;base64,dGVzdA==",
            target_kanji="\u6708",
            jlpt_level="N5",
            strokes=[
                stroke([(82, 34), (80, 92), (70, 205)], 1),
                stroke([(88, 38), (178, 30), (180, 212)], 2),
                stroke([(88, 86), (176, 76)], 3),
                stroke([(86, 142), (176, 132)], 4),
            ],
        )

        try:
            result = kanji_recognition_service.recognize(payload)
            ranked = [prediction.kanji for prediction in result.predictions]
        finally:
            recognition_module.predict_kanji = original_predict

        self.assertEqual("\u6708", ranked[0])
        self.assertIn("\u6c34", ranked)
        self.assertGreater(result.predictions[0].confidence, result.predictions[ranked.index("\u5c0f")].confidence)


if __name__ == "__main__":
    unittest.main()
