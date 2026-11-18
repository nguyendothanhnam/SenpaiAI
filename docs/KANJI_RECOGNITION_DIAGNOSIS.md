# Chẩn đoán nhận dạng Kanji — 16/11/2026

## Lỗi báo không hỗ trợ với 語 và 東

Đã tái hiện bằng test callback thật của trang `Kanji.jsx`: khi người dùng chọn chữ thủ công, trang chặn nhận dạng nếu API ảnh mẫu ETL10 trả `total: 0`. Điều này sai vì ảnh mẫu để xem không quyết định danh sách lớp CNN đã huấn luyện. Test cho cả 語 và 東 thất bại trước sửa (không gửi yêu cầu nhận dạng), rồi đạt sau khi bỏ điều kiện chặn và query thừa.

Đã kiểm tra API LAN đang cấu hình trong mobile: cả hai chữ có trong `supported_kanji`, dữ liệu nét có sẵn (語 14 nét, 東 8 nét), nhưng số ảnh viết tay mẫu đều là 0. Đây là nguyên nhân báo sai theo ví dụ người dùng, khác với vấn đề thiếu lớp N3 bên dưới. API nhận dạng vẫn quyết định kết quả; không tự coi chữ viết là đúng theo chữ đích. Mobile Expo hiện kiểm tra danh sách lớp mô hình, không chặn bằng số ảnh mẫu.

Web và Expo gọi cùng backend nhận dạng. Mô hình hoạt động trong workspace hiện tại có **245 lớp: N5 79, N4 166**. Từ điển có **612 chữ**, gồm thêm **367 chữ N3**. Có nghĩa hoặc nét KanjiVG không có nghĩa là CNN đã được huấn luyện cho chữ đó. Với mô hình đang dùng, N3 không thể xuất hiện trong kết quả.

Đã đối chiếu `/kanji/model-info` trên server LAN đang cấu hình: mô hình có 245 lớp N5/N4, trùng với artifact local. Nếu triển khai server khác thì kiểm tra lại endpoint của môi trường đó.

## Phần đã sửa

- `preprocess_pil_image`: nhánh ảnh trắng trả về tensor zero đúng kích thước, thay vì trả nhầm Pillow Image rồi lỗi khi gọi `.sum()` trong suy luận.
- PNG có alpha được ghép nền trắng trước khi chuyển xám. Không coi pixel đen hoàn toàn trong suốt là mực viết.
- Service trả lỗi ảnh rỗng/hỏng và không lưu các ảnh này thành mẫu huấn luyện.
- Web (trang Kanji và ô viết tay trong trò chuyện), Expo: cảnh báo phạm vi `245/612` dựa trên trường `dictionary_classes` đã có của API. Không thêm API hoặc thay cấu trúc response.
- 8 test backend kiểm tra ảnh trắng, alpha, dữ liệu hỏng, tensor chuẩn hóa và rerank; test service không ghi mẫu vào thư mục dữ liệu thật.

Các sửa này **không bổ sung lớp N3 vào trọng số**, không khẳng định đã cải thiện độ chính xác trên chữ viết tay thực tế. Không thay `kanji_model.pt`, `label_map.json` đang dùng hoặc dữ liệu mẫu của người dùng.

## Mô hình ứng viên và phần còn thiếu

`ml/models/n3_candidate` có 612 lớp và checkpoint epoch 1, best validation khoảng **85,68%**. Chưa có `training_summary.json` hoàn tất. Validation của pipeline dùng dữ liệu tổng hợp; con số này không phải độ chính xác trên chữ viết tay độc lập.

`ml/models/n3_smoke` chỉ dùng để thử pipeline, validation khoảng **0,71%**; không dùng làm mô hình nhận dạng chính.

Chưa tự thay mô hình chính bằng ứng viên hoặc chạy lại công việc huấn luyện dài hàng giờ. Cần hoàn tất huấn luyện và so sánh với bản hiện tại trên cùng tập chữ viết tay độc lập, gồm N5/N4/N3. Các mẫu người dùng đã dùng huấn luyện không được tính là held-out.

## Các lệnh kiểm tra

Kết quả bản sửa: **8 test backend**, **7 test web** (gồm 3 test hồi quy cho 語/東 và canvas trống), **107 test mobile** đạt. Lint, typecheck, bản dịch web/mobile, build web và export Android/iOS đạt. Chưa đo độ chính xác trên tập chữ viết tay độc lập.

Từ `backend/`:

```powershell
.\venv\Scripts\python.exe -m unittest discover -s tests -p "test_kanji_recogn*.py"
.\venv\Scripts\python.exe ml/scripts/audit_kanji_recognition.py --output ../tmp/kanji-recognition-coverage.json
```

Lệnh tiếp tục candidate sau khi xác nhận cấu hình/dataset giống lần chạy trước (không chạy tự động trong lần sửa này):

```powershell
.\venv\Scripts\python.exe ml/train_kanji_model.py --resume --artifact-dir ml/models/n3_candidate --synthetic-dir ml/data/n3_candidate_synthetic --samples-per-class 350 --epochs 50
```

Đối chiếu font, image-size, dữ liệu và batch size trước khi resume. Với CPU, công việc có thể mất nhiều giờ; xem benchmark trong `backend/ml/README.md`. Sau huấn luyện, chạy `ml/scripts/evaluate_kanji_models.py` với `--dataset` trỏ tới dữ liệu viết tay held-out thật; đánh giá top-1/top-5 theo cấp và lỗi nhầm chữ. Chỉ thay cặp model/label map cùng nhau sau khi nghiệm thu, có bản sao để khôi phục.

Smoke test API LAN sau sửa: gửi ảnh trắng nhận HTTP 200, `success:false`, thông báo canvas rỗng và `sample_id:null`; không tạo thư mục dữ liệu huấn luyện mới. Backend đang chạy đã nhận sửa trong lần kiểm tra này. Web/Expo cần tải bản mã mới. Người dùng đã cung cấp 語 và 東; chưa kiểm chứng lại bằng thao tác viết tay trên điện thoại thật. Việc bỏ chặn nhầm không bảo đảm mô hình nhận đúng mọi kiểu chữ viết.
