# SenpaiAI

## Tổng quan

SenpaiAI là ứng dụng hỗ trợ người Việt học tiếng Nhật. Dự án gồm giao diện web, API backend, cơ sở dữ liệu quan hệ và các dịch vụ AI/tra cứu để hỗ trợ học tập, luyện tập và quản lý tài liệu.

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
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router, Axios |
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
