"""Validate and install a complete dictionary model, preserving a restorable pair."""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import uuid

BACKEND = Path(__file__).resolve().parents[2]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from ml.kanji_labels import SUPPORTED_KANJI, get_metadata
from ml.kanji_recognizer import KanjiRecognizer

ARTIFACTS = ("kanji_model.pt", "label_map.json")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_model(model_dir):
    mapping = json.loads((model_dir / "label_map.json").read_text(encoding="utf-8"))
    if set(mapping) != set(SUPPORTED_KANJI):
        raise ValueError("Candidate labels must match every dictionary character exactly.")
    if any(type(index) is not int for index in mapping.values()) or set(mapping.values()) != set(range(len(mapping))):
        raise ValueError("Candidate label indices must be unique contiguous integers starting at zero.")
    recognizer = KanjiRecognizer(model_dir / ARTIFACTS[0], model_dir / ARTIFACTS[1])
    if not recognizer.available:
        raise ValueError("Candidate weights could not be loaded.")
    import torch
    with torch.inference_mode():
        logits = recognizer.model(torch.zeros((1, 1, recognizer.image_size, recognizer.image_size)))
    if logits.shape != (1, len(SUPPORTED_KANJI)) or not torch.isfinite(logits).all():
        raise ValueError("Candidate must produce finite logits for every dictionary class.")
    return dict(classes=len(mapping), by_level=dict(Counter(get_metadata(char)["jlpt"] for char in mapping)),
                sha256={name: digest(model_dir / name) for name in ARTIFACTS})


def promote(source_dir, active_dir):
    source_dir, active_dir = Path(source_dir).resolve(), Path(active_dir).resolve()
    report = validate_model(source_dir)
    if all((active_dir / name).is_file() and digest(active_dir / name) == report["sha256"][name] for name in ARTIFACTS):
        return {**report, "changed": False}
    active_dir.mkdir(parents=True, exist_ok=True)
    backup = active_dir / "backups" / (datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S") + "-" + uuid.uuid4().hex[:8])
    backup.mkdir(parents=True)
    previous = {}
    for name in ARTIFACTS:
        if (active_dir / name).is_file():
            shutil.copy2(active_dir / name, backup / name)
            previous[name] = digest(backup / name)
    staged = {}
    try:
        for name in ARTIFACTS:
            path = active_dir / (".staged-" + uuid.uuid4().hex + "-" + name)
            staged[name] = path
            shutil.copy2(source_dir / name, path)
            if digest(path) != report["sha256"][name]:
                raise ValueError("Artifact changed during copying.")
        for name in ARTIFACTS:
            os.replace(staged[name], active_dir / name)
        validate_model(active_dir)
    except Exception:
        for name in previous:
            shutil.copy2(backup / name, active_dir / name)
        raise
    finally:
        for path in staged.values():
            path.unlink(missing_ok=True)
    manifest = {**report, "changed": True, "installed_at": datetime.now(timezone.utc).isoformat(),
                "source_dir": str(source_dir), "backup_dir": str(backup), "previous_sha256": previous,
                "accuracy_note": "Class coverage is not handwriting accuracy; see the accompanying evaluation report."}
    (active_dir / "deployment.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--active-dir", type=Path, default=BACKEND / "ml/models")
    args = parser.parse_args()
    print(json.dumps(promote(args.source_dir, args.active_dir), ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
