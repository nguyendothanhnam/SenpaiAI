# Tài liệu SenpaiAI

Tài liệu được gom theo chủ đề, cập nhật ngày 24/11/2026 từ workspace nhánh `mobile`. Các mốc đo có thời điểm và phạm vi riêng; bản sửa Chat v3 hiện được kiểm chứng trong workspace.

| Cần tìm | Tài liệu |
| --- | --- |
| Tổng quan, luồng xử lý, bản đồ mã và chuẩn bị bảo vệ | [Báo cáo dự án](BAO_CAO_DU_AN.md) |
| Phân biệt mô hình tự huấn luyện, mô hình có sẵn và luật | [Kiến trúc AI](BAO_CAO_AI_SENPAIAI.md) |
| Chất lượng Chat, bộ đo, phản hồi và nguồn | [Đánh giá Chat](DANH_GIA_CHAT.md) |
| Chấm nét v2, giao diện luyện viết, báo chấm sai | [Luyện viết Kanji](DANH_GIA_NET_KANJI.md) |
| Nhận dạng 612 chữ, nguồn dữ liệu, lỗi cũ và vận hành âm thanh | [Nhận dạng và dữ liệu Kanji](KANJI_RECOGNITION_DIAGNOSIS.md) |
| Sổ câu đã phục vụ, chống trùng và báo cáo kho | [Chọn bài tập](DICH_VU_CHON_BAI_TAP.md) |
| Năng lực, lộ trình, mục tiêu và báo cáo học tập | [Lộ trình và tiến độ](LO_TRINH_VA_TIEN_DO.md) |
| Chín minigame, chiến dịch, XP và tra Kanji | [Minigame](MINIGAMES.md) |
| Bộ thẻ theo tài khoản, thẻ lật/Learn/Test, thống kê và Expo | [Flashcard](FLASHCARDS.md) |
| Bảng rà soát nghĩa và ví dụ của 367 chữ N3, kèm nguồn/giấy phép | [Rà soát Kanji N3](kanji_n3_review.md) |
| Rà soát nội dung tài liệu mẫu | [Rà soát thư viện](library_documents_review.md) |

## Bằng chứng kiểm thử được giữ lại

- [Chat trước](ket_qua/chat_baseline.json) và [Chat sau](ket_qua/chat_after.json): giữ nguyên câu trả lời, rubric, thời gian và checksum, không chỉ giữ điểm tổng.
- [Chat v3 trước](ket_qua/chat_v3_baseline.json), [Chat v3 sau](ket_qua/chat_v3_after.json): bộ 96 câu mới; [đo context và bộ nhớ](ket_qua/chat_context_profile.json). Cách chấm lại cùng rubric và các giới hạn nằm trong [Đánh giá Chat](DANH_GIA_CHAT.md).
- [Hiệu chỉnh Kanji](ket_qua/kanji.json): gộp baseline, ba mức chấm, ca tái hiện 34/100 và báo cáo v1 cũ có nhãn lịch sử. Các phép đo khác bộ ca không được so trực tiếp như cùng một benchmark.

Không coi kết quả mô phỏng là độ chính xác với người học thật. Kết quả kiểm tra hiện tại được ghi ở tài liệu từng chủ đề; không so trực tiếp các benchmark khác bộ ca.

## Quy ước duy trì

- Cập nhật tài liệu chủ đề hiện có; tránh thêm một báo cáo cho mỗi lượt trao đổi hoặc mỗi đợt sửa.
- Giữ mốc đo gốc trước/sau. Báo cáo sinh lại và danh sách ứng viên lớn ghi vào `tmp/`, chỉ đưa kết quả nghiệm thu cần thiết vào `ket_qua/`.
- Không đưa `.env`, token, hội thoại thật hoặc mẫu viết tay cá nhân vào tài liệu công khai.
- Hướng dẫn cài đặt chung nằm ở [README dự án](../README.md); cách chạy và kiểm chứng từng phần nằm trong tài liệu chủ đề.

Đã gộp ba tài liệu tổng quan/bảo vệ thành báo cáo dự án; gộp các đợt minigame thành một tài liệu; gộp chấm nét A/B; đưa nguồn N3 vào bảng rà soát. Báo cáo so sánh Chat dạng Markdown có thể sinh từ hai JSON gốc; danh sách cặp Kanji có thể sinh từ script, nên không giữ thêm bản lặp trong docs.
