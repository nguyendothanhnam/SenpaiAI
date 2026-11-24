# Minigame học tập và tra Kanji

Gộp luật của hai đợt engine, đợt chiến dịch/XP/ôn tập và rà soát hub. Cập nhật workspace 24/11/2026; chưa đưa giao diện chiến dịch mới lên Expo. [Mục lục](README.md).

## Phạm vi và dữ liệu

Chín game dùng `shared-games`: falling, shiritori, cipher, memory, battle, workshop, wordsearch, ninja, missing. Quiz/Flashcard dùng bộ nội dung riêng; các thẻ chỉ là tên/chế độ giới thiệu không được đếm thành engine mới. Kanji Arena đã rời hub; `/games/kanji` chuyển tới `/kanji?mode=study`. Hướng dẫn riêng từng trò có vi/en.

Kho thực gồm 612 kanji (79 N5/166 N4/367 N3), nhưng từ đơn đủ chuẩn của game hiện chỉ có 367 mục N3. Độ khả dụng được `availability.ts` kiểm tra lại theo game/cấp/độ khó/kiểu đáp án; không dùng bảng mở khóa cũ ở các báo cáo đợt đầu làm căn cứ hiện tại. Không cắt câu ví dụ thành từ giả hoặc tự gán cấp.

## Luật lõi và vòng đời

Các phần dưới mô tả reducer gốc. Web hiện dùng lớp LearningRun áp mục tiêu màn/thời gian và giới hạn ván tự do; mục tiêu trên HUD là điều kiện kết thúc thực tế, có thể đến trước giới hạn vòng của engine.

### Bốn game ban đầu

- `createRound` khởi tạo ván đang chơi; `reduceRound` xử lý tick, trả lời, gợi ý, tạm dừng, tiếp tục và kết thúc. State được cập nhật bất biến; seed tái lập giúp test. Input và đồng hồ bị khóa khi tạm dừng hoặc đã kết thúc.
- Dễ / Vừa / Khó có 4 / 3 / 2 mạng. Điểm và mạng không âm. Delta mỗi tick tối đa 250 ms để tránh bước nhảy quá lớn khi máy bị nghẽn. Web tạm dừng khi ẩn tab hoặc mất focus; không tự tiếp tục khi quay lại.
- **Kanji rơi:** 4 đáp án cùng JLPT, loại toàn bộ cách đọc được chấp nhận khỏi đáp án nhiễu. Điểm từ 50–150 theo thời gian còn lại. Tốc độ tăng theo cấp, độ khó và mỗi 5 lượt đúng; số chữ đồng thời tăng từ 1 đến tối đa 3. Đáp án sai hoặc chữ chạm đáy mất mạng. Click chọn chữ; phím 1–4 trả lời chữ đang có viền. Hoạt ảnh dùng CSS transform, hỗ trợ reduced motion.
- **Shiritori:** chuẩn hóa NFKC, Katakana về Hiragana. Kana nhỏ cuối từ đổi về chữ lớn tương ứng; `ー` lấy nguyên âm của âm trước (kể cả âm ghép như `ティー`, `キャー`). `ん` kết thúc chuỗi. Mỗi câu ban đầu có đúng một lựa chọn nối an toàn và ba từ nhiễu cùng cấp; từ đã nối không được xuất hiện lại. Chọn sai loại lựa chọn đó và mất mạng. Chọn từ nối được nhưng kết thúc bằng `ん` kết thúc ván. Hết lựa chọn hợp lệ hoặc không đủ bốn lựa chọn công bằng thì kết thúc với lý do hết dữ liệu, giữ điểm và không trừ mạng. Chuỗi lưu là số lượt nối đúng liên tiếp, không tính từ khởi đầu.
- **Mật mã:** bảng thay thế là song ánh, không chữ nào thay bằng chính nó. Ký tự lặp lại có cùng mã. Kana có dấu và dấu kéo dài trong từ đều có ánh xạ. Độ khó quy định độ dài và số ô mở sẵn; cấp cao giảm thêm số ô mở. Dải độ dài tăng sau mỗi 3 câu đúng, trong giới hạn dữ liệu và độ khó. Một gợi ý mở một vị trí, giảm 25 điểm thưởng của câu đó khi giải đúng, tối thiểu 10 điểm; không trừ ví và không trừ hai lần. Hoàn thành 10 từ kết thúc ván.
- **Chuỗi nhớ:** lưới 3×3 tối đa 9 Kana khác nhau lấy từ dữ liệu cấp đã chọn. Ban đầu 2 ô, mỗi lần hoàn thành thêm 1 ô; điểm bằng bình phương độ dài ×10. Tốc độ trình diễn theo cấp và độ khó. Chỉ nhận input sau khi trình diễn; sai mất mạng và xem lại cùng chuỗi. Đạt 16 ký tự kết thúc. Phím 1–9 hoặc click. Không âm thanh.


### Năm game bổ sung

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


## Chiến dịch, XP, ôn tập và tra Kanji

### 1. Thiết kế và quy trình
- Giữ engine và API cũ. Lớp LearningRun bọc reducer hiện có để thêm mục tiêu,
  điều chỉnh độ khó, sự kiện học tập; engine di động cũ tiếp tục dùng được.
- Chiến dịch dùng kho dữ liệu thực: màn dễ/vừa/khó, 1–3 sao, mở khóa tuần tự,
  màn cuối là trùm; trận ghép nghĩa phải hạ trùm thật. Sao đòi hỏi hoàn thành
  mục tiêu và độ chính xác tối thiểu 60%, 80%, 95%.
- XP, huy hiệu, trang trí và tiến độ chiến dịch lưu riêng theo tài khoản trên
  thiết bị. Không cộng vào ví, không có bảng xếp hạng. Không phát âm thanh game.
- Thử thách hằng ngày xác định từ ngày UTC+7 và cấp người học, cùng dữ liệu
  cho cùng đầu vào. Giới hạn 45 giây chơi thực; tạm dừng không tính thời gian.
- Sau 3 lượt đúng tăng một mức khó, sau 2 lượt sai giảm một mức; giới hạn
  trong mức có dữ liệu. Combo chỉ hoạt ảnh khi không yêu cầu giảm chuyển động.
- Ván tự do cũng hữu hạn. HUD hiện số lượt đúng/mục tiêu và số lượt đúng còn
  thiếu. Đây là lượt đúng, không phải số lần bấm: sai vẫn trừ mạng. Ván có thể
  kết thúc sớm khi hết mạng/hết kho hoặc theo luật nối từ kết thúc bằng ん.
- Bỏ cách đọc dưới từ và lựa chọn nối từ, dưới lựa chọn ghép nghĩa; giữ âm
  cần nối làm yêu cầu của trò. Kana trong trò kana và gợi ý cấu thành từ vẫn
  là nội dung bài tập. Bỏ nhãn “Khu trò chơi · Đợt 1 + 2”.

### 2. Ghi lỗi để học lại
- Chọn local outbox rồi đồng bộ vì game phải tiếp tục khi mất mạng. Sự kiện
  ghi ngay sau lỗi, có khóa chống gửi trùng; server xác minh nguồn/cấp thật,
  chỉ nhận dữ liệu của người dùng đăng nhập. Lỗi thao tác không tự gán cho từ.
- Trang tổng hợp có ôn lại mục sai, xác nhận đã nhớ hoặc cần ôn thêm. Đây là
  tự đánh giá, trọng số năng lực thấp (0,2); không phải chứng cứ thi có giám sát.
- Lỗi từ/kanji được ưu tiên trong nhiệm vụ hằng ngày và gợi ý lộ trình.
  Không đổi hợp đồng nhiệm vụ, ngưỡng nội dung, hay chống cộng điểm hai lần.
- Server lưu vào minigame_learning_events; có trong xuất dữ liệu, xóa tài khoản
  và đặt lại tiến độ. Không nhận điểm game để đổi thành tiền/điểm thưởng.

### 3. Bảng tra Kanji
- Bấm trực tiếp chữ Kanji trong văn bản bài tập để mở hộp tra; không có thanh
  tra ở đầu trang. Bỏ qua nút đáp án, liên kết và ô nhập liệu; chặn tra toàn bộ
  nội dung minigame khi ván chưa kết thúc, kể cả đang tạm dừng. Placement không
  có chức năng tra. Ghi chú cá nhân vẫn có thể xem ngoài ván đang chơi.
- Hiện cấp/nét/On/Kun từ từ điển hiện có, âm Hán Việt, nghĩa Việt và mẹo nhớ
  chỉnh sửa riêng. Lưu theo tài khoản; không sửa từ điển chung, không render
  HTML từ ghi chú. Đọc tiếng Nhật bằng giọng trình duyệt nếu có, không tự phát.
- 492/612 chữ có kVietnamese từ Unicode 17 Unihan; thêm 際 = TẾ do người dùng
  cung cấp trong ảnh. Tổng 493/612, 119 chữ để trống và cho người dùng bổ sung.
  Không tự bịa âm, JLPT hay số nét. Nguồn/licence đi cùng dữ liệu.
- Ghi chú nằm trong xuất dữ liệu và xóa theo tài khoản; đặt lại tiến độ học
  giữ ghi chú đã tự viết. Hộp thoại giữ draft khi lỗi lưu, có bẫy focus/Escape,
  cuộn nội dung và nút lưu riêng, token theme, i18n vi/en.

### 4. Migration và tương thích
- 0021_kanji_notes.py nối 0020; 0022_minigame_learning.py nối 0021.
  Upgrade kiểm tra bảng/index đã tồn tại; downgrade chạy lại an toàn khi bảng
  vắng. Khi có dữ liệu, downgrade từ chối xóa để buộc lưu trữ trước.
- Endpoint mới: GET/PUT /kanji-notes/{kanji}, POST /minigames/learning-events,
  GET /minigames/review (phân trang); cũng có tiền tố /api như quy ước hiện tại.
  Tên API/prop cũ giữ nguyên; prop mới GameFrame đều tùy chọn.

### 5. Kiểm chứng và cách đo chất lượng
- Toàn bộ pytest: 314 passed, 6 subtests passed (27 cảnh báo hiện có).
- Toàn bộ test web: 70 passed; logic/lưu trữ game: 78 passed.
- Build frontend, TypeScript, lint game và các component sửa: đạt.
- Kiểm tra khóa dịch vi/en: đạt. Không thêm thư viện game hay biểu đồ.
- Edge headless dùng component thật, API giả lập: 1280/768px sáng, 390/320px
  tối, vi/en, giảm chuyển động; không tràn ngang. Kiểm tra bộ đếm, bỏ furigana,
  chặn tra trong ván, bấm chữ mở hộp tra và bố cục hộp tra 320px: đạt.
- Test xác nhận sao/mở khóa/trùm, XP không cộng trùng, chuỗi ngày, độ khó,
  thời gian tạm dừng, ván tự do kết thúc hữu hạn, outbox và tài khoản độc lập,
  API sở hữu dữ liệu, không cộng ví, daily/lộ trình/reset/export và migration.
- Để đo hiệu quả học thật: theo dõi tỷ lệ hoàn thành, độ chính xác trước/sau
  ôn và quay lại sau 7 ngày trên nhóm người học; chưa có số liệu thực nghiệm,
  không tuyên bố minigame làm tăng năng lực dựa trên test phần mềm.

### 6. Giới hạn và quyết định cho đợt sau
- Kho hiện có 612 kanji nhưng từ vựng game chỉ có 367 mục N3; không mở cấp
  thiếu dữ liệu. Muốn mở game từ ở N5/N4 cần bộ từ–nghĩa đã rà soát.
- XP/trang trí/tiến độ hiện theo thiết bị, có thể sửa bằng công cụ trình duyệt;
  không dùng làm thành tích cạnh tranh hoặc thưởng có giá trị. Nếu làm bảng
  xếp hạng sau này, server phải cấp phiên và kiểm tra thời gian/điểm tối đa.
- Còn cần kiểm chứng thiết bị thật, giọng đọc Nhật đã cài, mất/kết nối lại mạng
  thật, dữ liệu học thật và rà soát nội dung bởi người biết tiếng Nhật.
- Reset server không xóa localStorage ở thiết bị khác. Sự kiện offline chưa
  gửi có thể xuất hiện lại sau reset khi thiết bị đó kết nối; cần đồng bộ trước
  reset hoặc bổ sung epoch reset server trong một yêu cầu riêng.
- Người dùng quyết định ở đợt sau: bổ sung cấp dữ liệu nào, có cần đồng bộ
  tiến độ game đa thiết bị, khi nào thực hiện giao diện Expo. Không cản bản này.


## Lệnh kiểm tra

Từ `frontend`:

```powershell
npm.cmd run typecheck:games
npm.cmd run lint:games
npm.cmd run test:minigames
node --test tests/*.test.mjs
npm.cmd run i18n:check
npm.cmd run build
```

TypeScript engine không phụ thuộc DOM/React/native. Web tạm dừng khi mất focus/ẩn tab, input và timer bị khóa khi pause. Hướng dẫn đóng không tự tiếp tục. Khóa lưu trữ cũ được giữ; báo lỗi storage thay vì ghi đè dữ liệu hỏng hoặc phiên bản tương lai.

## Checklist

- [ ] Mỗi game có hướng dẫn, dữ liệu thực và mục tiêu hữu hạn; bộ đếm tăng đúng.
- [ ] Không lộ cách đọc nối từ/ghép nghĩa; không tra Kanji trong ván đang chơi/tạm dừng.
- [ ] Pause/resume/thoát, hết mạng/hết dữ liệu và trùm đúng luật; không nhận XP/thưởng trùng khi retry.
- [ ] Điểm/XP riêng không đổi ví; các tài khoản có local progress và outbox độc lập.
- [ ] Sai → ôn → đồng bộ → daily/lộ trình; thử mất mạng, kết nối lại và dữ liệu cơ chế không gán nhầm từ.
- [ ] vi/en, sáng/tối, giảm chuyển động, bàn phím/cảm ứng; nghiệm thu thiết bị thật trước khi tuyên bố FPS hay đồng bộ ổn định.
