# Luyện ngữ pháp (backend)

## File thay đổi

- Thêm `alembic/versions/0005_grammar_practice.py` (revision kế tiếp `0004`); ZIP kèm migration `0004` đang có trong nhánh workspace để giữ nguyên chuỗi revision.
- Thêm model câu hỏi và attempts trong `app/models/database.py`; schema hồ sơ đã gồm trường `exercise_points` từ thay đổi trước.
- Thêm `app/services/grammar_practice_service.py`, `app/api/grammar_practice.py`, `scripts/seed_grammar_practice.py` và `tests/test_grammar_practice.py`.
- `app/main.py`: chỉ thêm import router và đăng ký router hai lần (`/grammar-practice` và `/api/grammar-practice`).
- `app/api/auth.py`: xóa attempts tường minh trước khi xóa learning sessions khi reset tiến độ hoặc xóa tài khoản. FK CASCADE cũng bảo vệ khi xóa user/session trực tiếp.

Các mẫu N5/N4 và câu ví dụ là dữ liệu khởi đầu, cần người biết tiếng Nhật rà soát trước khi dùng làm nội dung học chính thức. Script seed không chạy khi khởi động ứng dụng.

## Migration, seed và test

Từ thư mục `backend` (đã cấu hình `DATABASE_URL`):

```bash
alembic upgrade head
python scripts/seed_grammar_practice.py
pytest tests/test_grammar_practice.py
```

Hoặc chạy seed qua module từ `backend`: `python -m scripts.seed_grammar_practice`.

## API

Các ví dụ dưới đây dùng `http://localhost:8000`, token JWT trong `$TOKEN`, và đường dẫn chuẩn. Mọi endpoint yêu cầu bearer token. Có cùng endpoint dưới tiền tố `/api`.

### Mẫu ngữ pháp

```bash
curl -H "Authorization: Bearer $TOKEN" \
  'http://localhost:8000/grammar-practice/patterns?jlpt_level=N5'
```

### Tạo phiên (ngân hàng câu hỏi)

```bash
curl -X POST http://localhost:8000/grammar-practice/sessions \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"jlpt_level":"N5","question_types":["fill_blank","reorder","true_false","conjugation"],"count":5,"mode":"bank"}'
```

Để làm lại câu sai, truyền `question_ids` từ `wrong_question_ids` trong kết quả finish. `mode` nhận `bank`, `mixed`, hoặc `ai`; `ai`/`mixed` cần chọn thêm `grammar_rule_id` nếu muốn cố định mẫu. Ngân hàng thiếu câu thì API trả số câu có cùng `message`.

### Trả lời câu hỏi

```bash
curl -X POST http://localhost:8000/grammar-practice/sessions/SESSION_ID/answer \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"question_id":123,"answer":"は","time_spent_ms":4200}'
```

`answer` là chuỗi với `fill_blank`/`conjugation`, mảng token với `reorder`, và boolean với `true_false`. Phản hồi có đáp án, giải thích tiếng Việt và ví dụ.

### Kết thúc phiên

```bash
curl -X POST http://localhost:8000/grammar-practice/sessions/SESSION_ID/finish \
  -H "Authorization: Bearer $TOKEN"
```

### Thống kê

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/grammar-practice/stats
```

### Sinh tối đa 5 câu AI

```bash
curl -X POST http://localhost:8000/grammar-practice/generate \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"jlpt_level":"N5","grammar_rule_id":1,"question_type":"fill_blank","count":3}'
```

Phản hồi gồm `requested`, `saved`, `rejected`; giới hạn lưu câu AI là 30 câu/người trong một giờ. Ollama được gọi trong worker thread để không chặn event loop. Câu AI không hợp lệ hoặc trùng prompt + dạng sẽ bị loại riêng.

## Đóng gói ZIP

Từ thư mục gốc dự án, tạo ZIP chứa các file backend đã thay đổi và giữ nguyên đường dẫn tương đối:

```bash
python -c "from pathlib import Path; from zipfile import ZipFile, ZIP_DEFLATED; files=['backend/app/models/database.py','backend/app/models/schemas.py','backend/app/main.py','backend/app/api/auth.py','backend/app/api/grammar_practice.py','backend/app/services/grammar_practice_service.py','backend/alembic/versions/0004_user_exercise_points.py','backend/alembic/versions/0005_grammar_practice.py','backend/scripts/seed_grammar_practice.py','backend/tests/test_grammar_practice.py','backend/GRAMMAR_PRACTICE.md']; z=ZipFile('grammar-practice-backend.zip','w',ZIP_DEFLATED); [z.write(p,Path(p).as_posix()) for p in files]; z.close()"
```
