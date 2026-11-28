# Dịch vụ chọn bài tập dùng chung

Các số kho và kiểm thử bên dưới là mốc riêng ngày 21/11/2026, trước đợt sửa Chat. Các lỗi Chat ghi ở mốc đó không phải trạng thái mới nhất; xem [mục lục](README.md) và [đánh giá Chat](DANH_GIA_CHAT.md) để đối chiếu. JSON kiểm kê chi tiết có thể sinh lại vào `tmp/`, bảng tóm tắt được giữ ở đây.

Phạm vi: Hằng ngày và luyện Ngữ pháp trên web/Expo, nhánh `mobile`. Placement/quiz có adapter để tích hợp sau; không thay chấm điểm, phần xếp trình độ hay logic trò chơi dùng chung.

## Thiết kế

Mã cũ của Hằng ngày chỉ loại nguồn hôm qua; Ngữ pháp chỉ xét câu đã trả lời. Vì vậy câu bỏ dở có thể lặp giữa hai luồng.

Migration **0016** nối **0015** thêm hai bảng:

- `exercise_history`: theo tài khoản và loại/mã nguồn, lưu vân tay SHA-256, nội dung chuẩn hóa, cấp/kỹ năng, số lần phục vụ, thời điểm, kết quả gần nhất, chuỗi đúng, hạn ôn và bối cảnh gần nhất.
- `exercise_deliveries`: từng lượt theo bối cảnh/mã phiên ổn định và kết quả. Khóa duy nhất ngăn tải lại làm tăng số lượt; trả lời lại không tăng chuỗi đúng.

Chọn quy tắc vì dễ giải thích và kiểm thử, không cần AI/kho vector ở bước chọn câu. Ghi lịch sử trong transaction tạo phiên/trả lời. PostgreSQL khóa theo người dùng; nhập seed/AI dùng advisory lock. Test SQLite không thay thế thử tải đồng thời PostgreSQL.

## Quy trình chọn

Hàm nội bộ `select_for_user(db, user_id, level, skill, count, context, constraints, candidates=...)` nhận adapter `Candidate`, không phụ thuộc cách chấm điểm. Từ vựng và flashcard cùng nguồn được hợp nhất.

1. Nạp lịch sử riêng của tài khoản bằng truy vấn chung.
2. Ưu tiên câu mới đúng cấp, rồi câu sai/đến hạn ngoài cooldown. Lấy bù từ cấp dễ hơn gần nhất, sau đó cấp khó hơn. Câu đúng chưa đến hạn chỉ ôn sớm khi hết lựa chọn mới/đến hạn phù hợp.
3. Cân bằng kỹ năng, dạng và tránh mẫu liên tiếp khi còn lựa chọn. Hằng ngày giữ tỷ lệ mục tiêu 4 Ngữ pháp, 3 Kanji, 2 từ vựng, 1 flashcard; thiếu nhóm thì phân bổ bù. Bộ lọc mẫu/ID vẫn giữ nguyên.
4. Không lặp nguồn hoặc nội dung trùng/quá giống trong cùng phiên, kể cả khi kho cạn. Hằng ngày vẫn cần tối thiểu **5 mục**, nếu thiếu trả `not_enough_content` như cũ.
5. Cooldown mặc định **7 ngày**, cấu hình `EXERCISE_COOLDOWN_DAYS` hoặc ràng buộc nội bộ. Chỉ nới khi toàn bộ kho được phép cạn câu ngoài cooldown; gắn `cooldown_relaxed` và hiện thông báo ôn tập vi/en.

Khoảng ôn theo chuỗi đúng: **1, 3, 7, 14, 30, 60 ngày**. Sai đưa chuỗi về 0, hạn ôn về 1 ngày. Hạn ôn không tự phá cooldown. Câu bỏ dở vẫn tính đã phục vụ; đáp án muộn từ lượt cũ không ghi đè kết quả lượt mới.

Ngữ pháp `bank`, `ai`, `mixed` đều qua selector cuối cùng. Sinh câu chưa phục vụ không ghi vào sổ. Cấp thật giữ trên từng câu; metadata `selection` tùy chọn mô tả lấy bù/ôn tập. Không đổi tên route, request hoặc các trường response cũ.

## Chống trùng và giới hạn

Chuẩn hóa NFKC, chữ thường, bỏ khoảng trắng/dấu câu/ký tự định dạng, rồi băm SHA-256. So gần đúng bằng `SequenceMatcher`, ngưỡng **0,94**, cho nội dung từ 12 ký tự và cùng dãy số. Câu ngắn/kanji chỉ loại khi trùng chuẩn hóa. Phân nhóm độ dài/dãy số giúp giảm số phép so lịch sử.

Ngữ pháp so câu ghép từ token, nhận định hoặc prompt kèm dạng chia, không dùng thứ tự lựa chọn MCQ. Áp dụng cùng bộ kiểm tra tại seed, hai đường lưu AI và lúc chọn. Không xóa câu trùng đã tồn tại.

Đây là giống ký tự, không phải hiểu tương đương ngữ nghĩa: có thể bỏ sót diễn đạt lại hoặc loại nhầm câu dài khác chi tiết nhỏ. Sổ giữ nội dung gần nhất của mỗi mã nguồn, chưa phải kho phiên bản bất biến. Lịch sử cũ nhiều ngày không tự backfill; nhiệm vụ cũ được bổ sung khi thực sự tải lại. Placement/quiz chưa ghi vào sổ chung trong đợt này.

## Tài khoản và điểm

Xuất dữ liệu thêm `exercise_history`, gồm thống kê và lượt phục vụ. Reset tiến độ/xóa tài khoản xóa sổ riêng của người dùng. Reset vẫn giữ nhiệm vụ Hằng ngày, mục nhiệm vụ và giao dịch điểm để chống thưởng lần hai. Tải lại nhiệm vụ cũ chỉ tái ghi lịch sử, không tạo nhiệm vụ/điểm mới. Backend vẫn chấm điểm.

## Chạy và báo cáo kho

Từ thư mục `backend`:

```powershell
.\venv\Scripts\python.exe -m alembic upgrade head
.\venv\Scripts\python.exe scripts/report_exercise_bank.py --days 30 --items-per-day 10 --output ../tmp/exercise-bank.json
.\venv\Scripts\python.exe -m pytest tests/test_exercise_selection.py tests/test_daily_task.py tests/test_grammar_practice.py -q
```

Script chỉ đọc, không gọi AI. Đếm nội dung khác nhau theo cấp/kỹ năng, dạng câu, số ngày đủ 10 câu mới nếu phân bổ bù và số ngày đúng tỷ lệ mặc định. Từ vựng/flashcard cùng nội dung không tính hai lần; RNG cố định cho báo cáo Kanji.

Kho local ngày 21/11/2026 sau chống trùng:

| Cấp | Ngữ pháp | Kanji | Từ vựng | Ngày đủ 10 câu mới nếu phân bổ bù |
| --- | ---: | ---: | ---: | ---: |
| N5 | 29 | 79 | 0 | 10 |
| N4 | 29 | 166 | 0 | 19 |
| N3 | 16 | 367 | 0 | 38 |
| N2 | 0 | 0 | 0 | 0 |
| N1 | 0 | 0 | 0 | 0 |

Đây là kho nguồn Hằng ngày/Ngữ pháp, không phải mọi JSON trong game/placement/Thư viện. Chưa cấp nào đủ tỷ lệ bốn nhóm trong 30 ngày. N3 nhiều câu nhưng chủ yếu Kanji. Cần bổ sung từ vựng, Ngữ pháp và N2/N1 theo `needs_content_by_default_category`; đợt này không tự thêm nội dung.

Migration kiểm tra bảng/index để chạy lại an toàn. Downgrade chạy lại được khi bảng rỗng và từ chối nếu còn dữ liệu để tránh mất lịch sử. Không thử downgrade/reset trên dữ liệu thật.

## Đo chất lượng và kiểm tra thủ công

Kết quả kiểm tra: build frontend đạt; web **40 test đạt**, mobile **138 đạt**, trò chơi dùng chung **71 đạt**; TypeScript/lint mobile và i18n web/mobile đạt. Nhóm selector/Hằng ngày/Ngữ pháp **62 test đạt**. Toàn bộ pytest: **266 đạt, 8 lỗi Chat đã tồn tại** (1 trong `test_chat_conversations.py`, 4 trong `test_chat_grounding.py`, 3 trong `test_chat_language.py`); không sửa Chat trong đợt này. Migration đã áp dụng trên PostgreSQL local; test upgrade/downgrade lặp chạy trên SQLite tách biệt. Kho dữ liệu thật chỉ được thống kê, không dùng để mô phỏng 30 ngày hay thử reset/xóa.

- Mô phỏng 30 ngày, 90 câu, 10 câu/ngày, cooldown 7 ngày: 90 lượt đầu không lặp, các lượt sau cách ít nhất 7 ngày.
- Test kho cạn, ngưỡng 5 mục, trùng cùng phiên, hai tài khoản, xuyên bối cảnh, bỏ dở, đáp án lặp/muộn, chuỗi đúng, lấy bù, seed/AI trùng; xuất/reset/xóa và bảo toàn chống thưởng trùng.
- Selector không quá 4 SELECT với kho 200 câu trong test; kiểm tra index `(user_id, fingerprint)`. Chưa phải benchmark p95/tải sản xuất.
- Chất lượng ngôn ngữ cần tập cặp câu do người biết tiếng Nhật gán nhãn rồi đo precision/recall. Chưa có tập này nên không công bố độ chính xác phần trăm.

Checklist chưa được chứng minh bằng test tự động:

- [ ] Hai tài khoản, Hằng ngày ↔ Ngữ pháp, cả câu chưa trả lời; thử bank/AI/mixed với AI thật và lỗi nhà cung cấp.
- [ ] Kho thiếu/cạn: cấp thật, nhãn ôn và nới cooldown bằng vi/en.
- [ ] Web màn hình nhỏ/sáng/tối/giảm chuyển động; Expo trên Android/iPhone thật.
- [ ] Tải lại/gửi lại/reset giữa nhiệm vụ: không thưởng lần hai.
- [ ] Xuất/xóa tài khoản thử nghiệm, dữ liệu người khác còn nguyên; thử tải đồng thời PostgreSQL.

Quyết định tiếp theo: có giữ cooldown 7 ngày; bổ sung cấp/kỹ năng nào trước; ai duyệt tập gán nhãn để hiệu chỉnh ngưỡng 0,94. Không cần quyết định thêm để chạy bản hiện tại.
