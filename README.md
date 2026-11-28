# SenpaiAI - Japanese Learning Assistant

## 🎌 Giới thiệu

SenpaiAI là một nền tảng học tiếng Nhật toàn diện được hỗ trợ bởi công nghệ LLM + RAG, với các tính năng tương tác hỏi đáp, phân tích ngữ pháp, dự đoán trình độ JLPT và khả năng dịch thuật.

## 🏗️ Kiến trúc hệ thống

- **Frontend**: React + Vite + TypeScript + TailwindCSS
- **Backend**: Python FastAPI + LangChain (LLM + RAG)
- **Database**: PostgreSQL (users, history, lessons, documents)
- **Vector DB**: ChromaDB (local)
- **Deployment**: Docker Compose

## 🚀 Hướng dẫn chạy nhanh

### Thành viên mới — nhánh develop

Quy trình dữ liệu có thể chạy lại; không cần nhận bản sao CSDL hay `.env` từ máy thành viên khác. **Dùng CSDL riêng cho develop**, không trỏ vào DB đang dùng trên nhánh `mobile`: hai nhánh có migration khác nhau. Bảng kiểm kê, giới hạn dữ liệu và kết quả chạy thử: [Thiết lập dữ liệu](docs/THIET_LAP_DU_LIEU.md).

1. Clone đúng nhánh và tạo môi trường (Windows PowerShell; Python 3.11, PostgreSQL có quyền tạo `pg_trgm`; Node theo `mobile/package.json`):

```powershell
git clone --branch develop <URL_KHO_SENPAIAI> SenpaiAI
cd SenpaiAI
python -m venv backend/venv
.\backend\venv\Scripts\python.exe -m pip install -r backend/requirements.txt
if (-not (Test-Path backend/.env)) { Copy-Item backend/env.example backend/.env }
if (-not (Test-Path frontend/.env)) { Copy-Item frontend/env.example frontend/.env }
if (-not (Test-Path mobile/.env)) { Copy-Item mobile/.env.example mobile/.env }
```

Sửa **tệp cục bộ** `backend/.env`: `DATABASE_URL` tới DB develop mới/rỗng (ví dụ tên `senpai_develop_dev`, tạo trước bằng PostgreSQL/pgAdmin), `SECRET_KEY` riêng, endpoint Ollama/VOICEVOX nếu dùng. Mật khẩu phải khớp PostgreSQL thực tế; không dựa vào mặc định cũ trong lớp Settings. Không commit bí mật. Không xóa DB đang dùng hoặc tự `alembic stamp` để vượt lỗi revision.

2. Thiết lập dữ liệu bằng một lệnh, rồi kiểm tra:

```powershell
.\backend\scripts\setup_data.ps1 -Download -External
.\backend\scripts\setup_data.ps1 -CheckOnly
```

Nếu PowerShell chặn script, chỉ bỏ chặn cho lệnh hiện tại: `powershell -NoProfile -ExecutionPolicy Bypass -File backend/scripts/setup_data.ps1 -Download -External`. Python tương đương: từ `backend`, `venv/Scripts/python.exe scripts/setup_data.py --download --external`; kiểm tra bằng `venv/Scripts/python.exe scripts/data_status.py`. `SKIP` phải đọc lý do; mã kiểm tra 2 nghĩa là còn thiếu dữ liệu/tính năng, không phải mọi thứ đã sẵn sàng. Không tải mô hình tự động; không dùng hash embedding hoặc WAV giả để lấp chỗ thiếu.

3. Chạy backend **sau migration/seed**, trong terminal riêng:

```powershell
cd backend
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Thử `http://localhost:8000/health` và `/docs`. Dừng backend trước khi dựng lại nhóm index rồi khởi động lại để nạp index vào bộ nhớ. Startup có cảnh báo thiếu migration/dữ liệu, không tự nạp hoặc chặn ứng dụng.

4. Chạy web và Expo trong hai terminal từ gốc repo:

```powershell
cd frontend
npm ci
npm run dev
```

```powershell
cd mobile
npm ci
npm run start:clean
```

Web dùng URL API trong `frontend/.env`. Với điện thoại thật, đặt `mobile/.env` thành dòng thuần `EXPO_PUBLIC_API_URL=http://<IP_LAN_MAY_BACKEND>:8000/api` (thay IP thật, không dùng cú pháp link Markdown hay `http\://`). Hai thiết bị cùng mạng; backend lắng nghe `0.0.0.0`; thêm IP thật vào `ALLOWED_HOSTS` cục bộ nếu cần. Android giả lập dùng `10.0.2.2`, điện thoại thật không dùng `localhost`. Đổi `.env` Expo thì khởi động lại Metro với cache sạch.

**Docker khác local:** PostgreSQL/index/audio nằm trong volume của từng máy, không đi cùng Git. Có thể tạo project Docker riêng bằng `docker compose -p senpai-develop up -d postgres`, build image backend rồi chạy command được kiểm soát:

```powershell
docker compose -p senpai-develop build backend
docker compose -p senpai-develop run --rm --no-deps -v "${PWD}/shared-games:/shared-games:ro" backend python scripts/setup_data.py --download --external
docker compose -p senpai-develop run --rm --no-deps -v "${PWD}/shared-games:/shared-games:ro" backend python scripts/data_status.py
docker compose -p senpai-develop run --rm --no-deps --service-ports backend uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Compose cấp `DATABASE_URL` trong container; nếu dùng DB tên riêng thì phải override biến này nhất quán cho cả setup/check/backend. Mạng nội bộ dùng hostname `postgres`, `ollama`, `voicevox`, không phải localhost của máy host. Nhóm index/audio chỉ chạy khi các service/mô hình đã có; `--no-deps` không tự kéo chúng. Nếu cổng 5432/8000 đang dùng, chọn cổng/project/override riêng; không xóa volume để chữa xung đột. Lệnh backend mặc định trong Compose cũ tự pull mô hình và chạy `populate_data.py` chưa an toàn chạy lặp, nên quy trình này override command thay vì dùng mù quáng. Quy trình Docker sạch chưa được chạy kiểm chứng trong lượt triển khai này.

**Lỗi thường gặp:** lỗi kết nối DB → kiểm tra dịch vụ, user/mật khẩu và `DATABASE_URL`; thiếu quyền `pg_trgm` → nhờ quản trị cấp quyền extension; revision không khớp → kiểm tra nhánh/DB, không stamp/drop tự động; OpenJLPT cache thiếu → chạy với `-Download`; thiếu model embedding → chuẩn bị `nomic-embed-text` riêng rồi chạy `--groups index --external`; không có audio → bật VOICEVOX rồi chạy nhóm audio; có tài liệu nhưng tìm kiếm trống → kiểm tra index và restart backend; HTTP 400 từ điện thoại → kiểm tra IP/TrustedHost, không phải seed dữ liệu. Develop hiện chưa có placement, thiếu một phần nét N5/N4 và kho từ minigame N5/N4: xem báo cáo, không coi seed thành công là đã đủ mọi nội dung.

### Yêu cầu hệ thống
- Docker & Docker Compose
- Python 3.11+
- Node.js 18+
- **Ollama** (cho LLM miễn phí) hoặc OpenAI API key

### Chạy toàn bộ hệ thống

Đây là cách khởi động cũ để tham khảo. Thành viên mới dùng mục **Thành viên mới — nhánh develop** phía trên: command Compose cũ có tự tải mô hình và gọi bộ nạp mẫu chưa an toàn khi chạy lặp. Không dùng cách cũ để thay cho quy trình dữ liệu mới.

1. **Clone và setup**:
```bash
git clone <repository-url>
cd SenpaiAI
```

2. **Cấu hình biến môi trường**:
```bash
# Copy file cấu hình
cp backend/env.example backend/.env
cp frontend/env.example frontend/.env

# Chỉnh sửa backend/.env
# Mặc định sử dụng Ollama (miễn phí)
# Hoặc thay đổi LLM_PROVIDER=openai và thêm OPENAI_API_KEY
```

3. **Setup Ollama (Khuyến nghị - Miễn phí)**:
```bash
# Linux/Mac
./setup-ollama.sh

# Windows
setup-ollama.bat
```

4. **Chạy tất cả services**:
```bash
docker-compose up -d
```

5. **Truy cập ứng dụng**:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

### Setup thủ công (Development)

1. **Backend Setup**:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

2. **Frontend Setup**:
```bash
cd frontend
npm install
npm run dev
```

3. **Database Setup**:
```bash
# Start PostgreSQL
docker run -d --name senpai-postgres -e POSTGRES_PASSWORD=senpai123 -e POSTGRES_DB=senpai_db -p 5432:5432 postgres:15

# Run migrations
cd backend
alembic upgrade head

# Populate sample data
python populate_data.py
```

## 📚 Tính năng chính

### Tính năng cốt lõi
- 🔐 **Xác thực JWT** - Đăng ký/đăng nhập bảo mật
- 💬 **Hỏi đáp theo ngữ cảnh** - Học tiếng Nhật với RAG-powered responses
- 📖 **Phân tích ngữ pháp** - Giải thích chi tiết ngữ pháp tiếng Nhật
- 🎯 **Dự đoán trình độ JLPT** - Đánh giá tự động độ khó (N5-N1)
- 🔄 **Dịch thuật** - Dịch tiếng Nhật ↔ Tiếng Việt
- 📊 **Lịch sử học tập** - Theo dõi tiến độ và xem lại các phiên học
- 🔍 **Tìm kiếm tài liệu** - Tìm kiếm tài liệu học tập liên quan

### Màn hình giao diện
- **Login/Register** - Xác thực người dùng
- **Chat Interface** - Học tiếng Nhật tương tác
- **Grammar Analysis** - Giải thích ngữ pháp chi tiết
- **Library** - Tài liệu học tập và tìm kiếm
- **Profile** - Cài đặt người dùng và theo dõi tiến độ

## 🛠️ Phát triển

### Cấu trúc dự án
```
SenpaiAI/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/            # API routes
│   │   ├── core/           # Core configuration
│   │   ├── models/         # Database models
│   │   ├── services/       # Business logic
│   │   └── utils/          # Utilities
│   ├── alembic/            # Database migrations
│   └── requirements.txt
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   └── utils/          # Frontend utilities
│   └── package.json
├── database/               # Database scripts
├── docker-compose.yml      # Full stack deployment
└── README.md
```

### Biến môi trường

**Backend (.env)**:
```env
DATABASE_URL=postgresql://senpai:senpai123@localhost:5432/senpai_db
SECRET_KEY=your-secret-key-here
OPENAI_API_KEY=your-openai-api-key
CHROMA_PERSIST_DIRECTORY=./chroma_db
```

**Frontend (.env)**:
```env
VITE_API_BASE_URL=http://localhost:8000
```

## 🆓 Sử dụng Ollama (Miễn phí)

SenpaiAI hỗ trợ Ollama để chạy LLM local miễn phí thay vì sử dụng OpenAI API.

### Cài đặt Ollama

1. **Tải Ollama**:
   - Linux/Mac: https://ollama.ai/download
   - Windows: https://ollama.ai/download

2. **Chạy script setup**:
```bash
# Linux/Mac
./setup-ollama.sh

# Windows
setup-ollama.bat
```

### Models được khuyến nghị

- **gemma:2b** - Nhanh, nhẹ, phù hợp cho hầu hết tác vụ
- **gemma:7b** - Chất lượng tốt hơn, cần nhiều RAM hơn
- **nomic-embed-text** - Model embedding cho RAG

### Cấu hình

Trong `backend/.env`:
```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma:2b
```

### Lợi ích của Ollama

- ✅ **Miễn phí** - Không cần API key
- ✅ **Privacy** - Dữ liệu không rời khỏi máy
- ✅ **Offline** - Hoạt động không cần internet
- ✅ **Customizable** - Có thể fine-tune models
- ✅ **Fast** - Chạy local nhanh hơn API calls

## 📊 Hiệu suất & Bảo mật

- **Thời gian phản hồi**: < 3 giây cho tất cả API calls
- **Rate Limiting**: Được triển khai để ngăn chặn lạm dụng
- **Bảo mật API Key**: Biến môi trường, không hardcode keys
- **Bảo mật JWT**: Xác thực dựa trên token bảo mật

## 🎯 Tính năng đặc biệt

### RAG (Retrieval-Augmented Generation)
- Sử dụng ChromaDB để lưu trữ embeddings
- Tìm kiếm ngữ nghĩa trong corpus tiếng Nhật
- Cung cấp câu trả lời có nguồn gốc và chính xác

### Phân tích ngữ pháp thông minh
- Nhận diện các điểm ngữ pháp trong văn bản
- Dự đoán trình độ JLPT phù hợp
- Đưa ra gợi ý học tập cá nhân hóa

### Hệ thống học tập thích ứng
- Theo dõi tiến độ học tập
- Điều chỉnh độ khó theo trình độ người dùng
- Lưu trữ lịch sử học tập để tham khảo

## 🤝 Đóng góp

1. Fork repository
2. Tạo feature branch
3. Thực hiện thay đổi
4. Thêm tests nếu cần
5. Submit pull request

## 📄 Giấy phép

MIT License - xem file LICENSE để biết chi tiết

## 🆘 Hỗ trợ

Nếu gặp vấn đề, vui lòng tạo issue trên GitHub hoặc liên hệ qua email.

---

**SenpaiAI** - Học tiếng Nhật thông minh với AI! 🎌✨

## OpenJLPT vocabulary attribution

Contains data from [OpenJLPT](https://github.com/evanclan/OpenJLPT) **0.3.0**, pinned at commit `0d1d3410bec90bd4098a7c72de820543cb4f707c`, under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Upstream sources include Jonathan Waller's JLPT lists (level assignments and English glosses), JMdict/KANJIDIC2 (EDRDG; verification, identifiers and metadata) and Tatoeba examples (CC BY 2.0 FR). Tatoeba sentence IDs/source links and per-meaning provenance are retained. Downloaded NOTICE/LICENSE files accompany the local dataset; derived vocabulary data retains its attribution and share-alike licence.

N5–N1 assignments are **community estimates, not official JLPT vocabulary lists**. The imported vocabulary has English meanings; existing Vietnamese meanings are preserved. `[EN]` marks the English fallback. Optional single-word AI translations are disabled by default and labelled unreviewed; there is no bulk translation. See [Vietnamese design/import/API report](docs/TU_DIEN_OPENJLPT.md).

## Kanji data attribution

Kanji stroke-order data is derived from KanjiVG by Ulrich Apel and distributed under CC BY-SA 3.0: https://kanjivg.tagaini.net. Kanji dictionary readings and stroke counts reference KANJIDIC (EDRDG) and the unofficial JLPT kanji lists by Jonathan Waller (tanos.co.uk). Vietnamese meanings and example words are maintained by the project. The app shows KanjiVG source, license, and source URL alongside stroke-order data; derived stroke records retain those fields.
