from __future__ import annotations

import argparse
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_KANJIVG_DIR = ROOT / "backend" / "app" / "data" / "kanjivg"
DEFAULT_SVG_DIR = DEFAULT_KANJIVG_DIR / "kanji"


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify local KanjiVG installation for stroke order animation.")
    parser.add_argument("--kanjivg-dir", type=Path, default=DEFAULT_KANJIVG_DIR)
    parser.add_argument("--clone", action="store_true", help="Clone KanjiVG from GitHub if the directory is missing.")
    args = parser.parse_args()

    if args.clone and not args.kanjivg_dir.exists():
        args.kanjivg_dir.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["git", "clone", "--depth", "1", "https://github.com/KanjiVG/kanjivg", str(args.kanjivg_dir)],
            check=False,
        )

    svg_dir = args.kanjivg_dir / "kanji"
    svg_count = len(list(svg_dir.glob("*.svg"))) if svg_dir.is_dir() else 0
    ok = args.kanjivg_dir.is_dir() and svg_dir.is_dir() and svg_count > 0

    print("[KanjiVG]")
    print(f"Expected directory: {args.kanjivg_dir}")
    print(f"SVG folder: {svg_dir}")
    print(f"SVG files: {svg_count}")
    print(f"Status: {'OK' if ok else 'MISSING'}")
    if not ok:
        print("")
        print("Install instructions:")
        print("1. Download or clone https://github.com/KanjiVG/kanjivg")
        print(f"2. Copy its kanji folder to: {svg_dir}")
        print("3. Expected files look like: 04e00.svg, 04e8c.svg, 06708.svg")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
