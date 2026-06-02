from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from kanji_labels import SUPPORTED_KANJI  # noqa: E402
from train_kanji_model import DEFAULT_ARTIFACT_DIR  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate recognition label_map.json from the backend Kanji dictionary.")
    parser.add_argument("--output", type=Path, default=DEFAULT_ARTIFACT_DIR / "label_map.json")
    args = parser.parse_args()

    label_map = {kanji: index for index, kanji in enumerate(SUPPORTED_KANJI)}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as file:
        json.dump(label_map, file, ensure_ascii=False, indent=2)
        file.write("\n")
    print(f"Generated {len(label_map)} labels from dictionary into {args.output}")


if __name__ == "__main__":
    main()
