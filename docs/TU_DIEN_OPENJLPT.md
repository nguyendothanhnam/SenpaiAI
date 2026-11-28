# Nguồn từ vựng OpenJLPT và API từ điển

Ngày 25/11/2026, nhánh **develop**, nền `3a75700e3f`. Làm trong worktree `E:/AI/DACN/tmp/openjlpt-develop`; không sửa hoặc gộp các thay đổi chưa commit của workspace `mobile` tại thư mục gốc. Không cài thêm thư viện, không tải model. Không tạo trang từ điển mới trong lượt này; bổ sung API và ghi công trong Settings web/mobile.

## Nguồn thật và giấy phép

[OpenJLPT](https://github.com/evanclan/OpenJLPT) **0.3.0**, commit `0d1d3410bec90bd4098a7c72de820543cb4f707c`. Tải 5 JSON từ vựng N5–N1, `meta.json`, schema, README, NOTICE, LICENSE: **5.787.675 byte, khoảng 5,52 MiB**. Chỉ lưu dưới `backend/downloads/openjlpt/<commit>/`, được Git bỏ qua. Manifest có URL, kích thước và SHA-256 từng tệp; đọc lại phải khớp checksum. Không tải JSON Kanji/ngữ pháp, SQLite upstream, ảnh, mô hình hay bộ dữ liệu khác. Fixture 17 mục được trích nguyên từ dữ liệu thật, có ghi công/commit.

Schema thực tế có `id`, `word`, `reading`, `romaji`, `meanings` (nghĩa Anh), `level`; có thể có `pos` (mã JMdict), `jmdict_id`, `other_forms`, `other_readings`, `examples`. Ví dụ giữ `ja`, `en`, `furigana` theo dạng `{漢字|かんじ}`, `tatoeba_id`; không biến câu ví dụ Anh thành nghĩa Việt. Cấp lấy từ danh sách cộng đồng Jonathan Waller, **không phải danh sách chính thức của JLPT**. Không dùng trường JLPT hệ bốn cấp cũ của KANJIDIC để thay cấp hiện tại.

Dữ liệu OpenJLPT/phái sinh: **CC BY-SA 4.0**; ghi công OpenJLPT và nguồn upstream trong [NOTICE](https://github.com/evanclan/OpenJLPT/blob/0d1d3410bec90bd4098a7c72de820543cb4f707c/NOTICE.md). Waller cung cấp cấp và nghĩa Anh; JMdict/EDRDG cung cấp mã, POS và đối chiếu cách đọc; Tatoeba cung cấp ví dụ **CC BY 2.0 FR**, có liên kết ID tới câu/người đóng góp. README dự án và Settings vi/en đã thêm ghi công, giới hạn cấp độ và nhãn nghĩa. Giữ các giấy phép tương ứng khi phân phối dữ liệu; không đổi giấy phép toàn bộ mã ứng dụng thành giấy phép dữ liệu.

## Thiết kế tối thiểu và bảo toàn dữ liệu

Giữ bảng `vocabulary`, cột `meaning` bắt buộc cho nghĩa Việt, ràng buộc duy nhất `(japanese_word, reading)`, CHECK N5–N1 và bảng `vocabulary_kanji`. Thêm `meaning_en`, `meaning_vi_status`, `meaning_vi_source`, `source`, `source_id`, `jmdict_id`, `dataset_version`, `source_metadata`, `search_text`, `translation_attempted_at`. Ví dụ dùng lại JSON `example_sentences`, không thay các ví dụ cũ.

- Nghĩa Việt cũ không bị importer ghi đè, kể cả bản tự động đã tồn tại. Bản cũ chưa có cờ duyệt được bảo vệ như `reviewed`; đây là chính sách bảo toàn, không phải chứng nhận giáo viên đã rà từng bản ghi.
- Bản mới chỉ có Anh: `meaning=''`, `meaning_en` có giá trị, trạng thái `missing`. Không nhét tiếng Anh vào cột Việt. Adapter cũ trả `[EN] ...`; giữ nguyên tên/kiểu các trường API cũ.
- `reviewed` dùng được làm nghĩa/đáp án. `automatic` hiển thị riêng trong API chi tiết với nhãn chưa duyệt; adapter chấm bài vẫn dùng Anh, tránh dùng dịch AI làm đáp án. `missing` dùng Anh. Khóa dịch/nhãn dùng namespace `common.dictionaryData` chung vi/en.
- Nghĩa Anh có nguồn OpenJLPT; nghĩa Việt có nguồn `legacy`/`local_ai` riêng, không nhận là nghĩa do OpenJLPT cung cấp. Ví dụ giữ nguồn/giấy phép Tatoeba; mã JMdict không bị dùng thay mã ổn định OpenJLPT.

Migration **0014 nối 0013 của develop**: kiểm tra cột/chỉ mục trước khi thêm, điền chỉ mục tìm kiếm cho bản cũ, chạy upgrade lại an toàn. Downgrade có kiểm tra và **từ chối khi còn dữ liệu Anh/nguồn/bản dịch mới**, tránh làm mất dữ liệu; chỉ chạy lại downgrade an toàn khi không có dữ liệu mới cần bảo toàn. Không sửa migration cũ.

**Không áp dụng lên DB vận hành của mobile.** Hai nhánh có lịch sử migration khác nhau; không ép DB về `0013` hoặc chạy migration này như thể nó nối tiếp nhánh mobile. Khi triển khai/gộp nhánh cần chọn đúng DB và head. Chuỗi migration cũ `0001` dùng `DEFAULT now()` của PostgreSQL nên lệnh upgrade nguyên chuỗi trên SQLite thử nghiệm thất bại; đã giữ nguyên mã cũ. Migration mới được kiểm thử thật bằng Alembic Operations trên schema cũ, upgrade/downgrade lặp lại và trường hợp từ chối mất dữ liệu. Chưa chạy PostgreSQL vận hành.

## Nhập dữ liệu

Importer chuẩn hóa NFKC, ghép theo **từ và cách đọc** (cách đọc kana chuẩn hóa), giữ ID nội bộ, nghĩa Việt, ví dụ cũ và nhãn cấp cũ nếu khác nguồn. `source_metadata.source_level` giữ cấp upstream để nhìn thấy khác biệt. Không ghép chỉ theo Kanji hoặc JMdict ID. Nếu ID nguồn đã thuộc một cặp khác, hay dữ liệu cũ có nhiều cặp trùng sau chuẩn hóa, bỏ qua để rà tay thay vì sửa khóa/tiến độ.

Đọc toàn catalog, kiểm tra bản ghi, nạp/flush theo lô mặc định 500 trong một transaction; lỗi dữ liệu được báo và bỏ qua, lỗi DB rollback transaction. Chạy xem trước không ghi cả bảng lẫn trạng thái nguồn; nhập lại không thêm ví dụ/quan hệ trùng. Không đổi cấu hình model hoặc dịch bất kỳ từ nào trong importer.

Từ thư mục backend của worktree, dùng Python môi trường hiện có (`E:/AI/DACN/backend/venv/Scripts/python.exe` trên máy này). Với DB PostgreSQL dành cho **develop** đã xác nhận đúng head:

```powershell
# Cấu hình DATABASE_URL/.env cho DB develop trước; không dùng nhầm DB mobile.
python -m alembic upgrade head
python scripts/import_openjlpt.py --download --download-only
python scripts/import_openjlpt.py --report downloads/openjlpt/preview.json
python scripts/import_openjlpt.py --write --batch-size 500 --report downloads/openjlpt/applied.json
python scripts/import_openjlpt.py --write --report downloads/openjlpt/rerun.json
python scripts/report_vocabulary.py --benchmark --output downloads/openjlpt/inventory.json
```

Không có `--write` là xem trước. `--source-dir` đọc bản đã tải có manifest; không cần tải lại. `--revision` phải là SHA đầy đủ, không dùng nhánh động; nếu cập nhật nguồn hãy chọn thư mục riêng và lưu manifest/NOTICE/LICENSE mới. Đường tải phải nằm trong dự án; không cài package OpenJLPT. CLI từ chối nhập nếu chưa có các cột migration mới.

## API dùng chung

Đăng ký cả có/không tiền tố `/api` theo quy ước cũ, DTO có trong OpenAPI:

| API | Hành vi |
| --- | --- |
| `GET /api/dictionary?q=taberu&jlpt_level=N5&pos=v1&limit=50&offset=0` | Tìm Kanji/kana, romaji, Anh, Việt có/không dấu; POS là mã JMdict hoặc POS cũ, tùy bản ghi. Khớp từ/cách đọc/romaji chính xác trước, rồi tiền tố, rồi chứa chuỗi. |
| `GET /api/dictionary/{id}` | Nghĩa và nguồn từng nghĩa, trạng thái Việt, cấp đang dùng/cấp nguồn, ví dụ/furigana, biến thể và Kanji liên quan. Không gọi AI. |
| `POST /api/dictionary/{id}/translation` | Cần đăng nhập, không có nội dung dịch tùy ý; chỉ dịch một mục có sẵn theo yêu cầu. Trả `disabled`, `cached`, `generated`, `unavailable`; 429 khi vượt giới hạn. |

Trang tìm kiếm giới hạn 1–100 mục, offset tối đa 10.000, q tối đa 100 ký tự; escape `%`/`_`. `meaning_vi` mới có thể null, `meaning_en` riêng, `display_meaning` có nhãn `[EN]`, `meaning_vi_status` là `reviewed/automatic/missing`. `notices` chứa khóa i18n. Nghĩa trong `meanings[]` có ngôn ngữ, trạng thái, nguồn và phiên bản; DTO dùng được cho React Native.

Importer bổ sung liên kết tới các Kanji DB đã có, đúng vị trí chữ, không tạo/sửa Kanji. Chi tiết cũng đối chiếu từ điển Kanji JSON hiện có; chữ ngoài độ phủ trả `available=false`, không bịa dữ liệu. URL là API tra Kanji; mục chỉ có ở DB dùng ID số để tránh liên kết tới endpoint chữ không có trong JSON.

Tìm kiếm dùng `search_text` chuẩn hóa, tự cập nhật khi ghi ORM, và backfill qua migration. Chỉ mục giữ cho cặp từ/cách đọc, nguồn/ID, JMdict, romaji, cấp/POS. Tìm chứa chuỗi không dấu vẫn quét trường chuẩn hóa; không tuyên bố B-tree tăng tốc mọi truy vấn. Với khoảng 7.800 mục, đo thực tế còn trong phạm vi nhỏ; khi kho tăng lớn cần đánh giá trigram/FTS PostgreSQL riêng, không tự cài extension.

## Dịch một từ bằng AI

Mặc định `DICTIONARY_AI_TRANSLATION_ENABLED=false`. Có thể bật sau kiểm tra mô hình đang cài; không pull model. Khi người dùng mở chi tiết, client đọc GET trước; chỉ POST nếu người dùng yêu cầu dịch. Cache lưu vào bảng, gắn `automatic`, nguồn/model/thời điểm/phiên bản. Đã có nghĩa Việt thì trả cache và không dịch lại. Không có UI duyệt nghĩa mới trong lượt này; người quản trị phải rà trước khi đánh dấu `reviewed`.

Mặc định 5 yêu cầu/phút/người/worker, timeout 25 giây; cấu hình bằng `DICTIONARY_TRANSLATION_PER_MINUTE`. Cooldown/claim theo từ ở DB mặc định 60 giây, cấu hình `DICTIONARY_TRANSLATION_COOLDOWN_SECONDS`, ngăn gọi trùng từ ở nhiều worker. UPDATE cuối chỉ ghi khi nghĩa Việt vẫn rỗng, nên không đè bản duyệt xuất hiện trong lúc model chạy. Lỗi model/JSON/ngôn ngữ trả Anh, không lưu thông báo lỗi làm nghĩa. Kiểm tra ngôn ngữ chỉ là heuristic, vì thế luôn ghi nhãn chưa duyệt.

Quota theo người hiện là bộ nhớ mỗi worker, không phải quota toàn cụm; nếu nhiều worker, tổng có thể bằng số worker nhân hạn mức. Giữ AI tắt hoặc dùng một worker cho tới khi có quota dùng chung. Không dùng cache từ vựng làm dữ liệu riêng tư của người yêu cầu; chỉ gửi từ/cách đọc/nghĩa Anh công khai cho Ollama local.

## Kết quả thật và giới hạn

Nhập vào DB SQLite **riêng** `backend/downloads/openjlpt/catalog.sqlite3`, chuẩn bị bằng metadata SQLAlchemy để benchmark, không coi đó là chạy thành công cả chuỗi migration PostgreSQL. Xem trước và ghi đều thêm 7.811; lần hai **0 thêm, 0 cập nhật, 7.811 bỏ qua, 0 lỗi**. [Bằng chứng tóm tắt, manifest và phép đo](ket_qua/openjlpt.json).

| Cấp | Số từ | Việt đã duyệt | Có ví dụ | Có furigana |
| --- | --- | --- | --- | --- |
| N5 | 674 | 0 | 664 | 600 |
| N4 | 630 | 0 | 624 | 600 |
| N3 | 1.659 | 0 | 1.624 | 1.541 |
| N2 | 1.778 | 0 | 1.663 | 1.400 |
| N1 | 3.070 | 0 | 2.670 | 2.125 |
| Tổng | 7.811 | 0 | 7.245 | 6.266 |

0 nghĩa Việt là thuộc DB nhập thử mới từ nguồn Anh, không có nghĩa importer đã xóa nghĩa Việt trong DB hiện hữu. Test có dữ liệu Việt cũ xác nhận giữ nguyên. Không gọi AI thật hoặc dịch hàng loạt. Có 7.800 mục có JMdict ID; 11 mục còn lại giữ null, không tự tạo ID.

Benchmark 10 lần/7 kiểu truy vấn trên toàn 7.811 mục, gồm SQL count + trang kết quả + chuẩn bị dữ liệu JSON; trung bình khoảng **31–57 ms**, p95 khoảng **46–114 ms** trong lượt ghi nhận. Không gồm mạng, OpenAPI validation hoặc tải nhiều người; không suy ra PostgreSQL có cùng thời gian. Truy vấn Việt không dấu trả 0 trong DB nguồn Anh chưa có Việt; test có nghĩa Việt xác minh chức năng không dấu. Số từng truy vấn nằm trong JSON báo cáo.

Các nơi đã tích hợp, giữ hợp đồng cũ: `/vocabulary` GET/POST (POST vẫn cần Việt và chống trùng), daily vocab quiz/flashcard, ghép cặp từ vựng của Library. Mỗi cấp có hơn 4 nghĩa phân biệt nên đủ điều kiện tạo lựa chọn; nguồn mới cung cấp 7.811 nghĩa dùng được có nhãn Anh. Ghép cặp giữ giới hạn 200 ứng viên cũ, loại trùng mặt chữ/nghĩa trong một bộ để không có nhiều đáp án hợp lệ.

Đã xác minh **vocab_mcq_service/chat và phần lớn minigame vẫn dùng lexicon/static bank riêng**, không đọc bảng này trên develop. Không tự chuyển chúng sang nguồn mới trong lượt này. Bước sau: adapter lấy đúng cặp từ/cách đọc và cấp, dùng ID nguồn ổn định làm lịch sử chống lặp; placement chỉ tuyên bố cấp đã có câu kiểm chứng; daily dùng lại service chọn câu; trò chơi nhận bộ từ đã lọc/không lộ cách đọc khi cách đọc là đáp án. Chưa đổi thuật toán chọn câu, thưởng hoặc dữ liệu trò chơi.

Kiểm chứng: **25 ca mới** bằng 17 mục nguồn thật; nhóm liên quan **62 đạt + 4 subtest**. Toàn bộ backend **224 đạt, 8 lỗi Chat có sẵn, 6 subtest**; chạy riêng đúng 8 ca trên bản `app` từ HEAD gốc cũng lỗi đủ 8. Không sửa Chat ngoài phạm vi. Web **14 test đạt**, build đạt; i18n web/mobile và lint hai Settings đạt. Typecheck mobile còn lỗi có sẵn `KanjiDrawingCanvas.tsx:45`, `touchAction` không thuộc `ViewStyle`; file không thay đổi trong lượt này.

Chưa kiểm chứng PostgreSQL vận hành, AI thật, thiết bị thật hoặc giáo viên duyệt nghĩa/ví dụ. Checklist thủ công: tra từ đa cách đọc, Anh/Việt không dấu, mở ví dụ/furigana/nguồn/Kanji; kiểm tra daily/ghép cặp có `[EN]`; Settings vi/en, sáng/tối, màn hình nhỏ; thử AI tắt/mất kết nối và kiểm tra nhãn tự động trước khi bật ở môi trường thật.

## File thay đổi và quyết định còn lại

- Model/migration/config: `backend/app/models/database.py`, thêm `models/dictionary.py`, `core/config.py`, `alembic/versions/0014_openjlpt_dictionary.py`.
- API/service: thêm `api/dictionary.py`, `services/dictionary_service.py`, `services/openjlpt_import.py`, `services/vocabulary_text.py`; sửa `main.py`, `api/kanji.py`, `repositories/learning_content.py`, `services/daily_task_service.py`, `services/library_service.py`.
- Tool/test: thêm `scripts/import_openjlpt.py`, `scripts/report_vocabulary.py`, `tests/test_openjlpt_dictionary.py`, `tests/data/openjlpt_sample.json`.
- Ghi công: `README.md`, `.gitignore`, Settings web/mobile, `frontend/src/i18n/locales/{vi,en}/common.json`, tài liệu này và `docs/ket_qua/openjlpt.json`.

Quyết định cần khi triển khai: DB/head nào dành cho develop để áp migration và nhập thật; ai duyệt nghĩa Việt trước khi bật AI/đưa bản dịch vào bài tập. Việc gộp các sửa Chat/Canvas của mobile sang develop là lượt riêng, không tự gộp trong thay đổi từ vựng này.
