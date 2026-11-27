# Nhận dạng và dữ liệu Kanji

Cập nhật workspace 25/11/2026. Tài liệu giữ địa chỉ để các liên kết từ hướng dẫn ML vẫn hoạt động, đồng thời thay trạng thái chẩn đoán 245 lớp ngày 16/11 bằng artifact hiện tại.

## Mô hình chính: 612 lớp

`backend/ml/models/deployment.json` ghi cài ngày 21/11/2026, gồm 79 N5 + 166 N4 + 367 N3. `kanji_model.pt` phải đi cùng `label_map.json` và checksum của đúng bản triển khai. Bản 245 lớp là mốc cũ, không phải trạng thái chính của workspace hiện tại.

`training_summary.json` ghi best validation khoảng 93,73%; `evaluation.json` dùng 1.224 ảnh render font, không phải viết tay độc lập. Có hồi quy N5/N4 so với mô hình trước; độ phủ 612 chữ không chứng minh accuracy 100%. Xem [kiến trúc AI](BAO_CAO_AI_SENPAIAI.md) và [hướng dẫn ML](../backend/ml/README.md) trước khi đánh giá hoặc thay trọng số.

## Nguyên nhân lỗi 語 và 東 trước đây

Ngày 16/11 đã tái hiện việc web chặn nhận dạng vì API ảnh mẫu ETL10 trả `total: 0`, dù chữ nằm trong danh sách lớp mô hình. Ảnh mẫu là nội dung để xem, không quyết định mô hình hỗ trợ chữ hay không. Đã bỏ điều kiện chặn; Expo cũng kiểm tra lớp mô hình thay vì số ảnh mẫu. Không suy từ việc có metadata/nét chuẩn rằng CNN chắc chắn nhận dạng đúng kiểu viết người dùng.

Tiền xử lý đã sửa ảnh trắng thành tensor zero đúng kích thước, ghép PNG alpha lên nền trắng trước khi chuyển xám, từ chối ảnh rỗng/hỏng và không lưu chúng thành mẫu tốt. Nhận dạng ảnh vẫn là gợi ý; chấm nét theo chữ đích là [dịch vụ khác](DANH_GIA_NET_KANJI.md).

## Nguồn và phạm vi dữ liệu

- Từ điển: 612 chữ. Kiểm tra 25/11 xác nhận N5/N4 đã đủ nghĩa/ít nhất một loại âm/số nét trước lượt sửa này; còn thiếu ví dụ ở 40 N5 và 160 N4. Có trường không rỗng chưa có nghĩa là nội dung đã được duyệt.
- Mẫu nét: KanjiVG, CC BY-SA 3.0. Metadata N5/N4: [nguồn gốc](../backend/scripts/data/KANJI_METADATA_SOURCES.md). N3: [nguồn, giấy phép và bảng rà soát](kanji_n3_review.md).
- Âm Hán Việt: 492 mục kVietnamese từ Unicode 17 Unihan, thêm 際 = TẾ do người dùng cung cấp; tổng 493/612, 119 mục thiếu để trống. Không gán toàn bộ phần này cho KanjiVG/Unihan.
- Mẫu font, ảnh ETL và mẫu cá nhân có điều kiện riêng, không được coi giấy phép nét là giấy phép tái phân phối mọi ảnh/trọng số.

## Học chữ và tra cứu

Tab Học chữ có nghĩa/On/Kun/romaji/ví dụ, chuyển chữ/tìm kiếm và quiz đọc/nghĩa. Quiz cần đáp án khác nhau cùng cấp; thiếu kho thì thông báo thay vì lặp đáp án. Mở thẻ chưa phải đã học; tiến độ phụ thuộc hành động ôn/đáp án. Đọc tiếng Nhật bằng giọng trình duyệt phụ thuộc thiết bị.

Bảng tra Kanji mở khi bấm chữ văn bản bài tập, lưu ghi chú riêng; không có thanh tra đầu trang và không cho dùng để xem đáp án trong ván game đang chơi. Thiếu metadata không tự bịa. Xem [Minigame và bảng tra](MINIGAMES.md).

## Âm thanh luyện nghe: ghi nhận vận hành cũ

Ngày 16/11 đã xác minh VOICEVOX cổng 50021 không chạy; sau khởi động dịch vụ có WAV/mốc câu hợp lệ cho 17/17 bài nghe công khai. Hai lượt sinh chưa cache khoảng 16–20 giây, không phải benchmark p95. Không liệt kê bài riêng tư.

Khi khôi phục, ưu tiên cache WAV và timing hợp lệ trước khi gọi engine. Cache hỏng phải sinh lại; HTTP 503 của dịch vụ tạo âm thanh khác với lỗi tải/mạng chung. Đường cache có sẵn có thể phát khi engine tạm ngừng; bài mới vẫn cần VOICEVOX. Chưa nghiệm thu loa/giọng và thiết bị thật trong mốc đó.

## Kiểm tra

Đối chiếu endpoint `/kanji/model-info` của đúng môi trường; restart backend sau khi thay artifact, không chỉ đọc label map trong máy khác. Từ thư mục `backend`:

```powershell
.\venv\Scripts\python.exe scripts/validate_kanji_dictionary.py
.\venv\Scripts\python.exe -m pytest tests/test_kanji_model_deployment.py tests/test_kanji_writing.py -q
```

Không chạy train/promotion hoặc ghi mẫu thật chỉ để dọn tài liệu. Cần người biết tiếng Nhật rà dữ liệu và tập viết tay độc lập trước khi công bố chất lượng nhận dạng thực tế.

## Hoàn thiện dữ liệu N5/N4 ngày 25/11/2026

Chạy script hiện có ở chế độ xem trước, áp dụng `--write`, rồi xem trước lần nữa: cả ba đều báo **Changed entries: 0**. Hai tệp bổ sung `kanji_n5_n4_metadata.json`, `kanji_n5_n4_vi.json` chỉ được script sửa chữa đọc; từ điển chính đã chứa các trường này. Không tạo dữ liệu thay đổi giả để khớp mô tả ban đầu. SHA-256 của toàn bộ từ điển trước/sau bằng nhau.

Validator hiện có chỉ xét nghĩa, ít nhất một âm On/Kun, số nét và cấp JLPT; không xét ví dụ. Công cụ kiểm kê mới giữ nguyên quy tắc API đó và báo thêm chỉ số riêng “đủ trường kể cả ví dụ”: ví dụ phải có `word`, `reading`, `meaning_vi` hoặc `meaning`. Không tự tạo âm Kun cho chữ chỉ có âm On trong nguồn.

| Cấp | Số chữ | Đủ nghĩa/âm/số nét trước → sau | Đủ trường kể cả ví dụ trước → sau | Nét trong JSON trước → sau |
| --- | --- | --- | --- | --- |
| N5 | 79 | 79 → 79 (100%) | 39 → 39 (49,37%) | 11 → 79 |
| N4 | 166 | 166 → 166 (100%) | 6 → 6 (3,61%) | 0 → 166 |
| N3, đối chiếu bảo toàn | 367 | 367 → 367 | 367 → 367 | 367 → 367 |

Máy này **đã có đủ SVG local** cho 79 N5, 166 N4 và 367 N3 trước sửa. Thư mục `backend/app/data/kanjivg` là gitlink tại commit `1957802840a6f059d1e27dcb5755722955cc7dbb`, không phải các SVG được lưu trực tiếp trong Git của dự án; workspace hiện không có `.gitmodules` ở gốc. Không sửa gitlink trong lượt này. Độ phủ thực tế tại máy có SVG vì vậy đã đủ trước/sau; thay đổi lần này đưa JSON đóng gói lên đủ **612 chữ**, dùng được cả khi máy triển khai không có checkout SVG đó.

Đã tải trực tiếp kho **KanjiVG/kanjivg chính thức**, commit `9d7220dfca09107dca2e0b0e45f90f696185e3c3` ngày 18/11/2026, lấy 245 SVG chuẩn theo mã Unicode (không lấy biến thể). Archive 24.094.864 byte, SHA-256:

```text
d72cc091482dce754e57e074eb0755d0f056f2bfae22369c20805c06fbf42ba2
```

Dùng `import_kanjivg.py` hiện có tạo JSON tạm, sau đó công cụ kiểm kê chỉ gộp **234 chữ còn thiếu: 68 N5 + 166 N4**. Giữ nguyên mọi trường của 378 bản ghi cũ, kể cả toàn bộ N3; giữ `source`, `license`, `source_url` của bản ghi nhập. Không đổi mô hình, thuật toán chấm/nhận dạng hoặc API. Ghi bằng tệp tạm rồi thay thế, có sao lưu; chạy lại báo **0 mục cần thêm** và checksum file không đổi.

Đã đếm lại đường nét trong JSON/SVG và đối chiếu `strokes`/`stroke_count` của từ điển: **0 chữ N5/N4 lệch số nét**. Không sửa số nét bằng suy đoán.

### Nội dung cần người dùng bổ sung

[Báo cáo JSON](ket_qua/kanji_n5_n4.json) chứa đủ **200 mục thiếu ví dụ**, chia cấp, có nghĩa hiện tại và trường thiếu. Không còn mục thiếu nghĩa Việt/âm/số nét theo kiểm tra trường. Hãy cung cấp cho mỗi mục: từ hoặc câu Nhật, cách đọc kana, nghĩa Việt tương ứng (nếu là câu phải dịch cả câu).

Ngoài 200 mục thiếu, **45 mục đã có ví dụ đều đang lặp lại nghĩa của chữ làm nghĩa ví dụ**; chúng được liệt kê riêng ở `after.examples_needing_human_review`. Không tính các trường đã điền là ví dụ đúng ngữ nghĩa; không tự sửa hoặc bịa bản dịch. N3 không nằm trong danh sách cần chỉnh của lượt này.

### Lệnh và kết quả thực tế

Các lệnh từ gốc repo; `W=tmp/kanji-n5-n4-20261125` dưới đây là viết tắt trong mô tả, không phải biến môi trường đã cấu hình:

| Lệnh | Kết quả |
| --- | --- |
| `backend/venv/Scripts/python.exe backend/scripts/repair_kanji_n5_n4.py` | 0 thay đổi |
| Cùng lệnh thêm `--write`, rồi xem trước lại | 0 thay đổi; dictionary giữ nguyên byte |
| `backend/venv/Scripts/python.exe backend/scripts/validate_kanji_dictionary.py` trước và sau | 612/612 hợp lệ, 0 thiếu metadata, 0 trùng |
| `backend/venv/Scripts/python.exe backend/scripts/import_kanjivg.py W/official-n5-n4 --dictionary W/dictionary_n5_n4.json --output W/imported_n5_n4.json` | 245 bản ghi tạm |
| `backend/venv/Scripts/python.exe backend/scripts/audit_kanji_n5_n4.py --merge-from W/imported_n5_n4.json` | Xem trước: thêm 234 |
| Cùng lệnh thêm `--write`, rồi chạy lại | Thêm 234, lần hai thêm 0; 0 lệch số nét |
| `backend/venv/Scripts/python.exe -m pytest -q -p no:cacheprovider` tại thư mục backend | 417 đạt + 6 subtest, 26 cảnh báo thư viện cũ |
| Pytest nhóm `test_kanji_n5_n4_data.py`, `test_kanji_dictionary_service.py`, `test_kanji_writing.py` | 40 đạt; gồm 17 ca mới về dữ liệu, sao lưu, nhập lại, nguồn và không có SVG |
| `npm.cmd run build` tại frontend | Mã thoát 0; còn cảnh báo Browserslist/bundle lớn hiện hữu |

Lệnh tải thành công: `Invoke-WebRequest` đến `https://codeload.github.com/KanjiVG/kanjivg/zip/9d7220dfca09107dca2e0b0e45f90f696185e3c3`. Kết nối GitHub bằng lệnh thường ban đầu bị sandbox chặn; đã chạy lại với quyền mạng được cho phép. Không dùng nguồn thay thế không rõ xuất xứ.

Sao lưu tại máy: `tmp/kanji-n5-n4-20261125/before_dictionary.json` và `backend/app/data/kanjivg_strokes.json.bak-20261125T110128428602Z`. Tệp sao lưu không được commit; đường dẫn/checksum và dấu vân tay N3 nằm trong báo cáo. Các thay đổi Chat có sẵn trong workspace được giữ nguyên.

### Tải và nhập lại khi máy chưa có KanjiVG

Từ gốc repo, PowerShell; chỉ làm việc trong thư mục tạm, không thay checkout SVG hay dữ liệu N3:

```powershell
$kanjiWork = Join-Path (Get-Location) 'tmp/kanji-n5-n4-20261125'
New-Item -ItemType Directory -Path $kanjiWork -Force | Out-Null
Invoke-WebRequest -Uri 'https://codeload.github.com/KanjiVG/kanjivg/zip/9d7220dfca09107dca2e0b0e45f90f696185e3c3' -OutFile "$kanjiWork/kanjivg-9d7220df.zip"
Get-FileHash -LiteralPath "$kanjiWork/kanjivg-9d7220df.zip" -Algorithm SHA256
```

Đối chiếu checksum ở trên. Chọn đúng SVG chuẩn cho N5/N4 và tạo từ điển lọc cho importer; mã này chỉ giải nén file đã chọn cùng `COPYING`/`README.md`:

```powershell
@'
import json, zipfile
from pathlib import Path
w = Path('tmp/kanji-n5-n4-20261125')
rows = json.loads(Path('backend/app/data/kanji_dictionary.json').read_text(encoding='utf8'))
rows = [r for r in rows if r['jlpt'] in ('N5', 'N4')]
target = w / 'official-n5-n4'
target.mkdir(exist_ok=True)
prefix = 'kanjivg-9d7220dfca09107dca2e0b0e45f90f696185e3c3/'
with zipfile.ZipFile(w / 'kanjivg-9d7220df.zip') as archive:
    for row in rows:
        name = f"{ord(row['kanji']):05x}.svg"
        (target / name).write_bytes(archive.read(prefix + 'kanji/' + name))
    for name in ('COPYING', 'README.md'):
        (target / name).write_bytes(archive.read(prefix + name))
(w / 'dictionary_n5_n4.json').write_text(json.dumps(rows, ensure_ascii=False), encoding='utf8')
'@ | backend/venv/Scripts/python.exe -
backend/venv/Scripts/python.exe backend/scripts/import_kanjivg.py "$kanjiWork/official-n5-n4" --dictionary "$kanjiWork/dictionary_n5_n4.json" --output "$kanjiWork/imported_n5_n4.json"
backend/venv/Scripts/python.exe backend/scripts/audit_kanji_n5_n4.py --merge-from "$kanjiWork/imported_n5_n4.json"
backend/venv/Scripts/python.exe backend/scripts/audit_kanji_n5_n4.py --merge-from "$kanjiWork/imported_n5_n4.json" --write --report "$kanjiWork/check.json"
backend/venv/Scripts/python.exe backend/scripts/validate_kanji_dictionary.py
```

Tham khảo [trang tải chính thức](https://github.com/KanjiVG/kanjivg/releases) nếu chọn bản phát hành khác; phải ghi lại phiên bản/checksum mới, không dùng checksum trên cho archive khác. Backend đã chạy lâu có cache dữ liệu: nạp lại tiến trình khi triển khai dữ liệu mới.

### Nguồn, giấy phép và phần chưa kiểm chứng

- Nét SVG/JSON chuyển đổi: **KanjiVG, © Ulrich Apel, CC BY-SA 3.0**; [nguồn chính thức](https://kanjivg.tagaini.net/), [giấy phép](https://creativecommons.org/licenses/by-sa/3.0/). Đã chuyển SVG thành danh sách đường nét và ghép metadata; không tuyên bố tự vẽ nét. Giữ ghi công/giấy phép khi phân phối dữ liệu chuyển đổi.
- Âm đọc, nghĩa Anh, số nét/metadata bổ sung: **KANJIDIC, James William BREEN và EDRDG, CC BY-SA 4.0**, qua snapshot kanji-data; MIT của mã kho trung gian không thay thế giấy phép dữ liệu. [Nguồn/ghi công đầy đủ](../backend/scripts/data/KANJI_METADATA_SOURCES.md).
- Nghĩa Việt bổ sung là dữ liệu SenpaiAI đã có, không nhận là bản dịch do KanjiVG/KANJIDIC cung cấp; không sinh thêm nội dung trong lượt này.

Chưa có người biết tiếng Nhật duyệt 200 ví dụ còn thiếu/45 ví dụ cần sửa; chưa kiểm tra hoạt ảnh trên thiết bị thật. Checklist: mở vài chữ N5/N4 ở tab học, mẫu nét và luyện viết; kiểm tra nghĩa/âm/số nét, hoạt ảnh sáng/tối trên web và điện thoại; xác nhận N3 hiển thị như trước. Không suy từ đủ 612 mẫu nét rằng mô hình nhận dạng chính xác hơn.
