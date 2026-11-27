# Kiểm tra trích xuất thư viện

Trước khi sửa, bản xem trước không giới hạn chiều cao và nội dung dài làm hộp giãn;
văn bản HTML bị gộp thành một dòng, tệp dài bị cắt im lặng, file Word lỗi có thể
bị giải mã thành nội dung rác. Đọc URL dùng requests trực tiếp và không xác nhận
địa chỉ IP đích. Trước đó backend venv thiếu cả pypdf và python-docx.

Mẫu thử tại `backend/tests/data/library_extract`: `text.pdf`, PDF không có lớp chữ
`scanned-no-text.pdf` (trang trắng mô phỏng không có lớp chữ, chưa chứa ảnh scan),
`sample.docx`, `utf8.txt`, `shift_jis.txt`, `long.txt`, `article.html`, `urls.txt`.
Đã trực tiếp gọi hàm với các file: PDF có chữ đọc được; PDF không có chữ báo
`library_pdf_scanned`; DOCX, UTF-8, Shift-JIS đọc được chữ Nhật; file dài báo
`library_content_too_long`. HTML loại nav/aside/footer. URL 127.0.0.1 bị chặn;
example.org và httpstat.us không truy cập được từ môi trường chạy, nên chưa xác nhận
tải trang Internet và trường hợp 403 thật. Test tự động kiểm tra thêm nội dung HTML,
tiếng Việt, mã hóa không hợp lệ, và địa chỉ nội bộ giả lập.

Giới hạn: 10 MiB tệp, 2 MiB trang, 50.000 ký tự. URL kết nối đến IP đã kiểm tra,
kiểm tra lại sau redirect, giới hạn 3 redirect và thời gian kết nối/đọc. Độ phân giải
DNS hệ điều hành chưa có timeout độc lập. Nội dung vượt giới hạn được từ chối rõ ràng.
PDF chỉ có ảnh cần OCR bên ngoài. DOC nhị phân cũ cần lưu lại thành DOCX.

Ước tính ngôn ngữ dựa trên chữ Nhật và chữ Latin; chữ Latin có thể là tiếng Anh,
tiếng Việt không dấu hoặc ngôn ngữ khác. Gợi ý loại và JLPT chỉ là tham khảo.
Chưa kiểm thử trực quan trên trình duyệt, màn hình nhỏ hoặc thiết bị Android/iOS;
chưa thử PDF scan ảnh thật hay trang web quảng cáo/chặn thật.
