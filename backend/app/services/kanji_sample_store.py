import base64
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


USER_SAMPLE_DIR = Path(__file__).resolve().parents[2] / "ml" / "user_samples"


class KanjiSampleStore:
    def __init__(self, root: Path = USER_SAMPLE_DIR):
        self.root = root

    def save_sample(
        self,
        image_data: str,
        strokes: list | None,
        predicted_kanji: str | None = None,
        corrected_kanji: str | None = None,
        jlpt_level: str | None = None,
        source: str = "recognition",
    ) -> str:
        sample_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S") + "-" + uuid.uuid4().hex[:10]
        sample_dir = self.root / sample_id
        sample_dir.mkdir(parents=True, exist_ok=True)

        raw_image = image_data.split(",", 1)[1] if "," in image_data else image_data
        (sample_dir / "image.png").write_bytes(base64.b64decode(raw_image))
        with (sample_dir / "strokes.json").open("w", encoding="utf-8") as file:
            json.dump(strokes or [], file, ensure_ascii=False, indent=2)

        metadata: dict[str, Any] = {
            "sample_id": sample_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "source": source,
            "predicted_kanji": predicted_kanji,
            "corrected_kanji": corrected_kanji,
            "jlpt_level": jlpt_level,
        }
        with (sample_dir / "metadata.json").open("w", encoding="utf-8") as file:
            json.dump(metadata, file, ensure_ascii=False, indent=2)
        return sample_id


kanji_sample_store = KanjiSampleStore()
