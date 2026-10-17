"""Compare two saved Kanji CNNs on the same held-out <kanji>/*.png set."""
from __future__ import annotations

import argparse
import base64
from collections import defaultdict
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from kanji_labels import get_metadata  # noqa: E402
from kanji_recognizer import KanjiRecognizer  # noqa: E402


IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".webp"}


def evaluate(model_dir: Path, dataset_dir: Path) -> dict[str, dict[str, int | float]]:
    recognizer = KanjiRecognizer(model_dir / "kanji_model.pt", model_dir / "label_map.json")
    if not recognizer.available:
        raise RuntimeError(f"Model is unavailable: {model_dir}")
    totals: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for class_dir in sorted(path for path in dataset_dir.iterdir() if path.is_dir()):
        actual = class_dir.name
        level = get_metadata(actual).get("jlpt")
        if level not in {"N5", "N4", "N3"}:
            continue
        for image_path in class_dir.rglob("*"):
            if image_path.suffix.lower() not in IMAGE_EXTENSIONS:
                continue
            mime = "image/png" if image_path.suffix.lower() == ".png" else "image/jpeg"
            image_data = f"data:{mime};base64,{base64.b64encode(image_path.read_bytes()).decode('ascii')}"
            predictions = recognizer.predict(image_data, top_k=1)
            totals[level][1] += 1
            if predictions and predictions[0].get("kanji") == actual:
                totals[level][0] += 1
    return {
        level: {"correct": counts[0], "total": counts[1],
                "accuracy": round(counts[0] / counts[1], 4) if counts[1] else 0.0}
        for level, counts in sorted(totals.items())
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare old and candidate Kanji models by JLPT level.")
    parser.add_argument("--dataset", required=True, type=Path, help="Held-out real handwriting folders: <kanji>/*.png")
    parser.add_argument("--old-model-dir", type=Path, default=ROOT / "models")
    parser.add_argument("--candidate-model-dir", required=True, type=Path)
    args = parser.parse_args()
    if not args.dataset.is_dir():
        raise SystemExit(f"Held-out dataset directory not found: {args.dataset}")
    for label, model_dir in (("old", args.old_model_dir), ("candidate", args.candidate_model_dir)):
        result = evaluate(model_dir, args.dataset)
        print(f"{label}: {result}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
