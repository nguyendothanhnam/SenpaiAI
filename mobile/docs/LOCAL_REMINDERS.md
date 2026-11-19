# Nhắc học mobile — Phần B

Ngày kiểm tra: 19/11/2026, nhánh `mobile`. Đọc lại Phần A, luồng nhắc học web/API server và các điểm hoàn thành nhiệm vụ, khôi phục phiên, xóa tài khoản, ngôn ngữ của mobile trước khi sửa. Chỉ thay đổi trong `mobile/`. Giữ nguyên thay đổi đã có và Phần A; không sửa web/backend, không bổ sung endpoint hay gửi thông báo từ server.

## Sử dụng

1. Vào Cá nhân → Cài đặt → Cài đặt nhắc học.
2. Bật công tắc nhắc học, hoặc chọn **Cho phép nhắc trên thiết bị này** nếu cài đặt server đã bật. Chỉ hai thao tác này mới có thể xin quyền; mở ứng dụng hoặc trở về foreground chỉ đọc trạng thái quyền.
3. Chọn giờ `HH:MM`, múi giờ IANA, ngày, loại nhắc và giới hạn rồi Lưu. Công tắc là bản nháp như Phần A, phải Lưu để thay đổi cài đặt server có hiệu lực. Quyền thiết bị được xin riêng, không làm thay đổi Web Push.
4. Nếu từ chối quyền, chọn **Mở cài đặt hệ thống**, bật lại rồi quay về app. Android cần cho phép cả app và kênh **Nhắc học SenpaiAI**; Expo Go dùng quyền của app Expo Go. iPhone provisional/ephemeral được coi là cho phép thông báo yên lặng, có hướng dẫn bật banner.
5. Phần trạng thái hiển thị quyền, lịch đã hẹn, lỗi và nút cập nhật/thử lại. Nếu có lỗi API/native/storage, không báo lịch thành công mới. Lỗi local không biến nhiệm vụ đã hoàn thành trên server thành bài nộp lỗi.

## Quy tắc lịch

| Mục | Hành vi |
| --- | --- |
| Cửa sổ | Hôm nay theo múi giờ cài đặt và 6 ngày lịch tiếp theo, tối đa 14 thông báo một lần |
| Nhắc nhiệm vụ | `daily_task` bật, ngày được chọn, đúng giờ chính; không hẹn thời điểm đã qua, không gửi bù ngay lập tức |
| Giữ chuỗi | `streak_risk` bật, snapshot chuỗi server từ 2 ngày trở lên; lúc `max(21:00, reminder_time)` |
| Trùng giờ hai loại | Chỉ giữ nhắc nhiệm vụ, không hai thông báo cùng thời điểm |
| Ôn lại | `review_due` không bao giờ vào lịch local; vẫn từ server trong trung tâm thông báo |
| Ngày | Python weekday: thứ Hai = 0, Chủ nhật = 6; không sao chép lỗi dịch chỉ số của UI web |
| Giờ yên lặng | Bắt đầu tính, kết thúc không tính; hỗ trợ qua nửa đêm; hai mốc bằng nhau là yên lặng cả ngày |
| Giới hạn | Không vượt `max_per_day` trong kế hoạch theo ngày/múi giờ cài đặt; lượt đã đến hạn được tính trước khi hẹn thêm |
| Mỗi loại/ngày | Tối đa một lượt cho mỗi loại/ngày; đổi giờ/ngôn ngữ không gửi lại loại đã đến hạn |
| Tạm hoãn | Tôn trọng `snooze_until` của API, kể cả offset; không thêm điều khiển tạm hoãn ngoài giao diện web |
| Múi giờ thiết bị | Không dùng để tính thời điểm; trigger là Date tuyệt đối đã tính từ múi giờ cài đặt |
| DST giờ bị mất | Bỏ lượt có giờ địa phương không tồn tại, không tự chuyển sang giờ khác |
| DST giờ lặp | Chọn lần xuất hiện đầu tiên duy nhất; nếu đã qua thì bỏ, không dùng lần lặp thứ hai |
| Hoàn thành nhiệm vụ | Ghi dấu theo thời điểm hoàn thành và ngày địa phương, bỏ cả hai loại hôm đó, dựng lại các ngày còn lại |

Giờ giữ chuỗi 21:00 là lựa chọn cụ thể cho nhắc buổi tối trên thiết bị; backend vẫn giữ nguyên thuật toán riêng (`max(19:00, reminder_time)`). Ngưỡng chuỗi từ 2 ngày giữ đúng điều kiện backend. Nội dung local giữ chuỗi dùng câu chung, không khẳng định số ngày của 6 ngày tương lai là số chuỗi hiện tại.

Snapshot hoàn thành từ `/daily/today` chặn ngày địa phương tại thời điểm quan sát. Ngày nhiệm vụ API vẫn do server quyết định; mobile không đổi ngày/task ID server theo múi giờ thiết bị. Dấu hoàn thành lưu trên thiết bị ngăn snapshot API cũ vô tình hẹn lại trong cùng ngày.

## Đồng bộ và chống trùng

- Mở/khôi phục ứng dụng, đăng nhập lại, foreground, lưu cài đặt và đổi vi/en đều cập nhật lịch. Khi app luôn mở, kiểm tra server mỗi 15 phút để kéo dài cửa sổ và nhận thay đổi; không gọi API từ timer khi AppState khác `active`.
- Mọi thay đổi native/storage đi qua một hàng đợi. Revision thay đổi ngay khi có yêu cầu mới; lệnh schedule cũ trả về sau đăng xuất vẫn bị hủy và không được cài tiếp các mục còn lại.
- Hủy tất cả thông báo mang tiền tố `senpaiai.study.v1.` trước mỗi lần dựng lại, và dọn các thông báo local đã hiện trong khay. Không xóa thông báo server trong trung tâm của Phần A. Không xóa lịch native khác tiền tố nếu có tính năng mới trong tương lai.
- ID ổn định theo tài khoản/ngày/loại. Ledger AsyncStorage riêng tài khoản lưu mốc giờ, loại, ID, dấu hoàn thành và lượt đã hiện; không lưu token/nội dung thông báo. Ghi lượt dự kiến **trước** khi gọi OS. Nếu app chết giữa chừng, lượt có thể bị bỏ nhưng không phát lại làm phiền.
- Lượt đến hạn được tính là đã sử dụng kể cả OS không hiển thị. Các lượt tương lai đã hủy được thay thế; giữ lịch sử khoảng 35 ngày để chống phát lại sau dựng lịch và đổi múi giờ. Tăng/giảm giới hạn chỉ tác động lượt chưa gửi; không thể thu hồi số lượt đã hiện trước khi giảm giới hạn.
- JSON hỏng/phiên bản lạ/lỗi lưu/hủy/lập lịch: không lắp thêm lịch mới, dọn lịch cài dở khi có thể, báo lỗi và cho thử lại. Không tự xóa ledger hỏng để bỏ qua giới hạn.
- Đăng xuất, JWT hết hạn, đăng nhập tài khoản khác và xóa tài khoản dùng `session.clearPrivateData`, chờ luồng hủy trước khi kết thúc dọn phiên. Consent/ledger riêng tài khoản còn trên thiết bị qua đăng xuất để tránh gửi lại trong ngày khi đăng nhập lại. Nếu token không đọc/xóa được, trạng thái storage-error cũng yêu cầu hủy.
- Hoàn thành `POST /daily/complete` thành công gọi luồng hủy trước khi trả kết quả API cho UI; tải lại snapshot sau đó không cản trả kết quả bài nộp. Nếu mất phản hồi POST, lần GET xác nhận completed cũng sẽ bỏ lịch hôm nay khi đồng bộ tiếp theo. Không hủy chỉ vì mọi câu đã được trả lời nhưng server chưa xác nhận hoàn thành.
- Thay đổi settings/ngôn ngữ được áp dụng ngay với snapshot cùng tài khoản đã biết trước khi chờ API học tập. Nếu API tạm lỗi, có thể dùng snapshot gần nhất của tài khoản đang xác thực và ngôn ngữ mới, đồng thời hiện lỗi đồng bộ. Không dùng snapshot tài khoản khác. Không xin quyền để “sửa” lỗi mạng.

## Chạm thông báo và foreground

Thông báo chứa owner, user ID, ngày, loại và thời điểm. Chỉ nhận metadata local đúng định dạng, thuộc tài khoản hiện tại. Tuyến duy nhất là `/(tabs)/daily`; không mở URL tùy ý từ dữ liệu.

Khi khởi động lạnh, đọc response cuối cùng sau khi root navigation sẵn sàng và phiên được xác định; giữ response nếu khôi phục token đang offline, xử lý khi xác thực được. Anonymous/tài khoản khác không mở dữ liệu riêng. Listener xử lý tap khi nền/đang mở; response được ghi nhận và clear để không mở hai lần do cả initial response và listener.

Foreground tắt âm thanh, badge hệ thống và banner OS; dùng thẻ theo theme/vùng an toàn trong 7 giây, có Mở nhiệm vụ và Đóng. Trước khi hiện thẻ, kiểm tra lại ngày, giờ yên lặng, tài khoản, hoàn thành và ledger; sự kiện lặp/không thuộc ledger bị bỏ. Nội dung thẻ và các lịch mới theo ngôn ngữ đang chọn. Background/killed dùng nội dung đã được dịch khi hẹn trong OS, không có JavaScript chạy tại giờ giao.

## Expo và giới hạn cần nghiệm thu

Đã giữ `expo-notifications ~58.1.9` cài bằng `npx expo install expo-notifications` ở Phần A; Phần B thêm config plugin chính thức `expo-notifications`. Không thêm thư viện/native module tùy chỉnh. Không gọi API lấy token Expo/FCM/APNs, không Web Push hoặc thay đổi server scheduler.

Theo [Expo Notifications SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/) (đối chiếu lại 19/11/2026): local notifications hỗ trợ Expo Go **Android và iPhone**. Hạn chế remote push trên Expo Go Android từ SDK 53 không chặn phần local này. Expo Go phải khớp SDK; development build là phương án khi Expo Go không tương thích hoặc cần cấu hình native riêng. Bản development cũ phải build/cài lại để nhận module/plugin; không thể cập nhật native module chỉ bằng reload JS.

Có thể dùng profile development đã có:

```powershell
cd mobile
npm.cmd run start:clean
# Khi cần build mới; chỉ chạy nếu đã chuẩn bị tài khoản/ký ứng dụng:
npx.cmd eas-cli build --platform android --profile development
npx.cmd eas-cli build --platform ios --profile development
```

Lần này không chạy EAS build/publish, không tạo hay phát hành APK/IPA. iOS build cần EAS hoặc macOS/Xcode phù hợp; export bundle trên Windows không kiểm chứng native iOS.

**Các giới hạn thực tế:**

- Android dùng delivery mặc định `bestEffort`, không xin quyền exact alarm đặc biệt và không dùng chế độ alarm clock cho lời nhắc học. [Expo SDK 58 về exact alarms và delivery](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/#notificationdelivery) nêu rõ OS/OEM có thể trì hoãn giờ giao, nhất là khi thiếu quyền exact alarm hoặc tiết kiệm pin. iPhone Focus/provisional/Notification Summary cũng có thể làm im lặng/trì hoãn hiển thị.
- Planner không bao giờ hẹn thời điểm trong giờ yên lặng, vượt giới hạn hoặc trùng lượt. Khi app đang chạy, thẻ foreground còn được kiểm tra lại. **Khi app tắt, Expo không cho JS chặn OS ngay trước khi giao một local notification đã bị trì hoãn. Vì vậy chưa thể bảo đảm tuyệt đối rằng OS không giao trễ vào giờ yên lặng hoặc gom lượt từ hai ngày thành cùng một ngày thực nhận.** Không báo các bảo đảm ở mức OS này là đã đạt. Tất cả nhắc local mặc định không âm thanh/rung.
- Nếu không mở lại app quá 7 ngày, không có tiến trình JS nền tự nối lịch. Đây là lịch cuốn chiếu khi mở/đồng bộ ứng dụng; không thêm background task/native tùy chỉnh.
- Thay đổi trên web/thiết bị khác, hoàn thành bài ở thiết bị khác hoặc chuỗi bị đứt khi app này tắt chỉ được biết khi đồng bộ tiếp theo. Lịch tương lai dựa trên snapshot mới nhất có sẵn; không thể kiểm tra server đúng giờ giao khi app bị tắt với kiến trúc local-only.
- Giới hạn/ledger theo tài khoản **trên thiết bị này**. Không có bộ đếm local chung giữa nhiều thiết bị; muốn tổng hạn mức xuyên thiết bị cần hợp đồng backend ngoài phạm vi được phép.
- Force-stop Android, hạn chế pin của hãng, quyền bị thu hồi, xóa dữ liệu app hay lỗi OS/storage có thể làm mất/đình chỉ lịch. Không khẳng định đã thử các tình huống này trên máy thật. Nếu hủy native thất bại, UI báo lỗi; không thể tuyên bố đã hủy thành công tại OS.

## Kiểm tra tự động

| Kiểm tra | Kết quả |
| --- | --- |
| Nền Phần A trước khi sửa | Typecheck, lint, 117 test và i18n đạt |
| `npm.cmd run check` trong mobile | Typecheck, lint, **136 test**, khóa dịch và quét chữ JSX đạt |
| `npm.cmd run i18n:check` trong frontend | Đạt, không ghi vào source web |
| `npm.cmd run export:check` | Đạt bundle Android/iOS; chưa phát hành |
| `npm.cmd run backend:check` theo `.env` | Không kết nối được cả trong và ngoài sandbox |
| API nhắc học/daily/rewards live | Chưa xác minh lại được do backend không kết nối |
| Android/iPhone thật, Expo Go/development build | Chưa kiểm chứng |

19 test mới tại `tests/local-reminders.test.ts`: 7 ngày, ngày trong tuần, UTC+14/múi giờ lẻ, DST New York/Berlin/Lord Howe, qua nửa đêm, giờ yên lặng bằng nhau, snooze offset, loại ôn lại/chuỗi không đủ điều kiện, giới hạn, ledger sau restart, trùng giờ, hủy hoàn thành và đăng xuất, response thuộc tài khoản, native/storage/cancel lỗi, schedule trả muộn sau logout, nội dung dịch và one-off DATE của adapter. Test provider render thực qua biên native giả lập kiểm tra không xin quyền khi startup, denial/recovery, cold/warm tap không lặp, foreground, complete và logout. Đây không phải test native trên điện thoại.

## Checklist Android và iPhone

Chạy riêng từng cột với backend hoạt động, tài khoản test và Expo Go khớp SDK hoặc development build mới. Tất cả ô còn trống, chưa thực hiện trên thiết bị thật.

| Thao tác | Android | iPhone |
| --- | --- | --- |
| Cài/chạy bản phù hợp SDK; đăng nhập; mở app không tự xin quyền | [ ] | [ ] |
| Bật nhắc/Cho phép trên thiết bị: hộp quyền chỉ hiện sau thao tác, trạng thái đúng | [ ] | [ ] |
| Từ chối; nút mở cài đặt đúng app; bật lại rồi quay về, lịch được tạo | [ ] | [ ] |
| Android: chặn riêng kênh Nhắc học, trạng thái denied và hướng dẫn bật kênh; iPhone: kiểm tra provisional/quiet | [ ] | [ ] |
| Chọn ngày hôm nay theo múi giờ cài đặt, giờ chính sau 2–3 phút, ngoài giờ yên lặng; Lưu | [ ] | [ ] |
| Giữ app foreground đến hạn: chỉ một thẻ gọn, không âm thanh, có mở Hằng ngày/Đóng, tự đóng sau 7 giây | [ ] | [ ] |
| Đưa app xuống nền đến hạn: thông báo trong khay; tap mở Hằng ngày | [ ] | [ ] |
| Đóng app theo cách thông thường rồi đến hạn: thông báo; tap khởi động lạnh mở Hằng ngày, không điều hướng hai lần | [ ] | [ ] |
| Tap khi backend tắt: màn khôi phục offline; backend trở lại/retry mở đúng Hằng ngày | [ ] | [ ] |
| Hoàn thành nhiệm vụ trên mobile trước giờ hẹn; nhắc chưa làm và giữ chuỗi hôm đó đã hủy; các ngày sau còn | [ ] | [ ] |
| Chuỗi dưới 2 không có nhắc giữ chuỗi; chuỗi từ 2 thử sau 21:00, ngoài quiet; trùng giờ hai loại chỉ một lượt | [ ] | [ ] |
| Chỉ bật ôn lại: không có lịch local, thông báo review server vẫn đọc được ở trung tâm | [ ] | [ ] |
| Giờ yên lặng qua nửa đêm, bắt đầu/kết thúc và hai mốc bằng nhau; không hẹn trong quiet | [ ] | [ ] |
| Giới hạn 1: sau một lượt đã đến hạn, đổi giờ và dựng lại không hẹn thêm hôm đó | [ ] | [ ] |
| Liên tiếp Lưu/Cập nhật lịch/đổi ngôn ngữ/foreground: không sinh ID hay lượt trùng | [ ] | [ ] |
| Đổi vi/en sau khi có lịch: chữ UI/kênh/thẻ và nội dung của thông báo tương lai đổi đúng | [ ] | [ ] |
| Tắt nhắc rồi Lưu; đăng xuất; xóa tài khoản test: không còn lịch/khay local của SenpaiAI | [ ] | [ ] |
| Đăng nhập lại cùng tài khoản không gửi lại loại đã đến hạn; tài khoản khác không mở tap cũ hoặc hiện banner cũ | [ ] | [ ] |
| Đổi múi giờ thiết bị: lịch vẫn theo múi giờ IANA đã lưu; đổi múi giờ cài đặt rồi Lưu dựng lại | [ ] | [ ] |
| Sáng/tối, tai thỏ/cắt màn hình, xoay ngang, chữ lớn: thẻ và trang quyền nằm trong vùng an toàn | [ ] | [ ] |
| Tiết kiệm pin/Focus/Notification Summary/reboot/force-stop: ghi nhận giờ giao thực tế và hạn chế, không coi là cam kết giờ tuyệt đối | [ ] | [ ] |

Một loại đã đến hạn sẽ không được gửi lại trong cùng ngày dù đổi giờ; để thử nhiều vòng cùng ngày, dùng tài khoản test khác hoặc ngày thử khác. Không thêm nút xóa sổ giới hạn trong giao diện sản phẩm. Các test DST chạy tự động bằng mốc giờ cố định; nghiệm thu trên thiết bị có thể dùng múi giờ DST và môi trường test ngày phù hợp.

## File Phần B

- Mới: `src/features/reminders/planner.ts`, `LocalReminderController.ts`, `localNotifications.ts`, `LocalReminderProvider.tsx`; `src/components/LocalReminderStatus.tsx`; `tests/local-reminders.test.ts`; tài liệu này.
- Sửa: `app/_layout.tsx`, `app.config.ts`, `src/api/services.ts`, `src/screens/ReminderSettingsScreen.tsx`, `src/i18n/locales/vi.json`, `en.json`, `tests/reminders.test.ts`, `README.md`, `docs/REMINDERS.md`.
- Không thêm dependency ở Phần B; module Expo chính thức đã cài ở Phần A. Các tệp native được Expo sinh khi build, không đưa mã native tùy chỉnh vào repository.
