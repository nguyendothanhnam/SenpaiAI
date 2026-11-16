# Danh sách màn hình và chức năng

| Nhóm | Route | Chức năng đã có |
| --- | --- | --- |
| Xác thực | `(auth)/login` | Email/mật khẩu, kiểm tra nhập, hiện/ẩn mật khẩu, vi/en, bố cục theo web |
| Xác thực | `(auth)/register` | Email, username, mật khẩu/xác nhận, tránh đăng ký lại nếu bước tự đăng nhập lỗi |
| Hằng ngày | `(tabs)/daily` | Ngày server, điểm, chuỗi, tiến độ, lịch, bắt đầu/tiếp tục, đếm ngược |
| Hằng ngày | `daily-exercise` | Từng câu, sáu nhóm điều khiển, feedback, tiếp tục từ server, hoàn thành và thưởng |
| Thư viện | `(tabs)/library` | Tìm kiếm, lọc, thống kê, tải thêm, kéo làm mới |
| Thư viện | `library-document/[id]` | Nội dung chọn/copy, metadata, nguồn; quyền sửa/xóa phải do API xác nhận |
| Thư viện | `library-editor` | Thêm/sửa khi được cấp quyền, preview URL, kiểm tra nhập, bảo vệ dữ liệu chưa lưu |
| Luyện tập | `(tabs)/practice` | Chỉ hiện Ngữ pháp và Kanji đã triển khai; không hiện menu Trò chơi |
| Ngữ pháp | `grammar` | Phân tích và thiết lập/làm bài/kết quả; fallback ngân hàng, giữ phiên khi lỗi AI |
| Ngữ pháp | `grammar-progress` | Độ chính xác theo cấp, mẫu yếu, hoạt động gần đây |
| Kanji | `kanji` | Chọn cấp có dữ liệu, tìm chữ/nghĩa/âm đọc, phân trang, chữ lớn/nghĩa Việt/số nét |
| Kanji | `kanji/[character]` | Nghĩa, On/Kun, ví dụ, thứ tự nét vector, phát lại và 0.5×/1×/2× |
| Kanji | `kanji-quiz` | Ba dạng: chọn nghĩa, đọc, chữ; số câu/cấp; kết quả tự luyện tại máy |
| Trò chuyện | `(tabs)/chat` | Tìm tiêu đề/nội dung, ghim, thư mục, nhóm thời gian, tải thêm, nhấn giữ thao tác |
| Trò chuyện | `conversation/[id]` | Tin đảo chiều, tin cũ, gửi/chờ AI, rename, thẻ phân tích/nguồn, chống gửi lặp mù quáng |
| Trò chuyện | `chat-folders` | Tạo/đổi tên; xóa giữ hội thoại hoặc xóa kèm xác nhận bổ sung |
| Cá nhân | `(tabs)/personal` | Thông tin, sửa username/cấp hiện tại/mục tiêu JLPT/mục tiêu học, điểm/chuỗi/lịch 30 ngày |
| Cài đặt | `(tabs)/personal/settings` | Ngôn ngữ đồng bộ server, sáng/tối/hệ thống, phiên bản, ghi công, xuất/reset/xóa, đăng xuất |
| Giao diện | `theme-shop` | Toàn bộ theme/nền từ server, giá/số dư/sở hữu/đang dùng; preview sáng/tối; xác nhận mua và áp dụng; đồng bộ tài khoản; nền WebP đóng gói |
| Dữ liệu | `export-data` | JSON server, danh sách phần có thể chọn/copy, chia sẻ qua menu hệ điều hành |
| Hệ thống | Boundary, guard, `+not-found` | Lỗi chung, thử lại, trang không tồn tại, mạng, loading/skeleton và hết hạn phiên |

## Phân biệt chức năng và giới hạn

- Quiz Kanji không vẽ tay, không nhận dạng và không lưu điểm vì API hiện chỉ cấp câu/đáp án. Điểm tài khoản ở Hồ sơ vẫn là điểm server.
- Các nhãn điều khiển có vi/en. Nghĩa Kanji, ví dụ và giải thích ngữ pháp từ dữ liệu chỉ có tiếng Việt được giữ nguyên, có lời giải thích trong giao diện.
- Export dùng Share cho văn bản JSON và chọn/copy; chưa ghi `.json` vào Downloads tự động.
- Reset xóa chat/voice/phiên ngữ pháp, nhưng giữ folders, rewards, daily tasks và study stats theo phản hồi backend. Xóa tài khoản không được hứa xóa tài liệu Thư viện chưa có owner metadata.
- Trò chơi ghép cặp là hạng mục tùy thời gian: chưa triển khai và không có mục menu.
- Bản đồ màn hình phản ánh code hiện tại; checklist thiết bị thật còn cần người dùng thực hiện trên Android/iPhone.
