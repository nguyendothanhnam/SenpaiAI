from typing import List

from ..models import schemas


class KanjiRecognitionService:
    """Handwriting recognition facade.

    The current implementation is deterministic mock logic. Replace
    `recognize` internals later with TensorFlow, ONNX Runtime, OpenCV
    preprocessing, or a stroke-sequence model without changing the route.
    """

    def recognize(
        self,
        payload: schemas.KanjiRecognitionRequest,
    ) -> schemas.KanjiRecognitionResponse:
        if not payload.strokes:
            return schemas.KanjiRecognitionResponse(predictions=[], engine="mock-v1", isDemo=True)

        stroke_count = len(payload.strokes)
        predictions = self._mock_predictions(stroke_count)

        return schemas.KanjiRecognitionResponse(
            predictions=predictions,
            engine="mock-v1",
            isDemo=True,
        )

    def _mock_predictions(self, stroke_count: int) -> List[schemas.KanjiRecognitionPrediction]:
        if stroke_count >= 9:
            return [
                schemas.KanjiRecognitionPrediction(
                    kanji="猫",
                    confidence=0.46,
                    meaning="cat",
                    onyomi="ビョウ",
                    kunyomi="ねこ",
                    strokes=11,
                ),
                schemas.KanjiRecognitionPrediction(
                    kanji="描",
                    confidence=0.37,
                    meaning="draw",
                    onyomi="ビョウ",
                    kunyomi="えがく",
                    strokes=11,
                ),
                schemas.KanjiRecognitionPrediction(
                    kanji="獣",
                    confidence=0.24,
                    meaning="animal",
                    onyomi="ジュウ",
                    kunyomi="けもの",
                    strokes=16,
                ),
            ]

        if stroke_count >= 5:
            return [
                schemas.KanjiRecognitionPrediction(
                    kanji="描",
                    confidence=0.42,
                    meaning="draw",
                    onyomi="ビョウ",
                    kunyomi="えがく",
                    strokes=11,
                ),
                schemas.KanjiRecognitionPrediction(
                    kanji="猫",
                    confidence=0.33,
                    meaning="cat",
                    onyomi="ビョウ",
                    kunyomi="ねこ",
                    strokes=11,
                ),
            ]

        return [
            schemas.KanjiRecognitionPrediction(
                kanji="小",
                confidence=0.31,
                meaning="small",
                onyomi="ショウ",
                kunyomi="ちいさい",
                strokes=3,
            ),
            schemas.KanjiRecognitionPrediction(
                kanji="水",
                confidence=0.27,
                meaning="water",
                onyomi="スイ",
                kunyomi="みず",
                strokes=4,
            ),
        ]


kanji_recognition_service = KanjiRecognitionService()
