"""Read-only coverage audit; never trains or replaces model artifacts."""
from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
import sys

BACKEND = Path(__file__).resolve().parents[2]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from ml.kanji_labels import SUPPORTED_KANJI, get_metadata
from ml.kanji_recognizer import KanjiRecognizer


def audit(model_dir: Path) -> dict:
    model = KanjiRecognizer(model_dir / "kanji_model.pt", model_dir / "label_map.json")
    info = model.info()
    supported = set(info["supported_kanji"]) if info["available"] else set()
    missing = [char for char in SUPPORTED_KANJI if char not in supported]
    return {
        "available": info["available"],
        "dictionary_classes": len(SUPPORTED_KANJI),
        "recognition_classes": len(supported),
        "supported_by_level": dict(Counter(get_metadata(char).get("jlpt") for char in supported)),
        "missing_by_level": dict(Counter(get_metadata(char).get("jlpt") for char in missing)),
        "missing_kanji": missing,
        "complete_coverage": not missing,
        "accuracy_evaluated": False,
        "note": "Class coverage is not handwriting accuracy. Evaluate a held-out handwriting dataset before promoting a candidate.",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-dir", type=Path, default=BACKEND / "ml" / "models")
    parser.add_argument("--output", type=Path, help="Optional diagnostic JSON file; model files are never written.")
    args = parser.parse_args()
    report = audit(args.model_dir)
    text = json.dumps(report, ensure_ascii=True, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text + "\n", encoding="utf-8")
    else:
        print(text)


if __name__ == "__main__":
    main()
