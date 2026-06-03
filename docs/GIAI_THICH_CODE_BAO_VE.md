**1. Cách đọc dự án này**

- **frontend/**: mã React + UI. Gọi API tới backend, chứa canvas viết chữ, trang Chat, Library, v.v. Xem [frontend/src/App.tsx](frontend/src/App.tsx) và [frontend/src/pages/Chat.tsx](frontend/src/pages/Chat.tsx).
- **backend/**: server FastAPI. Chứa router, services, models, ML helper. Entry: [backend/app/main.py](backend/app/main.py).
- **docs/**: tài liệu dự án; file này được thêm vào đây.
- **backend/app/**: mã nguồn backend chính — gồm `api/`, `core/`, `models/`, `services/`, `data/`.
- **backend/ml/**: mã huấn luyện/inference CNN cho nhận diện chữ Kanji. Ví dụ: [backend/ml/kanji_recognizer.py](backend/ml/kanji_recognizer.py), [backend/ml/kanji_model.py](backend/ml/kanji_model.py).
- **database/** & **backend/alembic/**: file SQL khởi tạo và migration. Model SQLAlchemy ở [backend/app/models/database.py](backend/app/models/database.py).
- **chroma_db/**: thư mục persist của ChromaDB (vector DB) khi chạy.

Gợi ý đọc: bắt đầu từ `backend/app/main.py` → các router trong `backend/app/api/` → services trong `backend/app/services/` → models/schemas.

**2. Luồng chạy tổng thể của hệ thống**

- Người dùng thao tác trên giao diện (React) → component gọi API thông qua `frontend/src/services/api.ts`.
- Frontend gọi endpoint trên FastAPI (ví dụ `/api/chat/message`, `/api/kanji/recognize`, `/api/library/documents`). Các router xử lý request nằm trong [backend/app/api/](backend/app/api/).
- Router sẽ gọi các service (business logic) trong [backend/app/services/], có thể:
  - Truy vấn PostgreSQL qua SQLAlchemy (`backend/app/models/database.py`).
  - ChromaDB semantic search (`backend/app/services/vector_db.py`).
  - Gọi Ollama/OpenAI qua `backend/app/services/ollama_service.py` / `backend/app/services/llm_service.py`.
  - ML inference Kanji (CNN) trong `backend/ml/kanji_recognizer.py`.
- Kết quả được trả về frontend và render (chat message, danh sách văn bản, prediction kanji...).

**3. Backend - Giải thích từng file quan trọng**

## File: backend/app/main.py

### File này dùng để làm gì?
Khởi tạo FastAPI app, middleware, lifecycle (tạo bảng DB, check từ điển, check model).

### Khi nào file này được chạy?
Khi chạy server (uvicorn backend.app.main:app).

### Các hàm/class chính
- `lifespan(app: FastAPI)` — tạo bảng DB và validate từ điển khi khởi động.
- `root()` và `health_check()` — endpoints thông tin/health.

Nếu giảng viên hỏi: "Tại sao tạo bảng ở đây?" — Trả lời: để đảm bảo khi app start, SQLAlchemy tạo bảng nếu chưa có; migration vẫn có trong `alembic/`.

## File: backend/app/api/auth.py

### File này dùng để làm gì?
Xử lý đăng ký, đăng nhập, profile user, export data, reset progress, xóa user.

### Khi nào file này được chạy?
Khi frontend gọi `/auth/*` endpoints.

### Các hàm chính
- `register(user: UserCreate)`
  - Mục đích: tạo user mới.
  - Input: `email`, `username`, `password`.
  - Output: User (không trả password).
  - Luồng: kiểm tra tồn tại email/username → hash password bằng `get_password_hash` → lưu DB.
  - Câu hỏi giảng viên: "Tại sao hash?" → Trả lời: bảo mật, không lưu plain text.

- `login(user_credentials: UserLogin)`
  - Mục đích: xác thực và trả JWT.
  - Input: email, password
  - Output: access token (Bearer)
  - Luồng: tìm user, `verify_password`, `create_access_token`.

- `get_current_user_info`, `update_current_user`, `export_user_data`, `reset_user_progress`, `delete_current_user`
  - Các thao tác profile và dữ liệu người dùng.

## File: backend/app/api/chat.py

### File này dùng để làm gì?
Xử lý luồng chat: nhận message, rule-based trả lời nhanh, RAG + LLM, lưu lịch sử chat.

### Khi nào file này được chạy?
Khi frontend gọi `/chat/message`, `/chat/history`, `/chat/search`.

### Các hàm chính
- `send_message(message: ChatMessage)`
  - Mục đích: xử lý tin nhắn, trả lời bằng deterministic rules, local dictionary, MCQ helper, hoặc RAG+LLM.
  - Input: `message` (text), `context`, `jlpt_level` (tùy chọn).
  - Output: `ChatResponse` (answer, jlpt_level, grammar_points, translation, sources, response_time).
  - Luồng xử lý:
    1. Kiểm tra rule deterministic (một vài câu mẫu trả lời cứng trong code).
    2. Nếu yêu cầu về 1 kanji đơn → trả thông tin từ `kanji_dictionary_service`.
    3. Thử trả lời MCQ qua `vocab_mcq_service.try_answer()`.
    4. Lấy context bằng `chroma_service.get_relevant_context()` (ChromaDB).
    5. Gọi `japanese_service.chat_response()` (Ollama/OpenAI) để tạo answer.
    6. Nếu response có tiếng Nhật → phân tích grammar bằng `japanese_service.analyze_grammar()`.
    7. Lưu `ChatHistory` vào DB.
  - Giảng viên có thể hỏi: "Tại sao context lấy từ đâu?" → trả lời: ChromaDB chunks qua `vector_db.py`.

## File: backend/app/api/library.py

### File này dùng để làm gì?
Quản lý Learning Library: CRUD documents (PostgreSQL), chunk & index vào ChromaDB, tìm kiếm semantic.

### Khi nào file này được chạy?
Khi frontend gọi `/library/*` endpoints.

### Các hàm chính
- `fetch_document_url` → crawl URL (BeautifulSoup) để lấy nội dung trước khi lưu.
- `create_document` / `update_document` → lưu Document vào PostgreSQL (table `documents`) rồi gọi `chroma_service.add_documents` để chunk + index.
- `search_documents` → gọi `library_service.search_documents()` — kết hợp ChromaDB (semantic) + fallback keyword search từ PostgreSQL.

## File: backend/app/models/database.py

### File này dùng để làm gì?
Định nghĩa schema database (SQLAlchemy) cho các bảng: `users`, `chat_history`, `learning_sessions`, `documents`, `kanji`, `vocabulary`, `grammar_rules`, v.v.

### Khi nào file này được chạy?
Được import khi app start; `Base.metadata.create_all()` tạo bảng.

### Bảng quan trọng (tóm tắt):
- `User` — profile, email, username, hashed_password, preferences (current_jlpt_level, learning_goals).
- `ChatHistory` — lưu lịch sử chat (question, answer, sources, created_at).
- `Document` — learning library documents (title, content, document_type, tags, source_url, embedding_id, chunk_index).
- `Kanji`, `Vocabulary` — nội dung học/miền dữ liệu.

## File: backend/app/services/vector_db.py

### File này dùng để làm gì?
Kết nối và thao tác với ChromaDB persistent collection; chia text thành chunks, add/query/delete chunks.

### Khi nào file này được chạy?
Khi backend cần index document hoặc tìm kiếm semantic (library, chat RAG).

### Hàm chính
- `add_documents(documents)` — chia content thành chunks, lưu vào collection với metadata (document_id, title, jlpt_level...).
- `search_documents(query, n_results, filter_dict)` — query ChromaDB, trả về chunks có similarity.
- `get_relevant_context(query, jlpt_level)` — lấy top-N chunks rồi nối thành context string cho LLM.

## File: backend/app/services/ollama_service.py & llm_service.py

### File này dùng để làm gì?
- `ollama_service.py`: tích hợp trực tiếp với Ollama (local LLM). Gọi `ollama.chat` / `ollama.generate` và parse kết quả; có retry/diagnostics.
- `llm_service.py`: lớp `JapaneseLearningService` — adapter; nếu `settings.llm_provider=='ollama'` sẽ dùng `ollama_service`, ngược lại fallback OpenAI via langchain/chat.

### Khi nào được gọi?
Khi cần trả lời chat, phân tích ngữ pháp, dịch, hoặc dự đoán JLPT — ví dụ trong `chat.py` gọi `japanese_service.chat_response()`.

## File: backend/ml/kanji_recognizer.py

### File này dùng để làm gì?
Inference model CNN cho nhận diện Kanji từ ảnh base64. Load `kanji_model.pt` và `label_map.json` nếu có.

### Khi nào được chạy?
Khi endpoint `POST /kanji/recognize` được gọi (thông qua `kanji_recognition_service`).

### Hàm chính
- `KanjiRecognizer.predict(image_data, ...)` — decode base64 → preprocess (crop, resize, normalize) → forward model → softmax → top-k predictions.
- `get_model_info()` → thông tin model (available, classes, paths).

## File: backend/app/services/kanji_recognition_service.py

### File này dùng để làm gì?
Bao quanh inference ML, rerank bằng metadata (stroke count, jlpt, frequency), lưu mẫu người dùng.

### Khi nào được chạy?
Khi API `/kanji/recognize` được gọi.

### Luồng chính
1. Kiểm tra model có sẵn.
2. Gọi `predict_kanji(...)` từ ML module.
3. Rerank kết quả bằng các heuristics (stroke count, jlpt), tính final confidence.
4. Lưu sample bằng `kanji_sample_store.save_sample` (dùng để fine-tune sau này).

## File: backend/app/services/kanji_sample_store.py

### File này dùng để làm gì?
Lưu mẫu chữ viết người dùng (image.png, strokes.json, metadata.json) vào `backend/ml/user_samples/` để có thể dùng fine-tuning sau.

### Khi nào được chạy?
Khi người dùng submit correction hoặc khi nhận diện, service tự lưu sample.

4. Frontend - Giải thích từng file quan trọng

## File: frontend/src/pages/Chat.tsx

### File này hiển thị phần nào?
Giao diện chat: danh sách message, input message, nút mở handwriting modal.

### Nó gọi API nào?
`chatAPI.sendMessage`, `chatAPI.getHistory`, `chatAPI.deleteEntry`, `chatAPI.clearHistory` (xem [frontend/src/services/api.ts](frontend/src/services/api.ts)).

### State chính gồm những gì?
- `chatHistory` (React Query)
- local state: `searchQuery`, `handwritingOpen`.

### Khi người dùng bấm nút thì chuyện gì xảy ra?
- Gửi form → `sendMessageMutation` → backend xử lý → invalidate queries để reload history.

### Dữ liệu nhận từ backend được render như thế nào?
Render `question`, `answer`, `jlpt_level`, `translation`, `grammar_points`, `sources`.

## File: frontend/src/components/kanji/HandwritingInputModal.jsx

### File này hiển thị phần nào?
Modal chứa `KanjiCanvas` và `PredictionResult` để người dùng viết chữ, nhận dự đoán và chọn.

### Nó gọi API nào?
`kanjiRecognitionAPI.recognize` → `/kanji/recognize` và `kanjiRecognitionAPI.correct` nếu người dùng submit correction.

## File: frontend/src/components/kanji/KanjiCanvas.jsx

### File này hiển thị phần nào?
Canvas vẽ, thu thập strokes, replay, undo, clear, tạo normalized image base64 cho backend.

### State chính gồm những gì?
- `strokes` (mảng các stroke), `isDrawing`, `isReplaying`.

### Khi người dùng bấm nút Recognize thì chuyện gì xảy ra?
Component tạo image base64 qua `createRecognitionImage(strokes)` và gửi kèm `strokes` đã chuẩn hoá qua API.

5. Database - Hiểu bảng dữ liệu

Dựa trên [backend/app/models/database.py](backend/app/models/database.py).

## Table: users

### Bảng này lưu gì?
Thông tin user: email, username, `hashed_password`, `is_active`, `current_jlpt_level`, `learning_goals`, timestamps.

### Các cột quan trọng
| Cột | Ý nghĩa |
| --- | ------- |
| id | PK |
| email | email đăng nhập |
| username | tên hiển thị |
| hashed_password | password đã hash (bcrypt) |
| current_jlpt_level | cấp JLPT ưu tiên của user |

### Bảng này liên quan tới chức năng nào?
Auth, profile, export data, personalize chat.

## Table: documents

### Bảng này lưu gì?
Tài liệu Learning Library (title, content, type, jlpt_level, tags, source_url, embedding_id, chunk_index).

### Các cột quan trọng
| Cột | Ý nghĩa |
| --- | ------- |
| id | PK |
| title | tiêu đề |
| content | toàn văn tài liệu |
| document_type | 'vocabulary'|'grammar'|'lesson'|... |
| jlpt_level | N5..N1 |
| tags | JSON array |
| source_url | nếu import từ web |
| embedding_id | ví dụ chunk id đầu tiên trong ChromaDB |
| chunk_index | index chunk mặc định |

### Bảng này liên quan tới chức năng nào?
Library CRUD, RAG search.

Lưu ý: schema thực tế chứa đúng các cột liệt kê trong yêu cầu; không thêm `description` nếu DB không có.

6. API - Hiểu từng endpoint (tóm tắt bảng)

| Method | Endpoint | File xử lý | Chức năng | Input | Output |
| --- | --- | --- | --- | --- | --- |
| POST | /auth/register | backend/app/api/auth.py | Đăng ký | UserCreate | User |
| POST | /auth/login | backend/app/api/auth.py | Login -> JWT | UserLogin | Token |
| POST | /chat/message | backend/app/api/chat.py | Chat + RAG + LLM | ChatMessage | ChatResponse |
| GET | /chat/history | backend/app/api/chat.py | Lấy lịch sử chat | limit,offset | List[ChatHistory] |
| POST | /kanji/recognize | backend/app/api/kanji.py | Nhận diện handwriting | image_data, strokes | KanjiRecognitionResponse |
| POST | /kanji/correction | backend/app/api/kanji.py | Lưu correction sample | KanjiCorrectionRequest | success |
| GET | /kanji/{kanji}/strokes | backend/app/api/kanji.py | Trả KanjiVG stroke data | kanji | KanjiVGStrokeData |
| GET/POST | /library/* | backend/app/api/library.py | CRUD + search documents | DocumentCreate / DocumentSearchRequest | Document / LibrarySearchResponse |

Giải thích các API quan trọng (mẫu):
- Auth APIs: gọi khi user đăng nhập/đăng ký; sử dụng `pwd_context` (bcrypt) để hash; token JWT được tạo trong `core/auth.py`.
- Chat APIs: frontend gọi khi user gửi câu hỏi. Backend làm RAG: `vector_db.py` → `ollama_service`/`llm_service` → trả lời, phân tích grammar, lưu ChatHistory.
- Kanji APIs: `/kanji/recognize` gửi `image_data` (base64 PNG) và `strokes` (mảng điểm). Backend trả `predictions` gồm `kanji` và `confidence`.
- Library APIs: tạo/sửa xóa document cũng index vào ChromaDB; tìm kiếm kết hợp semantic + keyword fallback.

7. Chat AI - Hiểu logic để trả lời giảng viên

Luồng chat thực tế (mã hiện có):

User hỏi → `chat.send_message`:
1. Rule-based quick answers: `deterministic_chat_answer` trong `chat.py`.
2. Nếu yêu cầu chỉ 1 kanji → trả dữ liệu từ local kanji dictionary (`kanji_dictionary_service`).
3. Nếu là MCQ vocabulary → `vocab_mcq_service.try_answer()` trả đáp án và giải thích.
4. Nếu không, lấy context bằng ChromaDB (`chroma_service.get_relevant_context`).
5. Gửi context + question đến LLM (`japanese_service.chat_response`) — Ollama (mặc định) hoặc OpenAI.
6. Nếu đáp án chứa tiếng Nhật → phân tích ngữ pháp (`japanese_service.analyze_grammar`).
7. Trả về frontend, lưu `ChatHistory`.

Vì sao cần Ollama? Vì lập trình ban đầu chọn chạy LLM local (Ollama) để giảm chi phí/độ trễ và kiểm soát dữ liệu; code hỗ trợ fallback OpenAI.

Vì sao cần context? Context (RAG) giúp model trả lời dựa trên tài liệu thực tế, giảm hallucination và cho phép trích nguồn.

Vì sao dùng ChromaDB? Lưu vector embedding và tìm kiếm similarity cho semantic retrieval; lưu chunk, metadata (jlpt_level, document_type).

Nếu AI trả lời sai: nguyên nhân thường gặp
- Prompt chưa đủ ràng buộc.
- Context lấy chưa đúng/không liên quan.
- Model có hạn chế (local model nhỏ) hoặc hallucination.

Cách cải thiện: cải thiện prompt (`chat_prompt.py`), ưu tiên nguồn từ dictionary/library, tăng chất lượng chunking, fine-tune model hoặc dùng model lớn hơn.

Ví dụ trả lời giảng viên:
Q: "Tại sao câu `がくせい` có lúc trả lời sai?"
A: "Có thể do prompt chưa ràng buộc, hoặc RAG không lấy đúng chunk; hệ thống có rule vocabulary (`vocab_mcq_service`) để trả các từ JLPT phổ biến, nếu vẫn sai thì cần bổ sung dictionary hoặc điều chỉnh prompt/ưu tiên dữ liệu." 

8. Learning Library - Hiểu logic

* Documents lưu ở đâu? PostgreSQL table `documents` (see models). Khi tạo document, service sẽ gọi `chroma_service.add_documents()` để chunk và index vào ChromaDB.

* Thêm tài liệu thì dữ liệu đi qua những bước nào?
 1. Frontend gửi `DocumentCreate` → backend `library.create_document`.
 2. Lưu record vào PostgreSQL (`documents` table).
 3. Gọi `chroma_service.add_documents` → chia text thành chunk (chunk_size=500, overlap=50) và add vào ChromaDB với metadata.

* Search hoạt động thế nào?
 1. `library.search_documents` gọi `chroma_service.search_documents` để lấy chunk theo semantic.
 2. Map chunk → document_id → lấy record PostgreSQL tương ứng; nếu không có kết quả vector thì fallback keyword search trên PostgreSQL.

* Bộ lọc `document_type` và `jlpt_level`: được gửi vào `chroma_service.query` thông qua parameter `where` (filter_dict). Nếu filter không trả được kết quả, fallback keyword query trên PostgreSQL có cùng filter.

* ChromaDB lưu gì? chunks text + metadatas gồm: `document_id`, `title`, `document_type`, `jlpt_level`, `tags`, `source_url`, `chunk_index`, `total_chunks`.

* PostgreSQL lưu gì? toàn bộ nội dung có cấu trúc (title, content, document_type, tags, source_url, embedding_id, chunk_index).

9. Kanji Canvas - Hiểu logic

* Frontend canvas nhận nét vẽ: `KanjiCanvas.jsx` lắng nghe pointer events, lưu `strokes` là mảng mảng điểm (x,y,timestamp,pressure).
* Khi người bấm Recognize: `createRecognitionImage(strokes)` chuyển stroke thành ảnh PNG normalized 256x256 (bản code dùng 256 normalization, ML dùng 64 resize sau), gửi `image_data` base64 cùng `strokes` đã transform tới `/kanji/recognize`.
* Backend xử lý ảnh: `kanji_recognizer.decode_image_data` → `preprocess_pil_image` (crop, thumbnail, center, invert, normalize) → tensor.
* ML model nhận input: tensor kích thước [1,1,H,W] (grayscale), chạy forward CNN (`KanjiCNN`) → softmax → top-k predictions.
* Model trả về: danh sách `{kanji, confidence}`; sau đó `kanji_recognition_service` rerank theo metadata (stroke_count, jlpt, frequency) và trả `KanjiRecognitionResponse`.
* Kết quả hiển thị frontend: `PredictionResult` component (trong modal) hiện list predictions, cho phép chọn.

Nếu dùng CNN: giải thích ngắn
- CNN học đặc trưng không gian (edges, curves) phù hợp cho kanji.
- Resize để model có input size cố định (64 hoặc 128), normalize để giá trị nằm trong khoảng model mong đợi.
- `label_map.json` ánh xạ kanji → index; `kanji_model.pt` là weights đã train.

10. Minigame - Hiểu logic

* Các loại câu hỏi: matching grid, meaning/reading match, vocabulary matching pairs (library quiz, kanji quiz).
* Sinh câu hỏi: service `kanji_dictionary_service` và `library_service.vocabulary_matching_pairs` chọn từ DB hoặc dictionary cục bộ.
* Kiểm tra đáp án: client kiểm tra bằng so sánh giá trị được chọn với ground truth từ server (server trả cặp/quiz data trước).
* Tính điểm: front-end chịu trách nhiệm hiển thị score, backend lưu LearningSession nếu cần.
* Dữ liệu lấy từ đâu: `vocabulary` table, local kanji dictionary (`backend/app/data/kanji_dictionary.json`) hoặc `documents`.

11. Machine Learning - Hiểu code train model

Tham khảo: [backend/ml/train_kanji_model.py](backend/ml/train_kanji_model.py), [backend/ml/kanji_model.py](backend/ml/kanji_model.py)

- File train dùng để làm gì? Tạo dataset (synthetic + ETL10 + user samples), huấn luyện CNN (`KanjiCNN`) và lưu `kanji_model.pt` + `label_map.json`.
- Dataset lấy từ: `backend/ml/data/synthetic_kanji`, `backend/ml/data/etl10_processed`, `backend/ml/user_samples` và có thể giới hạn labels từ `frontend/src/data/kanji.json`.
- Cách đọc ảnh: PIL -> crop -> thumbnail -> paste center -> normalize -> convert tensor.
- Gán nhãn: label_map dict mapping kanji → index.
- Chia train/validation: random_split, validation size = max(len(labels), 0.15*dataset).
- Model: `KanjiCNN` gồm nhiều Conv2d + BatchNorm + ReLU + MaxPool + AdaptiveAvgPool → FC layers.
- Loss: CrossEntropyLoss.
- Optimizer: AdamW.
- Metrics: accuracy (train_acc/val_acc), lưu model khi val_acc cải thiện.
- Save model: `torch.save(model.state_dict(), model_path)` và `label_map.json`.
- Load model khi inference: `KanjiRecognizer._load()` tạo model, load state_dict, set eval().

12. Các lỗi thường gặp và cách giải thích

## Lỗi 422 Unprocessable Entity
- Nguyên nhân: frontend gửi payload sai so với Pydantic schema (ví dụ thiếu `content` hay `title`).
- Debug: xem Network tab request body, so sánh với `backend/app/models/schemas.py`.

## Lỗi ERR_CONNECTION_REFUSED
- Nguyên nhân: backend chưa chạy hoặc sai port, hoặc Ollama chưa chạy khi backend cố kết nối.
- Kiểm tra: có chạy `uvicorn backend.app.main:app --reload --port 8000`? Ollama chạy `ollama serve`?

## Lỗi PostgreSQL UndefinedColumn description
- Nguyên nhân: migration/ model không đồng bộ — code tham chiếu cột `description` nhưng DB migration không có cột đó.
- Sửa: remove reference `description` ở schema/model/seed hoặc tạo migration thêm cột.

## Lỗi AI trả lời sai nghĩa từ vựng
- Nguyên nhân: prompt không đủ ràng buộc, context không liên quan, ChromaDB trả context kém.
- Khắc phục: cải thiện prompt, tăng số chunk, ưu tiên dictionary, bổ sung dữ liệu library.

13. Bảng câu hỏi bảo vệ thường gặp (50 Q&A ngắn)

1. Q: `main.py` dùng để làm gì?  A: Khởi tạo FastAPI, middleware, lifespan.
2. Q: Router trong FastAPI là gì?  A: Nhóm endpoint dùng `APIRouter`.
3. Q: Pydantic schema dùng để làm gì?  A: Validate/parse I/O payloads.
4. Q: SQLAlchemy model khác Pydantic schema ở đâu?  A: ORM vs validation/serialization.
5. Q: Tại sao phải hash password?  A: Bảo mật.
6. Q: JWT token hoạt động thế nào?  A: Encode payload có `exp` với secret.
7. Q: Frontend gọi API bằng cách nào?  A: `axios` instance (`frontend/src/services/api.ts`).
8. Q: `useState`/`useEffect` dùng để làm gì?  A: Quản lý state & side-effects.
9. Q: Vì sao dùng ChromaDB?  A: Semantic search (vector DB).
10. Q: Embedding là gì?  A: Vector biểu diễn ngữ nghĩa văn bản.
11. Q: RAG là gì?  A: Retrieval-Augmented Generation.
12. Q: Ollama dùng ở đâu?  A: `ollama_service.py`.
13. Q: CNN hoạt động thế nào?  A: Convs -> pool -> FC để phân lớp ảnh.
14. Q: Vì sao model nhận diện sai?  A: Preprocess/lack data/hallucination.
15. Q: Làm sao debug lỗi 422?  A: Kiểm tra request body, Pydantic schema.
16. Q: PostgreSQL lưu gì?  A: users, chat_history, documents, kanji, vocabulary.
17. Q: ChromaDB lưu gì?  A: Chunks + metadata.
18. Q: Khi thêm tài liệu mới thì hệ thống làm gì?  A: Lưu DB -> chunk -> index Chroma.
19. Q: Khi search tài liệu thì hệ thống làm gì?  A: Query Chroma -> map -> lấy DB.
20. Q: Khi vẽ Kanji thì dữ liệu đi như thế nào?  A: Canvas → strokes+image → `/kanji/recognize` → ML.
21. Q: `kanji_sample_store` để làm gì?  A: Lưu mẫu người dùng.
22. Q: `library_service.fetch_url` lấy nội dung bằng gì?  A: `requests` + BeautifulSoup.
23. Q: ChromaDB filter theo JLPT bằng field nào?  A: `jlpt_level` trong metadata.
24. Q: Có fallback nếu ChromaDB fail không?  A: Có, keyword search trên PostgreSQL.
25. Q: `kanji_model.pt` nằm ở đâu?  A: `backend/ml/models/kanji_model.pt`.
26. Q: `label_map.json` là gì?  A: Ánh xạ kanji -> index.
27. Q: `predict_kanji` trả gì?  A: List `{kanji, confidence}`.
28. Q: `kanji_recognition_service` rerank không?  A: Có.
29. Q: `vocab_mcq_service` làm gì?  A: Trả MCQ rule-based.
30. Q: Tại sao có deterministic answers?  A: Đảm bảo các câu mẫu đúng.
31. Q: `core/config.py` lưu gì?  A: DB url, secret, LLM provider, chroma dir.
32. Q: Bật Ollama thế nào?  A: `ollama serve` và `ollama pull <model>`.
33. Q: Có rate limiting implemented?  A: Config có nhưng middleware không rõ triển khai.
34. Q: Thêm document type mới?  A: Thêm vào validator `DocumentCreate`.
35. Q: Chroma chunking thông số?  A: chunk_size=500, overlap=50.
36. Q: `ChatHistory.sources` chứa gì?  A: metadata nguồn (title,url,relevance).
37. Q: `kanjivg_service` làm gì?  A: Trả stroke data KanjiVG.
38. Q: `kanji_dictionary_service` dùng file nào?  A: `backend/app/data/kanji_dictionary.json`.
39. Q: Tests có sẵn không?  A: Có trong `tests/`.
40. Q: Export user data endpoint?  A: `/auth/me/export`.
41. Q: Có CSRF?  A: Không, dùng JWT Bearer.
42. Q: Ảnh gửi ML định dạng?  A: base64 PNG.
43. Q: `kanji/correction` lưu gì?  A: image, strokes, predicted, correct.
44. Q: Update vector khi edit doc?  A: Có, `update_document` re-index.
45. Q: `chroma_persist_directory` mặc định?  A: `./chroma_db`.
46. Q: `fetch_url` giới hạn nội dung?  A: 50000 chars.
47. Q: `empty_canvas` khi nào?  A: Canvas trắng / no ink.
48. Q: Inference có GPU không?  A: Hỗ trợ nếu torch.cuda có sẵn.
49. Q: Làm sao LLM ưu tiên Library?  A: Gửi context RAG + prompt ràng buộc.
50. Q: Nâng cấp model quy trình?  A: Train lại → deploy `kanji_model.pt` + `label_map.json`.

14. Tóm tắt để học nhanh trước khi bảo vệ

- 10 ý quan trọng nhất:
  1. Luồng: Frontend → FastAPI → services → DB/Chroma/LLM/ML → Frontend.
  2. Auth: JWT + bcrypt.
  3. Chat: deterministic rules + RAG + LLM.
  4. Library: PostgreSQL + ChromaDB indexing.
  5. Kanji: Canvas → image+strokes → CNN inference.
  6. ML train: synthetic + ETL10 + user samples.
  7. Rerank predictions bằng metadata.
  8. Ollama được dùng làm LLM mặc định.
  9. Fallbacks có sẵn cho search và LLM provider.
  10. User samples để fine-tune.

- 10 câu trả lời nên học thuộc: (xem phần Q&A trên)

- 5 luồng xử lý phải nắm chắc: (chat, add document, kanji recognition, auth, search)

- 5 lỗi thường gặp & cách giải thích: (422, connection refused, model unavailable, hallucination, DB column mismatch)

---

Ghi chú cuối: file này tóm tắt logic thực tế theo code hiện có. Nếu muốn mình có thể mở rộng mục Q&A với câu trả lời demo ngắn gọn bằng tiếng Việt để bạn học thuộc dễ hơn.
