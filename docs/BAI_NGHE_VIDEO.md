# Bài nghe từ đường dẫn video

Bài nghe video dùng URL YouTube hợp lệ và trình phát nhúng chính thức qua [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference). Máy chủ không tải video hoặc âm thanh, không trích xuất phụ đề từ dịch vụ video và không cài công cụ tải video. Chỉ phụ đề do người dùng tự cung cấp mới được gửi lên và lưu. Người tạo cần có quyền sử dụng phụ đề và tôn trọng quyền tác giả, điều khoản của nhà cung cấp.

Hệ thống chỉ chấp nhận URL HTTPS thuộc các tên miền YouTube được cho phép và chuẩn hóa mã video; không truy cập URL do người dùng cung cấp. Việc một video thực sự cho phép nhúng do YouTube và chủ video quyết định khi phát, nên URL hợp lệ vẫn có thể không phát được. Tiêu đề do người dùng nhập; không yêu cầu API lấy metadata. Các chính sách, tính khả dụng và tốc độ phát do YouTube quyết định.

Người dùng dán phụ đề có mốc thời gian hoặc chọn tệp SRT/VTT mã hóa UTF-8; xem trước, sửa nội dung và mốc thời gian, gộp hoặc tách câu trước khi lưu. Giới hạn là 1 MiB, 50 câu, 1.000 ký tự mỗi nội dung câu hoặc bản dịch, mốc thời gian tối đa 12 giờ, các khoảng phải theo thứ tự và không giao nhau. Bản dịch tiếng Việt do người dùng nhập; hệ thống không tự tạo bản dịch. Furigana sử dụng cơ chế hiện có, có thể không có khi bộ phân tích không khả dụng.

Bài được gắn với tài khoản tạo và chỉ tài khoản đó có quyền xem, luyện tập. Màn hình phát dùng IFrame API để điều khiển và theo dõi thời gian; tốc độ tùy thuộc các mức trình phát hỗ trợ. Bài chép chính tả và điền chỗ trống dùng cơ chế sinh câu hỏi và chấm trên máy chủ của bài nghe hiện có. Một số loại bài khác có thể không khả dụng nếu phụ đề thiếu dữ liệu phù hợp.

Migration `0028_listening_video` bổ sung các cột nguồn tùy chọn, không thay đổi bài nghe cũ. Migration kiểm tra cột trước khi thêm và không cho hạ phiên bản nếu còn bài video, để tránh mất metadata. Triển khai cần chạy migration trước khi chạy mã mới.
