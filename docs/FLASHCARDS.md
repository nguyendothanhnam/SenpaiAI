# Bộ thẻ học tập — A, B, C và D

Nhánh `mobile`. Nền tảng A/B hoàn tất ngày 25/11/2026; Learn, Test, thống kê và đồng bộ Expo bổ sung ngày 26/11/2026. Mốc kiểm tra A/B bên dưới được giữ làm lịch sử. Phần C/D chỉ thêm `expo-speech` cho giọng thiết bị; không tải dữ liệu học hay mô hình AI.

## Thiết kế và lý do

API mới `/flashcards` (đồng thời dưới `/api`) tách khỏi `/game/flashcard/*`. API cũ, nhiệm vụ hằng ngày và trò chơi giữ cách dùng cũ. Web giữ các đường dẫn `/flashcard`, `/flashcard/manual`, `/flashcard/play`; bổ sung `/flashcard/:deckId`. Bộ mới thuộc tài khoản, riêng tư mặc định, chưa có chia sẻ công khai.

Năm bảng mới: `flashcard_decks`, `flashcard_cards`, `flashcard_progress`, `flashcard_sessions`, `flashcard_transfers`. Migration **0024 nối 0023**, kiểm tra bảng/chỉ mục trước khi tạo. Downgrade chạy lại được khi các bảng rỗng; từ chối trước khi xóa bất kỳ bảng nào nếu có dữ liệu, để tránh mất bộ thẻ. Đã áp dụng `alembic upgrade 0024` trên PostgreSQL hiện có; không chuyển dữ liệu trình duyệt tự động.

Giới hạn: 100 bộ/tài khoản, 500 thẻ/bộ; tên 160 ký tự, mô tả 2000, chủ đề 100, mặt trước 1000, mặt sau 2000, cách đọc 500, ghi chú 2000. Hàng đợi tối đa 500 thẻ/lượt; danh sách phân trang tối đa 100 bộ/lần. Chuyển dữ liệu cũ tối đa 100 bộ và 10.000 thẻ/yêu cầu. Nhập tệp trên web tối đa 5 MB. Dữ liệu khác tài khoản trả 404. Các thao tác ghi khóa hàng người dùng trên PostgreSQL để tránh cập nhật tiến độ đồng thời.

Lịch ôn dùng quy tắc Leitner đơn giản, thuần hàm: trả lời đúng tăng một mức, hẹn sau **1, 3, 7, 14, 30, 60 ngày**; sai quay mức 0 và hẹn sau 10 phút. Từ mức 3 là đã thuộc, nhưng vẫn có ngày ôn tiếp. Thẻ đã trả lời dưới mức 3 là đang học, chưa trả lời là chưa học. Đây là tự đánh giá của người học, không phải phép đo năng lực hay dự đoán trí nhớ đã được kiểm chứng. Ưu tiên hàng đợi: đến hạn, đang học, rồi mới; thẻ đã thuộc chưa đến hạn không vào hàng đợi.

Vân tay SHA-256 từ cặp mặt trước/sau sau chuẩn hóa Unicode NFKC, khoảng trắng và casefold phát hiện trùng trong bộ. Giữ ID và tiến độ khi chỉ đổi thứ tự/cách đọc/ghi chú; đổi mặt trước hoặc sau đặt lại tiến độ của thẻ đó. Nhân bản có ID mới, không sao chép tiến độ. Tạo nhanh sao chép từng nhóm 20 Kanji hoặc từ vựng đúng cấp từ nguồn hiện có, không sửa nguồn.

Phiên học có mã yêu cầu duy nhất theo tài khoản và hash payload. Retry cùng mã/nội dung trả phiên cũ; cùng mã khác nội dung trả 409. Web giữ nguyên cả mã lẫn payload khi retry, gửi theo lô khi kết thúc; mỗi thẻ tính một kết quả trong lượt. Tắt theo dõi không gửi kết quả. Tự động chỉ lật/chuyển, không đoán người học đã nhớ. Không cộng điểm cửa hàng hay điểm bài tập.

## API và luồng sử dụng

| Thao tác | Endpoint dưới `/flashcards` |
| --- | --- |
| Danh sách, tạo | `GET /`, `POST /` |
| Chi tiết, sửa metadata và toàn bộ thẻ, xóa | `GET/PUT/DELETE /{deck_id}` |
| Nhân bản | `POST /{deck_id}/duplicate` |
| Thêm, sửa, xóa thẻ | `POST /{deck_id}/cards`, `PUT/DELETE /{deck_id}/cards/{card_id}` |
| Lưu thẻ hàng loạt, đổi thứ tự | `PUT /{deck_id}/cards`, `PUT /{deck_id}/cards/reorder` |
| Gắn sao | `PUT /{deck_id}/cards/{card_id}/star` |
| Xem trước văn bản | `POST /import/preview` |
| Tạo nhanh, chuyển dữ liệu cũ có xác nhận | `POST /quick-create`, `POST /transfer` |
| Hàng đợi, thống kê, ghi kết quả | `GET /queue`, `GET /stats`, `POST /reviews` |
| Xuất CSV hoặc văn bản phân cách Tab | `GET /{deck_id}/export?format=csv\|text` |

Danh sách hỗ trợ tìm tên/mô tả, lọc JLPT/chủ đề, sắp gần đây/tên/tiến độ, `offset/limit`. Hàng đợi và thống kê nhận `deck_id` tùy chọn; hàng đợi có lọc gắn sao. Chi tiết trả thẻ và tiến độ. Xem OpenAPI khi backend chạy để lấy lược đồ chính xác. Lưu thẻ hàng loạt là thay toàn bộ danh sách: muốn giữ ID/tiến độ phải gửi lại ID của các thẻ cần giữ.

Nhập văn bản không tự lưu: chọn dấu ngăn trường/thẻ → xem trước danh sách và số dòng lỗi → sửa hết lỗi → thêm vào trình soạn → lưu bộ. Parser hỗ trợ thêm cách đọc/ghi chú; chuẩn hóa trùng trước khi lưu. API cũ `/game/flashcard/import` tiếp tục đọc CSV/JSON/Excel; chỉ bổ sung trường tùy chọn `reading/kana`, `note/example`, giữ các cột cũ. Xuất dùng CSV quoting và chặn công thức bảng tính bằng dấu nháy đơn; không sửa dữ liệu gốc.

Web đọc hai khóa cũ `dacs_flashcard_sets`/`dacs_flashcard_list` mà không tự ghi/xóa. Hiển thị tên và số thẻ, yêu cầu xác nhận quyền sở hữu trước khi chép vào tài khoản. `source + local_id` chống tạo lại khi gửi lại, kể cả bộ server đã bị xóa (giữ dấu chuyển với deck ID rỗng). Nếu sửa bộ cục bộ sau khi đã chuyển, thao tác chuyển không ghi đè bản server; dùng trình soạn để cập nhật. Dữ liệu browser cũ không theo tài khoản nên **phải do người dùng xác nhận**, không tự gán.

Nháp mới dùng khóa theo tài khoản và ID bộ, tự lưu sau 500ms, khôi phục khi quay lại; chỉ xóa nháp sau khi lưu server thành công hoặc người dùng chọn bỏ. Nháp là dữ liệu thiết bị, không đồng bộ. Bộ server và lịch sử đồng bộ khi tải lại; chưa có chế độ offline hoặc giải quyết xung đột hai trình soạn cùng lúc. API chuyển chấp nhận nguồn `mobile`, nhưng Expo chưa gọi trong phần này.

Xóa tài khoản xóa toàn bộ năm bảng của người đó. Xuất dữ liệu cá nhân thêm `flashcards` gồm bộ, thẻ, tiến độ, phiên, dấu chuyển. Đặt lại tiến độ xóa tiến độ/phiên, giữ bộ/thẻ/dấu chuyển; không chạm luật chống nhận điểm trùng của nhiệm vụ hằng ngày.

## Kiểm chứng và giới hạn

Các lệnh từ `backend`: `venv/Scripts/python.exe -m pytest tests -q -p no:cacheprovider`; `venv/Scripts/python.exe -m alembic current`; `venv/Scripts/python.exe -m alembic upgrade 0024`. Kiểm thử migration dùng SQLite tách biệt: upgrade hai lần, downgrade từ chối khi có dữ liệu, downgrade rỗng hai lần rồi upgrade lại.

Các lệnh từ `frontend`: `node --test tests/*.test.mjs`, `npm run build`, `npm run i18n:check`, ESLint các file sửa. Từ `mobile`: `npm run typecheck`, `npm run i18n:check` để kiểm tra tương thích bản dịch dùng chung. Build cần chạy ngoài sandbox do quyền sao chép asset vào `dist`; không cài gói mới.

Kết quả cuối: **461 test backend + 6 subtest đạt** (65,85 giây; 26 cảnh báo hiện hữu), **95 test web đạt** (11,06 giây), build đạt (13,62 giây; cảnh báo kích thước chunk hiện hữu), lint các file sửa đạt, khóa dịch web/mobile đạt, TypeScript web qua build và TypeScript mobile đạt. Thêm 20 ca backend và 10 ca web. Các test mới kiểm tra phân quyền, trạng thái/lịch ôn, queue, retry, giới hạn, trùng, nhập nhiều dấu ngăn, CSV/JSON/Excel, CRUD/thứ tự/nhân bản, chuyển một lần, xuất/reset/xóa và số truy vấn danh sách (2 truy vấn cho các bộ và tổng hợp, không N+1). Web kiểm tra chuẩn hóa, xáo trộn, lọc sao, nháp theo tài khoản, tổng kết, lượt không theo dõi, retry cùng payload và tách cache lượt học/chi tiết.

Edge headless: danh sách ở 1440×900 sáng/vi, 768×1024 tối/en, 390×844 tối/vi, 320×640 sáng/en không tràn ngang. Luồng chi tiết/gắn sao → học không theo dõi → quay lại → học có theo dõi, lỗi mạng và retry → tạo/lưu nháp/lưu bộ đạt, giảm chuyển động đạt. Thành phần React thật nhưng API giả lập; không phải kiểm chứng end-to-end PostgreSQL qua mạng. Trường hợp không có giọng Nhật được kiểm tra bằng test render; chưa nghe âm thanh thật. Mẫu screenshot chỉ dùng dữ liệu kiểm thử.

Giới hạn: lịch Leitner chưa được đo với người học thật; thẻ thuộc dựa trên tự đánh giá. Không tự động lưu kết quả phiên chưa kết thúc qua lần tải trang. Thống kê chuỗi theo bộ đọc tối đa 10.000 phiên gần nhất để giới hạn tải; lịch sử rất lớn có thể cần bảng tổng hợp riêng ở phần C. Chưa đo hiệu năng với 50.000 thẻ hay thiết bị tầm trung. Không tuyên bố đã nghiệm thu cử chỉ/giọng đọc trên điện thoại thật.

## Checklist thủ công

- [ ] Desktop/tablet/điện thoại: sáng/tối, vi/en, giảm chuyển động, không tràn ngang và có focus bàn phím rõ.
- [ ] Tạo/sửa/xóa/nhân bản; tìm/lọc/sắp/phân trang; bộ trống và lỗi mạng có thông báo/thử lại.
- [ ] Nhập tệp và văn bản nhiều dấu ngăn, lỗi dòng/trùng; thay thứ tự giữ tiến độ; sửa nội dung đặt lại tiến độ.
- [ ] Nháp khôi phục đúng tài khoản/bộ; lưu thành công mới xóa nháp; dữ liệu cũ chỉ chuyển sau xác nhận và vẫn còn trên thiết bị.
- [ ] Hai tài khoản/hai thiết bị: dữ liệu tách biệt, reload thấy thay đổi; người khác không đọc/sửa/xóa được bộ.
- [ ] Thẻ lật: mặt đầu, sao, xáo trộn, phím cách/mũi tên/1/2, vuốt trái/phải, tự động, phát âm và thông báo thiếu giọng Nhật.
- [ ] Tắt theo dõi không gửi review; bật theo dõi lưu một lần; lỗi mạng retry không tăng lần đúng/sai; học lại thẻ còn học.
- [ ] Ôn hôm nay đúng thứ tự; xuất CSV/văn bản và xuất dữ liệu tài khoản; reset giữ bộ; xóa tài khoản thử không ảnh hưởng tài khoản khác hoặc điểm thưởng.

## Phần C/D — Learn, Test và Expo (26/11/2026)

### Luồng và phương pháp

- `shared-games/flashcard-study.ts` dùng chung trên web/mobile: chuẩn hóa Unicode NFKC, chữ thường, kana và romaji; hàng đợi Learn, kiểm tra đáp án ghép cặp đầy đủ/không dùng lại lựa chọn. Bảng chuyển kana nhỏ nằm ở `flashcard-kana.json`; backend có bản đóng gói `app/data/flashcard_kana.json` để Docker backend chạy độc lập. Test bắt buộc hai bản giống nhau.
- Mỗi vòng Learn tối đa 7 thẻ. Thẻ chưa có lần đúng bắt đầu bằng trắc nghiệm, từ mức ôn 1 trở lên chuyển sang gõ. Đúng đi tiếp, sai đưa về cuối hàng đợi sau các thẻ còn lại; vòng một thẻ sẽ lặp chính thẻ đó. Các vòng tiếp theo chọn nhóm tiếp trong bộ. Có thể kết thúc sớm, lưu các thẻ đã làm; giới hạn 500 lần trả lời/vòng. UI phản hồi ngay từ đáp án của **chế độ học**, server vẫn chấm lại transcript khi lưu.
- Test hỗ trợ trắc nghiệm, đúng/sai, gõ và ghép cặp. Server sinh snapshot từ bộ riêng của người dùng và không trả đáp án trước khi nộp. Không lặp thẻ giữa các câu; ghép cặp tiêu thụ 2–4 thẻ nên có thể ít câu hơn số yêu cầu khi kho nhỏ. Màn hình nêu rõ số thực tế. Nếu thiếu nhiễu hợp lệ, chuyển câu đó sang gõ; không tự lấy nội dung ngoài bộ.
- Nhiễu loại cả mặt trước/cách đọc hợp lệ của đáp án. Ghép cặp tránh các mặt trước hoặc nghĩa giống nhau trong cùng nhóm; các lựa chọn có ID độc lập, không dùng ID thẻ làm khóa ghép. Đáp án gõ chấp nhận mặt trước, từng cách đọc phân cách bởi `、 , ; /` hoặc xuống dòng, kana tương đương và romaji. Không bỏ dấu tiếng Việt để tránh chấp nhận từ khác nghĩa.
- `flashcard_assessments` là bảng mới duy nhất của C/D, migration **0025 nối 0024**. Snapshot và hash yêu cầu giữ retry tạo phiên ổn định; hash bài nộp giữ retry không tính trùng. Chấm theo snapshot, kiểm tra vân tay nội dung hiện tại; mặt trước/sau của thẻ đã sửa hoặc thẻ đã xóa thì yêu cầu mở lượt mới thay vì ghi nhầm tiến độ. Mỗi thẻ cập nhật lịch ôn một lần mỗi phiên. Sai rồi đúng lại trong cùng vòng vẫn được hẹn ôn sớm; việc nhớ ngay sau gợi ý không xóa lỗi đầu.
- Kết quả lưu vào `flashcard_sessions`, thống kê bộ/tổng, lịch sử Learn/Test có phân trang, xuất dữ liệu cá nhân và hoạt động học chung. Nội dung tự soạn chỉ tính hoạt động/thời gian, không được coi là bằng chứng năng lực JLPT đã kiểm chứng và không cộng điểm thưởng.

### API bổ sung (không đổi API A/B)

| Thao tác | Endpoint dưới `/flashcards` |
| --- | --- |
| Mở phiên | `POST /assessments` (`request_id`, `deck_id`, `mode`, `count`, `types`, `round_index`) |
| Lấy phiên đã sở hữu | `GET /assessments/{id}` |
| Nộp transcript hoặc bài Test | `POST /assessments/{id}/submit` (`duration_seconds`, `answers`) |
| Rời phiên chưa nộp | `DELETE /assessments/{id}` (đánh dấu bỏ dở, không xóa kết quả đã hoàn tất) |
| Lịch sử phân trang | `GET /sessions?deck_id=…&offset=…&limit=…` |

Đề tối đa 100 câu, transcript tối đa 500 lượt, tối đa 100 snapshot đang hoạt động/tài khoản. API người khác trả 404. Xóa tài khoản/reset tiến độ xóa snapshot; xóa bộ xóa snapshot của bộ, còn số liệu phiên đã hoàn tất trong lịch sử hoạt động. Downgrade 0025 kiểm tra rỗng trước khi xóa; không chạy downgrade trên PostgreSQL thật. Đã chạy `alembic upgrade 0025` thành công và giữ dữ liệu A/B.

### Di động và phát âm

Lối vào `/study/flashcard` dùng dữ liệu server thay cho bộ cục bộ; các route mới detail/editor/learn/test/stats đều nằm trong Stack có xác thực. Quiz cục bộ và API cũ giữ nguyên. Danh sách/chi tiết/trình soạn dùng danh sách ảo hóa; nhập văn bản có preview/lỗi và dùng lại parser CSV/JSON/Excel. Nháp theo tài khoản và bộ, giới hạn 1,5 MiB; tuần tự hóa lần ghi để nháp đang ghi không tái xuất hiện sau khi đã lưu/xóa. Bộ cục bộ chỉ chuyển sau xác nhận, giữ nguyên bản gốc và không tự tạo tiến độ từ số liệu tổng cũ.

Thẻ lật có chọn mặt đầu, sao, xáo trộn, theo dõi tiến độ, chạy tự động; vuốt phải đã nhớ, trái còn học, nút thay thế cho người không dùng cử chỉ. Giảm chuyển động tắt hoạt ảnh lật; bộ chọn Flashcard dùng modal không hoạt ảnh. Theo dõi tắt không gửi review; retry giữ cùng mã và payload. Tự động không tự đánh giá thẻ, không chạy khi app ở nền.

Đã báo trước khi cài `expo-speech`; dải tương thích `~58.0.3` cài thực tế **58.0.4**, đúng **1 gói**, **126.342 byte/55 file** trong `mobile/node_modules/expo-speech` (khoảng 123 KiB, MIT). Cache npm dùng `tmp/npm-cache` trong dự án; không cài toàn cục. Chọn một giọng `ja` thực sự có trong `getAvailableVoicesAsync()`, bật/tắt rõ ràng, báo khi không có giọng, dừng khi rời màn hình/app về nền. Không tải giọng hay mô hình. [Tài liệu Expo Speech](https://docs.expo.dev/versions/latest/sdk/speech/) lưu ý iOS thật có thể không phát tiếng khi bật chế độ im lặng; cần kiểm tra trên thiết bị.

### Kiểm chứng cuối C/D

| Kiểm tra thực chạy | Kết quả |
| --- | --- |
| Toàn backend `python -m pytest tests -q -p no:cacheprovider` | **498 đạt + 6 subtest**, 68,70 giây, 26 cảnh báo hiện hữu |
| Toàn web `node --test tests/*.test.mjs` | **102 đạt**, 8,30 giây |
| Toàn mobile `npm test` | **146 đạt**, 3,84 giây |
| Web `npm run build` | Đạt, 15,55 giây; cảnh báo chunk hiện hữu |
| Mobile `npm run export:check` | Đạt, bundle Android và iOS theo cấu hình Expo; không phải APK/IPA đã cài máy |
| TypeScript web/mobile, lint file web sửa, toàn mobile lint, i18n web/mobile | Đạt |
| Migration 0025 | PostgreSQL upgrade đạt; SQLite upgrade lặp/downgrade rỗng lặp đạt, từ chối downgrade có dữ liệu |

Giữ ngân sách 18 SELECT của các nguồn lịch sử cũ, thêm tối đa 1 SELECT có giới hạn cho Flashcard; test không bỏ ngưỡng cũ. Các ca mới gồm 30 biến thể chuẩn hóa đáp án, quyền tài khoản, snapshot không lộ đáp án Test, không lặp thẻ, retry, nội dung thay đổi, lịch ôn sau phục hồi, nguồn kana đóng gói, chuyển dữ liệu cũ, cử chỉ mô phỏng, lượt không theo dõi, speech bật/tắt và dừng.

Edge headless: 1440×900 sáng/vi, 768×1024 tối/en, 390×844 tối/vi, 320×640 sáng/en không tràn ngang. Bốn dạng Test, gõ romaji, retry nộp đúng payload, kết quả, thống kê/lịch sử và vòng Learn lặp lỗi sau 6 thẻ khác đều đạt. Dùng thành phần thật, fixture câu hỏi do dịch vụ thật sinh nhưng **API trình duyệt giả lập**; test backend chạy DB tách biệt. Test React Native dùng renderer và native module mô phỏng, không thay thế thiết bị thật.

Giới hạn: chuyển kana/romaji là luật nhỏ, không phân tích ngữ cảnh/trợ từ hay mọi biến thể gõ; chất lượng nghĩa và từ đồng nghĩa phụ thuộc bộ do người dùng soạn. Phiên đang làm chưa có khôi phục bản nháp đáp án sau khi tải lại/đóng app; snapshot bỏ dở không đồng nghĩa đã lưu tiến độ. Chưa thử thao tác đa thiết bị qua mạng thật, bút/cảm ứng thật, TTS Android/iOS thật, bản cài APK/IPA, máy tầm trung hay 50.000 thẻ. Đồng bộ là lưu server và tải lại/refresh, không có cộng tác thời gian thực hoặc hòa giải hai người soạn đồng thời.

Checklist C/D bổ sung:

- [ ] Học hai vòng 7 thẻ, trả lời sai rồi đúng lại; kiểm tra thứ tự lặp, trạng thái và ngày ôn trên thiết bị thứ hai.
- [ ] Test cả bốn dạng, kho 1 thẻ/kho nhỏ, nghĩa trùng, kana/romaji/toàn rộng/chữ thường; xem lại lỗi và retry khi mất mạng.
- [ ] Mobile nhập tệp thật, dán văn bản nhiều dấu ngăn, đổi thứ tự thẻ, đóng/mở nháp; chuyển bộ cục bộ và kiểm tra bản gốc còn nguyên.
- [ ] Vuốt/nút/giảm chuyển động, theme sáng/tối, vi/en; bật/tắt TTS, thiếu giọng Nhật, iOS im lặng và app về nền.
- [ ] Hai tài khoản không lẫn cache/nháp; xuất/reset/xóa bằng tài khoản thử; Quiz và các tính năng ngoài Flashcard vẫn hoạt động.

### File thêm/sửa của C/D

- Backend: `app/models/database.py`, `app/api/{flashcards,auth}.py`, `app/services/{flashcards,flashcard_assessments,learning_history}.py`, `app/data/flashcard_kana.json`, `alembic/versions/0025_flashcard_assessments.py`, `tests/test_flashcard_assessments.py`; cập nhật fixture/budget trong `tests/{test_exercise_selection,test_placement_v2,test_learning_progress}.py`.
- Logic chung: `shared-games/flashcard-{types,study}.ts`, `shared-games/flashcard-kana.json`.
- Web: `src/features/flashcards/{Flashcards,Assessment}.tsx`, `src/services/flashcards.ts`, `src/App.tsx`, hai `common.json`, `tests/flashcardStudy.test.mjs`.
- Mobile: `src/api/flashcards.ts`, `src/features/flashcards/{helpers.ts,ui.tsx,useSpeech.ts}`, `src/screens/study/Cloud{FlashcardsScreen,Library,Editor,Flip,Assessment}.tsx`; route `app/study/flashcard{,-play,-detail,-editor,-learn,-test,-stats}.tsx`, hai wrapper `app/study/{editor,import}.tsx`, `app/_layout.tsx`; `src/components/ChoiceSheet.tsx` thêm tùy chọn hoạt ảnh có giá trị mặc định cũ; `package.json`, `package-lock.json`, hai test `cloud-flashcards{,-ui}.test.ts`.
- Tài liệu: README dự án, chỉ mục docs và tài liệu này. Giữ các thay đổi chưa commit từ các lượt trước, không commit/push trong lượt C/D.

## File của lần triển khai A/B (lịch sử)

- Backend mới: `app/api/flashcards.py`, `app/services/flashcards.py`, `alembic/versions/0024_flashcards.py`, `tests/test_flashcards.py`.
- Backend sửa: `app/models/database.py`, `app/main.py`, `app/api/auth.py`, `app/api/game.py`, `tests/test_flashcard_importer.py`, hai fixture `tests/test_exercise_selection.py`, `tests/test_placement_v2.py`.
- Web mới: `src/services/flashcards.ts`, `src/features/flashcards/{Flashcards.tsx,logic.ts,flashcards.css}`, `tests/flashcards.test.mjs`.
- Web sửa: `src/App.tsx`, ba trang `src/pages/Flashcard{,Manual,Play}.jsx`, hai locale `src/i18n/locales/{vi,en}/common.json`.
- Tài liệu: `README.md`, `docs/README.md`, tài liệu này. Không commit/push trong lượt này.
