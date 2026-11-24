# Kiến trúc AI SenpaiAI — những gì cần bảo vệ

Cập nhật từ workspace ngày 24/11/2026. Thay cho bản khảo sát dài ngày 16/11 còn mô tả mô hình chính 245 lớp; giữ các phân biệt kỹ thuật và cập nhật bằng artifact hiện có. Tổng quan ứng dụng ở [Báo cáo dự án](BAO_CAO_DU_AN.md).

## Phân loại công nghệ

| Loại | Thành phần | Điều cần nói chính xác |
| --- | --- | --- |
| Tự huấn luyện | KanjiCNN bằng PyTorch | Có mã train, trọng số và label map; không phải tự huấn luyện LLM |
| Mô hình có sẵn | Ollama/OpenAI, embedding, VOICEVOX, mã Whisper | Thay prompt/RAG/cấu hình không phải cập nhật trọng số; có mã dịch vụ không đồng nghĩa router đã được bật |
| Luật và thuật toán | Tra cứu, lọc nguồn, chấm đáp án, hình học nét, lộ trình, minigame | Có giá trị kỹ thuật nhưng không tự trở thành mô hình học máy |

## Nhận dạng Kanji

[KanjiCNN](../backend/ml/kanji_model.py) nhận ảnh xám 64×64: các khối convolution 32/64/128/256 kênh, BatchNorm/ReLU/MaxPool, adaptive pooling 4×4, fully connected 4096→512→số lớp và dropout. Cross-entropy dùng cho phân loại đa lớp. Kiến trúc CNN phù hợp thông tin hình dạng cục bộ, nhẹ hơn mô hình ngôn ngữ nhưng vẫn nhạy phong cách chữ và miền dữ liệu.

Luồng: chuẩn hóa ảnh/alpha/nền trắng → tensor theo đúng miền train → CNN xếp hạng → hậu xử lý có giới hạn bằng metadata/hình học → trả gợi ý. Ảnh rỗng/hỏng không được lưu thành mẫu tốt. Ảnh mẫu ETL để xem không quyết định CNN có hỗ trợ chữ đó hay không.

Artifact `backend/ml/models/deployment.json` ghi mô hình chính **612 lớp: 79 N5, 166 N4, 367 N3**, cài ngày 21/11/2026; label map và checkpoint phải đi cùng checksum. `training_summary.json` ghi 3 epoch, tập train 18.360 và validation 32.130, best validation khoảng **93,73%**. Nguồn được ghi là thư mục dữ liệu tổng hợp. Số validation này không chứng minh khả năng viết tay độc lập.

`evaluation.json` kiểm tra 1.224 ảnh render từ font, không phải người viết thật; có hồi quy N5/N4 so với mô hình 245 lớp. Độ phủ 612/612 không có nghĩa accuracy 100%. Xem [nhận dạng và dữ liệu](KANJI_RECOGNITION_DIAGNOSIS.md) để biết lỗi cũ, lệnh kiểm tra và giới hạn. Không tự chạy huấn luyện hoặc thay mô hình khi chỉ dọn tài liệu.

Các nguy cơ đo chất lượng: train/validation cùng font hoặc cách render, rò rỉ biến thể của một ảnh qua hai split, thiếu kiểu bút/thiết bị và lớp dễ nhầm. Cần tập người viết chưa gặp, chia theo người viết/font, confusion matrix và top-1/top-k theo cấp; báo cáo cả hồi quy chứ không chỉ điểm tổng.

## Chấm nét khác nhận dạng ảnh

Người học biết chữ cần viết; dịch vụ so khớp từng nét với mẫu KanjiVG. Chuẩn hóa cả chữ, lấy mẫu theo độ dài cung, ghép một-một, phân biệt thứ tự/hướng/hình/đủ nét. Cảnh báo chữ dễ nhầm chỉ tham khảo, không sửa điểm. Không cần CNN đoán chữ để quyết định nét đúng. Xem [thiết kế v2 và benchmark](DANH_GIA_NET_KANJI.md).

## Chat, RAG và giảm câu trả lời sai

1. Phân loại ý định và ngôn ngữ câu hỏi; tra cứu chính xác từ điển, ngữ pháp và cặp câu đã đối chiếu khi có.
2. Tìm học liệu liên quan bằng embedding/truy xuất; lọc nguồn theo neo nội dung, không coi điểm vector cao là bằng chứng đúng.
3. Prompt theo loại câu hỏi, chỉ ghép lịch sử đúng tài khoản/cuộc hội thoại và trong giới hạn.
4. Kiểm tra hướng dịch, ngôn ngữ, nhãn nội bộ, dấu hiệu nội dung không phù hợp; thử lại có giới hạn.
5. Khi thiếu căn cứ, thừa nhận chưa xác minh hoặc trả lỗi phù hợp; không gán độ tin cậy giả cho văn bản sinh ra.

LLM local chạy trên máy chủ, không đồng nghĩa chạy trong điện thoại. Tên model do cấu hình triển khai quyết định. Hai mốc đo đã lưu dùng `gemma:2b`; không suy diễn model mặc định hiện tại của mọi môi trường từ tên trong mã. Không có phép đo so sánh nhiều model khi chỉ một model sinh văn bản khả dụng.

Rubric 72 câu đo tiêu chí kiểm tra được, không xác minh toàn bộ ngữ pháp Nhật/dịch nghĩa. Chấm từ khóa đúng hoặc có kana không chứng minh nội dung đúng. Dữ liệu phản hồi người dùng cần rà tay, ẩn thông tin riêng tư rồi mới thêm vào bộ chuẩn; không tự học từ mọi báo cáo. Bằng chứng, thời gian và quy trình ở [Đánh giá Chat](DANH_GIA_CHAT.md).

## Dịch, ngữ pháp và âm thanh

- Dịch/phân tích ngữ pháp là LLM kết hợp validator và tham chiếu; không có classifier JLPT tự huấn luyện chỉ vì API trả trường cấp độ.
- Sinh câu hỏi AI qua schema và chống trùng không đồng nghĩa nội dung được giáo viên duyệt. Chấm đáp án ngân hàng theo luật, không cần LLM.
- VOICEVOX là TTS có sẵn; WAV và mốc câu được cache. Cache hợp lệ khác với engine đang hoạt động. Thời gian phát sinh hai bài không phải p95 toàn hệ thống.
- Whisper là ASR có sẵn; Web Speech trên trình duyệt là API nền tảng khác. Cần đối chiếu router và client hiện dùng trước khi khẳng định voice chat đã phát hành.

## Lộ trình và trò chơi

Mức thành thạo tổng hợp lịch sử có trọng số thời gian/độ khó, có phân biệt proxy; nhận xét tuần/tháng và ba hành động theo luật. Đó không phải mô hình recommendation đã huấn luyện. Điểm số gameplay và sự kiện tự báo cáo có độ tin cậy thấp hơn bài chấm server; XP game không đổi thành số dư cửa hàng.

## Nguồn, tái lập và trình bày trước hội đồng

- Mã train/inference và metadata: [backend/ml](../backend/ml/README.md).
- Nét KanjiVG: CC BY-SA 3.0; metadata KANJIDIC/kanji-data và danh sách JLPT cần ghi nguồn đúng. Nguồn/giấy phép N3 ở [bảng rà soát](kanji_n3_review.md).
- Font/ETL và dữ liệu người dùng có điều kiện riêng; giấy phép KanjiVG không bao trùm mọi ảnh render hoặc mẫu cá nhân.
- Khi báo cáo một tỷ lệ, nêu mẫu số, loại dữ liệu, split, phiên bản và giới hạn. Không gọi synthetic là viết tay độc lập, hoặc điểm rubric là tỷ lệ chính xác tiếng Nhật.
- Khi demo, chuẩn bị tình huống thiếu model, thiếu dữ liệu, mất mạng và nguồn không đủ căn cứ; giải thích phương án dự phòng và phần chưa nghiệm thu thiết bị thật.
