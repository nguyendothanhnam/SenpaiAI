# Minigame đợt 1 trên Expo

> Cập nhật sau bổ sung từ điển ngày 16/11/2026: catalog offline đã đồng bộ với bể API. N5 hiện có 79 chữ có cách đọc/nghĩa, N4 có 166; Kanji rơi hỗ trợ N5/N4/N3. Các bảng và checklist N4 bị khóa bên dưới là ghi nhận trước khi bổ sung dữ liệu; khi kiểm tra Kanji rơi cần thử cả N4. Ba trò dùng từ vựng vẫn chỉ hỗ trợ N3. Bộ kiểm tra mobile sau đồng bộ đạt 107 test, kiểu, lint và khóa dịch.

Phạm vi: Kanji rơi, Shiritori chọn từ, Mật mã Kana, Chuỗi nhớ Kana. Vào **Luyện tập → Trò chơi**. Không đưa năm trò đợt 2 lên mobile trong thay đổi này.

## Điều kiện đã kiểm tra

- Nhánh `mobile`; engine TypeScript thuần ở `../../shared-games`, test chạy được trước khi triển khai (62 test). Metro đã có watchFolder ngoài ứng dụng; bổ sung alias `@games/*` trong TypeScript và Metro. Không sao chép engine.
- Trước thay đổi, `PracticeScreen` chỉ render Ngữ pháp, Kanji và Quiz/Flashcard. Không thấy cờ tính năng cho Trò chơi trong component; đây là lối vào bị bỏ khỏi giao diện giai đoạn trước, nay thêm lại. Kanji cũ và bộ học giữ lối vào riêng.
- Có `StudyStore` theo tài khoản nhưng chưa có adapter AsyncStorage cho thống kê minigame. Adapter mới dùng schema/khóa/tính điểm cao của engine, phiên bản 1, ghi tuần tự theo tài khoản. Dữ liệu hỏng/khác phiên bản được giữ nguyên và báo lỗi; không tự reset. Có nút thử lưu lại sau lỗi dung lượng/quyền lưu trữ.

Kiểm kê trực tiếp từ dictionary mà API `/kanji/list` sử dụng, bằng `backend/venv/Scripts/python.exe scripts/build_minigame_catalog.py --audit`:

| Cấp | Kanji | Có cách đọc | Ví dụ có cách đọc | Từ độc lập hợp lệ | Có dữ liệu nét |
| --- | ---: | ---: | ---: | ---: | ---: |
| N5 | 79 | 39 | 39 | 0 | 79 |
| N4 | 166 | 6 | 6 | 0 | 166 |
| N3 | 367 | 367 | 367 | 367 | 367 |
| N2 | 0 | 0 | 0 | 0 | 0 |
| N1 | 0 | 0 | 0 | 0 | 0 |

N5/N4 chứa ví dụ dạng câu, không biến câu thành từ để bù dữ liệu. Ngưỡng chung là 12 mục; có thêm điều kiện số đáp án khác nhau, từ nối tiếp Shiritori, 8 từ đúng độ dài cho mật mã, 4 kana khác nhau cho trí nhớ. Hiện Kanji rơi hỗ trợ N5/N3, ba trò còn lại hỗ trợ N3. Kiểm tra ngưỡng dùng cả độ khó/chế độ/bảng chữ. Các dòng cấp thiếu dữ liệu vẫn xuất hiện trong bảng chọn kèm số lượng và bị vô hiệu hóa; màn hình gợi ý cấp khác.

## Luồng dữ liệu và lưu trữ

`PoolCache` gọi lớp `kanjiAPI.list` hiện có, phân trang 100 chữ, tải toàn bộ cấp trước khi tạo ván. Loại từ/cách đọc không hợp lệ, khử trùng lặp, giới hạn tổng dữ liệu, phát hiện trang không tiến triển. Những yêu cầu đồng thời dùng chung promise; lỗi không làm cache bị kẹt. Cache từ điển công khai trong bộ nhớ 10 phút, không chứa dữ liệu tài khoản và không tồn tại sau khi tắt ứng dụng.

Engine nhận `RoundPool` tùy chọn ở đối số cuối `createRound`; ván giữ bể này cho mọi lượt tiếp theo. Không fallback sang catalog đóng gói khi API trả thiếu dữ liệu. Chưa có pool thì không chơi offline; ván đã chuẩn bị tiếp tục được khi mất mạng. Kana được rút từ cách đọc của từ đã tải bằng chính engine, không cần endpoint kana mới. Không gọi API từ UI trả lời hoặc reducer. Test dùng chính dictionary làm phản hồi API giả lập; chưa kiểm chứng kết nối server thật/tài khoản thật trong lần này.

AsyncStorage dùng khóa `senpaiai.minigames.v1.account:<id>` và `statsKey(game, level, difficulty, variant)`. Biến thể đọc/nghĩa, hiragana/katakana lưu riêng. Thẻ tổng hợp hiển thị điểm cao nhất của trò; màn hình thiết lập/kết thúc dùng đúng cấp/độ khó/biến thể. Lưu số ván, đúng/sai, chuỗi dài nhất, thời gian và số ván hoàn thành. Ván thoát chủ động được kết thúc và lưu; ghi lặp cùng ván không tăng thống kê hai lần. Không có API ví hoặc cộng điểm. Không đồng bộ với web/thiết bị khác. Buộc tắt ứng dụng giữa ván không khôi phục ván dở; các kỷ lục đã lưu vẫn giữ.

## Vòng đời và hiệu năng

- `AppState` inactive/background tạm dừng, gồm cuộc gọi khi hệ điều hành chuyển ứng dụng sang inactive. Quay lại không tự chạy tiếp; phải chạm Tiếp tục.
- Android Back/header Back dùng `usePreventRemove`: tạm dừng, hỏi xác nhận, kết thúc và thử lưu trước khi chuyển trang. Nếu lưu lỗi giữ màn kết quả để thử lại. Vuốt quay lại iPhone bị khóa khi ván đang chơi hoặc tạm dừng; dùng nút Back/Thoát để xác nhận.
- Kanji rơi tối đa 3 đối tượng theo engine. `Animated.Value` + native driver chạy chuyển động, không setState theo từng khung hình; đồng hồ luật chơi 10 Hz. Các trò mật mã/nối từ không render lại do tick đồng hồ. Timer và hoạt ảnh dừng khi tạm dừng/unmount.
- Mật mã chỉ có bàn phím kana nội bộ; xóa và hoàn tác thuộc trạng thái nhập, gợi ý/chấm điểm thuộc engine. Không có TextInput/bàn phím hệ thống.
- Chuỗi nhớ dùng nhịp từ engine, có khoảng tắt giữa hai lần sáng; rung Light khi trả lời nếu Expo Haptics hỗ trợ. Không âm thanh, không blur hoặc bóng đổ trong giao diện trò chơi.
- Theo dõi Reduce Motion của hệ điều hành: Kanji đứng yên, có đếm ngược; thời hạn/luật/điểm giữ nguyên. Lưới nhớ chỉ đổi màu/viền, không phóng to hay di chuyển.
- Safe area bên dưới/hai bên, header native; nút ít nhất 48 điểm. Đáp án rơi 2×2 ở đáy, trò bàn phím/lưới dùng cuộn khi màn hình thấp.

Chưa quan sát FPS, nóng máy, pin hoặc khác biệt độ mượt Android/iPhone vì không có thiết bị/simulator tương tác trong phiên làm việc. Không tuyên bố đã đạt 60 FPS trên máy tầm trung. Nếu đo thấy giật, ưu tiên giảm nhịp cập nhật giao diện xuống 5 Hz (giữ đồng hồ luật), memo hóa ô kana; dùng Reduce Motion để tắt chuyển động rơi. Hiện chưa xác định trò nào không đạt hiệu năng trên thiết bị thật.

## Kiểm tra tự động

Chạy từ thư mục được chỉ định:

```powershell
# mobile/
npm.cmd run check
npm.cmd run export:check
# frontend/ (chỉ chạy kiểm tra, không sửa web)
npm.cmd run test:minigames
npm.cmd run i18n:check
```

Typecheck, ESLint, test mobile, test engine và khóa dịch vi/en dùng chung phải xanh. Test mới kiểm tra pool thật phân trang/cache/lỗi mạng/không fallback, hoàn thành ván không gọi mạng, tạm dừng cả bốn trò, điểm cao sau mở lại/hai tài khoản/ghi đồng thời/dữ liệu hỏng/phiên bản tương lai/lỗi lưu. Export là tạo bundle Android/iOS, không phải build APK/IPA hoặc phát hành lên cửa hàng.

Kết quả tự động ngày 16/11/2026: typecheck và ESLint đạt; **102/102 test mobile**, **66/66 test engine** đạt; khóa dịch web/mobile và kiểm tra chữ JSX mobile đạt. Expo export thành công cho Android và iOS, mỗi bundle Hermes khoảng **5,3 MB**. Các test API dùng phản hồi giả lập từ dữ liệu dictionary thật; test AsyncStorage dùng adapter bộ nhớ với lỗi được tiêm vào, không thay cho kiểm tra lưu trữ trên thiết bị.

## Checklist nghiệm thu Android và iPhone

Các ô dưới đây **chưa được thực hiện trên thiết bị thật**. Lặp lại riêng trên Android tầm trung và iPhone nhỏ, ở cả vi/en và sáng/tối.

| Trò và tình huống | Android | iPhone |
| --- | --- | --- |
| Kanji rơi: N5/N3, cả ba độ khó, đọc/nghĩa; chọn từng chữ khi có 2–3 chữ; đáp án không khuất; thời hạn, mạng và tăng tốc đúng | ☐ | ☐ |
| Kanji rơi: N4/N2/N1 bị khóa và giải thích; Reduce Motion đứng yên nhưng đếm ngược/mất mạng vẫn đúng | ☐ | ☐ |
| Shiritori: N3 cả ba độ khó; cách đọc/âm cuối/lý do đúng sai; 4 lựa chọn; đáp án sai không chọn lặp; chuỗi dài nhất | ☐ | ☐ |
| Shiritori: âm nhỏ, âm dài, kết thúc ん/hết từ; N5/N4/N2/N1 thiếu dữ liệu | ☐ | ☐ |
| Mật mã: N3 ba độ khó × hai bảng chữ; giải đủ 10 từ; chữ gợi ý khóa; gợi ý trừ điểm; xóa/hoàn tác; không mở IME | ☐ | ☐ |
| Mật mã: N5/N4/N2/N1 thiếu dữ liệu; bảng mã/lưới bàn phím cuộn được trên máy nhỏ | ☐ | ☐ |
| Chuỗi nhớ: N3 ba độ khó × hai bảng chữ; nhịp sáng, lặp cùng kana, nhập đúng/sai, mạng/điểm/rung; không nhận chạm lúc trình chiếu | ☐ | ☐ |
| Chuỗi nhớ: N5/N4/N2/N1 thiếu dữ liệu; Reduce Motion; rung không hỗ trợ vẫn chơi được | ☐ | ☐ |

Áp dụng **riêng cho từng trò ở bảng trên**:

| Kiểm tra xuyên suốt | Android | iPhone |
| --- | --- | --- |
| Đổi cấp/độ khó/bảng chữ qua bảng trượt; không chọn được cấp thiếu dữ liệu | ☐ | ☐ |
| Home/chuyển app/khóa máy rồi quay lại: thời gian/mạng/chuỗi đứng yên, tiếp tục thủ công | ☐ | ☐ |
| Nhận/từ chối/kết thúc cuộc gọi lúc đang chơi và lúc đang chuẩn bị | ☐ | ☐ |
| Back hệ thống/header/Thoát: hỏi xác nhận, hủy vẫn tạm dừng; đồng ý lưu rồi rời | ☐ | ☐ |
| Vuốt cạnh/gestural back khi chơi/tạm dừng không thoát nhầm; sau kết thúc quay lại bình thường | ☐ | ☐ |
| Hoàn thành, chơi lại, đổi cấp; kỷ lục không giảm; đóng/mở app vẫn còn | ☐ | ☐ |
| Hai tài khoản trên một máy, đăng xuất/đăng nhập lại; thống kê không lẫn | ☐ | ☐ |
| Mất mạng lần chuẩn bị đầu → báo lỗi/Thử lại/Quay về; mất mạng giữa ván vẫn chơi; lần sau dùng cache | ☐ | ☐ |
| Mất mạng rồi rời màn chuẩn bị: kết quả tải muộn không khởi tạo ván trên màn khác | ☐ | ☐ |
| Bộ nhớ đầy/lỗi đọc/schema hỏng: báo lỗi, dữ liệu cũ không bị ghi đè; thử lưu lại khi khắc phục | ☐ | ☐ |
| vi/en, sáng/tối, cỡ chữ hệ thống, màn hình nhỏ/dọc/ngang; nút chạm và safe area | ☐ | ☐ |
| Reduce Motion bật trước khi mở và bật/tắt trong ván; dừng timer khi rời màn | ☐ | ☐ |
| Chơi liên tục 10 phút, đo FPS/JS/UI, nhiệt/pin, ghi model/OS; so sánh 2 hệ điều hành | ☐ | ☐ |

Ghi nhận thực nghiệm: model/OS/Expo Go, game/cấp/độ khó, FPS/UI-JS nếu có công cụ đo, thời lượng, nhiệt quan sát, pin trước/sau, lỗi cử chỉ/call và ảnh màn hình. Không suy ra hiệu năng thiết bị từ tốc độ test trên máy tính.
