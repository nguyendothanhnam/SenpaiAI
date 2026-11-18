# Rà soát trò chơi và hướng dẫn — 16/11/2026

## Cập nhật theo phản hồi giao diện

- Bỏ thẻ luyện nghe khỏi hub, giữ màn hình luyện nghe riêng.
- Các lối tắt Quiz, Flashcard, Kanji và ngữ pháp mở thẳng trang đích, không hỏi JLPT hai lần.
- Quiz, tạo Quiz thủ công/từ tệp và tạo Flashcard dùng nền tiêu đề theo theme, tránh chữ tối trên nền xanh đậm.
- Ninja vẽ chữ bằng thẻ HTML, không kéo giãn chữ trong SVG; chỉ vệt chém dùng SVG. Hiển thị mục tiêu, quy tắc điểm/mạng, tiến độ, phản hồi cộng điểm/mất mạng và thông báo khi chém hụt. Không thay luật chơi chung hay cộng xu.
- Kiểm chứng Chrome bằng thao tác pointer thật: chém đúng tăng điểm/tiến độ, chém nhầm mất mạng; điều hướng ba thẻ không mở modal, minigame vẫn chọn cấp độ. Kiểm tra 320/390px, sáng/tối; bốn tiêu đề đạt tương phản tối thiểu 4,5:1 trên theme thử nghiệm. Build, lint, kiểu và khóa dịch hai nền tảng đạt; 12 test web đạt, hai test tích hợp liên quan tiếp tục đạt sau khi bổ sung assertion. Chưa kiểm tra các thay đổi này trên thiết bị thật.

Web có **11 thẻ**, mobile có **9 minigame**. Không có ID/đường dẫn bị lặp trong danh sách Game Hub hiện tại. Đã bỏ các thẻ Thử Thách Nghe Chép, Đấu Trường Kanji và Đua Xe Ngữ Pháp khỏi hub; học/luyện tập tương ứng vẫn nằm trong các mục riêng. Luyện ngữ pháp tiếp tục hoạt động tại `/grammar/practice`.

## Các tên giới thiệu đang mở chế độ đã có

| Tên trên thẻ web | Chế độ thực tế | Đường dẫn |
| --- | --- | --- |
| Quiz Siêu Tốc | Khu vực Quiz hiện có | `/quiz` |
| Lật Thẻ Ghi Nhớ | Flashcard hiện có | `/flashcard` |
| Nối Từ Thần Tốc | Shiritori chọn từ của Đợt 1 | `/games/shiritori` |

Đây là các tên thẻ giới thiệu cho hoạt động đã có. Riêng Nối Từ Thần Tốc và Shiritori là cùng một trò với hai tên giữa web/mobile; chỉ có một thẻ trong mỗi hub. Quiz và Flashcard mở thẳng trang đích, không hỏi cấp độ ở hub. Các minigame dùng engine chung vẫn chọn cấp độ có dữ liệu. Thẻ đua xe, biểu tượng và các khóa dịch/hướng dẫn riêng của thẻ đã được loại bỏ.

## Những nhóm gần nhau về cách chơi

| Nhóm | Phần giống | Điểm khác |
| --- | --- | --- |
| Quiz Siêu Tốc ↔ Kanji Quiz trong Đấu Trường Kanji | Trả lời câu hỏi/chọn đáp án | Quiz dùng bộ câu hỏi; Kanji Quiz tập trung chữ/cách đọc/nghĩa |
| Kanji Matching ↔ Nối từ đánh quái | Ghép từ với nghĩa | Đánh quái thêm sát thương, combo 5 giây, màn và boss |
| Lật Thẻ Ghi Nhớ ↔ Chuỗi nhớ Kana | Cùng luyện trí nhớ | Flashcard nhớ nghĩa qua hai mặt thẻ; Chuỗi Kana nhớ thứ tự đèn và tăng độ dài |

Kanji rơi, Mật mã Kana, Xưởng ghép từ, Tìm từ ẩn, Ninja và Kanji mất nét có luật/thao tác riêng. Cùng dùng dữ liệu Kanji/từ vựng không có nghĩa là trùng trò. Đấu hạng chưa có engine riêng, vẫn hiển thị trạng thái chưa có trò thay vì dựng bảng xếp hạng giả.

## Hướng dẫn và popup mới

- Mỗi thẻ web có nút **Cách chơi**; popup có mục tiêu, ba bước và mẹo riêng. Có đủ hướng dẫn vi/en cho cả 12 thẻ hiện tại.
- Chín minigame trên mobile có cùng nội dung hướng dẫn dùng chung. Mở trong ván sẽ tạm dừng; đóng hướng dẫn không tự tiếp tục.
- Popup xác nhận web có biểu tượng theo loại, nút hủy an toàn, Escape/bấm nền để hủy, khóa cuộn và giữ/khôi phục focus. Các xác nhận được xử lý tuần tự; bấm trùng không được chấp thuận hai lần.
- Xóa thư mục có ba kết quả tách biệt: hủy / xóa thư mục và giữ cuộc trò chuyện / xóa cả cuộc trò chuyện.
- Toast lỗi/thành công/đang xử lý có tiêu đề, màu sắc và nút đóng; hộp xác nhận thoát minigame mobile dùng modal theo theme.
- Cảnh báo khi đóng/tải lại tab trình duyệt vẫn dùng `beforeunload` do trình duyệt quản lý; không thể thay bằng popup tùy biến.

Không đổi API backend, luật game hoặc ví điểm. Các trò tương tự được báo lại để người dùng quyết định có gộp/đổi tên sau này.

## Kiểm tra bản sửa

- 13 test web đạt, gồm hàng đợi xác nhận, hủy, lựa chọn phụ, bấm trùng và click cũ không chấp thuận popup kế tiếp; kiểm tra hướng dẫn đủ cho mọi thẻ ở vi/en.
- Typecheck/lint web và mobile, khóa dịch hai nền tảng đạt; 107 test mobile đạt.
- Build web và export Expo Android/iOS đạt.
- Chrome headless: xác nhận/hủy, focus trap/restore, Escape, 14 hướng dẫn và toast lỗi đạt; kiểm tra không tràn ngang ở 320px/390px, xem bản tối. Ảnh minh họa lưu trong `tmp/popup-confirm.png`, `tmp/game-guide.png`, `tmp/game-guide-dark.png`.
- Chưa xác minh modal và Back/cử chỉ bằng thao tác trên Android/iPhone thật. Không gọi API mua/xóa dữ liệu thật trong kiểm tra popup.

## Kanji Study follow-up

Kanji Arena has been removed from the hub. Study cards and quick quizzes now live in the Kanji practice Study tab. `/games/kanji` redirects to `/kanji?mode=study`. See [repair report](KANJI_STUDY_AUDIO_REPAIR.md).
