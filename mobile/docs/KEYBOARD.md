# Bàn phím và khung nhập — chẩn đoán, sửa và kiểm thử

## Chẩn đoán trước khi sửa

Phiên bản thực trong `node_modules`: **Expo 58.0.23, React Native 0.88.1, React 19.3.0**, Expo Router 58.0.30. Không nâng/hạ SDK hoặc thêm thư viện trong lần sửa này.

| Hệ điều hành | Bằng chứng trong mã cũ | Kết luận và mức xác nhận |
| --- | --- | --- |
| Android | `ConversationScreen` đặt `behavior` chỉ cho iOS; Android để `undefined`. `app.config.ts` có `softwareKeyboardLayoutMode: 'resize'`, không cấu hình tắt tràn viền. | Với Expo edge-to-edge hiện tại không thể dựa riêng vào resize; mã không có đường xử lý phần khung nhập bị IME che. Phù hợp lỗi đã báo trên điện thoại thật. Chưa có model/OS và bản đo kích thước từ điện thoại để quy mọi trường hợp về đúng một nguyên nhân native. |
| iPhone | Chat và một số form dùng `keyboardVerticalOffset={90}`, `Screen` dùng 80, Auth/modal dùng cách khác. Offset không theo thanh tiêu đề/vị trí nội dung thực. Padding home indicator vẫn giữ khi bàn phím mở. | Có nguy cơ lệch vị trí và khoảng trống do offset/safe area không thống nhất. Đây là chẩn đoán từ mã; chưa có xác nhận lỗi trên iPhone thật. |
| Cả hai | Chỉ cuộn Chat sau gửi thành công; không theo mở/đổi khung bàn phím. Ô nhập có `maxHeight` nhưng không quản lý kích thước nội dung. Cấu hình khóa dọc. | Thiếu cơ chế cuộn tới tin cuối khi mở bàn phím, tăng/giảm chiều cao ô nhập có giới hạn và kiểm thử ngang. |
| Điều hướng | `/conversation/[id]` là màn root stack có native header, nằm ngoài `(tabs)`; tab Chat là danh sách hội thoại. Tab dưới chưa có `tabBarHideOnKeyboard`. | Cuộc hội thoại hiện không có tab dưới. Không được cộng một chiều cao tab giả vào màn này. Các màn trong tab cần tính vùng đáy khác màn root stack. |

Mã liên quan: `ConversationScreen`, `AuthScreen`, `GrammarScreen`, `ProfileScreen`, `components/ui`, `NameDialog`, `DangerDialog`, `screens/study/shared`, các layout root/tab/auth/personal và `app.config.ts`. Đã báo chẩn đoán trước khi sửa.

Nguồn đối chiếu:

- [Expo: Keyboard handling](https://docs.expo.dev/guides/keyboard-handling/): trên Android tràn viền không thể chỉ dựa vào cửa sổ tự resize; cần xử lý tránh bàn phím. Tránh kết hợp bù chiều cao nhiều lần.
- [React Native: KeyboardAvoidingView](https://reactnative.dev/docs/keyboardavoidingview): offset phụ thuộc vị trí view trong màn hình, không phải hằng số chung cho mọi header.
- [React Native: Keyboard](https://reactnative.dev/docs/keyboard): Android chỉ có sự kiện didShow/didHide; Android 10 trở xuống có thể không phát sự kiện dưới adjustResize/adjustNothing. JavaScript không bảo đảm đồng bộ mọi frame chuyển động IME trên mọi máy.
- [Expo: Edge-to-edge](https://expo.dev/blog/edge-to-edge-display-now-streamlined-for-android): không dựa vào tắt edge-to-edge cho Android mới; Android 16 không cho ứng dụng target tương ứng opt out.

Không tuyên bố đây là một lỗi đã được xác nhận của mọi bản RN 0.88.1 hoặc mọi iPhone. Sự kiện/geometry thực của từng IME, Expo Go và bản build phải được thử trên thiết bị.

## Cách sửa

`components/KeyboardLayout.tsx` chỉ dùng React Native (`View`, `Keyboard`, `ScrollView`, `FlatList`, `TextInput`, `useWindowDimensions`) và safe-area-context đã có:

1. Đo khung ngoài bằng `measureInWindow`, gồm vị trí thực dưới header. So sánh đáy khung với đỉnh bàn phím; chỉ bù phần giao nhau. View ngoài không bị đổi chiều cao bởi padding con nên không tạo vòng lặp. Nếu Android/host đã resize, phần giao bằng 0 và không đẩy hai lần.
2. iOS nghe will/did change frame cùng show/hide; Android nghe didShow/didHide và đo lại khi layout/kích thước cửa sổ thay đổi. Dùng `Keyboard.scheduleLayoutAnimation` cho sự kiện iOS. Khi đóng, bỏ bù bàn phím; không giữ chiều cao cửa sổ ban đầu cố định khi xoay.
3. Safe area được tính theo phần còn thiếu trong viewport; parent SafeAreaView/tab đã dành chỗ thì không thêm lại. Mở bàn phím bỏ padding home indicator phía trên IME. Có xử lý trái/phải cho tai thỏ khi ngang.
4. `KeyboardScrollView` và `KeyboardFlatList` giữ danh sách ảo hóa, xử lý cuộn để đóng bàn phím, giữ nút/liên kết bấm được (`handled`). Tắt tự cộng keyboard inset của ScrollView iOS để tránh cộng lần hai.
5. `KeyboardInput` giữ ref/form handlers của ô gốc; đo ô và viewport của scroller để cuộn khi ô nằm ngoài vùng nhìn thấy. Không cuộn lại ô đã nhìn rõ. Theo dõi focus, selection và thay đổi nội dung; không sửa giá trị bản nháp khi dismiss. Các ô nhiều dòng trong form được giới hạn theo viewport đang còn trống để vẫn cuộn được nội dung ô trên màn nhỏ/ngang.

Không có dependency mới, không đổi API/backend/web.

### Chat

- Tách `ChatComposer`: input và nút gửi nằm cùng hàng, nút không bị đẩy xuống dưới input dài. Ô nhập tăng theo content size, tối thiểu 48, tối đa 150 điểm và co giới hạn theo viewport; quá giới hạn thì cuộn trong ô.
- Khung nhập là sibling của danh sách, không dùng absolute bottom. Khi đóng IME, dùng phần safe area chưa được navigator xử lý; khi mở chỉ giữ khoảng đệm nhỏ trên bàn phím.
- Giữ danh sách đảo chiều: tin mới nhất ở offset 0. Cuộn tới đó khi focus/mở/đổi chiều cao bàn phím và khi viewport danh sách đổi. Khi người dùng kéo đọc tin cũ, không ép cuộn lại cho tới khi focus hoặc về gần tin cuối.
- Ẩn hàng nút đổi tên lặp lại bên dưới native header trong khi nhập để dành chỗ trên màn ngang/nhỏ; thao tác này không đổi native header hoặc mất bản nháp.
- Cuộn/chạm phần trống trong danh sách đóng bàn phím theo cơ chế ScrollView. Các nút/liên kết vẫn xử lý được ngay khi bàn phím mở. Bản nháp nằm ở state màn hình, độc lập sự kiện bàn phím.

### Phạm vi áp dụng

- `Screen` dùng lớp mới: tự áp dụng cho sửa tài liệu, Hằng ngày/chia động từ, phiên Luyện ngữ pháp, Cài đặt và các trang đang dùng `Screen`.
- Các list riêng: danh sách Chat, Ngữ pháp/phân tích câu/tìm mẫu, Hồ sơ, Thư viện, tìm Kanji, danh sách/biểu mẫu/nhập JSON Quiz và Flashcard.
- Auth đăng nhập/đăng ký giữ SafeAreaView phía ngoài; NameDialog và DangerDialog có viewport/scroll riêng trong Modal.
- Thành phần `QuestionCard` dùng `KeyboardInput` cho chia động từ; giữ toàn bộ validation/chấm bài/API cũ.
- Tab dưới bật `tabBarHideOnKeyboard` để không nổi giữa nội dung và IME. Cuộc hội thoại vẫn là màn stack riêng, không tự thêm tab dưới.
- `app.config.ts`: giữ `resize`, đổi `orientation` sang `default` để cho phép dọc/ngang. **Bản APK/iOS build cũ khóa dọc cần build/cài lại để nhận cấu hình native này.** Thay JS có thể cập nhật trong Expo Go tương thích; việc host có cho xoay phải thử trực tiếp.

## Dùng cho màn hình mới

```tsx
import { KeyboardLayout, KeyboardScrollView, KeyboardInput } from '../components/KeyboardLayout'

// Đặt một KeyboardLayout ở gốc màn hình, không bọc thêm KeyboardAvoidingView.
// Screen của ui.tsx đã chứa nó, nên bên trong Screen chỉ dùng KeyboardInput.
<KeyboardLayout>
  <KeyboardScrollView contentContainerStyle={{ padding: 20 }}>
    <KeyboardInput value={draft} onChangeText={setDraft} multiline />
  </KeyboardScrollView>
</KeyboardLayout>
```

Danh sách dài dùng `KeyboardFlatList`; không lồng FlatList vào ScrollView. Form/dialog toàn màn hình không có header dùng `safeTop` hoặc parent SafeAreaView. Khung nhập cố định ngoài list dùng `ensureVisible={false}` và theo viewport như `ChatComposer`, tránh đo nó như con của danh sách.

## Kiểm tra tự động và giới hạn

Test hình học trong `tests/keyboard.test.ts`: Android/iPhone với header khác nhau; cửa sổ đã resize; tab/safe area đã chiếm chỗ; đổi chiều cao bàn phím; xoay dọc/ngang; padding trở về 0 khi đóng; tai thỏ không cộng hai lần; giới hạn ô nhập; cuộn ô chỉ khi bị che.

Chạy `npm.cmd run check` và `npm.cmd run export:check` trong `mobile/`; `npm.cmd run i18n:check` trong `frontend/`. Kết quả: **typecheck/lint, 63 test (7 test mới), khóa dịch web/mobile và export Android/iOS đạt**. Đây không phải test bàn phím native hoặc bằng chứng đã thử trên điện thoại. Người dùng chưa thử lại được trên điện thoại tại thời điểm báo cáo.

**Chỉ thiết bị thật xác nhận được:** animation/frame IME, độ trễ show/hide, đo tọa độ của host Expo Go/bản build, touch/scroll responder, caret khi gõ tiếng Nhật/emoji, phím Back Android, home indicator/tai thỏ và chế độ ba nút/cử chỉ; phần cứng bàn phím/floating keyboard nếu dùng. Chưa kiểm thử iPad bàn phím nổi hoặc split keyboard; không bảo đảm app được đẩy lên theo vùng bàn phím nổi nhỏ như bàn phím dock toàn chiều rộng.

Android 10 trở xuống thiếu sự kiện Keyboard trong một số cấu hình: wrapper vẫn đo layout nếu OS resize, nhưng trạng thái keyboard/tab phụ thuộc sự kiện native của host. Không cam kết cùng animation với Android mới nếu chưa thử. Không thêm thư viện native để che giới hạn này.

## Quy trình thử cho từng màn hình

Trên **mỗi hàng của bảng**, chạy đủ sáu bước, riêng trên Android và iPhone:

1. Mở bàn phím ở ô đầu và ô cuối; con trỏ/nội dung đang gõ và nút hành động phải nhìn thấy. Ghi draft dễ nhận dạng.
2. Gõ nhiều dòng; input dài đạt giới hạn rồi cuộn trong ô; nút gửi/lưu vẫn bấm được. Với ô đơn dòng, thử chuỗi dài và chuyển ô tiếp theo.
3. Chạm phần trống và kéo list để đóng; draft không đổi. Mở lại; đóng bằng Back Android hoặc thao tác iOS; không có khoảng trống tồn dư hoặc bị tab/home indicator che.
4. Chuyển bàn phím Latin ↔ Nhật, bật/tắt hàng gợi ý và mở emoji khi đang gõ; input theo chiều cao mới; giữ nguyên draft/caret, không gửi nhầm.
5. Xoay ngang rồi dọc khi đang mở và khi đã đóng; không mất draft, không che nút hoặc tai thỏ; không cộng safe area hai lần. Tắt khóa xoay hệ điều hành; bản build phải nhận orientation mới.
6. Cuộn lúc đang mở; nút/liên kết trong list hoạt động ngay từ lần chạm đầu; không nuốt thao tác gửi/lưu. Thử màn nhỏ/font lớn. Không thực hiện hành động xóa/reset thật khi chỉ kiểm tra layout.

| Màn hình/ô cần thử | Android | iPhone | Điều kiện riêng |
| --- | --- | --- | --- |
| Danh sách Chat — tìm kiếm | [ ] | [ ] | Tab dưới ẩn khi mở, trở lại khi đóng; bấm hội thoại không cần chạm hai lần |
| Cuộc hội thoại — khung gõ | [ ] | [ ] | Tin cuối nhìn thấy; nhập nhiều dòng rất dài; gửi từ bàn phím mở; đọc tin cũ không bị kéo lại; mở lại bàn phím về tin cuối |
| Cuộc hội thoại/thư mục — đổi tên/tạo | [ ] | [ ] | Modal và nút Lưu/Hủy không bị che trên màn ngang |
| Đăng nhập — email/mật khẩu | [ ] | [ ] | Next/Done, nút mắt, thông báo validation, nút Đăng nhập không bị che |
| Đăng ký — cả bốn ô | [ ] | [ ] | Đi tới xác nhận mật khẩu và nút Đăng ký; không reset giá trị khi cuộn/xoay |
| Thư viện — tìm kiếm/lọc | [ ] | [ ] | Bấm bộ lọc/tài liệu khi bàn phím mở; đóng sheet không mất từ khóa |
| Thư viện — thêm/sửa tài liệu | [ ] | [ ] | Tên/tags/URL/nội dung dài; nhập URL, ô nội dung cuộn trong và ngoài; nút lưu nhìn thấy |
| Hằng ngày — chia động từ | [ ] | [ ] | Gõ Nhật, bấm nộp khi IME mở; feedback và câu tiếp không bị che |
| Luyện ngữ pháp — chia động từ | [ ] | [ ] | Như Hằng ngày; kết quả/câu tiếp; không gửi lặp khi bấm nhanh |
| Ngữ pháp — phân tích câu | [ ] | [ ] | Câu nhiều dòng; nút Phân tích; kết quả dài cuộn được |
| Ngữ pháp — tìm mẫu | [ ] | [ ] | Tìm khi list nhiều mẫu; bấm chọn mẫu ngay khi IME mở |
| Hồ sơ — username/mục tiêu học | [ ] | [ ] | Form trong stack nằm trong tab; không tính hai header/tab/safe area; lưu/hủy giữ hành vi cũ |
| Cài đặt — dialog reset/xóa | [ ] | [ ] | Cảnh báo dài cuộn được; ô gõ từ xác nhận và Hủy nhìn thấy; không bấm xác nhận thật |
| Kanji — tìm kiếm | [ ] | [ ] | Đổi bàn phím Nhật; chọn kết quả khi IME mở |
| Quiz — tìm bộ/tạo/sửa | [ ] | [ ] | Câu/lựa chọn/giải thích dài, nhiều hàng ảo hóa; không mất input khi cuộn |
| Quiz — dán JSON/đặt tên nhập tệp | [ ] | [ ] | JSON dài cuộn trong ô; nút Preview/Xác nhận/Hủy không bị che |
| Flashcard — tìm bộ/tạo/sửa/đặt tên nhập | [ ] | [ ] | Mặt trước/sau dài; modal đổi tên; nút lưu và ô cuối |

Android: chạy bảng ít nhất một lần với điều hướng **ba nút**, một lần với **cử chỉ**. iPhone: ưu tiên máy có tai thỏ/Dynamic Island và home indicator. Ghi model, phiên bản OS, Expo Go/build và bàn phím dùng khi báo lỗi còn lại.

## File tạo/sửa

Tạo `src/components/KeyboardLayout.tsx`, `ChatComposer.tsx`, `src/features/keyboard/geometry.ts`, `tests/keyboard.test.ts` và tài liệu này. Sửa `components/ui.tsx`, `NameDialog`, `DangerDialog`, `questions/QuestionCard`; các màn `Conversation`, `Auth`, `ChatList`, `Library`, `LibraryEditor`, `Grammar`, `Profile`, `Kanji`, `study/shared`; `app/(tabs)/_layout.tsx`, `app.config.ts`, README. Không sửa mã web/backend, khóa dịch hoặc dependency.
