# Lộ trình và đánh giá tiến độ — phần A và B

Các số kiểm thử trong tài liệu là mốc của riêng đợt triển khai này, không phải tổng hiện tại. Xem [mục lục](README.md) để biết mốc kiểm tra toàn dự án gần nhất và các tài liệu liên quan.

Triển khai trên nhánh `mobile`, ngày 22/11/2026. Phần A bổ sung API backend; phần B thay trang giữ chỗ `/analytics` trên web và thêm lối vào từ Hồ sơ/menu. **Chưa triển khai màn hình Expo của phần C**; chỉ bổ sung khóa dịch dùng chung để API có thể tái sử dụng sau.

## Lý do chọn phương pháp

Dữ liệu hiện có gồm đáp án Hằng ngày, Ngữ pháp, Nghe, placement, phản hồi hội thoại, phiên phỏng vấn và thống kê mục hay sai. Không có thang năng lực đã được hiệu chuẩn. Vì vậy dùng quy tắc minh bạch, không gọi AI để viết báo cáo và không coi điểm thưởng/chuỗi ngày là năng lực.

Chỉ lưu thêm mục tiêu tuần trong `weekly_learning_goals`; năng lực/lộ trình/báo cáo tính từ lịch sử hiện có, tránh bảng kết quả trùng nhau và cache lỗi thời. Migration `0017` nối `0016`, thêm bảng mục tiêu cùng index đọc lịch sử. Upgrade chạy lại an toàn; downgrade từ chối nếu còn mục tiêu để tránh mất dữ liệu.

## Mô hình năng lực

Mỗi quan sát có kỹ năng, cấp thực tế nếu biết, thời điểm, kết quả, số câu, nguồn và độ tin cậy. Điểm 0–100 là trung bình có trọng số:

`trọng số = 2^(-số ngày / 30) × hệ số độ khó × độ tin cậy × số câu`

Câu khó hơn cấp đang học có hệ số lớn hơn; mẫu Ngữ pháp còn sử dụng độ khó đã lưu. Đây là quy tắc nội bộ, không phải IRT, xác suất đỗ JLPT hay thang chứng chỉ.

- Đáp án đối chiếu khóa: độ tin cậy 1; placement thật 0,6; tự nhớ flashcard 0,35; phản hồi hội thoại 0,25; điểm phỏng vấn 0,4; thống kê cũ không có ngày từng đáp án 0,2.
- Kỹ năng cần ít nhất 5 quan sát trên 2 ngày, khối lượng bằng chứng có trọng số từ 1 và lần luyện gần nhất trong 90 ngày để được coi là đủ bằng chứng.
- Mục riêng cần ít nhất 3 quan sát trên 2 ngày, cùng điều kiện độ mới; từ 80/100 là thành thạo theo tiêu chí nội bộ.
- Hội thoại dùng chỉ số tham khảo `1 / (1 + số lỗi trong phản hồi đã lưu)`. Phỏng vấn dùng điểm đã lưu. Hai nguồn này không được đưa vào độ chính xác bài chấm đáp án. Cấp 1–5 của thực tập không được suy diễn thành N5–N1.
- Không có bằng chứng thì trả `null` và trạng thái thiếu dữ liệu, không mặc định 0% hoặc 100%. Placement demo không đóng góp điểm năng lực. Điểm tổng hợp placement thích nghi không bị gán giả vào một cấp duy nhất.

Ngữ pháp tổng hợp theo mẫu; Kanji theo chữ. Thống kê cũ chỉ bổ sung khi chưa có đáp án chi tiết cho cùng mục, và không được gán vào báo cáo tuần/tháng vì thiếu ngày từng đáp án.

## Lộ trình và ba hành động

Mỗi cấp có cột mốc Kanji, mẫu Ngữ pháp, từ vựng, Nghe, hội thoại, phỏng vấn và bài xác nhận cùng cấp. Tổng chữ/mẫu là **kho đang có**, không phải toàn bộ giáo trình JLPT. Cột mốc thiếu kho/bằng chứng được ghi rõ, không coi là hoàn thành.

Điều kiện đề nghị đánh giá lại: đạt ít nhất 70% chữ và mẫu trong kho, chỉ số từ vựng từ 75, các kỹ năng còn lại từ 70 với đủ bằng chứng, và có bài xác nhận cùng cấp không phải demo đã được xác nhận. Chỉ số hội thoại/phỏng vấn vẫn là tham khảo; phỏng vấn chưa được phân cấp JLPT. API chỉ trả khả năng đề nghị xem xét, **không đổi `current_jlpt_level`**. Phần trăm bản đồ là độ phủ các cột mốc; đạt ngưỡng đề nghị xem xét không đồng nghĩa đã học hết mọi nội dung.

Ba gợi ý ưu tiên: nhiệm vụ hôm nay chưa hoàn thành, mục đến hạn ôn, kỹ năng có chỉ số thấp nhất trong nhóm đủ bằng chứng. Nếu thiếu bằng chứng, gợi ý placement/luyện bổ sung. Mỗi gợi ý có mã lý do, tham số và đường dẫn nội bộ. Không tự tạo nhiệm vụ khi chỉ xem trang báo cáo.

Mục tiêu tuần mặc định 4 ngày/10 bài, cho phép 1–7 ngày và 1–100 bài. Tuần bắt đầu thứ Hai theo múi giờ ứng dụng. Đổi mục tiêu áp dụng cho tuần hiện tại và về sau; báo cáo cũ không giả định lại mục tiêu lịch sử.

## Báo cáo, quyền riêng tư và giới hạn

Báo cáo tuần/tháng theo lịch, so độ chính xác từng kỹ năng với kỳ trước. Kỳ chưa kết thúc so cùng số ngày đã trôi qua khi tháng trước có đủ số ngày; không gắn nhãn “cùng số ngày” nếu tháng trước ngắn hơn. Nhận xét và đề xuất là khóa dịch/tham số được frontend diễn đạt bằng i18n vi/en, không phải văn bản AI mới sinh. Có thống kê mục sai, dạng bài sai và các loại lỗi từ phản hồi có sẵn; không tự bịa nguyên nhân ngôn ngữ.

Thời gian dùng mili giây trả lời hoặc thời lượng phiên đã lưu; không cộng trùng thời gian trả lời Ngữ pháp và tổng phiên. Thời gian hội thoại/phỏng vấn suy ra từ mốc mở/đóng được gắn nhãn ước lượng và giới hạn. Bài hoàn thành được đếm theo phiên/attempt, không đồng nhất với số câu. Ngày có hoạt động và độ chính xác là hai chỉ số riêng.

Mỗi nguồn luôn lọc tài khoản đăng nhập. Không có tham số chọn người dùng khác. Xuất dữ liệu tài khoản thêm `learning_progress` gồm tổng quan, bản đồ, báo cáo tuần và tháng hiện tại. Xóa tài khoản xóa mục tiêu, kể cả môi trường không bật cascade. Reset tiến độ giữ mục tiêu như thiết lập cá nhân và vẫn giữ lịch sử Hằng ngày/điểm theo quy tắc chống thưởng trùng hiện có; do đó báo cáo có thể còn phần lịch sử được bảo toàn đó.

Giới hạn đọc: tối đa 365 ngày, 3.000 hàng mỗi nguồn; catalog tối đa 10.000 mục. Dùng truy vấn theo lô, không truy vấn từng chữ/mẫu. Trả `coverage.partial` nếu bị cắt; không tuyên bố đủ điều kiện xem xét cấp khi dữ liệu bị cắt. Lịch sử phiên bắt đầu trước cửa sổ có thể không được đọc dù kết thúc gần đây. Chưa benchmark tải đồng thời/p95 trên dữ liệu sản xuất; JSON lịch sử lớn vẫn ảnh hưởng chi phí đọc.

## API và vận hành

Giữ nguyên API cũ. Các route mới dùng JWT hiện có, được đăng ký với cả tiền tố thường và `/api`:

| Route | Nội dung |
| --- | --- |
| `GET /api/learning/overview` | Kỹ năng, mục tiêu tuần, xu hướng 8 tuần, bản đồ và ba gợi ý |
| `GET /api/learning/roadmap` | Bản đồ N5–N1 |
| `GET /api/learning/mastery?skill=grammar&level=N5&offset=0&limit=20` | Chi tiết mục, tối đa 100/trang |
| `GET /api/learning/reports?period=week&offset=0&limit=1` | Báo cáo tuần hoặc tháng, tối đa 12/trang; tùy chọn `anchor` |
| `GET /api/learning/goals` | Mục tiêu và tiến độ tuần |
| `PUT /api/learning/goals` | `{study_days, lessons}`, không thay cấp JLPT |

```powershell
# Từ backend
.\venv\Scripts\python.exe -m alembic upgrade head
.\venv\Scripts\python.exe -m pytest tests/test_learning_progress.py -q
# Từ frontend
npm.cmd run build
npm.cmd run i18n:check
node --test tests/learningProgress.test.mjs
```

Migration 0017 đã áp dụng trên PostgreSQL local. Không reset, xóa hay nạp thêm lịch sử vào dữ liệu thật để thử tính năng.

## Đo chất lượng và kết quả

- 12 test backend mới: trọng số thời gian/độ khó, mô phỏng 12 tuần qua bốn tháng, mục tiêu, ranh giới ngày UTC+7, thiếu dữ liệu, placement demo, chỉ số tham khảo, không đếm trùng, phân trang, cách ly tài khoản, xuất/xóa dữ liệu và migration chạy lại.
- 5 test web mới: render trang thật vi/en, trạng thái trống/lỗi, chỉ số tham khảo, vòng mục tiêu, biểu đồ giữ khoảng trống khi thiếu điểm, hợp đồng API và không đổi JLPT khi lưu mục tiêu.
- Kiểm tra đọc theo lô: tối đa 18 SELECT trong test, thông báo khi vượt giới hạn. Chưa thể suy ra độ trễ sản xuất từ test này.
- Rà soát lại theo yêu cầu A+B ngày 22/11/2026: 12 test riêng cho lộ trình đều đạt. Toàn bộ pytest: **280 đạt, 8 lỗi Chat cũ**, 6 subtest đạt. Các lỗi cũ thuộc `test_chat_conversations.py` (1), `test_chat_grounding.py` (4), `test_chat_language.py` (3); không sửa Chat trong phần này. Log: `tmp/learning-reaudit-pytest.log` (không đưa vào Git). Có cảnh báo không ghi được cache pytest; không ảnh hưởng kết quả test.
- Toàn bộ test web: **56 đạt**. i18n web/mobile và lint `Analytics.jsx`, `LearningCharts.tsx`, `services/learning.ts` đạt. Build frontend đạt, còn cảnh báo bundle lớn/Browserslist hiện hữu. Log test web: `tmp/learning-reaudit-web.log` (không đưa vào Git). Đợt rà soát không cần sửa thêm mã tính năng hay migration; chỉ cập nhật kết quả kiểm chứng trong tài liệu này.
- Trình duyệt kiểm tra trang thật với tiến độ mô phỏng/catalog chỉ đọc ở 1280/768/390/320 px, vi/en, sáng/tối và giảm chuyển động: vòng mục tiêu, SVG, xem cấp và khung sửa mục tiêu hoạt động, không tràn ngang. Đây không phải chứng minh luồng đăng nhập đầy đủ hay dữ liệu học thực tế của người dùng.

Muốn đo chất lượng mô hình năng lực: cần người dạy gán nhãn thành thạo theo kỹ năng/mục, so thứ hạng và sai lệch điểm, độ ổn định qua các tuần, tỷ lệ báo thiếu dữ liệu, kiểm tra phân biệt bài dễ/khó và tự đánh giá. Chưa có tập chuẩn nên không công bố độ chính xác hay khả năng dự đoán JLPT.

Checklist thủ công còn lại:

- [ ] Đăng nhập hai tài khoản thật; xem trang, xuất dữ liệu và xác nhận không lẫn lịch sử.
- [ ] Sửa mục tiêu, tải lại, nhập ngoài khoảng và thử mất mạng khi lưu.
- [ ] Làm bài Hằng ngày/Ngữ pháp/Nghe/placement rồi kiểm tra chỉ số, không nhân đôi thời gian/bài.
- [ ] Xem báo cáo tuần/tháng cũ và kỳ hiện tại; phân biệt không có dữ liệu với 0% độ chính xác.
- [ ] Kiểm tra màn hình trong toàn bộ shell ứng dụng, bàn phím, theme khác và trình đọc màn hình.
- [ ] Thử với lịch sử dài, nguồn JSON lớn và tải đồng thời PostgreSQL. Không thực hiện reset/xóa trên tài khoản thật để kiểm thử.

Quyết định tiếp theo: có điều chỉnh mục tiêu mặc định 4 ngày/10 bài, các ngưỡng thành thạo hoặc trọng số tham khảo sau khi có dữ liệu do người dạy đánh giá hay không. Không cần thay quyết định để chạy bản hiện tại; phần C để lần sau.
