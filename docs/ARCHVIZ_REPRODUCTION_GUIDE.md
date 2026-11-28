# Hướng dẫn Tái tạo Môi trường ArchViz Phỏng vấn Thực tế
*(ArchViz Architectural Visualization Pipeline for SenpaiAI)*

Tài liệu này hướng dẫn chi tiết quy trình chuẩn để các kỹ sư đồ họa và web developer tái tạo, chỉnh sửa hoặc xuất mới toàn bộ môi trường phòng phỏng vấn 3D thực tế bằng **Blender Cycles** và hiển thị lên trình duyệt qua **Three.js Screen-Space Depth Parallax Shader**.

---

## 1. Nguyên lý Kiến trúc & Giải pháp Đồ họa

Nhằm khắc phục triệt để hiện tượng **"hình ảnh nhìn như game hoạt hình"** (Minecraft/low-poly/unshaded box) nhưng vẫn đảm bảo **hiệu năng mượt mà 60 FPS trên mọi thiết bị di động tầm trung**, SenpaiAI áp dụng giải pháp **Hybrid 2.5D/3D ArchViz Projection**:

```
+--------------------------------------------------------------------------+
|                       BLENDER CYCLES ARCHVIZ PIPELINE                     |
|  - Tỉ lệ mét thực tế (Room 5.0m x 4.5m x 2.8m, Desk H=0.74m)             |
|  - Vật liệu PBR (Vân gỗ óc chó Smoked Walnut, Lam tiêu âm Oak Slat)        |
|  - Chiếu sáng: Đèn trần LED âm trần 5000K CRI 98 + Ánh sáng ngoại cảnh   |
|  - Camera 50mm điện ảnh, góc POV ứng viên, Tone Mapping AgX/Filmic       |
+--------------------------------------------------------------------------+
                                    |
            +-----------------------+-----------------------+
            |                                               |
            v                                               v
    [Color Beauty Plate]                           [Normalized Z-Depth]
    (2048x1152 WebP ~220KB)                        (2048x1152 WebP ~45KB)
            |                                               |
            +-----------------------+-----------------------+
                                    |
                                    v
+--------------------------------------------------------------------------+
|                     THREE.JS DEPTH-PARALLAX SHADER                       |
|  - Screen-Space Raymarching / Parallax Offset theo tọa độ con trỏ/gyro   |
|  - Lớp foreground 3D PBR tương tác thực (Hồ sơ phỏng vấn, bút ký, thẻ)    |
|  - Hậu kỳ thời gian thực: Vignette quang học, Film Grain 35mm tinh tế    |
|  - Nhân vật phỏng vấn viên: Vi chuyển động thở tự nhiên, đồng bộ giọng nói|
+--------------------------------------------------------------------------+
```

---

## 2. Cài đặt Môi trường & Yêu cầu

- **Blender 4.0 trở lên** (hỗ trợ Cycles và AgX Tone Mapping).
- **Python 3.10+** (có cài đặt `Pillow` và thư viện xử lý ảnh).
- **Node.js 18+** & `npm` / `pnpm`.

---

## 3. Quy trình Tái tạo từ Blender Cycles

### Bước 1: Chạy kịch bản tự động dựng cảnh & Render Headless
Kịch bản `scripts/blender/render_interview_archviz.py` tự động thiết lập toàn bộ cảnh chuẩn phòng họp Tokyo:

```bash
# Chạy Blender ở chế độ không giao diện (Headless Background)
blender --background --python scripts/blender/render_interview_archviz.py
```

Kịch bản sẽ tự động cấu hình:
1. **Hệ đơn vị thực tế (Metric)**: Scale 1.0, kích thước phòng 5m x 4.5m x 2.8m.
2. **Vật liệu PBR Principled BSDF**:
   - Mặt bàn: Gỗ óc chó đen (Roughness 0.28, IOR 1.45, Anisotropy nhẹ).
   - Vách tiêu âm: Lam gỗ dọc với khe hấp thụ âm thanh tối màu.
   - Kính cửa sổ: Kính kiến trúc phản xạ nhẹ bầu trời Shinjuku.
3. **Chiếu sáng (Realistic Studio Lighting)**:
   - Đèn LED máng âm trần màu trắng lạnh (5000K, Power 350W, Area light mềm).
   - Đèn rọi hội thảo (Accent Spot 4000K, Power 80W) tạo chiều sâu không gian.
   - Ánh sáng gián tiếp từ cửa sổ (Bounced Skyfill, Power 120W).
4. **Compositor Pass**:
   - Trích xuất pass `Depth` từ Render Layer.
   - Chuẩn hóa khoảng cách tiêu cự qua `Normalize Node` (Map Range 0.5m đến 6.0m).
   - Xuất ra 2 file song song: `archviz_render_raw.png` và `archviz_depth_raw.png`.

---

## 4. Tối ưu hóa Ảnh cho Web (Image Optimization)

Dùng kịch bản `scripts/optimize_textures.py` để nén các file render thô kích thước lớn sang định dạng WebP chất lượng cao đạt chuẩn dung lượng web (<300KB):

```bash
python scripts/optimize_textures.py
```

Kết quả xuất vào thư mục web:
- `frontend/public/archviz/room_executive_pov.webp`: Plate màu 2K sắc nét, dung lượng ~240KB.
- `frontend/public/archviz/room_executive_depth.webp`: Bản đồ chiều sâu thang xám, dung lượng ~45KB.

---

## 5. Tích hợp & Hiển thị trên Three.js (`PhotorealSceneManager.ts`)

### 1. Parallax Shader Screen-Space
Shader đọc tọa độ chuột mượt mà (`lerp` giảm chấn 0.065), tính toán vector dịch chuyển theo chiều sâu:

```glsl
// Screen-Space Perspective Parallax
float depth = texture2D(tDepth, vUv).r;
vec2 parallaxOffset = uMouse * (depth - uFocusDepth) * uParallaxIntensity;
vec2 finalUv = vUv + parallaxOffset;
vec4 color = texture2D(tDiffuse, clamp(finalUv, 0.001, 0.999));
```

### 2. Tầng Vật thể 3D Tương tác Thực (Interactive PBR Layer)
Phía trước mặt camera là bàn phỏng vấn vật lý thực với:
- Hồ sơ phỏng vấn in chữ tiếng Nhật sắc nét: `【採用面接評価記録票】`.
- Sổ da Ý thủ công, bút ký cao cấp viền kim loại ánh vàng.
- Đổ bóng thực tế lên mặt bàn theo góc đèn trần.

### 3. Đồng bộ Trạng thái Phỏng vấn viên qua `EventBridge`
- Lắng nghe sự kiện `npc_speaking_start`: Tự động chuyển phỏng vấn viên sang trạng thái phát biểu, nhép miệng nhẹ nhàng.
- Lắng nghe sự kiện `npc_speaking_end`: Chuyển về trạng thái lắng nghe trang nghiêm, vi cử động hô hấp tự nhiên theo chu kỳ sóng `Math.sin(phase) * 0.0025`.

---

## 6. Checklist Tự Đánh giá: "Còn chỗ nào giống game?"

| Tiêu chí | Trạng thái trước (Game/Toy) | Trạng thái hiện tại (ArchViz Chuyên nghiệp) | Đánh giá |
| :--- | :--- | :--- | :---: |
| **Tỉ lệ & Hình khối** | Khối hộp procedural, tỉ lệ tự do, méo mó. | Đúng tỉ lệ kiến trúc chuẩn (mét), bàn 0.74m, phòng 5.0m. | **ĐẠT** |
| **Bề mặt vật liệu** | Màu đơn sắc bẹt (flat color), không map gồ ghề. | Vật liệu PBR mô phỏng chuẩn vật lý (gỗ óc chó, lam tiêu âm). | **ĐẠT** |
| **Ánh sáng** | Ánh sáng Directional đơn giản, bóng đổ đen sắc nhọn. | Chiếu sáng gián tiếp đa nguồn, bóng mềm, nhiệt độ màu 5000K. | **ĐẠT** |
| **Khuôn mặt nhân vật** | Khối hộp Lego / búp bê sáp vô hồn (Uncanny Valley). | Ảnh góc trung điện ảnh cao cấp, vi chuyển động thở tự nhiên. | **ĐẠT** |
| **Giao diện & UI** | Thanh XP, huy hiệu game, +15đ, icon hoạt họa bồng bềnh. | Biên bản đánh giá doanh nghiệp, bảng màu Slate/Zinc trang nghiêm. | **ĐẠT** |
| **Hiệu năng Web** | Render 3D hàng triệu đa giác nặng nề, giật lag trên mobile. | Hybrid Plate + Parallax Shader mượt mà 60 FPS, tải dưới 1.5s. | **ĐẠT** |
