# SenpaiAI — minigame đợt 2, Phần 1 + Phần 2

Thực hiện trong checkout nhánh `mobile`: engine TypeScript dùng chung và năm trò web. **Phần 3 chưa triển khai**: chưa thêm màn hình game, gesture native hay lối vào mới trong Expo. Không đổi API/backend, không thêm dependency, không cộng điểm vào ví, không có âm thanh.

## Điều kiện đầu vào: đợt 1

Trước khi viết code đã xác nhận tồn tại engine, `GameFrame`, hub và bốn trò đầu. Chạy lại 40 test engine/lưu trữ, Vite/React render vi/en và production build đều đạt. Đây là kiểm tra tự động, không phải tuyên bố đã chơi trên trình duyệt tương tác hoặc thiết bị thật.

Quiz, Flashcard, Kanji cũ và bốn trò đợt 1 giữ các lối vào và được kiểm tra hồi quy. Yêu cầu này chưa bao gồm commit/push.

## Kiểm kê dữ liệu thật

Nguồn: `backend/app/data/kanji_dictionary.json`, đối chiếu nét bằng `kanjivg_service` và tài nguyên KanjiVG có sẵn. Không dựa vào cờ `has_handwriting_data`, không cắt câu ví dụ thành từ hoặc tự gán cấp.

| Cấp | Từ đơn có đọc | Cặp từ–nghĩa | Nghĩa khác nhau | Từ có ≥2 Kanji | Từ toàn Kanji, mọi chữ cùng cấp | Có nét mẫu | Có ≥2 nét |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| N5 | 0 | 0 | 0 | 0 | 0 | 79 | 78 |
| N4 | 0 | 0 | 0 | 0 | 0 | 166 | 166 |
| N3 | 367 | 367 | 362 | 293 | 97 | 367 | 367 |
| N2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| N1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

N5/N4 có câu ví dụ đầy đủ nhưng không có từ đơn hợp lệ trong nguồn này. Xưởng dùng 97 từ ghép nghiêm ngặt của N3, đảm bảo cả các chữ đúng và thẻ nhiễu cùng cấp. Bảng đánh quái loại nghĩa trùng, còn 362 cặp lựa chọn. Có 612 glyph, tổng cộng 5.452 path, đều dùng viewBox `0 0 109 109`.

Tái kiểm kê và dựng lại catalog từ thư mục gốc:

```powershell
.\venv\Scripts\python.exe -X utf8 scripts/build_minigame_catalog.py --audit
.\venv\Scripts\python.exe -X utf8 scripts/build_minigame_catalog.py
```

`shared-games/catalog.json` thêm nghĩa từ và metadata nét. `stroke-catalog.json` chứa path; `KANJIVG_LICENSE.md` giữ tác giả và CC BY-SA 3.0. Trò mất nét cũng hiển thị liên kết ghi công.

## Cấp độ mở

Ngưỡng trong `shared-games/availability.ts`: tối thiểu 12 mục hợp lệ, cộng điều kiện riêng theo độ khó/chế độ. Không trộn cấp để lấp dữ liệu thiếu.

| Trò / route | Cấp có thể chơi | Điều kiện |
| --- | --- | --- |
| Nối từ đánh quái — `/games/battle` | N3 | Các nghĩa trong bảng khác nhau |
| Xưởng ghép từ — `/games/workshop` | N3 | Từ toàn Kanji ≥2 chữ; mọi thẻ cùng cấp |
| Tìm từ ẩn — `/games/wordsearch` | N3 | Kana dài 3–7 tùy độ khó, cách đọc không trùng |
| Ninja chém từ — `/games/ninja` | N3 | Đủ nhóm đáp án đọc/nghĩa để sinh nhiễu |
| Kanji mất nét — `/games/missing` | N5, N4, N3 | Dễ: 2–8 nét; Vừa: 2–14; Khó: 6–40; đủ nét nhiễu phân biệt |

Các cấp không đủ bị khóa, hiện số lượng và gợi ý cấp phù hợp. Nghĩa học liệu hiện là tiếng Việt; có thông báo rõ trong cả giao diện vi/en.

## Luật và cách triển khai

### Nối từ đánh quái

Chọn từ bên trái rồi chọn nghĩa bên phải. Bảng có 3/4/5 cặp theo độ khó. Đúng gây 25 sát thương, combo tăng thêm 5 mỗi bậc, tối đa 50. Combo được giữ khi cặp đúng tiếp theo nằm trong 5 giây chơi thực. Sai mất mạng và reset combo.

Có 5 màn, boss ở màn 3 và 5 với máu gấp đôi; máu tăng theo màn/cấp. Hết đồng hồ tấn công bị mất một mạng. Hết bảng mà quái còn máu thì thay bảng, giữ máu và thời gian tấn công còn lại. Hạ boss cuối thắng; hết mạng thua. Cặp đã ghép và thao tác thuộc bảng cũ không tính lại.

### Xưởng ghép từ

Ghép từ mục tiêu dựa trên nghĩa và cách đọc. Thẻ trùng chữ có ID riêng, mỗi thẻ dùng một lần. Có 2/4/6 thẻ nhiễu, không chứa các chữ đúng của mục tiêu. Hỗ trợ hoàn tác và xóa chọn. Chỉ chấp nhận từ đúng mục tiêu và có trong từ điển.

Đúng nhận `60 × số chữ`, lưu công thức ngay; sai mất mạng. Hoàn thành 8 từ thắng. Công thức hiển thị trong bộ sưu tập ngay cả sau khi mở lại ứng dụng web.

### Tìm từ ẩn

Lưới Dễ/Vừa/Khó có kích thước 8/9/10 và 4/5/6 từ. Mỗi bảng có hàng, cột và đường chéo; Khó cho đảo chiều. Hỗ trợ Hiragana và Katakana.

Loại từ đồng âm, palindrome và các mục tiêu chứa nhau/đảo của nhau. Sau mỗi lần đặt và sau khi lấp, quét tám hướng và yêu cầu mỗi từ mục tiêu có đúng một vị trí vật lý. Chữ lấp lấy từ Kana của dữ liệu cùng cấp, loại chữ đã xuất hiện trong mục tiêu để không tạo thêm bản sao mục tiêu. Bảo đảm này dành cho danh sách nhiệm vụ, không tuyên bố loại mọi từ tiếng Nhật có thể vô tình xuất hiện ngoài danh sách.

Đường chọn phải liên tục, thẳng, đúng tọa độ. Đúng nhận `30 × độ dài`; đủ danh sách thắng. Chọn lại từ đã tìm không được tính thêm và không mất mạng. Đường thẳng sai mất mạng; thao tác ngắn/hủy kéo không phạt. Web dùng Pointer Events, có thêm phím mũi tên và Enter/Space để chọn hai đầu.

### Ninja chém từ

Mỗi đợt giữ một yêu cầu đọc/nghĩa, có đúng một mục tiêu và các từ nhiễu cùng cấp; mọi từ có kiểu hiển thị giống nhau. Không đổi yêu cầu khi còn từ bay. Chém đúng nhận 50–150 điểm theo thời gian còn lại, sai hoặc bỏ lỡ mục tiêu mất mạng; bỏ qua từ sai không phạt. Dễ/Vừa/Khó cần 8/12/16 lần đúng.

Quỹ đạo parabol, tốc độ tăng theo cấp/độ khó/tiến độ, tối đa bốn từ. Va chạm thuần dùng tọa độ 0–100, đoạn chém và chuyển động theo timestamp; cắt đường theo vùng nhìn thấy để không chém nhầm từ còn ngoài khung. Từ bị chém được xóa ngay, không ghi điểm hai lần. Từ chối NaN, timestamp tương lai và đường quá dài.

Web xử lý chém ngay trong lúc kéo; vệt tối đa 32 điểm, va chạm theo đoạn ngắn. Hiển thị dùng SVG và requestAnimationFrame riêng trong khung chung, giới hạn cập nhật khoảng 60 lần/giây; không dùng CSS nội suy trễ để tránh lệch phép va chạm. Các trò khác giữ nhịp 50 ms. Đây là mục tiêu lập lịch, không phải số đo FPS thực tế.

### Kanji mất nét

Chữ có ít nhất hai nét, chỉ ẩn một nét và giữ lại ít nhất một nét quan sát. Bỏ các vị trí ẩn gần như trùng nét đang thấy. Ba nét nhiễu lấy cùng cấp/viewBox, có khoảng cách hình học tối thiểu với đáp án và với nhau. So sánh bằng mẫu theo độ dài đường, kể cả đảo hướng vẽ; cache kết quả để tránh tính lại.

SVG giữ tọa độ gốc để phân biệt cả hình dạng và vị trí. Đúng nhận tối đa 200 điểm, giảm theo thời gian, sàn 30. Sai mất mạng và loại lựa chọn đó; gửi lại lựa chọn cũ không trừ thêm. Hoàn thành 10 chữ khác nhau để thắng. Parser TypeScript hỗ trợ toàn bộ 5.452 path thực tế mà không cần DOM/SVG runtime.

## Công bằng, lưu trữ và kiến trúc

- `lifecycle.ts` tách ba phép cập nhật vòng đời từ đợt 1, vẫn re-export tại vị trí cũ. `wave2.ts` nối luật mới vào cùng `createRound`/`reduceRound`; input, timer tấn công và thời gian tính điểm đều đóng băng khi pause.
- Engine chỉ TypeScript thuần, không DOM/React/native/network. Không thêm thư viện game/native. Các thành phần web dùng thư viện sẵn có.
- Thống kê vẫn tách tài khoản/cấp/độ khó. Ninja tách đọc/nghĩa, Tìm từ ẩn tách bảng chữ; các khóa đợt 1 giữ nguyên.
- Công thức có khóa riêng `senpaiai.minigames.v1.account:<id>:recipes`, version 1. Loại ID không thuộc catalog, gộp không trùng, tách hai tài khoản. Dữ liệu hỏng/phiên bản tương lai không bị ghi đè. Storage lỗi được báo và có thử lưu lại.
- Không gọi endpoint cộng điểm hoặc sửa `points_balance`. Điểm chỉ cập nhật `Session.score` và lưu tại máy.
- Nhãn mới nằm trong common vi/en dùng chung. Dùng token theme, responsive và reduced motion; không âm thanh.
- Route minigame tải bằng lazy/Suspense, tách bundle engine/vector khỏi app chính. Các minigame vẫn dùng chung bundle đó, chưa chia nhỏ dữ liệu nét riêng từng game.
- Chuyển tab/mất focus tự dừng. Mở liên kết ghi công ở tab khác không kết thúc ván. Thoát trang/kết thúc giữa ván giữ quy ước đợt 1.

## Kiểm tra tự động

```powershell
# frontend
npm.cmd run typecheck:games
npm.cmd run lint:games
npm.cmd run test:minigames
npm.cmd run lint
npm.cmd run i18n:check
node --test tests/*.test.mjs
npm.cmd run build

# Từ gốc, sau test:minigames
node shared-games/tests/bench.mjs

# mobile: tương thích engine và hồi quy ứng dụng hiện có
npm.cmd run check
npm.cmd run export:check
```

62 test engine/lưu trữ gồm cả đợt 1 và đợt 2. Có kiểm tra combo/boss/thắng-thua, chữ lặp, 150 lưới qua mọi độ khó/bảng chữ, va chạm biên, Ninja thắng đủ ván, 5.452 path, đáp án nét không mơ hồ, pause, thao tác trùng, storage lỗi, hai tài khoản và bộ sưu tập. Test Vite/React render vi/en kiểm tra cả chín trò, cấp thiếu và các lối vào cũ, đồng thời xác nhận SVG không còn path đã ẩn.

| Kiểm tra hoàn tất | Kết quả |
| --- | --- |
| Đợt 1 trước khi sửa: 40 test, render vi/en, build | Đạt |
| TypeScript engine không DOM, typecheck frontend và mobile | Đạt |
| ESLint frontend và logic shared | Đạt |
| Engine và adapter lưu trữ sau đợt 2 | 62/62 test đạt |
| Web: API, quiz và Vite/React render chín trò | 3/3 tệp test đạt |
| Khóa dịch vi/en web và mobile | Đạt |
| Mobile: check hồi quy | 94/94 test, lint, typecheck, khóa dịch đạt |
| Web production build sau chỉnh vòng vẽ Ninja | Đạt |
| Expo export Android + iOS | Đạt cho app hiện có; chưa có UI minigame Phần 3 |
| git diff --check | Đạt |

Kiểm tra khóa dịch web/mobile đạt. Scanner bổ sung `i18n:lint` toàn web còn báo chữ hardcode ở màn hình cũ như đợt 1; phần minigame mới không có phát hiện. Test render phía máy chủ vẫn có cảnh báo `useLayoutEffect` của React Router/Framer Motion và đôi khi cổng WebSocket khi các Vite middleware test chạy đồng thời; cả ba tệp đều kết thúc thành công. Đây không phải kiểm tra trình duyệt tương tác. Build còn cảnh báo kích thước bundle, không phải lỗi build.

## Hiệu năng và giới hạn đo

Số đo Node trên máy phát triển: 40 lần khởi tạo/trò và 1.000 lượt kiểm tra chém. Chỉ là số tham khảo, có thể thay đổi theo tải máy, không dùng làm ngưỡng CI và không đại diện FPS trên Android/iPhone.

| Phép đo | Trung vị | P95 |
| --- | ---: | ---: |
| Khởi tạo đánh quái | 0,118 ms | 0,529 ms |
| Khởi tạo Xưởng | 0,195 ms | 0,726 ms |
| Khởi tạo Tìm từ ẩn | 3,569 ms | 6,691 ms |
| Khởi tạo Ninja | 0,405 ms | 1,210 ms |
| Khởi tạo mất nét, cache ấm | 6,716 ms | 14,476 ms |
| Va chạm Ninja, 4 từ/32 điểm | 0,042 ms | 0,139 ms |

Lần khởi tạo mất nét đầu tiên khoảng 63 ms ở lần đo đó; trường hợp cache ấm chậm nhất khoảng 21 ms. Đây là điểm có nguy cơ khựng lúc sinh câu, cần đo thêm trên trình duyệt/thiết bị mục tiêu. Bundle minigame/vector được tải riêng khi vào khu chơi; không thêm tải vector vào các trang khác của app chính.

**Chưa đủ bằng chứng để kết luận trò nào đạt hoặc không đạt FPS trên máy mục tiêu**, vì chưa chạy trình duyệt tương tác/thiết bị thật và chưa có UI mobile Phần 3. Các phương án giảm bớt nếu đo không đạt:

| Trò | Cần đo | Phương án giảm |
| --- | --- | --- |
| Đánh quái | Phản hồi chọn cặp, timer sau pause | Giữ tối đa 4 cặp, giảm trang trí |
| Xưởng | Thẻ dài và bộ sưu tập nhiều mục | Giới hạn thẻ nhiễu, phân trang/ảo hóa sưu tầm |
| Tìm từ ẩn | Vuốt trên lưới 10×10, chọn chéo | Giảm xuống 8×8 và 4 từ, giảm cập nhật preview |
| Ninja | FPS, độ trễ pointer, chữ chồng lên nhau | Tối đa 2–3 từ, bỏ vệt chém, giảm số điểm và cập nhật 30 Hz nếu cần |
| Mất nét | Độ trễ khởi tạo nguội và câu tiếp theo | Làm ấm cache trước ván, giảm tập nét nhiễu, tải theo cấp |

Không có tuyên bố đo được FPS/haptics/gesture native trong đợt này.

## Checklist thủ công theo trò

Chưa đánh dấu là đã thực hiện. Cần lặp mọi cấp có dữ liệu, mọi độ khó và chế độ liên quan.

| Trò | Web | Android Expo Go — Phần 3 | iPhone Expo Go — Phần 3 |
| --- | --- | --- | --- |
| Đánh quái | ☐ N3 chọn cặp, combo 5 giây, boss 3/5, thắng/thua, hết bảng còn máu | ☐ Chọn cặp; AppState; Back xác nhận; màn nhỏ | ☐ Chọn cặp; xuống nền; swipe-back xác nhận |
| Xưởng | ☐ N3 chữ lặp, undo/clear, sai/đúng, 8 từ; collection sau tắt mở và tài khoản A/B | ☐ Thẻ không tràn; lưu local; Back giữa ván | ☐ Thẻ và vùng home indicator; local; cử chỉ thoát |
| Tìm từ ẩn | ☐ N3 hai bảng chữ; kéo ngang/dọc/chéo/đảo; đường sai/lặp/hủy; bàn phím | ☐ Vuốt; khóa cuộn; hủy/multitouch; lưới dày | ☐ Vuốt; khóa cuộn; cạnh màn; swipe-back |
| Ninja | ☐ N3 đọc/nghĩa; kéo nhanh/chậm; rời khung; pause giữa kéo; chém trùng; thắng/thua | ☐ PanResponder/Animated; nhiều vuốt; FPS máy tầm trung; Back | ☐ Vuốt/hủy; home indicator; FPS; cử chỉ thoát |
| Mất nét | ☐ N5/N4/N3; đủ bốn phương án; nét bị ẩn thật; đúng nhanh/chậm; sai/gửi lại; 10 chữ; attribution | ☐ SVG có sẵn; cache câu đầu; chọn nét; Back | ☐ SVG, font và kích thước; cache; cử chỉ thoát |

Chung cho từng dòng: ☐ cấp thiếu bị khóa và có gợi ý; ☐ pause/resume giữ nguyên board/thời gian; ☐ chuyển tab/blur hoặc xuống nền; ☐ thoát giữa ván; ☐ điểm cao sau tắt/mở; ☐ tài khoản A/B tách biệt; ☐ đổi vi/en trước và giữa ván; ☐ sáng/tối với theme; ☐ 320/360 px và desktop; ☐ storage chặn/hết dung lượng; ☐ ví điểm không đổi; ☐ bốn trò đợt 1 và lối vào cũ còn hoạt động.

Các ô Android/iPhone là kế hoạch kiểm chứng cho Phần 3. Export bundle hiện tại chỉ kiểm tra ứng dụng và cấu hình tương thích; không chứng minh game mới chạy native.
