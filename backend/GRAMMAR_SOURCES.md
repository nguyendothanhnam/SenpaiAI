# Học ngữ pháp từ Hanabira và OpenJLPT

## Thành viên pull về sử dụng

Dữ liệu N5–N1 và giấy phép được lưu trực tiếp tại [`app/data/grammar_sources/`](app/data/grammar_sources/README.md), có manifest phiên bản và checksum. Không cần nhận bản sao database của người khác, không dùng ID mẫu ngữ pháp cố định theo máy và không tải nguồn từ Internet khi mở ứng dụng.

Từ thư mục `backend`, sau khi cài dependency hiện có và cấu hình `DATABASE_URL` tới **database SenpaiAI riêng**:

```bash
python -m alembic upgrade head
python -m scripts.seed_grammar_lessons --check
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend mặc định đồng bộ nguồn đã đóng gói khi khởi động (`SEED_BUNDLED_GRAMMAR=true`). Vào **Ngữ pháp → Học ngữ pháp** rồi chọn cấp độ. Với Docker, source đã nằm trong `backend` nên được `COPY` vào image/bind mount hiện có; build/khởi động lại backend sau khi pull. Khi đóng gói/push phải kèm toàn bộ thư mục dữ liệu và các file mã bên dưới, không chỉ file Python và không đưa database cá nhân lên Git.

Cũng có thể nhập chủ động mà không khởi động server:

```bash
python -m scripts.seed_grammar_lessons
```

Lệnh `--check` chỉ kiểm tra file nguồn, không kết nối database. Lệnh nhập thật chỉ upsert mẫu/bài học quản lý bởi bộ nguồn. Không có lệnh DROP, TRUNCATE, xóa tài khoản, đổi kết nối database hay reset tiến độ trong luồng này.

## Nội dung và giới hạn

| Cấp | Bài học sau gộp |
| --- | ---: |
| N5 | 156 |
| N4 | 144 |
| N3 | 139 |
| N2 | 200 |
| N1 | 265 |
| Tổng | **904** |

Đầu vào gồm **828 mục Hanabira** và **100 mục OpenJLPT v0.2.0**. Các cấu trúc trùng sau chuẩn hóa Unicode/khoảng trắng/dấu giữ chỗ và cùng cấp được gộp. Không tự kết luận hai cấu trúc gần nghĩa hoặc khác cấp là một bài. Giữ giải thích, cấu tạo, ví dụ tiếng Nhật, bản dịch tiếng Anh và romanization nếu nguồn có; không tự tạo lỗi hay gặp hoặc nội dung so sánh không có trong nguồn.

Bản gốc là **tiếng Anh**, chưa có bản dịch tiếng Việt cho nội dung này. Giao diện vi/en hiển thị rõ điều đó; ví dụ ưu tiên bản dịch theo ngôn ngữ giao diện rồi dùng bản còn lại. Trường `vi` cũ vẫn hỗ trợ bài tự nhập; không đặt tiếng Anh vào trường `vi`. Nguồn và liên kết giấy phép/ghi công được hiển thị ở trang chi tiết.

Nguồn này bổ sung bảng `grammar_lessons`, nơi màn **Học ngữ pháp** đọc dữ liệu. Không nhân bản 904 bài sang Thư viện chung, không tự biến ví dụ thành câu hỏi có đáp án chấm điểm. Ngân hàng câu hỏi hiện có và `/grammar-practice/from-library` vẫn hoạt động như trước. Vì nhiều mẫu mới chưa có câu hỏi luyện, phần kiểm tra nhanh có thể báo chưa có câu; đây không phải lỗi nhập bài học.

## Dữ liệu bền vững và API

Khóa nguồn được tạo từ cấp độ và hash cấu trúc đã chuẩn hóa, không dùng số thứ tự file hoặc numeric ID từ máy lập trình. Importer tái dùng rule cùng cấp/cấu trúc khi phù hợp, tạo mới khi cần, và chỉ cập nhật bài có khóa quản lý tương ứng. Không ghi lại ý nghĩa/đáp án của rule/question đã có; giữ lesson ID nên tiến độ theo tài khoản vẫn còn qua các lần đồng bộ. Bài tùy chỉnh đã dạy đúng mẫu sẽ được giữ và mục nguồn tương ứng báo `skipped`. PostgreSQL dùng transaction advisory lock để hai worker khởi động không tạo trùng.

Các endpoint giữ nguyên: `/grammar-lessons`, `/grammar-lessons/next`, `/grammar-lessons/{id}`, `/grammar-lessons/{id}/progress`. Trang chi tiết có thêm trường tùy chọn `content_language` và `sources`; ví dụ có thể có `en`/`romaji`, vẫn giữ `ja`, `vi`, `tokens` cho client cũ. Không thêm migration/schema cột cho bộ dữ liệu này. Thành viên vẫn cần chạy các migration hiện có trước khi khởi động.

## Kiểm tra thực tế — 27/11/2026

- **59 test backend đạt**: bộ nguồn mới, bài học hiện có, luyện ngữ pháp, sinh từ thư viện và xuất dữ liệu cá nhân. Test tạo database SQLite mới, chạy lifecycle khởi động thật hai lần, chặn kết nối mạng; có đủ 904 bài và ID không đổi. SQLite được bổ sung hàm `char_length` trong fixture để mô phỏng hàm PostgreSQL mà schema sẵn có dùng.
- **3 test giao diện bài học đạt**: trạng thái trống, nội dung/ruby/liên kết luyện cũ, ví dụ English/romanization/ghi công và chuyển vi/en.
- Khóa dịch web và toàn bộ namespace dùng chung với mobile đạt; mobile typecheck/lint đạt.
- Import thực tế vào `senpai_db` có 904 bài; lần nhập lại: `created=0`, `updated=0`, `rules_created=0`, `unchanged=904`, `skipped=0`.
- Đối chiếu trong lúc triển khai: Thư viện vẫn 34 tài liệu, ngân hàng vẫn 98 câu hỏi, tài khoản vẫn 5. Không kết nối ghi dữ liệu vào `mikiricv`.
- **Build web đạt** (`tsc` và Vite production). Lần chạy sandbox đầu bị EPERM khi copy asset cũ vào `frontend/dist`, đã chạy lại ngoài sandbox và đạt; còn cảnh báo Browserslist/chunk size có sẵn. ESLint riêng trang bài học đạt.
- Chưa thao tác trực tiếp toàn bộ bài trên trình duyệt/điện thoại thật. Các test API/giao diện không chứng minh tính đúng đắn ngôn ngữ của toàn bộ nội dung bên thứ ba.

Kiểm tra thủ công: chọn lần lượt N5–N1; mở một bài N3; kiểm tra cấu tạo/ý nghĩa/ví dụ EN/nguồn; chuyển vi/en và sáng/tối; đánh dấu đã học/đã nắm, restart rồi kiểm tra tiến độ giữ nguyên; tài khoản khác có tiến độ riêng; chạy nhập lần nữa không tăng số bài. Với database mới của thành viên, chỉ migrate + start phải có bài học mà không dùng bản dump cá nhân.

## File của thay đổi này

```text
backend/app/data/grammar_sources/manifest.json
backend/app/data/grammar_sources/README.md
backend/app/data/grammar_sources/hanabira/{n1,n2,n3,n4,n5}.json
backend/app/data/grammar_sources/hanabira/{LICENSE,README.upstream.md}
backend/app/data/grammar_sources/openjlpt/{n1,n2,n3,n4,n5}.json
backend/app/data/grammar_sources/openjlpt/{LICENSE,NOTICE.md}
backend/app/services/bundled_grammar.py
backend/app/services/grammar_lessons.py
backend/app/api/grammar_lessons.py
backend/app/core/config.py
backend/app/main.py
backend/env.example
backend/scripts/sync_grammar_sources.py
backend/scripts/seed_grammar_lessons.py
backend/tests/test_bundled_grammar.py
backend/GRAMMAR_SOURCES.md
frontend/src/pages/GrammarLessons.tsx
frontend/src/i18n/locales/{vi,en}/common.json
frontend/tests/grammarLessons.test.mjs
README.md
```

Giấy phép và phiên bản chính xác xem trong README của bộ nguồn. Các thay đổi mobile về placement có sẵn từ tác vụ trước được giữ nguyên; không commit/push các thay đổi khác một cách tự động.
