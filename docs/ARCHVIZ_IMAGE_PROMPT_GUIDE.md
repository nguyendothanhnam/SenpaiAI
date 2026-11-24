# SenpaiAI ArchViz Photorealistic Image Generation Guide

## 1. Phương án lựa chọn: Phương án B (AI Generative Pipeline với Midjourney v6 / Flux.1 Pro) kết hợp Phương án A (Blender Cycles multi-camera fallback)

### Lý do lựa chọn:
- **Phương án B (Chính)**: Đạt độ chân thực ảnh chụp (photorealistic) cao nhất, mô phỏng chính xác chất liệu da người, ánh sáng tán xạ bề mặt (subsurface scattering), nếp vải của bộ suit bespoke, và chiều sâu quang học của phòng họp hiện đại mà không gặp hiện tượng "búp bê vô hồn" (uncanny valley).
- **Phương án A (Dự phòng/Fallback)**: Script Blender Cycles (`scripts/blender/render_interview_archviz_multicam.py`) đã được viết sẵn đầy đủ vật liệu PBR, đèn 5800K/3800K, và 4 camera chuẩn millimeter để render offline khi cần điều chỉnh hình học chuẩn xác đến từng centimet.

---

## 2. Thông số nhất quán (Consistency Parameters)

Để 4 góc máy đồng nhất như một buổi phỏng vấn thực tế tại Tokyo, áp dụng bộ mô tả cố định:
- **Nhân vật**: Fictional 46-year-old Japanese male executive CTO, neatly groomed short black hair with subtle silver strands at temples, wearing rimless titanium glasses, sharp tailored charcoal navy bespoke wool suit, crisp white dress shirt, deep burgundy silk tie, calm dignified posture, professional and attentive expression.
- **Không gian phòng**: High-floor modern executive corporate boardroom in Roppongi Tokyo, floor-to-ceiling windows showing soft daytime Tokyo cityscape bokeh, vertical natural fluted oak wood slat wall on one side, warm neutral matte acoustic ceiling panels with recessed downlights.
- **Bàn phỏng vấn**: Large executive walnut wood conference table with soft chamfered edge, subtle daylight reflection, formal Japanese interview assessment document `【採用面接評価記録票】` with a red Hanko seal, and gold fountain pen.
- **Ánh sáng**: Soft natural window light from the right side (5600K daylight) balanced with warm overhead interior downlights (3800K), soft contact shadows under the table and seated figure, zero harsh glare.
- **Chất lượng quang học**: 35mm-85mm cinema prime lens, f/2.8-f/4.0 aperture, subtle natural depth of field, delicate film grain, Hasselblad color science, photorealistic corporate architectural photography.

---

## 3. Bộ Prompt chi tiết cho từng góc máy (Midjourney v6.1 / Flux.1 Pro)

### Góc 1: POV Seated (Góc nhìn chính thẳng qua bàn phỏng vấn)
> **Prompt**:  
> `First-person POV seated perspective at an executive walnut conference table in a modern Tokyo high-rise boardroom. Directly across the desk, a dignified 46-year-old Japanese male CTO in a tailored charcoal navy wool suit, crisp white dress shirt, burgundy tie, and rimless glasses is seated upright looking attentively toward the camera. His full head, shoulders, and hands resting gently on the table are visible in natural perspective. In the immediate lower foreground, the smooth walnut table surface features an official Japanese interview evaluation paper document with subtle text lines and a circular red hanko stamp, alongside an executive gold ballpoint pen. Soft natural daylight from large floor-to-ceiling windows on the right, balanced with warm recessed architectural ceiling lighting. Shot on Hasselblad H6D-100c, 50mm f/3.2 lens, architectural digest style, clean corporate realism, ultra-detailed, 8k resolution. --ar 16:9 --style raw --v 6.1`

### Góc 2: Over-The-Shoulder (OTS - Qua vai người học)
> **Prompt**:  
> `Cinematic over-the-shoulder shot inside a high-end Tokyo corporate interview boardroom. In the lower left foreground, the out-of-focus dark navy suited shoulder and back of head of the seated job candidate are subtly framed. Across the polished walnut conference desk, the 46-year-old Japanese male executive interviewer with rimless glasses and tailored suit is clearly framed in the medium background, maintaining professional eye contact and listening respectfully. High-floor panoramic windows in the background reveal the Tokyo skyscraper skyline in soft morning atmospheric haze. Natural lighting, shallow depth of field, editorial photography, 50mm anamorphic corporate cinema look, 8k. --ar 16:9 --style raw --v 6.1`

### Góc 3: Wide Shot (Toàn cảnh phòng phỏng vấn)
> **Prompt**:  
> `Wide-angle architectural interior photograph of a prestigious corporate interview room in Tokyo. A long minimalist dark walnut conference table sits in the center with modern leather executive armchairs. In the center seat across the table, the Japanese male interviewer in a bespoke navy suit sits formally. Large floor-to-ceiling glass windows on the side flood the interior with soft daylight, overlooking the hazy Tokyo urban cityscape. The opposite wall features vertical acoustic natural oak slats with a subtle minimalist art piece. High ceiling with linear recessed warm LED architectural fixtures. Perfectly straight vertical lines, 28mm architectural tilt-shift lens, shot for Architectural Digest, immaculate realism, 8k. --ar 16:9 --style raw --v 6.1`

### Góc 4: Desk Close-Up (Cận bàn: Tài liệu, Danh thiếp, Bút ký)
> **Prompt**:  
> `Close-up macro top-angle architectural photograph focusing on the surface of an executive dark walnut conference table during a formal Japanese job interview. In sharp focus on the table is an authentic cream-colored Japanese interview assessment sheet with printed Japanese typography titled '採用面接評価記録票', formal evaluation criteria lines, and an authentic circular vermilion-red hanko seal stamp. Next to it rests an executive gold and black fountain pen and a pristine Japanese business card (meishi). Soft diffused daylight skimming across the rich wood grain texture creating subtle specular highlights. No people visible. Shot on Sony A7R V, 85mm f/2.8 macro lens, sharp detail, corporate documentary elegance, 8k. --ar 16:9 --style raw --v 6.1`

---

## 4. Cách tạo Depth Map hiệu chuẩn (Calibrated Depth Maps)

Sau khi tạo hoặc duyệt ảnh đẹp nhất:
1. Dùng mô hình mã nguồn mở **Depth Anything V2** (`vitl` hoặc `vits`) hoặc **Marigold Depth**:
   ```bash
   python run_depth.py --img-path frontend/public/archviz/room_executive_pov.webp --outdir frontend/public/archviz/
   ```
2. Lưu depth map thành WebP thang độ xám 8-bit (`room_executive_depth.webp`):
   - Trắng (255): Mặt bàn cận cảnh (foreground).
   - Xám trung tính (140): Nhà tuyển dụng ngồi bên kia bàn.
   - Đen (30): Bầu trời / cửa sổ ở xa vô cực.

Shader trong Three.js (`PhotorealSceneManager.ts`) tự động đọc depth map này để tạo hiệu ứng thị sai (parallax) chân thực khi người dùng di chuột hoặc nghiêng thiết bị.

---

## 5. Bản quyền và Pháp lý (Compliance & Licensing)
- **Tên công ty**: `株式会社ネクステック` (NexTech Tokyo) là tên công ty hư cấu hoàn toàn, không xâm phạm thương hiệu thật.
- **Khuôn mặt nhân vật**: Hoàn toàn là nhân vật tổng hợp hư cấu (synthetic synthetic identity), không sử dụng hình ảnh của người thật khi chưa có ủy quyền pháp lý.
- **Tài liệu tham khảo & Texture**: Toàn bộ texture nền và ảnh đều được cấp phép CC0 (Unsplash License / ambientCG).
