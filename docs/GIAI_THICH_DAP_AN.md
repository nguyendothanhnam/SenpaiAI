# Kiểm kê giải thích sau khi trả lời

| Phạm vi | Nguồn và trạng thái |
| --- | --- |
| Nhiệm vụ hằng ngày: ngữ pháp, kanji, từ vựng, tự đánh giá thẻ | API chấm đã trả `explanation_details` sau trả lời; API đọc lại chỉ trả trường này cho mục đã trả lời. Có thể thiếu ví dụ hoặc dữ liệu tương ứng với lựa chọn sai. |
| Luyện ngữ pháp | API chấm trả `explanation_details`, lời giải lưu sẵn, cấu trúc quy tắc và ví dụ khi có. Chưa có cơ sở dữ liệu mô tả riêng mọi đáp án sai. |
| Bài đầu vào | Ngân hàng v2 có explanation lưu trong snapshot, nhưng giao diện và API chưa trả lời giải sau từng câu. Chưa triển khai. |
| Flashcard kiểm tra đám mây | API có đánh giá sau nộp và dữ liệu thẻ; chưa có giải thích có cấu trúc mới. Chưa triển khai. |
| Quiz tự tạo và học thẻ cục bộ | Chấm tại thiết bị, câu hỏi chứa đáp án; hiện không đáp ứng yêu cầu chỉ máy chủ giữ đáp án trước khi trả lời. Chưa triển khai chuyển luồng. |
| Các câu hỏi kanji/từ vựng độc lập và trò chơi | Một số API trả đáp án cùng đề để chấm tại client. Chưa triển khai chấm phía máy chủ. |

Lời giải mới dựa trên dữ liệu đã lưu, không gọi AI. Khi không có thông tin về lựa chọn
sai, giao diện nêu rõ chưa có dữ liệu; không suy đoán hoặc khẳng định sai. Các giải
thích lưu sẵn có thể được tạo tự động từ trước và chưa đồng nghĩa với kiểm duyệt.
Các ví dụ, nghĩa, cách đọc và giải thích tiếng Việt từ cơ sở dữ liệu chưa được dịch
tự động sang tiếng Anh. Các thành phần giao diện có bản dịch vi/en.

Chưa triển khai tùy chọn sinh giải thích tự động, bộ nhớ đệm và cấu hình tắt. Chưa có
báo cáo số lượng thiếu theo loại/cấp độ: dữ liệu nằm ở nhiều nguồn, gồm các bộ quiz
chỉ lưu trên từng thiết bị; không thể suy ra số lượng này chỉ từ mã nguồn hay một DB.
Cần chạy kiểm kê trên dữ liệu triển khai và thiết bị tương ứng. Chưa kiểm thử an toàn
không lộ đáp án cho toàn bộ các luồng cũ, vì một số luồng hiện đã gửi đáp án cho client.
