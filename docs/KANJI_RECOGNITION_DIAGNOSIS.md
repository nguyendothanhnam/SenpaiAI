# Nhận dạng và dữ liệu Kanji

Cập nhật workspace 24/11/2026. Tài liệu giữ địa chỉ để các liên kết từ hướng dẫn ML vẫn hoạt động, đồng thời thay trạng thái chẩn đoán 245 lớp ngày 16/11 bằng artifact hiện tại.

## Mô hình chính: 612 lớp

`backend/ml/models/deployment.json` ghi cài ngày 21/11/2026, gồm 79 N5 + 166 N4 + 367 N3. `kanji_model.pt` phải đi cùng `label_map.json` và checksum của đúng bản triển khai. Bản 245 lớp là mốc cũ, không phải trạng thái chính của workspace hiện tại.

`training_summary.json` ghi best validation khoảng 93,73%; `evaluation.json` dùng 1.224 ảnh render font, không phải viết tay độc lập. Có hồi quy N5/N4 so với mô hình trước; độ phủ 612 chữ không chứng minh accuracy 100%. Xem [kiến trúc AI](BAO_CAO_AI_SENPAIAI.md) và [hướng dẫn ML](../backend/ml/README.md) trước khi đánh giá hoặc thay trọng số.

## Nguyên nhân lỗi 語 và 東 trước đây

Ngày 16/11 đã tái hiện việc web chặn nhận dạng vì API ảnh mẫu ETL10 trả `total: 0`, dù chữ nằm trong danh sách lớp mô hình. Ảnh mẫu là nội dung để xem, không quyết định mô hình hỗ trợ chữ hay không. Đã bỏ điều kiện chặn; Expo cũng kiểm tra lớp mô hình thay vì số ảnh mẫu. Không suy từ việc có metadata/nét chuẩn rằng CNN chắc chắn nhận dạng đúng kiểu viết người dùng.

Tiền xử lý đã sửa ảnh trắng thành tensor zero đúng kích thước, ghép PNG alpha lên nền trắng trước khi chuyển xám, từ chối ảnh rỗng/hỏng và không lưu chúng thành mẫu tốt. Nhận dạng ảnh vẫn là gợi ý; chấm nét theo chữ đích là [dịch vụ khác](DANH_GIA_NET_KANJI.md).

## Nguồn và phạm vi dữ liệu

- Từ điển: 612 chữ; việc sửa metadata N5/N4 đã đưa số mục thiếu nghĩa/âm/số nét từ 65 và 163 về 0 trong mốc kiểm tra 16/11. Điều này không đảm bảo mọi chữ có ví dụ hoặc mọi loại âm.
- Mẫu nét: KanjiVG, CC BY-SA 3.0. Metadata N5/N4: [nguồn gốc](../backend/scripts/data/KANJI_METADATA_SOURCES.md). N3: [nguồn, giấy phép và bảng rà soát](kanji_n3_review.md).
- Âm Hán Việt: 492 mục kVietnamese từ Unicode 17 Unihan, thêm 際 = TẾ do người dùng cung cấp; tổng 493/612, 119 mục thiếu để trống. Không gán toàn bộ phần này cho KanjiVG/Unihan.
- Mẫu font, ảnh ETL và mẫu cá nhân có điều kiện riêng, không được coi giấy phép nét là giấy phép tái phân phối mọi ảnh/trọng số.

## Học chữ và tra cứu

Tab Học chữ có nghĩa/On/Kun/romaji/ví dụ, chuyển chữ/tìm kiếm và quiz đọc/nghĩa. Quiz cần đáp án khác nhau cùng cấp; thiếu kho thì thông báo thay vì lặp đáp án. Mở thẻ chưa phải đã học; tiến độ phụ thuộc hành động ôn/đáp án. Đọc tiếng Nhật bằng giọng trình duyệt phụ thuộc thiết bị.

Bảng tra Kanji mở khi bấm chữ văn bản bài tập, lưu ghi chú riêng; không có thanh tra đầu trang và không cho dùng để xem đáp án trong ván game đang chơi. Thiếu metadata không tự bịa. Xem [Minigame và bảng tra](MINIGAMES.md).

## Âm thanh luyện nghe: ghi nhận vận hành cũ

Ngày 16/11 đã xác minh VOICEVOX cổng 50021 không chạy; sau khởi động dịch vụ có WAV/mốc câu hợp lệ cho 17/17 bài nghe công khai. Hai lượt sinh chưa cache khoảng 16–20 giây, không phải benchmark p95. Không liệt kê bài riêng tư.

Khi khôi phục, ưu tiên cache WAV và timing hợp lệ trước khi gọi engine. Cache hỏng phải sinh lại; HTTP 503 của dịch vụ tạo âm thanh khác với lỗi tải/mạng chung. Đường cache có sẵn có thể phát khi engine tạm ngừng; bài mới vẫn cần VOICEVOX. Chưa nghiệm thu loa/giọng và thiết bị thật trong mốc đó.

## Kiểm tra

Đối chiếu endpoint `/kanji/model-info` của đúng môi trường; restart backend sau khi thay artifact, không chỉ đọc label map trong máy khác. Từ thư mục `backend`:

```powershell
.\venv\Scripts\python.exe scripts/validate_kanji_dictionary.py
.\venv\Scripts\python.exe -m pytest tests/test_kanji_model_deployment.py tests/test_kanji_writing.py -q
```

Không chạy train/promotion hoặc ghi mẫu thật chỉ để dọn tài liệu. Cần người biết tiếng Nhật rà dữ liệu và tập viết tay độc lập trước khi công bố chất lượng nhận dạng thực tế.
