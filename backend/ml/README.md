# Kanji Canvas ML Pipeline

This folder contains the custom visual Kanji recognizer for JLPT N5-N4.
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

ETL10 is optional. By default, the trainer uses the full JLPT N5-N4 label list, renders 350 synthetic images per kanji from installed Japanese system fonts, mixes in corrected samples from `backend/ml/user_samples`, saves generated images to `backend/ml/data/synthetic_kanji/<kanji>/`, then trains the CNN for 50 epochs:

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

It also filters to the JLPT N5-N4 kanji used by the app and writes:

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
