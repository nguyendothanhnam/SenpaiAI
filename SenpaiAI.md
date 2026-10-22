# SenpaiAI

SenpaiAI version 1.3 là ứng dụng web hỗ trợ người Việt học tiếng Nhật. Dự án kết hợp trợ lý AI, học liệu Library, các buổi luyện có lưu tiến độ, nhận dạng kanji, bài nghe và các công cụ duy trì thói quen học.

## Tính năng

- **Tài khoản và hồ sơ:** đăng ký, đăng nhập bằng JWT, cập nhật hồ sơ, chọn cấp độ JLPT và theo dõi hoạt động học.
- **Chat AI:** hỏi đáp tiếng Nhật theo ngữ cảnh tài liệu; lịch sử hội thoại được lưu theo tài khoản.
- **Phân tích và dịch:** phân tích ngữ pháp, dịch Nhật–Việt/Việt–Nhật và dự đoán cấp độ JLPT.
- **Thư viện:** duyệt, tìm kiếm, thêm, sửa và xóa tài liệu; nhập nội dung từ URL; xem danh mục và thống kê. Tài liệu hệ thống và tài liệu cá nhân có phạm vi truy cập riêng; nội dung được lập chỉ mục trong ChromaDB để hỗ trợ tìm kiếm ngữ nghĩa và RAG.
- **Luyện tập:** quiz thủ công hoặc nhập từ tệp, flashcard, trò chơi từ vựng/kanji, bài luyện ngữ pháp theo phiên và thử thách hằng ngày. Có thể sinh câu hỏi ngữ pháp từ tài liệu Library, lưu vào ngân hàng rồi bắt đầu luyện trực tiếp các câu vừa tạo.
- **Kanji:** tra từ điển JLPT N5/N4/N3, xem thứ tự nét và metadata KanjiVG, luyện quiz/ghép cặp, gửi hiệu chỉnh nhận dạng. CNN PyTorch đọc lớp từ `label_map.json`; pipeline huấn luyện model ứng viên mở rộng tới 612 chữ N5/N4/N3 trong thư mục riêng.
- **Nghe và nói:** tạo/chỉnh sửa bài nghe từ tài liệu Library, phát audio tiếng Nhật tổng hợp bằng VoiceVox, hiển thị lời thoại theo đoạn; ghi âm/nhận dạng lời nói bằng Whisper.
- **Duy trì thói quen:** nhiệm vụ hằng ngày, chuỗi ngày học, điểm thưởng, cửa hàng giao diện, nhắc học và thông báo đẩy tùy cấu hình.

## Công nghệ và dịch vụ

| Phần | Công nghệ |
|---|---|
| Giao diện | React 18, TypeScript/JavaScript, Vite, Tailwind CSS, React Router, React Query |
| API và dữ liệu | Python 3, FastAPI, Pydantic 2, SQLAlchemy 2, Alembic |
| Cơ sở dữ liệu | PostgreSQL 15; ChromaDB cho vector tìm kiếm cục bộ |
| Tìm kiếm/RAG | ChromaDB, LangChain text splitters, embeddings theo cấu hình backend |
| AI hội thoại | Ollama mặc định trong Docker Compose; backend cũng có cấu hình OpenAI |
| Âm thanh | faster-whisper cho nhận dạng giọng nói; VoiceVox Engine cho tổng hợp tiếng Nhật và audio bài nghe |
| Nhận dạng kanji | PyTorch, NumPy, Pillow; fonttools kiểm tra font và sinh ảnh kanji trong `backend/ml/` |
| Chạy dịch vụ | Docker Compose hoặc chạy frontend/backend riêng |

## Cấu trúc thư mục

- `frontend/src/`: trang, component, dịch vụ API và giao diện React.
- `backend/app/api/`: các router xác thực, chat, thư viện, luyện tập, kanji, nghe, thông báo và phần thưởng.
- `backend/app/services/`: logic nghiệp vụ, LLM, vector DB, học liệu, âm thanh và nhận dạng kanji.
- `backend/app/models/`: model và schema SQLAlchemy/Pydantic.
- `backend/alembic/`: migration cơ sở dữ liệu.
- `backend/scripts/`: seed, nhập và kiểm tra dữ liệu.
- `backend/app/data/`: từ điển kanji và dữ liệu nét viết.
- `backend/ml/`: sinh ảnh huấn luyện, hợp nhất dữ liệu, huấn luyện và đánh giá CNN kanji; hướng dẫn đầy đủ ở `backend/ml/README.md`.
- `database/`: khởi tạo PostgreSQL.
- `docs/`: tài liệu dự án và tài liệu cần rà soát.
- `docker-compose.yml`: cấu hình PostgreSQL, backend, frontend, Ollama và VoiceVox.

Các router được đăng ký tại `backend/app/main.py`; một số API có cả đường dẫn gốc và tiền tố `/api` để tương thích với client hiện tại. Danh sách endpoint đầy đủ có tại `/docs` khi backend đang chạy.

## Chạy bằng Docker Compose

Cần cài Docker Desktop hoặc Docker Engine kèm Docker Compose. Từ thư mục gốc dự án:

```bash
docker compose up --build
```

Các địa chỉ mặc định:

- Giao diện: `http://localhost:3000`
- API: `http://localhost:8000`
- Tài liệu API: `http://localhost:8000/docs`
- Ollama: `http://localhost:11434`

Compose khởi chạy PostgreSQL, Ollama, VoiceVox, backend và frontend. Backend tự chạy Alembic và nạp dữ liệu mẫu theo lệnh khai báo trong `docker-compose.yml`. Lần đầu chạy có thể mất thời gian để tải model Ollama và Whisper. Có thể cấu hình model, khóa API, Web Push và âm thanh bằng biến môi trường trong Compose hoặc file môi trường tương ứng; không dùng khóa mặc định cho môi trường triển khai thật.

## Chạy riêng khi phát triển

1. Khởi động PostgreSQL và Ollama (nếu dùng AI local); VoiceVox là dịch vụ tùy chọn cho phát âm.
2. Cài dependency backend trong môi trường Python:

   ```bash
   cd backend
   python -m venv .venv
   # Windows PowerShell: .venv\Scripts\Activate.ps1
   # Linux/macOS: source .venv/bin/activate
   pip install -r requirements.txt
   alembic upgrade head
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

3. Trong terminal khác, cài và chạy frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

Backend đọc cấu hình qua `backend/app/core/config.py` và file `.env` trong thư mục backend. Các thiết lập chính gồm `DATABASE_URL`, `SECRET_KEY`, `LLM_PROVIDER`, `OPENAI_API_KEY`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `CHROMA_PERSIST_DIRECTORY`, `ALLOWED_ORIGINS`, `REMINDERS_ENABLED`, thông tin VAPID, Whisper và VoiceVox. Frontend nhận URL backend qua `VITE_API_BASE_URL`.

## Thư viện và dữ liệu học liệu

Thư viện lưu tài liệu trong PostgreSQL và lập chỉ mục nội dung trong ChromaDB. Tài liệu hệ thống có thể đọc dùng chung; tài liệu cá nhân chỉ chủ sở hữu được đọc/sửa/xóa. Kết quả tìm kiếm, chat RAG, danh mục và thống kê phải giữ đúng phạm vi truy cập. Nhập URL chỉ chấp nhận HTTP/HTTPS và có kiểm soát tải nội dung. Dữ liệu mẫu ở `backend/scripts/data/library_documents.json`; script nạp là `backend/scripts/seed_library_documents.py`.

Tài liệu là nội dung tham khảo, không phải một buổi luyện. Tạo câu hỏi ngữ pháp từ Library sẽ sinh câu hỏi có nhãn cấp độ/dạng bài, lưu các câu hợp lệ vào ngân hàng và trả về ID của chúng. Người học có thể bắt đầu luyện trực tiếp các câu vừa tạo; một buổi luyện lưu câu trả lời, phản hồi, điểm và danh sách câu sai riêng với tài liệu nguồn. Hệ thống cũng hỗ trợ sinh bài nghe từ tài liệu, chỉnh sửa lời thoại rồi lưu thành bài nghe.

## Kanji: nhận dạng và huấn luyện model

Từ điển cục bộ gồm 612 chữ N5/N4/N3; thứ tự nét lấy từ dữ liệu KanjiVG kèm nguồn và giấy phép. Recognizer nạp model cùng `label_map.json`; số lớp và cấp JLPT hiển thị được suy ra từ label map. Model đang dùng trong `backend/ml/models/` được giữ tách biệt với model ứng viên. Không thay model đang chạy chỉ dựa trên độ chính xác validation tổng hợp.

Quy trình huấn luyện ứng viên được mô tả tại [`backend/ml/README.md`](backend/ml/README.md): sinh ảnh từ các font tiếng Nhật đã kiểm tra glyph, ghép thêm ETL10 và mẫu người dùng đã hiệu chỉnh nếu có, cân bằng lớp, theo dõi validation N5/N4/N3, lưu checkpoint có thể resume và đánh giá top-1/top-5 trên bộ chữ viết tay held-out. Mọi artifact ứng viên được lưu trong thư mục riêng như `backend/ml/models/n3_candidate/`. Sau khi đạt tiêu chí chất lượng, cần sao lưu đồng thời model và label map trước khi thay thủ công; hướng dẫn khôi phục cũng nằm trong README huấn luyện.

## Nghe và cấu hình dịch vụ AI

VoiceVox được dùng để tổng hợp audio bài nghe khi bài học chưa có file audio. Trong Docker Compose, backend kết nối dịch vụ nội bộ `http://voicevox:50021`; khi chạy backend trực tiếp trên máy, cấu hình `VOICEVOX_URL` phải trỏ tới địa chỉ VOICEVOX mà máy đó truy cập được. Lỗi kết nối hoặc tổng hợp được trả về ở API audio và không đồng nghĩa với lỗi font hiển thị nội dung tiếng Nhật. Whisper/faster-whisper phục vụ nhận dạng tiếng nói và có thể cần tải model ở lần chạy đầu.

## Ghi chú cấu hình

- PostgreSQL là bắt buộc cho backend. URL mặc định và thông tin trong Compose phục vụ phát triển cục bộ; hãy thay bằng thông tin an toàn khi triển khai.
- Ollama là provider mặc định. Nếu chọn OpenAI, cần cung cấp `OPENAI_API_KEY`.
- Whisper có thể tải model lớn khi khởi tạo lần đầu; `WHISPER_MODEL_SIZE`, `WHISPER_DEVICE` và `WHISPER_MODEL_DIR` điều khiển cấu hình này.
- Nhắc học chạy trong backend khi `REMINDERS_ENABLED` bật. Thông báo đẩy cần cấu hình cặp khóa VAPID.
- `backend/app/main.py` tạo các bảng SQLAlchemy khi khởi động; thay đổi schema đã có cần được quản lý bằng migration Alembic.
