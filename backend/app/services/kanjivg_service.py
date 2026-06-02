import json
import logging
import re
import xml.etree.ElementTree as ET
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List

from fastapi import HTTPException, status


KANJIVG_SOURCE = {
    "source": "KanjiVG",
    "license": "CC BY-SA 3.0",
    "source_url": "https://kanjivg.tagaini.net",
}
DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "kanjivg_strokes.json"
KANJIVG_DIR = Path(__file__).resolve().parents[1] / "data" / "kanjivg"
KANJIVG_SVG_DIR = KANJIVG_DIR / "kanji"
logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def load_kanjivg_data() -> Dict[str, Dict[str, Any]]:
    try:
        with DATA_PATH.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def get_supported_kanji() -> Dict[str, Any]:
    data = load_kanjivg_data()
    svg_kanji = sorted(
        {
            chr(int(path.stem, 16))
            for path in _svg_files()
            if re.fullmatch(r"[0-9a-fA-F]{4,6}", path.stem)
        }
    )
    supported = sorted(set(data.keys()) | set(svg_kanji))
    return {
        "kanji": supported,
        "total": len(supported),
        **KANJIVG_SOURCE,
    }


def get_stroke_data(kanji: str) -> Dict[str, Any]:
    item = load_stroke_order(kanji)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No KanjiVG stroke order data available.")
    return item


def get_stroke_order_response(kanji: str) -> Dict[str, Any]:
    key = (kanji or "").strip()[:1]
    item = load_stroke_order(key)
    if not item:
        return {
            "kanji": key,
            "available": False,
            "message": "Stroke order data is not available for this Kanji.",
            **KANJIVG_SOURCE,
        }
    return {
        **item,
        "available": True,
    }


def kanji_to_codepoint(kanji: str) -> str:
    return f"{ord(kanji):05x}"


def svg_path_for_kanji(kanji: str) -> Path:
    codepoint = kanji_to_codepoint(kanji)
    preferred = KANJIVG_SVG_DIR / f"{codepoint}.svg"
    if preferred.exists():
        return preferred
    unpadded = KANJIVG_SVG_DIR / f"{codepoint.lstrip('0')}.svg"
    return unpadded


def load_stroke_order(kanji: str) -> Dict[str, Any] | None:
    key = (kanji or "").strip()[:1]
    if not key:
        return None
    codepoint = kanji_to_codepoint(key)
    svg_path = svg_path_for_kanji(key)
    found = svg_path.exists()
    logger.info("[KanjiVG] requested: %s", key)
    logger.info("[KanjiVG] unicode: %s", codepoint.lstrip("0") or codepoint)
    logger.info("[KanjiVG] file path: %s", svg_path)
    logger.info("[KanjiVG] found: %s", str(found).lower())
    if found:
        try:
            parsed = parse_kanjivg_svg(svg_path, {"kanji": key})
            parsed["svg"] = svg_path.read_text(encoding="utf-8")
            logger.info("[KanjiVG] stroke count: %s", parsed["stroke_count"])
            return parsed
        except (OSError, ET.ParseError) as error:
            logger.warning("[KanjiVG] failed to load %s: %s", svg_path, error)

    item = load_kanjivg_data().get(key)
    if item:
        logger.info("[KanjiVG] stroke count: %s", item.get("stroke_count"))
    return item


def get_metadata(kanji: str) -> Dict[str, Any]:
    item = get_stroke_data(kanji)
    return {
        "kanji": item["kanji"],
        "stroke_count": item["stroke_count"],
        "jlpt": item.get("jlpt"),
        "meaning_vi": item.get("meaning_vi"),
        "onyomi": item.get("onyomi", []),
        "kunyomi": item.get("kunyomi", []),
        **KANJIVG_SOURCE,
    }


def classify_stroke(path: str) -> str:
    numbers = [float(value) for value in re.findall(r"-?\d+(?:\.\d+)?", path)]
    if len(numbers) < 4:
        return "unknown"
    start_x, start_y = numbers[0], numbers[1]
    end_x, end_y = numbers[-2], numbers[-1]
    dx = end_x - start_x
    dy = end_y - start_y
    if abs(dx) > abs(dy) * 1.35:
        return "horizontal"
    if abs(dy) > abs(dx) * 1.35:
        return "vertical" if dx >= -8 else "vertical_curve"
    return "left_sweep" if dx < 0 else "right_sweep"


def parse_kanjivg_svg(svg_path: Path, metadata: Dict[str, Any] | None = None) -> Dict[str, Any]:
    metadata = metadata or {}
    tree = ET.parse(svg_path)
    root = tree.getroot()
    view_box = root.attrib.get("viewBox", "0 0 109 109")
    namespace = {"svg": "http://www.w3.org/2000/svg"}
    paths = root.findall(".//svg:path", namespace)
    if not paths:
        paths = root.findall(".//path")

    strokes: List[Dict[str, Any]] = []
    for index, path_element in enumerate(paths, start=1):
        path = path_element.attrib.get("d")
        if path:
            strokes.append({"index": index, "path": path, "type": classify_stroke(path)})

    if metadata.get("kanji"):
        kanji = metadata["kanji"]
    elif re.fullmatch(r"[0-9a-fA-F]{5}", svg_path.stem):
        kanji = chr(int(svg_path.stem, 16))
    else:
        kanji = svg_path.stem
    return {
        "kanji": kanji,
        "viewBox": view_box,
        "strokes": strokes,
        "stroke_count": len(strokes),
        "jlpt": metadata.get("jlpt"),
        "meaning_vi": metadata.get("meaning_vi"),
        "onyomi": metadata.get("onyomi", []),
        "kunyomi": metadata.get("kunyomi", []),
        **KANJIVG_SOURCE,
    }


def _svg_files() -> List[Path]:
    if not KANJIVG_SVG_DIR.is_dir():
        return []
    return sorted(KANJIVG_SVG_DIR.glob("*.svg"))
