# SenpaiAI

SenpaiAI version 1.3 hỗ trợ học tiếng Nhật qua ứng dụng web và ứng dụng di động React Native. Web dùng React/Vite; mobile dùng Expo và cùng gọi backend FastAPI bằng JWT. Dự án kết hợp trợ lý AI, học liệu Library, các buổi luyện có lưu tiến độ, nhận dạng kanji, bài nghe và các công cụ duy trì thói quen học.

Tài liệu tổng hợp cập nhật ngày **15/11/2026**, theo mã nguồn trên nhánh **`mobile`**. Mobile đã có nền tảng Giai đoạn 0–3, Quiz/Flashcard Giai đoạn 4, cửa hàng mua/áp dụng theme và nền, nhận dạng/luyện viết kanji, xử lý bàn phím dùng chung và các bản sửa đồng bộ hồ sơ/độ tương phản trò chơi. Phiên bản package mobile vẫn là **0.3.0**; không suy ra phiên bản phát hành từ số giai đoạn. Hướng dẫn: [`mobile/README.md`](mobile/README.md).

Báo cáo phân biệt **đã có trong mã**, **đã qua kiểm tra tự động/API** và **đã kiểm chứng trên thiết bị**. Các checklist Android/iPhone chưa thực hiện không được coi là đã đạt. Báo cáo theo giai đoạn giữ giá trị lịch sử; phần tổng hợp này phản ánh mã hiện tại.

## Tính năng

- **Tài khoản và hồ sơ:** đăng ký, đăng nhập bằng JWT, cập nhật hồ sơ, chọn cấp độ JLPT và theo dõi hoạt động học.
- **Chat AI trên web và mobile:** hỏi đáp tiếng Nhật dùng ngữ cảnh tài liệu qua RAG và các lượt gần đây trong cùng hội thoại. Có danh sách, tìm kiếm, ghim, đổi tên, thư mục, chuyển thư mục, phân trang tin nhắn và xóa. Mobile đã có hội thoại văn bản; chưa có luồng ghi âm/luyện nói.
- **Phân tích và dịch:** phân tích ngữ pháp, dịch Nhật–Việt/Việt–Nhật và dự đoán cấp độ JLPT.
- **Thư viện:** duyệt, tìm kiếm, thêm tài liệu, nhập nội dung từ URL; xem danh mục và thống kê. Backend hiện có endpoint sửa/xóa nhưng chưa cung cấp thông tin chủ sở hữu và quyền theo tài liệu; chưa thể coi chế độ cá nhân/hệ thống là tính năng đã được thực thi. Mobile khóa sửa/xóa nếu không có xác nhận quyền từ API. Nội dung được lập chỉ mục trong ChromaDB để hỗ trợ tìm kiếm ngữ nghĩa và RAG.
- **Luyện tập:** Quiz thủ công/nhập tệp, Flashcard, bài ngữ pháp theo phiên, thử thách hằng ngày và Quiz Kanji đã có trên mobile. Bộ study mobile lưu cục bộ theo tài khoản, không đồng bộ với web/server và không cộng điểm tài khoản. Web có thêm trò ghép cặp và luồng sinh câu hỏi từ Library; các phần đó chưa chuyển đầy đủ sang mobile.
- **Kanji:** tra từ điển JLPT N5/N4/N3, thứ tự nét/metadata KanjiVG, Quiz và nhận dạng/luyện viết bằng ngón tay trên mobile. Ghép cặp và gửi sửa nhãn hiện có ở web, chưa có trên mobile. CNN PyTorch đọc lớp từ `label_map.json`; model kiểm tra gần nhất có 245 nhãn N5/N4, khác phạm vi từ điển và model ứng viên mở rộng tới N3.
- **Nghe và nói trên web/backend:** tạo/chỉnh sửa bài nghe từ Library, phát audio tiếng Nhật bằng VoiceVox, lời thoại theo đoạn; ghi âm/nhận dạng lời nói bằng Whisper. Mobile chưa triển khai các màn và luồng này.
- **Duy trì thói quen:** nhiệm vụ hằng ngày, chuỗi ngày học, điểm thưởng, cửa hàng theme/nền có mua và áp dụng trên mobile. Nhắc học/Web Push hiện thuộc web/backend; chưa có remote push native trên mobile.

## Công nghệ và dịch vụ

| Phần | Công nghệ |
|---|---|
| Giao diện | React 18, TypeScript/JavaScript, Vite, Tailwind CSS, React Router, React Query |
| Ứng dụng di động | Expo SDK 58, React Native 0.88.1, React 19.3, TypeScript, Expo Router; React Query 3 và React Hook Form 7 |
| Dịch và theme mobile | i18next/react-i18next, import JSON vi/en và mọi palette theme của web; StyleSheet, sáng/tối/hệ thống; SVG cho khung vẽ |
| Lưu trữ mobile | JWT bằng Expo SecureStore; AsyncStorage lưu tùy chọn và kho Quiz/Flashcard theo tài khoản trên thiết bị, không lưu token |
| API và dữ liệu | Python 3, FastAPI, Pydantic 2, SQLAlchemy 2, Alembic |
| Cơ sở dữ liệu | PostgreSQL 15; ChromaDB cho vector tìm kiếm cục bộ |
| Tìm kiếm/RAG | ChromaDB, LangChain text splitters, embeddings theo cấu hình backend |
| AI hội thoại | Ollama mặc định trong Docker Compose; backend cũng có cấu hình OpenAI |
| Âm thanh | faster-whisper cho nhận dạng giọng nói; VoiceVox Engine cho tổng hợp tiếng Nhật và audio bài nghe |
| Nhận dạng kanji | PyTorch, NumPy, Pillow; fonttools kiểm tra font và sinh ảnh kanji trong `backend/ml/` |
| Chạy dịch vụ | Docker Compose hoặc chạy frontend/backend riêng |

## Cấu trúc thư mục

- `frontend/src/`: trang, component, dịch vụ API và giao diện React.
- `mobile/app/`: đăng nhập, năm tab, hội thoại/thư mục, ngữ pháp/tiến độ, Kanji/Quiz/vẽ, study, cửa hàng, tài liệu và xuất dữ liệu bằng Expo Router.
- `mobile/src/`: API/JWT, xác thực, dịch/theme, bàn phím, màn hình và logic Hằng ngày/Thư viện/Chat/Ngữ pháp/Kanji/Study/Shop.
- `mobile/tests/`, `mobile/scripts/`: test logic/contract, kiểm tra bản dịch và kiểm tra tích hợp API bằng dữ liệu thử có dọn dẹp.
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

## Trạng thái Chat và API hiện có

Chat văn bản dùng `chat_conversations`, `chat_folders` và `chat_history`. Mỗi lượt có câu hỏi, câu trả lời, cấp JLPT, phân tích ngữ pháp, bản dịch, nguồn tham khảo, thời gian tạo và `conversation_id`. Request gửi tin nhắn nhận `conversation_id` và `response_language`; backend ghép một số lượt gần đây theo giới hạn cấu hình để tạo ngữ cảnh hội thoại. Giao diện web có danh sách hội thoại và thư mục.

Các endpoint Chat được đăng ký ở cả đường dẫn `/chat/...` và `/api/chat/...`; frontend hiện gọi tiền tố `/api`:

| Method | Endpoint | Chức năng hiện có |
|---|---|---|
| `POST` | `/api/chat/message` | Gửi câu hỏi trong hội thoại; có thể nhận `conversation_id` và `response_language`. Nếu chưa có ID, backend tạo hội thoại mới. |
| `GET`, `POST` | `/api/chat/conversations` | Liệt kê/tìm kiếm hoặc tạo hội thoại văn bản. |
| `GET`, `PATCH`, `DELETE` | `/api/chat/conversations/{conversation_id}` | Đọc, đổi tên hoặc xóa hội thoại thuộc tài khoản. |
| `GET` | `/api/chat/conversations/{conversation_id}/messages` | Lấy tin nhắn trong một hội thoại theo phân trang. |
| `PUT` | `/api/chat/conversations/{conversation_id}/pin` | Ghim hoặc bỏ ghim. |
| `PUT` | `/api/chat/conversations/{conversation_id}/folder` | Chuyển hội thoại vào/ra thư mục. |
| `GET`, `POST` | `/api/chat/folders` | Liệt kê hoặc tạo thư mục. |
| `PATCH`, `DELETE` | `/api/chat/folders/{folder_id}` | Đổi tên hoặc xóa thư mục. |
| `PUT` | `/api/chat/folders/order` | Lưu thứ tự thư mục. |
| `GET` | `/api/chat/history?limit=50&offset=0` | Lấy lịch sử chung theo phân trang. |
| `GET` | `/api/chat/search?query=...&limit=20` | Tìm trong câu hỏi và câu trả lời của lịch sử chung. |
| `DELETE` | `/api/chat/history/{chat_id}` | Xóa một lượt hỏi–đáp. |
| `DELETE` | `/api/chat/history` | Xóa lịch sử Chat và các bản ghi hội thoại giọng nói của người dùng. |

Hội thoại giọng nói hiện có bảng `voice_conversations` và API riêng, cũng được đăng ký tại `/voice/...` và `/api/voice/...`:

| Method | Endpoint | Chức năng hiện có |
|---|---|---|
| `GET` | `/api/voice/scenarios` | Liệt kê tình huống luyện nói. |
| `POST` | `/api/voice/conversations` | Tạo phiên luyện nói. |
| `POST` | `/api/voice/transcribe` | Chuyển audio thành văn bản. |
| `POST` | `/api/voice/conversations/{conversation_id}/turn` | Gửi lượt nói trong phiên giọng nói. |
| `POST` | `/api/voice/turns/{chat_id}/feedback` | Tạo phản hồi cho một lượt nói. |
| `POST` | `/api/voice/conversations/{conversation_id}/end` | Kết thúc phiên và lưu tóm tắt. |

Router quản lý hội thoại nằm ở `backend/app/api/chat_conversations.py`. Endpoint danh sách hội thoại hiện lọc `mode == "text"`; không coi đây là danh sách hợp nhất đầy đủ văn bản và giọng nói. Mobile đã có Chat văn bản và quản lý danh sách/thư mục; chưa có ghi âm/luyện nói. Nếu truy cập dữ liệu voice phù hợp, màn hội thoại mobile xử lý ở trạng thái chỉ đọc.

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

Backend đọc cấu hình qua `backend/app/core/config.py` và file `.env` trong thư mục backend. Các thiết lập chính gồm `DATABASE_URL`, `SECRET_KEY`, `LLM_PROVIDER`, `OPENAI_API_KEY`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `CHROMA_PERSIST_DIRECTORY`, `ALLOWED_ORIGINS`, `ALLOWED_HOSTS`, `REMINDERS_ENABLED`, thông tin VAPID, Whisper và VoiceVox. Frontend nhận URL backend qua `VITE_API_BASE_URL`; mobile đọc `EXPO_PUBLIC_API_URL` từ `mobile/.env`.

`backend/env.example` và `mobile/.env.example` là file mẫu; khóa thật đặt trong `backend/.env`. Không đưa `SECRET_KEY` hoặc `OPENAI_API_KEY` vào mobile hay biến `EXPO_PUBLIC_*`, vì các biến công khai được nhúng vào bundle ứng dụng.

## Đối chiếu toàn bộ tuyến web với mobile

Nguồn: `frontend/src/App.tsx`, `mobile/app/`, màn hình và API tương ứng. “Đủ luồng chính” là có phần tương ứng trong mã, không khẳng định mọi thao tác phụ/hiệu ứng đều giống web hoặc đã thử trên máy thật. Trạng thái chưa chuyển là **chưa triển khai**, trừ nơi ghi rõ chủ ý hoãn hoặc giới hạn API.

| Trang | Đường dẫn web | Chức năng chính | Đối ứng mobile | Thiếu/khác biệt và lý do |
|---|---|---|---|---|
| Xác thực | `/login` | Đăng nhập, biểu mẫu đăng ký | Đủ luồng chính: `(auth)/login`, `(auth)/register` | Mobile tách đăng ký thành route riêng; tránh đăng ký lặp nếu tạo tài khoản thành công nhưng tự đăng nhập lỗi. |
| Điểm vào | `/` | Chuyển tới Chat | `index`, năm tab | Khác điều hướng ứng dụng, không phải một trang nghiệp vụ còn thiếu. |
| Trò chuyện | `/chat` | Danh sách/tìm/ghim/thư mục/tạo/xóa | Có phần chính: `(tabs)/chat`, `chat-folders` | Chưa chuyển toàn bộ thao tác kéo/thả/sắp xếp thư mục của web; dùng nhấn giữ/menu native. |
| Hội thoại | `/chat/:conversationId` | Tin, AI, ngữ cảnh, phân tích/nguồn | Có phần chính: `conversation/[id]` | Chưa có ghi âm/luyện nói; dữ liệu voice phù hợp chỉ đọc. Màn này ở root stack, không có tab dưới. |
| Ngữ pháp | `/grammar` | Phân tích/dịch câu | Có phần chính: `grammar` | Mobile gộp phân tích và luyện; nội dung server không tự đổi ngôn ngữ theo UI. |
| Luyện ngữ pháp | `/grammar/practice` | Cấp/dạng/nguồn, phiên, kết quả/tiến độ | Có phần chính: `grammar`, `grammar-progress` | AI/mixed cần server trả câu hợp lệ; có fallback ngân hàng. Chưa có đầy đủ luồng tạo bài trực tiếp từ tài liệu Library trên mobile. |
| Thư viện | `/library` | Tìm/lọc/thống kê, chi tiết, CRUD/URL | Có phần chính: `(tabs)/library`, `library-document/[id]`, `library-editor` | API thiếu quyền/scope nên lọc cá nhân và sửa/xóa bị khóa nếu không có xác nhận. Chưa chuyển sinh bài nghe/ngữ pháp từ tài liệu. |
| Trung tâm trò chơi | `/games` | Quiz/Flashcard/trò Kanji | Có phần chính: `(tabs)/practice`, `study/index` | Chỉ hiện lối vào hoạt động; chưa có ghép cặp Kanji/từ vựng. |
| Trò Kanji | `/games/kanji` | Học, trắc nghiệm, nhập âm đọc, ghép cặp | Một phần: `kanji`, `kanji/[character]`, `kanji-quiz` | Có Quiz nghĩa/âm đọc/chữ; chưa có nhập âm đọc tự do, ghép cặp, toàn bộ điều khiển học thẻ/ngẫu nhiên và bộ lọc/ngữ cảnh học liệu của web. Đây là phần chưa làm. |
| Quiz | `/quiz` | Lối tạo/nhập/làm bài | Đủ luồng chính: `study/quiz` | Mobile thêm kho bộ cục bộ; không dùng API Quiz mẫu làm danh sách bộ cá nhân. |
| Tạo Quiz | `/quiz/manual` | Câu/lựa chọn/đáp án | Đủ luồng chính: `study/editor?kind=quiz` | Lưu AsyncStorage theo tài khoản; không gọi API tạo bộ RAM chung. Có giải thích tùy chọn. |
| Nhập Quiz | `/quiz/upload` | Excel/JSON, chuẩn hóa | Đủ luồng chính: `study/import?kind=quiz` | Xem trước/xác nhận; server lỗi toàn tệp không trả phần hợp lệ để nhập riêng. Mobile yêu cầu đúng bốn lựa chọn. |
| Làm Quiz | `/quiz/play` | Chấm, xáo trộn, kết quả | Đủ luồng chính: `study/quiz-play` | Có thời gian/câu sai/làm lại; không lưu lượt đang làm sau đóng app, không cộng điểm tài khoản. |
| Flashcard | `/flashcard` | Danh sách/lọc/tìm, nhập/quản lý bộ | Đủ luồng chính: `study/flashcard`, `study/import?kind=flashcard` | Kho mobile độc lập web/server; chưa đồng bộ chéo thiết bị. |
| Tạo Flashcard | `/flashcard/manual` | Mặt trước/sau | Đủ luồng chính: `study/editor?kind=flashcard` | Không có trường ghi chú riêng trong hợp đồng hiện tại; cấp/chủ đề là metadata cục bộ. |
| Học Flashcard | `/flashcard/play` | Lật, trước/sau, nhớ/chưa nhớ, thống kê | Đủ luồng chính: `study/flashcard-play` | Chạm lật, nút trước/sau; chưa có vuốt chuyển thẻ; không khôi phục lượt sau đóng app. |
| Kanji | `/kanji` | Tra, vẽ/nhận dạng, luyện viết, mẫu/nét, sửa nhãn | Một phần: `kanji`, `kanji/[character]`, `kanji-write` | Nhận dạng manual; chưa tự nhận dạng/replay nét người dùng/gửi sửa nhãn. Chấm luyện viết chỉ đối chiếu ứng viên đầu và số nét, chưa port điểm heuristic chi tiết web. |
| Hồ sơ | `/profile` | Thông tin/cấp/mục tiêu, điểm/streak/lịch | Đủ luồng chính: `(tabs)/personal` | Đã sửa cập nhật ngay sau lưu; mục tiêu JLPT nằm trong `learning_goals`, không thêm API field. |
| Phân tích tổng hợp | `/analytics` | Trang dự kiến analytics | Chưa có trang riêng | Chính trang web hiện là placeholder, chưa nối dữ liệu thật. Mobile có tiến độ ngữ pháp/lịch ngày/thống kê thẻ ở từng màn. |
| Cài đặt | `/settings` | Ngôn ngữ/theme, tài khoản/dữ liệu | Có phần chính: `(tabs)/personal/settings`, `export-data` | JSON dạng phần/copy/Share; chưa tự ghi Downloads. Export backend chưa bao gồm kho study mobile. |
| Cửa hàng | `/shop` | Theme/nền, giá/điểm, mua/equip/preview | Đủ luồng chính: `theme-shop` | Mục server thiếu palette/ảnh/bản dịch vẫn hiện trạng thái chưa hỗ trợ; mascot thiếu ở web chưa được tạo thay. |
| Hằng ngày | `/daily` | Bài/tiếp tục/phản hồi, điểm/streak/lịch | Đủ luồng chính: `(tabs)/daily`, `daily-exercise` | Server quyết định ngày/điểm; chống gửi lặp một client không thay idempotency nhiều thiết bị. |
| Nhắc học | `/settings/reminders` | Giờ/gợi ý học, đăng ký/test Web Push | Chưa có mobile | Chưa triển khai; Web Push trình duyệt không dùng nguyên trạng trên React Native. Remote push native cần thiết kế/build/cấu hình riêng. |
| Bài nghe | `/listening` | Danh sách/tạo từ Library/sửa bài | Chưa có mobile | Chưa chuyển màn và luồng audio; backend/VoiceVox đã có phần lõi. |
| Phát bài nghe | `/listening/:id` | Audio/transcript/điều khiển đoạn | Chưa có mobile | Cần chọn module audio khớp SDK và thử gián đoạn/nền trên hai hệ điều hành. |
| Tuyến khác | `*` | Chuyển login/Chat tùy phiên | `+not-found`, guard | Mobile hiện trang không tồn tại; không phải thiếu chức năng nghiệp vụ. |

## Mobile: trạng thái triển khai hiện tại

Năm tab: **Hằng ngày, Trò chuyện, Thư viện, Luyện tập, Cá nhân**. Màn viết bằng React Native, không nhúng web bằng WebView.

| Mốc/phần | Hiện trạng |
|---|---|
| Giai đoạn 0–1 | JWT/SecureStore, khôi phục/401/offline, Hằng ngày, Thư viện, i18n/theme, guard và biên lỗi. |
| Giai đoạn 2–3 | Chat/thư mục, phân tích và phiên luyện ngữ pháp/tiến độ, từ điển/nét/Quiz Kanji, sửa hồ sơ, cài đặt/xuất/reset/xóa, kiểm tra kết nối. |
| Giai đoạn 4 | Quiz/Flashcard theo bộ cục bộ, tạo/sửa/nhập/học, lọc/quản lý, chống ghi trùng/lỗi dữ liệu. |
| Cửa hàng bổ sung | Mọi theme/nền server, preview sáng/tối, xác nhận mua bằng điểm kèm áp dụng, equip, đồng bộ rewards profile. |
| Kanji viết tay bổ sung | PanResponder + SVG, nét mượt/undo/clear/khóa cuộn, PNG chuẩn hóa, nhận dạng và mẫu/luyện chữ. |
| Bàn phím bổ sung | Wrapper chung đo viewport/header/safe area thực và composer nhiều dòng; không dùng offset cố định cho mọi màn. |
| Sửa gần nhất | Nền đặc theo theme ở màn trò chơi để tiêu đề không lẫn nền; chọn màu nút tương phản và không làm mờ đáp án khóa; lưu hồ sơ đồng bộ session/cache, hủy GET cũ và cập nhật cấp mặc định Ngữ pháp. |

### Hằng ngày, Ngữ pháp và kết nối

- **Hằng ngày:** lấy ngày/tiến độ/lịch/điểm từ server; bắt đầu hoặc tiếp tục đúng mục chưa trả lời, làm từng câu, phản hồi/giải thích/ví dụ, xác nhận thoát, tổng kết và đếm ngược lượt tiếp theo. Điều khiển gồm trắc nghiệm vocab/Kanji, điền chỗ trống, xếp từ, đúng/sai, chia dạng và Flashcard tự đánh giá.
- Đếm ngược dựa ngày API, HTTP Date và đồng hồ monotonic, theo giả định múi giờ server UTC+07. Mất phản hồi sau nộp đáp án phải đối soát trạng thái server trước gửi lại. Chưa có idempotency key bảo đảm đúng một lần giữa nhiều thiết bị; điểm không được tự tính/cộng lại ở client.
- **Ngữ pháp:** chọn cấp JLPT, mẫu/dạng câu, số câu, nguồn ngân hàng/AI/mixed; gửi đáp án từng câu, phản hồi, hoàn thành và kết quả. Tiến độ gồm độ chính xác theo cấp, mẫu yếu và hoạt động gần đây. Phân tích câu nhận ngôn ngữ phản hồi qua API.
- Chẩn đoán AI trước đây xác nhận mobile/web cùng đường `/grammar-practice/sessions`; lỗi 404 có thể do model sinh thiếu trường bắt buộc và không còn câu hợp lệ, không phải luôn do thiếu route. Khi AI lỗi, mobile báo rõ và chọn lại ngân hàng cho lần bắt đầu tiếp; không tự POST lại hoặc xóa phiên/kết quả cũ. Mixed ít câu vẫn giữ phiên và cảnh báo. Chi tiết: [`mobile/docs/GRAMMAR_AI_404.md`](mobile/docs/GRAMMAR_AI_404.md).
- **Kết nối/phiên:** kiểm tra health khi ứng dụng hoạt động, kiểm tra lại/refetch khi mạng phục hồi; không tự phát lại mutation để tránh gửi trùng. Có skeleton/loading/trạng thái trống/lỗi, biên lỗi, SecureStore và xử lý JWT hết hạn. Mở app mới khi backend không truy cập được có thể phải khôi phục/xác minh phiên trước khi mở màn riêng tư.

### Dịch, theme và đồng bộ tài khoản

Mobile nhập **11 namespace web** cùng hai locale mobile vi/en trong i18next; palette đọc trực tiếp `frontend/src/themes/themes.ts`, không chép tay. Giữ `frontend/` và `mobile/` cạnh nhau khi chạy/build. Nhãn/nút/lỗi có dịch; nội dung học, tên bộ do người dùng nhập hoặc thông báo chi tiết server không tự được dịch.

Theme/nền đang dùng và sở hữu lưu trên server theo tài khoản; sáng/tối/hệ thống lưu riêng thiết bị. Cửa hàng không lọc mất mục chưa mua/thiếu tài nguyên. Đã đóng gói **13 WebP khoảng 1,23 MB** từ web, có lớp phủ theo theme; màn chơi dùng nền đặc cho tiêu đề rõ. Không tải mọi mascot hoặc tự tạo tài nguyên nguồn bị thiếu.

| API cửa hàng | Hành vi |
|---|---|
| `GET /rewards/shop` | Toàn bộ themes/backgrounds, giá và trạng thái server. |
| `GET /rewards/me` | Số dư, quyền sở hữu, theme/nền đang dùng. |
| `POST /rewards/shop/purchase` | `{item_type,item_id,equip:true}`; xác nhận tên/giá/số dư trước–sau. |
| `PUT /rewards/equip` | Theme hoặc background đã sở hữu; background null trở về mặc định theme. |

Giá lấy từ API, không lấy giá gợi ý trong file theme. Thiếu điểm hiện số thiếu; khóa thao tác trùng. Mất phản hồi sau mua chỉ đọc đối soát, không POST mua lại mù quáng. Theme/nền khôi phục khi đăng nhập/đổi máy; mode sáng/tối không đồng bộ chéo máy. Chưa xác nhận giao dịch thật với tài khoản người dùng trên điện thoại.

Hồ sơ dùng session chung và cache `['profile', userId]`. Bản sửa mới hủy lượt tải cũ trước/sau lưu rồi công bố response PUT cho cả hai nguồn; không để GET cũ ghi đè kết quả. Chọn cấp Ngữ pháp theo dõi thay đổi cấp hồ sơ. Mục tiêu JLPT lưu dạng `JLPT N3` trong `learning_goals`, không tự đổi cấp hiện tại nếu chỉ đặt mục tiêu.

Cài đặt có ngôn ngữ đồng bộ server, mode tại thiết bị, phiên bản/ghi công, thông tin kết nối, xuất/reset/xóa và đăng xuất. Export là dữ liệu backend dạng JSON có thể chọn/copy/Share. Reset/xóa yêu cầu cảnh báo và gõ từ xác nhận, khóa gửi lặp. Theo response backend, reset xóa chat/hội thoại voice/learning sessions/grammar attempts nhưng **giữ thư mục Chat, rewards, daily tasks, study-item stats, reminder settings và push subscriptions**; không dùng reset để nhận điểm lần nữa. Reset server không phải xóa kho study cục bộ. Không hứa xóa tài liệu Library theo chủ sở hữu khi model chưa có owner metadata.

### Quiz/Flashcard: lưu bộ, nhập tệp và làm bài

- Web dùng helper storage tại trình duyệt; mobile dùng AsyncStorage có version, khóa `senpaiai.study.account.<id>`. Đăng xuất giữ kho cho lần đăng nhập lại của cùng tài khoản; gỡ app/xóa dữ liệu OS làm mất bộ. Đây là phân tách trong app, không phải mã hóa nội dung.
- Giới hạn **100 bộ/tài khoản**, **500 mục/bộ**, **1,5 MiB JSON UTF-8/tài khoản**, **10.000 ký tự/trường nội dung**, tên bộ 120 ký tự. Ghi tuần tự; báo dữ liệu hỏng/phiên bản tương lai, không tự ghi đè/xóa.
- Danh sách có tìm tên/tệp, lọc JLPT/chủ đề/nguồn, kéo làm mới, sửa/đổi tên/nhân bản/xóa xác nhận. Biểu mẫu thêm/xóa mục, bốn lựa chọn/đáp án, giải thích tùy chọn hoặc hai mặt thẻ; bảo vệ dữ liệu chưa lưu.
- Quiz nhận `.xlsx/.xls/.json`; Flashcard nhận `.xlsx/.xls/.csv/.json`. Tệp tối đa **5 MiB**, JSON **1 MiB**; DocumentPicker sao vào cache để đọc, kiểm tra dung lượng thật, xóa cache sau xử lý. Preview ảo hóa, chỉ xác nhận mới lưu; hủy không lưu.
- Quiz JSON đọc tại thiết bị; mobile chỉ gọi `POST /game/quiz/upload` và `POST /game/flashcard/import` cho luồng nhập cần server. Timeout 45 giây, hủy được, không tự retry POST. API lỗi toàn tệp thì giữ thông báo/số dòng, không bịa danh sách phần hợp lệ.
- Chấm Quiz/chuẩn hóa đáp án dùng quy tắc web, test so helper thật. Có xáo trộn câu/lựa chọn, phản hồi ngay, tiến độ, điểm/thời gian/câu sai, làm lại toàn bộ/câu sai và xác nhận thoát. Dùng lại `QuestionCard` của Hằng ngày/Ngữ pháp.
- Flashcard lật 3D bằng Animated, nút trước/sau, nhớ/chưa nhớ, xáo trộn/đổi bộ, tiến độ/tổng kết; thống kê tích lũy lưu tại máy. Mỗi thẻ chỉ đánh dấu một lần/lượt, bắt đầu lại tạo lượt mới.
- Chưa lưu lượt đang làm sau đóng app; chưa đồng bộ sang web/server/máy khác, chưa xuất/nhập toàn kho. Quiz không cộng điểm tài khoản. Kho chỉ truy cập sau khi xác minh phiên; chưa coi đây là ứng dụng hoàn toàn offline khi khởi động không có backend.

**Backend game giữ `USER_QUIZ` và `USER_FLASHCARD` trong RAM dùng chung tiến trình**, mất khi restart, không phân tài khoản. GET Quiz trả câu mẫu cố định; submit chỉ so hai giá trị client gửi, không phải phiên thi chấm/lưu điểm đáng tin cậy. Vì vậy mobile không dùng API tạo/list/submit này làm kho study cá nhân. Kết luận RAM dựa mã nguồn, chưa thử restart server thật. Chi tiết hợp đồng/khác biệt parser: [`mobile/docs/PHASE4.md`](mobile/docs/PHASE4.md).

### Kanji: nhận dạng và luyện viết mobile

- Vào `kanji-write` từ danh sách Kanji để nhận dạng, hoặc từ chi tiết chữ để luyện theo nét mờ. Có lưới vuông, nhiều nét mượt, undo/clear, một ngón bắt đầu vẽ, khóa scroll khi vẽ; ứng viên kèm phần trăm và nút mở nghĩa/On/Kun/ví dụ/hoạt ảnh nét.
- Khung logic **720×720**. Chuẩn hóa toàn chữ vào **256×256**, giữ tỉ lệ/căn giữa/lề **13%**. Nét là mảng theo thứ tự, mỗi nét là mảng `{x,y,timestamp,pressure,strokeId}`; PNG trắng/đen không kèm lưới/mẫu/theme.
- Web/backend không đặt trần số điểm. Mobile chuẩn hóa bằng toàn điểm capture, giảm về tối đa **256 điểm/nét** trong payload, giữ đầu/cuối/metadata; capture tối đa 4.096 điểm/nét, bỏ chuyển động dưới 1 pixel logic, pressure ngón tay 0,5. Ảnh dùng toàn điểm capture.
- PNG mobile dùng raster nhị phân/cùng hình học quadratic; biên có thể khác nhẹ browser antialias/threshold. Test chứng minh schema và chuẩn hóa khớp helper web, không khẳng định ảnh giống từng byte.
- `/kanji/model-info` cung cấp availability, cấp và nhãn thật. `/kanji/supported` là phạm vi vector, không phải nhãn nhận dạng. API kiểm tra ngày **14/11/2026**: **245 nhãn N5/N4**, **6.703 mục vector** (có cả mục không phải Kanji). Không suy ra nhận dạng mọi chữ N5/N4 hoặc N3. Số liệu phải đọc lại sau thay model.
- Chỉ nhận dạng khi bấm; hủy yêu cầu khi viết tiếp/undo/clear/rời màn; timeout 20 giây, chống gửi trùng. Chữ đích ngoài nhãn được báo chưa kiểm tra được, vẫn xem mẫu khi có nét. Chữ tự do ngoài nhãn có thể bị đoán thành một nhãn đã huấn luyện, kể cả confidence cao.
- Luyện viết so ứng viên đầu với chữ đích và số nét thực/mẫu, có mẫu viết tay ETL nếu có, dùng lại hoạt ảnh nét. Chưa chấm chính xác từng nét/thứ tự; chưa port điểm heuristic chi tiết web, chưa tự nhận dạng/replay nét người dùng. Gửi sửa nhãn **chủ ý hoãn** theo ưu tiên tùy chọn cuối; UI tương lai phải hỏi đồng ý gửi.
- Server lưu cả mẫu nhận dạng thường, không chỉ correction; UI đã thông báo. Hủy request không thu hồi mẫu server đã nhận. Confidence là điểm model/rerank, không phải phép đo accuracy. CNN hiện bỏ qua hint JLPT và hình học nét, dịch vụ dùng số nét để rerank.
- Chưa đo accuracy ngón tay trên điện thoại thật/bộ đánh giá đại diện, không công bố tỷ lệ chính xác. Lọc một touch không phải palm rejection phần cứng; hiệu năng máy tầm trung chưa đo.

Hợp đồng endpoint, response và checklist: [`mobile/docs/KANJI_WRITING.md`](mobile/docs/KANJI_WRITING.md).

### Bàn phím và các bản sửa giao diện gần nhất

`KeyboardLayout`, `KeyboardScrollView`, `KeyboardFlatList`, `KeyboardInput` đo phần viewport thực giao bàn phím; xử lý header/tab/safe area/xoay, tránh bù hai lần nếu Android đã resize. Android cấu hình `softwareKeyboardLayoutMode: resize`, không dựa vào tắt edge-to-edge. iOS theo frame bàn phím; Android theo show/hide và đo lại layout.

Chat có composer là sibling danh sách đảo chiều, tự giãn có trần, giữ nút gửi và cuộn tới tin cuối khi focus/mở/đổi bàn phím. Wrapper chung áp dụng Chat, editor Library, đăng nhập/đăng ký, bài ngày, Ngữ pháp/phân tích, Hồ sơ, Cài đặt và form/modal study. Kéo cuộn đóng bàn phím, giữ draft, phần tử danh sách vẫn bấm được. Màn hội thoại ở ngoài tab nên không cộng chiều cao tab giả.

Lỗi Android khung gõ bị che đã được người dùng báo; mã sửa/test geometry đã có nhưng người dùng chưa xác nhận lại trên điện thoại. Tai thỏ/home, bàn phím Nhật/emoji/đa dòng/đổi chiều cao, màn nhỏ/ngang và điều hướng Android vẫn cần thử thực. Không bảo đảm JS bám mọi frame IME.

Bản sửa theo phản hồi mới nhất: màn chơi Quiz/Flashcard/hub dùng nền đặc `colors.bg` để tiêu đề không lẫn ảnh/gradient, các nút chọn màu chữ theo độ tương phản và không hạ opacity toàn bộ khi khóa sau trả lời. Kết quả tự động đã đạt; chưa có xác nhận thị giác sau sửa từ điện thoại. Chẩn đoán/checklist bàn phím: [`mobile/docs/KEYBOARD.md`](mobile/docs/KEYBOARD.md).

### Chạy mobile và khác biệt hệ điều hành

```powershell
cd mobile
npm.cmd ci
# Chỉ tạo .env nếu chưa tồn tại; không chép đè cấu hình đang dùng.
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm.cmd run start:clean
```

Node theo `engines` trong `mobile/package.json`. `EXPO_PUBLIC_API_URL` kết thúc bằng `/api`; backend nghe `0.0.0.0:8000`. Metro tunnel không tự tạo tunnel API. `ALLOWED_HOSTS` phải chứa host truy cập; kiểm tra `http://IP-LAN:8000/health` trên điện thoại. IP LAN có thể đổi theo DHCP; không đưa khóa backend vào `EXPO_PUBLIC_*`.

| Nơi chạy | URL backend ví dụ |
|---|---|
| Android Emulator | `http://10.0.2.2:8000/api` |
| Android/iPhone thật cùng LAN | `http://192.168.1.3:8000/api`, thay bằng IP máy backend thực |
| iOS Simulator cùng máy backend | `http://localhost:8000/api` |
| Thiết bị ngoài LAN | HTTPS tunnel backend riêng, URL kết thúc `/api` |

Phiên bản hiện tại: **Expo 58.0.23, React Native 0.88.1, React 19.3.0, Expo Router 58.0.30, React Query 3.39.3**. Web React 18; không chia sẻ `node_modules` hai app. Intl polyfill nạp trước i18next; React Query có override giới hạn/test tương thích. SVG, DocumentPicker, FileSystem, Haptics dùng phiên bản cài qua Expo; không thêm custom native module cho các luồng đã làm.

| Nội dung | Android | iPhone |
|---|---|---|
| Expo Go | Cần bản hỗ trợ SDK dự án | Cũng cần khớp SDK; không mặc định mọi bản App Store đều tương thích |
| Dev build cũ | Build lại nếu chưa có module mới | Tương tự; export JS không bổ sung module native bị thiếu |
| Công cụ từ Windows | Máy thật hoặc Android Emulator | Metro/backend phục vụ iPhone thật; iOS Simulator cục bộ cần Mac/Xcode |
| Cần thử riêng | Back hệ thống, gesture/3 nút, resize/IME, URI tài liệu | Swipe-back, notch/home, quyền LAN, Files/iCloud, frame bàn phím |
| Tính năng tương lai | Audio/ghi âm/push cần chọn module/quyền phù hợp | Remote push native không dùng nguyên Web Push; cần build/cấu hình riêng |

Các chức năng mobile đã triển khai hướng tới Expo Go khớp SDK. Chưa phát hành App Store/Play Store hoặc coi export là build APK/IPA; lần cập nhật tài liệu không nâng SDK hay đổi API.

## Kiểm tra và mức độ xác nhận

Kết quả **lượt kiểm tra mã gần nhất trước lần cập nhật tài liệu 15/11/2026**:

| Hạng mục | Kết quả đã ghi nhận | Giới hạn |
|---|---|---|
| Mobile `npm.cmd run check` | Typecheck, lint, **91/91 test**, khóa dịch và nhãn JSX đạt | Không phải thao tác giao diện native trên máy thật |
| Web `npm.cmd run i18n:check` | Khóa/giá trị dịch hợp lệ | Không khẳng định đã chạy lại toàn bộ test/build/chức năng web |
| Mobile `npm.cmd run export:check` | Bundle Hermes/assets **Android và iOS đạt** | Không phải APK/IPA ký/cài/phát hành |
| Nhập bộ Giai đoạn 4 | Đã ghi nhận **8 kiểm tra parser trực tiếp + 8 HTTP** đạt | Không chạy lại toàn bộ API ở lần sửa tài liệu này |
| API Kanji | Model-info/supported HTTP 200 và phạm vi đã nêu | Không phải accuracy hay ảnh ngón tay trên máy thật |
| Test mới gần nhất | GET hồ sơ cũ không ghi đè PUT, không hồi sinh profile sau logout, tương phản mọi theme sáng/tối | Không thay kiểm tra thị giác/font/thiết bị |
| Expo Go runtime | Người dùng từng xác nhận vào được ứng dụng sau làm sạch Metro để xử lý hook/LogBox | Không chứng minh mọi màn hoặc bản sửa sau đã được thử |

Các số 26/44/56/80/88 test trong báo cáo giai đoạn là lịch sử; **91** là kết quả gần nhất. Lần này chỉ sửa `SenpaiAI.md`, kiểm tra cấu trúc/liên kết tài liệu; không tự tạo tài khoản, giao dịch mua hoặc mẫu correction mới.

```powershell
cd mobile
npm.cmd run check
npm.cmd run export:check
npm.cmd run backend:check
# Smoke có thể tạo dữ liệu thử: đọc hướng dẫn script trước khi chạy.
npm.cmd run smoke:phase4
cd ../frontend
npm.cmd run i18n:check
```

**Còn cần xác nhận trên Android và iPhone thật:** màu tiêu đề/nút từng theme, lưu hồ sơ không reload, Chat và IME Nhật/emoji/đa dòng/ngang; tạo/nhập/làm Quiz/học Flashcard/mất mạng; vẽ nhiều nét/scroll/multi-touch/đúng-sai/ngoài phạm vi; mua đủ/thiếu điểm/đổi tài khoản/đăng nhập lại; Files/iCloud, haptics, safe area và gesture back. Checklist theo luồng nằm trong tài liệu tham chiếu cuối báo cáo.

## Thư viện và dữ liệu học liệu

Thư viện lưu tài liệu trong PostgreSQL và lập chỉ mục nội dung trong ChromaDB. API hiện tại chưa có owner_id trong model Document, chưa trả `scope`, `is_mine`, `can_edit`, `can_delete` trong list/search/detail và chưa thực thi bộ lọc phạm vi. Một số nhãn và tùy chọn trên web thể hiện thiết kế dự kiến, không phải bằng chứng rằng tài liệu cá nhân đã được bảo vệ ở backend. Không dùng dữ liệu nhạy cảm với giả định rằng tài liệu mới chỉ mình người tạo xem được.

Để hoàn thiện phạm vi cá nhân/hệ thống, backend cần xác định owner từ JWT, trả metadata quyền và kiểm tra quyền khi đọc/sửa/xóa, tìm kiếm và truy xuất RAG. Mobile hiện không tự suy đoán: bộ lọc phạm vi không đủ thông tin bị khóa, huy hiệu ghi chưa rõ phạm vi, sửa/xóa chỉ mở khi API xác nhận quyền. Biểu mẫu mới vẫn gọi API tạo tài liệu hiện có và nêu rõ giới hạn riêng tư.

Nhập URL chỉ chấp nhận HTTP/HTTPS và có kiểm tra loại/độ dài nội dung đọc về. Dữ liệu mẫu tiếng Việt ở `backend/scripts/data/library_documents.json`, bản tiếng Anh ở `backend/scripts/data/library_documents.en.json`; script nạp là `backend/scripts/seed_library_documents.py`. Hai tài liệu N3 từng bị lưu thành dấu `?` đã được khôi phục dữ liệu nguồn và bản ghi đang lưu; đây là lỗi dữ liệu bị mất ký tự, không chỉ là lỗi font.

Tài liệu là nội dung tham khảo, không phải một buổi luyện. Tạo câu hỏi ngữ pháp từ Library sẽ sinh câu hỏi có nhãn cấp độ/dạng bài, lưu các câu hợp lệ vào ngân hàng và trả về ID của chúng. Người học có thể bắt đầu luyện trực tiếp các câu vừa tạo; một buổi luyện lưu câu trả lời, phản hồi, điểm và danh sách câu sai riêng với tài liệu nguồn. Hệ thống cũng hỗ trợ sinh bài nghe từ tài liệu, chỉnh sửa lời thoại rồi lưu thành bài nghe.

## Kanji: nhận dạng và huấn luyện model

Từ điển cục bộ được báo cáo gồm 612 chữ N5/N4/N3; đây là phạm vi từ điển, khác 245 nhãn N5/N4 của model kiểm tra ngày 14/11/2026; thứ tự nét lấy từ dữ liệu KanjiVG kèm nguồn và giấy phép. Recognizer nạp model cùng `label_map.json`; số lớp và cấp JLPT hiển thị được suy ra từ label map. Model đang dùng trong `backend/ml/models/` được giữ tách biệt với model ứng viên. Không thay model đang chạy chỉ dựa trên độ chính xác validation tổng hợp.

Quy trình huấn luyện ứng viên được mô tả tại [`backend/ml/README.md`](backend/ml/README.md): sinh ảnh từ các font tiếng Nhật đã kiểm tra glyph, ghép thêm ETL10 và mẫu người dùng đã hiệu chỉnh nếu có, cân bằng lớp, theo dõi validation N5/N4/N3, lưu checkpoint có thể resume và đánh giá top-1/top-5 trên bộ chữ viết tay held-out. Mọi artifact ứng viên được lưu trong thư mục riêng như `backend/ml/models/n3_candidate/`. Sau khi đạt tiêu chí chất lượng, cần sao lưu đồng thời model và label map trước khi thay thủ công; hướng dẫn khôi phục cũng nằm trong README huấn luyện.

## Nghe và cấu hình dịch vụ AI

VoiceVox được dùng để tổng hợp audio bài nghe khi bài học chưa có file audio. Trong Docker Compose, backend kết nối dịch vụ nội bộ `http://voicevox:50021`; khi chạy backend trực tiếp trên máy, cấu hình `VOICEVOX_URL` phải trỏ tới địa chỉ VOICEVOX mà máy đó truy cập được. Lỗi kết nối hoặc tổng hợp được trả về ở API audio và không đồng nghĩa với lỗi font hiển thị nội dung tiếng Nhật. Whisper/faster-whisper phục vụ nhận dạng tiếng nói và có thể cần tải model ở lần chạy đầu.

## Ghi chú cấu hình

- PostgreSQL là bắt buộc cho backend. URL mặc định và thông tin trong Compose phục vụ phát triển cục bộ; hãy thay bằng thông tin an toàn khi triển khai.
- Ollama là provider mặc định. Nếu chọn OpenAI, cần cung cấp `OPENAI_API_KEY`.
- Whisper có thể tải model lớn khi khởi tạo lần đầu; `WHISPER_MODEL_SIZE`, `WHISPER_DEVICE` và `WHISPER_MODEL_DIR` điều khiển cấu hình này.
- Nhắc học chạy trong backend khi `REMINDERS_ENABLED` bật. Thông báo đẩy cần cấu hình cặp khóa VAPID.
- `backend/app/main.py` tạo các bảng SQLAlchemy khi khởi động; thay đổi schema đã có cần được quản lý bằng migration Alembic.

## Phần còn thiếu và thứ tự đề xuất

| Ưu tiên | Hạng mục | Giá trị / độ khó | Phụ thuộc và hướng Expo |
|---|---|---|---|
| 1 | Kiểm tra thiết bị cho các bản sửa mới | Cao / vừa | Dùng Expo Go khớp SDK; ưu tiên tiêu đề trò chơi, lưu hồ sơ, Chat/bàn phím và vẽ Kanji trước khi mở rộng. |
| 2 | Hoàn thiện quyền tài liệu | Cao / vừa–cao | Cần backend owner/scope/quyền ở đọc/sửa/xóa/tìm/RAG; client không giải quyết chỉ bằng ẩn nút. UI không cần native build riêng. |
| 3 | Kho bộ học bền vững/đồng bộ và export study | Cao / vừa–cao | Đồng bộ cần API theo tài khoản; export cục bộ có thể thiết kế bằng module Expo phù hợp. Không dùng RAM game chung làm kho cá nhân. |
| 4 | Bài nghe và tạo bài từ Library | Cao / vừa | Backend có phần lõi; cần màn và audio module khớp SDK, kiểm tra gián đoạn/nền. Chưa kết luận cần build riêng khi chưa chốt module/phạm vi. |
| 5 | Ghép cặp/nhập âm đọc, phần viết tay còn lại | Vừa / thấp–vừa | UI trò chơi và sửa nhãn có thể dùng Expo Go; correction phải có đồng ý gửi. Chấm từng nét chính xác cần thêm thuật toán/dữ liệu hoặc API. |
| 6 | Ghi âm/luyện nói và nhắc học native | Vừa–cao / vừa–cao | Cần module/quyền mic/upload/phiên nói; remote push native cần build/cấu hình thông báo riêng, không dùng nguyên Web Push. |
| 7 | Analytics tổng hợp | Vừa / vừa | Web còn placeholder; cần định nghĩa chỉ số/dữ liệu thật, tận dụng tiến độ đã có. |

Các mục phụ còn thiếu đã ghi theo từng tuyến: kéo/sắp xếp thư mục, toàn bộ thao tác thẻ Kanji/ngẫu nhiên/ghép cặp/nhập âm đọc, vuốt Flashcard, tự nhận dạng/replay nét/sửa nhãn, nhập một phần khi tệp lỗi, tự ghi export vào Downloads và khôi phục lượt study sau đóng app. Không coi các mục này là đã có chỉ vì xuất hiện ở web hoặc có API liên quan.

## Tài liệu tham chiếu trong dự án

- [`mobile/README.md`](mobile/README.md): hướng dẫn ứng dụng; một số đoạn giữ lịch sử giai đoạn.
- [`mobile/docs/ARCHITECTURE.md`](mobile/docs/ARCHITECTURE.md): kiến trúc và luồng dữ liệu.
- [`mobile/docs/SCREENS.md`](mobile/docs/SCREENS.md): bản đồ màn hình theo mốc cũ; bảng trong tài liệu này đã bổ sung study và viết Kanji.
- [`mobile/docs/DEMO_CHECKLIST.md`](mobile/docs/DEMO_CHECKLIST.md): mạng, demo, đóng gói và thiết bị.
- [`mobile/docs/GRAMMAR_AI_404.md`](mobile/docs/GRAMMAR_AI_404.md): chẩn đoán AI không có câu hợp lệ và fallback ngân hàng.
- [`mobile/docs/PHASE4.md`](mobile/docs/PHASE4.md), [`mobile/docs/samples/study/`](mobile/docs/samples/study/): lưu bộ, nhập tệp, mẫu hợp lệ/sai và checklist.
- [`mobile/docs/THEME_SHOP.md`](mobile/docs/THEME_SHOP.md), [`mobile/docs/THEME_ASSETS.json`](mobile/docs/THEME_ASSETS.json): mua/equip, giá server, ảnh/mascot và kiểm thử.
- [`mobile/docs/KEYBOARD.md`](mobile/docs/KEYBOARD.md): chẩn đoán Android/iPhone, wrapper và checklist bàn phím.
- [`mobile/docs/KANJI_WRITING.md`](mobile/docs/KANJI_WRITING.md): PNG/nét, phạm vi mô hình, khác biệt web và checklist viết/luyện.
- [`backend/ml/README.md`](backend/ml/README.md): huấn luyện/đánh giá, model ứng viên và khôi phục model.
