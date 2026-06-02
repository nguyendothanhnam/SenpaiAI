from __future__ import annotations

import argparse
import json
import shutil
import struct
import tarfile
import urllib.request
import zipfile
from dataclasses import dataclass
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
from typing import Iterable, Iterator

import numpy as np
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    from kanji_labels import SUPPORTED_KANJI
    from train_kanji_model import crop_center_resize
except ImportError:  # pragma: no cover - package execution
    from ml.kanji_labels import SUPPORTED_KANJI
    from ml.train_kanji_model import crop_center_resize


DEFAULT_OUTPUT = ROOT / "data" / "etl10_processed"
DEFAULT_MODEL_DIR = ROOT / "models"
DEFAULT_DOWNLOAD_DIR = ROOT / "data" / "etl10_raw"
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".webp", ".tif", ".tiff"}
ETL_G_RECORD_SIZE = 8199
ETL_G_RECORD = struct.Struct(">2H8sI4B4H2B30x8128s11x")


@dataclass(frozen=True)
class PreparedSample:
    kanji: str
    image: Image.Image
    source: str


def decode_jis0208(jis_code: int) -> str | None:
    high = (jis_code >> 8) & 0xFF
    low = jis_code & 0xFF
    if not high or not low:
        return None
    try:
        return bytes([high + 0x80, low + 0x80]).decode("euc_jp")
    except (UnicodeDecodeError, ValueError):
        return None


def etl_g_image(image_bytes: bytes) -> Image.Image:
    packed = np.frombuffer(image_bytes, dtype=np.uint8)
    pixels = np.empty(packed.size * 2, dtype=np.uint8)
    pixels[0::2] = packed >> 4
    pixels[1::2] = packed & 0x0F
    pixels = pixels[: 127 * 128].reshape((127, 128))
    pixels = 255 - (pixels * 17)
    return Image.fromarray(pixels.astype(np.uint8), mode="L")


def iter_etl_g_file(path: Path, supported: set[str]) -> Iterator[PreparedSample]:
    size = path.stat().st_size
    if size < ETL_G_RECORD_SIZE or size % ETL_G_RECORD_SIZE != 0:
        return

    with path.open("rb") as file:
        index = 0
        while True:
            record = file.read(ETL_G_RECORD_SIZE)
            if not record:
                break
            if len(record) != ETL_G_RECORD_SIZE:
                break
            fields = ETL_G_RECORD.unpack(record)
            kanji = decode_jis0208(fields[1])
            if kanji in supported:
                yield PreparedSample(kanji=kanji, image=etl_g_image(fields[-1]), source=f"{path.name}:{index}")
            index += 1


def iter_folder_images(path: Path, supported: set[str]) -> Iterator[PreparedSample]:
    for class_dir in path.iterdir() if path.exists() else []:
        if not class_dir.is_dir() or class_dir.name not in supported:
            continue
        for image_path in class_dir.rglob("*"):
            if image_path.suffix.lower() not in IMAGE_EXTENSIONS:
                continue
            with Image.open(image_path) as image:
                yield PreparedSample(kanji=class_dir.name, image=image.convert("L"), source=str(image_path))


def iter_etl_samples(path: Path, supported: set[str]) -> Iterator[PreparedSample]:
    if path.is_dir():
        yield from iter_folder_images(path, supported)
        for candidate in path.rglob("*"):
            if candidate.is_file() and candidate.suffix.lower() not in IMAGE_EXTENSIONS:
                yield from iter_etl_g_file(candidate, supported)
    elif path.is_file():
        yield from iter_etl_g_file(path, supported)


def download(url: str, destination: Path) -> Path:
    destination.mkdir(parents=True, exist_ok=True)
    target = destination / Path(url.split("?", 1)[0]).name
    if not target.name:
        target = destination / "etl10_dataset"
    urllib.request.urlretrieve(url, target)
    return target


def extract_if_archive(path: Path, destination: Path) -> Path:
    if path.is_dir():
        return path
    destination.mkdir(parents=True, exist_ok=True)
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as archive:
            archive.extractall(destination)
        return destination
    if tarfile.is_tarfile(path):
        with tarfile.open(path) as archive:
            archive.extractall(destination)
        return destination
    return path


def clean_output(output: Path) -> None:
    if not output.exists():
        return
    for child in output.iterdir():
        if child.is_dir():
            shutil.rmtree(child)
        elif child.name != ".gitkeep":
            child.unlink()


def save_samples(samples: Iterable[PreparedSample], output: Path, image_size: int) -> dict[str, int]:
    counts: dict[str, int] = {}
    output.mkdir(parents=True, exist_ok=True)
    for sample in samples:
        class_dir = output / sample.kanji
        class_dir.mkdir(parents=True, exist_ok=True)
        index = counts.get(sample.kanji, 0)
        image = crop_center_resize(ImageOps.grayscale(sample.image), image_size)
        image.save(class_dir / f"{index:05d}.png")
        counts[sample.kanji] = index + 1
    return counts


def write_label_map(counts: dict[str, int], model_dir: Path) -> dict[str, int]:
    labels = [kanji for kanji in SUPPORTED_KANJI if counts.get(kanji, 0) > 0]
    label_map = {kanji: index for index, kanji in enumerate(labels)}
    model_dir.mkdir(parents=True, exist_ok=True)
    with (model_dir / "label_map.json").open("w", encoding="utf-8") as file:
        json.dump(label_map, file, ensure_ascii=False, indent=2)
    return label_map


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare ETL10/ETL-CDB kanji images for Kanji Canvas training.")
    parser.add_argument("--etl10-path", type=Path, default=None, help="Local ETL10 archive, extracted ETL folder, binary file, or <kanji>/*.png folder.")
    parser.add_argument("--etl10-url", default=None, help="Optional direct dataset archive URL to download before processing.")
    parser.add_argument("--download-dir", type=Path, default=DEFAULT_DOWNLOAD_DIR)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--model-dir", type=Path, default=DEFAULT_MODEL_DIR)
    parser.add_argument("--image-size", type=int, default=64, choices=[64, 128])
    parser.add_argument("--clean", action="store_true", help="Clear existing processed images before writing.")
    args = parser.parse_args()

    if not args.etl10_path and not args.etl10_url:
        raise SystemExit("Pass --etl10-path for a local dataset or --etl10-url for a direct archive download.")

    source = args.etl10_path
    if args.etl10_url:
        print(f"Downloading ETL10 dataset from {args.etl10_url}")
        source = download(args.etl10_url, args.download_dir)

    if source is None:
        raise SystemExit("No ETL10 source resolved.")

    supported = set(SUPPORTED_KANJI)
    if args.clean:
        clean_output(args.output)

    with TemporaryDirectory() as temp_dir:
        extracted = extract_if_archive(source, Path(temp_dir) / "etl10")
        counts = save_samples(iter_etl_samples(extracted, supported), args.output, args.image_size)

    label_map = write_label_map(counts, args.model_dir)
    total = sum(counts.values())
    print(f"Processed {total} ETL samples into {args.output}")
    print(f"Matched {len(label_map)} JLPT N5-N4 app kanji")
    print(f"Saved label map: {args.model_dir / 'label_map.json'}")
    if not total:
        print("No matching ETL samples found. Check that the source contains ETL G-format kanji records or <kanji>/*.png folders.")


if __name__ == "__main__":
    main()
