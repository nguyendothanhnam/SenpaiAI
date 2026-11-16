# Minigame Đợt 2 — Expo

Vào **Luyện tập → Trò chơi**. Năm trò mới dùng cùng màn hình thiết lập/kết quả, ChoiceSheet, khung vòng đời, bộ nạp dữ liệu và lưu điểm của Đợt 1. Các trò Đợt 1 vẫn giữ nguyên lối vào. Không sửa mã web/backend, không cài dependency, không gọi API cộng điểm hay ví.

## Kiểm tra nền trước triển khai

- Mobile Đợt 1: typecheck, lint, 102 test và dịch vi/en đạt trước khi sửa. Có tổng hợp bốn trò, khung bắt đầu/tạm dừng/kết thúc, AsyncStorage theo tài khoản và pool API trước ván. Đây là xác nhận tự động/mã nguồn; chưa mở trên điện thoại thật trong phiên này.
- Engine dùng chung có đủ `battle.ts`, `workshop.ts`, `wordsearch.ts`, `ninja.ts`, `missing-stroke.ts` và test; 66 test đạt trước khi sửa.
- Metro và TypeScript đã đọc trực tiếp `shared-games` qua alias `@games/*`; không sao chép luật chơi vào mobile.

Kiểm kê từ `backend/app/data/kanji_dictionary.json` và KanjiVG, nguồn của API hiện có:

| Cấp | Kanji | Ví dụ có cách đọc | Từ độc lập | Từ có ≥2 kanji | Cặp nghĩa phân biệt | Từ ghép toàn kanji cùng cấp | Có nét |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| N5 | 79 | 39 | 0 | 0 | 0 | 0 | 79 |
| N4 | 166 | 6 | 0 | 0 | 0 | 0 | 166 |
| N3 | 367 | 367 | 367 | 293 | 362 | 97 | 367 |
| N2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| N1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Ngưỡng chung 12 mục và điều kiện riêng của engine; không biến câu ví dụ thành từ để bù dữ liệu:

| Trò | Cấp hỗ trợ | Số mục dễ / thường / khó |
| --- | --- | --- |
| Nối từ đánh quái | N3 | 362 / 362 / 362 cặp nghĩa phân biệt |
| Xưởng ghép từ | N3 | 97 / 97 / 97 từ ghép cùng cấp |
| Tìm từ ẩn | N3 | 291 / 339 / 342 cách đọc hợp lệ |
| Ninja chém từ | N3 | 367 / 367 / 367 từ |
| Kanji mất nét | N5 | 64 / 78 / 34 chữ |
| Kanji mất nét | N4 | 84 / 160 / 133 chữ |
| Kanji mất nét | N3 | 141 / 341 / 331 chữ |

Kanji mất nét lọc theo số nét: dễ 2–8, thường 2–14, khó 6–40; engine còn kiểm tra đủ phương án nhiễu phân biệt. N2/N1 bị khóa ở mọi trò. N5/N4 bị khóa ở bốn trò dùng từ. Bộ chọn hiển thị số mục và lý do, kiểm tra lại pool thực tế trước khi tạo ván.

## Dữ liệu, lưu trữ và luật dùng chung

`RoundPool` thêm trường nét tùy chọn. Các hàm lọc dữ liệu, tạo câu và tạo lượt tiếp theo của Đợt 2 nhận cùng pool của ván. Không lấy ngầm từ catalog nếu đã truyền pool thiếu dữ liệu. Lời gọi cũ không truyền pool của web giữ nguyên; test bảo vệ cả trường hợp `LEVELS.flatMap(compoundsFor)` của adapter web.

Native dùng `/kanji/list` qua `kanjiAPI.list`, tải phân trang toàn cấp trước ván, cache trong RAM 10 phút. Dữ liệu nét vector đã đóng gói trong **kho chung**, lọc theo cấp và danh sách kanji vừa nạp API. Không sao chép asset nét, không tải từng nét giữa ván. Chữ mới trên server chưa có nét trong catalog sẽ không được đưa vào trò mất nét. Nếu generator không tạo được bàn hợp lệ, màn chuẩn bị báo lỗi và cho thử lại/quay về; không tạo ván một phần. Test dùng dictionary thật làm phản hồi API giả lập; chưa gọi server/tài khoản thật trong phiên này.

Điểm cao/thống kê dùng `GameStore` phiên bản 1 theo tài khoản, trò, cấp, độ khó và biến thể. Không đồng bộ sang web/thiết bị khác. `RecipeStore` lưu dưới khóa tài khoản có hậu tố `:recipes`, schema `{version:1, recipes:string[]}`. Công thức được lưu sau mỗi lượt ghép đúng, không đợi kết thúc ván; dùng `mergeRecipes` chung để chỉ nhận từ hợp lệ, khử trùng và ghi tuần tự. Giữ công thức cũ từ cấp/phiên bản từ điển khác. Xem lại ngay trong màn Xưởng, kể cả trước khi bắt đầu ván. Dữ liệu hỏng/phiên bản tương lai không bị ghi đè; lỗi đọc/ghi được báo và có thử lại khi còn ván. Bộ nhớ đầy có thể khiến công thức mới chưa lưu được; cần thử lại trước khi rời màn hình.

## Giao diện và vòng đời

- **Đánh quái:** hai cột từ/nghĩa, nút chạm lớn, chọn từ rồi nghĩa; thanh máu, màn, boss, combo và sát thương. Hiệu ứng sát thương chỉ đổi opacity bằng native driver; Reduce Motion tắt hiệu ứng này.
- **Xưởng:** chạm thẻ để thêm chữ, hỗ trợ chữ lặp bằng ID thẻ riêng; xóa một/xóa hết/nộp. Chưa triển khai kéo thả; chạm là cách thao tác chính.
- **Tìm từ ẩn:** PanResponder có sẵn trong React Native; tọa độ màn hình được đổi về ô, đường kéo tự khớp ngang/dọc/chéo rồi gửi `selectPath` cho engine. Không tự chấm tại UI. Khóa cuộn khi nhận cử chỉ, mở lại khi thả/hủy/tạm dừng; từ đã tìm được tô nền và gạch danh sách gợi ý. Rung Light khi tìm đúng nếu Expo Haptics hỗ trợ.
- **Ninja:** cùng PanResponder; tọa độ và mốc thời gian ván được gửi tới hàm va chạm chung qua reducer. Giữ tối đa 19 điểm vệt chém, SVG đơn giản và opacity fade 220 ms. Vị trí từ dùng `Animated.Value`, native driver và mẫu quỹ đạo `flyingPosition` chung; component từ được memo hóa, không setState vị trí theo từng khung hình. Engine giới hạn tối đa 4 từ. Reduce Motion tắt vệt chém; chuyển động bay vẫn giữ vì là phần cốt lõi của trò chơi.
- **Mất nét:** react-native-svg đã có trong dự án. Nét thiếu có chỉ dẫn nét đứt; bốn lựa chọn SVG trong nút/thẻ lớn, chỉ nhận glyph có đường nét. Ghi nguồn KanjiVG và giấy phép; xem [giấy phép kho nét](../../shared-games/KANJIVG_LICENSE.md).
- Khung chung tạm dừng khi inactive/background, khi màn hình mất focus; không tự tiếp tục. Android Back/header Back hỏi xác nhận; iPhone khóa vuốt quay lại khi ván đang chơi/tạm dừng, nút Back/Thoát vẫn xác nhận. Chờ lưu trước khi chuyển trang.
- Safe area và token theme dùng khung sẵn có, sáng/tối; khu vực bàn chơi giới hạn bề ngang 640 điểm trên tablet, lưới co theo màn hình. Nút thao tác ít nhất 48 điểm. Ô lưới tìm từ nhỏ hơn nút riêng lẻ trên điện thoại nhỏ; thao tác chính là vuốt theo đường.
- Đồng hồ luật 10 Hz; các trò không có hoạt ảnh/thời hạn cần hiển thị không render lại chỉ vì tick. Timer/hoạt ảnh dừng khi tạm dừng/unmount. Không âm thanh, blur hoặc bóng đổ trong bàn chơi.

## Kiểm tra tự động

```powershell
# mobile/
npm.cmd run check
npm.cmd run export:check
# frontend/ — chỉ kiểm tra, không sửa web
npm.cmd run test:minigames
npm.cmd run i18n:check
node node_modules/typescript/bin/tsc --noEmit
```

Các nhóm test mới: pool thực tế theo cấp/độ khó của cả năm trò; không fallback dữ liệu khi tạo lượt tiếp theo; chơi hết ván bằng pool; chuyển tọa độ và khớp đường vuốt; tạm dừng chặn thời gian và input; công thức sau mở lại, hai tài khoản, ghi đồng thời, dữ liệu hỏng/khác phiên bản/lỗi ghi và thử lại. Test adapter dùng storage bộ nhớ, không thay cho AsyncStorage trên thiết bị.

Kết quả tự động ngày 16/11/2026: **107/107 test mobile**, **71/71 test engine**, typecheck/lint mobile và khóa dịch web/mobile đạt. Typecheck web và **3/3 tệp test web** đạt, bao gồm render hub/trò chơi vi/en và giữ lối vào cũ. Test SSR web có cảnh báo `useLayoutEffect` và cổng WebSocket HMR đang bận; tiến trình vẫn kết thúc với mã 0. Expo export Android/iOS thành công; bundle Hermes khoảng **5,3 MB Android / 5,4 MB iOS**. Đây là export bundle, không phải build APK/IPA hoặc phát hành lên cửa hàng.

## Hiệu năng quan sát được và giới hạn nghiệm thu

Môi trường hiện tại là Windows, không có ADB trong PATH hoặc Android SDK mặc định, không có iPhone/simulator tương tác. **Chưa đo FPS, nhiệt hoặc pin của bất kỳ trò nào trên thiết bị thật**, chưa có kết quả so sánh Android/iOS. Không dùng tốc độ unit test hay export để suy ra độ mượt. Năm trò có trong hub để kiểm thử; chưa xác nhận đạt hiệu năng phát hành trên máy tầm trung. Chưa phát hiện trò không đạt bằng phép đo thiết bị vì chưa có phép đo đó.

| Trò | Android thật | iPhone thật | Phương án giảm tải nếu đo thấy không đạt |
| --- | --- | --- | --- |
| Đánh quái | Chưa đo | Chưa đo | Tắt hiệu ứng sát thương, memo hóa các cặp thẻ |
| Xưởng ghép từ | Chưa đo | Chưa đo | Giữ thao tác chạm; hạn chế cập nhật phần sưu tầm |
| Tìm từ ẩn | Chưa đo | Chưa đo | Memo hóa từng ô, chỉ cập nhật đường chọn khi đổi ô |
| Ninja | Chưa đo | Chưa đo | Tắt vệt chém, giới hạn vệt ít điểm hơn; nếu vẫn không đạt, ẩn thẻ Ninja đến khi sửa xong |
| Mất nét | Chưa đo | Chưa đo | Memo hóa SVG/chỉ render phương án hiện tại; giữ giới hạn số nét theo engine |

Nếu kiểm tra thực tế phát hiện một trò giật/thoát sai/chọn sai, bỏ thẻ và chặn route của trò đó trước khi phát hành; không thay luật hoặc âm thầm giảm độ khó để giữ cùng bảng điểm. Ưu tiên nghiệm thu ba trò đầu, sau đó Ninja và Mất nét.

## Checklist riêng cho Android và iPhone

Mọi ô **chưa kiểm trên thiết bị thật**. Lặp lại cả vi/en, sáng/tối, điện thoại nhỏ và tablet; ghi model/OS/Expo Go, số FPS nếu có công cụ, thời lượng, nhiệt quan sát và pin trước/sau.

| Trò — tình huống | Android | iPhone |
| --- | --- | --- |
| Đánh quái: N3, dễ/thường/khó; chọn hai thẻ, ghép sai mất mạng, ghép đúng gây sát thương, combo trong/ngoài 5 giây | ☐ | ☐ |
| Đánh quái: hết thẻ đổi bàn, boss màn 3/5, thắng boss cuối, đòn quái và thua khi hết mạng | ☐ | ☐ |
| Đánh quái: N5/N4/N2/N1 bị khóa; thẻ nghĩa dài không khuất và đủ chạm | ☐ | ☐ |
| Xưởng: N3 ba độ khó; chữ lặp, thẻ nhiễu, xóa/xóa hết/nộp sai/đúng, đủ 8 từ | ☐ | ☐ |
| Xưởng: công thức lưu ngay, không trùng, xem lại trước ván/sau tắt mở; hai tài khoản tách biệt | ☐ | ☐ |
| Xưởng: N5/N4/N2/N1 bị khóa, lỗi bộ nhớ và nút thử lưu lại | ☐ | ☐ |
| Tìm từ: N3 ba độ khó × hai bảng kana; ngang/dọc/chéo, kéo hơi lệch tự khớp, đảo chiều ở khó | ☐ | ☐ |
| Tìm từ: khóa cuộn khi vuốt, thả/hủy mở cuộn, đi ra ngoài lưới, tạm dừng giữa cử chỉ | ☐ | ☐ |
| Tìm từ: tô từ tìm được, gợi ý nghĩa, rung đúng, tìm lại không cộng điểm; N5/N4/N2/N1 bị khóa | ☐ | ☐ |
| Ninja: N3 ba độ khó × đọc/nghĩa; quỹ đạo/tốc độ, chém đúng/sai, bỏ lỡ, nhiều từ đồng thời | ☐ | ☐ |
| Ninja: vuốt nhanh/chậm/liên tục/nhiều điểm, đổi hướng, ra ngoài arena, khóa cuộn và hủy vuốt | ☐ | ☐ |
| Ninja: vệt tự mờ, Reduce Motion tắt vệt, tạm dừng dừng cả từ/vệt; N5/N4/N2/N1 bị khóa | ☐ | ☐ |
| Mất nét: N5/N4/N3 × ba độ khó; nét đứt, bốn SVG, chọn sai/đúng, đủ 10 chữ và điểm theo thời gian | ☐ | ☐ |
| Mất nét: chữ không có nét không xuất hiện; N2/N1 bị khóa; SVG rõ ở sáng/tối và màn hình nhỏ | ☐ | ☐ |

Áp dụng **riêng cho từng trò**:

| Hành vi chung | Android | iPhone |
| --- | --- | --- |
| Chuẩn bị pool; mất mạng trước ván báo lỗi/thử lại/quay về; mất mạng trong ván vẫn chơi | ☐ | ☐ |
| Tạm dừng thủ công, Home/chuyển app/khóa máy/cuộc gọi; quay lại không tự chạy | ☐ | ☐ |
| Back hệ thống/header/Thoát: xác nhận, hủy vẫn dừng; đồng ý lưu và quay lại | ☐ | ☐ |
| Cử chỉ cạnh không thoát nhầm khi chơi; sau kết thúc quay lại bình thường | ☐ | ☐ |
| Kết quả/chơi lại/đổi cấp; điểm cao còn sau tắt mở, không giảm, hai tài khoản không lẫn | ☐ | ☐ |
| Chuyển ngôn ngữ, sáng/tối, Reduce Motion trước và giữa ván | ☐ | ☐ |
| Safe area, máy nhỏ/tablet, chữ lớn; vuốt/scroll không xung đột | ☐ | ☐ |
| Đo từng trò ít nhất 5 phút trên máy tầm trung, ghi FPS/nhiệt/pin và khác biệt OS | ☐ | ☐ |

Ghi riêng lỗi chỉ có trên Android hoặc iPhone, trạng thái cử chỉ khi có cuộc gọi, và trò bị ẩn nếu chưa đạt. Chưa đánh dấu bất kỳ mục thiết bị nào là đã đạt trong lần triển khai này.
