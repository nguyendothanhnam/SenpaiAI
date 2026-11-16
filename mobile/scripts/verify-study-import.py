"""Read-only contract check using real backend parsers; no running server needed."""
from pathlib import Path
from io import BytesIO
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend'))
from fastapi import HTTPException, UploadFile  # noqa: E402
from app.api.game import upload_quiz_excel, import_flashcard_set  # noqa: E402

samples = ROOT / 'mobile' / 'docs' / 'samples' / 'study'
checks = [
    ('quiz-valid.xlsx', upload_quiz_excel, 'questions', None),
    ('quiz-invalid-rows.xlsx', upload_quiz_excel, None, ['Row 2:', 'Row 3:']),
    ('quiz-missing-columns.xlsx', upload_quiz_excel, None, ['Missing required columns:']),
    ('flashcard-valid.xlsx', import_flashcard_set, 'cards', None),
    ('flashcard-invalid-rows.xlsx', import_flashcard_set, None, ['Row 2:', 'Row 3:']),
    ('flashcard-missing-columns.xlsx', import_flashcard_set, None, ['Missing required columns: front, back']),
    ('flashcard-valid.csv', import_flashcard_set, 'cards', None),
    ('flashcard-valid.json', import_flashcard_set, 'cards', None),
]
for name, parser, field, errors in checks:
    upload = UploadFile(filename=name, file=BytesIO((samples / name).read_bytes()))
    try:
        result = parser(upload)
    except HTTPException as error:
        assert errors and error.status_code == 400, (name, error.detail)
        assert all(message in error.detail for message in errors), (name, error.detail)
    else:
        assert field and result[field], name
    print(f'PASS {name}')
print('8 real parser checks passed. No API requests, database writes or server restarts.')
