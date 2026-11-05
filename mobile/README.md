# SenpaiAI Mobile — Giai đoạn 0 và 1

Ứng dụng React Native riêng trong `mobile/`, trên nhánh `version1.3`. Không thay đổi mã web, file dịch web, cấu trúc cơ sở dữ liệu hoặc API FastAPI. Những thay đổi web/backend đã có từ công việc trước không thuộc giai đoạn này.

## Giai đoạn 1 — kết quả và giới hạn thực tế

Đã kiểm tra nền tảng trước khi triển khai: đăng ký/đăng nhập/khôi phục phiên, máy khách JWT, dịch vi/en, theme classic và 5 tab có đủ; typecheck, lint và 16 test nền tảng đạt. Luồng API thật của Giai đoạn 0 đạt, tài khoản thử đã được dọn. `.env` hiện dùng `10.0.2.2` cho Android Emulator; URL này không dùng để kiểm tra từ PC hay điện thoại thật.

**Hằng ngày:** tổng quan lấy ngày và tiến độ từ server, điểm/chuỗi từ `/rewards/me`, lịch 7 ngày từ `/daily/history`. Có kéo làm mới, bắt đầu/tiếp tục, bài làm từng câu, phản hồi và tổng kết. Các dạng được hỗ trợ: ngữ pháp fill_blank, reorder (thẻ có chỉ số riêng nên từ lặp vẫn xếp đúng), true_false, conjugation; kanji/vocab trắc nghiệm; flashcard tự đánh giá. Không làm bài ngữ pháp độc lập hoặc luyện kanji độc lập.

Đáp án được gửi với thời gian đo bằng `performance.now()`, giới hạn trong phạm vi API nhận (0–3.600.000 ms). Nút bị khóa khi gửi; các lần chạm liên tiếp được gộp. Trước mỗi lần thử, đọc trạng thái server. Nếu đã lưu thì phục hồi đáp án/giải thích thay vì POST lại. Sau lỗi mất phản hồi cũng đối chiếu server trước khi đề nghị thử lại. Backend chưa có idempotency key cho API trả lời: không thể bảo đảm “exactly once” tuyệt đối giữa nhiều thiết bị hoặc request đang xử lý khi mất mạng, nhưng không tự gửi lại POST và đã kiểm tra trường hợp server lưu xong mà mất response. API hiện trả `item_already_answered` khi đáp án đã được ghi nhận.

Mở lại bài chọn câu đầu tiên chưa trả lời từ server; Back Android, nút quay lại và thao tác bỏ màn hình của Router đều hỏi xác nhận trong bài chưa hoàn thành. Không thể chặn việc hệ điều hành buộc đóng app; câu đã gửi vẫn được khôi phục. Sau câu cuối, gọi `/daily/complete`, chỉ hiển thị breakdown do server trả về, cập nhật cache điểm/chuỗi/Hồ sơ/lịch. Thao tác hoàn thành có thể thử lại vì backend đã xử lý idempotent.

Đếm ngược tính từ **ngày API + header HTTP Date + thời gian monotonic**, không lấy ngày/giờ tường của thiết bị làm chuẩn. Múi giờ hiện tại của backend là `Asia/Ho_Chi_Minh` (UTC+07), nên đích là nửa đêm kế tiếp ở UTC+07; đã có test thời điểm 23:59:30 → 00:00:00. API chưa trả timezone/next_reset_at; nếu cấu hình server thay đổi thì phải đồng bộ giả định này. Thiếu Date header sẽ hiện lời nhắc làm mới, không hiển thị một đồng hồ suy đoán.

**Thư viện:** FlatList cho danh sách, tìm kiếm debounce 350 ms, chọn loại/JLPT bằng Modal và FlatList, thống kê gọn, phân trang offset, tải thêm khi cuộn, kéo làm mới, trạng thái trống/lỗi. Chi tiết giữ nguyên văn bản và xuống dòng trong Text có thể chọn sao chép; có thẻ, loại, cấp, ngày và mở nguồn HTTP(S). Biểu mẫu tạo/chỉnh sửa dùng quy tắc của web (tiêu đề/nội dung bắt buộc, HTTP(S), loại và JLPT hợp lệ), bộ đếm ký tự, lấy nội dung URL vào biểu mẫu để xem/sửa trước khi lưu. Không thêm giới hạn ký tự tự nghĩ ra: web/API hiện không công bố max_length cho tiêu đề/nội dung. Lỗi 413 hoặc thông báo quota của server dùng khóa dịch giới hạn đã có. Không có nhập tệp/hàng loạt.

**Các phần bị chặn bởi hợp đồng API hiện tại — không sửa backend để lách yêu cầu:**

| Thiếu ở API | Hành vi mobile | Đề xuất tối thiểu nếu muốn hoàn tất chức năng |
| --- | --- | --- |
| Document và SearchResult không có `scope`, `is_mine`, `can_edit`, `can_delete`; model hiện không có owner_id | Hiện “Chưa rõ phạm vi”; không gán nhãn hệ thống/của tôi bằng suy đoán. Ẩn sửa/xóa, kể cả truy cập trực tiếp route sửa. Chỉ bật khi `is_mine === true` và quyền tương ứng là `true`; tài liệu scope system không được sửa/xóa | Backend cần xác định chủ sở hữu, trả metadata quyền trong list/search/detail và thực thi quyền phía server cho PUT/DELETE |
| List/search không khai báo hoặc xử lý tham số scope | Bảng chọn vẫn có Tất cả/Của tôi/Hệ thống, nhưng các lựa chọn chưa có căn cứ bị vô hiệu hóa và có lời giải thích | Thêm lọc scope trong list/search có kiểm tra quyền. Không thể giả vờ lọc từ một trang dữ liệu đang tải dở |
| Create không hỗ trợ phạm vi riêng tư/owner trong hợp đồng hiện tại | Vẫn cho tạo bằng API hiện có; biểu mẫu nói rõ tài liệu mới có thể được người khác xem, không ghi “chỉ mình tôi” | Xác định owner từ JWT khi tạo và quy định scope hợp lệ; không tin owner_id do client gửi |
| Không có total/has_more trong search | Tải tiếp theo số lượng trang; dừng khi trang ngắn/rỗng và gộp ID trùng | Có thể bổ sung total hoặc next cursor khi cần tối ưu, không bắt buộc giai đoạn này |
| Không có API quota/giới hạn độ dài công bố cho tài liệu | Hiện lỗi giới hạn khi server trả về, không hiển thị quota hoặc hạn mức giả | Công bố giới hạn nếu thực sự có và thực thi trên server |
| Flashcard không trả nghĩa trước khi tự đánh giá | Yêu cầu tự nhớ rồi đánh giá; nghĩa hiện trong feedback. Không có nút “xem nghĩa” giả | Chỉ bổ sung nghĩa trước đáp án nếu thiết kế học cần xem trước |
| Nội dung câu hỏi, giải thích và ví dụ thường là tiếng Việt cố định | Mọi nhãn/nút/lỗi mobile có vi/en; nội dung học được hiển thị nguyên văn server | Muốn nội dung học song ngữ đầy đủ cần response_language hoặc dữ liệu song ngữ. Tài liệu mẫu có thể dùng language hiện có |

Vì thiếu quyền/scope, yêu cầu sửa/xóa và huy hiệu đúng chủ sở hữu **chưa thể kiểm chứng end-to-end trong app với backend hiện tại**. Đã xây dựng luồng biểu mẫu/xác nhận và kiểm tra quyền trước khi gọi API; tuyệt đối không dùng khả năng API đang cho PUT/DELETE mọi tài liệu để suy đoán rằng người dùng có quyền. Script tích hợp chỉ sửa/xóa tài liệu dùng một lần do chính lần kiểm tra đó tạo và xác minh ID/tiêu đề trước khi dọn.

### File Giai đoạn 1

- Sửa: `src/api/types.ts`, `src/api/services.ts`, `src/components/ui.tsx`, `src/screens/DailyScreen.tsx`, `app/_layout.tsx`, `app/(tabs)/library.tsx`, hai locale mobile vi/en, `package.json`, README.
- Tạo: `src/utils/date.ts`, `src/features/daily/logic.ts`, `submission.ts`, `src/features/library/logic.ts`, `src/components/ChoiceSheet.tsx`, `daily/DailyQuestion.tsx`, `daily/RewardSummary.tsx`, `library/DocumentCard.tsx`.
- Tạo màn hình: `DailyExerciseScreen.tsx`, `LibraryScreen.tsx`, `LibraryDetailScreen.tsx`, `LibraryEditorScreen.tsx`; route `app/daily-exercise.tsx`, `app/library-editor.tsx`, `app/library-document/[id].tsx`.
- Tạo kiểm tra: `tests/daily.test.ts`, `tests/library.test.ts`, `scripts/generate-routes.mjs`, `scripts/smoke-phase1.mjs`. Bộ sinh route dùng đúng công cụ của Expo SDK đang ghim, không tắt typed routes để né kiểm tra.
- Không thêm dependency runtime hoặc module native. Không sửa file web/backend trong Giai đoạn 1. Khóa dùng chung tiếp tục import trực tiếp từ web; câu mới đặt vào namespace mobile của cùng instance i18next và thêm đồng thời vi/en.

### Chạy và kiểm tra Giai đoạn 1

```text
cd mobile
npm ci
npm run check
npm run export:check
npm start -- --clear
```

Chạy smoke test từ PC với backend thật (có tạo dữ liệu dùng một lần và tự dọn):

```powershell
$env:EXPO_PUBLIC_API_URL='http://127.0.0.1:8000/api'
npm run smoke:phase1 -- --create-test-account
```

Smoke test thực hiện hết một task, tải lại giữa từng câu, kiểm tra chống trả lời hai lần, hoàn thành hai lần không nhận điểm trùng, đối chiếu history/rewards; tạo/đọc/sửa/tìm tài liệu thử, phân trang, loại/JLPT, stats/categories và lấy nội dung từ một HTTP HTML fixture kiểm soát tại localhost. Không gọi mạng ngoài để kéo bài không kiểm soát. Cuối cùng dọn tài liệu thử và tài khoản/lịch sử thử; không in credential.

Đã kiểm tra trên máy phát triển: typecheck/lint và **26 test đạt**; kiểm tra đủ 11 namespace dịch web và namespace mobile vi/en đạt. Smoke API thật đã đạt và đã dọn dữ liệu. Task thực tế trong lần chạy có kanji_reading, kanji_meaning, true_false, conjugation, fill_blank; việc chọn câu do backend quyết định nên không khẳng định một task đó chứa đủ mọi dạng. Unit tests có cả reorder, vocab và flashcard, cùng mất response, retry, sai ngày, từ lặp và quyền tài liệu thiếu/đối nghịch. Chưa có phiên Android/iPhone để kiểm thử chạm giao diện; checklist bên dưới là việc cần làm trên thiết bị, không phải kết quả đã hoàn tất.

### Expo Go và khác biệt Android/iPhone

Giai đoạn 1 chỉ dùng React Native, Expo Router, SecureStore và các module đã có trong Giai đoạn 0; không có chức năng mới bắt buộc development build. Giữ SDK 58 hiện tại để tránh nâng/hạ nền tảng trong đợt gấp. Expo Go trên thiết bị phải khớp SDK: [tài liệu Expo](https://docs.expo.dev/router/introduction/) hiện khuyến nghị SDK 57 nếu bản Expo Go phát hành chưa hỗ trợ 58. Nếu iPhone không mở được SDK 58, phương án **không cần native build** là đồng bộ toàn bộ bộ dependency Expo về SDK được bản Expo Go trên iPhone hỗ trợ; không chỉ sửa số expo một mình. Chưa tự hạ SDK vì việc đó thay đổi nền tảng đã chạy. Xem [hướng dẫn không khớp Expo Go](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/). Việc xuất bundle iOS đạt không chứng minh Expo Go cài trên iPhone bất kỳ đã hỗ trợ SDK đó.

Những khác biệt được xử lý trong code: Android có nút Back phần cứng; iPhone có thao tác swipe-back và vùng tai thỏ/home indicator, nên dùng Router prevent-remove và safe-area insets. Modal có onRequestClose cho Android. iOS dùng KeyboardAvoidingView padding, Android dựa trên adjustResize của cấu hình native đã có. TextInput không được tự đổi bộ gõ hệ thống: người học cần thêm/chọn bàn phím tiếng Nhật trên cả hai máy; web hiện không chuyển romaji trong component chia động từ nên mobile cũng không tự chuyển. Chọn/sao chép nội dung dùng menu chọn chữ của từng hệ điều hành, không thêm thư viện clipboard.

Không tuyên bố đã quan sát lỗi giao diện thực tế trên Android/iPhone trong lần triển khai này, vì chưa có phiên thiết bị được kết nối. Những mục trên là khác biệt API/vòng đời đã xử lý, cần xác nhận thực tế theo checklist.

### Checklist thủ công Giai đoạn 1 — thực hiện riêng trên Android và iPhone

- [ ] Đăng nhập; kiểm tra 5 tab, đổi vi/en và sáng/tối/theo hệ thống; mở app lại vẫn giữ lựa chọn.
- [ ] Tổng quan: đối chiếu ngày nhiệm vụ, số dư, streak, lịch và tiến độ với API/web; kéo làm mới. Đổi sai đồng hồ điện thoại không được đổi ngày nhiệm vụ.
- [ ] Làm một task tới cuối, kiểm tra trắc nghiệm ngữ pháp/kanji/vocab, true_false, reorder có từ trùng, nhập conjugation bằng bàn phím Nhật, flashcard nhớ/chưa nhớ. Nếu task do server chọn không có đủ dạng, dùng tài khoản/bộ dữ liệu thử phù hợp; không sửa production task để ép dạng.
- [ ] Mỗi câu: kiểm tra đúng/sai, đáp án đúng, giải thích, ví dụ; cấp thực của câu và thông báo lấy cấp khác; nút tiếp không bỏ qua feedback.
- [ ] Bấm đáp án liên tiếp; mất mạng trước gửi, ngay lúc gửi, sau khi server đã nhận; thử lại và xác nhận không tăng tiến độ/điểm hai lần. Có mạng lại phục hồi feedback đã lưu.
- [ ] Thoát bằng nút, Back Android, swipe-back iPhone: chọn ở lại/thoát; mở lại về câu chưa trả lời. Tắt hẳn app giữa bài, mở lại và đối chiếu trạng thái server.
- [ ] Hoàn thành: breakdown, số dư/streak mới khớp server; xem lại tổng kết không nhận điểm lần nữa; Hồ sơ/tổng quan cập nhật. Kiểm tra countdown qua nửa đêm của server và tải task mới.
- [ ] Lỗi not_enough_content, task_expired, items_incomplete có thông báo dịch được; thử lại hoặc về tổng quan không gửi đáp án của task cũ sang task mới.
- [ ] Thư viện: gõ nhanh rồi dừng, xóa tìm kiếm, lọc loại/JLPT, kéo làm mới, cuộn tải thêm, lỗi tải trang sau và thử lại; không trùng thẻ, nhãn và nội dung cập nhật đúng khi đổi ngôn ngữ.
- [ ] Phạm vi/quyền chưa có trong API hiện tại: bộ lọc Của tôi/Hệ thống không giả vờ hoạt động, huy hiệu ghi chưa rõ phạm vi; không thấy sửa/xóa, mở thẳng route sửa vẫn bị chặn.
- [ ] Với backend thử có metadata quyền hợp lệ: tài liệu của tôi mới có sửa/xóa; tài liệu system hoặc quyền false không có; xóa có xác nhận; đổi quyền trong lúc mở form phải được kiểm tra lại trước lưu/xóa.
- [ ] Tạo tài liệu thử: trường rỗng, URL sai, JLPT/loại, thẻ, tiếng Việt/Nhật; đọc thông báo phạm vi, lưu rồi mở chi tiết; kiểm tra thông báo quota khi server trả lỗi giới hạn.
- [ ] Dán URL HTTP(S): lấy nội dung, hỏi trước khi thay nội dung đã nhập; xem/chỉnh sửa rồi mới lưu; lỗi URL/trang không đọc được giữ nội dung đang nhập.
- [ ] Nhập/dán ghi chú dài nhiều đoạn trên cả hai OS; ô nhập cuộn được, bàn phím không che caret/nút lưu, chọn/sao chép giữ xuống dòng, mở nguồn được.
- [ ] Mất mạng ngay sau lưu mới: có thông báo chưa xác nhận và nút kiểm tra danh sách; không tự POST lần hai tạo bản trùng. Dọn tài liệu thử bằng tài khoản có quyền hoặc công cụ kiểm thử riêng.

Các điểm khó từ web đã xử lý: không tái sử dụng form HTML/portal/select CSS; dùng TextInput, Modal và FlatList. Logic ngày lấy server giống web nhưng sửa công thức countdown để đúng nửa đêm UTC+07; không sao chép lỗi công thức web. Request/mapping lỗi giữ contract cũ. Điểm không tính trên máy khách. Quyền/scope chỉ có trong kỳ vọng UI web nhưng không nằm trong schema/backend thực tế nên không thể chuyển nguyên kỳ vọng đó thành chức năng thật.

Phần hướng dẫn nền tảng bên dưới mô tả Giai đoạn 0 và vẫn áp dụng cho cấu hình/chạy app.

## Các quyết định nền tảng

- **Expo SDK 58, TypeScript, Expo Router**: điều hướng theo file, nhóm màn hình đăng nhập và nhóm tab được bảo vệ bằng trạng thái xác thực. Deep link không mở được tab riêng tư khi chưa đăng nhập. Năm tab: Hằng ngày, Trò chuyện, Thư viện, Luyện tập, Cá nhân.
- **StyleSheet + token theme**: NativeWind v4 ổn định được tài liệu xác nhận đến SDK 57, trong khi v5 còn RC tại thời điểm triển khai. Giai đoạn 0 dùng thành phần React Native và StyleSheet để tránh ghép bộ phiên bản chưa được xác nhận trên SDK 58. Không dùng HTML, CSS hoặc WebView để dựng lại web.
- **Dùng trực tiếp dữ liệu web**: `src/i18n/resources.ts` import các JSON tại `../frontend/src/i18n/locales`; `src/theme/ThemeProvider.tsx` import `../frontend/src/themes/themes.ts`. Không sao chép tài nguyên dùng chung. `metro.config.js` theo dõi hai thư mục ngoài ứng dụng và phân giải dependency từ mobile. File theme web hiện là dữ liệu TypeScript thuần, không phụ thuộc DOM. Chỉ sử dụng các màu hợp lệ với React Native; không sử dụng gradient CSS, `rem`, `box-shadow`, hoặc tên font CSS. Dùng font hệ thống hỗ trợ chữ Việt/Nhật.
- **Classic sáng/tối/theo hệ thống**: lấy màu trực tiếp từ web. `useColorScheme()` cập nhật khi giao diện hệ điều hành thay đổi. Registry `nativeThemes` sẵn để thêm bộ giao diện; chưa đồng bộ cửa hàng hoặc theme trả phí.
- **React Query 3.39.3 và React Hook Form 7**: cùng phiên bản chính với web. Query 3 chưa khai báo peer React 19; package có override giới hạn riêng peer React của `react-query`, không tắt kiểm tra peer toàn dự án. Đã có smoke test render hook Query 3 dưới React đang ghim. Đây chưa phải cam kết tương thích chính thức của upstream; cần kiểm tra thêm trên thiết bị khi phát triển các màn hình tiếp theo. `react-dom` được ghim cùng bản với React để các dependency của Router không kéo bản vá khác; ứng dụng không dùng DOM làm giao diện.
- **SecureStore**: JWT chỉ được lưu qua `expo-secure-store`, không đưa vào AsyncStorage, file `.env`, log hoặc cache Query. AsyncStorage chỉ lưu ngôn ngữ, lựa chọn sáng/tối và tùy chọn ngôn ngữ đang chờ đồng bộ. Không bật lưu bền cache dữ liệu riêng tư.

Tham khảo: [Expo 58](https://expo.dev/changelog/sdk-58), [Expo Router](https://docs.expo.dev/router/introduction/), [NativeWind](https://www.nativewind.dev/docs/getting-started/installation), [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/), [Metro và monorepo](https://docs.expo.dev/guides/monorepos/).

## Đã có trong giai đoạn này

1. Đăng ký, đăng nhập, đăng xuất; khôi phục phiên bằng `/api/auth/me` sau khi đọc token an toàn. Quy tắc biểu mẫu giống web: email có định dạng hợp lệ; username 3–20 ký tự chữ ASCII/số/gạch dưới; mật khẩu đăng ký ít nhất 6 ký tự; nhập lại mật khẩu phải khớp. Đăng nhập chỉ yêu cầu mật khẩu không rỗng như web.
2. Axios gắn Bearer token ở request interceptor, timeout 15 giây; lỗi 401 của request đã xác thực xóa token/cache riêng tư và chuyển về nhóm đăng nhập. Sai mật khẩu trên `/auth/login` hiện lỗi ở biểu mẫu. Phản hồi đến muộn từ token cũ không đăng xuất một phiên mới. Không có API refresh token trong backend hiện tại; token hết hạn cần đăng nhập lại.
3. Mở app khi mất mạng không xóa JWT: hiện màn hình xác minh phiên thất bại, nút thử lại và hướng dẫn kết nối. Không cho vào dữ liệu riêng tư khi chưa xác minh được phiên. SecureStore lỗi sẽ chặn phiên và cho thử lại/đăng xuất.
4. Dịch vi/en: lấy ngôn ngữ thiết bị nếu là vi/en, còn lại chọn vi; ưu tiên lựa chọn đã lưu trên thiết bị. Khi đăng nhập, lấy tùy chọn hồ sơ giống web. Khi đổi ngôn ngữ, lưu trên thiết bị rồi PUT `/auth/me`. Nếu mạng lỗi, lưu lựa chọn chờ theo user id, hiện thông báo và nút đồng bộ lại; thử lại khi đăng nhập lần sau. File dịch riêng mobile chỉ chứa câu mới dành cho mobile.
5. Hồ sơ: tên, email, JLPT, điểm bài tập, ngày tham gia; `/rewards/me` cung cấp điểm thưởng và chuỗi hiện tại/dài nhất. Có nút làm mới và trạng thái lỗi riêng cho phần thưởng.
6. Hằng ngày: gọi `/daily/today`, hiện ngày **do backend trả về**, trạng thái, số câu đã trả lời/tổng số và điểm nếu hoàn thành. Không gửi câu trả lời hoặc hoàn thành nhiệm vụ. GET này có thể tạo nhiệm vụ hôm nay theo hành vi có sẵn của backend.
7. Trò chuyện, Thư viện, Luyện tập là màn hình tạm đã dịch; Luyện tập liệt kê Ngữ pháp, Kanji, Luyện nghe, Trò chơi. Cá nhân chứa Hồ sơ thật và Cài đặt ngôn ngữ/theme/kết nối.
8. Màn hình không tìm thấy, ErrorBoundary cho lỗi render, handler lỗi JavaScript không bắt được; xử lý rejection nếu runtime phát sự kiện chuẩn. Lỗi hệ điều hành/native crash không thể được phục hồi bằng ErrorBoundary JavaScript.

## Chuẩn bị

- Node **24.3+** trong nhánh 24 LTS, hoặc phiên bản phù hợp trường `engines` trong `package.json`; đã chạy kiểm tra trên Node 24.18.0.
- Backend đang chạy, dữ liệu đã seed để tạo nhiệm vụ hằng ngày. Không cần thay API hoặc CORS cho request React Native thuần.
- Giữ cấu trúc `frontend/` và `mobile/` cạnh nhau. Không tách/upload riêng `mobile/` mà bỏ mất `frontend/src/i18n/locales` và `frontend/src/themes`.

Từ gốc repo:

```powershell
cd mobile
npm ci
Copy-Item .env.example .env
```

Trên macOS/Linux dùng `cp .env.example .env`. Trên PowerShell bị chặn `npm.ps1`, dùng `npm.cmd`/`npx.cmd` thay cho `npm`/`npx`. Sửa `.env` theo thiết bị; không dùng nguyên IP ví dụ nếu máy bạn có IP khác.

## Địa chỉ API và kết nối mạng

Biến bắt buộc:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.10:8000/api
```

URL phải kết thúc bằng `/api`. Đây là cấu hình công khai được nhúng vào bundle, không phải nơi đặt mật khẩu/token. Sau khi sửa, dừng Expo rồi khởi động lại (có thể thêm `--clear`). App không tự đoán `localhost` khi thiếu biến; sẽ hiện hướng dẫn cấu hình.

| Nơi chạy app | Ví dụ URL |
| --- | --- |
| Android thật / iPhone cùng Wi-Fi với máy backend | `http://192.168.1.10:8000/api` — thay bằng IPv4 LAN của máy backend |
| Android Studio Emulator | `http://10.0.2.2:8000/api` |
| iOS Simulator cùng máy Mac với backend | `http://localhost:8000/api` |
| Thiết bị ở mạng khác | `https://TEN-TUNNEL-CUA-BAN/api` — tunnel riêng đến backend cổng 8000 |

Kiểm tra tại thời điểm triển khai 05/11/2026: backend trên máy này đang **LISTENING `0.0.0.0:8000`**; `/health` trả về `healthy`. Không sửa hoặc khởi động lại backend. Có thể kiểm tra lại bằng:

```powershell
netstat -ano -p tcp | Select-String ':8000\s'
npm run backend:check
```

`backend:check` chạy trên máy phát triển, không trên emulator: khi kiểm tra từ PC, dùng tạm `EXPO_PUBLIC_API_URL=http://127.0.0.1:8000/api` hoặc IP LAN. `10.0.2.2` chỉ có ý nghĩa bên trong Android Emulator. Kết quả PC thành công chưa chứng minh điện thoại truy cập được.

Nếu lần sau server chỉ nghe `127.0.0.1`, tự khởi động backend từ thư mục `backend` bằng:

```text
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Không chạy thêm server trùng cổng nếu server cũ còn hoạt động. Docker Compose hiện cũng có cấu hình host `0.0.0.0`.

Trên máy thật, dùng trình duyệt mở `http://IP-LAN:8000/health`. Nếu không mở được: kiểm tra cùng Wi-Fi, IPv4 bằng `ipconfig`, VPN/AP isolation của router, quyền Local Network trên iPhone, và quy tắc tường lửa cho cổng 8000 trong mạng riêng. App có panel kiểm tra `/health`, hiện URL đang dùng và các gợi ý này. Không tắt toàn bộ tường lửa.

## Chạy trên Android và iPhone

Các chức năng giai đoạn 0 dùng module Expo hỗ trợ; không cần custom native module. **Ứng dụng Expo Go cài trên thiết bị phải hỗ trợ SDK của dự án**. Theo [tài liệu Expo Go](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/), bản SDK được ứng dụng trên store hỗ trợ có thể khác SDK mới nhất. Nếu iPhone chưa có Expo Go hỗ trợ SDK 58, phương án ưu tiên không cần native build là đồng bộ dự án với SDK mà bản Expo Go đó hỗ trợ; development build là lựa chọn khác nếu bạn chấp nhận. Không hạ riêng số `expo` trong `package.json` mà giữ nguyên các dependency khác. Xem lưu ý Giai đoạn 1 ở đầu tài liệu.

**Android thật:**

1. Cài Expo Go phù hợp SDK 58 từ [expo.dev/go](https://expo.dev/go) nếu bản Play Store không khớp.
2. Đặt API bằng IPv4 LAN; điện thoại và PC cùng Wi-Fi.
3. Chạy `npm start`; mở Expo Go quét QR.
4. Kiểm tra panel backend trước khi đăng ký/đăng nhập.

**Android Studio Emulator:**

1. Cài Android Studio, Android SDK và tạo/mở emulator. Kiểm tra `adb devices` thấy thiết bị.
2. Đặt API `http://10.0.2.2:8000/api`.
3. Chạy `npm run android` hoặc `npm start` rồi bấm `a`. Expo CLI có thể yêu cầu cài bản Expo Go phù hợp.

**iPhone qua Expo Go, khi bản cài hỗ trợ SDK 58:**

1. Đặt API IPv4 LAN hoặc HTTPS tunnel, không dùng `localhost`.
2. Chạy `npm start`, quét QR bằng Camera rồi mở Expo Go; cấp quyền Local Network nếu được hỏi.
3. Trên Windows vẫn phục vụ Metro/API cho iPhone thật được; iOS Simulator cần macOS/Xcode.

**Development build khi Expo Go không hỗ trợ SDK hoặc để kiểm tra native thực tế:**

```text
npx eas-cli login
npx eas-cli env:create --name EXPO_PUBLIC_API_URL --value https://TEN-BACKEND/api --environment development --visibility plaintext
npx eas-cli build --platform android --profile development
npx eas-cli build --platform ios --profile development
npm run start:dev
```

Chọn đúng nền tảng; không cần chạy cả hai lệnh build. Thay `https://TEN-BACKEND/api` bằng URL thật; `.env` cục bộ bị Git bỏ qua nên phải khai báo biến cho môi trường EAS, hoặc dùng local build với biến tương ứng. Cần tài khoản Expo; build cài trên iPhone thật cần cấu hình ký và thiết bị Apple phù hợp. Cài artifact do EAS trả về rồi kết nối Metro. Có profile `development-simulator` cho iOS Simulator. Trên máy có sẵn native toolchain cũng có thể dùng `npx expo run:android` / `npx expo run:ios`.

Development build với API HTTP được cấu hình cho phép HTTP Android qua plugin `expo-build-properties`; iOS cho phép mạng cục bộ. Với backend công khai hoặc build phân phối, dùng HTTPS. Các thay đổi plugin/native config cần build lại development client, không chỉ reload JS. Chưa tạo, ký hoặc phát hành build EAS trong lần triển khai này.

## Thử qua đường hầm

Metro và API là **hai dịch vụ riêng**:

```text
npm run start:tunnel
```

Lệnh trên chỉ tạo tunnel cho Metro (Expo có thể yêu cầu cài công cụ tunnel của CLI); **không** tự public cổng 8000. Tạo thêm HTTPS tunnel riêng tới `http://localhost:8000` bằng công cụ tunnel của bạn, đặt `EXPO_PUBLIC_API_URL=https://TEN-TUNNEL/api`, rồi restart Expo. Mở `https://TEN-TUNNEL/health` trên điện thoại để kiểm tra. Nếu dùng development client thay Expo Go, chạy `npm run start:dev -- --tunnel`.

## Kiểm tra tự động

```text
npm run check
npx expo install --check
npx expo-doctor
npm run export:check
```

- `typecheck`: TypeScript strict cho code, route và tests.
- `lint`: ESLint, hooks và không cho dùng `any` tùy tiện; không có warning được chấp nhận.
- `test`: adapter Axios/session giả lập cho đăng ký, đăng nhập, restore, offline, 401, logout, secure storage lỗi và phản hồi đến muộn; đối chiếu validation với mã web; kiểm tra ánh xạ lỗi, URL API và render React Query dưới React đang ghim.
- `i18n:check`: đọc 11 namespace của web và namespace mobile; so sánh khóa, giá trị rỗng và biến nội suy giữa vi/en; không ghi lại file web.
- `export:check`: Metro xuất bundle Hermes cho Android và iOS, bao gồm dữ liệu import ngoài thư mục mobile. Export thành công chưa thay thế kiểm thử trên thiết bị.

Kiểm tra tích hợp tùy chọn với backend thật:

```powershell
$env:EXPO_PUBLIC_API_URL='http://127.0.0.1:8000/api'
npm run smoke:api -- --create-test-account
```

Script này cần opt-in rõ ràng: tạo tài khoản thử duy nhất, kiểm tra đăng ký → JWT → hồ sơ → phần thưởng → đồng bộ vi/en → tổng quan nhiệm vụ → JWT sai/401, rồi xác minh danh tính và xóa **chính tài khoản thử đó** cùng dữ liệu của nó bằng API có sẵn. Không dùng tài khoản đang làm việc. Không in token/mật khẩu, không lưu credential xuống đĩa. Cần backend có đủ seed để `/daily/today` thành công. Nếu cleanup lỗi, script báo username/id tài khoản thử cần dọn.

Kết quả đã xác nhận: typecheck/lint đạt; **16/16 test mobile đạt** (bao gồm bản sửa Intl); **Expo Doctor 20/20 đạt** ở giai đoạn nền tảng; khóa dịch vi/en hợp lệ; export Hermes Android/iOS đạt; cấu hình manifest Android cho HTTP cục bộ đã được kiểm tra bằng Expo introspection; smoke API thật đạt và tài khoản thử đã được dọn. Bản sửa TrustedHost có thêm **3 test backend đạt**; kiểm tra `/health` qua IP LAN sau khi restart backend đạt. Đối chiếu hash trước/sau cho tài nguyên dịch, theme và dịch vụ web được theo dõi không có thay đổi. Kiểm thử chạm giao diện trên Android/iPhone/Expo Go và việc cấp quyền SecureStore trên thiết bị vẫn cần thực hiện theo checklist dưới đây; máy làm việc hiện tại chưa có phiên thiết bị để kiểm chứng.

## Checklist kiểm tra thủ công

- [ ] Cấu hình đúng IP: panel kết nối báo thành công trên chính điện thoại; thiếu biến hoặc sai địa chỉ thì có hướng dẫn rõ.
- [ ] Đăng ký: kiểm tra email sai, username ngắn/dài/ký tự lạ, mật khẩu dưới 6 ký tự, nhập lại khác; không gửi API khi dữ liệu không hợp lệ.
- [ ] Đăng ký hợp lệ: tự đăng nhập, mở đủ năm tab; email/username trùng hiển thị thông báo đã dịch. Nếu tự đăng nhập thất bại sau khi đã tạo tài khoản, màn hình báo đã tạo và chỉ thử đăng nhập lại.
- [ ] Đăng nhập: sai mật khẩu vẫn ở màn hình đăng nhập; đúng mật khẩu vào Hằng ngày, mở Cá nhân thấy thông tin/JLPT/điểm/chuỗi giống backend.
- [ ] Đóng hẳn rồi mở lại app: token hợp lệ khôi phục phiên; không có token trở về đăng nhập.
- [ ] Mất mạng: tắt Wi-Fi/backend khi xem dữ liệu, kiểm tra lỗi và nút thử lại; mở app khi mất mạng có token không bị xóa và chưa vào tab riêng tư. Có mạng trở lại thử lại thành công.
- [ ] Đổi vi/en: tiêu đề tab, biểu mẫu, lỗi, Hồ sơ và Cài đặt cùng đổi; đóng/mở app vẫn giữ lựa chọn; kiểm tra `ui_language` trên web hoặc API. Mất mạng khi đổi thì có thông báo chờ, bấm đồng bộ lại khi có mạng.
- [ ] Sáng/tối/theo hệ thống: đổi ở Cài đặt; khởi động lại vẫn giữ; khi chọn theo hệ thống, đổi appearance của Android/iOS khi app đang mở và kiểm tra màu cập nhật.
- [ ] Đăng xuất: về đăng nhập, nút Back/deep link không mở tab riêng tư; mở lại app không tự đăng nhập; tài khoản khác không thấy cache của tài khoản cũ.
- [ ] JWT hết hạn: dùng token test do backend phát với hạn rất ngắn trong môi trường thử hoặc chờ hết hạn, gọi Hồ sơ/Làm mới; phải về đăng nhập với thông báo hết phiên. Không thêm màn hình dán/xem token trong app.
- [ ] Hằng ngày: đối chiếu ngày/trạng thái/số câu với web; ngày mới đổi theo server khi bấm làm mới hoặc app trở lại foreground; kiểm tra lỗi thiếu dữ liệu seed có thông báo dịch được.
- [ ] Android Emulator với `10.0.2.2`, Android thật qua LAN, iPhone thật qua LAN/HTTPS tunnel; test SecureStore và cấp quyền Local Network trên từng thiết bị.
- [ ] Trong bản debug, gây lỗi render/event thử để xác nhận màn hình lỗi chung và khả năng thử lại; không log credential.

## File đã tạo

```text
mobile/
  package.json, package-lock.json
  app.config.ts, eas.json, tsconfig.json
  metro.config.js, babel.config.js, eslint.config.js
  .gitignore, .env.example, README.md
  app/
    _layout.tsx, index.tsx, +not-found.tsx
    (auth)/_layout.tsx, login.tsx, register.tsx
    (tabs)/_layout.tsx, daily.tsx, chat.tsx, library.tsx, practice.tsx
    (tabs)/personal/_layout.tsx, index.tsx, settings.tsx
  src/
    config/env.ts
    api/client.ts, services.ts, types.ts
    storage/types.ts, secureToken.ts
    auth/session.ts, AuthProvider.tsx
    i18n/index.ts, polyfills.ts, resources.ts, LanguageProvider.tsx, locales/vi.json, locales/en.json
    theme/ThemeProvider.tsx
    utils/validation.ts, getErrorMessage.ts
    components/ui.tsx, LanguageSwitcher.tsx, ConnectivityPanel.tsx
    components/ErrorBoundary.tsx, RuntimeGuard.tsx
    screens/AuthScreen.tsx, DailyScreen.tsx, ProfileScreen.tsx
    screens/SettingsScreen.tsx, PlaceholderScreen.tsx
  scripts/check-i18n.mjs, check-backend.mjs, smoke-api.mjs
  tests/session.test.ts, shared-contracts.test.ts, react-query-compat.test.ts, intl-polyfills.test.ts
```

`node_modules`, `.expo`, bundle `dist`, `.env` và file type Expo sinh tự động được bỏ qua bởi Git. Chưa tạo thư mục native `android/`, `ios/`; Expo sẽ sinh khi prebuild/run native.

## Sửa lỗi khởi động Intl và chạy lại web

Nếu gặp stack `i18next::pluralResolver` ở `consoleLogger.error`, môi trường Hermes có thể thiếu `Intl.PluralRules`. `src/i18n/polyfills.ts` nạp FormatJS cho `getCanonicalLocales`, `Locale` và `PluralRules`, kèm dữ liệu vi/en, trước khi khởi tạo i18next. Giữ nguyên định dạng khóa `_one`/`_other` của web; không chuyển về JSON v3 để giấu lỗi. Có regression test giả lập runtime thiếu cả ba API. Tham khảo [FormatJS PluralRules](https://formatjs.github.io/docs/polyfills/intl-pluralrules/).

Sau khi cập nhật dependency hoặc `.env`:

```text
cd mobile
npm ci
npm start -- --clear
```

IP Wi-Fi có thể đổi theo DHCP. Không dùng IP mẫu trong `.env.example` làm địa chỉ thật. Lần kiểm tra sửa lỗi ghi nhận IP Wi-Fi máy backend là `192.168.1.3`; điện thoại thật cùng mạng dùng `http://192.168.1.3:8000/api`, Android Emulator vẫn dùng `http://10.0.2.2:8000/api`. Thử mở `/health` trên trình duyệt điện thoại trước.

Nếu `/health` trả về `400 Invalid host header`, backend đã nhận được request nhưng TrustedHostMiddleware từ chối địa chỉ trong Host header. Cấu hình `ALLOWED_HOSTS` trong `backend/.env` nay hỗ trợ danh sách host cụ thể, ví dụ `["localhost", "127.0.0.1", "0.0.0.0", "10.0.2.2", "192.168.1.3"]`. Khi IP LAN đổi, sửa cả URL mobile và danh sách này rồi khởi động lại backend. Bản sửa kết nối bổ sung cấu hình middleware này, giữ nguyên các endpoint, schema và dữ liệu API. Không đặt `ALLOWED_HOSTS=["*"]`.

Web hiện có chạy riêng từ gốc repo:

```text
cd frontend
npm run dev
```

Mở `http://localhost:3000` trên máy tính (hoặc IP LAN cổng 3000 trên điện thoại). Backend tiếp tục chạy ở cổng 8000. Giao diện mobile Giai đoạn 0 chỉ chia sẻ token màu và bản dịch; chưa tái tạo đầy đủ bố cục, hình ảnh và hiệu ứng của web.

## Điểm cần chú ý khi chuyển các màn hình còn lại

- Web dùng `localStorage`, `window.location`, DOM, portal, CSS/Tailwind, Framer Motion và icon DOM: phải thay bằng API/thành phần native. Máy khách web import singleton i18n cho trình duyệt nên mobile tái hiện thuật toán ánh xạ lỗi thay vì import cả singleton đó; test kiểm tra các trường hợp ánh xạ.
- Helpers web trộn validation thuần với `clsx`, `tailwind-merge` và i18n trình duyệt. Giai đoạn này giữ rule tương đương và có test đối chiếu trực tiếp; bước sau có thể tách package logic thuần nếu được phép sửa web.
- Theme web có gradient CSS, đường dẫn `/themes/*.webp`, hiệu ứng bóng, blur và font từ web. Mobile hiện chỉ dùng màu; ảnh nền/font/animation phải được đóng gói và thiết kế native khi mở rộng.
- React web 18 và React native hiện hành 19: không chia sẻ `node_modules` hoặc Provider. Logic Query/RHF có thể chia sẻ dần, nhưng Query 3 là nợ tương thích cần theo dõi trước khi mở rộng.
- Chat có thể cần streaming và giao tiếp vòng đời app; ghi âm, phát âm thanh và thông báo đẩy có quyền native, giới hạn nền và giới hạn Expo Go riêng. Những chức năng đó chưa triển khai ở đây.
- Vẽ kanji không dùng lại canvas/SVG/chuột DOM của web; cần thành phần vẽ, cử chỉ và bàn phím native.
- Nội dung học/tài liệu do backend trả về không tự được dịch bởi file UI; một số bài nghe dùng trường `vi` cố định. Cần thiết kế riêng khi làm Chat/Thư viện/Luyện nghe đa ngôn ngữ.
- API JWT hiện không có refresh token; backend trả ngày nhiệm vụ theo múi giờ server. Mobile không tự tính lại ngày bằng đồng hồ thiết bị và không tự giả lập refresh token.

Ngoài phạm vi Giai đoạn 0 ban đầu: Chat thật, Thư viện thật, bài luyện tập, ghi âm, vẽ kanji, thông báo đẩy, cửa hàng giao diện. Giai đoạn 1 đã bổ sung Hằng ngày và Thư viện như báo cáo đầu tài liệu; Chat, luyện tập độc lập, ghi âm, vẽ kanji, thông báo và cửa hàng vẫn chưa triển khai.
