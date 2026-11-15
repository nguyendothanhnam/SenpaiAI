# Chẩn đoán 404 Ngữ pháp AI — 10/11/2026

## Kết luận đã kiểm chứng

**Không tìm thấy lỗi đường dẫn ở mobile.** Backend đang chạy có đủ tuyến. Lỗi tái hiện là 404 nghiệp vụ khi không chọn được câu hỏi, không phải `Not Found` vì thiếu route.

| Thành phần | Đường dẫn/cấu hình |
| --- | --- |
| Mobile | Base `http://192.168.1.3:8000/api`, POST `/grammar-practice/sessions` |
| Web | Base mặc định `http://localhost:8000/api`, POST `/grammar-practice/sessions` trong `frontend/src/services/api.ts` |
| Router | `APIRouter(prefix="/grammar-practice")`, POST `/sessions`, POST `/generate` |
| Đăng ký FastAPI | `include_router(grammar_practice.router)` và thêm một lần với `prefix="/api"` |
| OpenAPI của backend thực tế | Có POST `/grammar-practice/sessions`, `/api/grammar-practice/sessions`, `/grammar-practice/generate`, `/api/grammar-practice/generate` |

Đăng ký kép là hai đường dẫn thay thế có/không có `/api`. Không cần ghép thêm `/api` vào lời gọi Axios khi base URL đã kết thúc bằng `/api`; cũng không đổi sang `/api/api/grammar-practice/...`. Một số endpoint Kanji có thêm decorator chứa `/api`, nhưng không áp dụng cách suy luận đó cho router Ngữ pháp.

## Các lần tái hiện

1. Ban đầu backend cổng 8000 chưa chạy. Agent không tự bật hay khởi động lại; người dùng bật backend rồi mới kiểm tra live.
2. OpenAPI live xác nhận đủ bốn tuyến trên. Tài khoản thử dùng N5, một mẫu có câu trong ngân hàng: `mode=bank` trả 200 với một câu phù hợp.
3. Khi Ollama chưa bật, POST `/grammar-practice/generate` trả HTTP 200 nhưng payload có `saved=0`, `rejected=1`, lỗi **`Ollama is not running. Please start Ollama service.`**. HTTP tới `127.0.0.1:11434/api/tags` cũng không kết nối được. Tạo phiên `mode=ai` trả 404, detail là “Không có câu hỏi phù hợp ở cấp độ và dạng đã chọn.”; `mode=mixed` trả 200 với câu ngân hàng và thông báo.
4. Người dùng bật Ollama. Kiểm tra Chat đầu cuối lúc đó đạt. Sinh câu Ngữ pháp vẫn cho `saved=0`, `rejected=1` nhưng không còn lỗi provider. Kiểm tra trực tiếp một đầu ra sinh câu với `gemma:2b` xác nhận JSON có mục câu hỏi thiếu **`correct_answer` và `explanation_vi`**; `GeneratedQuestion` từ chối cả hai mục. Đây là bằng chứng cụ thể về đầu ra không đạt schema; kết quả các lần sinh khác có thể khác.

`_ai_questions` có thể trả 0 câu khi lỗi provider, JSON/validation không hợp lệ, trùng câu hoặc hết hạn mức. `create_session` bỏ qua nội dung không hợp lệ; nếu `selected` vẫn rỗng thì ném HTTPException 404. Vì vậy một 404 ở đây không đủ để kết luận route sai. Kiểm tra bằng SQLite riêng cũng tái hiện đúng nhánh này với provider giả lập không khả dụng.

## Mobile đã sửa gì

- Không sửa base URL hay endpoint đang đúng.
- Khi tạo phiên AI/mixed lỗi, đổi nguồn đang chọn về **bank**, hiện thông báo vi/en. Người dùng bấm Bắt đầu để dùng bank; không tự POST lại sau timeout.
- Không xóa phiên cũ, kết quả cũ, đáp án hay bộ điều phối gửi đáp án khi yêu cầu tạo phiên thất bại.
- Mixed trả 200 nhưng ít câu kèm thông báo: giữ phiên hợp lệ đã nhận, thông báo phần thiếu và đặt nguồn cho lần bắt đầu tiếp theo về bank.
- Hủy chủ động không bị coi là lỗi AI; 401/403 vẫn đi theo xử lý xác thực/quyền hiện có. Không hiển thị nguyên văn lỗi provider có thể sai ngôn ngữ hoặc chứa chi tiết kỹ thuật.

## Việc phía backend/dịch vụ còn lại

Không thiếu route nên không cần sửa đường dẫn hay restart FastAPI để “thêm” route trong lần kiểm tra này. `_call_ollama` kiểm tra kết nối mỗi lần gọi; bật Ollama không yêu cầu restart backend chỉ để nhận kết nối. Nếu đổi cấu hình provider/model/base URL thì người vận hành cần reload tiến trình theo cách hiện tại.

Để sinh AI đáng tin cậy, phía backend cần ràng buộc đầu ra bằng schema phù hợp, xác thực các trường bắt buộc và kiểm thử model đang cấu hình; có thể tham khảo cơ chế structured output đã dùng cho phân tích câu. Nên trả mã lỗi phân biệt provider không khả dụng, nội dung không hợp lệ và thiếu ngân hàng. **Chưa thực hiện bất kỳ thay đổi backend/API nào.** Không bảo đảm AI đã hoạt động chỉ vì Ollama đã bật.

## Lệnh tái kiểm tra

```powershell
cd E:\AI\DACN\mobile
npm.cmd run audit:backend
node --env-file-if-exists=.env scripts/diagnose-grammar-live.mjs --create-test-account --sessions
```

Script thứ hai tạo tài khoản riêng, gọi sinh câu thực tế và dọn tài khoản/lịch sử thử; không in JWT hoặc mật khẩu. Nếu model sinh được câu hợp lệ thì API có thể lưu câu đó vào ngân hàng theo thiết kế backend. Kiểm tra không dùng AI hoặc dữ liệu thật:

```powershell
cd E:\AI\DACN
backend\venv\Scripts\python.exe mobile/scripts/verify-phase3-backend.py
```

Script này dùng router hiện có trong tiến trình thử với SQLite bộ nhớ, không mở cổng, không dùng database thật, không gọi Ollama và không sửa tệp backend.
