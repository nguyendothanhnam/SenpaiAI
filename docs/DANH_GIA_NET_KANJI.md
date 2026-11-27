# Luyện viết Kanji — chấm nét và giao diện

Tài liệu duy nhất cho dịch vụ chấm và web luyện viết, gộp phần A/B. Cập nhật workspace 25/11/2026. Số kiểm thử trong từng phần là mốc lịch sử của đợt đó, không cộng dồn; lượt mới phần A: 441 pytest + 6 subtest, 80 test web. Chấm hiện tại là `stroke-rules-v3`; các mục v1/v2 dưới đây giữ nhãn lịch sử.

Nhận dạng ảnh CNN là bài toán khác, xem [Nhận dạng Kanji](KANJI_RECOGNITION_DIAGNOSIS.md). Bằng chứng trước/sau giữ nguyên trong [ket_qua/kanji.json](ket_qua/kanji.json); báo cáo v1 dùng bộ ca khác nằm ở `legacy_v1_different_cases`, không dùng thay baseline hiệu chỉnh v2.

## Dịch vụ chấm và hiệu chỉnh

### 1. Nguyên nhân đã xác minh
- V1 tính điểm thứ tự/hướng bằng cách đếm các nhãn correct/wrong_direction
  hoặc correct/wrong_order. Một nét bị gắn wrong_shape đồng thời mất cả điểm
  thứ tự và hướng, dù không có bằng chứng viết sai thứ tự hay đảo chiều.
- V1 ghép tham lam từng nét vào mẫu còn trống; dễ nhạy với các nét giống nhau.
  Việc làm mượt trước khi lấy mẫu cũng phụ thuộc mật độ pointer event, trong
  khi mẫu SVG và nét tay có mật độ điểm khác nhau.
- V1 còn đổi trạng thái nét, hạ điểm hình và đánh trượt chỉ vì một chữ khác
  có khoảng cách nhỏ hơn. Đây là trộn cảnh báo không chắc chắn vào chấm điểm.
- Không thấy lỗi đảo trục y: SVG mẫu và canvas đều tăng y xuống dưới; phép
  biến đổi đồng nhất cả chữ (thu/phóng, tịnh tiến) đã đạt 100 ở bản cũ.

Ca tái hiện: lấy 4 nét mẫu 月, dịch x từng nét xen kẽ -12/+12 đơn vị SVG,
không đổi thứ tự hoặc hướng. Bản quy tắc v1 cho thứ tự 0, hướng 0, hình 36,
đủ nét 100, tổng 34. V2 chuẩn: thứ tự 100, hướng 100, hình 61, đủ nét 100,
tổng 84. Mức nghiêm vẫn phản ánh hình lệch nhưng không trừ thứ tự/hướng.
Đây là mô phỏng cùng loại lỗi, KHÔNG phải tọa độ nét gốc trong ảnh của người
dùng. Ảnh không đủ để kết luận chính xác mọi nguyên nhân của bài viết gốc.
Script reproduce_kanji_writing_issue.py giữ công thức v1 phục vụ đối chiếu;
không được import vào ứng dụng. Kết quả: ket_qua/kanji.json → reproduction.

### 2. Quy trình v2 và các mức chấm
- Lấy mẫu đều theo độ dài cung trước, làm mượt đối xứng giữ điểm đầu/cuối,
  rồi đưa TẤT CẢ nét vào cùng một khung bao, giữ tỷ lệ chiều rộng/cao. Không
  chuẩn hóa độc lập mỗi nét, không lật trục hoặc tự xoay để che lỗi hướng.
- Ghép một-một bằng Hungarian, chi phí gồm khoảng cách đường, đầu/cuối và
  độ dài tương đối. Chỉ báo sai thứ tự khi nét khác khớp và tốt hơn nét lẽ ra
  phải viết với biên đủ lớn; nét không phân biệt được thì không kết tội sai.
- Hướng dùng đối chiếu xuôi/ngược, đầu/cuối và tích vô hướng. Chỉ trừ khi
  có bằng chứng đảo chiều, độc lập với việc hình dạng đạt hay không đạt.
- Điểm hình theo khoảng cách đường và tỷ lệ độ dài; đủ nét theo chênh lệch
  số nét. Tổng = 20% thứ tự + 20% hướng + 40% hình + 20% đủ nét. Đạt cần >=80,
  đúng số nét và tất cả nét được phân loại correct; không chỉ dựa điểm tổng.
- Khi thiếu nét/chưa đủ cả chữ, khung bao thay đổi: chấm sau từng nét vẫn là
  tạm tính. Chấm cuối dùng toàn bộ chữ. Các nét thừa/thiếu vẫn có nhãn riêng.

Ngưỡng cấu hình trong app/core/kanji_writing_config.py (đơn vị khung bao):
                 Dễ       Chuẩn      Nghiêm
Khoảng cách      0,20      0,16       0,10
Đầu/cuối         0,32      0,26       0,17
Tỷ lệ dài tối thiểu 0,35   0,42       0,60
Biên đổi thứ tự  0,035     0,025      0,020
Web mặc định chuẩn; bật kiểm tra chọn nghiêm và không gợi ý/không chấm trước
khi nộp. Người học vẫn chọn được mức rõ ràng; đổi mức bắt đầu bài viết mới.
API cũ không gửi strictness tiếp tục nhận mặc định standard, không đổi tên
endpoint hay trường cũ. Kết quả thêm version, strictness, thresholds và cờ
order_error/direction_error. Lịch sử cũ giữ nguyên, không tự chấm lại.

### 3. Chữ dễ nhầm và giới hạn suy luận
- Giữ danh sách ứng viên thủ công/tự động và các nét phân biệt để rà soát.
- Chỉ hiển thị gợi ý khi khoảng cách tới chữ khác <0,065, tốt hơn chữ đích
  >0,035, có sai lệch ở nét phân biệt và ứng viên tốt nhất không hòa với ứng
  viên kế tiếp (biên 0,012). Chữ khác phải cùng số nét với nét người viết.
- Gợi ý KHÔNG đổi điểm, trạng thái nét hay passed. Hai chữ gần giống vẫn có
  thể cùng nằm trong dung sai hình học; gợi ý là tín hiệu rà soát, không phải
  khẳng định người dùng viết chữ khác. Nét phân biệt được chỉ ra khi có gợi ý.
- Nhận dạng cả chữ chỉ tham khảo; web chỉ hiện cảnh báo của nó khi khớp với
  gợi ý hình học có nét phân biệt. Không dùng dự đoán ML để chấm đúng/sai.

### 4. Bộ đo và kết quả thật
32 chữ có dữ liệu, gồm 12 N5 + 10 N4 + 10 N3, mỗi chữ 8 biến thể viết đúng:
thu/phóng 0,45–1,3, dịch khung, lệch từng nét, mật độ 9–64 điểm, run ±0,45,
cong nhẹ, tỷ lệ x/y thay đổi nhẹ; seed cố định. Mỗi chữ thêm 1 ca hoán đổi
hai nét kề, đảo 1 nét, thiếu nét, thừa nét và sai hình rõ. Thêm 6 cặp dễ nhầm.
Tổng 422 ca; 36 chữ đích khác nhau nếu tính cả nhóm cặp dễ nhầm.

Tiêu chí                              V1 trước     V2 chuẩn sau
Chấp nhận đúng                        255/256      256/256
                                      99,61%       100%
Phát hiện đúng nhãn sai thứ tự         32/32        32/32
Phát hiện đúng nhãn sai hướng          32/32        32/32
Phát hiện thiếu nét                   32/32        32/32
Phát hiện thừa nét                    32/32        32/32
Phát hiện sai hình rõ                  32/32        32/32
Cảnh báo đúng 6 cặp dễ nhầm            6/6          6/6

V2 dễ chấp nhận 256/256 (100%); v2 nghiêm 252/256 (98,44%). Cả ba mức phát
hiện 32/32 cho từng loại lỗi trên, cảnh báo 6/6 cặp. Không có cảnh báo chữ
khác trong 256 ca đúng ở cả ba mức. Chỉ tính phát hiện lỗi khi có đúng nhãn
lỗi tương ứng, không tính mọi trường hợp bị đánh trượt là phát hiện thành công.
V1 vốn rất tốt trên nét gần mẫu: cải thiện chấp nhận chỉ 1/256, không nên
phóng đại. Sửa chính là hết trừ oan các tiêu chí và cảnh báo không hạ điểm.

Dữ liệu mô phỏng KHÔNG chứng minh đạt 90% với người viết thật. Mỗi loại lỗi
mới 32 ca; chưa có tập viết tay gán nhãn thứ tự/hướng độc lập hoặc đánh giá
mù bởi giáo viên. Chữ cực lệch, nét quá ngắn, vòng kín và hai nét chồng nhau
có thể mơ hồ. Các mẫu nét v1 hình ảnh không chứa thứ tự nét thì không thể
dùng làm nhãn chuẩn cho phép đo thứ tự/hướng. Cần báo cáo người dùng để bổ sung.

Chạy lại từ backend:
 venv\Scripts\python.exe scripts/calibrate_kanji_writing.py --strictness standard --output ../tmp/writing-after.json
 Thay standard bằng easy/strict để đo các mức khác.
 venv\Scripts\python.exe scripts/reproduce_kanji_writing_issue.py --output ../tmp/writing-reproduction.json
Mốc trước sửa đã đo bằng pipeline v1 trước khi thay code, lưu nguyên trong
ket_qua/kanji.json → baseline. Các mục after.easy, after.standard và after.strict lưu kết quả sau; không phải tái
huấn luyện hay tự thêm báo cáo chưa rà soát vào nhãn chuẩn.

### 5. Báo chấm sai và quản lý dữ liệu
- Sau chấm cuối/lưu, nút Báo chấm sai mở ghi chú và ô đồng ý rõ ràng lưu nét,
  chữ đích, kết quả, ghi chú cùng tài khoản. Chưa đồng ý thì không gửi.
- POST /kanji-writing/reports đối chiếu digest nét với bài đã lưu của chính
  người dùng, lấy kết quả từ server; không tin điểm do client gửi. Có UUID
  chống lưu trùng khi retry, giới hạn 40 nét/20.000 điểm/ghi chú 2.000 ký tự.
- GET /kanji-writing/reports?offset=0&limit=20 chỉ trả báo cáo của chính người
  dùng, tối đa 100 mỗi trang; có cùng tiền tố /api theo quy ước hệ thống.
- Dành cho người quản trị có quyền truy cập DB tại máy chủ:
 venv\Scripts\python.exe scripts/review_kanji_writing_reports.py --limit 100 --offset 0 --output ../tmp/writing-reports.json
 Có thể thêm --user-id ID. Script chỉ đọc/xuất, mặc định không xuất định danh
  tài khoản. Báo cáo phải được giáo viên rà soát trước khi dùng hiệu chỉnh.
- Có trong xuất dữ liệu cá nhân; xóa khi đặt lại tiến độ hoặc xóa tài khoản.
  Điểm lịch sử không tự sửa theo phản hồi. Chưa có báo cáo thật để đánh giá.
- Migration 0023 nối 0022 đã áp dụng PostgreSQL. Upgrade lặp kiểm tra bảng/
  index; downgrade lặp an toàn, từ chối xóa khi còn báo cáo để không mất dữ liệu.

### 6. Kiểm tra và tác động tới di động
- Toàn bộ pytest: 320 test + 6 subtest đạt. Web: 72 test đạt. TypeScript,
  lint component/API sửa, khóa dịch vi/en, build frontend đạt. Có cảnh báo
  thư viện cũ và kích thước bundle; không thêm dependency hay mở rộng tối ưu.
- Edge headless với component thật/API giả lập: 1280/768px sáng, 390/320px
  tối, vi/en, giảm chuyển động; không tràn ngang. Vẽ bằng pointer, bật test
  chọn nghiêm/không gợi ý, chấm cuối, báo cáo chỉ sau consent: đạt.
- Kiểm thử API gồm sở hữu dữ liệu, consent, nét giả không khớp, retry/conflict,
  phân trang, export/reset/delete, lưu version/ngưỡng và migration lặp.
- Đã kiểm tra tự chấm toàn bộ 612 mẫu đạt 100; cảnh báo không đổi điểm.
- Expo hiện dùng mobile/src/api/kanjiWriting.ts và
  mobile/src/screens/KanjiWritingScreen.tsx cho nhận dạng ảnh, API /kanji/*,
  chưa gọi /kanji-writing/evaluate hay dùng hình học này. Không có caller
  native cần đổi ngay. Typecheck và i18n check mobile đạt; chưa sửa UI mobile.
- Chưa kiểm chứng thiết bị/bút cảm ứng thật, người viết thật hoặc giọng đọc;
  không gộp kết quả mô phỏng thành độ chính xác thực tế.


## Giao diện và chọn chữ

### 1. Thiết kế và dữ liệu
- Thay danh sách xổ xuống bằng bộ chọn mở/thu gọn. Tab N5–N1 hiện số chữ có
  mẫu thật; N5=79, N4=166, N3=367, N2/N1=0 và có thông báo thiếu dữ liệu.
- Chỉ ghép metadata từ từ điển vào danh sách được /kanji-writing/supported
  xác nhận có nét. Không lấy cờ dữ liệu viết tay để giả định có mẫu nét.
- Tìm theo chữ, nghĩa Việt/Anh hoặc On/Kun; hỗ trợ tiếng Việt không dấu và
  quy đổi katakana/hiragana khi tìm. Chưa chuyển romaji sang kana.
- Lưới cao 224px, cuộn trong khung, không kéo dài trang. Có trước/sau/ngẫu
  nhiên trong tập đang lọc, gợi ý và gần đây. Tab và lưới dùng bàn phím mũi
  tên/Home/End; Enter/Space chọn bằng nút chuẩn. Chữ chọn có aria-pressed,
  vòng focus, chữ lớn trong tiêu đề và trong thẻ thông tin.
- Chưa ảo hóa vì tối đa 367 nút một tab; không thêm thư viện. Nét đang kéo
  cập nhật trực tiếp polyline, tránh dựng lại lưới ở mỗi pointermove.
- Nhớ chữ và tab theo tài khoản bằng localStorage, kiểm tra lựa chọn còn
  trong kho sau khi tải. Đây là tùy chọn theo trình duyệt, không đồng bộ đa
  thiết bị. Dữ liệu lịch sử lấy từ server, không suy từ lựa chọn cục bộ.

### 2. Trạng thái và API bổ sung
- Thêm GET /kanji-writing/progress (và /api/kanji-writing/progress), JWT của
  chính người dùng; trả tối đa tập chữ đang được hỗ trợ, mỗi chữ một dòng:
  kanji, attempts, passed_count, last_passed, last_score, last_practiced.
- Truy vấn SQL tổng hợp và window để lấy lần gần nhất; không chuyển toàn bộ
  lịch sử hoặc nét cá nhân lên frontend. Không thêm bảng/migration, không đổi
  hợp đồng supported/template/evaluate/report hay tự chấm lại điểm cũ.
- Chưa luyện: không có bài chấm cuối đã lưu. Đang luyện: có lịch sử nhưng
  chưa đủ điều kiện. Thành thạo trong luyện viết: ít nhất 2 lần đạt, lần gần
  nhất cũng đạt. Đây không phải kết luận năng lực JLPT chính thức.
- Không tính preview hay cộng thêm khi retry một attempt. Tải lịch sử lỗi
  thì hiện trạng thái chưa tải, không đánh đồng với chưa luyện.
- Gợi ý ưu tiên chữ có lần gần nhất sai (điểm thấp trước), sau đó chưa luyện,
  sau đó đang luyện. Loại chữ đã thành thạo. Gần đây theo thời điểm chấm cuối.
- Chấm và lưu thành công làm mới cache tiến độ viết cùng cache lộ trình học.
  Reset tiến độ sử dụng cơ chế có sẵn, kết quả tổng hợp sau reset trống.

### 3. Bố cục và đối chiếu
- Màn rộng từ 1024px: hai cột, trái chữ/âm/nghĩa và mẫu, phải canvas/điều
  khiển/kết quả. Mẫu nằm trước các mục thông tin mở rộng để thấy cùng canvas.
- Tablet/điện thoại: một cột, chữ và mẫu trước, canvas sau. Hướng dẫn, ví dụ,
  danh sách dễ nhầm và quy tắc thu gọn được; các danh sách dài cuộn nội bộ.
- Lấy nghĩa Việt, On/Kun, ví dụ nguyên bản từ từ điển; cấp/số nét/mẫu/quy tắc/
  nét phân biệt lấy API mẫu đã có. Ví dụ có thể là từ hoặc câu theo dữ liệu
  gốc. Thiếu mục thì ẩn, không tạo nghĩa/âm/từ ví dụ mới để lấp chỗ trống.
- Mẫu có số nét và nút phát lại; khi xem lỗi có thể phát riêng nét cần sửa.
  Hoạt ảnh chỉ chạy khi không yêu cầu giảm chuyển động; không phát âm thanh.
- Kết quả có tổng điểm và bốn thanh tiêu chí phía trên canvas; chi tiết từng
  nét thu gọn, chỉ mở sẵn nét sai. Khung chi tiết có chiều cao tối đa.
- Preview ưu tiên đối chiếu nét vừa viết nếu sai; chấm cuối chọn nét sai đầu
  tiên. Chọn lỗi trong danh sách hoặc bấm/Enter/Space trên nét sai đã chấm
  cuối sẽ phát nét đúng và hiện lớp phủ trong canvas.
- Lớp phủ dùng một khung bao cho cả chữ, cùng quy trình lấy mẫu/làm mượt như
  v2; màu chủ đạo là mẫu, nét đứt màu chữ là nét người viết. Có mũi tên và số
  cho cả hai. Các nét nền giúp giữ vị trí tương đối. Đây là đối chiếu chuẩn
  hóa, không giả vờ khớp vị trí pixel ban đầu khi hai chữ khác kích thước.
- Hướng dẫn ngắn/dài/lệch trái/phải/cao/thấp dựa trên đường đã căn; nếu không
  đủ căn cứ thì giữ phản hồi hình dạng chung của server. Không đổi trạng thái,
  điểm, ngưỡng hoặc passed từ phần A bằng các mô tả frontend này.
- Giữ hoàn tác, viết lại, gợi ý tiếp, chấm/lưu, ba mức nghiêm khắc và báo chấm
  sai có consent. Test ẩn mẫu/hoạt ảnh/lớp phủ/dễ nhầm trước khi nộp, không
  gọi preview; sau nộp mới cho đối chiếu. Chữ đích vẫn hiện để biết đề yêu cầu.

### 4. Kiểm tra đã chạy
- Toàn bộ backend pytest: 321 passed, 6 subtests passed; có cảnh báo thư viện
  cũ. Test mới kiểm tra progress chỉ của chủ tài khoản, không tính preview,
  retry không tăng lượt, đếm hai lần đạt, lần gần nhất sai và reset.
- Toàn bộ web: 79 passed. Logic mới: lọc/search/trạng thái/gợi ý/gần đây,
  preference theo tài khoản, lớp phủ/thứ tự hướng/thiếu thừa, mô tả hình học;
  UI kiểm tra không lộ mẫu trước nộp, tự hiện lỗi và luồng báo chấm sai cũ.
- TypeScript frontend, lint các component/API/logic sửa, kiểm tra khóa dịch
  vi/en và build frontend: đạt. Build có cảnh báo bundle lớn/Browserslist cũ.
- Mobile typecheck và i18n check: đạt. Không sửa màn hình Expo.
- Edge headless với component thật, 612 mục thật và API giả lập: 1440/1024px
  hai cột, 768/390/320px một cột; sáng/tối, vi/en, giảm chuyển động, không
  tràn ngang. Xác minh khung chọn cố định, tìm không dấu, phím mũi tên, cấp
  trống, pointer vẽ, mở lỗi, lớp phủ/mũi tên, phát riêng nét, ẩn mẫu khi test,
  bốn thanh sau nộp và lưu/khôi phục chữ đã chọn theo tài khoản: đạt.
- Chưa kiểm chứng thiết bị/bút thật, độ mượt trên máy tầm trung thực tế,
  mạng chập chờn hoặc tập lịch sử lớn từ người học thật. Kết quả trình duyệt
  dùng mock không thay thế nghiệm thu kết nối end-to-end với tài khoản thật.
- Các tab khác không sửa; kiểm thử hồi quy web/API đã chạy, còn cần người
  dùng kiểm tra luồng thật của học chữ/nhận dạng/thứ tự nét/khám phá.

### 5. Tác động tới di động
mobile/src/api/kanjiWriting.ts và mobile/src/screens/KanjiWritingScreen.tsx
hiện dùng nhận dạng ảnh /kanji/*, chưa gọi chấm nét /kanji-writing/evaluate.
Không có caller Expo cần đổi hợp đồng trong phần này. API progress mới có
thể dùng lại cho màn hình chọn chữ di động sau này.


## Sinh lại báo cáo lớn khi cần

Từ `backend`, ghi báo cáo mới vào `tmp/`, không ghi đè các mốc nghiệm thu đã giữ:

```powershell
.\venv\Scripts\python.exe scripts/calibrate_kanji_writing.py --strictness standard --output ../tmp/writing-current.json
.\venv\Scripts\python.exe scripts/reproduce_kanji_writing_issue.py --output ../tmp/writing-reproduction.json
.\venv\Scripts\python.exe scripts/evaluate_kanji_writing.py --output ../tmp/writing-overview.json --confusions-output ../tmp/kanji-confusions.json
```

Danh sách 2.456 cặp từng xuất đều là `needs_review`, không phải nhãn chuẩn. Sinh lại khi người biết tiếng Nhật cần rà; không giữ bản JSON gần 2,8 MB trong docs mỗi đợt.

## Cập nhật phần A ngày 25/11/2026 — căn ghép khi thiếu/thừa nét

### Nguyên nhân thật trước sửa

Ca 34/100 đã được xử lý trong v2 trước lượt này: cùng nét mô phỏng 月, công thức v1 đóng băng cho 34, còn v2/v3 cho 84, thứ tự/hướng đều 100. Không tuyên bố đây là tọa độ gốc từ ảnh chụp.

Kiểm tra thêm phát hiện lỗi đang tồn tại ở v2: bỏ nét đầu của 土 làm điểm thứ tự bằng 0 và báo thiếu nét cuối; thêm một nét ở giữa lại đánh dấu nét cuối hợp lệ là thừa. V2 so theo chỉ số hiện tại, chỉ xét tối đa số nét mẫu và bổ sung nhãn thiếu ở cuối. Vì vậy một khoảng trống/thừa ở giữa bị hiểu thành thay đổi thứ tự. Đã đo baseline v2 hiện tại trước khi sửa runtime; không thay baseline v1/v2 cũ trong JSON.

### Sửa căn ghép, không nới ngưỡng

- Khi số nét cuối khác mẫu, dùng quy hoạch động tìm căn ghép giữ thứ tự, cho phép bỏ qua đúng phần chênh lệch ở phía dài hơn. Không tùy ý bỏ các nét sai hình để làm đẹp điểm.
- So với phương án ghép tự do Hungarian; chỉ kết luận sai thứ tự nếu có hai nét khớp chắc chắn bị đảo tương quan. Ngưỡng chứng cứ riêng trong `GAP_ORDER_PROOF`: khoảng cách tối đa 65% ngưỡng hình, đầu/cuối tối đa 75%, tỷ lệ dài ít nhất 75%, cải thiện so với căn ghép giữ thứ tự lớn hơn hai lần biên thứ tự. Hai nét giống nhau không đủ căn cứ để kết tội.
- Nét thừa được đánh dấu ở đúng vị trí trong chuỗi người viết; nét thiếu chỉ đúng `expected_index` của mẫu. `index` của bản ghi thiếu vẫn duy nhất và nằm ngoài các nét người dùng thực sự vẽ, để không lấy nhầm nét cho lớp phủ/ghi chú. Web dùng `expected_index` khi ghi nhãn nét mẫu thiếu; định danh nội bộ dùng `index` như cũ.
- Khi đủ số nét, giữ quy tắc v2; giữ ba profile, chuẩn hóa cả chữ, hướng trục y, trọng số điểm và điều kiện đạt. Chấm trước khi hoàn thành vẫn tạm tính, không tự kết luận thiếu các nét chưa viết. Cảnh báo chữ giống nhau và nhận dạng CNN không đổi điểm.
- API không đổi endpoint, tên trường hoặc prop; không thêm migration. Kết quả mới có version v3; lần làm cũ, retry và báo chấm sai giữ kết quả/version đã lưu, không tự chấm lại lịch sử.

### Đo trước/sau cùng dữ liệu

Script `calibrate_kanji_writing_alignment.py`: giữ bộ cũ **32 chữ (12 N5, 10 N4, 10 N3), 256 biến thể đúng, 5 loại lỗi mỗi loại 32 ca và 6 cặp dễ nhầm**; thêm 228 ca xóa một nét và 260 ca thêm một nét tại mọi vị trí. Tổng 910 ca/mức, ba mức chấm. Chạy trước/sau cùng seed và checksum nét mô phỏng, không đổi từ khóa hay rubric sau khi xem kết quả.

| Tiêu chí | V2 trước → V3 sau |
| --- | --- |
| Chấp nhận viết đúng — dễ/chuẩn | 100% → 100% (256/256) |
| Chấp nhận viết đúng — nghiêm | 98,44% → 98,44% (252/256) |
| Nhận đúng nhãn sai thứ tự, sai hướng | 100% → 100% (mỗi loại 32/32, cả ba mức) |
| Nhận nhãn thiếu/thừa/sai hình ở bộ cũ | 100% → 100% (mỗi loại 32/32) |
| Thiếu ở mọi vị trí: đúng vị trí và không trừ oan thứ tự | 14,04% → 100% (32/228 → 228/228) |
| Thừa ở mọi vị trí: đúng vị trí và không trừ oan thứ tự | 12,31% → 100% (32/260 → 260/260) |
| Kiểm tra hướng ở 488 ca khoảng trống/thừa, sau sửa | 488/488 không bị trừ oan, cả ba mức |
| Cảnh báo nhầm chữ trên các mẫu đúng | 0 trước và sau |

Hai hàng vị trí dùng tiêu chí chặt hơn việc chỉ phát hiện số lượng thiếu/thừa: phải chỉ đúng nét và không cáo buộc sai thứ tự. Không dùng các tỷ lệ này thay cho độ chính xác viết tay thật. Các mốc cũ có bộ nét nguồn khác được giữ riêng; lượt này so v2/v3 trên dữ liệu hiện tại sau cập nhật N5/N4. Kết quả gọn và checksum ở `ket_qua/kanji.json → alignment_v3`; đầy đủ lỗi/mẫu nghiêm còn lại ở `tmp/kanji-alignment-{before,after}.json`.

Lệnh thực tế đã chạy từ backend:

```powershell
.\venv\Scripts\python.exe scripts/calibrate_kanji_writing_alignment.py --phase before --output ../tmp/kanji-alignment-before.json
# Sau khi sửa, ghi tệp khác, không đè mốc trước.
.\venv\Scripts\python.exe scripts/calibrate_kanji_writing_alignment.py --phase after --output ../tmp/kanji-alignment-after.json
.\venv\Scripts\python.exe -m pytest tests/test_kanji_writing_alignment.py tests/test_kanji_writing.py -q -p no:cacheprovider
.\venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider
```

Nhóm backend: **43 đạt**; toàn backend **441 đạt + 6 subtest**, 26 cảnh báo thư viện cũ. Web **80 test đạt**; build/TypeScript, lint `WritingFeedback.tsx`, i18n web/mobile đạt. Thêm 24 ca backend và 1 ca web; có trường hợp sai thứ tự/đảo hướng đi cùng thiếu nét, nét trùng nhau, preview, rỗng và chỉ số đúng của nhãn nét thiếu. Các kiểm thử cũ tiếp tục kiểm chứng lưu score/version, ba profile, báo chấm sai có consent, phân quyền, retry, export/reset/xóa. Không viết lại nút báo chấm sai đã có; cách xem ở mục 5 bên trên.

Giới hạn: mô phỏng không bao quát nét viết tay rất méo, nhiều nét sai/thừa cùng lúc hoặc bút thật. Nét trùng hoàn toàn không thể xác định duy nhất “lần nào” bị thiếu/thừa chỉ từ tọa độ; không coi vị trí do bộ sinh đặt là nhãn chuẩn trong trường hợp đó. Nhiều nét thiếu có thể thay đổi khung bao và vẫn gây lỗi hình dạng; không giả vờ biết chắc ý định người viết. Chưa có bộ viết tay độc lập để hiệu chỉnh tiếp.

Di động hiện tại: `mobile/src/api/kanjiWriting.ts`, `mobile/src/screens/KanjiWritingScreen.tsx` dùng nhận dạng ảnh `/kanji/*`, chưa gọi `/kanji-writing/evaluate`; không có caller Expo phải sửa trong lượt này. Nếu tích hợp chấm nét sau, đọc `version`, dùng `expected_index` cho nét mẫu thiếu và giữ attempt ID khi retry.

File lượt này: `backend/app/core/kanji_writing_config.py`, `backend/app/services/kanji_stroke_geometry.py`, thêm `backend/scripts/calibrate_kanji_writing_alignment.py`, thêm `backend/tests/test_kanji_writing_alignment.py`, sửa test version trong `backend/tests/test_kanji_writing.py`; `frontend/src/components/kanji/WritingFeedback.tsx`, hai locale `common.json`, `frontend/tests/kanjiWriting.test.mjs`, tài liệu này và báo cáo Kanji. Không sửa bộ chọn chữ, bố cục hoặc các tab khác.

## Hoàn thiện phần B trên nhánh mobile — 25/11/2026

Giữ bộ chọn lưới và API đang có; hoàn thiện các lỗi tìm kiếm, truy cập bàn phím và đối chiếu kết quả v3. Không sửa thuật toán chấm, dữ liệu từ điển, lịch sử backend hay các tab Kanji khác trong phần B.

- Tìm nghĩa Việt không dấu vẫn giữ dấu thanh của kana: không đánh đồng が với か hoặc ぱ với は; hỗ trợ kana nửa chiều rộng. Lưới cuộn trong khung 224px, có số kết quả, liên kết tab/panel và một điểm Tab theo focus hiện tại. Tách trạng thái bộ chọn khi đổi tài khoản; ghi nhớ chữ/cấp theo tài khoản.
- Thẻ chữ ẩn ví dụ trống, thông tin phân biệt không có nét cụ thể và quy tắc trước khi nộp ở chế độ kiểm tra. Tái sử dụng toàn bộ khóa vi/en hiện có, token theme và cài đặt giảm chuyển động.
- Desktop từ 1024px có hai cột; với chiều cao từ 700px, thẻ mẫu bám dưới thanh đầu trang và tự cuộn trong vùng giới hạn. Màn hình nhỏ dùng một cột. Chọn xem lỗi đưa khung vẽ vào vùng nhìn thấy.
- Nét thừa có `expected_index=null` không được gán một nét mẫu theo chỉ số người viết. Nét thiếu dùng đúng `expected_index`. Phát lại toàn chữ hoạt động sau khi xem riêng một nét; xem lỗi mới quay về nét tương ứng. Nét thừa không tự phát một nét mẫu không liên quan.

File sửa của phần B: `frontend/src/features/kanjiWriting/practice.ts`; `frontend/src/components/kanji/{KanjiWriting,WritingCharacterPicker,WritingCharacterInfo,WritingReference}.tsx`; `frontend/src/components/kanji/kanjiWriting.css`; `frontend/tests/{kanjiWritingPractice,kanjiWriting}.test.mjs`; thêm `frontend/tests/kanjiWritingReference.test.mjs`; cập nhật tài liệu này và `docs/ket_qua/kanji.json`. `WritingFeedback.tsx` và khóa dịch nét thiếu đã sửa ở phần A, không phải thay đổi mới của phần B.

### Kết quả kiểm tra thật

- Backend: `venv/Scripts/python.exe -m pytest tests -q -p no:cacheprovider` — **441 đạt, 6 subtest đạt**, 26 cảnh báo thư viện cũ.
- Web: `node --test tests/*.test.mjs` — **85 đạt**, gồm 20 ca nhóm luyện viết. Thêm kiểm thử kana có dấu, bàn phím, lớp phủ thừa/thiếu v3, ẩn mục trống và phát toàn chữ sau khi xem một nét.
- `npm run build` web — đạt (17,39 giây), có cảnh báo kích thước chunk hiện hữu. ESLint các file TypeScript sửa — đạt. Kiểm tra khóa dịch web/mobile và TypeScript mobile — đạt.
- Edge headless: 1440×900 sáng/vi, 1024×768 tối/en, 768×1024 sáng/en, 390×844 tối/vi và 320×640 tối/en đều không tràn ngang. Desktop thấy mẫu và khung vẽ cùng lúc; lưới giữ 224px, bàn phím và thông báo cấp trống đạt. Đã xem ảnh desktop sáng và điện thoại tối.
- Kiểm tra tương tác bằng sự kiện PointerEvent mô phỏng: lớp phủ, phát riêng/toàn chữ, nét thừa giữa chuỗi, bốn tiêu chí, ẩn gợi ý và không gọi preview ở chế độ kiểm tra, xem lại sau nộp và khôi phục chữ đã chọn đều đạt. **API xác thực/chấm/lịch sử được giả lập**, dùng thành phần thật và danh mục 612 chữ; pointer capture được giả lập. Thử sự kiện chuột native CDP chưa tạo được nét trong harness, nên không tính là kiểm chứng chuột/cảm ứng thật. Không sửa mã sản phẩm dựa riêng vào lỗi harness này.

Giới hạn nghiệm thu: chưa kiểm chứng thiết bị thật, bút, máy tầm trung, thời gian phản hồi qua mạng thật hoặc lưu phiên end-to-end với tài khoản thật. Bộ thử backend kiểm tra lưu kết quả riêng; trình duyệt giả lập không thay thế kiểm tra tích hợp thật. Chưa có đo hiệu năng để khẳng định cần ảo hóa; lưới lớn nhất hiện có 367 chữ và đã ghi nhớ phép lọc/tổng hợp bằng memo.

Expo vẫn dùng `mobile/src/api/kanjiWriting.ts` và `mobile/src/screens/KanjiWritingScreen.tsx` cho `/kanji/*`, chưa dùng `/kanji-writing/evaluate`. Không có thay đổi mobile hoặc hợp đồng API trong phần B.

### Checklist phần B trên thiết bị thật

- [ ] Desktop: mẫu và canvas cùng nhìn thấy; mở ví dụ/quy tắc không kéo dài cột mẫu; thử sáng/tối, vi/en, giảm chuyển động.
- [ ] Tablet/điện thoại: một cột, không tràn ngang; chọn lỗi đưa canvas vào tầm nhìn; nét vẽ không cuộn trang khi dùng ngón tay/bút.
- [ ] Lưới: tìm nghĩa Việt không dấu, On/Kun, kana có dấu; tab thiếu dữ liệu; phím mũi tên/Home/End; trước/sau/ngẫu nhiên, gợi ý, gần đây và trạng thái lịch sử.
- [ ] Hoàn tác/viết lại/gợi ý/chấm/lưu với backend thật; kiểm tra điểm và chữ đúng sau tải lại, không lẫn hai tài khoản.
- [ ] Đối chiếu nét thiếu/thừa, đảo hướng/thứ tự; phát một nét rồi toàn chữ. Chế độ kiểm tra không hiện mẫu/quy tắc/gợi ý trước nộp.
- [ ] Kiểm tra lại các tab học chữ, nhận dạng, luyện viết và khám phá; báo chấm sai có xác nhận vẫn lưu được.

## Năm mức chấm và phản hồi rõ hơn — 26/11/2026

Giữ mẫu thứ tự nét để người học đối chiếu trong lúc luyện; chế độ kiểm tra
vẫn ẩn mẫu và gợi ý trước khi nộp. Tab xem thứ tự nét riêng đã được loại bỏ;
mẫu và gợi ý nét tiếp theo vẫn có trong chế độ học. Không dùng nhận dạng toàn chữ
để quyết định điểm cho chữ mục tiêu.

Phiên bản cấu hình `stroke-rules-v3.1` bổ sung hai mức ngoài ba mức cũ:

| Mức | Mã API | Khoảng cách nét | Khoảng cách đầu/cuối | Tỉ lệ độ dài tối thiểu |
| --- | --- | ---: | ---: | ---: |
| Rất dễ | `very_easy` | 0,24 | 0,38 | 0,30 |
| Dễ | `easy` | 0,20 | 0,32 | 0,35 |
| Chuẩn | `standard` | 0,16 | 0,26 | 0,42 |
| Nghiêm | `strict` | 0,10 | 0,17 | 0,60 |
| Rất nghiêm | `very_strict` | 0,085 | 0,145 | 0,65 |

Các khoảng cách dùng khung bao chuẩn hóa của cả chữ. Giữ nguyên ngưỡng và
điểm số của `easy/standard/strict`; không tăng số mức bằng cách đổi nhãn cho
cùng một ngưỡng. Mỗi kết quả vẫn lưu phiên bản, tên mức và ngưỡng đã dùng.
API cũ và mặc định `standard` được giữ; phản hồi bổ sung `score_weights` và
`pass_score`. Dữ liệu nằm trong JSON kết quả hiện có, không cần đổi bảng.

Điểm tổng tiếp tục gồm thứ tự 20%, hướng 20%, hình dạng/vị trí 40%, đủ nét
20%. Web hiển thị số điểm mỗi tiêu chí đóng góp, số lỗi từng loại, giải thích
điều kiện đạt và mức khớp hình dạng/độ dài theo từng nét. Các số đo từng nét
được tính từ metrics và ngưỡng của chính kết quả; không tạo điểm giả cho nét
thiếu/thừa hoặc kết quả cũ thiếu metrics. Cảnh báo chữ dễ nhầm không trừ điểm.
Điểm từ 80 nhưng còn lỗi vẫn không đạt; thông báo này được giải thích rõ.

Đo bằng `scripts/calibrate_kanji_writing.py --strictness <mã> --output <file>`:
32 chữ có biến thể viết đúng, trải đều N5/N4/N3; 256 biến thể viết đúng; 32 ca
cho mỗi loại lỗi thứ tự, hướng, thiếu, thừa, sai hình; thêm 6 ca chữ dễ nhầm.
Tổng 422 ca cho mỗi mức, 36 chữ khác nhau tính cả ca dễ nhầm.

| Mức | Chấp nhận viết đúng trước | Sau | Phát hiện thứ tự/hướng sau |
| --- | ---: | ---: | ---: |
| Rất dễ | Chưa có | 256/256 (100%) | 32/32 mỗi loại |
| Dễ | 256/256 | 256/256 (100%) | 32/32 mỗi loại |
| Chuẩn | 256/256 | 256/256 (100%) | 32/32 mỗi loại |
| Nghiêm | 252/256 | 252/256 (98,44%) | 32/32 mỗi loại |
| Rất nghiêm | Chưa có | 238/256 (92,97%) | 32/32 mỗi loại |

Cả năm mức phát hiện 32/32 ca thiếu, thừa, sai hình và 6/6 ca dễ nhầm; không
cảnh báo nhầm trên 256 biến thể đúng. Đây là **dữ liệu mô phỏng từ KanjiVG**,
không phải tỷ lệ đúng của người viết thật. Không tuyên bố cải thiện độ chính
xác ba mức cũ; thay đổi lần này mở rộng lựa chọn và làm rõ phản hồi. Mức Rất
nghiêm có thể từ chối dao động tay tự nhiên hơn; cần người biết tiếng Nhật
rà soát nét tay thật, nhất là bút/ngón tay trên màn hình nhỏ. Dùng nút báo
chấm sai có xác nhận để thu thập ca hiệu chỉnh, không tự coi báo cáo là nhãn đúng.

Expo hiện chỉ dùng `/kanji/*` cho nhận dạng trong `mobile/src/api/kanjiWriting.ts`,
chưa dùng dịch vụ chấm nét `/kanji-writing/evaluate`; lượt này không sửa màn
di động. Khi tích hợp sau, có thể dùng lại năm mã mức và metadata điểm này.

Web học chữ được thêm bước nhớ trước khi mở nghĩa, quiz che cách đọc/nghĩa
trước khi trả lời, dải chọn nhanh và vòng tiến độ phiên. Mở nghĩa không tự
tính đã ôn. Khối chuyển bộ thẻ cũ trên trình duyệt đã bỏ khỏi giao diện, nhưng
không xóa dữ liệu cục bộ hoặc API chuyển dữ liệu.

Tạo tài liệu từ file vẫn ở **Thư viện → Thêm tài liệu → Chọn file từ máy tính**;
sau trích xuất cần xem lại nội dung và lưu. Không sửa bộ trích xuất trong lượt này.

Kiểm thử: 108 test frontend; 518 pytest và 6 subtest đạt; các test mới bao gồm
5 mức, lưu/retry riêng từng mức, ngưỡng cũ không đổi, thiếu/thừa không bị suy
thành sai thứ tự, đếm đồng thời lỗi hướng/thứ tự và điều kiện điểm cao chưa đạt.
Các kiểm tra trình duyệt dùng adapter riêng và kết quả chấm thật đã tính offline;
không thay thế nghiệm thu mạng, tài khoản, thiết bị thật hay bút thật.

### Checklist bổ sung

- [ ] Thử cả năm mức với cùng một chữ/nét tay thật; so điểm và phản hồi giữa các mức.
- [ ] Tổng trên 80 nhưng sai hướng/thứ tự phải giải thích chưa đạt; nét thiếu/thừa không có điểm hình dạng tự tạo.
- [ ] Kiểm tra ẩn mẫu trong chế độ kiểm tra, chấm/lưu/retry, xem lỗi và gửi báo chấm sai.
- [ ] Học chữ: mở nghĩa không tăng tiến độ; quiz không lộ cách đọc/nghĩa trước trả lời; chọn chữ và lọc cấp không lẫn tiến độ.
- [ ] Không còn khối bộ thẻ cũ; dữ liệu cục bộ vẫn được giữ nguyên.

## Checklist nghiệm thu (tổng thể)

- [ ] Viết gần mẫu, đổi kích thước/vị trí; không trừ oan thứ tự/hướng vì lệch hình.
- [ ] Hoán đổi, đảo hướng, thiếu/thừa/sai hình: đúng nhãn lỗi; thử cả ba mức chấm.
- [ ] Chữ dễ nhầm có nét phân biệt khi cảnh báo, không làm giảm điểm; ca mơ hồ không kết luận chắc chắn.
- [ ] Tìm kiếm, tab thiếu dữ liệu, điều hướng bàn phím, gợi ý/gần đây và nhớ chữ theo tài khoản.
- [ ] Desktop thấy mẫu cùng canvas; tablet/điện thoại không tràn ngang; thử theme sáng/tối, vi/en và giảm chuyển động.
- [ ] Hoàn tác, viết lại, gợi ý, chấm/lưu và báo chấm sai có consent vẫn hoạt động; kiểm tra không lộ mẫu trước khi nộp.
- [ ] Hai tài khoản không lẫn lịch sử; retry không tăng số lần; xuất/reset/xóa bằng tài khoản thử.
- [ ] Nghiệm thu bút/thiết bị thật, máy tầm trung và các tab Kanji khác; chưa coi kiểm thử mô phỏng là độ chính xác người viết thật.
