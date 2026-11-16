# Cửa hàng giao diện mobile

## Chẩn đoán trước khi sửa

Nhánh `mobile`, Expo 58.0.23, React Native 0.88.1. Không sửa web hoặc backend/API.

Nghi ngờ “mobile chỉ có Classic” không đúng hoàn toàn: provider cũ đã nhập Classic, Thần Khê và Sakura từ web. Tuy nhiên, đó là một danh sách cho phép viết riêng, cửa hàng vẫn là bản chỉ xem/chọn theme đã sở hữu của Giai đoạn 3:

- `personalAPI.shop()` chỉ trả `response.data.themes`, làm mất `backgrounds`.
- Chưa có API mua trong luồng mobile; màn hình chỉ có nút chọn với mục đã sở hữu và được hỗ trợ. Nhãn cũng ghi cửa hàng chỉ đọc.
- Chưa có mô tả/xem trước sáng tối độc lập; chưa đọc nền đang dùng từ rewards profile.
- Provider chỉ áp dụng màu, không dựng ảnh. Các màn/navigator có nền đặc che bất kỳ ảnh nào phía sau.
- Mobile dùng `settings.catalog` cho tên; web dùng `common.themes` và `common.backgrounds` cho tên/mô tả.

Đã đối chiếu `frontend/src/pages/ThemeShop.tsx`, `themes/ThemeProvider.tsx`, `themes.ts`, `services/api.ts`, hai locale web, `backend/app/api/rewards.py` và `services/rewards_service.py`.

| API | Mobile trước sửa | Web và mobile sau sửa |
| --- | --- | --- |
| `GET /rewards/shop` | Chỉ lấy themes | Giữ cả themes/backgrounds, giá/quyền sở hữu/đang dùng từ server |
| `GET /rewards/me` | Số dư, theme và quyền sở hữu; chưa dùng active background | Số dư, quyền sở hữu, theme/nền đang dùng |
| `POST /rewards/shop/purchase` | Chưa gọi | `{ item_type, item_id, equip: true }` |
| `PUT /rewards/equip` | Chỉ `{ theme_id }` | Theme hoặc `{ background_id }`; `background_id: null` trở về nền mặc định theme |

Giá server hiện là **500 điểm/theme trả phí**, **150 điểm/nền**; `themes.ts` có giá gợi ý khác (300/100). Mã mobile mới luôn lấy giá từ API, không lấy giá presentation web để trừ điểm. Không nâng/hạ SDK hoặc thêm native library.

## Hành vi mới

- Hai danh mục hiển thị mọi mục API trả về, không lọc theo sở hữu. Danh sách ảo hóa có tải/không có dữ liệu/lỗi/kéo làm mới.
- Tên/mô tả dùng namespace `common` vi/en nhập trực tiếp từ web. ID mới chưa có bản dịch hiện nhãn thiếu bản dịch; mục thiếu định nghĩa palette/ảnh đóng gói vẫn hiện với giá/trạng thái và lý do chưa thể mua/áp dụng. Không âm thầm ẩn hoặc cho tiêu điểm vào mục chưa hiển thị được.
- `nativeThemes` dùng toàn bộ `themes` của web, không giữ danh sách ID viết riêng. Hai palette được đọc trực tiếp, chuyển cú pháp màu CSS RGB sang RGBA React Native khi cần; không sao chép các bảng màu.
- Preview sáng/tối nằm trong từng thẻ cửa hàng. Nó chỉ thay state cục bộ của preview, không gọi equip, không lưu mode hoặc thay theme toàn app.
- Bấm Mua đọc lại catalog/profile và mở hộp xác nhận tên, giá, số dư trước/sau, áp dụng ngay. Xác nhận kiểm tra lại lần nữa; nếu giá/số dư thay đổi thì không POST và yêu cầu xác nhận số liệu mới.
- Thiếu điểm hiển thị số còn thiếu; backend báo thiếu điểm thì đọc lại dữ liệu để tính. Nếu mất mạng ở bước đọc lại, báo chưa tính được thay vì đoán thiếu 0 điểm.
- Chỉ một mutation chạy cùng lúc; bấm xác nhận nhiều lần dùng chung Promise và một quote chỉ gửi POST một lần. Không retry POST tự động. Đã sở hữu/không sở hữu/mục mất/giá đổi được xử lý bằng mã lỗi backend.
- POST thành công dùng **số dư server trả về**, cập nhật ownership và active theme/background ngay; các query rewards/catalog theo tài khoản được cập nhật. Hủy query cũ trước khi ghi cache để phản hồi GET cũ không ghi đè kết quả mua vừa xác nhận.
- Mất phản hồi POST: chỉ đọc lại ownership/profile. Nếu đã sở hữu thì phục hồi kết quả từ server. Nếu chưa rõ thì khóa mutation trong phiên màn hình và có nút đọc lại; không tự mua lại. Nếu vẫn không xác định sau khi mạng ổn định, có thể rời rồi mở lại cửa hàng để đọc trạng thái mới trước khi xác nhận tiếp. Backend không có endpoint trạng thái theo mã request; client không tự kết luận timeout là chưa mua.
- Nút Dùng gọi equip với đúng loại. Áp dụng sau khi API thành công, không đổi theme lạc quan rồi để lại theme chưa xác nhận khi lỗi.

## Theme toàn ứng dụng và đồng bộ tài khoản

`AccountThemeBridge` đọc `/rewards/me`, đối chiếu quyền sở hữu và đưa theme/nền vào provider. Khi đăng xuất/đổi tài khoản, trở về trạng thái của tài khoản mới; callback mua cũ không được cập nhật tài khoản khác. Đăng nhập lại/thiết bị khác đọc cùng profile server. Không lưu theme/nền đang dùng vào một khóa AsyncStorage chung.

Mode `light/dark/system` vẫn là tùy chọn **trên thiết bị**, giữ khóa mode cũ; không gửi lên server. Đổi mode sẽ chọn palette và ảnh nền mặc định tương ứng của theme. Nền đã mua được chọn riêng sẽ ghi đè nền mặc định theme, giống web.

`ThemeBackdrop` dựng một lớp nền chung và overlay nhuộm từ token nền hiện tại. Độ phủ được tính theo palette để giữ tương phản ít nhất 4,5:1 cho cả text và textMuted ngay khi ảnh bên dưới cực đen/trắng; tránh dùng một độ phủ cố định quá yếu cho Thần Khê sáng. Card/ô nhập có surface riêng để chữ dễ đọc. Preview dùng cùng phép tính overlay. Navigation theme/scene/stack cũng trong suốt đúng chỗ; nếu chỉ làm màn hình trong suốt mà giữ native ScreenStack nền trắng thì ảnh vẫn bị che.

Đã rà soát và đổi nền màn hình sang token `screen`, giữ token `bg/card/bgElevated` cho surface thật; thay ba lớp phủ dialog viết cứng bằng `scrim` dẫn xuất từ palette. Chat composer giữ surface `bg` để ô gõ/nút gửi luôn dễ đọc. Các native header/tab/status bar dùng màu và resolved mode tương ứng. `app.config.ts` còn màu splash/branding khởi động trước JavaScript; đó không phải palette của màn hình đang đăng nhập và không thể biết theme server trước khi khôi phục phiên.

## Tài nguyên ảnh

Đã đọc kích thước và dung lượng tài nguyên web:

- 13 nền PNG tổng **23.025.771 byte**; không đóng gói các PNG này.
- 13 WebP tương ứng tổng **1.227.524 byte** (~1,17 MiB), độ phân giải khoảng **1375–1376 × 768**, từng ảnh 62.920–166.998 byte. Dùng nguyên bản đã tối ưu, không nén lại làm giảm chất lượng.
- `/cat-logo.webp`: 208 × 224, 15.348 byte; không phải linh vật riêng của theme và không cần thêm bản sao vào bộ nền (mobile đã có icon thương hiệu).
- `themes/than-khe/cat.webp` và `themes/sakura/cat.webp` được định nghĩa web tham chiếu nhưng **không tồn tại**. Không bịa ảnh thay thế; thẻ theme báo thiếu linh vật, palette/nền vẫn dùng được.

Chọn **đóng gói** vì toàn bộ danh mục chỉ khoảng 1,23 MB, xem trước/nền ổn định khi mất mạng và không phụ thuộc địa chỉ triển khai web hoặc đường dẫn ảnh backend không phục vụ. Chỉ mang các WebP thực sự được định nghĩa theme/background tham chiếu, không mang PNG, tài nguyên ML hoặc nội dung web khác.

`npm.cmd run themes:sync` chạy `scripts/sync-theme-assets.mts`: lấy các đường dẫn từ `themes.ts`, sao chép ảnh tồn tại vào `mobile/assets/themes`, sinh import tĩnh `src/theme/assets.ts` để Metro đóng gói và [manifest dung lượng/ảnh thiếu](THEME_ASSETS.json). Test so SHA-256 xác nhận bản mobile đúng byte nguồn web. Sau khi web thêm ảnh/theme, chạy lại script rồi kiểm tra export. Danh mục server có ID mới chưa có định nghĩa web/asset mobile vẫn hiển thị trạng thái chưa hỗ trợ.

Các chức năng dùng React Native/Expo đã có, phù hợp Expo Go đúng SDK; không thêm native module. Export đã chứa 13 WebP. Chưa xác nhận decode/crop/readability thực trên Android/iPhone.

## Kiểm tra

- `npm.cmd run check`: typecheck, lint, test, locale/nhãn JSX mobile.
- `npm.cmd run export:check`: bundle Android và iOS, không phải phát hành lên cửa hàng.
- Trong `frontend/`: `npm.cmd run i18n:check`.
- Trong `backend/`: `venv\Scripts\python.exe -m pytest tests/test_rewards.py -q -p no:cacheprovider`.

Test mobile bổ sung trong `tests/shop.test.ts`: ghép đủ danh mục/giá server/ID thiếu metadata; hai palette dùng cùng nguồn; quyền sở hữu và nền mặc định; tên/mô tả hai ngôn ngữ; hash/quota asset; xác nhận/số dư; bấm lặp; không đủ điểm; đổi quote; already-owned; timeout sau commit và trước commit; mất mạng khi đọc số dư; payload theme/background/reset nền; lỗi equip; chặn mutation khác khi đang mua.

**Typecheck, lint, 80 test mobile (17 test mới), khóa dịch web/mobile và export Android/iOS đạt.** 5 test rewards backend hiện có đã đạt trên **SQLite trong bộ nhớ**, không mua/đổi điểm tài khoản thật và không sửa backend. Chưa kiểm tra HTTP mua với tài khoản thật hoặc thao tác trên điện thoại; unit test/mock không thay thế checklist dưới đây.

## Checklist Android và iPhone

Chạy từng hàng trên cả hai hệ điều hành; ghi OS/Expo Go hoặc build, ngôn ngữ và mode. Dùng tài khoản thử được phép tiêu điểm.

| Kiểm tra | Android | iPhone | Kết quả mong đợi |
| --- | --- | --- | --- |
| Xem danh mục | [ ] | [ ] | Với catalog hiện tại: 3 theme, 13 nền; thấy cả chưa mua/đã mua/đang dùng; giá bằng API |
| Tải/làm mới/lỗi | [ ] | [ ] | Loading và lỗi rõ; kéo làm mới; mất mạng không làm trống quyền sở hữu đã biết một cách gây hiểu nhầm |
| Preview | [ ] | [ ] | Mỗi theme và nền đổi sáng/tối riêng; theme toàn app, số dư và lựa chọn server không đổi |
| Mua đủ điểm | [ ] | [ ] | Xác nhận có tên/giá/số dư trước-sau; hủy không mất điểm; đồng ý cập nhật đúng một lần và áp dụng ngay |
| Bấm liên tục | [ ] | [ ] | Không tạo nhiều giao dịch; không mua mục thứ hai khi đang xử lý mục đầu |
| Không đủ điểm | [ ] | [ ] | Hiện số thiếu, nút mua khóa; thay đổi điểm ở nơi khác rồi refresh phản ánh mới |
| Điểm/giá đổi khi xác nhận | [ ] | [ ] | Không dùng quote cũ; yêu cầu xác nhận lại, không tự mua bằng giá mới |
| Đã sở hữu | [ ] | [ ] | Dùng equip, không mua lại; lỗi already-owned do thiết bị khác vừa mua hiển thị và refresh được |
| Nền và theme | [ ] | [ ] | Theme đổi màu toàn app; mua/chọn nền đổi ảnh; trở về nền mặc định bằng nút riêng; đổi theme không làm mất nền đã chọn riêng |
| Light/dark/system | [ ] | [ ] | Mỗi theme đúng hai palette; theo hệ thống đổi khi OS đổi; nền mặc định sáng/tối theo theme |
| Các màn hình | [ ] | [ ] | Chat, Hằng ngày, Thư viện/editor, Ngữ pháp, Hồ sơ, Cài đặt, Kanji, Quiz/Flashcard, modal/header/tab đều dùng token mới; chữ đọc rõ trên ảnh |
| Đăng nhập lại/đổi máy | [ ] | [ ] | Theme/nền lấy lại từ server; mode giữ theo từng máy; tài khoản B không nhận lựa chọn của A |
| Vi/en và chữ dài | [ ] | [ ] | Tên/mô tả đúng shared locale; giá/trạng thái/modal dịch; không cắt mất tên, nút hoặc số dư khi font lớn/màn nhỏ/ngang |
| Mất mạng trước mua | [ ] | [ ] | Không tiêu điểm; lỗi kết nối rõ, không tự gửi lại |
| Mất phản hồi sau mua | [ ] | [ ] | Chỉ đọc lại; không POST lặp; nếu chưa xác định thì cảnh báo và khóa, khi quyền sở hữu được xác nhận thì phục hồi |
| ID/ảnh chưa hỗ trợ | [ ] | [ ] | Dùng fixture/mock server thử, không sửa API thật: mục vẫn hiện giá/trạng thái và lời giải thích; không mất điểm vào mục chưa render được |
| Linh vật thiếu | [ ] | [ ] | Thần Khê/Sakura báo thiếu file riêng; palette và nền vẫn mua/dùng được |

## File tạo/sửa

- Mới: `src/api/shop.ts`; `src/features/shop/{types,catalog,actions}.ts`; `src/theme/ThemeBackdrop.tsx`, `assets.ts`; `assets/themes/*.webp`; `scripts/sync-theme-assets.mts`; `tests/shop.test.ts`; tài liệu/manifest này.
- Sửa: `ThemeShopScreen`, `ThemeProvider`, `AccountThemeBridge`; `api/types.ts`, `api/phase3.ts`, `features/kanji/logic.ts`, `types/assets.d.ts`; hai locale mobile vi/en; `package.json` (chỉ thêm script, không thêm dependency).
- Nền/token: root/tab/auth/personal layouts; các screen có nền đặc trước đây; `ui.tsx` và `ChoiceSheet`/`NameDialog`/`DangerDialog`. Chỉ đổi token nền màn hình/lớp phủ, giữ surface card và hành vi nhập liệu.
- Cập nhật README. Không sửa giá, schema, endpoint hoặc file dịch/theme/ảnh của web/backend.
