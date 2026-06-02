import math
import logging
from dataclasses import dataclass
from typing import Dict, List, Sequence, Tuple

from ..models import schemas
from .kanji_sample_store import kanji_sample_store

try:
    from ml.kanji_labels import get_metadata
    from ml.kanji_recognizer import get_model_info, get_recognition_error, predict_kanji
except ImportError:  # pragma: no cover - optional ML runtime
    get_metadata = None
    get_model_info = None
    get_recognition_error = None
    predict_kanji = None


Point = schemas.KanjiStrokePoint
CONFIDENCE_THRESHOLD = 0.65
MODEL_UNAVAILABLE_MESSAGE = "Kanji recognition model is unavailable. Please train the model or add kanji_model.pt and label_map.json."
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class KanjiProfile:
    kanji: str
    meaning: str
    onyomi: Tuple[str, ...]
    kunyomi: Tuple[str, ...]
    jlpt: str
    stroke_count: int
    frequency: float
    aspect: float
    horizontal_count: int
    vertical_count: int
    enclosure: float
    symmetry: float
    directions: Tuple[str, ...]


PROFILES: Dict[str, KanjiProfile] = {
    "\u6708": KanjiProfile("\u6708", "moon, month", ("\u30b2\u30c4", "\u30ac\u30c4"), ("\u3064\u304d",), "N5", 4, 0.95, 0.55, 2, 2, 0.85, 0.72, ("down", "down", "right", "right")),
    "\u7528": KanjiProfile("\u7528", "use", ("\u30e8\u30a6",), ("\u3082\u3061\u3044\u308b",), "N4", 5, 0.78, 0.60, 2, 3, 0.88, 0.70, ("down", "down", "right", "right", "down")),
    "\u65e5": KanjiProfile("\u65e5", "sun, day", ("\u30cb\u30c1", "\u30b8\u30c4"), ("\u3072", "\u304b"), "N5", 4, 0.93, 0.68, 2, 2, 0.92, 0.85, ("down", "down", "right", "right")),
    "\u76ee": KanjiProfile("\u76ee", "eye", ("\u30e2\u30af",), ("\u3081",), "N5", 5, 0.86, 0.55, 3, 2, 0.93, 0.88, ("down", "down", "right", "right", "right")),
    "\u7530": KanjiProfile("\u7530", "rice field", ("\u30c7\u30f3",), ("\u305f",), "N5", 5, 0.82, 0.85, 2, 3, 0.95, 0.92, ("down", "down", "right", "right", "down")),
    "\u6c34": KanjiProfile("\u6c34", "water", ("\u30b9\u30a4",), ("\u307f\u305a",), "N5", 4, 0.90, 0.86, 0, 1, 0.08, 0.65, ("down", "left", "right", "right")),
    "\u5c0f": KanjiProfile("\u5c0f", "small", ("\u30b7\u30e7\u30a6",), ("\u3061\u3044\u3055\u3044", "\u3053"), "N5", 3, 0.88, 0.85, 0, 1, 0.04, 0.80, ("down", "left", "right")),
    "\u6728": KanjiProfile("\u6728", "tree, wood", ("\u30e2\u30af", "\u30dc\u30af"), ("\u304d",), "N5", 4, 0.84, 0.82, 1, 1, 0.05, 0.72, ("right", "down", "left", "right")),
}

JLPT_ORDER = {"N5": 0, "N4": 1, "N3": 2, "N2": 3, "N1": 4}


class KanjiRecognitionService:
    def recognize(self, payload: schemas.KanjiRecognitionRequest) -> schemas.KanjiRecognitionResponse:
        model_info = get_model_info() if get_model_info else {"supported_kanji": [], "model_loaded": False}
        if not model_info.get("available") and not model_info.get("model_loaded"):
            return schemas.KanjiRecognitionResponse(
                success=False,
                predictions=[],
                engine=model_info.get("engine") or "kanji-cnn-v1-unavailable",
                isDemo=False,
                message=model_info.get("message") or MODEL_UNAVAILABLE_MESSAGE,
            )

        ml_predictions = self._ml_predictions(payload)
        target_unsupported = (
            payload.target_kanji
            and model_info.get("supported_kanji")
            and payload.target_kanji not in model_info["supported_kanji"]
        )
        sample_id = None
        try:
            sample_id = kanji_sample_store.save_sample(
                image_data=payload.image_data or "",
                strokes=[[point.model_dump() for point in stroke] for stroke in (payload.strokes or [])],
                predicted_kanji=ml_predictions[0].kanji if ml_predictions else None,
                jlpt_level=payload.jlpt_level,
                source="recognition",
            )
        except OSError as error:
            logger.warning("Could not save kanji recognition sample: %s", error)
        if ml_predictions:
            low_confidence = ml_predictions[0].confidence < CONFIDENCE_THRESHOLD
            return schemas.KanjiRecognitionResponse(
                success=not target_unsupported,
                predictions=ml_predictions,
                engine="kanji-cnn-v1",
                isDemo=False,
                sample_id=sample_id,
                low_confidence=low_confidence,
                message="The requested kanji is not in the current label map."
                if target_unsupported
                else (
                    "Low confidence. Please select the correct kanji to help improve the model."
                    if low_confidence
                    else None
                ),
            )

        return schemas.KanjiRecognitionResponse(
            success=False,
            predictions=[],
            engine=model_info.get("engine") or "kanji-cnn-v1-unavailable",
            isDemo=False,
            sample_id=sample_id,
            message=self._recognition_error_message(),
        )

    def _ml_predictions(self, payload: schemas.KanjiRecognitionRequest) -> List[schemas.KanjiRecognitionPrediction]:
        if predict_kanji is None or get_metadata is None or not payload.image_data:
            return []

        raw_predictions = predict_kanji(payload.image_data, payload.strokes or [], payload.jlpt_level, top_k=20)
        if not raw_predictions:
            return []

        actual_strokes = len(payload.strokes or [])
        reranked = []
        for prediction in raw_predictions:
            kanji = prediction.get("kanji")
            if not kanji:
                continue
            metadata = get_metadata(kanji)
            expected_strokes = metadata.get("stroke_count")
            stroke_count_score = self._metadata_stroke_score(actual_strokes, expected_strokes)
            jlpt_score = self._metadata_jlpt_score(metadata.get("jlpt"), payload.jlpt_level)
            frequency_score = max(0.0, min(1.0, float(metadata.get("frequency") or 0.5)))
            cnn_confidence = max(0.0, min(1.0, float(prediction.get("confidence") or 0.0)))
            final_score = (
                0.70 * cnn_confidence
                + 0.15 * stroke_count_score
                + 0.10 * jlpt_score
                + 0.05 * frequency_score
            )
            logger.info(
                "[StrokeCount] kanji=%s expected=%s actual=%s",
                kanji,
                expected_strokes or "unknown",
                actual_strokes,
            )

            reasons = [f"CNN match {round(cnn_confidence * 100)}%"]
            if expected_strokes:
                if actual_strokes == expected_strokes:
                    reasons.append("correct stroke count")
                else:
                    reasons.append(f"stroke count {actual_strokes}/{expected_strokes}")
            if metadata.get("jlpt"):
                reasons.append(f"{metadata['jlpt']} kanji")

            reranked.append((
                final_score,
                schemas.KanjiRecognitionPrediction(
                    kanji=kanji,
                    confidence=round(max(0.01, min(0.99, final_score)), 2),
                    meaning=metadata.get("meaning") or "Unknown",
                    onyomi=metadata.get("onyomi") or [],
                    kunyomi=metadata.get("kunyomi") or [],
                    stroke_count=expected_strokes,
                    strokes=expected_strokes,
                    jlpt=metadata.get("jlpt"),
                    reason=" + ".join(reasons),
                    reasons=reasons,
                ),
            ))

        logger.info(
            "[ReRank] before=%s",
            [
                {"kanji": item.get("kanji"), "confidence": round(float(item.get("confidence") or 0), 4)}
                for item in raw_predictions[:5]
            ],
        )
        reranked.sort(key=lambda item: item[0], reverse=True)
        predictions = [prediction for _, prediction in reranked[:5]]
        logger.info(
            "[ReRank] after=%s",
            [{"kanji": item.kanji, "confidence": item.confidence} for item in predictions],
        )
        return predictions

    def _recognition_error_message(self) -> str:
        error = get_recognition_error() if get_recognition_error else None
        if error == "model_unavailable":
            return MODEL_UNAVAILABLE_MESSAGE
        if error == "empty_canvas":
            return "Empty canvas. Please write a kanji before recognition."
        if error == "invalid_or_empty_image":
            return "Invalid image. Please submit a valid canvas PNG."
        return "Kanji not recognized. Please try again or submit a correction."

    def _metadata_stroke_score(self, actual: int, expected: int | None) -> float:
        if not expected or not actual:
            return 0.5
        diff = abs(actual - expected)
        if diff == 0:
            return 1.0
        if diff == 1:
            return 0.65
        if diff == 2:
            return 0.35
        return 0.1

    def _metadata_jlpt_score(self, candidate_level: str | None, requested_level: str | None) -> float:
        if not candidate_level:
            return 0.8
        if not requested_level:
            return 1.0 if candidate_level in {"N5", "N4"} else 0.5
        return self._jlpt_score(candidate_level, requested_level)

    def _clean_strokes(self, strokes: Sequence[Sequence[Point]]) -> List[List[Point]]:
        cleaned = []
        for stroke in strokes:
            points = [point for point in stroke if point.x >= 0 and point.y >= 0]
            if points:
                cleaned.append(points)
        return cleaned

    def _features(self, strokes: List[List[Point]], width: int, height: int) -> Dict[str, float | int | List[str]]:
        points = [point for stroke in strokes for point in stroke]
        min_x, max_x = min(point.x for point in points), max(point.x for point in points)
        min_y, max_y = min(point.y for point in points), max(point.y for point in points)
        box_w = max(1.0, max_x - min_x)
        box_h = max(1.0, max_y - min_y)
        horizontal_count, vertical_count, diagonal_count = self._axis_counts(strokes, box_w, box_h)
        directions = [self._direction(stroke) for stroke in strokes]
        center_x = (min_x + max_x) / 2 / max(1, width)
        center_y = (min_y + max_y) / 2 / max(1, height)

        return {
            "stroke_count": len(strokes),
            "aspect": box_w / box_h,
            "center_offset": math.hypot(center_x - 0.5, center_y - 0.5),
            "horizontal_count": horizontal_count,
            "vertical_count": vertical_count,
            "diagonal_count": diagonal_count,
            "enclosure": self._enclosure_score(strokes, box_w, box_h),
            "symmetry": self._symmetry(points, min_x, max_x),
            "directions": directions,
            "water_crossing": self._water_crossing_score(directions, diagonal_count),
            "separated_three": self._separated_three_score(strokes, box_w),
            "left_vertical_right_box": self._left_vertical_right_box_score(strokes, min_x, max_x, box_h),
        }

    def _stroke_count_score(self, actual: int, expected: int) -> float:
        diff = abs(actual - expected)
        if diff == 0:
            return 1.0
        if diff == 1:
            return 0.6
        return 0.2

    def _shape_similarity(self, profile: KanjiProfile, features: Dict[str, float | int | List[str]]) -> float:
        deltas = [
            min(1.0, abs(float(features["aspect"]) - profile.aspect) / 1.1),
            min(1.0, abs(float(features["enclosure"]) - profile.enclosure)),
            min(1.0, abs(float(features["symmetry"]) - profile.symmetry)),
            min(1.0, abs(int(features["horizontal_count"]) - profile.horizontal_count) / 4),
            min(1.0, abs(int(features["vertical_count"]) - profile.vertical_count) / 4),
            min(1.0, float(features["center_offset"]) * 1.5),
        ]
        return max(0.0, 1 - sum(deltas) / len(deltas))

    def _stroke_geometry_score(self, profile: KanjiProfile, features: Dict[str, float | int | List[str]]) -> float:
        direction_matches = sum(1 for a, b in zip(features["directions"], profile.directions) if a == b)
        direction_score = direction_matches / max(len(features["directions"]), len(profile.directions))
        geometry = [
            1 - min(1.0, abs(float(features["aspect"]) - profile.aspect) / 1.2),
            1 - min(1.0, abs(int(features["horizontal_count"]) - profile.horizontal_count) / 3),
            1 - min(1.0, abs(int(features["vertical_count"]) - profile.vertical_count) / 3),
            1 - min(1.0, abs(float(features["enclosure"]) - profile.enclosure)),
            1 - min(1.0, abs(float(features["symmetry"]) - profile.symmetry)),
            direction_score,
        ]
        return max(0.0, sum(geometry) / len(geometry))

    def _jlpt_score(self, candidate_level: str, selected_level: str | None) -> float:
        if not selected_level:
            return 0.8
        candidate_rank = JLPT_ORDER.get(candidate_level, 0)
        selected_rank = JLPT_ORDER.get(selected_level, 0)
        if candidate_rank <= selected_rank:
            return 1.0
        return max(0.35, 1 - (candidate_rank - selected_rank) * 0.22)

    def _rule_multiplier(self, profile: KanjiProfile, features: Dict[str, float | int | List[str]]) -> float:
        actual_strokes = int(features["stroke_count"])
        enclosure = float(features["enclosure"])
        water = float(features["water_crossing"])
        separated_three = float(features["separated_three"])
        left_vertical_right_box = float(features["left_vertical_right_box"])

        multiplier = 1.0
        if actual_strokes == 4 and profile.kanji == "\u5c0f":
            multiplier *= 0.48
        if enclosure > 0.52 and profile.kanji in {"\u6708", "\u65e5", "\u76ee", "\u7530", "\u7528"}:
            multiplier *= 1.20
        if enclosure > 0.52 and float(features["aspect"]) < 0.75 and profile.kanji == "\u7530":
            multiplier *= 0.35
        if enclosure > 0.52 and profile.kanji == "\u6728":
            multiplier *= 0.45
        if separated_three > 0.6 and profile.kanji == "\u5c0f":
            multiplier *= 1.35
        if water > 0.6 and profile.kanji == "\u6c34":
            multiplier *= 1.28
        if left_vertical_right_box > 0.55 and profile.kanji == "\u6708":
            multiplier *= 1.34
        if left_vertical_right_box > 0.55 and profile.kanji in {"\u5c0f", "\u6c34"}:
            multiplier *= 0.55
        return multiplier

    def _prevent_bad_predictions(self, scored, features):
        if int(features["stroke_count"]) != 4:
            return scored
        small = [item for item in scored if item[1].kanji == "\u5c0f"]
        others = [item for item in scored if item[1].kanji != "\u5c0f"]
        if small:
            return others + small
        return scored

    def _prediction(self, profile: KanjiProfile, confidence: float, features, shape: float, stroke_count: float, geometry: float) -> schemas.KanjiRecognitionPrediction:
        actual_strokes = int(features["stroke_count"])
        confidence = round(max(0.01, min(0.98, confidence)), 2)
        if profile.kanji == "\u6708" and float(features["left_vertical_right_box"]) > 0.55:
            reason = "Your drawing has 4 strokes and a right-side enclosure shape, which matches \u6708."
        elif actual_strokes == profile.stroke_count:
            reason = f"Stroke count matches and the geometry resembles {profile.kanji}."
        else:
            reason = f"Shape is possible, but stroke count is {actual_strokes}; {profile.kanji} has {profile.stroke_count}."

        reasons = [
            f"shape {round(shape * 100)}%",
            f"stroke count {actual_strokes}/{profile.stroke_count}",
            f"geometry {round(geometry * 100)}%",
        ]
        if confidence < 0.55:
            reasons.append("I am not fully sure. Please check stroke order or try again.")

        return schemas.KanjiRecognitionPrediction(
            kanji=profile.kanji,
            meaning=profile.meaning,
            onyomi=list(profile.onyomi),
            kunyomi=list(profile.kunyomi),
            jlpt=profile.jlpt,
            stroke_count=profile.stroke_count,
            strokes=profile.stroke_count,
            confidence=confidence,
            reason=reason,
            reasons=reasons,
            structure="enclosure" if profile.enclosure > 0.5 else "open",
        )

    def _axis_counts(self, strokes: Sequence[Sequence[Point]], box_w: float, box_h: float) -> Tuple[int, int, int]:
        horizontal = 0
        vertical = 0
        diagonal = 0
        for stroke in strokes:
            if len(stroke) < 2:
                continue
            dx = stroke[-1].x - stroke[0].x
            dy = stroke[-1].y - stroke[0].y
            if abs(dx) > abs(dy) * 1.35 and abs(dx) > box_w * 0.18:
                horizontal += 1
            elif abs(dy) > abs(dx) * 1.25 and abs(dy) > box_h * 0.22:
                vertical += 1
            else:
                diagonal += 1
        return horizontal, vertical, diagonal

    def _enclosure_score(self, strokes: Sequence[Sequence[Point]], box_w: float, box_h: float) -> float:
        horizontal, vertical, _ = self._axis_counts(strokes, box_w, box_h)
        score = min(1.0, horizontal * 0.22 + vertical * 0.25)
        return score

    def _symmetry(self, points: Sequence[Point], min_x: float, max_x: float) -> float:
        center = (min_x + max_x) / 2
        left = sum(1 for point in points if point.x < center)
        right = sum(1 for point in points if point.x >= center)
        return 1 - abs(left - right) / max(1, left + right)

    def _direction(self, stroke: Sequence[Point]) -> str:
        if len(stroke) < 2:
            return "dot"
        dx = stroke[-1].x - stroke[0].x
        dy = stroke[-1].y - stroke[0].y
        if abs(dx) > abs(dy) * 1.25:
            return "right" if dx >= 0 else "left"
        if abs(dy) > abs(dx) * 1.25:
            return "down" if dy >= 0 else "up"
        return "right" if dx >= 0 else "left"

    def _water_crossing_score(self, directions: Sequence[str], diagonal_count: int) -> float:
        has_left = "left" in directions
        has_right = "right" in directions
        has_down = "down" in directions
        return min(1.0, (0.35 if has_left else 0) + (0.35 if has_right else 0) + (0.2 if has_down else 0) + diagonal_count * 0.1)

    def _separated_three_score(self, strokes: Sequence[Sequence[Point]], box_w: float) -> float:
        if len(strokes) != 3:
            return 0.0
        starts = sorted(stroke[0].x for stroke in strokes if stroke)
        if len(starts) != 3:
            return 0.0
        spread = (starts[-1] - starts[0]) / max(1, box_w)
        return min(1.0, spread)

    def _left_vertical_right_box_score(self, strokes: Sequence[Sequence[Point]], min_x: float, max_x: float, box_h: float) -> float:
        if len(strokes) < 4:
            return 0.0
        left_zone = min_x + (max_x - min_x) * 0.35
        left_vertical = any(stroke and stroke[0].x <= left_zone and abs(stroke[-1].y - stroke[0].y) > box_h * 0.45 for stroke in strokes)
        right_vertical = any(stroke and stroke[0].x > left_zone and abs(stroke[-1].y - stroke[0].y) > box_h * 0.45 for stroke in strokes)
        horizontals = sum(1 for stroke in strokes if abs(stroke[-1].x - stroke[0].x) > abs(stroke[-1].y - stroke[0].y) * 1.25)
        return min(1.0, (0.4 if left_vertical else 0) + (0.35 if right_vertical else 0) + min(0.25, horizontals * 0.12))


kanji_recognition_service = KanjiRecognitionService()
