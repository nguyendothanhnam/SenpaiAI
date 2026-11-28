# Quy tắc chấm kanji đã duyệt

Áp dụng từ `stroke-rules-v4`; điểm và kết quả lưu trước đây giữ nguyên phiên bản cũ.

| Tiêu chí | Trọng số đề xuất |
| --- | ---: |
| Thứ tự nét | 20% |
| Hướng nét | 20% |
| Hình dạng và vị trí | 40% |
| Đủ nét | 20% |

Mỗi nét mẫu được ghép tối đa một nét người viết bằng căn chỉnh có thể biểu diễn
nét thiếu và nét thừa. Điểm thứ tự và hướng cho mỗi nét ghép là 100 nếu có đủ
bằng chứng đúng, 0 nếu có đủ bằng chứng sai. Trường hợp không đủ bằng chứng cần
hiển thị “không xác định” và không tự kết luận sai; khi tổng hợp, ghi rõ số nét
đã đánh giá. Điểm hình dạng là điểm liên tục 0–100 từ khoảng cách hình học,
vị trí đầu/cuối và tỉ lệ chiều dài sau chuẩn hóa toàn chữ; không tự căn chỉnh
riêng từng nét vì sẽ che mất lỗi vị trí.

Đủ nét = `100 × max(0, 1 − (thiếu + thừa)/số nét mẫu)`. Nét thiếu nhận 0 điểm
hình dạng; nét thừa không nhận điểm và bị trừ trong đủ nét. Điểm hình dạng tổng
lấy tổng điểm nét ghép chia cho số lớn hơn giữa số nét mẫu và số nét viết.
Mỗi điểm tiêu chí được làm tròn; điểm tổng là tổng có trọng số của bốn điểm này,
sau đó làm tròn. Đạt khi
điểm tổng từ 80 trở lên, không thiếu hoặc thừa nét và không có lỗi thứ tự/hướng
đã xác định; hình dạng từng nét cần vượt ngưỡng mức nghiêm khắc đã chọn.

Ba mức đề xuất dùng các ngưỡng đã có trong cấu hình hiện tại:

| Mức | Khoảng cách nét tối đa | Khoảng cách đầu/cuối | Tỉ lệ chiều dài tối thiểu | Biên nhận diện đổi thứ tự |
| --- | ---: | ---: | ---: | ---: |
| Dễ | 0,20 | 0,32 | 0,35 | 0,035 |
| Chuẩn | 0,16 | 0,26 | 0,42 | 0,025 |
| Nghiêm | 0,10 | 0,17 | 0,60 | 0,020 |

Các khoảng cách dùng hệ tọa độ đã chuẩn hóa toàn chữ, không phải pixel. Chế độ
học cho xem mẫu và gợi ý nét tiếp theo, nhận phản hồi tạm sau mỗi nét; chế độ
kiểm tra ẩn mẫu và gợi ý đến khi nộp, chỉ lưu/chấm kết quả cuối. Cùng một mức
nghiêm khắc phải cho cùng điểm ở cả hai chế độ. Để tương thích API cũ, hai mức
`very_easy` và `very_strict` đã có cần tiếp tục được chấp nhận nếu giao diện chỉ
hiển thị ba mức.

Các chữ gần giống cần báo cảnh báo phân biệt dựa trên bằng chứng hình học và nét
khác nhau; không thay chữ mục tiêu hoặc tự cộng/trừ điểm bằng bộ nhận dạng ảnh.
Ngưỡng cần được hiệu chỉnh trên mẫu người viết thật, chuột, bút cảm ứng và màn hình
nhỏ; mẫu KanjiVG là tham chiếu, không phải quy tắc duy nhất cho mọi kiểu viết.
Không công bố độ chính xác thống kê khi chưa có tập kiểm thử gán nhãn độc lập.

## Những điểm đã sửa và giới hạn còn lại

- Công thức điểm tổng hiện đọc `SCORE_WEIGHTS` từ cấu hình thay cho trọng số ghi cứng.
- Điểm thứ tự/hướng chia theo số nét ghép; khi không có nét ghép, mẫu số là 1 và
  điểm thành 0 dù thiếu bằng chứng. Ngược lại hình dạng sai vẫn có thể được tính
  đúng thứ tự/hướng do cờ lỗi mặc định sai. Cần trạng thái không xác định rõ ràng.
- Kết quả v4 trả điểm từng tiêu chí của từng nét từ backend. Dữ liệu cũ vẫn dùng
  công thức dự phòng trên web để tương thích các phản hồi chưa có điểm từng nét.
- Mã hiện tại có năm mức; việc giảm lựa chọn còn ba mức có thể ảnh hưởng thói quen
  và liên kết API cũ, vì vậy cần giữ tương thích các giá trị đã lưu.

API `/kanji-writing/rules` cung cấp trọng số, ngưỡng và phiên bản cho bảng quy tắc
trên web. Màn hình mobile hiện dùng API nhận dạng chữ khác, chưa thực hiện chấm
từng nét; không áp dụng bảng điểm này cho kết quả nhận dạng mobile.

Với nét ghép, điểm hình dạng dùng `100 × max(0, 1 − max(0, khoảng cách − 0,025) /
(2 × ngưỡng khoảng cách)) × min(1, tỉ lệ chiều dài / ngưỡng tỉ lệ)`. Đầu/cuối
được dùng trong điều kiện nét đạt chứ chưa cộng thành thành phần riêng trong điểm
hình dạng. Thứ tự/hướng không đủ bằng chứng không bị khẳng định là sai; nếu toàn bộ
không đủ bằng chứng, API cũ vẫn trả 0 để giữ kiểu số và giao diện ghi chưa xác định.
Lưu ý điểm tiêu chí được làm tròn trước khi nhân trọng số; đây là cách tính đang dùng.
