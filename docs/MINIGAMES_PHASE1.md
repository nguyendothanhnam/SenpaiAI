# SenpaiAI — minigames đợt 1, Phần 1 + Phần 2

> Cập nhật sau bổ sung từ điển ngày 16/11/2026: catalog dùng chung đã được tạo lại bằng `scripts/build_minigame_catalog.py`. N5 hiện có 79 chữ có cách đọc/nghĩa, N4 có 166; Kanji rơi hỗ trợ N5/N4/N3. Các bảng số liệu và dòng checklist nói N4 bị khóa bên dưới phản ánh dữ liệu trước khi sửa, không còn áp dụng cho Kanji rơi. Ba trò dựa trên từ vựng vẫn chưa đủ dữ liệu N5/N4; không tạo từ giả để bù thiếu. Kiểm tra sau đồng bộ: 71 test logic chung, 14 test web và 107 test mobile đạt.

Phạm vi lần này: engine TypeScript thuần ở `shared-games/`, bốn minigame web và thẻ mới trên `/games`. Chưa thêm màn hình, tab hay luồng minigame vào Expo; đó là Phần 3. Các đường dẫn Quiz, Flashcard và `/games/kanji` cũ được giữ.

## Kiểm kê dữ liệu thật

Nguồn chính là `backend/app/data/kanji_dictionary.json`, đối chiếu nét qua `kanjivg_service.get_stroke_order_response`. Catalog offline chỉ trích dữ liệu từ nguồn chính này; không lấy câu ví dụ làm từ, không ghép dữ liệu cấp khác hoặc tự gán cấp từ fallback UI. Không sửa từ điển backend.

| Cấp | Kanji | Kanji có cách đọc | Kanji có nghĩa | Ví dụ có cách đọc | Từ đơn duy nhất hợp lệ | Có dữ liệu nét |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| N5 | 79 | 39 | 40 | 39 | 0 | 79 |
| N4 | 166 | 6 | 8 | 6 | 0 | 166 |
| N3 | 367 | 367 | 367 | 367 | 367 | 367 |
| N2 | 0 | 0 | 0 | 0 | 0 | 0 |
| N1 | 0 | 0 | 0 | 0 | 0 | 0 |

N5/N4 có câu ví dụ kèm cách đọc chứa dấu câu/khoảng trắng, không phải từ đơn hợp lệ cho chuỗi nối từ. Chữ có nét không đồng nghĩa có cách đọc hay từ vựng đủ dùng. Nét được kiểm đếm thực tế, không dựa vào trường `has_handwriting_data`.

Tái kiểm kê và dựng catalog từ thư mục gốc:

```powershell
.\venv\Scripts\python.exe -X utf8 scripts/build_minigame_catalog.py --audit
.\venv\Scripts\python.exe -X utf8 scripts/build_minigame_catalog.py
```

`shared-games/catalog.json` là snapshot dữ liệu duy nhất dùng cho game web và chuẩn bị cho Expo. Script có thể chạy lại khi từ điển được bổ sung. Không tạo dữ liệu giả để mở khóa cấp độ.

Ngưỡng ở `shared-games/availability.ts` (`MIN_DATA`): tối thiểu 12 mục mỗi trò; Mật mã cần thêm 8 từ phù hợp độ dài; Chuỗi nhớ cần ít nhất 4 Kana khác nhau; Kanji rơi cần ít nhất 4 đáp án khác nhau; Shiritori phải có điểm bắt đầu với một lựa chọn hợp lệ và ba lựa chọn nhiễu. Kiểm tra thực hiện lại theo độ khó, kiểu đáp án và bảng chữ.

| Trò | N5 | N4 | N3 | N2/N1 |
| --- | --- | --- | --- | --- |
| Kanji rơi — cách đọc / nghĩa | Mở | Khóa | Mở | Khóa |
| Shiritori chọn từ | Khóa | Khóa | Mở | Khóa |
| Mật mã Kana | Khóa | Khóa | Mở, cả 3 độ khó và 2 bảng chữ | Khóa |
| Chuỗi nhớ Kana | Khóa | Khóa | Mở, cả 3 độ khó và 2 bảng chữ | Khóa |

Nghĩa nguồn là tiếng Việt. Chế độ nghĩa ghi rõ điều này ở cả giao diện vi/en; không coi nghĩa tiếng Việt là bản dịch tiếng Anh.

## Luật và vòng đời

- `createRound` khởi tạo ván đang chơi; `reduceRound` xử lý tick, trả lời, gợi ý, tạm dừng, tiếp tục và kết thúc. State được cập nhật bất biến; seed tái lập giúp test. Input và đồng hồ bị khóa khi tạm dừng hoặc đã kết thúc.
- Dễ / Vừa / Khó có 4 / 3 / 2 mạng. Điểm và mạng không âm. Delta mỗi tick tối đa 250 ms để tránh bước nhảy quá lớn khi máy bị nghẽn. Web tạm dừng khi ẩn tab hoặc mất focus; không tự tiếp tục khi quay lại.
- **Kanji rơi:** 4 đáp án cùng JLPT, loại toàn bộ cách đọc được chấp nhận khỏi đáp án nhiễu. Điểm từ 50–150 theo thời gian còn lại. Tốc độ tăng theo cấp, độ khó và mỗi 5 lượt đúng; số chữ đồng thời tăng từ 1 đến tối đa 3. Đáp án sai hoặc chữ chạm đáy mất mạng. Click chọn chữ; phím 1–4 trả lời chữ đang có viền. Hoạt ảnh dùng CSS transform, hỗ trợ reduced motion.
- **Shiritori:** chuẩn hóa NFKC, Katakana về Hiragana. Kana nhỏ cuối từ đổi về chữ lớn tương ứng; `ー` lấy nguyên âm của âm trước (kể cả âm ghép như `ティー`, `キャー`). `ん` kết thúc chuỗi. Mỗi câu ban đầu có đúng một lựa chọn nối an toàn và ba từ nhiễu cùng cấp; từ đã nối không được xuất hiện lại. Chọn sai loại lựa chọn đó và mất mạng. Chọn từ nối được nhưng kết thúc bằng `ん` kết thúc ván. Hết lựa chọn hợp lệ hoặc không đủ bốn lựa chọn công bằng thì kết thúc với lý do hết dữ liệu, giữ điểm và không trừ mạng. Chuỗi lưu là số lượt nối đúng liên tiếp, không tính từ khởi đầu.
- **Mật mã:** bảng thay thế là song ánh, không chữ nào thay bằng chính nó. Ký tự lặp lại có cùng mã. Kana có dấu và dấu kéo dài trong từ đều có ánh xạ. Độ khó quy định độ dài và số ô mở sẵn; cấp cao giảm thêm số ô mở. Dải độ dài tăng sau mỗi 3 câu đúng, trong giới hạn dữ liệu và độ khó. Một gợi ý mở một vị trí, giảm 25 điểm thưởng của câu đó khi giải đúng, tối thiểu 10 điểm; không trừ ví và không trừ hai lần. Hoàn thành 10 từ kết thúc ván.
- **Chuỗi nhớ:** lưới 3×3 tối đa 9 Kana khác nhau lấy từ dữ liệu cấp đã chọn. Ban đầu 2 ô, mỗi lần hoàn thành thêm 1 ô; điểm bằng bình phương độ dài ×10. Tốc độ trình diễn theo cấp và độ khó. Chỉ nhận input sau khi trình diễn; sai mất mạng và xem lại cùng chuỗi. Đạt 16 ký tự kết thúc. Phím 1–9 hoặc click. Không âm thanh.

## Lưu trữ và công bằng

Engine không phụ thuộc DOM, React, React Native, mạng, đồng hồ hệ thống hay API thưởng. Chỉ adapter `frontend/src/features/minigames/storage.ts` truy cập `localStorage`.

- Khóa tài khoản: `senpaiai.minigames.v1.account:<id>`.
- Khóa thành tích: trò + JLPT + độ khó + kiểu đáp án/bảng chữ thích hợp. Điểm cao trên thẻ là cao nhất của trò; điểm cao trong ván là của cấu hình đang chơi.
- Lưu điểm cao, số ván, số lượt đúng/sai, chuỗi dài nhất, tổng thời gian chơi và số ván hoàn thành. Kết thúc cùng ván hai lần không cộng hai lần. Rời trang giữa ván lưu như ván đã kết thúc theo lựa chọn người chơi.
- Giữ tài khoản cũ và mới tách biệt trên cùng trình duyệt. Đổi ngôn ngữ không kết thúc ván hoặc đổi dữ liệu đang giải.
- Storage bị chặn/hết dung lượng có thông báo và thử lưu lại ở kết quả. Dữ liệu hỏng hoặc phiên bản tương lai không bị adapter ghi đè. Dữ liệu cục bộ có thể bị người dùng chỉnh sửa; không dùng làm tiền tệ, xếp hạng máy chủ hoặc chứng nhận thành tích.
- Không gọi endpoint cộng điểm, không đổi API/backend/database và không cài dependency mới.

## Tích hợp và lệnh kiểm tra

Web dùng route `/games/falling`, `/games/shiritori`, `/games/cipher`, `/games/memory`. Khung dùng chung là `GameFrame`. Bộ chọn dữ liệu không đủ sẽ bị khóa và nêu các cấp phù hợp.

Vite cho phép đọc `shared-games/`; TypeScript của web và Expo đều kiểm tra thư mục này. Metro thêm watch folder để lần sau import trực tiếp engine; không sao chép logic sang mobile. `shared-games/tsconfig.json` chỉ có thư viện ES2020, không có DOM. Test dùng TypeScript hiện có của frontend để biên dịch vào `tmp/`, không thêm test runner.

```powershell
# Trong frontend
npm.cmd run typecheck:games
npm.cmd run lint:games
npm.cmd run test:minigames
npm.cmd run lint
npm.cmd run i18n:check
node --test tests/*.test.mjs
npm.cmd run build

# Trong mobile: kiểm tra tính tương thích và hồi quy, chưa có màn hình minigame
npm.cmd run check
npm.cmd run export:check
```

Các file cũ được chỉnh callback/ref/dependency và cấu hình ESLint nhận biết TypeScript để bỏ lỗi lint có sẵn, giữ nguyên luật và luồng cũ. Scanner bổ sung `frontend npm run i18n:lint` còn phát hiện chữ hardcode ở các màn hình cũ (phỏng vấn, ngữ pháp, nhắc nhở, trò Kanji cũ…); không có phát hiện ở phần minigame mới. Kiểm tra khóa dịch `i18n:check` của web/mobile là kiểm tra bắt buộc và dùng chung `common.json` vi/en.

### Kết quả kiểm tra đợt này

| Kiểm tra | Kết quả |
| --- | --- |
| Engine TypeScript, chỉ ES2020, không DOM | Đạt |
| ESLint toàn frontend và `lint:games` | Đạt, không lỗi/cảnh báo |
| Unit test engine + adapter lưu trữ web | 40/40 đạt |
| Test web có sẵn (API client, đáp án quiz) | 2/2 tệp đạt |
| Test mới qua Vite SSR/React: setup, bốn trò vi/en, khóa N4, các link cũ | Đạt |
| Khóa dịch frontend `i18n:check` | Đạt |
| Mobile `check`: typecheck, lint, 94 test, khóa dịch, chữ UI | Đạt |
| Frontend production build | Đạt |
| Expo export Android + iOS | Đạt; đây là kiểm tra ứng dụng hiện có và cấu hình tương thích, chưa bao gồm UI game Phần 3 |
| `git diff --check` | Đạt |
| Scanner bổ sung toàn web `i18n:lint` | Chưa đạt do các nhãn hardcode cũ nêu trên; phần minigame mới không có phát hiện |

Test Vite dùng middleware và render phía máy chủ, không phải trình duyệt tương tác. Các cảnh báo SSR `useLayoutEffect` của React Router/Framer Motion là giới hạn của phép thử render. Build còn cảnh báo bundle lớn của frontend hiện tại; không có lỗi build. Không cài browser, game engine, native module hay dependency mới.

## Checklist thủ công

Chưa đánh dấu đã chạy trên trình duyệt tương tác hoặc thiết bị thật. Kiểm tra HTTP/bundle và unit test không thay thế thao tác thực tế.

| Hạng mục | Web | Android Expo | iPhone Expo |
| --- | --- | --- | --- |
| Kanji rơi: N5 và N3, đọc/nghĩa, 3 độ khó; đáp án phím 1–4 và click | ☐ | Phần 3 | Phần 3 |
| Shiritori: N3, 3 độ khó; Kana nhỏ, kéo dài, `ん`, không lặp, hết từ | ☐ | Phần 3 | Phần 3 |
| Mật mã: N3, 3 độ khó × Hiragana/Katakana; gõ IME, Enter, bảng mã, gợi ý | ☐ | Phần 3 | Phần 3 |
| Chuỗi nhớ: N3, 3 độ khó × 2 bảng chữ; trình diễn, phím 1–9, bấm ô, mất mạng | ☐ | Phần 3 | Phần 3 |
| N4 bị khóa; N5 khóa với ba trò từ vựng; N2/N1 khóa; có số lượng và gợi ý cấp | ☐ | Phần 3 | Phần 3 |
| Tạm dừng rồi tiếp tục giữ nguyên đồng hồ, vị trí, chuỗi, đáp án đang gõ | ☐ | Phần 3: AppState | Phần 3: AppState |
| Đổi tab / mất focus tự tạm dừng; không lộ đáp án/chuỗi khi pause | ☐ | Phần 3 | Phần 3 |
| Kết thúc giữa ván, rời trang, đóng/mở lại, chơi lại, đổi cấp | ☐ | Phần 3: Back Android | Phần 3: cử chỉ Back |
| Điểm cao còn sau tắt/mở trình duyệt, hai tài khoản cùng máy tách biệt | ☐ | Phần 3 | Phần 3 |
| Storage bị chặn/hết dung lượng, lỗi lưu có thông báo, thử lại không nhân đôi ván | ☐ | Phần 3 | Phần 3 |
| Đổi vi/en trước và giữa ván, sáng/tối với mọi theme, màn hình nhỏ 320/360 px | ☐ | Phần 3 | Phần 3 |
| Quiz, Flashcard, Kanji cũ còn vào được; ví điểm không đổi sau ván | ☐ | ☐ các màn hình cũ | ☐ các màn hình cũ |

Khung thống kê, luật thuần, khóa dịch và cấu hình build đã sẵn sàng cho Phần 3; chưa tuyên bố kiểm chứng FPS, chạm đa điểm, rung phản hồi hoặc điều hướng game trên thiết bị thật.
