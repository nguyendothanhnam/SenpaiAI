# Nhắc học mobile — Phần A

Đây là báo cáo tại thời điểm hoàn tất Phần A. **Phần B hiện đã triển khai**; xem [thông báo cục bộ, quyền, lập lịch và checklist thiết bị mới nhất](LOCAL_REMINDERS.md). Các mục “chưa triển khai” và checklist để dành Phần B bên dưới là ghi nhận lịch sử, không mô tả trạng thái hiện tại.

Ngày kiểm tra: 19/11/2026, nhánh `mobile`. Chỉ sửa trong `mobile/`; giữ nguyên thay đổi sẵn có về anchor/back behavior trong bố cục tab.

## Nguồn hành vi đã đọc

- Web: `frontend/src/pages/RemindersSettings.tsx`, `frontend/src/components/notifications/NotificationBell.tsx`, `frontend/src/services/api.ts`, router và các namespace dịch chung.
- Backend, chỉ đọc: `backend/app/api/reminders.py`, `backend/app/api/notifications.py`, `backend/app/services/reminder_service.py`.
- Mobile: auth/session, React Query, ngôn ngữ, theme, vùng an toàn/bàn phím, điều hướng và kiểm thử các giai đoạn trước.

## Phạm vi và API

| Chức năng | API hiện có |
| --- | --- |
| Danh sách | `GET /notifications/?limit=20` (tối đa 100) |
| Số chưa đọc | `GET /notifications/unread-count` |
| Đọc từng cái | `POST /notifications/{id}/read` |
| Đọc tất cả | `POST /notifications/read-all` |
| Xóa | `DELETE /notifications/{id}` |
| Đọc/lưu cài đặt | `GET/PUT /reminders/settings` |
| Gợi ý giờ | `GET /reminders/suggested-time` |

Chuông dùng một truy vấn đếm chung, cập nhật khi đăng nhập/mở app, trở về foreground và mỗi 60 giây ở foreground. AppState inactive/background dừng polling và hủy yêu cầu thông báo đang chạy qua AbortSignal. Không polling danh sách khi màn hình mất focus hoặc app xuống nền. Lỗi đếm hiển thị dấu `!`, có nhãn trợ năng, thay vì khẳng định số 0 là dữ liệu mới. Mở danh sách sẽ gọi lại truy vấn đếm khi cần.

Danh sách phân biệt đã/chưa đọc bằng chữ, nét đậm và viền theme; có làm mới bằng kéo, lỗi/thử lại, trạng thái trống và tải thêm. API **không có offset/cursor**: tải thêm lấy lại cửa sổ 20 → 40 → 60 → 80 → 100 mục mới nhất; không ghép các trang gây lặp ID, không thể xem mục cũ hơn 100 nếu chưa xóa mục mới hơn. Đếm chưa đọc vẫn do server tính trên toàn bộ thông báo. Thao tác đọc/xóa vô hiệu hóa các nút liên quan và có khóa đồng bộ để chặn nhấn trùng; thành công làm mới cả danh sách lẫn số đếm. Chạm thông báo chờ đánh dấu đọc thành công rồi điều hướng; lỗi giữ nguyên màn hình, báo lỗi và cho thử lại.

Tiêu đề/nội dung dùng `common.notificationTypes` của web theo `type` và dữ liệu `streak`, `review_count`, gồm số ít/số nhiều tiếng Anh; loại lạ dùng nội dung chung đã dịch. Không hiển thị thẳng nội dung tiếng Việt cố định từ server. Thời gian tương đối dùng khóa dịch mobile, cập nhật mỗi phút khi màn hình hoạt động; timestamp UTC thiếu offset được hiểu là UTC.

## Bảng ánh xạ đường dẫn

Không chuyển URL do server cung cấp thẳng sang router hoặc trình duyệt hệ thống. Chỉ nhận đường dẫn tương đối trong danh sách dưới; bỏ query/hash cho các màn hình tổng quan, cho phép dấu `/` cuối. URL bên ngoài, protocol-relative, dấu `\\`, ký tự trắng, phần trăm mã hóa và đường dẫn lạ giữ ở danh sách.

| Đường dẫn web | Tuyến mobile | Ghi chú |
| --- | --- | --- |
| `/daily` | `/(tabs)/daily` | Cả ba loại nhắc hiện tại từ server đều dùng đường dẫn này; mở tổng quan nhiệm vụ hôm nay |
| `/` | `/(tabs)/daily` | Trang mặc định mobile |
| `/library` | `/(tabs)/library` | Thư viện |
| `/grammar` | `/grammar` | Ngữ pháp |
| `/kanji` | `/kanji` | Kanji |
| `/settings/reminders` | `/reminder-settings` | Cài đặt nhắc học |
| Mọi đường dẫn khác/null/không an toàn | `/notifications` | Giữ nguyên danh sách, vẫn đánh dấu đọc nếu thành công |

## Cài đặt và khác biệt đã đối chiếu

- Chỉ cho sửa sau khi tải được dữ liệu thật; không dùng giá trị mặc định để ghi đè server khi GET thất bại. Mỗi lần mở lại màn hình sẽ GET và chờ dữ liệu mới nhất trước khi khởi tạo biểu mẫu, để nhận thay đổi từ web. Bản nháp không bị tự động refetch ghi đè; lưu thành công cập nhật cache.
- Công tắc tổng, `HH:MM` chính xác từ 00:00–23:59, các ngày 0–6 không trùng, ba loại `daily_task`, `streak_risk`, `review_due`, giờ yên lặng, số nguyên 1–20 và múi giờ IANA qua Intl; server là nguồn kiểm tra cuối cùng.
- **Lỗi hiện có ở web:** UI thứ Hai gửi `(index + 1) % 7` nhưng bộ lập lịch dùng Python `weekday()` (thứ Hai = 0). Mobile giữ đúng quy ước server để các ngày đã chọn thực sự có hiệu lực. Không sửa web/backend. Nếu từng chọn một phần các ngày trên web, nên xem và chọn lại theo tên ngày trên mobile.
- Cho phép không chọn ngày/loại nhắc như server. Giờ yên lặng qua nửa đêm hợp lệ; hai giờ bằng nhau có nghĩa yên lặng cả ngày, được giải thích trong UI.
- Gợi ý dùng múi giờ của cài đặt **đã lưu** trên server và hiển thị rõ múi giờ đó. Nhấn “Dùng giờ này” chỉ đổi bản nháp; nhấn Lưu mới PUT. Sau khi lưu, gợi ý được tải lại. Có trạng thái đang tải, thiếu hoạt động, lỗi và thử lại độc lập.
- Web có trường `snooze_until` trong API nhưng **không có nút tạm hoãn trong màn cài đặt** đã đọc. Mobile chỉ hiển thị nếu trường này tồn tại, không bổ sung thao tác ngoài web. Payload PUT bỏ `snooze_until` và `push_enabled`, giữ nguyên cài đặt của client khác; không gửi lại toàn bộ dữ liệu cũ.
- Các yêu cầu dùng API client/JWT và dọn cache khi đăng xuất hiện có. Query key theo tài khoản; route nằm trong Stack.Protected.
- Chỉ dùng token theme, các thành phần UI/bàn phím/vùng an toàn sẵn có. Không thêm native library tùy chỉnh.

## Expo Go và ranh giới Phần B

Đã chạy **`npx expo install expo-notifications`**, cài `~58.1.9` theo SDK 58. Dependencies gián tiếp cần thiết được npm cập nhật trong lockfile. Chưa import module này vào runtime, chưa xin quyền hay cấu hình kênh/plugin/native cho thông báo cục bộ.

Theo [Expo Notifications cho SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/) (kiểm tra 19/11/2026), **thông báo cục bộ còn dùng được trong Expo Go trên cả Android và iPhone**. Hạn chế Expo Go Android từ SDK 53 là **remote push**. Vì vậy không có hệ điều hành nào phải dừng vì giới hạn local notifications được tài liệu nêu. Expo Go phải tương thích SDK dự án; nếu không tương thích hoặc cần cấu hình native riêng, dùng development build. Development build cũ phải build/cài lại để có module mới; build iOS cần môi trường macOS/EAS phù hợp. Báo cáo tài liệu không thay thế kiểm thử trên điện thoại thật.

Chỉ Phần A chạy: chuông và dữ liệu từ API trong ứng dụng, cài đặt server. **Chưa có** xin quyền, kênh Android, lịch cuốn chiếu 7 ngày, hủy theo hoàn thành nhiệm vụ/đăng xuất/xóa tài khoản, xử lý chạm thông báo hệ thống hay banner foreground. Không lấy Expo/FCM/APNs token, không Web Push, không bổ sung thông báo đẩy server. Tất cả logic lịch, DST, qua nửa đêm và chống trùng/hủy thuộc Phần B.

## Kết quả kiểm tra tự động

| Kiểm tra | Kết quả |
| --- | --- |
| Trước sửa: typecheck, lint, test mobile, i18n | Đạt, 107 test |
| Trước sửa: export Android/iOS | Đạt |
| Sau sửa: `npm.cmd run check` trong mobile | Đạt: typecheck, lint, 117 test, i18n + quét chữ JSX |
| `npm.cmd run i18n:check` trong frontend | Đạt; không ghi vào web |
| Sau sửa: `npm.cmd run export:check` | Đạt cả Android/iOS, tạo bundle tại `mobile/dist/` |
| `npm.cmd run backend:check` theo `.env` | Không kết nối được, cả lần thử ngoài sandbox |
| HTTP smoke các giai đoạn trước và API nhắc học live | Chưa xác minh lại vì backend không kết nối được |
| Thiết bị thật Android/iPhone | Chưa kiểm chứng |

10 test mới trong `tests/reminders.test.ts` kiểm tra đường dẫn an toàn, thời gian/múi giờ/giới hạn/ngày/loại nhắc, không ghi đè push/snooze, trần tải thêm, bản dịch/plural/ngôn ngữ, UTC/thời gian tương đối, hủy yêu cầu trên background và tải lại khi resume. Test render component thực qua các biên native được thay thế còn kiểm tra giữ bản nháp khi refetch, gợi ý chỉ áp dụng khi đồng ý, lưu trùng, chờ đọc trước điều hướng và đường dẫn lạ. Không coi các test này là đã kiểm thử native, backend live hay bộ lập lịch Phần B.

Export thành công xác nhận các giai đoạn trước vẫn biên dịch và đóng gói được; không khẳng định mọi luồng HTTP/AI chạy được khi backend không kết nối. Không publish EAS Update, phát hành APK/IPA hoặc lên cửa hàng trong lần này.

## Checklist thủ công Phần A

Chưa thực hiện; phải chạy từng cột trên thiết bị thật với backend hoạt động và Expo Go tương thích SDK hoặc development build.

| Thao tác | Android | iPhone |
| --- | --- | --- |
| Đăng nhập; chuông xuất hiện ở tab chính/Cá nhân, đối chiếu số đếm với server | [ ] | [ ] |
| Mở app → chờ 60 giây → xuống nền hơn 60 giây → trở lại; đối chiếu log GET, không polling ở nền | [ ] | [ ] |
| Tài khoản không có thông báo: trạng thái trống; mất mạng: lỗi/thử lại, dấu `!` trên chuông | [ ] | [ ] |
| Đánh dấu đọc từng cái, chạm một mục, đọc tất cả, xóa; số đếm và trạng thái đồng bộ | [ ] | [ ] |
| Nhấn liên tiếp khi mạng chậm; không có yêu cầu thao tác trùng, lỗi vẫn thử lại được | [ ] | [ ] |
| Kéo làm mới; tạo hơn 20/100 mục ở môi trường test, kiểm tra tải thêm và thông báo mức trần | [ ] | [ ] |
| Chạm URL `/daily` mở Hằng ngày; URL lạ/bên ngoài ở lại danh sách | [ ] | [ ] |
| Cài đặt: bật/tắt, HH:MM sai/đúng, giới hạn 0/1/20/21/số lẻ, múi giờ sai/đúng | [ ] | [ ] |
| Chọn riêng thứ Hai/Chủ nhật, lưu và GET kiểm tra `[0]`/`[6]`; bỏ hết ngày/loại hợp lệ | [ ] | [ ] |
| Giờ yên lặng qua nửa đêm, hai giờ bằng nhau: giải thích rõ; PUT giữ đúng giá trị | [ ] | [ ] |
| Gợi ý có/không dữ liệu/lỗi; không tự áp dụng, chọn rồi phải Lưu; không ghi đè bản nháp khi refetch | [ ] | [ ] |
| Đổi vi/en: tiêu đề, body, số ít/nhiều, thời gian tương đối, biểu mẫu và lỗi đều đổi | [ ] | [ ] |
| Sáng/tối, cỡ chữ lớn, màn nhỏ/ngang, tai thỏ, bàn phím giờ/múi giờ không che ô nhập | [ ] | [ ] |
| Đổi múi giờ thiết bị: cài đặt IANA đã lưu không thay đổi; thời gian tương đối vẫn đúng | [ ] | [ ] |
| Đăng xuất/đăng nhập tài khoản khác: không lộ danh sách/badge/cài đặt tài khoản cũ; Back/deep link có bảo vệ | [ ] | [ ] |
| Đối chiếu web: giá trị push/snooze không bị mobile ghi đè; không có UI Web Push trên mobile | [ ] | [ ] |

## Checklist để dành Phần B

Những mục sau **chưa triển khai**, không đánh dấu đạt trong Phần A.

| Thao tác | Android | iPhone |
| --- | --- | --- |
| Chỉ xin quyền khi bật nhắc, từ chối rồi bật lại qua cài đặt hệ thống | [ ] | [ ] |
| Tạo kênh Android; đặt giờ vài phút sau; kiểm tra khi app tắt/nền/đang mở | [ ] | [ ] |
| Chạm thông báo local từ mọi trạng thái mở đúng nhiệm vụ hằng ngày | [ ] | [ ] |
| Hoàn thành nhiệm vụ hủy nhắc chưa làm bài/sắp mất chuỗi hôm đó; ôn lại không được hẹn local | [ ] | [ ] |
| Lịch 7 ngày đúng múi giờ/ngày trong tuần/qua nửa đêm/DST, tôn trọng giờ yên lặng và giới hạn | [ ] | [ ] |
| Dựng lại khi đổi cài đặt/ngôn ngữ/đăng nhập/mở app không trùng, nội dung theo ngôn ngữ mới | [ ] | [ ] |
| Tắt nhắc/đăng xuất/xóa tài khoản hủy hết; đổi múi giờ thiết bị vẫn theo cài đặt | [ ] | [ ] |

## File tạo/sửa

- API: `src/api/reminders.ts`.
- Logic/vòng đời: `src/features/reminders/logic.ts`, `src/features/reminders/NotificationProvider.tsx`.
- UI: `src/components/NotificationBell.tsx`, `src/screens/NotificationsScreen.tsx`, `src/screens/ReminderSettingsScreen.tsx`, `src/screens/SettingsScreen.tsx`.
- Điều hướng: `app/notifications.tsx`, `app/reminder-settings.tsx`, `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/personal/_layout.tsx`.
- Dịch/test: `src/i18n/locales/vi.json`, `src/i18n/locales/en.json`, `tests/reminders.test.ts`.
- Dependency/tài liệu: `package.json`, `package-lock.json`, `README.md`, `docs/REMINDERS.md`.
