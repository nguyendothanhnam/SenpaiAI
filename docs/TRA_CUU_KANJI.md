# Tra cứu kanji trong văn bản

`shared-games/kanjiText.ts` chia chuỗi theo code point Unicode, giữ nguyên thứ tự,
khoảng trắng, xuống dòng và ký tự ngoài BMP; gom các đoạn không phải Hán tự.
Web dùng `KanjiText` và hộp ghi chú sẵn có; mobile dùng `KanjiText` cùng bảng
trượt `KanjiLookupProvider`. Mỗi chữ có nhãn tra cứu, web hỗ trợ Enter/Space;
đóng hộp bằng nút đóng, Escape trên web, nút back trên Android hoặc chạm nền.
Dữ liệu từ từ điển và ghi chú dùng React Query, thời gian cache tươi một giờ;
không gọi API theo số chữ trước khi người dùng chọn.

Đã gắn `KanjiText` trực tiếp:

- Web: nội dung trả lời chat, nội dung chi tiết tài liệu, phụ đề tiếng Nhật
  (kể cả chữ gốc bên trong ruby/furigana), danh sách thẻ cloud, một số phần
  giải thích sau chấm và kết quả phân tích ngữ pháp.
- Mobile: nội dung trả lời chat, chi tiết tài liệu, prompt/nhận định trong
  câu hỏi chung, một số phần giải thích sau chấm và kết quả phân tích ngữ pháp.

Web còn có cơ chế nhấp chuột theo vị trí ký tự ở các trang đã bật scope; cơ chế
đó không thay thế được điều hướng bàn phím trong các vị trí chưa gắn `KanjiText`.
Không bắt sự kiện trên input, textarea, liên kết và nút có sẵn; khi đang chọn
văn bản, tra cứu web không tự mở. Phụ đề vẫn có nút nghe từng câu riêng.

Chưa hoàn thành toàn bộ phạm vi: các lựa chọn nằm trong nút trả lời, một số câu
hỏi/giải thích cũ, mặt thẻ lật và màn chơi flashcard trên hai nền tảng chưa được
gắn trực tiếp; ứng dụng mobile chưa có màn phụ đề nghe tương ứng được nối vào
thành phần này. Chưa có nút thêm vào bộ thẻ trong bảng; luồng tạo/sửa bộ thẻ
cần chọn bộ và xử lý thẻ trùng mà không ghi đè bản nháp. Chưa kiểm thử thủ công
trên trình duyệt, Android hoặc iPhone; hành vi chọn/sao chép và cuộn có chữ bấm
cần được kiểm chứng trên từng nền tảng. Bảng web vẫn là hộp ghi chú hiện có,
không phải popover neo theo chữ.
