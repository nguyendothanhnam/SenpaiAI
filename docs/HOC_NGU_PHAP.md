# Học ngữ pháp — backend và web

Phần A thêm bài học theo `grammar_rules`, không tạo nội dung mẫu hoặc dùng AI.
Nhánh `0027` thêm `grammar_lessons` và `grammar_lesson_progress`; nâng cấp kiểm tra
bảng/index trước khi tạo, hạ cấp từ chối khi còn dữ liệu. Cần chạy `alembic upgrade head`
trong môi trường backend trước khi sử dụng; chưa áp dụng vào cơ sở dữ liệu đang chạy.

Nhập nội dung được cung cấp bằng `python -m scripts.import_grammar_lessons lessons.json`
tại thư mục backend. File UTF-8, tối đa 10 MiB, là một mảng đối tượng:

```json
[
  {
    "source_key": "example-rule-key",
    "grammar_rule_id": 123,
    "jlpt_level": "N5",
    "sort_order": 1,
    "formation": "Nội dung cấu tạo do người biên soạn cung cấp",
    "meaning": "Ý nghĩa do người biên soạn cung cấp",
    "usage_notes": "Ghi chú cách dùng",
    "examples": [{"ja": "日本", "vi": "Nhật Bản", "tokens": [{"text": "日", "reading": "に"}, {"text": "本", "reading": "ほん"}]}],
    "common_errors": [],
    "comparisons": []
  }
]
```

Ví dụ chỉ minh họa định dạng, không phải bài học đã được nhập; `grammar_rule_id`
phải tồn tại và cùng cấp độ. `source_key` ổn định, duy nhất; một mẫu chỉ có một
bài. Nhập lại dữ liệu giống hệt không tạo bản ghi mới, sửa nội dung cập nhật bài
hiện có và giữ tiến độ. Không đổi mẫu gắn với `source_key` đã tồn tại. Toàn bộ
file được kiểm tra trước khi ghi, tokens furigana phải ghép thành đúng câu gốc;
transaction rollback nếu lỗi. Các danh sách ví dụ/lỗi/so sánh có thể rỗng, web
hiển thị chưa có nội dung thay vì tự bịa.

API có xác thực: `GET /api/grammar-lessons?level=N5&status=studied` (status tùy chọn),
`GET /api/grammar-lessons/{id}`, `GET /api/grammar-lessons/next?level=N5`,
`PUT /api/grammar-lessons/{id}/progress` với `{"status":"studied"}` hoặc
`{"status":"mastered"}`. Không có hàng tiến độ nghĩa là chưa học; đánh dấu đã học
không hạ cấp trạng thái đã nắm. Chủ tài khoản do token xác định. Đánh dấu đã nắm
là tự đánh giá, không suy ra tự động từ điểm.

Chi tiết trả tối đa ba câu hỏi seed đang hoạt động có cùng mẫu/cấp độ, không có
đáp án hoặc giải thích trước khi trả lời. Nút kiểm tra nhanh dùng các ID này tạo
phiên qua API luyện tập sẵn có; ID câu duy nhất, lời giải chỉ về sau khi chấm.
Nếu ngân hàng thiếu câu, giao diện báo chưa có thay vì tự sinh. Nút luyện mẫu mở
cấu hình đã lọc theo cấp độ/mẫu. Điểm đến gợi ý là bài chưa học đầu tiên cùng
cấp độ. Ví dụ có token được trình bày bằng ruby và chữ Hán dùng thành phần tra cứu.

Tiến độ được đưa vào xuất dữ liệu cá nhân; migration không thay đổi hợp đồng API cũ.
Các file ngôn ngữ giao diện là vi/en; nội dung bài do nguồn JSON cung cấp hiện là
tiếng Việt, chưa có bản dịch tiếng Anh riêng. Chưa triển khai danh sách/trang bài
học trên ứng dụng mobile (phần B).

Kiểm thử dùng SQLite và nội dung giả lập: nhập lặp/validate, lọc theo người dùng,
ẩn đáp án, cập nhật trạng thái, migration chạy lặp và bảo vệ dữ liệu khi downgrade.
Chưa kiểm thử migration PostgreSQL hay nhập nội dung thật do bạn chưa cung cấp;
chưa kiểm thử giao diện trực quan trên trình duyệt/thiết bị thật.
