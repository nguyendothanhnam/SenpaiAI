from __future__ import annotations

import argparse
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from train_kanji_model import DEFAULT_SYNTHETIC_DIR, find_japanese_fonts, generate_synthetic_dataset  # noqa: E402
from kanji_labels import SUPPORTED_KANJI  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic JLPT N5/N4 kanji images.")
    parser.add_argument("--output", type=Path, default=DEFAULT_SYNTHETIC_DIR)
    parser.add_argument("--samples-per-class", type=int, default=350)
    parser.add_argument("--image-size", type=int, default=64, choices=[64, 128])
    parser.add_argument("--font", action="append", default=[])
    parser.add_argument("--force", action="store_true", help="Regenerate existing PNGs.")
    args = parser.parse_args()

    random.seed(42)
    fonts = find_japanese_fonts(args.font)
    if not fonts:
        raise RuntimeError("No Japanese fonts found. Pass --font C:\\path\\to\\font.ttc")

    generate_synthetic_dataset(args.output, SUPPORTED_KANJI, fonts, args.samples_per_class, args.image_size, args.force)
    print(f"Generated {len(SUPPORTED_KANJI) * args.samples_per_class} images in {args.output}")


if __name__ == "__main__":
    main()
