# Nguồn dữ liệu và ghi công: kanji N3

## Dữ liệu gồm những gì

- `backend/app/data/kanji_dictionary_n3.json`: 367 chữ kanji N3 theo định dạng của `kanji_dictionary.json` (nghĩa tiếng Việt, âm On/Kun, số nét, một từ ví dụ).
- `backend/app/data/kanjivg_strokes_n3.json`: nét viết (đường vẽ SVG theo thứ tự nét) của 367 chữ, tạo bằng chính hàm `parse_kanjivg_svg` của dự án.
- `backend/scripts/merge_kanji_n3.py`: gộp hai file trên vào dữ liệu hiện có (an toàn, có sao lưu, chạy lại không trùng).

"Chữ viết tay" ở đây là **mẫu nét viết chuẩn (thứ tự nét)** dùng cho phần xem/luyện viết. Đây không phải mẫu chữ viết tay của người thật và không phải dữ liệu huấn luyện cho mô hình nhận dạng (mô hình nhận dạng cần huấn luyện lại riêng, xem hướng dẫn cho Codex).

## Nguồn và giấy phép

| Dữ liệu | Nguồn | Giấy phép / ghi chú |
|---|---|---|
| Nét viết (SVG) | KanjiVG, tác giả Ulrich Apel, https://kanjivg.tagaini.net | Creative Commons Attribution-Share Alike 3.0. Bắt buộc ghi công và chia sẻ tương tự cho phần dữ liệu phái sinh |
| Danh sách chữ theo cấp N3, âm đọc, số nét | Bộ dữ liệu `kanji-data` của David Gouveia (MIT), tổng hợp từ KANJIDIC (EDRDG) và danh sách JLPT của Jonathan Waller (tanos.co.uk) | KANJIDIC thuộc EDRDG, dùng theo giấy phép của EDRDG (kiểm tra điều khoản tại trang EDRDG trước khi công bố). Danh sách JLPT là **danh sách không chính thức**: JLPT không còn công bố danh sách kanji chính thức theo cấp độ |
| Nghĩa tiếng Việt, từ ví dụ | Do nhóm dự án soạn | Cần người biết tiếng Nhật rà soát, xem `docs/kanji_n3_review.md` |

## Ghi công cần có trong ứng dụng

Nên thêm vào README (và nếu có thể, một trang "Giới thiệu/Ghi công" trong ứng dụng):

> Dữ liệu thứ tự nét viết: KanjiVG © Ulrich Apel, theo giấy phép CC BY-SA 3.0 (https://kanjivg.tagaini.net). Dữ liệu kanji tham khảo từ KANJIDIC (EDRDG) và danh sách JLPT của Jonathan Waller.

Vì KanjiVG dùng giấy phép chia sẻ tương tự, file `kanjivg_strokes*.json` (phái sinh từ KanjiVG) nên giữ nguyên các trường `source`, `license`, `source_url` đã có trong từng bản ghi.

## Kiểm tra đã làm

- Danh sách N3 lấy từ bộ dữ liệu có đúng 367 chữ; cả 79 chữ N5 và 166 chữ N4 của dự án khớp 100% với cùng bộ dữ liệu này (nên cách phân cấp nhất quán).
- Cả 367 chữ đều có file nét viết trong KanjiVG, và **số nét theo KANJIDIC trùng khớp với số nét đếm từ KanjiVG** cho cả 367 chữ.
- Mọi mục đều có nghĩa, âm đọc, số nét và một từ ví dụ; cách đọc ví dụ chỉ gồm hiragana.
- Script gộp đã thử: chế độ dry-run, gộp thật, chạy lại (không đổi gì), ghi đè, và từ chối dữ liệu hỏng; dữ liệu N5/N4 cũ giữ nguyên 100%.

## Chưa làm

- Chưa huấn luyện lại mô hình nhận dạng kanji cho N3 và chưa nạp N3 vào cơ sở dữ liệu PostgreSQL (xem prompt cho Codex).
- Chưa có cách đọc Hán Việt cho từng chữ (có thể thêm sau thành trường `han_viet`).
