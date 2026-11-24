# Đo và cải thiện chất lượng chat SenpaiAI

Thực hiện trên nhánh `mobile`, giữ nguyên hợp đồng `/chat/message` và các prop cũ. Backend cải thiện câu trả lời cho client dùng API hiện tại; web thêm nút **Hữu ích / Có lỗi** và ghi chú ngắn. Không đổi mô hình mặc định, không tải mô hình mới, không tạo tài khoản/hội thoại thử trong dữ liệu thật.

## Vì sao chọn phương pháp này

Mô hình local hiện cấu hình `gemma:2b`, nhỏ và có thể tạo câu Nhật sai dù giải thích tiếng Việt trôi chảy. Chỉ sửa prompt không đủ. Dùng ba lớp: tra cứu chính xác trong học liệu; prompt theo loại câu hỏi và kiểm tra/thử lại một lần; thừa nhận thiếu căn cứ khi không thể xác minh. Không dùng chính mô hình nhỏ để tự tuyên bố câu trả lời của nó đúng.

Hiện trạng đã xác minh: có prompt vi/en, lọc nhãn nội bộ, kiểm tra ngôn ngữ, tham chiếu ngữ pháp và lọc RAG; trước thay đổi có 8 test Chat lỗi. Rà tay đầu ra cơ sở phát hiện mẫu てください bị giải thích như “phrasal verb”, ví dụ Nhật sai, chép hướng dẫn hệ thống, dịch Việt–Nhật nhưng chỉ lặp tiếng Việt và câu tiếp nối lệch yêu cầu.

## Bộ đánh giá và quy trình chạy

`backend/tests/data/chat_quality_cases.json` có **72 câu, 12 nhóm × 6**: ngữ pháp, so sánh, từ vựng, kanji, Nhật–Việt, Việt–Nhật, phân tích câu, chào hỏi, văn hóa, ngoài chủ đề, tiếp nối và thiếu căn cứ. Ca tiếp nối chạy cả câu hỏi trước qua pipeline thật trong cùng hội thoại. Mỗi ca có tham chiếu kỹ thuật, nhóm từ khóa bắt buộc, yêu cầu cách đọc/ví dụ/nguồn khi phù hợp; không tự coi tham chiếu là bộ chuẩn đã được giáo viên duyệt.

Runner gọi **hàm xử lý route thật**, dịch vụ Ollama thật và cơ chế truy xuất hiện có. Mỗi lượt dùng tài khoản/hội thoại trong SQLite riêng. Học liệu PostgreSQL chỉ đọc và chụp vào `tmp/chat-quality-catalog.json`: 34 tài liệu hệ thống, 25 mẫu ngữ pháp, bảng từ vựng hiện trống; từ điển kanji được dùng trực tiếp từ repo. Không thêm lịch sử đánh giá vào tài khoản người dùng thật.

Chế độ `offline` ngắt đúng ranh giới sinh AI, không giả lập câu trả lời: các nhánh tra cứu/từ chối/fallback vẫn chạy pipeline thật. Chế độ `ai` dùng toàn bộ pipeline kết hợp tra cứu và mô hình, không phải phép đo mô hình thuần. Bản chụp học liệu và checksum bộ câu hỏi giống nhau ở mốc cơ sở và lượt cuối. `PYTHONHASHSEED=0` giữ ổn định phần fallback embedding theo hash.

Chấm tự động bảy tiêu chí: ngôn ngữ, cấu trúc theo loại câu hỏi, không lộ nhãn nội bộ, không có các dấu hiệu văn xuôi Trung Quốc đã biết, từ khóa nội dung, dấu hiệu cách đọc/nghĩa, nguồn có nhãn công khai và tiêu đề liên quan. **Không cấm toàn bộ chữ Hán**, vì tiếng Nhật cũng dùng Kanji. Kiểm tra từ khóa không chứng minh câu Nhật/bản dịch đúng; kiểm tra kana/romaji không chứng minh cách đọc đúng; tiêu đề nguồn liên quan không chứng minh từng nhận định được nguồn hỗ trợ.

Trong khi rà soát đã sửa lỗi rubric: văn bản Latin thông thường từng bị coi là phiên âm. Rubric cuối **`chat-quality-v2`** yêu cầu kana/romaji trong ngoặc hoặc nhãn cách đọc. Các đầu ra mốc cơ sở được chấm lại cùng rubric từ câu trả lời thô; tóm tắt rubric cũ vẫn được giữ trong JSON. Không sửa câu hỏi/tham chiếu để làm đẹp số điểm.

Kết quả đầy đủ, điểm từng nhóm, thời gian và câu lỗi kèm đầu ra: [mốc trước](ket_qua/chat_baseline.json), [mốc sau](ket_qua/chat_after.json). Báo cáo Markdown để rà tay được sinh vào `tmp/` bằng lệnh bên dưới, không lưu thêm một bản lặp của toàn bộ câu trả lời trong docs. Đây là điểm kiểm tra tự động, **không phải tỷ lệ chính xác tiếng Nhật**. Các ca qua hết kiểm tra vẫn cần rà tay.

| Chế độ — 72 ca | Điểm rubric trước → sau | Đạt mọi kiểm tra | Lỗi xử lý | Trung bình giây trước → sau |
| --- | --- | --- | --- | --- |
| Không AI | 19,05 → 83,53 | 12 → 34 | 58 → 0 | 0,007 → 0,023 |
| Pipeline với gemma:2b | 78,57 → 83,53 | 19 → 33 | 0 → 0 | 2,237 → 0,553 |

Số liệu cùng rubric v2 và checksum học liệu/bộ ca, lấy từ hai JSON trên. Nhánh có AI cũng có thể trả bằng tra cứu mà không gọi model; bảng này không phải benchmark LLM thuần hoặc thử nghiệm nhiều model.

Khi bắt đầu đo, người dùng đang chuyển kho Ollama sang ổ D nên có một lượt không thấy model. Lượt đó không được dùng làm mốc so sánh. Sau khi kiểm tra lại, Ollama nhận `gemma:2b`; baseline và lượt cuối đều dùng model thật này. Chỉ có một model sinh văn bản được cài nên chưa xếp hạng được giữa nhiều model. Không tự chuyển sang mặc định `qwen2.5:3b` ghi trong mã cấu hình; giá trị cấu hình chạy thực tế vẫn là `gemma:2b`.

Lệnh từ thư mục `backend`:

```powershell
$env:PYTHONHASHSEED='0'
# Giữ nguyên baseline đã lưu; lượt kiểm tra mới ghi ra tệp khác.
.\venv\Scripts\python.exe scripts/evaluate_chat_quality.py --phase current --models available --modes offline,ai --output ../tmp/chat-quality-current.json
# Script so sánh ghi lại JSON đầu vào: chỉ chạy trên bản sao để giữ mốc gốc.
Copy-Item ../docs/ket_qua/chat_baseline.json ../tmp/chat-baseline-review.json
Copy-Item ../docs/ket_qua/chat_after.json ../tmp/chat-after-review.json
.\venv\Scripts\python.exe scripts/report_chat_quality.py --baseline ../tmp/chat-baseline-review.json --after ../tmp/chat-after-review.json --output ../tmp/chat-quality-comparison.md
.\venv\Scripts\python.exe -m pytest tests/test_chat_quality.py tests/test_chat_grounding.py tests/test_chat_language.py tests/test_chat_conversations.py tests/test_chat_intent_rules.py -q
```

`--models available` đo cùng bộ câu hỏi trên mọi mô hình sinh văn bản Ollama liệt kê; có thể chỉ định tên model đã cài. Chọn model chỉ trong tiến trình đánh giá và khôi phục sau chạy; không sửa cấu hình ứng dụng. Muốn tái tạo baseline phải dùng mã Chat trước thay đổi; không chạy mã sau sửa rồi ghi đè baseline. Các file Chat được sửa vốn ở commit `3fff19e849d5edf066dc45cb22f4c37705d4d3d3` trước lượt này; các thay đổi tính năng khác chưa commit từ trước vẫn được giữ nguyên.

## Thay đổi pipeline

- Phân loại câu hỏi để chọn hợp đồng trả lời gọn: công thức/ý nghĩa/ví dụ, so sánh đối chiếu, tra từ, dịch đúng hướng, phân tích từng phần hoặc văn hóa. Trợ lý không lặp nguyên hướng dẫn hệ thống.
- Nhiệt độ 0; kiểm tra cả đáp án dài thay vì chỉ thử lại đáp án gần rỗng. Kiểm tra hướng dịch, ngôn ngữ, nhãn/tiếng Trung, ví dụ, phủ định được yêu cầu và câu Nhật mới không có trong ngữ cảnh đã đối chiếu. Thử lại tối đa một lần. Lượt sửa bỏ lịch sử không tin cậy, chỉ giữ tham chiếu có cấu trúc đã biết nếu có.
- Từ điển Kanji, từ vựng và ví dụ ngữ pháp khớp chính xác trả trực tiếp, có nguồn. Dịch tra cứu chỉ dùng cặp câu khớp chính xác, không bỏ phủ định. Cách đọc từ bộ chuyển kana có sẵn là hỗ trợ hiển thị, vẫn cần rà các cách đọc theo ngữ cảnh.
- Lọc RAG đòi hỏi neo/từ khóa câu hỏi; bỏ fallback chỉ dựa vào điểm vector cao. Nguồn nội bộ/URL không hợp lệ bị lọc. Nếu không có tham chiếu không bịa ngữ pháp, nghĩa từ hoặc thông tin văn hóa. Các ví dụ seed vẫn cần người dạy kiểm tra; không đổi nhãn thành “đã được giáo viên duyệt”.
- Câu hỏi tiếp nối chỉ lấy lịch sử đúng người dùng/cuộc hội thoại và có giới hạn hiện có; nhận diện thêm “mẫu/chữ vừa rồi”. Yêu cầu biến đổi không được fallback sang đáp án cũ như thể đã làm đúng. Khi không thể đối chiếu ví dụ mới thì trả rõ chưa xác minh được.
- Bỏ nhánh trả nguyên ngữ cảnh tài liệu khi model lỗi. Giữ lỗi 503 cũ cho lỗi sinh câu trả lời tổng quát không có phương án tra cứu; các nhánh có căn cứ hoặc yêu cầu đã nhận diện có phản hồi phù hợp. Bản dịch chỉ do model đề xuất được gắn nhãn chưa đối chiếu học liệu.

Đã đối chiếu lại sắc thái から/ので để bỏ ranh giới “chủ quan/khách quan” tuyệt đối và bổ sung nguồn công khai: [Irodori – Japan Foundation](https://www.irodori.jpf.go.jp/assets/data/Grammar_all.pdf). Tham chiếu địa điểm に/で: [Marugoto – Japan Foundation](https://a1.marugotoweb.jp/ja/grammar_topic5_10.php). Hai kiểu giải thích có bản vi/en; không đưa prompt hoặc tên quy tắc nội bộ lên giao diện nguồn.

## Phản hồi người học và đưa ca lỗi vào bộ đo

Migration **0020 nối 0019**, tạo `chat_answer_feedback`: người dùng, mã câu trả lời, mã hội thoại từ câu trả lời, đánh giá, ghi chú tối đa 1.000 ký tự, thời điểm. Không dùng lại trường `ChatHistory.feedback` vốn chứa phản hồi ngôn ngữ. Khóa duy nhất theo người dùng/câu trả lời; đổi đánh giá cập nhật cùng bản ghi. Hai route bổ sung, được đăng ký cả có/không tiền tố `/api`:

- `GET /api/chat/answers/{message_id}/feedback`
- `PUT /api/chat/answers/{message_id}/feedback` với `{rating: "helpful" | "incorrect", comment}`.

Mọi thao tác kiểm tra chủ sở hữu câu trả lời; không tin user/conversation ID từ client. Web chỉ đọc phản hồi cũ khi mở form, tránh một truy vấn cho từng tin nhắn đang hiển thị. Khi mất mạng giữ ghi chú; cache có khóa người dùng. Có dịch vi/en, token theme, nút tối thiểu 44px và giảm chuyển động. Nguồn được ghi nhãn dễ đọc, giữ liên kết học liệu, ẩn nguồn nội bộ/URL nguy hiểm; không hiển thị điểm vector như độ tin cậy nội dung.

Xuất dữ liệu tài khoản có phản hồi; xóa câu trả lời/hội thoại/tài khoản hoặc đặt lại lịch sử sẽ xóa phản hồi tương ứng. Không đổi điểm thưởng, lịch sử chống thưởng trùng Hằng ngày hay năng lực hội thoại. Migration upgrade/downgrade chạy lại an toàn; downgrade từ chối nếu có dữ liệu. Đã áp dụng `0020` trên PostgreSQL local; không chạy lệnh xóa/reset/downgrade trên dữ liệu thật để thử.

Xuất phục vụ rà tay, từ `backend`:

```powershell
.\venv\Scripts\python.exe scripts/review_chat_feedback.py --rating incorrect --limit 100 --offset 0 --output ../tmp/chat-feedback-review.json
```

Mặc định bỏ user/conversation/message ID; chỉ thêm khi dùng `--include-identifiers` trên máy được phép rà soát. Ghi chú vẫn có thể chứa thông tin riêng tư: cần gỡ thông tin cá nhân trước khi thêm vào bộ câu hỏi. Script đã chạy thử đọc 0 phản hồi trong bảng mới, không ghi dữ liệu tài khoản.

Quy trình: người biết tiếng Nhật đọc câu hỏi/câu trả lời/nguồn → xác nhận lỗi và đáp án tham chiếu → ẩn dữ liệu cá nhân → thêm ca hồi quy → chạy lại và xem cả nhóm cải thiện lẫn suy giảm. **Không tự động đưa phản hồi chưa kiểm chứng vào gold hoặc học liệu sinh câu trả lời**; production không đọc bộ đáp án kiểm thử.

## Kiểm chứng và giới hạn

- Toàn bộ pytest: **308 đạt, 6 subtest đạt**; 8 lỗi Chat ban đầu đã được sửa. 8 test mới kiểm tra corpus/rubric, lỗi hướng dịch/ví dụ chưa xác minh, tra cứu giữ phủ định, phản hồi đúng chủ sở hữu, xuất/reset/cascade và migration. Nhóm Chat liên quan 50 test đạt; rubric sửa sau đó được kiểm tra lại riêng.
- **65 test web đạt**, gồm 4 test mới cho nguồn/vi-en, form gửi góp ý, giữ nội dung khi lỗi và hợp đồng API. Build frontend, i18n web/mobile, lint các file web đổi đều đạt; còn cảnh báo bundle lớn/Browserslist hiện hữu và cache pytest không ghi được trong sandbox.
- Trình duyệt với thành phần thật, đáp án/học liệu từ lượt đo và API phản hồi mô phỏng: 1280/768/390/320px, vi/en, sáng/tối và giảm chuyển động; không tràn ngang, gửi góp ý/thành công/lỗi mạng giữ ghi chú hoạt động. Không phải kiểm chứng luồng đăng nhập và lưu phản hồi thật xuyên suốt ứng dụng.
- Đo thời gian một lượt local, có ảnh hưởng cache/khởi động/tải máy. Nhanh hơn chủ yếu nhờ tra cứu và ít gọi model, không phải model được tăng tốc. Chưa benchmark nhiều người dùng đồng thời hay mô hình khác.
- Bộ đo thiên về câu hỏi tiếng Việt (có một ca chào hỏi tiếng Anh); kiểm tra vi/en bổ sung trong test. Tham chiếu, đọc kana, ví dụ seed và quan hệ nguồn–nhận định còn cần người biết tiếng Nhật duyệt. Một số yêu cầu dịch/so sánh/ví dụ mới được từ chối vì chưa có căn cứ; số câu chưa đạt vẫn được giữ trong báo cáo, không tính từ chối là trả lời đúng nội dung.

Checklist còn lại:

- [ ] Hai tài khoản thật: gửi/sửa góp ý, tải lại, xuất dữ liệu; xác nhận không đọc được góp ý của nhau.
- [ ] Kiểm tra trong shell ứng dụng đầy đủ, thiết bị thật, bàn phím và trình đọc màn hình.
- [ ] Giáo viên chấm ngữ nghĩa từng câu, đặc biệt bản dịch, cách đọc và ví dụ mới; mở rộng ca ngoài bộ đã dùng chỉnh sửa.
- [ ] Khi có mô hình khác đã cài, chạy cùng corpus/học liệu và lặp nhiều lượt đo; không đổi mặc định trước khi người dùng quyết định.

Quyết định còn cần sau: ai phụ trách duyệt tham chiếu/ca lỗi và có muốn cài thêm model để so sánh hay không. Không có quyết định chặn chạy bản hiện tại.

## Ngôn ngữ và hội thoại


Ứng dụng tiếp tục dùng Ollama với model cấu hình trong `OLLAMA_MODEL` (hiện là `gemma:2b`).

- Chat chỉ tạo hội thoại văn bản. API tạo hội thoại giọng nói không còn được đăng ký; dữ liệu hội thoại cũ được giữ trong cơ sở dữ liệu.
- Ngôn ngữ của câu hỏi hiện tại được ưu tiên. Hỏi bằng tiếng Việt thì giải thích bằng tiếng Việt; hỏi bằng tiếng Anh thì giải thích bằng tiếng Anh. Khi chỉ nhập tiếng Nhật, ứng dụng dùng ngôn ngữ giao diện làm lựa chọn mặc định.
- Câu yêu cầu dịch vẫn được dịch sang ngôn ngữ được chỉ định. Nếu nội dung đã ở đúng ngôn ngữ đích, Chat thông báo điều đó và hỏi ngôn ngữ người học thực sự muốn dịch sang.
- Lịch sử chỉ được gửi khi câu hỏi có tham chiếu tới nội dung trước. Các yêu cầu hỏi nghĩa hoặc dịch câu không lấy các trang Library chỉ giống nhau về điểm tìm kiếm làm nguồn.
- Các ví dụ ngữ pháp đã đối chiếu có bản tiếng Việt và tiếng Anh. Khi model giải thích sai các ví dụ này, ứng dụng dùng nội dung đã đối chiếu kèm nguồn.
- Phản hồi sai ngôn ngữ được thử tạo lại một lần. Nếu vẫn thất bại hoặc Ollama không kết nối được, API trả lỗi để người dùng gửi lại; không lưu thông báo lỗi thành câu trả lời trong lịch sử.

`gemma:2b` vẫn có thể trả lời chưa chính xác với nội dung ngoài phạm vi tài liệu đã kiểm chứng. Các kiểm tra này giảm lỗi định tuyến, ngôn ngữ và nguồn tham khảo; không phải hệ thống xác minh mọi kiến thức do model sinh ra.
