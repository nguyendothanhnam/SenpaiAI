# SenpaiAI

SenpaiAI version 1.3 hỗ trợ học tiếng Nhật qua ứng dụng web và ứng dụng di động React Native. Web dùng React/Vite; mobile dùng Expo và cùng gọi backend FastAPI bằng JWT. Dự án kết hợp trợ lý AI, học liệu Library, các buổi luyện có lưu tiến độ, nhận dạng kanji, bài nghe và các công cụ duy trì thói quen học.

Tài liệu cập nhật ngày **05/11/2026**, theo mã nguồn trên nhánh **`mobile`**. Ứng dụng di động đã có Giai đoạn 0 và 1; phạm vi và giới hạn của mobile được tách rõ với các tính năng đã có trên web. Hướng dẫn chi tiết: [`mobile/README.md`](mobile/README.md).

## Tính năng

- **Tài khoản và hồ sơ:** đăng ký, đăng nhập bằng JWT, cập nhật hồ sơ, chọn cấp độ JLPT và theo dõi hoạt động học.
- **Chat AI trên web:** hỏi đáp tiếng Nhật có thể dùng ngữ cảnh tài liệu qua RAG và các lượt gần đây trong cùng hội thoại. Có danh sách hội thoại, tìm kiếm, ghim, đổi tên, thư mục, chuyển thư mục, phân trang tin nhắn và xóa hội thoại. Tab Chat trên mobile hiện vẫn là màn hình tạm.
- **Phân tích và dịch:** phân tích ngữ pháp, dịch Nhật–Việt/Việt–Nhật và dự đoán cấp độ JLPT.
- **Thư viện:** duyệt, tìm kiếm, thêm tài liệu, nhập nội dung từ URL; xem danh mục và thống kê. Backend hiện có endpoint sửa/xóa nhưng chưa cung cấp thông tin chủ sở hữu và quyền theo tài liệu; chưa thể coi chế độ cá nhân/hệ thống là tính năng đã được thực thi. Mobile khóa sửa/xóa nếu không có xác nhận quyền từ API. Nội dung được lập chỉ mục trong ChromaDB để hỗ trợ tìm kiếm ngữ nghĩa và RAG.
- **Luyện tập:** quiz thủ công hoặc nhập từ tệp, flashcard, trò chơi từ vựng/kanji, bài luyện ngữ pháp theo phiên và thử thách hằng ngày. Có thể sinh câu hỏi ngữ pháp từ tài liệu Library, lưu vào ngân hàng rồi bắt đầu luyện trực tiếp các câu vừa tạo.
- **Kanji:** tra từ điển JLPT N5/N4/N3, xem thứ tự nét và metadata KanjiVG, luyện quiz/ghép cặp, gửi hiệu chỉnh nhận dạng. CNN PyTorch đọc lớp từ `label_map.json`; pipeline huấn luyện model ứng viên mở rộng tới 612 chữ N5/N4/N3 trong thư mục riêng.
- **Nghe và nói:** tạo/chỉnh sửa bài nghe từ tài liệu Library, phát audio tiếng Nhật tổng hợp bằng VoiceVox, hiển thị lời thoại theo đoạn; ghi âm/nhận dạng lời nói bằng Whisper.
- **Duy trì thói quen:** nhiệm vụ hằng ngày, chuỗi ngày học, điểm thưởng, cửa hàng giao diện, nhắc học và thông báo đẩy tùy cấu hình.

## Công nghệ và dịch vụ

| Phần | Công nghệ |
|---|---|
| Giao diện | React 18, TypeScript/JavaScript, Vite, Tailwind CSS, React Router, React Query |
| Ứng dụng di động | Expo SDK 58, React Native 0.88.1, React 19.3, TypeScript, Expo Router; React Query 3 và React Hook Form 7 |
| Dịch và theme mobile | i18next/react-i18next, import trực tiếp JSON vi/en và token màu của web; StyleSheet, classic sáng/tối/theo hệ thống |
| Lưu trữ mobile | JWT bằng Expo SecureStore; AsyncStorage chỉ lưu tùy chọn ngôn ngữ/giao diện, không lưu token |
| API và dữ liệu | Python 3, FastAPI, Pydantic 2, SQLAlchemy 2, Alembic |
| Cơ sở dữ liệu | PostgreSQL 15; ChromaDB cho vector tìm kiếm cục bộ |
| Tìm kiếm/RAG | ChromaDB, LangChain text splitters, embeddings theo cấu hình backend |
| AI hội thoại | Ollama mặc định trong Docker Compose; backend cũng có cấu hình OpenAI |
| Âm thanh | faster-whisper cho nhận dạng giọng nói; VoiceVox Engine cho tổng hợp tiếng Nhật và audio bài nghe |
| Nhận dạng kanji | PyTorch, NumPy, Pillow; fonttools kiểm tra font và sinh ảnh kanji trong `backend/ml/` |
| Chạy dịch vụ | Docker Compose hoặc chạy frontend/backend riêng |

## Cấu trúc thư mục

- `frontend/src/`: trang, component, dịch vụ API và giao diện React.
- `mobile/app/`: route đăng nhập, năm tab, làm nhiệm vụ và chi tiết/biểu mẫu tài liệu bằng Expo Router.
- `mobile/src/`: máy khách API, xác thực, dịch, theme, màn hình và logic Hằng ngày/Thư viện.
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

Router quản lý hội thoại nằm ở `backend/app/api/chat_conversations.py`. Endpoint danh sách hội thoại hiện lọc `mode == "text"`; không coi đây là danh sách hợp nhất đầy đủ các phiên văn bản và giọng nói. Mobile chưa triển khai Chat, luyện nói hoặc giao diện quản lý hội thoại.

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

## Ứng dụng mobile: trạng thái Giai đoạn 0 và 1

Năm tab gồm **Hằng ngày, Trò chuyện, Thư viện, Luyện tập, Cá nhân**. Giao diện viết mới bằng thành phần React Native, không nhúng web bằng WebView. Mobile dùng chung dữ liệu dịch và màu nhưng chưa tái tạo toàn bộ bố cục/ảnh/hiệu ứng của web.

| Phần | Trạng thái hiện tại |
|---|---|
| Tài khoản | Đăng ký/đăng nhập, lưu JWT bằng SecureStore, khôi phục phiên, đăng xuất, xử lý 401 và mất mạng |
| Cá nhân/Cài đặt | Hồ sơ, JLPT, điểm/streak; đổi vi/en và đồng bộ hồ sơ; classic sáng/tối/theo hệ thống |
| Hằng ngày | Ngày/tiến độ/lịch từ server; làm từng câu; phản hồi; tiếp tục; xác nhận thoát; tổng kết điểm và đếm ngược |
| Dạng câu | Ngữ pháp điền chỗ trống, xếp thẻ từ, đúng/sai, chia dạng; kanji/vocab trắc nghiệm; flashcard tự đánh giá |
| Thư viện | FlatList, tìm kiếm debounce, lọc loại/JLPT, phân trang, kéo làm mới, chi tiết chọn sao chép, thêm tài liệu và lấy nội dung URL |
| Quyền tài liệu | Chỉ bật sửa/xóa khi API xác nhận tài liệu của người dùng và quyền tương ứng; backend hiện thiếu metadata nên chức năng này còn bị khóa |
| Chưa triển khai | Chat mobile, luyện ngữ pháp/kanji độc lập, nghe/nói, ghi âm, thông báo đẩy và cửa hàng giao diện |

Đếm ngược Hằng ngày dựa vào ngày API, header HTTP Date và thời gian monotonic, với giả định múi giờ server hiện tại là UTC+07. Điểm/thưởng lấy từ API, không tính lại ở client. Trước khi gửi lại đáp án sau lỗi mạng, app kiểm tra trạng thái server để phục hồi câu đã lưu; API trả lời chưa có idempotency key nên không khẳng định bảo đảm đúng một lần giữa nhiều thiết bị.

Dịch vi/en cho nhãn/nút/lỗi lấy trực tiếp từ `frontend/src/i18n/locales`; câu mới dành cho mobile nằm trong cả hai locale mobile. Token màu import từ `frontend/src/themes/themes.ts`. Giữ hai thư mục cạnh nhau khi chạy hoặc build. Nội dung học do server trả về có thể vẫn là tiếng Việt; bản dịch giao diện không tự dịch nội dung đó. Bộ tài liệu mẫu có bản tiếng Anh qua tham số language của API.

React Query 3 cùng phiên bản chính với web nhưng chưa khai báo peer React 19; mobile có override giới hạn và test tương thích hook. Không chia sẻ `node_modules` giữa web React 18 và mobile React 19. Polyfill Intl được nạp trước i18next để hỗ trợ khóa số ít/số nhiều trên Hermes.

### Chạy mobile

Từ thư mục gốc dự án, dùng terminal riêng với backend và web:

```powershell
cd mobile
npm ci
Copy-Item .env.example .env
```

Sửa `EXPO_PUBLIC_API_URL` trong `mobile/.env` theo thiết bị rồi chạy:

```powershell
npm start -- --clear
```

Trên PowerShell chặn `npm.ps1`, dùng `npm.cmd`/`npx.cmd`. Trên macOS/Linux, thay `Copy-Item` bằng `cp`. Không cần chép đè `.env` đã cấu hình khi chỉ cập nhật mã.

| Nơi chạy | URL backend ví dụ |
|---|---|
| Android Emulator của Android Studio | `http://10.0.2.2:8000/api` |
| Android thật hoặc iPhone thật cùng Wi-Fi | `http://192.168.1.3:8000/api`, thay IP bằng IPv4 LAN thực tế của máy backend |
| iOS Simulator cùng máy Mac với backend | `http://localhost:8000/api` |
| Máy thật khác mạng | HTTPS tunnel riêng đến backend, URL kết thúc bằng `/api` |

Backend cần nghe trên `0.0.0.0:8000`. `ALLOWED_HOSTS` trong `backend/.env` phải chứa host dùng để truy cập; ví dụ `["localhost", "127.0.0.1", "0.0.0.0", "10.0.2.2", "192.168.1.3"]`. Không đặt giá trị này bằng `*` để bỏ qua kiểm tra. IP LAN có thể đổi theo DHCP, khi đó sửa URL mobile và host tương ứng rồi nạp lại cấu hình backend.

Mở `http://IP-LAN:8000/health` trên chính điện thoại để kiểm tra. Lỗi `400 Invalid host header` là backend đã nhận request nhưng từ chối host; lỗi timeout có thể do địa chỉ, tường lửa, Wi-Fi hoặc quyền mạng. Expo tunnel của Metro không tự tạo tunnel cho API cổng 8000. Thông tin kết nối chi tiết nằm trong Cài đặt; màn hình đăng nhập không hiện trạng thái thành công thường xuyên.

### Chạy Expo trên iOS khác Android thế nào?

Phần lớn mã và luồng API dùng chung. Khác biệt chính là cách cài Expo Go, địa chỉ mạng, thao tác hệ điều hành và công cụ giả lập:

| Nội dung | Android | iOS/iPhone |
|---|---|---|
| Expo Go và SDK | Có thể cài bản Android tương thích SDK từ Expo | Không thể coi bản Expo Go trên App Store là luôn tương thích SDK 58; việc cài bản khác bị giới hạn hơn |
| Máy thật từ PC Windows | Mở Expo Go và quét QR | Có thể chạy Metro/backend trên Windows rồi mở bằng iPhone thật; cần Expo Go tương thích và cấp quyền mạng cục bộ |
| Giả lập cục bộ | Android Studio Emulator chạy được trên Windows/macOS/Linux | iOS Simulator cục bộ cần macOS và Xcode; `npm run ios` không mở simulator trên Windows |
| Địa chỉ API | Emulator dùng `10.0.2.2`; máy thật dùng IP LAN | Máy thật dùng IP LAN; không dùng `10.0.2.2`. Simulator cùng máy backend có thể dùng localhost |
| Quay lại giữa bài | Nút Back hoặc cử chỉ hệ thống | Nút quay lại/swipe-back của navigation; cả hai cần xác nhận khi đang làm bài |
| Bàn phím/vùng an toàn | Theo adjustResize và thanh điều hướng của Android | Theo KeyboardAvoidingView, tai thỏ và home indicator; cần kiểm tra riêng ô nhập dài |
| Token | SecureStore dùng cơ chế lưu trữ mã hóa của Android | SecureStore dùng Keychain; vẫn dùng chung API lưu/đọc/xóa token trong mã ứng dụng |

Dự án hiện ghim **Expo SDK 58**. Theo [hướng dẫn tương thích Expo Go](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/), SDK của dự án phải khớp SDK trong bản Expo Go được cài. Trang này hiện hướng dẫn dùng `eas go` và TestFlight nội bộ cho SDK mới trên iPhone, cần Apple Developer Program; Android và iOS Simulator có thể lấy bản tương thích từ [expo.dev/go](https://expo.dev/go). Vì vậy không hứa rằng chỉ cài Expo Go từ App Store là mở được dự án này.

Nếu không có Expo Go phù hợp trên iPhone, các lựa chọn là bản Expo Go tương thích theo hướng dẫn Expo, development build, hoặc chuyển toàn bộ dependency/code về SDK bản Expo Go sẵn có hỗ trợ. Không chỉ đổi số `expo`: cần kiểm tra React/React Native, các module Expo và hook Router đang dùng (ví dụ usePreventRemove của SDK 58). Giai đoạn 1 không thêm module native bắt buộc build riêng; giới hạn SDK của Expo Go là vấn đề riêng với phạm vi tính năng.

Khi chạy iPhone qua Expo Go, [Expo hiện yêu cầu CLI và ứng dụng trên máy thật đăng nhập cùng tài khoản Expo](https://docs.expo.dev/get-started/start-developing/). Có thể dùng `npx expo login` trên máy tính; quyền Local Network của iPhone phải được cho phép khi dùng LAN. Quy trình [iOS Simulator cục bộ](https://docs.expo.dev/workflow/ios-simulator/) cần Mac, nhưng không cần Mac chỉ để phục vụ Metro cho iPhone thật. Cách lưu token khác nhau theo hệ điều hành được mô tả tại [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).

### Kiểm tra và giới hạn xác nhận

```powershell
cd mobile
npm run check
npm run export:check
```

Kết quả xác nhận ở Giai đoạn 1: TypeScript/lint đạt, **26 test đạt**, khóa dịch web/mobile vi/en hợp lệ, xuất bundle Android/iOS đạt. Script `npm run smoke:phase1 -- --create-test-account` đã kiểm tra task đầy đủ, chống nhận điểm trùng, history/rewards, thao tác tài liệu thử và lấy nội dung từ URL fixture; tài liệu/tài khoản thử đã được dọn. Khi chạy script từ PC, dùng URL PC truy cập được như localhost, không dùng địa chỉ đặc biệt của Android Emulator.

Đây chưa phải kiểm thử giao diện trên thiết bị iPhone/Android thật. Cần kiểm tra riêng bàn phím Nhật, nội dung dài, Back/swipe-back, quyền mạng, mất kết nối và lưu token. Checklist đầy đủ và những trường hợp API chưa đáp ứng nằm trong [`mobile/README.md`](mobile/README.md).

## Thư viện và dữ liệu học liệu

Thư viện lưu tài liệu trong PostgreSQL và lập chỉ mục nội dung trong ChromaDB. API hiện tại chưa có owner_id trong model Document, chưa trả `scope`, `is_mine`, `can_edit`, `can_delete` trong list/search/detail và chưa thực thi bộ lọc phạm vi. Một số nhãn và tùy chọn trên web thể hiện thiết kế dự kiến, không phải bằng chứng rằng tài liệu cá nhân đã được bảo vệ ở backend. Không dùng dữ liệu nhạy cảm với giả định rằng tài liệu mới chỉ mình người tạo xem được.

Để hoàn thiện phạm vi cá nhân/hệ thống, backend cần xác định owner từ JWT, trả metadata quyền và kiểm tra quyền khi đọc/sửa/xóa, tìm kiếm và truy xuất RAG. Mobile hiện không tự suy đoán: bộ lọc phạm vi không đủ thông tin bị khóa, huy hiệu ghi chưa rõ phạm vi, sửa/xóa chỉ mở khi API xác nhận quyền. Biểu mẫu mới vẫn gọi API tạo tài liệu hiện có và nêu rõ giới hạn riêng tư.

Nhập URL chỉ chấp nhận HTTP/HTTPS và có kiểm tra loại/độ dài nội dung đọc về. Dữ liệu mẫu tiếng Việt ở `backend/scripts/data/library_documents.json`, bản tiếng Anh ở `backend/scripts/data/library_documents.en.json`; script nạp là `backend/scripts/seed_library_documents.py`. Hai tài liệu N3 từng bị lưu thành dấu `?` đã được khôi phục dữ liệu nguồn và bản ghi đang lưu; đây là lỗi dữ liệu bị mất ký tự, không chỉ là lỗi font.

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
