# Xuất dữ liệu cá nhân

## Hợp đồng API

Tất cả đường dẫn dưới đây dùng bearer token hiện có; tài khoản lấy từ token,
không lấy `user_id` từ query hoặc payload.

| Đường dẫn (sau `/api`) | Kết quả |
| --- | --- |
| `GET /auth/me/export/download?format=json` | Tệp `senpaiai-YYYY-MM-DD.json`, lược đồ 2 |
| `GET /auth/me/export/download?format=zip` | ZIP gồm `data.json`, 37 CSV và `HUONG_DAN.txt` tiếng Việt |
| `GET /auth/me/export/report?language=vi` hoặc `en` | Tệp HTML độc lập, bố cục in A4; mở bằng trình duyệt rồi In / lưu PDF |
| `GET /auth/me/export` | Giữ hợp đồng JSON cũ để tương thích client cũ |

JSON mới: `{schema_version: 2, tables: {...}, metadata: {...}}`.
`metadata.counts` là số bản ghi thực xuất theo bảng; `truncated` và `warnings`
cho biết bảng bị cắt / bản ghi quá lớn. `unavailable` nêu các phạm vi không có.
Header `X-Export-Summary` / `X-Export-Truncated` cung cấp tóm tắt cho client;
CORS cho phép web đọc các header này. Tất cả phản hồi mới dùng `Cache-Control: no-store`.

## Đối chiếu bảng

| Dữ liệu | Bảng trong JSON / tên CSV |
| --- | --- |
| Hồ sơ, mục tiêu tuần | `users`, `weekly_learning_goals` |
| Tin nhắn, hội thoại, thư mục, giọng nói, đánh giá câu trả lời | `chat_history`, `chat_conversations`, `chat_folders`, `voice_conversations`, `chat_answer_feedback` |
| Phiên học | `learning_sessions` |
| Nhiệm vụ và từng câu trả lời, mục sai | `daily_tasks`, `daily_task_items`, `study_item_stats` |
| Điểm bài tập, ví thưởng, sổ điểm, giao diện/hình nền đã mua | `users.exercise_points`, `user_game_profiles`, `point_transactions`, `user_unlocked_items` |
| Ngữ pháp, nghe | `grammar_practice_attempts`, `listening_attempts` |
| Bài đầu vào, câu hỏi/đáp án từng lần làm | `placement_attempts`, `placement_attempt_items` |
| Lịch sử giao bài, kết quả, lịch ôn | `exercise_history`, `exercise_deliveries` |
| Bộ thẻ, từng thẻ, tiến độ, phiên học, kiểm tra, chuyển dữ liệu | `flashcard_decks`, `flashcard_cards`, `flashcard_progress`, `flashcard_sessions`, `flashcard_assessments`, `flashcard_transfers` |
| Tài liệu mới có chủ sở hữu, câu ngữ pháp và bài nghe tự tạo | `documents`, `grammar_questions`, `listening_lessons` |
| Cài đặt nhắc học, lịch sử thông báo | `reminder_settings`, `notifications` |
| Ghi chú, kết quả và báo cáo viết kanji | `user_kanji_notes`, `kanji_writing_attempts`, `kanji_writing_reports` |
| Hoạt động học trong trò chơi | `minigame_learning_events` |
| Hồ sơ và phiên mô phỏng thực tập | `internship_profiles`, `internship_sessions` |

Các phần trước đây thiếu gồm lịch sử ngữ pháp/nghe, từng câu nhiệm vụ/đầu vào,
mục tiêu tuần, toàn bộ sổ điểm và nhiệm vụ, kiểm tra thẻ, thực tập và tài liệu.
Đường dẫn mới không dùng giới hạn 30 nhiệm vụ / 100 giao dịch của API cũ.
Test registry sẽ báo lỗi nếu thêm bảng có `user_id` mà chưa đưa vào danh sách xuất
(ngoại lệ có chủ ý: `push_subscriptions`). Ba bảng con được lọc qua cha thuộc tài khoản:
`daily_task_items`, `placement_attempt_items`, `flashcard_cards`.

Không xuất mật khẩu băm, token, khóa đăng ký push, endpoint push, khóa idempotency,
hash kiểm tra request, ngân hàng đề hệ thống, embedding hay đường dẫn tệp âm thanh máy chủ.
Danh sách cột cố định, không tự serialize ORM hoặc tự mở rộng theo schema mới.

## Migration tài liệu

`0026_document_export_owner.py`, sau `0025`, thêm `documents.user_id` nullable,
index và liên kết `ON DELETE SET NULL`. Tạo tài liệu và upload xác thực sẽ lưu
tài khoản hiện tại; cấu trúc request/response thư viện không đổi. Không thay đổi
chính sách đọc/sửa thư viện chung trong tác vụ này.

Migration kiểm tra cột/index/FK trước khi tạo. Trên SQLite dùng `ADD COLUMN ... REFERENCES`
để tránh dựng lại bảng và làm mất dữ liệu con. Downgrade từ chối nếu còn chủ sở hữu
đã ghi nhận. Test SQLite kiểm tra nâng cấp hai lần, giữ tài liệu và dữ liệu con,
`ON DELETE SET NULL`, và chặn downgrade mất dữ liệu. Chưa chạy migration trên PostgreSQL thật.
Khi triển khai, chạy `alembic upgrade head` trong môi trường backend trước khi dùng mã mới.

Tài liệu cũ có `user_id = NULL` không thể truy ngược chủ sở hữu một cách đáng tin cậy;
không xuất theo tên tệp, tag hoặc suy đoán. Cần quyết định nguồn đối soát nếu muốn gán lại.
Tệp gốc đã upload không có trong bản xuất; nội dung văn bản đã trích xuất của tài liệu
có chủ sở hữu vẫn được xuất.

## Giới hạn tài nguyên và CSV

Endpoint mới là hàm đồng bộ để FastAPI chạy trong thread pool. Truy vấn lấy từng dòng,
ghi JSON/CSV ra tệp tạm, rồi trả `FileResponse`; không tạo một object JSON toàn tài khoản
trong RAM. Tệp tạm được dọn sau khi gửi hoặc nếu chuẩn bị thất bại.

Giới hạn mặc định: 50 MiB tổng nội dung bản ghi JSON, 2 MiB mỗi bản ghi,
100.000 dòng mỗi bảng. Phần bao JSON/metadata/CSV có overhead ngoài ngân sách nội dung.
Thứ tự bản ghi theo khóa chính. Bỏ qua dòng quá lớn và ghi cảnh báo có số lượng;
khi hết ngân sách / số dòng thì ghi cảnh báo theo bảng. Các bảng rỗng vẫn có trong tệp.
Đây là bản chụp theo từng truy vấn, không bảo đảm snapshot giao dịch đồng nhất giữa các bảng
nếu người dùng tiếp tục học trong lúc xuất.

CSV dùng UTF-8 BOM, CRLF và quoting qua thư viện `csv` chuẩn. Các ô có thể thành công thức
được thêm nháy đơn; JSON giữ nguyên giá trị gốc. `HUONG_DAN.txt` mô tả từng bảng và mọi cột;
cấu trúc lồng nhau giữ dạng JSON trong ô CSV. Chưa mở kiểm chứng bằng Excel thật.

## Báo cáo

Cấp độ từ hồ sơ; điểm bài tập và điểm thưởng hiển thị riêng; chuỗi ngày từ ví thưởng.
Độ chính xác dùng số đúng/số trả lời có chấm; nghe/viết là điểm trung bình, tiến độ thẻ
là tự đánh giá. Số phiên/bài hiển thị theo nguồn, không cộng chúng thành một tổng có thể trùng.
Mục sai lấy từ `study_item_stats`; hoạt động gần đây lấy 5 mục mới nhất trên 9 lịch sử
học/trò chuyện. Không suy ra điểm phát âm hay tiến độ ngoại tuyến. Khi thiếu dữ liệu ghi
“Chưa có dữ liệu”, không trình bày thành 0%.

HTML không tải script/font ngoài; nội dung người dùng được escape; CSS dùng token màu,
tự theo sáng/tối và chuyển về nền trắng khi in. Bố cục giới hạn 5 mục sai / 5 hoạt động
để in gọn. Chưa xác nhận số trang PDF trên từng trình duyệt/phông chữ.

## Web và mobile

Web có hộp xác nhận, chọn 3 dạng, khóa thao tác đang xử lý, trạng thái/lỗi dịch vi/en,
tải Blob và thu hồi URL tạm. Có giới hạn chờ 180 giây. Dùng lại API xác thực chung.

Mobile tải bằng `expo-file-system/legacy` thẳng xuống cache, không parse JSON lớn bằng JS.
Hiển thị dung lượng thực trên đĩa, số bản ghi theo bảng, cảnh báo bị cắt; sau đó chia sẻ
URI tệp qua `expo-sharing`. Không tự tải khi vừa mở màn hình. Tải lỗi xóa tệp dở, cho phép
thử lại; giới hạn chờ 180 giây, hủy khi rời màn hình; kiểm tra tài khoản/token trước khi
hiển thị kết quả. Cache thuộc sandbox ứng dụng, không lưu bearer token trong tệp xuất.

Nút riêng xuất dữ liệu cục bộ khi offline: bộ học AsyncStorage (đã có giới hạn 1,5 MiB),
thống kê trò chơi/công thức và cài đặt/ledger nhắc học của đúng tài khoản. Tệp JSON
`scope: device_only`, phiên bản 1, giữ nguyên các giá trị storage để không mất dữ liệu cũ/hỏng.
Phần này là tệp riêng, không được ghép vào ZIP máy chủ.

Thư viện duy nhất thêm: `expo-sharing ~58.0.24` do Expo chọn cho SDK 58; dung lượng gói
đã cài 308.804 byte (khoảng 302 KiB), chưa gồm phần tăng của binary native. Đã thêm plugin
trong `app.config.ts`. Cần build lại development client/native app để kiểm tra thực tế.

## Kiểm tra và file thay đổi

Test mới: `backend/tests/test_personal_export.py`, `frontend/tests/personalExport.test.mjs`,
`mobile/tests/personal-export.test.ts`. Bao gồm tài khoản trống, 2.100 tin nhắn Nhật/Việt,
cách ly tài khoản và bảng con, CSV/BOM/chống công thức, giới hạn, dữ liệu mới,
migration lặp lại và tài liệu tạo/upload, lỗi mạng/thử lại, không bấm trùng, tải/chia sẻ URI.
Test UI dùng mock filesystem/share/network; không thay cho thiết bị thật.

Các file sản phẩm thay đổi/thêm trong tác vụ:

- Backend: `app/api/auth.py`, `app/api/library.py`, `app/main.py`, `app/models/database.py`,
  `app/services/library_service.py`, `app/services/personal_export.py`,
  `app/data/personal_export_labels.json`, `alembic/versions/0026_document_export_owner.py`.
- Web: `src/pages/Profile.tsx`, `src/services/api.ts`, `src/components/profile/PersonalExport.tsx`,
  `src/i18n/locales/{vi,en}/profile.json`.
- Mobile: `src/screens/ExportScreen.tsx`, `src/utils/personalExport.ts`,
  `src/i18n/locales/{vi,en}.json`, `app.config.ts`, `package.json`, `package-lock.json`.
- Ba file test ở trên và tài liệu này.

Không áp dụng migration vào cơ sở dữ liệu đang chạy, không đổi các phần đang sửa sẵn của dự án.

Kết quả kiểm tra cuối trên mã hiện tại:

| Kiểm tra | Kết quả |
| --- | --- |
| Backend: personal export + flashcards/assessments/chat conversations/learning progress/library | 112 test đạt |
| Mobile `npm run check` (typecheck, lint, toàn bộ test, i18n) | 149 test đạt; các bước còn lại đạt |
| Web: personal export, profile calendar, text integrity | 13 test đạt |
| Web: build production, eslint ba file TSX/API thay đổi, i18n | Đạt |
| Khóa dịch backend vi/en và tên 37 bảng | Khớp |
| `git diff --check` | Đạt |

Build web cuối ghi vào `tmp/personal-export-web-build`. Còn cảnh báo bundle lớn và
Browserslist cũ; pytest có cảnh báo deprecated của Pydantic/SQLAlchemy, test renderer
mobile có cảnh báo deprecated. Không tự nâng cấp các thư viện ngoài phạm vi.

Chưa kiểm chứng: DB PostgreSQL và migration trên dữ liệu thật, tải tệp qua hạ tầng triển khai,
Android/iOS thật và native build, Excel thật, số trang/chất lượng PDF trên trình duyệt thật.
Mô phỏng lỗi mạng trong test không thay cho thử mất mạng trên thiết bị.
