# Dựng dữ liệu lặp lại được trên develop

Ngày kiểm chứng: 26/11/2026. Công cụ dùng dữ liệu thật đã lưu trong repo hoặc snapshot OpenJLPT chính thức được ghim commit/checksum. Không tạo câu hỏi, nghĩa, vector hoặc WAV giả để làm đủ số lượng. Không sửa API, thuật toán ứng dụng, quy tắc Git hay dữ liệu cá nhân; startup chỉ thêm cảnh báo.

## Một lệnh thiết lập, một lệnh kiểm tra

Từ gốc dự án, sau khi đã tạo môi trường, cấu hình và PostgreSQL rỗng dành riêng cho develop:

```powershell
.\backend\scripts\setup_data.ps1 -Download -External
.\backend\scripts\setup_data.ps1 -CheckOnly
```

Tương đương từ `backend` trên Windows/Linux/Docker:

```text
python scripts/setup_data.py --download --external
python scripts/data_status.py
python scripts/data_status.py --json
python scripts/setup_data.py --inventory
python scripts/setup_data.py --groups grammar,listening
python scripts/setup_data.py --groups index --external
```

`-Download`/`--download` chỉ cho phép tải OpenJLPT đã ghim khi cache chưa có; không tải mô hình. `-External`/`--external` cho phép dùng Ollama có sẵn với `nomic-embed-text` và VOICEVOX đang chạy. Nếu không có, bước tương ứng báo SKIP, phần dữ liệu không phụ thuộc vẫn được nạp. Không có cờ thì không gọi hai dịch vụ này. `--check-only` hoàn toàn chỉ đọc, kể cả khi đi cùng cờ download/external; không migration, seed, tạo thư mục hoặc gọi mạng.

`--groups` tự thêm phụ thuộc và in kế hoạch trước khi chạy. Thứ tự: **schema → kanji → vocabulary → library → grammar → placement → listening → minigames → index → audio**. Dữ liệu nền được làm trước tác vụ ngoài; grammar không cần vector nên vẫn nạp khi Ollama tắt. Schema chạy Alembic, không dùng `create_all` hay tự stamp để che sai phiên bản. Khi một bước thật sự lỗi, exit 1 và dừng; các bước trước có thể đã commit nhưng chạy lại không tạo trùng. SKIP có lý do không được diễn giải thành mọi tính năng đã sẵn sàng. Kiểm tra tình trạng trả 0 nếu sẵn sàng, 2 nếu còn thiếu, 1 nếu không đọc được cấu hình/CSDL/dữ liệu.

## Kiểm kê đầy đủ script và migration

`--inventory` đọc AST, không thực thi các script, liệt kê mọi file Python trong `backend/scripts`, `scripts` và `backend/populate_data.py`, các cờ CLI thật, chuỗi migration và các launcher. Hiện có 18 script Python kể cả hai lệnh mới; 14 revision nối tiếp từ 0001 đến 0014. Đây là nguồn kiểm kê tự cập nhật khi thêm script.

| Script hiện có | Phụ thuộc, tác động và khả năng chạy lại |
| --- | --- |
| `populate_data.py` | Cũ, thêm trực tiếp grammar/vocabulary và dùng vector service; **không an toàn chạy lặp**, không được runner gọi |
| `seed_kanji_from_dictionary.py` | Sau migration; chỉ N3, xóa/tạo lại reading/example của N3 đang có. Runner dùng adapter cộng thêm N5/N4/N3 từ chính dictionary, giữ bản ghi cũ |
| `seed_grammar_practice.py` | Sau schema/library; không cần AI, nhận diện rule/câu theo khóa có sẵn, chạy lại bỏ qua |
| `seed_library_documents.py` | 33 tài liệu trong JSON; upsert theo title, lập chỉ mục có thể gọi Ollama/hash fallback. Runner dùng loader/validator, chỉ thêm thiếu, giữ nội dung cũ |
| `import_knowledge_library.py` | JSON/CSV/Markdown, 80 mục nguồn tri thức; upsert có tìm title gần đúng và lập chỉ mục. Runner dùng parser/formatter, không dùng phép cập nhật gần đúng |
| `import_openjlpt.py` | Kanji trước để tạo liên kết; snapshot ghim `0d1d3410bec90bd4098a7c72de820543cb4f707c`, checksum bắt buộc; `--download` dùng mạng; upsert theo từ+cách đọc, không ghi đè nghĩa Việt đã có |
| `seed_listening.py` | 17 hội thoại N5/N4/N3 từ repo. `--no-audio` chỉ lời thoại; tạo WAV cần VOICEVOX. Chạy lại không tạo bài trùng; không gọi Whisper để seed |
| `import_kanjivg.py` | Nhập SVG chính thức cục bộ, có thể ghi đè file output; cần chọn output/merge có rà soát, không tự chạy |
| `merge_kanji_n3.py` | Hai JSON N3 có sẵn; mặc định thêm thiếu/có backup; `--overwrite` thay dữ liệu cũ, không tự chạy |
| `repair_kanji_n5_n4.py` | Snapshot metadata/nghĩa Việt bổ sung; mặc định xem trước, `--write` sửa dictionary, không tự chạy |
| `generate_vapid_keys.py` | Sinh khóa riêng, không phải dữ liệu học; không chạy/tự lưu bí mật |
| `report_vocabulary.py`, `validate_kanji_dictionary.py` | Kiểm tra chỉ đọc |
| `scripts/build_minigame_catalog.py` | Dictionary và KanjiVG → catalog/stroke-catalog/license dùng chung web/mobile; ghi lại artifact. Runner chỉ kiểm tra bản đã commit, không tự đổi kho trò chơi |
| `scripts/setup_kanjivg.py` | `--clone` tải nguồn KanjiVG chính thức, sau đó tạo output. Tách khỏi thiết lập thường để không tự ghi lại dữ liệu Git |
| `scripts/validate_kanjivg_coverage.py` | Rà soát độ phủ nét, không sửa nguồn |
| `setup_data.py`, `data_status.py` | Orchestrator cộng thêm và kiểm tra chỉ đọc; PowerShell chuyển nguyên cờ/exit code |

Migration: 0001 lõi; 0002 kanji/vocab/liên kết và `pg_trgm`; 0003 description; 0004 điểm bài tập; 0005 grammar; 0006 rewards; 0007 daily; 0008 reminders; 0009 voice conversations; 0010 listening; 0011 ngôn ngữ; 0012 nội dung sinh từ library; 0013 chat conversations; **0014 OpenJLPT**. 0002 cần PostgreSQL và quyền tạo extension. Các migration cũ không được coi là tùy ý chạy riêng nhiều lần; runner để Alembic quản lý revision.

`database/init.sql` chỉ khởi tạo role/type/extension, không thay migration. Compose hiện có command backend tự tải mô hình rồi gọi `populate_data.py` cũ; không dùng command đó làm quy trình seed lặp lại. `setup-ollama.*` có tải mô hình, không được runner gọi. `start.*` chỉ là launcher ứng dụng.

## Đâu là dữ liệu Git, đâu là trạng thái máy

| Vị trí | Trạng thái và cách xử lý |
| --- | --- |
| `backend/app/data/kanji_dictionary*.json`, `kanjivg_strokes*.json` | Có trong Git; nguồn runtime. File N3 rời chỉ được đọc sau khi merge; không giả định thêm file là runtime tự nhận |
| `backend/scripts/data/kanji_n5_n4_{metadata,vi}.json` | Có Git nhưng chỉ script repair đọc, runtime không đọc trực tiếp |
| `library_documents.json`, `.en.json`, `japanese_knowledge_seed.json` | Có Git; runner nạp bản Việt 33 tài liệu và 80 mục tri thức. Bản en và ví dụ CSV/MD vẫn là nguồn tùy chọn, không nạp trùng tự động |
| `shared-games/{catalog,stroke-catalog}.json` | Có Git, không phải bảng DB. OpenJLPT trong DB không tự chảy vào kho minigame offline |
| PostgreSQL / Docker volume `postgres_data` | Không ở Git; cần migration và seed. Dùng DB riêng cho từng nhánh, không sao chép trạng thái DB của máy khác |
| `chroma_db/knowledge_vectors.json` | Bị bỏ qua bởi Git. Triển khai hiện tại là JSON + NumPy dù tên service là Chroma; cần dựng chỉ mục lại và restart backend vì index được giữ trong bộ nhớ |
| `backend/media/`, Docker `media_data` | Bị bỏ qua; WAV sinh bởi TTS phải tạo lại hoặc phân phối artifact được duyệt riêng |
| `backend/downloads/`, KanjiVG SVG cục bộ | Cache tải không đi cùng clone. Snapshot OpenJLPT có manifest/checksum; KanjiVG ngoài JSON phải có nguồn/giấy phép và đưa qua quy trình nhập có rà soát |
| `.env`, `.env.local`, `.env.*.local` | Bị bỏ qua; sao chép từ mẫu rồi cấu hình riêng. Các bí mật/tài khoản thật không đưa vào Git |
| `backend/models/`, model Ollama/Whisper, venv, node_modules | Cục bộ/volume/bỏ qua, không tự tải hoặc cài thêm bởi runner |
| `tmp/`, log, bản build | Artifact chạy thử, không phải nguồn dữ liệu dùng chung |

Không đổi `.gitignore` trong lượt này. Không chép DB, `.env`, token, index hoặc âm thanh cá nhân vào Git. Học liệu dùng chung cần được rà soát, ghi nguồn/giấy phép và commit qua file nguồn; cache lớn có thể phân phối bằng artifact có manifest. Mã OpenJLPT/0014 đang đi cùng checkout develop phải được đưa vào cùng thay đổi trước khi thành viên khác clone.

Chỉ mục setup chỉ nhận embedding thật 768 chiều từ `nomic-embed-text`; xác minh số hữu hạn/khác zero, gắn provenance, ghi file tạm rồi replace nguyên tử, giữ mọi record ngoài tài liệu nguồn và tạo một backup trước lần sửa đầu. Không gọi fallback hash của runtime. Nếu file bị tiến trình khác thay đổi trong lúc chạy, dừng thay vì đè. **Dừng backend khi dựng chỉ mục, sau đó bật lại**. Runtime fallback hiện có không bị đổi; nếu Ollama tắt khi truy vấn, chất lượng tìm kiếm vẫn có giới hạn như trước.

## Kết quả thực trên CSDL trống riêng

Đã tạo PostgreSQL `senpai_setup_verify_20261126_39a356c9`, không dùng DB ứng dụng. Thư mục vector/audio tách riêng trong `tmp/`; cố ý cấu hình hai dịch vụ ngoài vào cổng không có service. Nguồn OpenJLPT thật dùng lại cache đã xác minh, không tải thêm dữ liệu/mô hình hay cài thư viện trong lượt này.

| Loại | N5 | N4 | N3 | N2 | N1 | Tổng |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Kanji trong DB và dictionary | 79 | 166 | 367 | 0 | 0 | 612 |
| Nét có trong JSON Git | 11 | 0 | 367 | 0 | 0 | 378 |
| Từ vựng OpenJLPT | 674 | 630 | 1.659 | 1.778 | 3.070 | 7.811 |
| Câu grammar | 39 | 39 | 20 | 0 | 0 | 98 |
| Tài liệu library | 35 | 25 | 21 | 16 | 16 | 113 |
| Bài nghe có lời thoại | 6 | 6 | 5 | 0 | 0 | 17 |
| WAV / embedding thật | 0 | 0 | 0 | 0 | 0 | 0 |
| Từ trong catalog minigame | 0 | 0 | 367 | 0 | 0 | 367 |

Toàn chuỗi migration chạy từ rỗng tới 0014. Hai lượt Python đầu exit 0; lượt hai tạo thêm **0** kanji, **0** từ, **0** tài liệu, **0** rule/câu grammar và **0** bài nghe. Đã chạy lại bằng PowerShell: thiết lập exit 0, chỉ kiểm tra exit 2; JSON kiểm tra PowerShell/Python giống nhau. Đã đối chiếu revision và số hàng users/documents/vocabulary/grammar của DB ứng dụng trước/sau, không đổi. Giữ lại DB thử để rà soát, không tự drop.

Kết luận chủ ý là **PARTIAL**, không phải “tất cả sẵn sàng”:

- Develop chưa có mã/migration/bank placement; không dùng 98 câu mẫu grammar để tuyên bố có bài placement. Nếu bảng placement tồn tại nhưng chỉ có `is_demo`, checker ghi `demo_only`, không sẵn sàng cho kiểm tra thật.
- N4 và phần lớn N5 chưa có nét trong JSON commit; checker phân biệt số trong Git và SVG cục bộ. Cần nhập KanjiVG chính thức có rà soát, không tạo nét giả.
- Minigame có catalog nhưng kho từ N5/N4 trống; cần bổ sung ví dụ được duyệt rồi chạy builder. Không tự đổi cách minigame lấy từ vựng DB.
- 17 bài nghe hiện chỉ có lời thoại; 113 tài liệu chưa có embedding thật trong phép thử này. Chạy nhóm audio/index với dịch vụ thật, không cần nạp trùng DB.

Test mới kiểm tra thứ tự/phụ thuộc, seed cộng thêm chạy lặp và giữ nội dung sửa, check-only không ghi/gọi mạng, demo placement, inventory đầy đủ, vector hỏng, index ghi nguyên tử/giữ record ngoài nguồn, lỗi dừng chuỗi và startup warning không tạo schema. Các test dùng mock chỉ cho hợp đồng dịch vụ; không dùng chúng để tuyên bố đã tạo index/âm thanh thật. Thực tế tạo embedding/TTS và Docker sạch chưa được kiểm chứng trong lượt này.

Test mới: **13 đạt** (3,26 giây). Toàn pytest develop: **237 đạt + 6 subtest, 8 lỗi Chat**, 29 cảnh báo, 14,45 giây. Cả 8 tên lỗi đã có trên HEAD `3a75700e3f`, tái hiện trong bản mã gốc tách riêng (31 đạt, 8 lỗi ở ba file Chat). Không sửa Chat ngoài phạm vi. Log kiểm chứng ở `tmp/develop-data-setup-tests.log`, `tmp/develop-data-all-tests.log`, `tmp/develop-baseline-chat-tests.log`; báo cáo DB ở `tmp/develop-setup-verification.json`.

File của lượt này: thêm `backend/scripts/{setup_data.py,setup_data.ps1,data_status.py}`, `backend/app/services/{data_setup,data_health}.py`, `backend/tests/test_data_setup.py`, tài liệu này; sửa `README.md` và `backend/app/main.py` (cảnh báo). Không sửa migration, dữ liệu nguồn, frontend/mobile hay `.gitignore`. Các thay đổi OpenJLPT đã tồn tại trong worktree được giữ nguyên.

## Cần chủ dự án quyết định

1. Có đưa placement và dữ liệu nét/kho từ N5/N4 đã hoàn thiện trên nhánh khác vào develop bằng một thay đổi riêng không? Hai nhánh hiện có lịch sử revision khác nhau; không ghép migration theo số hoặc dùng chung DB.
2. Ai duyệt và phân phối học liệu/WAV dùng chung, và có chuẩn bị `nomic-embed-text`/VOICEVOX trên máy thành viên hay cung cấp endpoint chung? Runner không tự tải mô hình hoặc chia sẻ bí mật.
