# Đóng gói và chuẩn bị bảo vệ

Không có bước phát hành lên Google Play/App Store trong giai đoạn này. Các lệnh dưới đây là hướng dẫn cho người vận hành, không được tự chạy trong quá trình cập nhật Giai đoạn 3.

## Chuẩn bị mạng và dịch vụ

1. Dùng cùng Wi-Fi riêng hoặc điểm phát của điện thoại; tắt VPN nếu nó làm Metro chọn nhầm địa chỉ. Kiểm tra IP Wi-Fi laptop bằng `ipconfig` sau khi đổi mạng, không dùng IP Radmin/VirtualBox.
2. Người vận hành chạy FastAPI trên `0.0.0.0:8000`. Điện thoại mở `http://IP_LAPTOP:8000/health` phải nhận trạng thái healthy. Nếu `Invalid host header`, người vận hành thêm IP/hostname vào `backend/.env` ALLOWED_HOSTS rồi khởi động lại backend. Không thay đổi API.
3. `mobile/.env`: `EXPO_PUBLIC_API_URL=http://IP_LAPTOP:8000/api`. Máy thật không dùng `localhost`/`10.0.2.2`; `10.0.2.2` chỉ dành cho Android Emulator. Cho phép cổng 8000 và 8081 trên mạng riêng nếu tường lửa chặn.
4. Chat/Ngữ pháp AI cần Ollama và model backend đang cấu hình. Người vận hành kiểm tra `ollama list`, chạy Ollama nếu chưa bật và xác nhận model cần dùng có sẵn. Mở được Ollama không bảo đảm JSON câu hỏi hợp lệ; [chẩn đoán 404](GRAMMAR_AI_404.md) ghi rõ lỗi thực tế và phương án ngân hàng.
5. Chạy `npm.cmd run audit:backend`, kiểm tra bốn tuyến Ngữ pháp trong OpenAPI live. Không thêm `/api` lần nữa vào đường dẫn Axios.

Chạy Expo Go:

```powershell
cd E:\AI\DACN\mobile
$env:REACT_NATIVE_PACKAGER_HOSTNAME = '192.168.1.3'
npm.cmd start -- --lan --clear
```

Thay IP bằng IP hiện tại. QR ở chế độ **Expo Go** mở bằng Go tương thích; APK development dùng `npm.cmd run start:dev -- --lan`, QR development mở bằng ứng dụng SenpaiAI đã cài. Không mở deep link `exp+senpai-ai-mobile` bằng Expo Go. Nếu cổng 8081 đã có Metro, sử dụng phiên đó hoặc dừng đúng phiên cũ trước khi chạy lại; không tự đổi cổng mà quên cập nhật điện thoại.

## Android: APK từ Expo Build

Profile `development` tạo APK cần Metro, dùng Fast Refresh khi sửa TS/JS. Không thêm native dependency trong Giai đoạn 3 nên APK development hiện có có thể nhận phần JS mới; biểu tượng/metadata native mới cần build và cài lại một lần.

```powershell
cd E:\AI\DACN\mobile
npx.cmd eas-cli@latest login
npm.cmd run build:android:dev
```

Muốn APK demo chạy JavaScript đã đóng gói, không cần Metro, dùng profile **preview**. API backend vẫn phải truy cập được từ điện thoại. `.env` không được upload; phải cấu hình URL công khai trên môi trường EAS preview trước khi build:

```powershell
cd E:\AI\DACN\mobile
npx.cmd eas-cli@latest env:set preview --name EXPO_PUBLIC_API_URL --value http://192.168.1.3:8000/api --visibility plaintext
npx.cmd eas-cli@latest build --platform android --profile preview
```

URL ví dụ chỉ dùng khi điện thoại truy cập được laptop ở IP đó. Có thể dùng URL HTTPS của backend demo đã chuẩn bị. `EXPO_PUBLIC_API_URL` là dữ liệu công khai trong bundle; tuyệt đối không đưa SECRET_KEY/OPENAI_API_KEY vào EAS mobile hoặc EXPO_PUBLIC_. Profile preview xuất `.apk`, không upload lên cửa hàng. Mở link build trên Android để tải/cài; nếu Android báo khác chữ ký với APK development cũ, cần gỡ đúng bản cũ rồi cài bản mới. Việc gỡ mất token/tùy chọn cục bộ; dữ liệu server vẫn theo tài khoản.

APK preview không nhận Fast Refresh từ Metro. Đổi API URL đã đóng gói phải build lại; muốn sửa nhanh trong buổi chuẩn bị dùng development build. Biểu tượng nguồn ở `assets/icon.svg`, PNG 1024 ở `assets/icon.png`; có thể tái tạo bằng `scripts/render-icon.ps1` trên Windows.

## iPhone qua Expo Go — điều kiện phải chuẩn bị trước

Dự án ghim **Expo SDK 58**. Theo [hướng dẫn chính thức về phiên bản Expo Go](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/), bản Go trên App Store dừng ở SDK 54; SDK 55 trở lên không được phân phối tại đó. Vì vậy không thể hứa cài Go từ App Store rồi quét QR dự án SDK 58 ngay.

Để demo qua Go, chuẩn bị **Expo Go SDK 58 tương thích** trước buổi bảo vệ. Expo hướng dẫn dùng `eas go` và TestFlight nội bộ, cần Apple Developer Program và quyền trong team tương ứng. Làm theo hướng dẫn chính thức; phiên làm việc này không tạo/phát hành bản Go qua TestFlight và không thay SDK dự án. Nếu chưa có Go phù hợp, đây là giới hạn chưa hoàn tất của demo iPhone; không nên đợi đến buổi bảo vệ mới kiểm tra. Android APK là phương án demo đã có nền tảng đóng gói, không thay thế xác nhận iPhone thực tế.

Khi đã có Go phù hợp: điện thoại và laptop cùng Wi-Fi, cho phép Local Network khi iOS hỏi, đăng nhập cùng tài khoản Expo ở CLI và Expo Go (`npx.cmd expo login` trên laptop), dùng `npm.cmd start -- --lan`. Windows chạy được Metro/backend cho iPhone thật; iOS Simulator cục bộ cần macOS/Xcode. Xem [hướng dẫn mở app trên thiết bị](https://docs.expo.dev/get-started/start-developing/).

Expo Go hiển thị icon ứng dụng; màn hình chờ React có logo và theme. Không tuyên bố đã kiểm tra splash native của bản phát hành bằng Expo Go. Không thêm `expo-splash-screen` trong giai đoạn không được thêm native module.

## Khi Wi-Fi trường chặn kết nối

Ưu tiên hotspot riêng và kiểm tra health từ điện thoại. Nếu cần tunnel Metro:

```powershell
cd E:\AI\DACN\mobile
npm.cmd run start:tunnel
```

Tunnel Metro **không tự tạo tunnel backend**. Backend phải có URL HTTPS truy cập được từ điện thoại hoặc tunnel riêng do người vận hành chuẩn bị (ví dụ `cloudflared tunnel --url http://localhost:8000` nếu công cụ đã có). Dùng URL backend tunnel cộng `/api` trong mobile/.env; người vận hành xử lý TrustedHost/CORS theo cấu hình hiện tại nếu cần. Khởi động lại Metro với `--clear`. Không dùng token, API key hoặc URL có thông tin đăng nhập trong EXPO_PUBLIC_API_URL.

## Checklist trước demo — thực hiện riêng trên Android và iPhone

Chưa có xác nhận trực tiếp trên điện thoại cho Giai đoạn 3; các ô dưới đây cần người demo đánh dấu sau khi thử.

- [ ] Đúng APK/development client/Expo Go và đúng SDK; app hiển thị tên SenpaiAI. Kiểm tra phiên bản dự án 0.3.0 và native metadata sau khi build mới.
- [ ] Điện thoại mở được health backend và Metro; thử trên đúng mạng/hotspot sẽ dùng khi bảo vệ; sạc laptop/điện thoại, giữ máy tính không ngủ.
- [ ] Đăng ký tài khoản thử, đăng nhập, đóng/mở app, logout; token hết hạn quay về đăng nhập; không kiểm tra reset/delete trên tài khoản thật cần giữ.
- [ ] Đổi vi/en ở màn hình đăng nhập và trong cài đặt; mở lại app và kiểm tra tùy chọn đã lưu lên hồ sơ.
- [ ] Sáng/tối/theo hệ thống đều đọc rõ; đổi giao diện Classic/Than Khe/Sakura khi đã sở hữu; tài khoản chưa sở hữu không chọn được và không có nút mua.
- [ ] Hằng ngày: làm đủ dạng, thử thoát/tiếp tục, lỗi mạng, nhận điểm/chuỗi theo server; kiểm tra Hồ sơ cập nhật.
- [ ] Thư viện: tìm/lọc/tải thêm, xem/copy, tạo từ URL; không tự nhận quyền sửa/xóa khi API chưa có metadata.
- [ ] Ngữ pháp: phân tích câu; luyện ngân hàng; thử AI/mixed lỗi, kiểm tra thông báo đúng ngôn ngữ và chuyển bank, giữ phiên/kết quả hợp lệ. Khi Ollama bật vẫn phải thử schema đầu ra.
- [ ] Chat: gửi tin, tải tin cũ, tìm kiếm, ghim, chuyển thư mục và xóa. Xác nhận Ollama/model hoạt động trước khi giới thiệu chức năng AI.
- [ ] Kanji: chỉ cấp có dữ liệu, tìm chữ/nghĩa/âm đọc, tải thêm/kéo làm mới; chi tiết nghĩa Việt/On/Kun/ví dụ; phát lại nét ở ba tốc độ.
- [ ] Chữ không có nét và lỗi tải nét: thông báo chưa hỗ trợ hoặc Thử lại, không crash. Đồ họa không tràn màn hình nhỏ.
- [ ] Quiz: ba dạng, 5/10/20 câu, đúng/sai/kết quả, thoát có xác nhận; không cộng điểm hoặc tuyên bố chấm server.
- [ ] Hồ sơ: sửa username, cấp hiện tại, mục tiêu JLPT và mục tiêu khác; mở lại kiểm tra server đã lưu; xem điểm/chuỗi/lịch gần đây.
- [ ] Xuất dữ liệu: JSON đúng tài khoản, chọn/copy từng phần và Share hệ thống; lưu thử vào nơi riêng tư, không chiếu dữ liệu thật lên màn hình bảo vệ.
- [ ] Reset: đọc cảnh báo giữ điểm/nhiệm vụ, gõ đúng từ xác nhận; Hủy giữ nguyên dữ liệu; sau reset lịch sử chat/ngữ pháp đã xóa.
- [ ] Xóa tài khoản thử: gõ xác nhận; xóa thành công trở về đăng nhập; không còn cache riêng của người dùng vừa xóa.
- [ ] Tắt/bật Wi-Fi: thông báo mất mạng, tự kiểm tra lại và tải lại query sau phục hồi; không gửi lại mutation mù quáng; skeleton/rỗng/lỗi đều hợp lý.
- [ ] Android Back/iOS vuốt, tai thỏ, thanh Home và bàn phím Nhật ở các form đều không che nút/ô nhập; chọn/sao chép văn bản dùng menu hệ điều hành.
- [ ] Giữ ảnh/video dự phòng đã quay từ bản đã kiểm thử. Ghi rõ chức năng/thiết bị nào chưa kiểm thử, không đánh dấu thay bằng kết quả export bundle.

## Lệnh kiểm tra trước đóng gói

```powershell
cd E:\AI\DACN\mobile
npm.cmd run check
npm.cmd run export:check
npm.cmd run audit:backend
npm.cmd run smoke:phase3 -- --create-test-account
```

`smoke:phase3` dùng tài khoản mới và chỉ reset/delete tài khoản đó. Các kiểm tra SQLite biệt lập nằm trong `scripts/verify-phase3-backend.py`. Không tự bật, đổi hoặc restart backend/Ollama trong bất kỳ script nào.
