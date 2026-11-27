# Đánh giá và kiểm soát chất lượng Chat SenpaiAI

Cập nhật 24/11/2026, nhánh `mobile`. Giữ hợp đồng API và mô hình mặc định `gemma:2b`. Không tải model, không migration mới. Đo bằng route thật và tài khoản SQLite tách biệt; không tạo lịch sử trong tài khoản thật.

## Thiết kế để trình bày khi bảo vệ

Mô hình nhỏ có thể viết trôi chảy nhưng sai kiến thức. Vì vậy dùng chuỗi xử lý: **chọn ngôn ngữ → phân loại ý định → tra học liệu → giới hạn prompt → sinh và kiểm tra → thử lại tối đa một lần → trả lời an toàn → lưu lịch sử/nguồn**. Không dùng chính model để tự chấm độ đúng của nó.

Ngôn ngữ mặc định lấy `response_language` nếu có, sau đó `ui_language`. Chỉ đổi khi có yêu cầu trả lời rõ ràng hoặc văn xuôi tiếng Anh đủ dấu hiệu và không có tiếng Việt. Phân tích bảng chữ, từ chức năng Anh/Việt và dạng mệnh đề; loại phần trích dẫn/ngoặc khỏi quyết định. Thuật ngữ Latin đơn lẻ, tiếng Việt không dấu, câu Nhật kèm furigana/JLPT/keigo/N3/te-form dùng lựa chọn mặc định. Nội dung dịch có ngôn ngữ đích riêng. Có **56 ca hồi quy**, gồm câu Nhật kèm furigana ở cả giao diện vi/en. Bộ nhận diện luật vẫn có thể nhầm câu trộn khó hoặc tiếng lóng.

Ý định gồm Kanji, từ vựng, ngữ pháp, so sánh, dịch, phân tích, bài tập, văn hóa, chào hỏi, ngoài phạm vi và chưa rõ. Dùng từ điển Kanji, bảng từ vựng, mẫu ngữ pháp, câu ngân hàng công khai, bộ nhận dạng mẫu câu có sẵn và thư viện hệ thống. So sánh lấy hai mẫu; bài tập không lấy câu AI/riêng tư của người khác. Phân tích chỉ xác minh được một số thành phần thì ghi rõ giới hạn, không tự bịa bản dịch cả câu. Thiếu căn cứ thì nói chưa xác minh; câu mơ hồ hỏi lại một câu, ngoài chủ đề trả ngắn và dẫn về học tiếng Nhật.

Đã gỡ bốn phản hồi gắn câu cụ thể: phân tích `私は毎日学校へ行きます`, chọn mèo/chó, trắc nghiệm `学生`, dịch `今日は何をしましたか`. Mẫu cũ chuyển sang `tests/data/chat_legacy_regressions.json`; runtime không nhập đáp án kiểm thử. Trắc nghiệm dùng đối chiếu lựa chọn từ vựng tổng quát. Giữ **ba** tham chiếu theo mẫu đã rà soát (`は/が`, `に/で`, `から/ので`), vì đây là học liệu chứ không phải nhánh nhận diện nguyên câu hỏi. Dạng lịch sự `～ています` quy về `ている`, tránh khớp nhầm mẫu rộng `ます`.

Nguồn chỉ hiển thị khi liên quan trực tiếp, URL hợp lệ và không mang loại nội bộ. Tiêu đề do server tạo có bản vi/en; không trình bày điểm vector như độ tin cậy kiến thức. Không dùng ba tài liệu gần nhất nếu chúng không liên quan.

## Ngân sách và kiểm tra đầu ra

Chat dùng cấu hình riêng `CHAT_OLLAMA_CONTEXT=2048`, `CHAT_OUTPUT_TOKENS=350`; chưa tăng mặc định. Giữ toàn bộ system và câu hỏi hiện tại, ưu tiên căn cứ hơn lịch sử, bỏ lịch sử rồi cắt căn cứ khi thiếu chỗ. Câu hỏi và hướng dẫn đã quá dài thì đề nghị chia nhỏ. Ngân sách đầu vào dùng số byte UTF-8 bảo thủ và dự phòng template, **không gọi đó là số token đo được**. Phải kiểm tra lại biên này khi đổi tokenizer/model/template.

Mỗi lần gọi `/api/chat` ghi token thật Ollama trả về: `prompt_eval_count`, `eval_count`, `done_reason`, thời gian nạp/sinh, model/options và bộ nhớ từ `/api/ps`. `prompt_budget` ghi lượng byte/lịch sử/căn cứ và việc cắt ngữ cảnh. Log vận hành không ghi câu hỏi, câu trả lời, token đăng nhập hay định danh. Lỗi kết nối ghi không có số token. File đánh giá có thêm đầu ra ứng viên của câu thử tổng hợp để rà lỗi; không áp dụng vào lịch sử thật.

Kiểm tra văn bản thô trước khi lọc nhãn: ngôn ngữ, nhãn/prompt nội bộ, các cụm văn xuôi Trung Quốc nhận diện được, độ dài, cấu trúc theo ý định, ví dụ/cách đọc và căn cứ. Không cấm mọi chữ Hán: Kanji Nhật và chữ cũ được hỏi có thể hợp lệ. Phát hiện đầu ra hết hạn mức, chưa hoàn tất, khối code chưa đóng hoặc kết thúc dang dở. Vi phạm thử lại một lần, bỏ lịch sử không tin cậy và siết chỉ dẫn. Vẫn hỏng thì trả ngắn, đúng ngôn ngữ, thừa nhận thiếu căn cứ và đề nghị cung cấp ngữ cảnh. Các heuristic này không chứng minh câu qua kiểm tra là đúng; lọc Traditional Chinese cũng không bao phủ mọi trường hợp.

## Bộ đo và kết quả trước/sau

`backend/tests/data/chat_quality_v3_cases.json`: **96 câu, 12 nhóm × 8** — ngữ pháp, so sánh, từ vựng, Kanji, dịch Nhật–Việt, Việt–Nhật, phân tích, văn hóa, chào hỏi, ngoài phạm vi, ngôn ngữ trộn/không dấu và tiếp nối. Mỗi câu có tham chiếu, từ khóa và hạn độ dài. JSON có `manual_review.correctness/notes`; báo cáo Markdown có phiếu rà tay cho mọi câu và danh sách lỗi kèm câu trả lời/nguồn.

Runner gọi `send_message` thật. Offline ngắt ở ranh giới sinh AI, vẫn chạy tra cứu/fallback. Catalog chụp chỉ đọc: **34 tài liệu, 25 mẫu ngữ pháp, 0 dòng Vocabulary**; từ điển Kanji và từ vựng nhỏ có sẵn trong mã vẫn dùng. Đây là giới hạn độ phủ thật, không thêm đáp án để làm đẹp điểm.

Mốc trước chạy trước khi sửa runtime; bộ câu hỏi và checksum học liệu giữ nguyên. Rubric **v3.2** có tám tiêu chí: ngôn ngữ, cấu trúc, nhãn nội bộ, dấu hiệu văn xuôi Trung Quốc, từ khóa, cách đọc/nghĩa, nguồn, độ dài. Đã tách “thiếu bản dịch Nhật” khỏi “sai ngôn ngữ giải thích” và bổ sung các biến thể chữ Trung Quốc bị lọt khi rà tay. Chấm lại đáp án cũ trong bộ nhớ bằng cùng rubric, không sinh lại và không ghi đè baseline v3 gốc. Baseline có lỗi xử lý thật; vẫn giữ trong mẫu số.

Kết quả cuối, cả hai mốc chấm bằng v3.2; baseline JSON vẫn giữ rubric gốc và câu trả lời gốc:

| Chế độ | Điểm tự động trước → sau | Qua mọi kiểm tra / 96 | Qua từ khóa / 96 | Lỗi xử lý | Trung bình giây | p95 giây |
| --- | --- | --- | --- | --- | --- | --- |
| Không AI | 68,88 → 88,28 | 33 → 38 | 34 → 38 | 22 → 0 | 0,023 → 0,027 | 0,047 → 0,068 |
| Pipeline gemma:2b | 88,28 → 90,10 | 39 → 46 | 41 → 47 | 1 → 0 | 1,811 → 1,922 | 5,932 → 7,090 |

Kiểm tra ngôn ngữ: offline **76,04% → 100%**, có AI **96,88% → 100%**. Nhãn nội bộ và các dấu hiệu văn xuôi Trung Quốc trong rubric: sau sửa 100% ở cả hai chế độ. Nguồn 98,96%; cách đọc/nghĩa 83,33% offline, 85,42% AI. Đây đều là tỷ lệ qua heuristic, không phải xác minh chuyên môn.

Theo nhóm ở pipeline AI (điểm tự động trước → sau): grammar 78,12 → 79,69; comparison 84,38 → 79,69; vocabulary 96,88 → 82,81; kanji 92,19 → 95,31; ja_vi 95,31 → 93,75; vi_ja 79,69 → 81,25; analysis 84,38 → 95,31; culture 93,75 → 96,88; greeting 100 → 96,88; off_topic 90,62 → 96,88; mixed_language 75 → 92,19; follow_up 89,06 → 90,62. Không che các nhóm suy giảm: gỡ đáp án nguyên câu, yêu cầu cách đọc rõ hơn và từ chối khi không xác minh làm giảm một số điểm nội dung. Rà thô phát hiện model vẫn có thể bịa phiên âm và đổi từ Nhật sang chữ Trung Quốc; bổ sung guard sau lượt trung gian rồi đo lại đầy đủ. Không sửa từ khóa/câu hỏi để nâng điểm.

Dữ liệu đủ câu trả lời, lỗi và nhóm: [baseline 96 câu](ket_qua/chat_v3_baseline.json), [sau sửa 96 câu](ket_qua/chat_v3_after.json). Lượt cuối không lỗi thiết lập hội thoại; 54 lần trả kết quả model được ghi metadata cho các câu đích, prompt thật 133–390 token, đầu ra 19–116 token. Số lần thử trong JSON còn tính cả lượt tạo lịch sử; offline vẫn tính các lần chạm ranh giới sinh bị ngắt, không phải đã gọi Ollama. Thời gian trung bình/p95 AI tăng nhẹ do kiểm tra và thử lại; không tuyên bố tăng tốc.

**Điểm tự động không phải độ chính xác tiếng Nhật.** Chỉ 46/96 ca AI qua hết tiêu chí và 47/96 qua từ khóa; độ phủ nội dung vẫn hạn chế. Từ khóa đúng không chứng minh ngữ pháp, bản dịch, cách đọc hoặc quan hệ nguồn–nhận định đúng. Từ chối an toàn vẫn trượt từ khóa/cấu trúc nếu chưa trả lời được yêu cầu.

Chỉ **gemma:2b** khả dụng, chưa thể xếp hạng nhiều model. `--models available` chạy cùng corpus trên các model sinh văn bản Ollama liệt kê; không tải model hoặc đổi mặc định ứng dụng. Thời gian là một lượt local, có ảnh hưởng cache/tải máy; không phải SLA hay benchmark đồng thời.

Các mốc 72 câu/rubric v2 [trước](ket_qua/chat_baseline.json), [sau](ket_qua/chat_after.json) là lịch sử; không so trực tiếp với bộ 96 câu.

## Đo phần cứng trước khi đề xuất tăng context

[Số liệu thí nghiệm](ket_qua/chat_context_profile.json): RAM vật lý khoảng **15,7 GiB**, còn **1,06 GiB** lúc bắt đầu. Cùng prompt tổng hợp, hai lần cho mỗi cấu hình; token thật 688 đầu vào/22 đầu ra trong các lượt thành công:

| Context / giới hạn đầu ra | Lần đầu / lặp lại (giây) | Bộ nhớ model Ollama báo (GiB) |
| --- | --- | --- |
| 2048 / 350 | 2,900 / 2,780 | 1,70 |
| 4096 / 640 | 9,898 / 2,646 | 1,74 |
| 8192 / 640 | 9,349 / 2,574 | 1,93 |

Ollama báo phần model này ở VRAM; đây không phải RSS cực đại hoặc tổng bộ nhớ hệ thống. Đổi context gây nạp lại nên không coi lần đầu là thời gian ổn định. Model vẫn trả tiếng Anh trong thí nghiệm yêu cầu tiếng Việt: tăng context/output riêng lẻ chưa giải quyết chất lượng. Giữ **2048/350**, ưu tiên prompt ngắn và kiểm tra đầu ra. Chưa đủ bằng chứng để khuyên tự tăng; nếu thử 4096/640 cần đo thêm nhiều câu dài và tải thực tế, nhất là khi RAM còn ít.

## Chạy lại và rà soát

Từ `backend`, giữ nguyên baseline và ghi lượt mới ra tệp khác:

~~~powershell
$env:PYTHONHASHSEED='0'
.\venv\Scripts\python.exe scripts/evaluate_chat_quality.py --dataset tests/data/chat_quality_v3_cases.json --snapshot ../tmp/chat-v3-catalog.json --phase current --models available --modes offline,ai --output ../tmp/chat-v3-current.json
.\venv\Scripts\python.exe scripts/report_chat_quality.py --dataset tests/data/chat_quality_v3_cases.json --baseline ../docs/ket_qua/chat_v3_baseline.json --after ../docs/ket_qua/chat_v3_after.json --output ../tmp/chat-v3-comparison.md
.\venv\Scripts\python.exe scripts/profile_chat_context.py --output ../tmp/chat-context-new.json
.\venv\Scripts\python.exe -m pytest -q -p no:cacheprovider
~~~

Tái tạo đúng catalog cần giữ bản chụp `tmp/chat-v3-catalog.json`; xóa nó sẽ đọc catalog hiện tại và checksum có thể khác. Script so sánh từ chối bộ câu hỏi/học liệu khác checksum. Baseline gốc thuộc mã trước thay đổi trong lượt này (HEAD nền `86862bfecf`); không chạy mã mới rồi gắn nhãn baseline.

Nút **Hữu ích / Có lỗi**, hộp ghi chú vi/en, API phản hồi và script xem đã có từ migration 0020; tái sử dụng, không tạo bảng/nút trùng. Phản hồi gắn chủ sở hữu câu trả lời/hội thoại, có trong xuất dữ liệu và xóa/reset. Test kiểm tra phân quyền, cập nhật, xuất dữ liệu, cascade. Để xem:

~~~powershell
.\venv\Scripts\python.exe scripts/review_chat_feedback.py --rating incorrect --limit 100 --offset 0 --output ../tmp/chat-feedback-review.json
~~~

Mặc định ẩn định danh; ghi chú vẫn có thể chứa dữ liệu riêng tư. Người biết tiếng Nhật xác minh lỗi, ẩn thông tin cá nhân, viết tham chiếu rồi thêm ca hồi quy. Không tự nhập phản hồi chưa duyệt vào gold/học liệu. Nguồn ngữ pháp gồm [Irodori](https://www.irodori.jpf.go.jp/assets/data/Grammar_all.pdf), [Marugoto](https://a1.marugotoweb.jp/ja/grammar_topic5_10.php); ví dụ seed vẫn cần rà chuyên môn.

## File thay đổi và kiểm chứng

- Runtime: `backend/app/api/chat.py`; `core/config.py`; `services/chat_language.py`, `chat_quality.py`, `chat_knowledge.py`, `chat_grounding.py`, `chat_prompt.py`, `ollama_service.py`, `vocab_mcq_service.py`; thêm `services/chat_budget.py`.
- Đo lường: `services/chat_evaluation.py`; `scripts/evaluate_chat_quality.py`, `report_chat_quality.py`; thêm `scripts/profile_chat_context.py`.
- Test: thêm `tests/test_chat_v3.py`, ba corpus `chat_language_v3_cases.json`, `chat_quality_v3_cases.json`, `chat_legacy_regressions.json`; sửa `test_chat_language.py`, `test_chat_grounding.py`, `test_chat_intent_rules.py`, `test_chat_conversations.py`.
- Tài liệu: trang này, `docs/README.md`, ba tệp bằng chứng v3 trong `docs/ket_qua/`.

Toàn bộ pytest: **400 đạt, 6 subtest đạt**, 26 cảnh báo thư viện cũ; nhóm liên quan **134 đạt**. Web **79 test đạt**; build frontend, khóa dịch web/mobile và kiểu mobile đạt. Không sửa giao diện hoặc thêm chuỗi UI trong lượt này; phản hồi server mới có bản vi/en. Build còn cảnh báo Browserslist/bundle lớn.

Checklist thủ công chưa thay thế bằng test:

- [ ] UI vi/en: hỏi Nhật kèm furigana, Việt không dấu, keigo/JLPT; kiểm tra ngôn ngữ và tiêu đề nguồn.
- [ ] Yêu cầu rõ “trả lời bằng tiếng Anh”, văn xuôi tiếng Anh, tiếng Anh trích trong câu Việt; kiểm tra ngôn ngữ đích của bản dịch.
- [ ] Tiếp nối trong hội thoại, hai tài khoản tách biệt, nguồn liên quan, không lộ nhãn nội bộ.
- [ ] Ngắt Ollama, câu quá dài, đầu ra bị cắt: phản hồi an toàn, không trả mảnh câu hỏng.
- [ ] Điện thoại thật/trình duyệt đầy đủ: góp ý, giữ ghi chú khi mất mạng, tải lại/xuất dữ liệu; sáng/tối và trình đọc màn hình.
- [ ] Giáo viên rà ngữ nghĩa toàn bộ ca, đặc biệt bản dịch/ví dụ; thêm bộ giữ riêng chưa dùng hiệu chỉnh.

Chưa kiểm chứng ngữ nghĩa bởi giáo viên, tải đồng thời và thiết bị thật. Kho thiếu ví dụ/giải thích song ngữ nên nhiều câu bị từ chối thay vì suy đoán; cần bổ sung học liệu, không che bằng điểm ngôn ngữ cao. Quyết định còn cần: ai duyệt tham chiếu và có muốn cài thêm model để so sánh sau hay không. Không có quyết định chặn bản sửa này.
