import unittest
from unittest.mock import patch

from app.models.schemas import KanjiRecognitionRequest, KanjiStrokePoint
import app.services.kanji_recognition_service as recognition_module
from app.services.kanji_recognition_service import kanji_recognition_service


def stroke(points, stroke_id):
    return [
        KanjiStrokePoint(x=x, y=y, timestamp=idx, pressure=0.5, strokeId=stroke_id)
        for idx, (x, y) in enumerate(points)
    ]


class KanjiRecognitionServiceTest(unittest.TestCase):
    def setUp(self):
        samples = patch.object(recognition_module.kanji_sample_store, "save_sample", return_value="unit-test")
        self.sample_save = samples.start()
        self.addCleanup(samples.stop)
        model = patch.object(recognition_module, "get_model_info", return_value={
            "available": True, "model_loaded": True, "engine": "kanji-cnn-v1",
            "supported_kanji": ["\u5c0f", "\u6708", "\u6c34"],
        })
        model.start()
        self.addCleanup(model.stop)

    def test_empty_or_invalid_images_return_failure_without_saving_training_data(self):
        for error in ("empty_canvas", "invalid_or_empty_image"):
            with self.subTest(error=error), patch.object(recognition_module, "predict_kanji", return_value=[]), patch.object(recognition_module, "get_recognition_error", return_value=error):
                result = kanji_recognition_service.recognize(KanjiRecognitionRequest(image_data="not-an-image"))
                self.assertFalse(result.success)
                self.assertEqual(result.predictions, [])
                self.assertIsNone(result.sample_id)
                self.sample_save.assert_not_called()

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
