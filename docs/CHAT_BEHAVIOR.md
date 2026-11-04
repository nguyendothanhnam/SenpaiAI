# Trò chuyện văn bản và ngôn ngữ trả lời

Ứng dụng tiếp tục dùng Ollama với model cấu hình trong `OLLAMA_MODEL` (hiện là `gemma:2b`).

- Chat chỉ tạo hội thoại văn bản. API tạo hội thoại giọng nói không còn được đăng ký; dữ liệu hội thoại cũ được giữ trong cơ sở dữ liệu.
- Ngôn ngữ của câu hỏi hiện tại được ưu tiên. Hỏi bằng tiếng Việt thì giải thích bằng tiếng Việt; hỏi bằng tiếng Anh thì giải thích bằng tiếng Anh. Khi chỉ nhập tiếng Nhật, ứng dụng dùng ngôn ngữ giao diện làm lựa chọn mặc định.
- Câu yêu cầu dịch vẫn được dịch sang ngôn ngữ được chỉ định. Nếu nội dung đã ở đúng ngôn ngữ đích, Chat thông báo điều đó và hỏi ngôn ngữ người học thực sự muốn dịch sang.
- Lịch sử chỉ được gửi khi câu hỏi có tham chiếu tới nội dung trước. Các yêu cầu hỏi nghĩa hoặc dịch câu không lấy các trang Library chỉ giống nhau về điểm tìm kiếm làm nguồn.
- Các ví dụ ngữ pháp đã đối chiếu có bản tiếng Việt và tiếng Anh. Khi model giải thích sai các ví dụ này, ứng dụng dùng nội dung đã đối chiếu kèm nguồn.
- Phản hồi sai ngôn ngữ được thử tạo lại một lần. Nếu vẫn thất bại hoặc Ollama không kết nối được, API trả lỗi để người dùng gửi lại; không lưu thông báo lỗi thành câu trả lời trong lịch sử.

`gemma:2b` vẫn có thể trả lời chưa chính xác với nội dung ngoài phạm vi tài liệu đã kiểm chứng. Các kiểm tra này giảm lỗi định tuyến, ngôn ngữ và nguồn tham khảo; không phải hệ thống xác minh mọi kiến thức do model sinh ra.

## Kiểm tra

Chạy từ thư mục `backend`:

```powershell
.\venv\Scripts\python.exe -m pytest tests/test_chat_language.py tests/test_chat_grounding.py tests/test_chat_conversations.py -q
```

Chạy từ thư mục `frontend`:

```powershell
node tests/apiClient.test.mjs
npm.cmd run i18n:check
npm.cmd run build
```

Màu nền, chữ, viền, menu, ô nhập và nút dùng các biến trong `ThemeProvider` và `themes.ts`. Màu báo đúng/sai, cảnh báo và nền trắng của vùng viết Kanji được giữ theo chức năng.
