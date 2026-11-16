# SenpaiAI Mobile — Giai đoạn 0 đến 4

## Minigame đợt 2 trên Expo

Mỗi thẻ có nút **Cách chơi** với mục tiêu, ba bước và mẹo riêng dùng chung bản dịch vi/en với web. Trong ván, nút dấu hỏi tạm dừng rồi mở hướng dẫn. Hộp xác nhận thoát minigame dùng modal theo theme, có lựa chọn ở lại rõ ràng; đóng hướng dẫn/xác nhận không tự tiếp tục ván.

**Luyện tập → Trò chơi** có thêm Nối từ đánh quái, Xưởng ghép từ, Tìm từ ẩn, Ninja chém từ và Kanji mất nét. Dùng nguyên reducer/luật Đợt 2 trong `../shared-games` và khung ván Đợt 1; không sao chép luật, sửa web/backend hoặc thêm dependency. Điểm không cộng vào ví; điểm cao và công thức lưu riêng theo tài khoản trên thiết bị.

Bốn trò dùng từ hiện hỗ trợ N3; Kanji mất nét hỗ trợ N5/N4/N3 với bộ lọc theo độ khó. Pool API tải xong trước ván, nét SVG dùng kho chung đóng gói sẵn và lọc theo pool kanji. Không gọi mạng giữa ván. Xưởng dùng chạm thẻ, lưu công thức sau mỗi từ đúng; hai trò vuốt khóa cuộn trong cử chỉ, dùng PanResponder sẵn có. Ninja dùng native driver, tối đa 4 từ; Reduce Motion tắt vệt chém và hiệu ứng sát thương.

Xem [kiểm kê dữ liệu, kiến trúc, giới hạn và checklist Android/iPhone riêng từng trò](docs/MINIGAMES_WAVE2.md). Typecheck, lint, **107 test mobile**, **71 test engine**, kiểm tra khóa dịch web/mobile và export Android/iOS đạt. Chạy `npm.cmd run export:check` để tạo bundle cho hai hệ điều hành; không phát hành lên cửa hàng.

**Chưa nghiệm thu thiết bị thật:** chưa đo FPS, nhiệt/pin, chưa xác nhận vuốt/Back/cuộc gọi trên Android và iPhone. Cần chạy checklist và ẩn trò gặp lỗi hoặc không đạt hiệu năng trước khi phát hành. Bản triển khai hiện có đủ năm trò để kiểm thử.

## Minigame đợt 1 trên Expo

Vào **Luyện tập → Trò chơi**: Kanji rơi, Shiritori chọn từ, Mật mã Kana, Chuỗi nhớ Kana. Dùng trực tiếp engine TypeScript `../shared-games` qua alias `@games/*`, không sao chép luật chơi. Tải dữ liệu API đầy đủ trước ván, cache từ điển 10 phút; không gọi mạng khi trả lời và không cộng điểm vào ví. Điểm cao/thống kê lưu AsyncStorage phiên bản 1 theo tài khoản/cấp/độ khó/biến thể.

Dữ liệu hiện tại: Kanji rơi hỗ trợ N5 và N3; ba trò dùng từ hỗ trợ N3. Các cấp thiếu dữ liệu bị khóa kèm số mục; kiểm tra lại pool API trước khi bắt đầu. Bàn phím Kana nằm trong ứng dụng, có tạm dừng khi xuống nền/cuộc gọi làm ứng dụng inactive, xác nhận thoát và hỗ trợ Reduce Motion. Không thêm thư viện.

Xem [kiến trúc, số liệu dữ liệu, giới hạn và checklist riêng cho Android/iPhone](docs/MINIGAMES.md). Kiểm tra bằng `npm.cmd run check`, `npm.cmd run export:check`; từ `frontend/` chạy `npm.cmd run test:minigames` và `npm.cmd run i18n:check`. Export tạo bundle Android/iOS; không phát hành cửa hàng.

Kiểm tra tự động: typecheck, lint, **102 test mobile**, **66 test engine**, khóa dịch web/mobile và export Android/iOS đạt. Không sửa web/backend hoặc thêm dependency trong phần triển khai mobile này.

**Chưa kiểm chứng trên thiết bị thật**: cuộc gọi, Back/cử chỉ, màn hình nhỏ, FPS, nhiệt và pin; các checklist trong tài liệu vẫn để trống. Không coi export thành công là nghiệm thu hiệu năng thiết bị.

## Cửa hàng giao diện — mua và áp dụng

Cửa hàng hiện giữ toàn bộ danh mục giao diện/hình nền từ server, có preview sáng/tối, xác nhận giá/số dư trước-sau, mua bằng điểm và áp dụng ngay. Mục đã sở hữu gọi equip; theme/nền đồng bộ theo tài khoản trên server, mode sáng/tối/hệ thống vẫn lưu trên thiết bị. Không sửa web/backend hoặc thêm native library.

Bảng màu dùng trực tiếp nguồn theme web; 13 nền WebP đóng gói thêm tổng 1.227.524 byte. Chạy `npm.cmd run themes:sync` khi dữ liệu theme/ảnh web thay đổi. Hai linh vật theme riêng đang thiếu tệp nguồn được báo rõ, không chặn palette/nền. Xem [chẩn đoán, API, danh sách file và checklist Android/iPhone](docs/THEME_SHOP.md).

Nếu mất phản hồi mua, app chỉ đọc lại trạng thái và không tự POST lần nữa. Chưa kiểm thử mua bằng điểm tài khoản thật hoặc thao tác trên điện thoại; cần chạy checklist trước khi xác nhận hoàn tất nghiệm thu thiết bị.

Kiểm tra bản sửa cửa hàng: **typecheck, lint, 80 test mobile, khóa dịch web/mobile và export Android/iOS đạt**. Có thêm **5 test rewards backend đạt trên SQLite trong bộ nhớ**; không tiêu điểm tài khoản thật. Không thêm dependency.

## Sửa bàn phím che ô nhập

Chat và các màn nhập liệu hiện dùng chung `KeyboardLayout`/`KeyboardInput` cùng các wrapper ScrollView/FlatList, thay các offset cố định 80/90. Lớp này đo phần nội dung bị bàn phím che, tránh cộng chiều cao hai lần khi Android đã resize, xử lý safe area và cuộn tới ô đang nhập. Chat có khung gõ tự giãn có giới hạn, nút gửi cùng hàng và cuộn tới tin cuối khi mở bàn phím. Không thêm thư viện, không sửa API/web.

Xem [chẩn đoán Android/iPhone, cách dùng chung và checklist từng màn hình](docs/KEYBOARD.md). Đã cho phép dọc/ngang trong cấu hình; APK/iOS build cũ khóa dọc phải build/cài lại để nhận thay đổi native này. Các hành vi bàn phím/IME, cử chỉ, tai thỏ và ba nút Android vẫn cần kiểm chứng trên thiết bị thật.

Kiểm tra bản sửa: **typecheck, lint, 63 test, khóa dịch web/mobile và export Android/iOS đạt**. Có 7 test mới cho hình học tránh bàn phím, safe area, xoay và giới hạn khung nhập. Chưa xác nhận bản sửa trên điện thoại thật; người dùng chưa thử lại được tại thời điểm báo cáo.

### Khi Expo Go lỗi hook ngay lúc mở sau khi cài dependency

Nếu gặp lỗi tại `resolveDispatcher().useState` kèm lỗi LogBox, đóng hẳn Expo Go, dừng Metro cũ rồi chạy trong `mobile/`:

```powershell
npm.cmd run start:clean -- --lan
```

Mở lại Expo Go bằng URL/QR của Metro vừa khởi động. Lệnh này chỉ dựng lại cache bundle, không xóa AsyncStorage hoặc các bộ đã lưu. Không chạy hai Metro cùng lúc cho cùng dự án. Nếu vẫn lỗi, cần đối chiếu phiên bản Expo Go/SDK và lỗi đầu tiên trong terminal; dòng LogBox có thể là lỗi tiếp theo khi hiển thị lỗi gốc. Cache sạch là bước khắc phục môi trường, chưa chứng minh mọi lỗi hook đều do cache. Các bản React/React Native phải tiếp tục khớp SDK trong `expo/bundledNativeModules.json`.

## Giai đoạn 4 — Quiz và Flashcard

Vào **Luyện tập → Quiz và Flashcard** để tạo/sửa bộ, nhập tệp có xem trước/xác nhận, làm Quiz hoặc học Flashcard. Các bộ và thống kê Flashcard được lưu riêng theo tài khoản **trên thiết bị này**, không đồng bộ với web/server/thiết bị khác. Quiz chấm tại máy, không cộng điểm tài khoản. Không gọi các API tạo bộ, danh sách chung hoặc nộp bài của game; chỉ hai API nhập tệp được sử dụng. Quiz JSON có thể đọc ngay tại thiết bị.

Đã cài DocumentPicker, FileSystem và Haptics bằng Expo theo SDK hiện tại; AsyncStorage có sẵn. Không thêm native module tùy chỉnh. Giai đoạn 4 dùng được trong Expo Go tương thích SDK. Nếu dùng APK development cũ, cần build/cài lại để có các module mới.

Xem [báo cáo, danh sách file và checklist Android/iPhone](docs/PHASE4.md), [các tệp mẫu Excel/JSON/CSV](docs/samples/study/). Lệnh kiểm tra: `npm.cmd run check`, `npm.cmd run export:check`; khóa dịch web: chạy `npm.cmd run i18n:check` trong `frontend/`. Không coi export bundle là đã thử trên điện thoại hoặc đã phát hành lên cửa hàng.

Kiểm tra Giai đoạn 4: **typecheck, lint, 56 test, khóa dịch web/mobile và export Android/iOS đều đạt**. Cả **8 kiểm tra HTTP nhập tệp** với backend thật và **8 kiểm tra parser trực tiếp** đều đạt; chạy lại HTTP bằng `npm.cmd run smoke:phase4`. Chưa kiểm thử thao tác trực tiếp trên Android/iPhone, tệp đám mây, rung, cử chỉ quay lại hoặc mất mạng thực; xem checklist trong báo cáo.

Giới hạn: 100 bộ và 1,5 MiB JSON mỗi tài khoản, 500 mục mỗi bộ, 10.000 ký tự mỗi ô; tệp tối đa 5 MiB, JSON 1 MiB. Dữ liệu hỏng được báo và giữ nguyên cho tới khi người dùng chủ động đặt lại. Lượt Quiz/Flashcard đang học không được khôi phục sau khi đóng ứng dụng. Cổng khôi phục phiên đăng nhập của các giai đoạn trước vẫn giữ nguyên khi mở app lúc backend mất kết nối.

Ứng dụng React Native riêng trong `mobile/`, hiện làm việc trên nhánh `mobile`, phát triển từ `version1.3`. Giai đoạn 2 chỉ sửa `mobile/`, không thay đổi web hoặc API FastAPI. Các namespace dịch của web được nhập trực tiếp; nhãn riêng cho di động thêm vào cả `src/i18n/locales/vi.json` và `en.json` trong cùng hệ thống i18next.

## Giai đoạn 3 rút gọn — bản 0.3.0 (10/11/2026)

Đã đọc README và kiểm tra nền tảng trước khi sửa: Giai đoạn 0–2 có đầy đủ route/màn hình/API; 37 test, typecheck, lint và khóa dịch đạt. Ban đầu backend tắt nên không tự khởi động; sau khi người dùng bật, OpenAPI live có đủ tuyến và các luồng API Hằng ngày/Thư viện/Ngữ pháp ngân hàng được kiểm tra lại. Chat kiểm tra đạt sau khi người dùng bật Ollama.

### Kết luận lỗi AI 404

Mobile và web cùng gọi `/grammar-practice/sessions` trên base `/api`. Backend đăng ký router cả có/không có `/api`; OpenAPI live xác nhận đầy đủ `/sessions` và `/generate`. **Không có lỗi ghép tiền tố ở mobile.** Trước khi bật Ollama, generate báo provider không chạy. Sau khi bật, `gemma:2b` vẫn sinh mục thiếu `correct_answer` và `explanation_vi`, bị validation loại; API tạo phiên AI trả 404 vì không có câu hợp lệ. Không sửa backend/API, không tự đổi model hoặc restart dịch vụ.

Mobile đã sửa nguồn AI/mixed lỗi thành thông báo vi/en, tự chọn lại ngân hàng cho lần Bắt đầu tiếp theo; không tự POST lại, không xóa phiên/kết quả cũ. Mixed có phiên ít câu hợp lệ vẫn giữ phiên và cảnh báo. Hủy chủ động/401/403 theo luồng riêng. Xem [báo cáo chẩn đoán chi tiết](docs/GRAMMAR_AI_404.md) và chạy `npm.cmd run audit:backend` để kiểm tra tiến trình hiện tại.

### Chức năng Giai đoạn 3

- **Kanji:** danh sách N5/N4/N3 theo dữ liệu thực, tìm sau 300 ms, phân trang và refresh, chữ lớn/nghĩa Việt/số nét; chi tiết On/Kun/ví dụ. Nét KanjiVG từ API được dựng bằng các đoạn vector React Native/Animated, có replay và 0.5×/1×/2×. Không thêm SVG/WebView/Skia/native module, không có vẽ tay. Thiếu nét hoặc lệnh không hỗ trợ thì báo rõ.
- **Quiz:** ba dạng nghĩa/âm đọc/chữ, cấp và 5/10/20 câu, feedback và kết quả. API cấp sẵn đáp án, chưa có chấm/nộp bài server: ghi rõ tự luyện tại máy, không cộng điểm tài khoản.
- **Hồ sơ:** sửa username theo quy tắc web, cấp hiện tại, mục tiêu JLPT và mục tiêu học; điểm/chuỗi và lịch 30 ngày. Mục tiêu JLPT lưu dưới dạng `JLPT N3` trong `learning_goals`, không thêm API field và không đổi cấp hiện tại khi chỉ đặt mục tiêu.
- **Cài đặt:** ngôn ngữ đồng bộ hồ sơ, sáng/tối/hệ thống, phiên bản, ghi công KanjiVG/KANJIDIC/Jonathan Waller/kanji-data. Xuất JSON chọn/copy hoặc Share hệ điều hành. Reset/delete có cảnh báo và bắt gõ từ xác nhận, khóa thao tác trong khi gửi, không retry mutation tự động.
- **Cửa hàng:** xem danh mục/giá/số dư/quyền sở hữu, chọn theme đã sở hữu bằng API equip; Classic/Than Khe/Sakura dùng trực tiếp palette web. Không mua, không nền ảnh.
- **Hoàn thiện:** skeleton cho các danh sách chính, health check toàn cục 15 giây khi app hoạt động, tự kiểm tra và refetch query khi mạng phục hồi; giữ cơ chế hết hạn JWT/biên lỗi. Icon PNG 1024 + SVG nguồn, tên SenpaiAI, version 0.3.0, Android versionCode/iOS buildNumber 3, metadata quyền mạng vi/en. Màn hình chờ React có thương hiệu.

### Tài liệu dùng viết báo cáo

- [Kiến trúc và luồng dữ liệu](docs/ARCHITECTURE.md)
- [Danh sách màn hình và tính năng](docs/SCREENS.md)
- [Đóng gói, mạng và checklist Android/iPhone](docs/DEMO_CHECKLIST.md)
- [Nguyên nhân 404 Ngữ pháp AI](docs/GRAMMAR_AI_404.md)

### Kiểm tra và các giới hạn còn lại

Kết quả cuối Giai đoạn 3: **typecheck, lint, 44 test, khóa dịch web/mobile và kiểm tra nhãn JSX đều đạt**. Export Hermes Android/iOS đạt, asset icon được đưa vào bundle; Expo config hợp lệ với version 0.3.0, Android versionCode 3 và iOS buildNumber 3. Script hợp đồng SQLite biệt lập đạt; smoke API thật Giai đoạn 1, Giai đoạn 2 (ngân hàng/Chat sau khi bật Ollama) và Giai đoạn 3 đạt, tài khoản/tài liệu thử được dọn. AI generation thật vẫn trả 0 câu hợp lệ/404, đã chẩn đoán như trên và không được tính là test AI đạt. Đối chiếu SHA-256 cho mã web/backend trước/sau có **0 tệp nguồn thay đổi**. Không coi export bundle hay API test là đã thử trên điện thoại thật.

- AI hiện chưa đáng tin cậy vì đầu ra model không đạt schema; cần phía backend xử lý structured output/validation và chẩn đoán provider. Client đã fallback nhưng không tuyên bố sửa được chất lượng sinh câu.
- API Kanji chỉ nhận N5/N4/N3/all; không hiển thị N2/N1 trống. Nghĩa/ví dụ Việt được giữ nguyên khi UI en, có lời nhắc; không tự dịch dữ liệu học.
- Quiz không lưu tiến độ hoặc thưởng vào server vì không có endpoint tương ứng. Trò ghép cặp là mục tùy thời gian, chưa làm và không hiện menu Trò chơi.
- Export chưa ghi `.json` trực tiếp vào Downloads vì không thêm module ghi tệp/chia sẻ; dùng Share văn bản JSON và copy từng phần. Nếu Share vượt giới hạn hệ điều hành, vẫn có thể copy các phần.
- Reset chỉ xóa chat/voice/phiên ngữ pháp theo API, giữ folders, điểm, daily tasks và study stats. Xóa tài khoản không thể bảo đảm xóa tài liệu Thư viện thiếu owner metadata. Các giới hạn quyền Thư viện và resume Ngữ pháp đã ghi ở phần Giai đoạn 1–2 vẫn còn.
- SDK 58 cần Expo Go tương thích. Bản Go SDK 54 trên App Store không chạy được dự án này; iPhone qua Go cần chuẩn bị bản SDK 58 phù hợp/TestFlight theo Expo. Không tự hạ SDK. Chưa kiểm thử trực tiếp Giai đoạn 3 trên Android/iPhone.
- Không thêm `expo-splash-screen` theo yêu cầu không thêm native library. Trước khi JavaScript chạy, giữ splash mặc định Expo/OS; sau đó có màn hình chờ React có logo. Icon/metadata native mới chỉ có sau khi build/cài APK mới; APK development ngày 07/11 là bản cũ, không phải APK Giai đoạn 3 đã build.
- Không phát hành lên cửa hàng, không chạy EAS build mới trong giai đoạn này; đã chuẩn bị profile APK preview và hướng dẫn. Không thêm ghi âm, vẽ tay, luyện nghe, push, mua giao diện hoặc offline hoàn chỉnh.

### Tệp tạo/sửa chính trong Giai đoạn 3

| Nhóm | Tệp trong `mobile/` |
| --- | --- |
| API/logic | `src/api/phase3.ts`, `phase3Types.ts`; `src/features/kanji/logic.ts`, `vector.ts`; `src/features/phase2/grammarFallback.ts` |
| Màn hình | `KanjiScreen.tsx`, `KanjiDetailScreen.tsx`, `KanjiQuizScreen.tsx`, `ThemeShopScreen.tsx`, `ExportScreen.tsx`; sửa `GrammarScreen`, `PracticeScreen`, `ProfileScreen`, `SettingsScreen`, `DailyScreen`, `LibraryScreen`, `ChatListScreen` |
| Thành phần/theme | `StrokeAnimation`, `SkeletonList`, `ConnectivityMonitor`, `AccountThemeBridge`, `DangerDialog`, `ui.tsx`, `ThemeProvider.tsx`, `types/assets.d.ts`, `api/types.ts`, `getErrorMessage.ts` |
| Route | `app/kanji.tsx`, `kanji/[character].tsx`, `kanji-quiz.tsx`, `theme-shop.tsx`, `export-data.tsx`, `app/_layout.tsx` |
| Dịch/metadata | Hai locale mobile vi/en, `app.config.ts`, `eas.json`, `package.json`/lock, `assets/icon.svg`, `icon.png` |
| Kiểm tra/tài liệu | `tests/phase3.test.ts`; scripts `audit-backend.mjs`, `diagnose-grammar-live.mjs`, `smoke-phase3.mjs`, `verify-phase3-backend.py`, `lint-ui-text.mjs`, `render-icon.ps1`; README và `docs/` |

Không sửa mã hoặc file dịch web, API/backend, seed dữ liệu hay mô hình nhận dạng. Dữ liệu ML chưa commit do người dùng tạo không thuộc thay đổi này.

## Giai đoạn 2 — Ngữ pháp và Trò chuyện

### Cài APK phát triển lên Android và reload khi sửa mã

Dùng profile `development` để cài SenpaiAI thành ứng dụng riêng trên điện thoại. Bản này có `expo-dev-client` và nhận mã từ Metro trên laptop. Sau lần cài đầu tiên, thay đổi TypeScript/JavaScript, giao diện, bản dịch và token màu sẽ cập nhật qua Fast Refresh; mở menu phát triển và chọn Reload nếu cần tải lại toàn bộ. Native module mới, SDK/plugin/quyền Android hoặc cấu hình native thay đổi thì cần build và cài APK mới. Development build vẫn cần laptop/Metro khi phát triển; backend phải tiếp tục chạy để đăng nhập và dùng các chức năng API.

APK Android development đã build thành công ngày 07/11/2026: [Tải SenpaiAI APK](https://expo.dev/artifacts/eas/wsz8U2GDJ6vCQ0r94GTwhZUSgybWiz37o5FWPCOtHHw.apk). [Trang build trên Expo](https://expo.dev/accounts/nguyennam34/projects/senpai-ai-mobile/builds/dc66eb4a-2621-42cc-a114-92c7bd18ae2b) có thông tin và đường dẫn cài đặt nếu link tải thay đổi. Việc build đã đạt; cài và kiểm tra trực tiếp trên điện thoại vẫn cần người dùng thực hiện.

Build APK từ `mobile/` bằng tài khoản Expo đã liên kết:

```powershell
cd E:\AI\DACN\mobile
npm.cmd run build:android:dev
```

Mở đường dẫn APK do EAS trả về trên Android, cho phép trình duyệt cài ứng dụng từ nguồn đó khi hệ điều hành hỏi, rồi cài SenpaiAI. Build profile xuất `.apk`, không phải gói phát hành lên Play Store. Mã nguồn gửi EAS được giới hạn bằng `.easignore` ở gốc repository: chỉ `mobile/` và các tệp dịch/theme web cần nhập trực tiếp; không gửi backend, cơ sở dữ liệu hoặc `.env`.

Mỗi lần làm việc sau đó:

```powershell
cd E:\AI\DACN\mobile
# mobile/.env trên máy phát triển: EXPO_PUBLIC_API_URL=http://192.168.1.3:8000/api
$env:REACT_NATIVE_PACKAGER_HOSTNAME = '192.168.1.3'
npm.cmd run start:dev -- --lan
```

Điện thoại và laptop cùng Wi-Fi. Mở SenpaiAI, quét QR của **development client** hoặc chọn server đang chạy trên laptop. Đây là QR cho ứng dụng SenpaiAI đã cài. Sau khi sửa mã, lưu tệp để Fast Refresh cập nhật. Đổi `.env` thì dừng Metro, chạy lại với `--clear` và reload ứng dụng. Nếu Wi-Fi/IP thay đổi, cập nhật URL API và IP Metro; không cần cài lại APK cho việc đổi IP. Chỉ dùng `EXPO_PUBLIC_` cho địa chỉ công khai, không đặt SECRET_KEY/OPENAI_API_KEY trong mobile.

Màn hình đăng nhập/đăng ký dùng bố cục của `frontend/src/pages/Login.tsx`: thẻ giữa màn hình, nền/nút gradient Classic lấy trực tiếp từ token web, tagline, bộ chọn VI/EN gọn, tab dạng viên thuốc và nút mắt độc lập cho mật khẩu/xác nhận. Kích thước co theo điện thoại, có safe-area và cuộn khi mở bàn phím. Web không bị chỉnh sửa. Tên thương hiệu dùng màu primary native; hiệu ứng chữ gradient/blur và font trình duyệt của web không được sao chép nguyên dạng sang native.

Kiểm tra sau cập nhật xác thực: typecheck/lint, 37 test và khóa dịch đều đạt. Cần xác nhận trực tiếp trên điện thoại việc cài APK, bàn phím, đăng nhập/đăng ký, nút mắt và Fast Refresh; chưa coi việc build thành công là đã cài trên máy người dùng.

Kiểm tra trước khi triển khai: Giai đoạn 0/1 có đủ đăng nhập, JWT/SecureStore, vi/en, classic sáng/tối/hệ thống, các tab, Hằng ngày và Thư viện. `npm run check` ban đầu đạt 26 test, typecheck, lint và kiểm tra khóa dịch; smoke Giai đoạn 1 chạy được với backend thật và dọn tài khoản thử. Đây là kiểm tra mã và API, không thay thế việc thử trên điện thoại.

Backend có đầy đủ `/grammar-practice/patterns`, `/sessions`, `/sessions/{id}/answer`, `/sessions/{id}/finish`, `/stats`, `/generate`. Ngân hàng kiểm tra ngày 05/11/2026: N5 **39**, N4 **39**, N3 **20** câu; N2/N1 chưa có. Không tự nạp thêm dữ liệu. Backend có cuộc hội thoại, tin nhắn phân trang và thư mục, nên triển khai **nhánh Chat đầy đủ**, không dùng lịch sử chung một luồng.

### Phần đã triển khai

- Tab Luyện tập chỉ có Ngữ pháp. Trang Ngữ pháp gồm Phân tích/Luyện tập; phân tích dùng cùng `/analysis/grammar` và `response_language` như web, hiển thị cấp độ, độ khó, nghĩa câu, từ vựng, mẫu câu và gợi ý. Nội dung có thể nhấn giữ để chọn/sao chép bằng menu hệ điều hành.
- Thiết lập cấp độ theo hồ sơ, tự chọn cấp gần nhất có câu trong ngân hàng và hiện thông báo; các cấp trống bị vô hiệu hóa. Chọn mẫu có tìm kiếm, nhiều dạng câu, 5/10/20 câu và nguồn bank/AI/mixed. Tạo phiên chờ tối đa 120 giây, có nút hủy request.
- Bộ câu hỏi duy nhất `src/components/questions/QuestionCard.tsx` được dùng bởi cả Hằng ngày và Ngữ pháp. Giữ nguyên dạng lựa chọn, thẻ từ có chỉ số riêng, đúng/sai, ô nhập Nhật và flashcard. Thời gian đo bằng đồng hồ đơn điệu. Điểm, đáp án và kết quả đều do server trả về.
- Kết quả có số đúng/tổng, thời gian, kết quả theo mẫu; làm lại các ID câu sai hoặc thiết lập phiên mới. Trang Tiến độ hiển thị độ chính xác theo cấp độ, mẫu yếu và 7 ngày hoạt động từ API thống kê.
- Chat có tìm kiếm tiêu đề/nội dung sau 350 ms, ghim, nhóm theo ngày, thư mục thu gọn, phân trang, kéo làm mới. Nhấn giữ một mục để đổi tên (tối đa 80 ký tự), ghim/bỏ ghim, chuyển thư mục, xóa có xác nhận. Thư mục tạo/đổi tên (tối đa 60 ký tự), xóa giữ hội thoại hoặc xóa cả hội thoại với xác nhận bổ sung.
- Hội thoại dùng FlatList đảo chiều, tải tin cũ và giữ vị trí cuộn; ô nhập nhiều dòng tự tăng chiều cao tới giới hạn; chỉ báo đang trả lời, nội dung chọn/sao chép được, thẻ ngữ pháp/bản dịch/cấp độ và nguồn. Nguồn có `document_id` mở chi tiết Thư viện. Các nguồn quy tắc nội bộ bị lọc giống web. Không tự dịch câu trả lời AI.
- Mở cuộc trò chuyện mới chưa ghi vào cơ sở dữ liệu. Khi bấm Gửi lần đầu mới tạo hội thoại và gửi kèm ID. Lớp API Chat nằm riêng trong `src/api/phase2.ts`. Không thêm thư viện native; yêu cầu Expo Go tương thích SDK đang ghim vẫn áp dụng.

### Giới hạn API và xử lý mất phản hồi

1. **Ngữ pháp chưa có GET phiên/các đáp án đã lưu.** Không thể phục hồi chính xác feedback sau timeout hay mở lại phiên sau khi thoát. App hỏi trước khi thoát, khóa gửi lại khi không xác định server đã lưu hay chưa; người học có thể kết thúc để xem kết quả server đã ghi nhận. Các lỗi từ chối xác định trước khi ghi (ví dụ 422) cho phép sửa đáp án. Không tự POST lại sau timeout. Để phục hồi đầy đủ cần API đọc phiên/feedback và khóa chống trùng phía server; giai đoạn này không sửa backend.
2. **Chat chưa có idempotency key/trạng thái request.** Sau lỗi gửi, app đọc lại tin server, đối chiếu ID mới và câu đã gửi. Nếu tìm thấy thì phục hồi; nếu request timeout vẫn chưa thấy tin, giữ khóa gửi để tránh lặp trong lúc server còn xử lý. Nút Thử lại chỉ đọc lại dữ liệu trong trường hợp này. Nếu mất phản hồi ngay lúc tạo hội thoại, hãy quay về danh sách và làm mới trước khi tạo tiếp. Đảm bảo tuyệt đối một lần cần hỗ trợ backend.
3. **Danh sách hội thoại lọc `mode=text` cố định.** Có hỗ trợ huy hiệu và chế độ chỉ đọc khi mở được ID hội thoại voice, nhưng API hiện không liệt kê voice trong danh sách Chat; không giả dữ liệu hay gộp bằng API không tồn tại. Muốn xem tất cả voice cần backend mở rộng bộ lọc danh sách. Ghi âm/voice chat ngoài phạm vi.
4. Giải thích luyện ngữ pháp hiện chỉ có `explanation_vi`, ví dụ chủ yếu `ja/vi`; giao diện en không tự dịch dữ liệu này. Tên/ý nghĩa mẫu cũng giữ nguyên dữ liệu server. Phân tích và Chat gửi lựa chọn ngôn ngữ theo API hỗ trợ.
5. Hủy/timeout chỉ ngừng chờ ở máy khách, không bảo đảm hủy công việc AI phía server; câu AI hoặc phiên trống có thể đã được tạo. Chế độ mixed hiện chỉ sinh AI khi ngân hàng không đủ; AI có hạn mức do backend quyết định. API có thể trả ít hơn số câu yêu cầu: app hiển thị số thực tế, không bù hoặc chấm ở máy.
6. Nguồn Chat thường chỉ có tiêu đề/URL, không có `document_id`; app chỉ mở chi tiết Thư viện khi server cung cấp mã đó. Chưa thay đổi schema nguồn.

### Kiểm tra Giai đoạn 2

```powershell
cd E:\AI\DACN\mobile
npm.cmd run check
npm.cmd run export:check
# Chạy từ PC dùng localhost, không dùng địa chỉ đặc biệt 10.0.2.2 của emulator:
$env:EXPO_PUBLIC_API_URL = 'http://127.0.0.1:8000/api'
npm.cmd run smoke:phase2 -- --create-test-account
# Thêm --ai để gọi phân tích và sinh AI bằng nhà cung cấp backend đang cấu hình:
npm.cmd run smoke:phase2 -- --create-test-account --ai
Remove-Item Env:EXPO_PUBLIC_API_URL
```

Smoke dùng tài khoản riêng có tên ngẫu nhiên, kiểm tra bốn dạng câu, chống đáp án trùng, kết thúc lặp, làm lại ID sai, thống kê; Chat gửi lời chào, phân trang, tìm nội dung, đổi tên, ghim, chuyển và hai cách xóa thư mục. Cuối cùng xóa tài khoản thử cùng dữ liệu liên quan. Không in JWT, mật khẩu hoặc cấu hình bí mật. `--ai` có thể dùng hạn mức của nhà cung cấp đã cấu hình; lỗi dịch vụ AI được báo riêng, không coi là test đạt.

Kết quả chạy thực tế ngày 05/11/2026: smoke ngân hàng và Chat đạt; phân tích câu `/analysis/grammar` trả 200. Tạo phiên `mode=ai` trả **404**, không có câu hợp lệ được chọn, nên phần sinh AI chưa đạt kiểm thử đầu cuối với cấu hình backend hiện tại. App hỗ trợ gọi, chờ/hủy và hiển thị lỗi đã dịch; cần kiểm tra dịch vụ sinh câu/đầu ra AI phía backend trước khi nghiệm thu chế độ này. Không sửa API để che lỗi.

Các kiểm tra tự động: typecheck/lint đạt, **35 test đạt**, kiểm tra khóa dịch mobile và web đạt; export Hermes Android/iOS đạt. Chưa chạy trên thiết bị thật. Danh sách tệp Giai đoạn 2:

| Nhóm | Tệp tạo/sửa trong `mobile/` |
| --- | --- |
| Điều hướng | `app/_layout.tsx`, `app/(tabs)/practice.tsx`, `app/(tabs)/chat.tsx`, `app/grammar.tsx`, `app/grammar-progress.tsx`, `app/chat-folders.tsx`, `app/conversation/[id].tsx` |
| API và logic | `src/api/phase2.ts`, `src/api/phase2Types.ts`, `src/features/phase2/logic.ts`, `src/features/phase2/grammarSubmission.ts`, `src/utils/getErrorMessage.ts` |
| Thành phần | Chuyển `src/components/daily/DailyQuestion.tsx` thành `src/components/questions/QuestionCard.tsx`; thêm `src/components/NameDialog.tsx` |
| Màn hình | `src/screens/DailyExerciseScreen.tsx`, `PracticeScreen.tsx`, `GrammarScreen.tsx`, `GrammarProgressScreen.tsx`, `ChatListScreen.tsx`, `ConversationScreen.tsx`, `ChatFoldersScreen.tsx` |
| Dịch và kiểm tra | `src/i18n/locales/vi.json`, `src/i18n/locales/en.json`, `tests/phase2.test.ts`, `scripts/smoke-phase2.mjs`, `package.json`, `README.md` |

### Danh sách kiểm tra trên cả Android và iPhone

Chạy toàn bộ danh sách sau trên từng thiết bị thật; hiện chưa có xác nhận kiểm thử trực tiếp trên thiết bị:

- [ ] Đăng nhập, mở lại app, đổi vi/en và sáng/tối/hệ thống; quay lại Hằng ngày và Thư viện để kiểm tra hồi quy.
- [ ] Phân tích một câu Nhật, chọn/sao chép nghĩa, mẫu và ví dụ; đổi ngôn ngữ khi API đang chạy; thử lỗi mạng.
- [ ] Chọn hồ sơ N1/N2, kiểm tra thông báo chuyển N3; tìm mẫu, chọn/bỏ dạng, chọn 5/10/20 và nguồn ngân hàng.
- [ ] Làm đủ bốn dạng: điền chỗ trống, sắp xếp (kể cả từ lặp), đúng/sai, chia từ với bàn phím Nhật. Kiểm tra đáp án, ví dụ, thời gian và kết quả theo mẫu.
- [ ] Bấm đáp án/tiếp liên tiếp, thử mất mạng trước và sau khi gửi; đảm bảo app không gửi lại tự động. Thử kết thúc để xem kết quả phần đã lưu.
- [ ] Android Back/iOS vuốt quay lại giữa bài phải hỏi; thử làm lại câu sai và mở trang Tiến độ, kéo làm mới.
- [ ] AI/mixed: kiểm tra tạo chậm, hủy, hết thời gian, hạn mức và trường hợp server trả ít câu; không có vòng chờ vô hạn.
- [ ] Mở Chat mới rồi thoát trước khi gửi: danh sách không có hội thoại mới; gửi tin đầu tiên và tin tiếp theo vào cùng hội thoại.
- [ ] Gửi tin nhiều dòng, mở bàn phím Nhật, xoay màn hình, chạm ô nhập cuối trang; nội dung và nút Gửi không bị bàn phím/thanh hệ thống che.
- [ ] Đủ trên 30 tin: cuộn lên tải cũ không nhảy vị trí; gửi tin mới tự xuống cuối; chọn/sao chép câu trả lời, kiểm tra nguồn có/không có ID Thư viện và nguồn nội bộ bị ẩn.
- [ ] Tìm tiêu đề/nội dung, tải thêm danh sách, ghim/bỏ ghim; tạo/đổi tên thư mục, chuyển hội thoại, đóng/mở thư mục.
- [ ] Xóa hội thoại, xóa thư mục giữ hội thoại và xóa cả hội thoại; Hủy xác nhận phải giữ nguyên dữ liệu.
- [ ] Ngắt mạng khi gửi, bật lại và Thử lại đọc server; không tạo câu trùng. Thử token hết hạn quay về Đăng nhập.
- [ ] Nếu có ID voice hợp lệ, mở chỉ xem, huy hiệu/thông báo voice và không có ô nhập. Việc không xuất hiện voice trong danh sách là giới hạn API đã nêu.

### Android/iOS và phần web khó chuyển

Chưa trực tiếp quan sát khác biệt trên thiết bị, nên các mục dưới là khác biệt đã xử lý trong mã và cần xác nhận bằng danh sách trên: iOS dùng KeyboardAvoidingView `padding`, Android dùng `adjustResize` sẵn có; iOS vuốt quay lại và Android nút Back đi qua bảo vệ điều hướng; khoảng đệm dưới lấy safe-area cho thanh Home iPhone và điều hướng Android; menu chọn/copy văn bản do hệ điều hành cung cấp. Danh sách đảo chiều cần thử vị trí cuộn trên cả hai hệ điều hành. Máy Windows chạy Metro/backend được cho iPhone thật; iOS Simulator cục bộ cần macOS/Xcode. Xem lưu ý phiên bản Expo Go bên dưới trước khi thử SDK hiện tại.

Web dùng HTML/Tailwind, sidebar thư mục, `<details>`, thao tác clipboard trình duyệt và danh sách DOM nên phải viết lại bằng thành phần native. Thành phần câu hỏi đã dùng chung trong mobile; không nhập UI web. Chat Markdown hiện hiển thị văn bản chọn được, không đưa HTML vào ứng dụng; có thể thấy dấu Markdown trong nội dung AI. Không có ghi âm, vẽ kanji, luyện nghe, thông báo hoặc cửa hàng giao diện trong Giai đoạn 2.

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
# Nhận dạng kanji và luyện viết

Trong Kanji, chọn **Nhận dạng chữ** để vẽ bằng ngón tay; trong chi tiết chữ chọn **Luyện viết** để viết theo mẫu, kiểm tra và chuyển chữ tiếp theo. Chạy bằng Expo Go hỗ trợ SDK của dự án; SVG đã được cài qua Expo. Nhận dạng gửi ảnh/nét lên server, và server hiện lưu các mẫu này. Phạm vi nhận dạng đọc từ API: kiểm tra hiện tại có 245 chữ N5/N4, không bao gồm mọi chữ trong từ điển.

Hợp đồng dữ liệu, giới hạn mô hình, khác biệt với web và checklist Android/iPhone: [KANJI_WRITING.md](docs/KANJI_WRITING.md). Chưa đo độ chính xác viết tay hoặc hiệu năng bằng điện thoại thật; xuất bundle không thay thế kiểm tra thiết bị.

