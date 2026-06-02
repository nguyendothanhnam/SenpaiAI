from __future__ import annotations

import base64
import json
import logging
from io import BytesIO
from pathlib import Path
from typing import Any, List

import numpy as np

try:
    from .kanji_labels import SUPPORTED_KANJI
except ImportError:  # pragma: no cover - handled at runtime
    SUPPORTED_KANJI = []

try:
    from PIL import Image, ImageOps
except ImportError:  # pragma: no cover - handled at runtime
    Image = None
    ImageOps = None

try:
    import torch
    import torch.nn.functional as F

    from .kanji_model import KanjiCNN
except ImportError:  # pragma: no cover - handled at runtime
    torch = None
    F = None
    KanjiCNN = None


ML_DIR = Path(__file__).resolve().parent
DEFAULT_MODEL_PATH = ML_DIR / "models" / "kanji_model.pt"
DEFAULT_LABEL_MAP_PATH = ML_DIR / "models" / "label_map.json"
IMAGE_SIZE = 64
UNAVAILABLE_MESSAGE = "Kanji recognition model is unavailable. Please train the model or add kanji_model.pt and label_map.json."

logger = logging.getLogger(__name__)


class KanjiRecognizer:
    def __init__(
        self,
        model_path: Path = DEFAULT_MODEL_PATH,
        label_map_path: Path = DEFAULT_LABEL_MAP_PATH,
        image_size: int = IMAGE_SIZE,
    ):
        self.model_path = Path(model_path)
        self.label_map_path = Path(label_map_path)
        self.image_size = image_size
        self.model = None
        self.index_to_label: dict[int, str] = {}
        self.device = "cpu"
        self.missing_files: list[str] = []
        self.last_error: str | None = None
        self._load()

    @property
    def available(self) -> bool:
        return self.model is not None and bool(self.index_to_label)

    def _load(self) -> None:
        logger.info("[KanjiModel] model path: %s", self.model_path.resolve())
        logger.info("[KanjiModel] label map path: %s", self.label_map_path.resolve())
        self.missing_files = [
            str(path.resolve())
            for path in (self.model_path, self.label_map_path)
            if not path.exists()
        ]
        if self.missing_files:
            logger.warning("%s Missing files: %s", UNAVAILABLE_MESSAGE, ", ".join(self.missing_files))
            logger.info("[KanjiModel] total classes: 0")
            return

        if self.label_map_path.exists():
            with self.label_map_path.open("r", encoding="utf-8") as file:
                label_map = json.load(file)
            self.index_to_label = {int(index): kanji for kanji, index in label_map.items()}
        logger.info("[KanjiModel] total classes: %s", len(self.index_to_label))

        if torch is None or KanjiCNN is None or not self.index_to_label:
            logger.warning("%s ML runtime or label map is not ready.", UNAVAILABLE_MESSAGE)
            return

        model = KanjiCNN(num_classes=len(self.index_to_label), image_size=self.image_size)
        state = torch.load(self.model_path, map_location=self.device)
        model.load_state_dict(state)
        model.eval()
        self.model = model

    def info(self) -> dict[str, Any]:
        supported_kanji = [self.index_to_label[index] for index in sorted(self.index_to_label)]
        missing_files = self.missing_files.copy()
        dictionary_count = len(SUPPORTED_KANJI)
        message = (
            f"Kanji recognition model loaded with {len(supported_kanji)} classes."
            if self.available
            else UNAVAILABLE_MESSAGE
        )
        if dictionary_count and len(supported_kanji) < dictionary_count:
            message = (
                f"Dictionary has {dictionary_count} Kanji, but recognition model has "
                f"{len(supported_kanji)} classes. Please retrain the model."
            )
        return {
            "engine": "kanji-cnn-v1" if self.available else "kanji-cnn-v1-unavailable",
            "available": self.available,
            "model_loaded": self.available,
            "total_classes": len(supported_kanji),
            "classes_count": len(supported_kanji),
            "model_path": str(self.model_path.resolve()),
            "label_map_path": str(self.label_map_path.resolve()),
            "missing_files": missing_files,
            "message": message,
            "supported_jlpt": ["N5", "N4"],
            "supported_kanji": supported_kanji,
            "dictionary_classes": dictionary_count,
        }

    def predict(self, image_data: str, strokes=None, jlpt_level: str | None = None, top_k: int = 5) -> List[dict[str, Any]]:
        del strokes, jlpt_level
        self.last_error = None
        if not self.available:
            self.last_error = "model_unavailable"
            return []

        tensor = preprocess_image_data(image_data, self.image_size)
        if tensor is None:
            self.last_error = "invalid_or_empty_image"
            return []
        if float(tensor.sum().item()) <= 0:
            self.last_error = "empty_canvas"
            return []

        with torch.no_grad():
            logits = self.model(tensor)
            probabilities = F.softmax(logits, dim=1)[0]
            count = min(top_k, probabilities.shape[0])
            scores, indices = torch.topk(probabilities, k=count)

        predictions = []
        for score, index in zip(scores.tolist(), indices.tolist()):
            kanji = self.index_to_label.get(int(index))
            if kanji:
                predictions.append({"kanji": kanji, "confidence": float(score)})
        logger.info("[Predict] top5: %s", predictions[:5])
        return predictions


def decode_image_data(image_data: str):
    if Image is None:
        return None

    try:
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]
        raw = base64.b64decode(image_data, validate=True)
        image = Image.open(BytesIO(raw)).convert("L")
        logger.info("[Recognition] image decoded")
        return image
    except Exception as error:
        logger.warning("[Recognition] invalid image: %s", error)
        return None


def preprocess_pil_image(image, image_size: int = IMAGE_SIZE):
    if Image is None or ImageOps is None or torch is None:
        return None

    image = ImageOps.grayscale(image)
    image = ImageOps.autocontrast(image)
    logger.info("[Preprocess] image size: %sx%s", image.width, image.height)
    array = np.asarray(image).astype(np.uint8)

    # Canvas convention is black strokes on white background.
    ink_mask = array < 245
    if not ink_mask.any():
        logger.info("[Preprocess] empty canvas")
        return Image.new("L", (image_size, image_size), 255)
    if ink_mask.any():
        ys, xs = np.where(ink_mask)
        left, right = xs.min(), xs.max() + 1
        top, bottom = ys.min(), ys.max() + 1
        image = image.crop((left, top, right, bottom))

    image.thumbnail((image_size - 12, image_size - 12), Image.Resampling.LANCZOS)
    canvas = Image.new("L", (image_size, image_size), 255)
    offset = ((image_size - image.width) // 2, (image_size - image.height) // 2)
    canvas.paste(image, offset)

    array = np.asarray(canvas).astype("float32") / 255.0
    array = 1.0 - array
    tensor = torch.from_numpy(array).unsqueeze(0).unsqueeze(0)
    return tensor


def preprocess_image_data(image_data: str, image_size: int = IMAGE_SIZE):
    image = decode_image_data(image_data)
    if image is None:
        return None
    return preprocess_pil_image(image, image_size)


_recognizer = KanjiRecognizer()


def predict_kanji(image_data: str, strokes=None, jlpt_level: str | None = None, top_k: int = 5) -> List[dict[str, Any]]:
    return _recognizer.predict(image_data, strokes=strokes, jlpt_level=jlpt_level, top_k=top_k)


def get_model_info() -> dict[str, Any]:
    return _recognizer.info()


def get_recognition_error() -> str | None:
    return _recognizer.last_error
