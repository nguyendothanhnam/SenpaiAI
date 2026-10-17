# Kanji Canvas ML Pipeline

This folder contains the custom visual Kanji recognizer. Its dictionary-backed class list covers N5/N4/N3; the actually trained levels are read from the model's `label_map.json` and may remain N5/N4 until retraining is completed.
Ollama is not used for image recognition; it remains only for explanations and learning feedback.

## Folders

- `data/`: generated or imported training datasets
- `data/synthetic_kanji/`: default generated kanji images from system fonts
- `data/etl10_processed/`: optional ETL10 samples converted to `PNG` by kanji label
- `scripts/`: dataset generation and ETL preparation helpers
- `models/`: trained model artifacts
- `user_samples/`: anonymized recognition/correction samples collected by the API

## Artifacts

Training writes:

- `backend/ml/models/kanji_model.pt`
- `backend/ml/models/label_map.json`

The FastAPI recognizer loads these files automatically. If they are missing, `/api/kanji/recognize` returns `success: false` with engine `kanji-cnn-v1-unavailable` instead of inventing predictions.

## Install Dependencies

From `backend/`:

```powershell
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

## Train Without ETL10

ETL10 is optional. By default, the trainer uses the N5/N4/N3 kanji in `backend/app/data/kanji_dictionary.json`, renders 350 synthetic images per kanji from installed Japanese system fonts, mixes in available ETL10 and corrected samples, saves images under `backend/ml/data/synthetic_kanji/<kanji>/`, then trains the CNN for 50 epochs:

```powershell
.\venv\Scripts\python.exe ml/train_kanji_cnn.py
```

Regenerate synthetic samples before training:

```powershell
.\venv\Scripts\python.exe ml/train_kanji_cnn.py --force-regenerate-synthetic --samples-per-class 500
```

If no Japanese font is found, pass one or more explicitly:

```powershell
.\venv\Scripts\python.exe ml/train_kanji_cnn.py --font C:\Windows\Fonts\YuGothR.ttc
```

Synthetic augmentation includes rotation, scale, translation, stroke thickness variation, blur, pixel noise, stroke offset, and light elastic distortion.

## Prepare ETL10 Dataset

The ETL10 preparer accepts a local dataset archive, extracted folder, binary file, direct archive URL, or an already converted `<kanji>/*.png` folder. It converts matching ETL G-format samples into:

```text
backend/ml/data/etl10_processed/<kanji>/<sample>.png
```

It filters to the N5/N4/N3 kanji in the backend dictionary and writes:

```text
backend/ml/models/label_map.json
```

Use a local ETL10 path:

```powershell
.\venv\Scripts\python.exe ml/scripts/prepare_etl10_dataset.py --etl10-path C:\datasets\ETL10 --clean
```

Or use a direct archive URL:

```powershell
.\venv\Scripts\python.exe ml/scripts/prepare_etl10_dataset.py --etl10-url https://example.com/ETL10.zip --clean
```

## Train With Optional ETL10

Train with ETL10 plus synthetic augmentation:

```powershell
.\venv\Scripts\python.exe ml/train_kanji_cnn.py --dataset-dir ml/data/etl10_processed --label-map ml/models/label_map.json
```

Train from ETL10 images only:

```powershell
.\venv\Scripts\python.exe ml/train_kanji_cnn.py --dataset-dir ml/data/etl10_processed --label-map ml/models/label_map.json --no-synthetic
```

## Generate Synthetic Data Manually

The trainer does this automatically, but you can pre-generate the default synthetic dataset:

```powershell
.\venv\Scripts\python.exe ml/scripts/generate_kanji_dataset.py --samples-per-class 350
```

## Test Recognition

Check model status:

```powershell
.\venv\Scripts\python.exe -c "from ml.kanji_recognizer import get_model_info; print(get_model_info())"
```

Test one generated PNG after training:

```powershell
.\venv\Scripts\python.exe -c "import base64; from ml.kanji_recognizer import predict_kanji; p='ml/data/synthetic_kanji/月/00000.png'; data='data:image/png;base64,'+base64.b64encode(open(p,'rb').read()).decode(); print(predict_kanji(data, top_k=5))"
```

## Inference

`ml/kanji_recognizer.py` exposes:

```python
predict_kanji(image_data, strokes, jlpt_level, top_k=5)
```

The app re-ranks model predictions with:

```text
0.70 * model_confidence
+ 0.15 * stroke_count_score
+ 0.10 * jlpt_score
+ 0.05 * frequency_score
```

KanjiVG paths are useful for training/reference overlays, but they are not the recognition algorithm. Ollama is not used for image recognition.

## Add N3 dictionary and stroke data

Run these from `backend/` in order:

```powershell
python scripts/merge_kanji_n3.py --dry-run
python scripts/merge_kanji_n3.py
python scripts/validate_kanji_dictionary.py
python scripts/seed_kanji_from_dictionary.py
```

The merge preserves existing N5/N4 entries and writes ignored `*.bak-*` backups. The seed script only creates or updates N3 rows in `kanji`, `kanji_readings`, and `kanji_examples`; it skips a conflicting character already assigned to another level. Restart the backend after merging so the KanjiVG JSON cache reloads. Recognition is a separate final step and is not automatically retrained by the merge or database seed.

## Prepare and evaluate an N3 recognition model (manual)

This is a manual, optional operation. Install a Japanese font with broad Kanji coverage first (for example Yu Gothic, Meiryo, or Noto Sans CJK JP) and pass its actual path. The default N3 class set is generated from the merged backend dictionary, not from a hand-maintained N3 label list.

Example from `backend/` on Windows:

```powershell
python ml/scripts/generate_kanji_dataset.py --output ml/data/synthetic_kanji_n3_candidate --samples-per-class 350 --image-size 64 --font C:\Windows\Fonts\YuGothR.ttc
python ml/train_kanji_model.py --synthetic-dir ml/data/synthetic_kanji_n3_candidate --artifact-dir ml/models/n3_candidate --samples-per-class 350 --epochs 50 --batch-size 64 --image-size 64 --font C:\Windows\Fonts\YuGothR.ttc
```

At 612 classes and 350 samples per class this generates about 214,200 images. Budget roughly 1–4 hours on a suitable GPU; CPU-only generation plus 50 training epochs may take several hours or overnight, depending on hardware and font/disk speed. Benchmark one epoch on the target machine before committing to the full run.

Before replacing the existing model, keep the candidate in its separate artifact directory and evaluate both models on the exact same held-out **real handwritten** images, arranged as `heldout/<kanji>/*.png` (or JPG). Do not put these evaluation images in training folders.

```powershell
python ml/scripts/evaluate_kanji_models.py --dataset C:\datasets\kanji-heldout --old-model-dir ml/models --candidate-model-dir ml/models/n3_candidate
```

The script reports top-1 accuracy and sample counts separately for N5, N4, and N3. Review per-level accuracy and confusion examples, especially N5/N4 regression, before backing up and manually promoting both candidate files (`kanji_model.pt` and `label_map.json`) together. The training script's validation split is not a substitute for a real handwriting holdout.

Risk: the classifier grows from roughly 245 to 612 classes, while the added N3 training images may be synthetic font renderings only. This can lower accuracy on real handwriting, including existing N5/N4 classes. Do not deploy the candidate until its held-out real handwriting results are acceptable.
