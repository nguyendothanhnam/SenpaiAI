# Kiểm tra trình độ JLPT trên mobile — 27/11/2026

## Phạm vi và nguồn đối chiếu

Nhánh `mobile`. Đã đọc `frontend/src/pages/Placement.tsx`, toàn bộ `frontend/src/components/placement/` (setup, result, legacy question, profile summary, gate), `frontend/src/services/placement.ts`, bản dịch vi/en; `backend/PLACEMENT.md`, router `backend/app/api/placement.py`, cấu hình và dịch vụ phiên/chấm/tóm tắt hồ sơ. Giữ nguyên web và backend, không thay nội dung ngân hàng hay migration.

Luồng mobile: lời mời sau đăng ký có thể bỏ qua; lối vào trong Cá nhân; giới thiệu và tình trạng ngân hàng năm kỹ năng; adaptive hoặc confirmation; làm từng câu, đọc đoạn văn, nghe audio riêng; lịch sử 20 lần gần nhất; kết quả, đồng ý rõ ràng rồi mới xác nhận cập nhật hồ sơ. Hỗ trợ tiếp tục cả phiên legacy: lựa chọn, đúng/sai, điền, sắp xếp token có trùng, chia dạng và chép nghe. Phiên v2 gửi choice ID và revision, không tự chấm hoặc gửi điểm/thời gian làm bài từ thiết bị.

## API dùng lại

Mọi đường dẫn dưới đây có prefix `/api`, JWT qua client hiện có; lỗi 401 của JSON dùng cơ chế hết phiên chung.

| Method/path | Cách dùng |
| --- | --- |
| GET `/placement/status` | Kiểm tra trạng thái, tìm phiên đang làm; endpoint có thể hoàn tất phiên hết hạn |
| GET `/placement/levels?language=vi|en` | Cấp có đủ dữ liệu, kỹ năng thiếu, cờ demo, thời lượng |
| GET `/placement/profile/summary` | Nguồn trình độ, lần gần nhất, trình độ đã xác nhận |
| GET `/placement/attempts` | Lịch sử tối đa 20 bản ghi; danh sách mobile được ảo hóa |
| POST `/placement/attempts` | Luôn gửi mode v2 rõ ràng, chỉ gửi selected_level cho confirmation |
| GET `/placement/attempts/{id}` | Tiếp tục/đối soát sau gián đoạn; máy chủ tự xử lý hết hạn |
| POST `/placement/attempts/{id}/answers` | Gửi câu hiện tại, đáp án, revision; không gửi khóa đáp án hay điểm |
| POST `/placement/attempts/{id}/submit` | Không có body điểm/đáp án; kết quả dùng các đáp án server đã nhận |
| GET `/placement/attempts/{id}/result` | Wrapper và smoke test xác minh endpoint; UI dùng result trong snapshot GET/submit |
| POST `/placement/attempts/{id}/abandon` | Chỉ đóng lần cũ sau xác nhận thay thế; giữ lịch sử |
| POST `/placement/attempts/{id}/confirm` | Sau thao tác đồng ý riêng, chỉ kết quả mới nhất; tải lại `/auth/me`, publish session/profile và invalidate query |
| GET `/placement/attempts/{id}/media/{item_id}` | Download có Bearer vào cache riêng, phát cục bộ và xóa khi rời câu |
| GET `/listening/lessons/{lesson_id}/audio` | Audio có xác thực cho phiên legacy |

Không có image URL trong schema câu hỏi/API hiện tại; vì thế không tự đoán đường dẫn ảnh. Không có endpoint cooldown, `next_allowed_at`, số lượt còn lại hoặc confidence đã hiệu chuẩn. Chính sách hiện có là một phiên đang làm, không có thời gian chờ làm lại; UI nói rõ điều đó và vẫn tuân lỗi server. Tóm tắt độ tin cậy dùng đủ/thiếu bằng chứng, không tạo phần trăm tin cậy. Cờ demo và estimated_level=null không được diễn giải thành N5 đã kiểm chứng dù API còn trường fallback recommended_level=N5.

## Thời gian, phục hồi và an toàn gửi

Đồng hồ neo `server_time`/`expires_at` vào `performance.now()` tại thời điểm nhận phản hồi; không dùng `Date.now()` của thiết bị. GET làm mới neo sau tối đa 30 giây khi màn hình mở và khi trở về foreground. Không có mốc server của v2 thì khóa trả lời. Phiên legacy vốn không có deadline/submit riêng, giữ đúng luật backend cũ. Độ trễ truyền dữ liệu vẫn có thể làm đồng hồ hiển thị chậm hơn máy chủ; server luôn quyết định chấp nhận/hết hạn.

Mỗi thao tác có khóa đồng bộ trước cả lần render kế tiếp; không tự retry mutation. Mất phản hồi sau gửi => khóa trả lời và GET để xác định máy chủ đã nhận hay chưa. Hết giờ tự POST submit, không gửi lựa chọn trễ; nếu mất mạng thì hiện lỗi và cho đối soát/thử lại. GET sau khi hết hạn nhận luôn kết quả do server hoàn tất. Khi app bị tắt/nền, JavaScript không thể đảm bảo chạy POST đúng lúc; backend vẫn áp deadline khi có yêu cầu tiếp theo.

Chỉ lưu gợi ý attempt ID theo tài khoản trong AsyncStorage, không lưu đề/đáp án/token/deadline vào đó. Khởi động app kiểm tra trạng thái server và gợi ý này để mở đúng phiên hoặc kết quả hết hạn; luôn GET có kiểm tra quyền sở hữu. Nếu lưu gợi ý thất bại, API status vẫn tìm được phiên chưa hết hạn; sau khi server đã hoàn tất thì có thể phải mở kết quả từ lịch sử. Đóng/mở không giữ lựa chọn chưa bấm Gửi. Sau logout/401, state riêng và query được cơ chế session hiện có dọn; gợi ý ID của tài khoản trước không được dùng cho tài khoản khác.

Mobile không mở lại câu trước trong cả hai mode theo yêu cầu. Đây là khác biệt có chủ đích so với web: web confirmation cho quay lại/chỉnh đáp án; backend vẫn giữ API đó. Việc hạn chế quay lại hiện nằm ở UI mobile, không phải quy tắc server áp cho mọi client.

Nút Back, thao tác rời route và cử chỉ điều hướng đi qua `usePreventRemove`; Android Back ở route gốc chuyển qua cùng guard. Khi đang gửi, phải đợi phản hồi; khi tạm dừng, cảnh báo lựa chọn chưa gửi mất và deadline vẫn chạy. Cuộc gọi/khóa màn hình không được xem là lệnh bỏ dở. Bộ xử lý bàn phím chung và safe area dùng lại; nút từ thành phần chung có chiều cao tối thiểu 48; màu theo token sáng/tối; mọi nhãn đi qua i18next, namespace placement dùng trực tiếp JSON web.

## Module và khác biệt hệ điều hành

Đã báo tên, lý do và dung lượng trước khi cài. Expo install chọn `expo-audio 58.0.12` (dải khai báo `~58.0.12`), gói npm giải nén **1.345.808 byte (~1,28 MiB)**. Metadata báo trước của bản tương thích 58.0.11 là 1.344.405 byte; bản vá Expo chọn lớn hơn 1.403 byte. Dung lượng gói không dự đoán mức tăng binary. `expo-asset` là module đã tồn tại gián tiếp; npm hoist lên gốc và tăng 58.0.20 → 58.0.21 để thỏa peer của audio. Chỉ cài bằng `npx expo install expo-audio` trong `mobile`.

[Expo Audio SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/audio/) có trong Expo Go trên Android và iOS. Không cần development build cho chức năng này khi Expo Go tương thích SDK; binary development cũ cần build lại để có module. Plugin tắt microphonePermission, recordAudioAndroid, enableBackgroundRecording và enableBackgroundPlayback. Introspection xác nhận không có RECORD_AUDIO, NSMicrophoneUsageDescription hoặc UIBackgroundModes audio; Android có MODIFY_AUDIO_SETTINGS. Audio tải có Bearer vào cache và xóa khi đổi câu/unmount, timeout 20 giây, hủy download khi rời; URL được giới hạn đúng các đường dẫn media cho phép. Download 401 gọi cơ chế hết phiên chung. Clip chỉ phát đoạn start_ms/end_ms, dừng khi app không active; playback chọn doNotMix, không tự phát khi tải xong.

| Android | iPhone |
| --- | --- |
| Hardware/system Back và header Back phải cùng xác nhận | Header Back và vuốt cạnh quay lại phải cùng xác nhận |
| Hệ điều hành có thể hủy process khi chạy nền | iOS/Expo Go có thể treo JS khi khóa màn hình/đổi app |
| Không xin quyền ghi âm; kiểm tra loa/Bluetooth và focus audio | Không xin micro; cấu hình playsInSilentMode để nghe cả khi bật chế độ im lặng |
| Emulator có thể dùng 10.0.2.2; máy thật dùng LAN/HTTPS phù hợp | Chủ yếu Expo Go, cần SDK tương thích và Local Network khi dùng LAN |

## Kiểm tra đã chạy

| Lệnh/kiểm tra | Kết quả thật |
| --- | --- |
| `mobile: npm run typecheck` | Đạt |
| `mobile: npm run lint` | Đạt, không warning |
| `mobile: npm test` | **175/175 đạt**, trong đó 24 test mới về placement |
| `mobile: npm run i18n:check` | Đạt 12 namespace web và vi/en mobile; chữ JSX mobile qua dịch |
| `frontend: npm run i18n:check` | Đạt, không ghi lại file web |
| `frontend: npm run i18n:lint` | **Không đạt** do chữ có sẵn trong ErrorBoundary, grammar, internship, quiz, reminders; web được giữ nguyên |
| `mobile: npm run backend:check` | Đạt `/health` từ máy làm việc; không chứng minh điện thoại kết nối được |
| `node --env-file-if-exists=.env scripts/smoke-placement.mjs --create-test-account` | Đạt, tài khoản tạo riêng đã xóa |
| `expo config --type introspect --json` | Đạt, cấu hình micro/background như trên |
| `mobile: npm run export:check` | Export Android và iOS vào `dist`; không phát hành store/OTA |

Test đơn vị bao phủ đồng hồ không lệ thuộc ngày giờ máy, neo tại receipt, hết giờ, timestamp thiếu/hỏng, resume theo câu server chưa trả lời, legacy, forward-only confirmation, payload không có điểm, rapid tap, mất phản hồi đã commit, foreground/hết hạn, idempotent submit, retry sau offline, ngăn late response của phiên đã unmount, demo, allowlist media, toàn bộ endpoint, lời mời đăng ký và gợi ý cold-start cách ly tài khoản.

Smoke HTTP thật xác minh status/summary/history/levels vi+en, N5 demo, tạo/GET/resume/30 đáp án adaptive, deadline, choices/revisions, đáp án gửi lặp và conflict, audio bytes có JWT và từ chối không JWT, submit/result/confirm lặp, demo giữ trình độ cũ, history, confirmation 30 câu, đáp án và abandon, JWT sai trả 401. Thiếu JWT ở media thực tế trả **403**, smoke chấp nhận cả 401/403 như các cơ chế xác thực khác nhau; lần chạy đầu thất bại vì chỉ chờ 401, đã sửa kỳ vọng và chạy lại đạt. Không chờ 30 phút để kiểm tra expiry thật hoặc dùng dữ liệu thật để xác lập N4–N1. Không thao tác sửa database/seed để giả lập kết quả thật.

Chưa kiểm thử native playback, thao tác UI, cuộc gọi, OS kill hay gesture trên thiết bị thật. Export thành công không thay thế các bước đó. Cảnh báo deprecation react-test-renderer/NO_COLOR từ công cụ có sẵn không làm fail test/export.

## Checklist Android

- [ ] Expo Go tương thích SDK 58, đăng ký tài khoản riêng: lời mời xuất hiện một lần, Bỏ qua vào app, mở lại từ Cá nhân.
- [ ] Sáng/tối, vi/en, font lớn, màn hình nhỏ/ngang: không tràn; nút >=48, nội dung dài và lịch sử cuộn tốt, thanh hệ thống không che nút.
- [ ] Adaptive và confirmation: chỉ N5 mẫu sẵn sàng với ngân hàng hiện tại; N4–N1 không thể chọn; thông báo mẫu rõ ở giới thiệu/bài/kết quả.
- [ ] Chọn rồi Gửi nhiều lần nhanh với mạng chậm: chỉ một câu được ghi nhận, không đáp án đúng bị lộ, không quay lại câu trước.
- [ ] Tắt mạng trước/sau Gửi, bật lại và Tải lại: tiếp tục đúng câu, không tự gửi lựa chọn cũ; JWT hết hạn về đăng nhập.
- [ ] Hardware Back, system gesture Back và header Back: hủy xác nhận vẫn ở câu; đồng ý thoát giữ đáp án đã gửi, deadline không dừng.
- [ ] Đưa app xuống nền, khóa màn hình, nhận cuộc gọi, force-stop/OS kill rồi mở: đồng bộ trước trả lời; phiên quá hạn mở kết quả hết giờ.
- [ ] Đổi ngày/giờ máy trong lúc làm không đổi deadline; chờ hết giờ online và offline, thử lại không tạo hai kết quả.
- [ ] Nghe đúng segment, loa/tai nghe/Bluetooth; đổi câu/rời app dừng phát; lỗi tải có nút thử lại, không yêu cầu micro.
- [ ] Legacy nhập/chia dạng/sắp xếp token: bàn phím không che ô/nút, token trùng giữ vị trí riêng.
- [ ] Nút xác nhận disabled khi chưa đồng ý; đồng ý rồi rút lại disabled trở lại; demo không nâng trình độ. Với ngân hàng reviewed riêng, xác nhận cấp thật cập nhật Hồ sơ và các nơi đọc session.
- [ ] Đăng xuất/đăng nhập tài khoản khác không thấy phiên/lịch sử/audio của tài khoản cũ; xóa tài khoản test khi xong.

## Checklist iPhone — chủ yếu Expo Go

- [ ] Dùng Expo Go tương thích SDK, kết nối LAN/HTTPS và cấp Local Network nếu cần; làm lại các bước chức năng/mạng/demo/đồng ý/hết giờ của Android.
- [ ] Vuốt cạnh quay lại cả khi đã/chưa chọn đáp án: hiện xác nhận, hủy không rời; header Back cùng hành vi.
- [ ] Notch/Dynamic Island/home indicator, portrait/landscape, Dynamic Type, vi/en và sáng/tối không che nội dung/nút.
- [ ] Bàn phím Nhật/Anh/Vietnamese ở phiên legacy: đổi bàn phím, nhập nhiều dòng và đóng/mở không che ô hoặc đếm inset hai lần.
- [ ] Chuông im lặng vẫn nghe được khi nhấn Play; kiểm tra loa, tai nghe/Bluetooth, rút tai nghe, interruption khi cuộc gọi/Control Center.
- [ ] Đổi app/khóa màn hình/nhận cuộc gọi: audio dừng, trở về GET lại; tắt hẳn Expo Go rồi mở lại đúng phiên hoặc kết quả quá hạn.
- [ ] Hết hạn JWT khi tải audio và lúc gửi đáp án về đăng nhập; không mở được đề riêng bằng Back/deep link sau logout.
- [ ] Kiểm tra lịch sử dài và kết quả trên máy thật; ghi model iPhone/iOS/Expo Go cùng kết quả trước nghiệm thu.

## File đã tạo/sửa

Tất cả thay đổi thuộc `mobile/`:

```text
app.config.ts
app/_layout.tsx
app/index.tsx
app/placement.tsx (mới)
package.json
package-lock.json
src/api/placement.ts (mới)
src/auth/session.ts
src/components/placement/PlacementAudio.tsx (mới)
src/components/placement/PlacementInvitation.tsx (mới)
src/components/placement/PlacementProfile.tsx (mới)
src/components/placement/PlacementQuestion.tsx (mới)
src/features/placement/model.ts (mới)
src/features/placement/controller.ts (mới)
src/features/placement/resume.ts (mới)
src/i18n/resources.ts
src/i18n/locales/vi.json
src/i18n/locales/en.json
src/screens/PlacementScreen.tsx (mới)
src/screens/ProfileScreen.tsx
tests/placement.test.ts (mới)
scripts/smoke-placement.mjs (mới)
README.md
docs/PLACEMENT.md (mới)
```

Các thư mục mẫu ML chưa theo dõi trong backend đã có trước phiên làm việc và không được chỉnh sửa. Không commit hoặc triển khai remote tự động.

## Quyết định cần chủ dự án chốt

Không có quyết định chặn dùng thử bản mobile. Các câu hỏi cho giai đoạn tiếp theo:

1. Có muốn áp thời gian chờ/số lần làm lại thật trên mọi client không? Hiện backend không có luật này; nếu cần mới đề xuất bổ sung policy và trường next_allowed_at, không chỉ khóa ở mobile.
2. Ai sẽ cung cấp/duyệt ngân hàng phi-demo đủ năm kỹ năng và các cấp N4–N1? Chưa thể nghiệm thu xác lập trình độ thật với bộ mẫu hiện tại.
3. Có cần chỉ số confidence đã hiệu chuẩn và câu hỏi kèm hình ảnh không? Cần đặc tả/nội dung/API bổ sung nếu có, không tự tạo số liệu/URL.

Yêu cầu lời mời có thể bỏ qua được ưu tiên trên mobile; khác với mandatory gate hiện có của web. Không tự thêm gate chặn toàn app. Bản này đủ để kiểm thử trên Expo Go; phát hành App Store/Google Play hoặc EAS Update cần quy trình đích riêng.
