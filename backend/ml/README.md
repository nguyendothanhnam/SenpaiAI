# Kanji CNN training and evaluation

This pipeline builds its ordered class list from `backend/app/data/kanji_dictionary.json` (N5/N4/N3). Missing stroke counts are resolved from the local KanjiVG SVG files; an entry missing its JLPT level or both dictionary and SVG stroke data stops the run with the affected characters listed. Duplicate labels also stop the run. The running model files remain `models/kanji_model.pt` and `models/label_map.json`; all retraining commands below write to `models/n3_candidate`.

`kanji_recognizer.py` reads the number of classes from `label_map.json`; `get_model_info()` derives the supported JLPT levels from those labels and dictionary metadata. Once candidate files are deliberately copied into the standard model paths and the backend restarts, the status endpoint and UI report levels automatically.

## Environment

Run commands from `backend/` in the project virtual environment:

```powershell
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

The first run renders the full synthetic dataset and can take a while. The complete default is 350 images per class, 64×64 pixels, 50 epochs. At 612 classes that is 214,200 synthetic images. On this CPU, the 20-images-per-class smoke epoch took 171 seconds; a simple linear estimate puts a full-data epoch near 50 minutes and 50 epochs near 42 hours, plus generation. GPU and storage speed change this substantially, so benchmark on the target machine before starting a full run.

## 1. Check fonts and generate data

Fonts are searched automatically. Each selected font is checked against every dictionary label; fonts with missing glyphs are reported with the exact characters and excluded. Explicit `--font` paths are strict and stop if any requested font lacks a glyph. Japanese schoolbook fonts are preferred when installed (UD Digi Kyokasho, BIZ UD, Yu Gothic, Meiryo, and Japanese Mincho families).

Generate into a separate candidate dataset so the existing generated dataset is preserved:

```powershell
.\venv\Scripts\python.exe ml/scripts/generate_kanji_dataset.py --output ml/data/n3_candidate_synthetic --samples-per-class 350 --image-size 64
```

The existing augmentation defaults are retained for comparison: scale 0.88–1.12, rotation ±10°, translation up to 9 px before crop and ±4 px affine shift, morphology-based thickness changes, blur radius up to 0.65, noise standard deviation 3–12, stroke offset up to 2 px, and elastic jitter 1.5–4 px. These are fairly strong transformations. For a later controlled experiment, consider reducing rotation to ±6°, affine shift to ±2 px, elastic jitter to 1–2 px, and applying elastic distortion less often (about 10%) while retaining varied thickness and modest noise. Existing defaults remain unchanged.

## 2. Train a separate candidate

By default the trainer combines generated samples, ETL10 PNGs under `ml/data/etl10_processed`, any `--dataset-dir` folder, and corrected user samples under `ml/user_samples`. ETL10 samples have weight 3 and corrected user samples weight 6 versus generated samples weight 1. User samples without `corrected_kanji` are ignored. Before training, it prints source totals, totals by JLPT level, and per-class minimum/maximum counts. The weighted sampler oversamples the higher-weight sources and keeps classes represented evenly.

```powershell
.\venv\Scripts\python.exe ml/train_kanji_model.py --artifact-dir ml/models/n3_candidate --synthetic-dir ml/data/n3_candidate_synthetic --samples-per-class 350 --image-size 64 --epochs 50 --batch-size 64
```

Each epoch reports overall and N5/N4/N3 validation accuracy and elapsed seconds. The best validation model is stored as `kanji_model.pt`; `label_map.json` uses the recognizer's current `{kanji: index}` format. `checkpoint_last.pt` is updated each epoch with model and optimizer state. Continue after interruption with the same arguments plus `--resume`; set `--epochs` to the desired final epoch number (for example, `--epochs 50`). `training_summary.json` records class/source counts, configuration, best per-level validation accuracy, and measured epoch times.

Small end-to-end smoke run (same 612 classes, deliberately tiny volume):

```powershell
.\venv\Scripts\python.exe ml/scripts/generate_kanji_dataset.py --output ml/data/n3_smoke --samples-per-class 20 --image-size 64
.\venv\Scripts\python.exe ml/train_kanji_model.py --artifact-dir ml/models/n3_smoke --synthetic-dir ml/data/n3_smoke --samples-per-class 20 --image-size 64 --epochs 1 --batch-size 64
```

The smoke model checks that generation, training, checkpointing, summary writing, evaluation, and recognizer loading work. Its accuracy is not a deployment result; do not promote it.

## 3. Compare against real handwriting

Keep a held-out set that was not used for training in `heldout/<kanji>/*.png` (JPG and other common image formats are also accepted). It must contain real handwriting. Evaluate both models against exactly the same files:

```powershell
.\venv\Scripts\python.exe ml/scripts/evaluate_kanji_models.py --dataset C:\datasets\kanji-heldout --old-model-dir ml/models --candidate-model-dir ml/models/n3_candidate
```

The report shows top-1 and top-5 accuracy per N5/N4/N3, the 20 most frequent top-1 confusion pairs for each model, and warns when candidate N5 or N4 top-1 accuracy falls below the old model. If the old model lacks a true N3 class, each N3 sample counts as incorrect for it without aborting evaluation. Training validation on synthetic images does not replace this handwriting holdout.

## Promote and restore manually

Only after reviewing the real-handwriting comparison, back up both current artifacts together, then copy the candidate pair into the standard paths:

```powershell
Copy-Item ml/models/kanji_model.pt ml/models/kanji_model.pt.backup
Copy-Item ml/models/label_map.json ml/models/label_map.json.backup
Copy-Item ml/models/n3_candidate/kanji_model.pt ml/models/kanji_model.pt -Force
Copy-Item ml/models/n3_candidate/label_map.json ml/models/label_map.json -Force
```

Restart the backend and inspect `/api/kanji/model-info` (or call `get_model_info()`). To restore, copy both `.backup` files back to their original names and restart. Never copy only one of the model and label-map files.

## Existing API behavior

`/api/kanji/recognize` is unchanged. It obtains CNN predictions from the label map and the service reranks candidates using the existing stroke-count, requested-JLPT, and frequency scores. Ollama is not used for image recognition.
