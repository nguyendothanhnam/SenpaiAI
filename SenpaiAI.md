# SenpaiAI

## Tổng quan

SenpaiAI version 1.3 là ứng dụng hỗ trợ người Việt học tiếng Nhật. Dự án gồm giao diện web, API backend, cơ sở dữ liệu quan hệ và các dịch vụ AI/tra cứu để hỗ trợ học tập, luyện tập và quản lý tài liệu.

## Chức năng hiện có

- **Tài khoản người dùng:** đăng ký, đăng nhập bằng JWT; xem/cập nhật hồ sơ; xuất dữ liệu, đặt lại tiến độ và xóa tài khoản.
- **Trò chuyện học tiếng Nhật:** hỏi đáp với trợ lý, lưu/tìm kiếm/xóa lịch sử hội thoại; có xử lý một số truy vấn từ điển và trắc nghiệm từ vựng.
- **Phân tích ngôn ngữ:** phân tích ngữ pháp, dịch Nhật–Việt và Việt–Nhật, dự đoán cấp độ JLPT.
- **Thư viện học liệu:** tạo, sửa, xóa và tìm kiếm tài liệu; lấy nội dung từ URL; xem danh mục, thống kê và câu hỏi liên quan đến tài liệu.
- **Luyện tập:** quiz trắc nghiệm và flashcard; tạo bộ câu hỏi/thẻ thủ công hoặc nhập từ tệp Excel.
- **Kanji và từ vựng:** tra cứu danh sách/chi tiết, luyện quiz và ghép cặp; xem thứ tự nét, metadata, mẫu viết tay và nhận dạng kanji từ nét vẽ; có API lưu hiệu chỉnh nhận dạng.
- **Theo dõi học tập:** giao diện hồ sơ và phân tích tiến độ.

Các trang giao diện được khai báo trong `frontend/src/App.tsx`; API tương ứng nằm trong `backend/app/api/`. Một số tính năng AI phụ thuộc cấu hình model và dữ liệu sẵn có.

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router, Axios, React Query v3 |
| Backend/API | Python, FastAPI, Pydantic, Uvicorn |
| Cơ sở dữ liệu quan hệ | PostgreSQL, SQLAlchemy, Alembic |
| Tìm kiếm ngữ nghĩa/RAG | ChromaDB, LangChain text splitters |
| Mô hình ngôn ngữ | Ollama (mặc định trong Docker Compose); cấu hình có hỗ trợ OpenAI |
| Nhận dạng chữ viết | PyTorch và các dịch vụ xử lý kanji trong backend |
| Xử lý dữ liệu | NumPy, Pandas, Pillow |
| Đóng gói/chạy dịch vụ | Docker Compose; có script chạy trên Windows và Linux/macOS |

## Cấu trúc chính

- `frontend/`: ứng dụng React và các trang học tập.
- `backend/app/api/`: các endpoint xác thực, chat, phân tích, thư viện, trò chơi và kanji.
- `backend/app/services/`: xử lý nghiệp vụ, LLM, vector DB, ngữ pháp, thư viện và nhận dạng kanji.
- `backend/app/core/`: cấu hình, kết nối cơ sở dữ liệu và xác thực.
- `backend/alembic/`: migration cơ sở dữ liệu.
- `database/`: script khởi tạo dữ liệu/schema.
- `docker-compose.yml`: cấu hình chạy frontend, backend, PostgreSQL và Ollama.

## Khởi chạy

Dự án có thể chạy bằng Docker Compose hoặc chạy frontend/backend riêng. Cấu hình dịch vụ và biến môi trường được mô tả trong `README.md`, `OLLAMA_GUIDE.md`, `backend/env.example` và các file cấu hình frontend. Khi dùng Ollama, cần có Ollama/model phù hợp; khi dùng PostgreSQL cần khởi động database trước backend.

## Thư viện học liệu: quyền sở hữu và RAG (version 1.3)

### Mô hình quyền sở hữu

- Tài liệu dùng chung thuộc thư viện hệ thống và có `documents.owner_id = NULL`. Tài liệu do người dùng thêm có `owner_id` bằng ID của người đó.
- Người dùng đã đăng nhập được đọc tài liệu hệ thống và tài liệu của chính mình. Họ chỉ được sửa hoặc xóa tài liệu cá nhân của mình.
- Chỉ quản trị viên thư viện được tạo, sửa hoặc xóa tài liệu hệ thống. Danh sách quản trị viên lấy từ `LIBRARY_ADMIN_EMAILS` (email phân tách bằng dấu phẩy, mặc định rỗng) qua hàm `is_library_admin(user)`, trừ khi model `User` đã có cờ admin phù hợp.
- Tài liệu cá nhân của người khác phải được che giấu như không tồn tại: trả 404 khi đọc, sửa hoặc xóa. Thao tác sửa/xóa tài liệu hệ thống bởi người không phải quản trị viên trả 403.

### Cô lập tìm kiếm và dữ liệu

- Mọi truy vấn ChromaDB/RAG phải giới hạn phạm vi tài liệu. Truy vấn mặc định khi không truyền người dùng chỉ được phép trả tài liệu hệ thống.
- ChromaDB không nhận metadata `null`, nên metadata vector dùng `owner_id = 0` cho tài liệu hệ thống và ID số nguyên cho tài liệu cá nhân. Bộ lọc người dùng gồm tài liệu hệ thống và tài liệu của họ; các điều kiện lọc hiện có (bao gồm JLPT) phải được kết hợp thay vì ghi đè.
- Quyền sở hữu phải được áp dụng cho cả ngữ cảnh gửi vào LLM và danh sách nguồn trích dẫn trong chat, cũng như tìm kiếm ngữ nghĩa, tìm kiếm từ khóa và bước hợp nhất kết quả.
- Danh sách, chi tiết, danh mục và thống kê thư viện chỉ phản ánh những tài liệu người dùng được phép thấy. API danh sách có `scope=all|mine|system` (mặc định `all`); schema tài liệu có `scope` (`system|personal`) và `is_mine` tùy chọn.
- Quiz và ghép cặp từ vựng vẫn dùng tài liệu hệ thống khi không có người dùng đăng nhập; nếu có người dùng thì có thể bổ sung tài liệu cá nhân của họ. Không làm thay đổi hành vi minigame hiện có.
- Nếu có endpoint trạng thái cá nhân như yêu thích, bộ sưu tập hoặc đọc gần đây, endpoint đó cũng phải kiểm tra quyền xem tài liệu và chỉ liệt kê tài liệu người dùng được thấy.

### Hạn mức và URL bên ngoài

- Cấu hình `LIBRARY_MAX_DOCS_PER_USER` mặc định 200 và `LIBRARY_MAX_CONTENT_CHARS` mặc định 100000; kiểm tra khi xác thực payload và khi tạo tài liệu. Hạn mức bị vượt trả 413 hoặc 400 với thông báo rõ ràng.
- Lấy nội dung URL chỉ chấp nhận HTTP/HTTPS và nội dung văn bản/HTML. Phân giải DNS và chặn địa chỉ loopback, riêng tư, link-local, multicast (IPv4/IPv6); kiểm tra lại mỗi lần chuyển hướng (tối đa 3), đặt timeout và giới hạn tải xuống (ví dụ 2 MB) để giảm nguy cơ SSRF.

### Tài khoản và đồng bộ vector

- Khi xóa tài khoản, xóa vector của các tài liệu cá nhân trước khi xóa bản ghi người dùng. Nếu xóa vector lỗi thì ghi log và vẫn tiếp tục xóa tài khoản; khóa ngoại tài liệu dùng `ON DELETE CASCADE`.
- Xuất dữ liệu tài khoản phải bao gồm danh sách tài liệu cá nhân. Đặt lại tiến độ học tập không xóa tài liệu.
- Script `backend/scripts/reindex_library_owner.py` đồng bộ metadata `owner_id` của vector từ cơ sở dữ liệu; tùy chọn `--prune-orphans` xóa vector không còn tài liệu tương ứng. Script cần chạy sau migration để lập chỉ mục các vector cũ.

### Phạm vi triển khai

Phần A là backend: migration/model, lọc quyền trong ChromaDB và API thư viện/chat, hạn mức, bảo vệ URL, xử lý xóa/xuất tài khoản, script reindex và kiểm thử ownership. Dữ liệu cũ có `owner_id = NULL` tiếp tục là tài liệu hệ thống. Migration phải là revision kế tiếp và an toàn khi cột đã tồn tại; giữ nguyên đăng ký router/API router hiện có.

Phần B là frontend: bộ lọc phạm vi thư viện, huy hiệu hệ thống/cá nhân, ẩn thao tác không được phép dựa trên quyền do API trả về, form tạo tài liệu cá nhân mặc định và thông báo hạn mức. Nếu dùng react-i18next thì cập nhật cả tiếng Việt và tiếng Anh, đồng thời chạy `npm run i18n:check`.

### Kiểm tra nghiệp vụ

- Người dùng A không thể xem, sửa hoặc xóa tài liệu cá nhân của B; API trả 404. Cả hai vẫn xem được tài liệu hệ thống; người không phải quản trị viên không thể sửa/xóa tài liệu đó.
- Tìm kiếm, danh mục, thống kê và kết quả RAG/chat không làm lộ tài liệu ngoài phạm vi. Xóa tài khoản A sẽ xóa vector tài liệu A; đặt lại tiến độ không xóa tài liệu.
- Kiểm tra lọc quyền ChromaDB, xóa dây chuyền trong cơ sở dữ liệu, hạn mức nội dung/số tài liệu và chặn URL nội bộ như `localhost`, `127.0.0.1`, `169.254.169.254` bằng kiểm thử DNS giả lập, không gọi mạng thật.
