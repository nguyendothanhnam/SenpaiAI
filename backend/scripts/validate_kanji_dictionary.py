from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.services.kanji_dictionary_service import kanji_dictionary_service  # noqa: E402


def main() -> int:
    report = kanji_dictionary_service.validate()
    print(f"total entries: {report['total_entries']}")
    print(f"valid entries: {report['valid_entries']}")
    print(f"missing metadata: {report['missing_metadata_count']}")
    print(f"duplicate Kanji: {report['duplicate_count']}")
    if report["duplicate_kanji"]:
        print("duplicates:", ", ".join(report["duplicate_kanji"]))
    if report["missing_metadata"]:
        print("missing metadata details:")
        for item in report["missing_metadata"][:80]:
            print(f"- {item['kanji'] or '<blank>'}: {', '.join(item['missing'])}")
        remaining = len(report["missing_metadata"]) - 80
        if remaining > 0:
            print(f"... {remaining} more")
    return 1 if report["duplicate_kanji"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
