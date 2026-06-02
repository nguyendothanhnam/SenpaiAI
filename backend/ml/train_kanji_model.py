from __future__ import annotations

import argparse
import json
import random
from pathlib import Path
from typing import Iterable, List, Tuple

import numpy as np
import torch
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps
from torch import nn
from torch.utils.data import DataLoader, Dataset, Subset, WeightedRandomSampler, random_split

try:
    from .kanji_labels import SUPPORTED_KANJI
    from .kanji_model import KanjiCNN
except ImportError:
    from kanji_labels import SUPPORTED_KANJI
    from kanji_model import KanjiCNN


IMAGE_SIZE = 64
ML_DIR = Path(__file__).resolve().parent
REPO_DIR = ML_DIR.parents[1]
DEFAULT_ARTIFACT_DIR = ML_DIR / "models"
DEFAULT_SYNTHETIC_DIR = ML_DIR / "data" / "synthetic_kanji"
DEFAULT_ETL10_DIR = ML_DIR / "data" / "etl10_processed"
DEFAULT_USER_SAMPLE_DIR = ML_DIR / "user_samples"
DEFAULT_APP_KANJI_PATH = REPO_DIR / "frontend" / "src" / "data" / "kanji.json"
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".webp"}


def find_japanese_fonts(extra_fonts: Iterable[str] | None = None) -> List[Path]:
    candidates = []
    if extra_fonts:
        candidates.extend(Path(font) for font in extra_fonts)

    search_roots = [
        Path("C:/Windows/Fonts"),
        Path("/System/Library/Fonts"),
        Path("/Library/Fonts"),
        Path("/usr/share/fonts"),
        Path("/usr/local/share/fonts"),
    ]
    names = [
        "YuGoth",
        "YuMin",
        "msgothic",
        "meiryo",
        "NotoSansCJK",
        "NotoSerifCJK",
        "NotoSansJP",
        "SourceHanSans",
        "SourceHanSerif",
    ]

    for root in search_roots:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.suffix.lower() not in {".ttf", ".ttc", ".otf"}:
                continue
            if any(name.lower() in path.name.lower() for name in names):
                candidates.append(path)

    unique = []
    seen = set()
    for path in candidates:
        resolved = str(path.resolve()) if path.exists() else str(path)
        if path.exists() and resolved not in seen:
            seen.add(resolved)
            unique.append(path)
    return unique


def repair_mojibake(value: str) -> str:
    if value in SUPPORTED_KANJI:
        return value
    try:
        repaired = value.encode("latin1").decode("utf-8")
        return repaired if repaired in SUPPORTED_KANJI else value
    except UnicodeError:
        return value


def load_app_kanji_labels(path: Path = DEFAULT_APP_KANJI_PATH) -> List[str]:
    if not path.exists():
        return []
    try:
        with path.open("r", encoding="utf-8") as file:
            rows = json.load(file)
    except (OSError, json.JSONDecodeError):
        return []

    labels = []
    seen = set()
    for row in rows if isinstance(rows, list) else []:
        value = row.get("kanji") if isinstance(row, dict) else None
        if not isinstance(value, str) or not value:
            continue
        kanji = repair_mojibake(value)
        kanji = kanji[:1]
        if kanji in SUPPORTED_KANJI and kanji not in seen:
            labels.append(kanji)
            seen.add(kanji)
    return labels


def crop_center_resize(image: Image.Image, image_size: int = IMAGE_SIZE) -> Image.Image:
    image = ImageOps.grayscale(image)
    array = image.point(lambda value: 0 if value < 245 else 255)
    bbox = ImageOps.invert(array).getbbox()
    if bbox:
        image = image.crop(bbox)
    image.thumbnail((image_size - 12, image_size - 12), Image.Resampling.LANCZOS)
    canvas = Image.new("L", (image_size, image_size), 255)
    canvas.paste(image, ((image_size - image.width) // 2, (image_size - image.height) // 2))
    return canvas


def apply_thickness_variation(image: Image.Image) -> Image.Image:
    roll = random.random()
    if roll < 0.28:
        return image.filter(ImageFilter.MinFilter(size=3))
    if roll < 0.42:
        return image.filter(ImageFilter.MaxFilter(size=3))
    return image


def apply_noise(image: Image.Image) -> Image.Image:
    if random.random() >= 0.35:
        return image
    array = np.asarray(image).astype(np.int16)
    noise = np.random.normal(0, random.uniform(3, 12), array.shape)
    noisy = np.clip(array + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(noisy, mode="L")


def apply_stroke_offset(image: Image.Image) -> Image.Image:
    if random.random() >= 0.28:
        return image
    offset = (random.choice([-2, -1, 1, 2]), random.choice([-2, -1, 1, 2]))
    shifted = ImageChops.offset(image, offset[0], offset[1])
    shifted.paste(255, (0, 0, abs(offset[0]), shifted.height))
    shifted.paste(255, (0, 0, shifted.width, abs(offset[1])))
    return ImageChops.darker(image, shifted)


def apply_elastic_distortion(image: Image.Image) -> Image.Image:
    if random.random() >= 0.22:
        return image
    width, height = image.size
    grid = 4
    mesh = []
    jitter = random.uniform(1.5, 4.0)
    for top in range(0, height, grid):
      for left in range(0, width, grid):
        right = min(left + grid, width)
        bottom = min(top + grid, height)
        source = (
            max(0, left + random.uniform(-jitter, jitter)),
            max(0, top + random.uniform(-jitter, jitter)),
            min(width, right + random.uniform(-jitter, jitter)),
            max(0, top + random.uniform(-jitter, jitter)),
            min(width, right + random.uniform(-jitter, jitter)),
            min(height, bottom + random.uniform(-jitter, jitter)),
            max(0, left + random.uniform(-jitter, jitter)),
            min(height, bottom + random.uniform(-jitter, jitter)),
        )
        mesh.append(((left, top, right, bottom), source))
    return image.transform(image.size, Image.Transform.MESH, mesh, Image.Resampling.BICUBIC, fillcolor=255)


def render_synthetic_sample(kanji: str, fonts: List[Path], image_size: int = IMAGE_SIZE) -> Image.Image:
    canvas_size = 128
    image = Image.new("L", (canvas_size, canvas_size), 255)
    draw = ImageDraw.Draw(image)
    font_path = random.choice(fonts)
    font_size = random.randint(72, 108)
    font = ImageFont.truetype(str(font_path), font_size)

    bbox = draw.textbbox((0, 0), kanji, font=font)
    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]
    scale = random.uniform(0.88, 1.12)
    x = (canvas_size - width) / 2 - bbox[0] + random.randint(-9, 9)
    y = (canvas_size - height) / 2 - bbox[1] + random.randint(-9, 9)

    draw.text((x, y), kanji, fill=random.randint(0, 35), font=font)
    if scale != 1:
        scaled_size = max(1, int(canvas_size * scale))
        scaled = image.resize((scaled_size, scaled_size), Image.Resampling.BICUBIC)
        image = Image.new("L", (canvas_size, canvas_size), 255)
        if scaled_size > canvas_size:
            left = (scaled_size - canvas_size) // 2
            scaled = scaled.crop((left, left, left + canvas_size, left + canvas_size))
            image.paste(scaled, (0, 0))
        else:
            image.paste(scaled, ((canvas_size - scaled_size) // 2, (canvas_size - scaled_size) // 2))

    image = apply_stroke_offset(apply_thickness_variation(image))
    angle = random.uniform(-10, 10)
    image = image.rotate(angle, fillcolor=255, resample=Image.Resampling.BICUBIC)
    image = ImageOps.expand(image, border=8, fill=255)
    image = image.transform(
        image.size,
        Image.Transform.AFFINE,
        (1, random.uniform(-0.05, 0.05), random.randint(-4, 4), random.uniform(-0.05, 0.05), 1, random.randint(-4, 4)),
        resample=Image.Resampling.BICUBIC,
        fillcolor=255,
    )
    if random.random() < 0.45:
        image = image.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.1, 0.65)))
    image = apply_elastic_distortion(image)
    image = apply_noise(image)
    return crop_center_resize(image, image_size)


def count_folder_images(dataset_dir: Path, labels: Iterable[str]) -> int:
    if not dataset_dir.exists():
        return 0
    total = 0
    for kanji in labels:
        class_dir = dataset_dir / kanji
        if not class_dir.exists():
            continue
        total += sum(1 for path in class_dir.rglob("*") if path.suffix.lower() in IMAGE_EXTENSIONS)
    return total


def generate_synthetic_dataset(
    output_dir: Path,
    labels: List[str],
    fonts: List[Path],
    samples_per_class: int,
    image_size: int,
    force: bool = False,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    for kanji in labels:
        class_dir = output_dir / kanji
        class_dir.mkdir(parents=True, exist_ok=True)
        existing = list(class_dir.glob("*.png"))
        if force:
            for path in existing:
                path.unlink()
            existing = []
        for index in range(len(existing), samples_per_class):
            image = render_synthetic_sample(kanji, fonts, image_size)
            image.save(class_dir / f"{index:05d}.png")

    label_map = {kanji: index for index, kanji in enumerate(labels)}
    with (output_dir / "label_map.json").open("w", encoding="utf-8") as file:
        json.dump(label_map, file, ensure_ascii=False, indent=2)


def image_to_tensor(image: Image.Image) -> torch.Tensor:
    image = ImageOps.grayscale(image)
    values = torch.ByteTensor(torch.ByteStorage.from_buffer(image.tobytes())).float()
    values = values.view(image.height, image.width) / 255.0
    values = 1.0 - values
    return values.unsqueeze(0)


class SyntheticKanjiDataset(Dataset):
    def __init__(self, labels: List[str], fonts: List[Path], samples_per_class: int, image_size: int):
        self.labels = labels
        self.fonts = fonts
        self.samples_per_class = samples_per_class
        self.image_size = image_size

    def __len__(self) -> int:
        return len(self.labels) * self.samples_per_class

    def __getitem__(self, index: int) -> Tuple[torch.Tensor, int]:
        label_index = index // self.samples_per_class
        kanji = self.labels[label_index]
        image = render_synthetic_sample(kanji, self.fonts, self.image_size)
        return image_to_tensor(image), label_index


class FolderKanjiDataset(Dataset):
    def __init__(self, dataset_dir: Path, label_map: dict[str, int], image_size: int, sample_weight: float = 1.0):
        self.samples = []
        self.sample_weights = []
        self.image_size = image_size
        for kanji, index in label_map.items():
            class_dir = dataset_dir / kanji
            if not class_dir.exists():
                continue
            for path in class_dir.rglob("*"):
                if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".bmp", ".webp"}:
                    self.samples.append((path, index))
                    self.sample_weights.append(sample_weight)

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, index: int) -> Tuple[torch.Tensor, int]:
        path, label_index = self.samples[index]
        image = Image.open(path).convert("L")
        image = crop_center_resize(image, self.image_size)
        return image_to_tensor(image), label_index


class UserSampleDataset(Dataset):
    def __init__(self, sample_dir: Path, label_map: dict[str, int], image_size: int):
        self.samples = []
        self.sample_weights = []
        self.image_size = image_size
        if not sample_dir.exists():
            return
        for item in sample_dir.iterdir():
            metadata_path = item / "metadata.json"
            image_path = item / "image.png"
            if not metadata_path.exists() or not image_path.exists():
                continue
            try:
                with metadata_path.open("r", encoding="utf-8") as file:
                    metadata = json.load(file)
            except (OSError, json.JSONDecodeError):
                continue
            corrected = metadata.get("corrected_kanji")
            predicted = metadata.get("predicted_kanji")
            kanji = corrected or predicted
            if kanji not in label_map:
                continue
            self.samples.append((image_path, label_map[kanji]))
            self.sample_weights.append(6.0 if corrected else 2.0)

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, index: int) -> Tuple[torch.Tensor, int]:
        path, label_index = self.samples[index]
        image = Image.open(path).convert("L")
        image = crop_center_resize(image, self.image_size)
        return image_to_tensor(image), label_index


class CombinedDataset(Dataset):
    def __init__(self, datasets: List[Dataset]):
        self.datasets = [dataset for dataset in datasets if len(dataset)]
        self.lengths = [len(dataset) for dataset in self.datasets]
        self.sample_weights = [
            weight
            for dataset in self.datasets
            for weight in getattr(dataset, "sample_weights", [1.0] * len(dataset))
        ]

    def __len__(self) -> int:
        return sum(self.lengths)

    def __getitem__(self, index: int):
        for dataset, length in zip(self.datasets, self.lengths):
            if index < length:
                return dataset[index]
            index -= length
        raise IndexError(index)


def train_epoch(model, loader, criterion, optimizer, device):
    model.train()
    total_loss = 0.0
    correct = 0
    total = 0
    for images, labels in loader:
        images, labels = images.to(device), labels.to(device)
        optimizer.zero_grad()
        logits = model(images)
        loss = criterion(logits, labels)
        loss.backward()
        optimizer.step()
        total_loss += loss.item() * labels.size(0)
        correct += (logits.argmax(dim=1) == labels).sum().item()
        total += labels.size(0)
    return total_loss / max(1, total), correct / max(1, total)


def evaluate(model, loader, criterion, device):
    model.eval()
    total_loss = 0.0
    correct = 0
    total = 0
    with torch.no_grad():
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            logits = model(images)
            loss = criterion(logits, labels)
            total_loss += loss.item() * labels.size(0)
            correct += (logits.argmax(dim=1) == labels).sum().item()
            total += labels.size(0)
    return total_loss / max(1, total), correct / max(1, total)


def main():
    parser = argparse.ArgumentParser(description="Train a JLPT N5-N4 Kanji Canvas CNN.")
    parser.add_argument("--dataset-dir", type=Path, default=None, help="Optional folder dataset: dataset/<kanji>/*.png")
    parser.add_argument("--etl10-dir", type=Path, default=DEFAULT_ETL10_DIR, help="Optional ETL10 processed folder: etl10_processed/<kanji>/*.png")
    parser.add_argument("--artifact-dir", type=Path, default=DEFAULT_ARTIFACT_DIR)
    parser.add_argument("--synthetic-dir", type=Path, default=DEFAULT_SYNTHETIC_DIR)
    parser.add_argument("--user-samples-dir", type=Path, default=DEFAULT_USER_SAMPLE_DIR)
    parser.add_argument("--label-map", type=Path, default=None, help="Optional label_map.json from dataset preparation.")
    parser.add_argument("--app-kanji-json", type=Path, default=DEFAULT_APP_KANJI_PATH, help="Optional frontend kanji.json label source.")
    parser.add_argument("--use-app-kanji-json", action="store_true", help="Limit labels to frontend kanji.json instead of full JLPT N5-N4.")
    parser.add_argument("--labels-from-dataset", action="store_true", help="Train only labels that have folders in --dataset-dir.")
    parser.add_argument("--no-synthetic", action="store_true", help="Train only on --dataset-dir images.")
    parser.add_argument("--no-user-samples", action="store_true", help="Do not fine-tune with backend/ml/user_samples.")
    parser.add_argument("--force-regenerate-synthetic", action="store_true", help="Regenerate synthetic PNGs before training.")
    parser.add_argument("--image-size", type=int, default=IMAGE_SIZE, choices=[64, 128])
    parser.add_argument("--samples-per-class", type=int, default=350)
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--batch-size", type=int, default=0, help="0 chooses an automatic batch size.")
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--font", action="append", default=[], help="Extra Japanese font path. Can be passed multiple times.")
    args = parser.parse_args()

    random.seed(42)
    np.random.seed(42)
    torch.manual_seed(42)

    if args.label_map:
        with args.label_map.open("r", encoding="utf-8") as file:
            loaded_label_map = json.load(file)
        labels = [kanji for kanji, _ in sorted(loaded_label_map.items(), key=lambda item: item[1])]
    elif args.labels_from_dataset and args.dataset_dir:
        labels = [kanji for kanji in SUPPORTED_KANJI if (args.dataset_dir / kanji).is_dir()]
    elif args.use_app_kanji_json:
        labels = load_app_kanji_labels(args.app_kanji_json) or SUPPORTED_KANJI
    else:
        labels = SUPPORTED_KANJI
    if not labels:
        raise RuntimeError("No labels found for training.")

    label_map = {kanji: index for index, kanji in enumerate(labels)}
    datasets: List[Dataset] = []

    folder_dataset_added = False
    if args.etl10_dir and args.etl10_dir.exists():
        etl10_dataset = FolderKanjiDataset(args.etl10_dir, label_map, args.image_size, sample_weight=3.0)
        if len(etl10_dataset):
            print(f"Using {len(etl10_dataset)} ETL10 handwriting sample(s).")
            datasets.append(etl10_dataset)
            folder_dataset_added = True

    if args.dataset_dir and args.dataset_dir.exists():
        folder_dataset = FolderKanjiDataset(args.dataset_dir, label_map, args.image_size)
        if len(folder_dataset):
            datasets.append(folder_dataset)
            folder_dataset_added = True

    if not args.no_synthetic:
        fonts = find_japanese_fonts(args.font)
        if not fonts:
            raise RuntimeError("No Japanese fonts found. Pass one or more --font paths, or train with --no-synthetic.")
        synthetic_count = count_folder_images(args.synthetic_dir, labels)
        expected_count = len(labels) * args.samples_per_class
        should_generate = args.force_regenerate_synthetic or synthetic_count < expected_count
        if should_generate:
            reason = "ETL/folder dataset missing or incomplete" if not folder_dataset_added else "synthetic dataset missing or incomplete"
            print(f"{reason}; generating synthetic kanji images in {args.synthetic_dir}")
            print(f"Using {len(fonts)} Japanese font(s).")
            generate_synthetic_dataset(args.synthetic_dir, labels, fonts, args.samples_per_class, args.image_size, args.force_regenerate_synthetic)
        synthetic_dataset = FolderKanjiDataset(args.synthetic_dir, label_map, args.image_size)
        if len(synthetic_dataset):
            datasets.append(synthetic_dataset)
    elif args.dataset_dir and not args.dataset_dir.exists():
        raise RuntimeError(f"Dataset directory does not exist: {args.dataset_dir}")

    if not args.no_user_samples:
        user_dataset = UserSampleDataset(args.user_samples_dir, label_map, args.image_size)
        if len(user_dataset):
            print(f"Using {len(user_dataset)} user sample(s) for handwriting fine-tuning.")
            datasets.append(user_dataset)

    dataset = CombinedDataset(datasets)
    if len(dataset) < 2:
        raise RuntimeError("Training needs at least two images. Prepare ETL data or enable synthetic samples.")
    val_size = max(len(labels), int(len(dataset) * 0.15))
    val_size = min(val_size, len(dataset) - 1)
    train_size = len(dataset) - val_size
    train_dataset, val_dataset = random_split(dataset, [train_size, val_size])

    device = "cuda" if torch.cuda.is_available() else "cpu"
    batch_size = args.batch_size or (128 if device == "cuda" else 64)
    train_weights = [dataset.sample_weights[index] for index in train_dataset.indices]
    sampler = WeightedRandomSampler(train_weights, num_samples=len(train_weights), replacement=True)
    train_loader = DataLoader(train_dataset, batch_size=batch_size, sampler=sampler, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0)

    print(f"labels={len(labels)} samples={len(dataset)} batch_size={batch_size} epochs={args.epochs}")
    model = KanjiCNN(num_classes=len(labels), image_size=args.image_size).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)

    best_acc = 0.0
    args.artifact_dir.mkdir(parents=True, exist_ok=True)
    model_path = args.artifact_dir / "kanji_model.pt"
    label_map_path = args.artifact_dir / "label_map.json"

    for epoch in range(1, args.epochs + 1):
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_acc = evaluate(model, val_loader, criterion, device)
        print(
            f"epoch {epoch:02d}/{args.epochs} "
            f"train_loss={train_loss:.4f} train_acc={train_acc:.3f} "
            f"val_loss={val_loss:.4f} val_acc={val_acc:.3f}"
        )
        if val_acc >= best_acc:
            best_acc = val_acc
            torch.save(model.state_dict(), model_path)
            with label_map_path.open("w", encoding="utf-8") as file:
                json.dump(label_map, file, ensure_ascii=False, indent=2)

    print(f"best_val_acc={best_acc:.3f}")
    print(f"saved model: {model_path}")
    print(f"saved labels: {label_map_path}")


if __name__ == "__main__":
    main()
