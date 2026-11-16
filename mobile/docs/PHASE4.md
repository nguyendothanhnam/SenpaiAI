# Giai đoạn 4 — Quiz và Flashcard

## Phạm vi và hợp đồng

Triển khai trong `mobile/`, nhánh `mobile`. Không sửa web/backend, không gọi API tạo bộ, danh sách dùng chung hoặc nộp đáp án. Đã đọc lại `Quiz`, `QuizManual`, `QuizUpload`, `QuizPlay`, `Flashcard`, `FlashcardManual`, `FlashcardPlay`, `GameHub`, `quizAnswers.js`, `storage.js`, API client web và `backend/app/api/game.py`, `services/game_service.py` trước khi triển khai.

- `/game/quiz` trả câu mẫu cố định, không đọc bộ đã tạo. `/game/quiz/create` ghi biến toàn cục. `/game/flashcard/create` nối vào biến toàn cục. Dữ liệu này dùng chung và mất khi tiến trình khởi động lại; không phù hợp lưu bộ cá nhân.
- Quiz web chấm tại máy bằng `quizAnswers.js`, không gọi `/game/quiz/submit`. Endpoint submit chỉ so sánh hai giá trị client cung cấp, không có phiên thi, tổng điểm hay lưu kết quả.
- Mobile chỉ gọi `POST /game/quiz/upload` cho Excel và `POST /game/flashcard/import` cho Excel/CSV/JSON. Nhập Quiz JSON được xử lý tại thiết bị, giống web. Không gọi mutation backend khi tạo/sửa/học bộ.
- API nhập tệp không lưu bộ: trả toàn bộ câu/thẻ hợp lệ hoặc lỗi toàn bộ. Lỗi server giữ nguyên số dòng, tính cả tiêu đề. Không hiển thị các dòng hợp lệ khi server từ chối cả tệp.
- Flashcard chỉ có mặt trước/mặt sau; cấp/chủ đề là metadata. Không có ghi chú. Các schema tạo backend hiện không giữ metadata như bộ cục bộ; mobile không gọi chúng.

Hành vi RAM xác nhận bằng mã nguồn; chưa thử khởi động lại server thật. Backend tạm thời không làm mất bộ mobile vì bộ được lưu riêng trên thiết bị.

## Chức năng đã làm

| Route | Chức năng |
| --- | --- |
| `/study` | Hub Quiz/Flashcard và Quiz Kanji đã hoạt động; vào từ Luyện tập; thông báo lưu cục bộ |
| `/study/quiz` | Danh sách, tìm tên bộ/tệp, lọc JLPT/chủ đề/nguồn, kéo làm mới, ngày tạo/số câu, sửa/đổi tên/nhân bản/xóa có xác nhận |
| `/study/flashcard` | Danh sách và thao tác tương tự; tổng bộ/thẻ, độ chính xác lượt hoàn thành gần nhất, thống kê tích lũy từng bộ |
| `/study/editor?kind=quiz|flashcard&id=...` | Tạo/sửa, tên/cấp/chủ đề; thêm/xóa mục; bốn lựa chọn và chọn đáp án; giải thích tùy chọn; hai mặt thẻ; cảnh báo rời khi chưa lưu |
| `/study/import?kind=quiz|flashcard` | Bộ chọn tài liệu, kiểm tra đuôi/dung lượng, nhập và xem trước danh sách ảo hóa, đặt tên, xác nhận lưu/hủy; Quiz JSON có thể dán hoặc chọn tệp tại máy |
| `/study/quiz-play?id=...` | Bật/tắt xáo trộn câu/lựa chọn; từng câu, tiến độ, khóa đáp án, đúng/sai/giải thích; kết quả điểm/thời gian/câu sai; làm lại tất cả/câu sai; xác nhận thoát |
| `/study/flashcard-play?id=...` | Lật 3D bằng Animated native driver, trước/sau bằng nút, nhớ/chưa nhớ, xáo trộn, đổi bộ, bắt đầu lại, tiến độ/tổng kết; thống kê lưu từng lần đánh dấu |

Điều khiển trắc nghiệm dùng lại `QuestionCard` của Hằng ngày/Ngữ pháp. Props mới là tùy chọn; các luồng cũ giữ cách hoạt động. Nhãn mới nằm trong namespace mobile của hệ thống i18next dùng chung, có đủ vi/en, không sửa locale web. Nội dung bộ/tệp/thông báo chi tiết do server trả không tự dịch.

## Lưu trữ và giới hạn

- AsyncStorage, envelope `{ version: 1, sets: [...] }`, khóa `senpaiai.study.account.<id>`. Không dùng khóa chung giữa các tài khoản. Đăng xuất giữ bộ cho lần đăng nhập lại của chính tài khoản đó; xóa bộ/đặt lại cục bộ tác động riêng tài khoản.
- Đây là phân tách dữ liệu trong ứng dụng, không phải mã hóa nội dung bộ. Gỡ ứng dụng/xóa dữ liệu hệ điều hành sẽ mất bộ. Không đồng bộ với web, server hoặc thiết bị khác; chưa có xuất/nhập toàn bộ kho mobile.
- Tối đa **100 bộ**, **500 mục/bộ**, **1,5 MiB dữ liệu JSON UTF-8/tài khoản**. Giới hạn dưới mức khoảng 2 MiB cho một hàng AsyncStorage Android. Mỗi trường nội dung tối đa 10.000 ký tự, tên bộ 120 ký tự.
- Ghi được tuần tự hóa theo khóa tài khoản để các thao tác bất đồng bộ không ghi đè danh sách của nhau. Chống bấm lặp bằng khóa ref trước khi cập nhật trạng thái React. Không tự retry mutation nhập tệp/lưu.
- Dữ liệu hỏng/sai schema: trả trạng thái an toàn, không crash, không tự ghi đè hoặc xóa. Có thử lại và đặt lại rõ ràng, kèm xác nhận. Phiên bản tương lai bị khóa ghi và yêu cầu cập nhật app. Lỗi đọc/ghi bộ nhớ có thông báo.
- Quiz không lưu tiến độ lượt đang làm hoặc cộng điểm tài khoản. Flashcard ghi thống kê tích lũy đúng/sai/chuỗi/độ chính xác theo quy tắc web; thêm độ chính xác lượt hoàn thành gần nhất. Mỗi thẻ chỉ đánh dấu một lần trong một lượt, tránh cộng lặp khi quay về thẻ cũ. Bắt đầu lại tạo lượt mới, giữ thống kê tích lũy.
- Chức năng cục bộ dùng được khi đã có phiên đăng nhập trong ứng dụng. Cổng khôi phục phiên offline của Giai đoạn 0–3 vẫn giữ nguyên: mở app mới khi backend không truy cập được có thể cần khôi phục/xác minh phiên trước khi vào các màn hình riêng tư. Không bỏ qua JWT để mở dữ liệu của tài khoản chưa được xác minh.

## Nhập tệp và đối chiếu quy tắc web

- Quiz nhận `.xlsx/.xls/.json`; Flashcard nhận `.xlsx/.xls/.csv/.json`. Tối đa 5 MiB/tệp, riêng JSON 1 MiB.
- `copyToCacheDirectory: true` giúp đọc tệp từ iCloud/Drive/nhà cung cấp tài liệu. Kiểm tra dung lượng bản cache thực; xóa bản cache sau khi xử lý. Đuôi tệp vẫn được kiểm tra dù MIME từ nhà cung cấp không chính xác.
- API upload timeout 45 giây, có AbortController; hủy chọn tệp không lưu gì. Mất mạng/timeout/hết phiên/tệp không đọc được/lỗi server có thông báo. Không tự gửi lại khi mạng trở lại.
- Bản xem trước chỉ nằm trong phiên màn hình. Chỉ xác nhận mới ghi AsyncStorage; hủy hoặc quay lại không lưu bộ. Không hỗ trợ nhập một phần khi API báo dòng lỗi.
- Port giữ thứ tự ưu tiên đáp án `correct_answer`, `answer`, `correct`, `correctAnswer`, quy tắc ký tự A–D/dấu chấm/dấu ngoặc/nội dung đáp án và so sánh khoảng trắng/chữ hoa như web. Test chạy helper web thật trong VM rồi so sánh.
- Quiz JSON giữ quy tắc `QuizUpload` hiện tại, gồm hành vi `option_a` không được chuyển đúng thành A và bị từ chối. Không âm thầm đổi hợp đồng web; dùng A/B/C/D hoặc nội dung lựa chọn cho JSON. Excel có parser backend riêng, chấp nhận thêm 1–4/alias theo backend.
- Mobile yêu cầu đúng bốn lựa chọn theo phạm vi. Web upload hiện chỉ loại ít hơn bốn; mobile báo rõ nếu JSON có hơn bốn. Chọn đáp án bằng nút thay cho gõ tự do, tránh lưu đáp án không thuộc lựa chọn. Giải thích được hỗ trợ trong nhập tay dù biểu mẫu thủ công web hiện chưa có ô này.
- Khi xáo trộn, ghi nhận đúng/sai của từng lựa chọn theo helper web trước khi đổi vị trí; tránh lỗi khi đáp án/giá trị lựa chọn là chữ A–D hoặc có lựa chọn trùng. Dữ liệu remap chỉ dùng trong lượt học, không sửa bộ gốc.

## Expo Go và khác biệt hệ điều hành

Đã cài bằng `npx expo install expo-document-picker expo-file-system expo-haptics`; AsyncStorage có sẵn. Không thêm native module tùy chỉnh, không thêm WebView/Skia/SVG renderer. Animation dùng React Native Animated có sẵn. Các chức năng Giai đoạn 4 hướng tới Expo Go tương thích SDK hiện tại, cả Android/iOS.

- iPhone: bộ chọn Files/nhà cung cấp đám mây có thể cần tải tệp trước; lỗi quyền/tải tệp được báo và có hướng dẫn tải về máy. Bàn phím dùng padding; cử chỉ quay lại được chặn bằng `usePreventRemove` khi có dữ liệu chưa lưu/lượt học đang chạy.
- Android: bộ chọn nhà cung cấp tài liệu và URI được sao chép vào cache; bàn phím dùng resize đã cấu hình; nút Back chịu cùng cơ chế bảo vệ màn hình.
- Haptics phụ thuộc thiết bị/cài đặt/chế độ nguồn; lỗi rung bị bỏ qua, không làm hỏng chấm bài. Không coi không rung trên simulator là lỗi lưu/chấm bài.
- APK development cũ chưa có ba module mới cần build/cài lại nếu dùng dev client. Expo Go tương thích đã chứa chúng nên không cần build riêng chỉ cho Giai đoạn 4. Không bật iCloud entitlement riêng hay tính năng chạy nền/push.
- Chưa chạy thao tác trên thiết bị thật; các điểm trên là thiết kế và giới hạn cần kiểm chứng, không phải kết quả đo thực tế.

## Kiểm tra và mẫu

Các giai đoạn trước: chạy lại `npm run check` trước triển khai, đạt typecheck/lint/44 test/i18n. Giai đoạn 4 có test đối chiếu helper/normalizer web, shuffling, validation, lỗi API, dung lượng/định dạng, kho hai tài khoản, dữ liệu hỏng/phiên bản tương lai, ghi đồng thời, thống kê và quota.

```powershell
cd E:\AI\DACN\mobile
npm.cmd run check
npm.cmd run export:check
npm.cmd run smoke:phase4
cd ..\frontend
npm.cmd run i18n:check
cd ..
backend\venv\Scripts\python.exe mobile/scripts/verify-study-import.py
```

Kết quả: **typecheck/lint/khóa dịch web-mobile, 56 test mobile và export Android/iOS đều đạt**. **8 kiểm tra parser trực tiếp và 8 kiểm tra HTTP nhập tệp thật đều đạt.** Không gọi việc export là phát hành lên App Store/Play Store hoặc đã thử trên điện thoại.

Mẫu ở [samples/study](samples/study/):

| Tệp | Kết quả mong đợi |
| --- | --- |
| `quiz-valid.xlsx` | 2 câu; đáp án B và 1 được backend đọc; preview rồi mới lưu |
| `quiz-invalid-rows.xlsx` | Lỗi dòng 2 thiếu câu; dòng 3 thiếu lựa chọn/sai đáp án; không lưu phần nào |
| `quiz-missing-columns.xlsx` | Thiếu các cột lựa chọn/đáp án theo schema |
| `flashcard-valid.xlsx` | 2 thẻ; preview rồi mới lưu |
| `flashcard-invalid-rows.xlsx` | Dòng 2 thiếu mặt sau; dòng 3 thiếu mặt trước |
| `flashcard-missing-columns.xlsx` | Thiếu `back` |
| `quiz-valid.json` | Nhập hoặc dán ngay tại thiết bị, không cần server nhập tệp |
| `flashcard-valid.csv`, `flashcard-valid.json` | Nhập qua API Flashcard, preview rồi mới lưu |

Script `generate-study-samples.py` tạo lại mẫu chỉ bằng thư viện chuẩn Python. Script `verify-study-import.py` dùng trực tiếp endpoint/parser thật trong mã backend với file bộ nhớ, không gọi HTTP, không ghi DB, không sửa backend. **8 trường hợp parser đạt** bằng `backend/venv`; `venv` ở gốc thiếu `openpyxl` nên không dùng môi trường đó để kết luận nhập Excel hoạt động.

Backend đã kết nối được ở lần kiểm tra cuối (`backend:check` đạt). Script `smoke-study-import.mjs` gửi multipart thật tới đúng hai endpoint nhập: cả 8 trường hợp xlsx/CSV/JSON thành công hoặc lỗi 400 có đúng dòng/thiếu cột đều đạt, không tạo bộ chung hoặc tài khoản thử. Đã xác nhận server đọc được xlsx; chưa thử tệp `.xls`/engine dành cho định dạng đó.

Chưa kiểm chứng upload từ React Native với JWT trên điện thoại, timeout/mất mạng thực, file cloud thực, AsyncStorage/haptics/animation/back gesture trên Android/iPhone. HTTP smoke dùng Node, không đại diện cho bộ chọn tệp/URI/native multipart trên thiết bị. Các kiểm tra này phải thực hiện theo checklist bên dưới.

## Checklist Android và iPhone

Thực hiện riêng trên cả hai hệ điều hành, với Expo Go đúng SDK; ghi phiên bản OS/Go và kết quả từng mục.

- [ ] Vào Luyện tập → Quiz và Flashcard; cả hai danh sách trống có hướng dẫn; lối Quiz Kanji mở chức năng cũ.
- [ ] Tạo Quiz: bỏ tên/câu/lựa chọn/đáp án thì báo lỗi; đủ dữ liệu lưu được; thêm/xóa/sửa nhiều câu, giải thích, cấp/chủ đề; bấm lưu liên tục không tạo trùng.
- [ ] Đổi tên/nhân bản/xóa và hủy xóa; tìm theo tên/tệp, lọc cấp/chủ đề/nguồn; đóng app/mở lại bộ còn nguyên sau khi khôi phục phiên.
- [ ] Chọn `quiz-valid.xlsx`, xem trước rồi hủy: không có bộ mới; chọn lại và xác nhận: có đúng 2 câu.
- [ ] Nhập hai mẫu Quiz lỗi: thấy đúng số dòng tính cả header/thiếu cột; không có bộ được lưu. Thử tệp rỗng, tệp giả đuôi, đáp án sai và dòng trống ở giữa.
- [ ] Quiz JSON: chọn mẫu hoặc dán nội dung; JSON sai báo rõ; ngắt server nhập tệp vẫn đọc JSON được khi đang đăng nhập.
- [ ] Thử tệp >5 MiB, JSON >1 MiB, hơn 500 mục; có thông báo, không làm đơ/crash. Hủy bộ chọn và thử tệp trên iCloud/Drive.
- [ ] Làm Quiz với xáo trộn bật/tắt; trả lời đúng/sai; nhấn nhanh nhiều lựa chọn vẫn chỉ chấm một lần; xem đáp án/giải thích/tiến độ.
- [ ] Hoàn thành: điểm/thời gian/câu sai đúng; làm lại câu sai chỉ có các câu đó; làm lại toàn bộ có đủ câu; cả trường hợp đúng tất cả và bộ chỉ một câu.
- [ ] Android Back và iPhone vuốt/header Back giữa bài: hủy thoát giữ phiên; xác nhận thoát bỏ phiên; sau kết quả quay về không hỏi không cần thiết.
- [ ] Tạo/sửa Flashcard: tên/hai mặt bắt buộc; nhập các mẫu hợp lệ/lỗi; preview/xác nhận/hủy giống Quiz.
- [ ] Học Flashcard: lật, trước/sau, đánh dấu nhớ/chưa nhớ; quay lại thẻ đã chấm không tăng thống kê lần hai trong cùng lượt; xáo trộn/đổi bộ/bắt đầu lại có xác nhận.
- [ ] Kết thúc Flashcard: tổng đúng/sai/chính xác đúng; danh sách phản ánh thống kê; mở lại giữ thống kê tích lũy; lượt học mới có thể đánh dấu lại.
- [ ] Hai tài khoản cùng máy: A tạo bộ, đăng xuất; B không thấy bộ/thống kê A; A đăng nhập lại thấy bộ cũ; reset cục bộ A không xóa B.
- [ ] Mất mạng/timeout giữa nhập Excel: không lưu gì, có lỗi/thử lại chủ động; hết JWT về đăng nhập; không tự gửi lại sau khi mạng trở lại.
- [ ] Bàn phím không che ô đang sửa; nội dung rất dài không cắt mất mặt sau; danh sách nhiều mục vẫn cuộn; safe area không đè nút.
- [ ] Đổi vi/en, sáng/tối/hệ thống; nhãn, lỗi cục bộ, hộp xác nhận và trạng thái trống đều đổi; nội dung học và chi tiết server giữ nguyên.
- [ ] Thiết bị không hỗ trợ rung vẫn học bình thường. Thử lỗi bộ nhớ trên bản thử nghiệm: không báo lưu thành công khi ghi thất bại; không tự xóa dữ liệu hỏng.

## Tệp thay đổi của Giai đoạn 4

- `src/features/study/{types,quizAnswers,validation,importErrors,storage,useStudy}.ts`.
- `src/api/studyImport.ts`.
- `src/screens/study/{shared,StudyHubScreen,StudyLibraryScreen,StudyEditorScreen,StudyImportScreen,QuizPlayScreen,FlashcardPlayScreen}.tsx`.
- `app/study/{index,quiz,flashcard,editor,import,quiz-play,flashcard-play}.tsx`.
- Sửa `src/screens/PracticeScreen.tsx`, `app/_layout.tsx`, `src/components/questions/QuestionCard.tsx`.
- Sửa hai `src/i18n/locales/{vi,en}.json`, `package.json`, `package-lock.json`.
- `tests/study.test.ts`, `scripts/generate-study-samples.py`, `scripts/verify-study-import.py`, `scripts/smoke-study-import.mjs`, `docs/samples/study/`, tài liệu này và README.

Không commit/gộp thay đổi sẵn có của các giai đoạn trước hoặc dữ liệu ML người dùng vào một commit mới. Không chỉnh cấu hình API/model/backend.
