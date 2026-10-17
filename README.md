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

### Yêu cầu hệ thống
- Docker & Docker Compose
- Python 3.11+
- Node.js 18+
- **Ollama** (cho LLM miễn phí) hoặc OpenAI API key

### Chạy toàn bộ hệ thống

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

## Kanji data attribution

Kanji stroke-order data is derived from KanjiVG by Ulrich Apel and distributed under CC BY-SA 3.0: https://kanjivg.tagaini.net. Kanji dictionary readings and stroke counts reference KANJIDIC (EDRDG) and the unofficial JLPT kanji lists by Jonathan Waller (tanos.co.uk). Vietnamese meanings and example words are maintained by the project. The app shows KanjiVG source, license, and source URL alongside stroke-order data; derived stroke records retain those fields.
