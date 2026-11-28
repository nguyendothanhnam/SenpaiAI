# Danh mục Tài nguyên & Giấy phép (CREDITS.md)

Dự án **SenpaiAI - Môi trường Phỏng vấn Thực tế Nhật Bản (ArchViz Engine)** tuân thủ nghiêm ngặt các tiêu chuẩn bản quyền và giấy phép mã nguồn mở/sáng tạo mở (Open Source & Creative Commons). Mọi tài nguyên đồ họa, âm thanh, phông chữ và texture đều sử dụng tài nguyên miễn phí bản quyền thương mại hoặc do hệ thống tự sinh.

---

## 1. Kết cấu Đồ họa & Vật liệu Kiến trúc (PBR Materials & Textures)

| Tài nguyên | Nguồn cung cấp | Giấy phép | Mô tả ứng dụng trong cảnh |
| :--- | :--- | :--- | :--- |
| **Smoked Walnut Wood Veneer** | [Poly Haven](https://polyhaven.com/) | **CC0 (Public Domain)** | Bề mặt bàn phỏng vấn họp điều hành (Executive Boardroom Table), vân gỗ óc chó đánh bóng mờ. |
| **Acoustic Oak Slats Wall** | [ambientCG](https://ambientcg.com/) | **CC0 (Public Domain)** | Tấm ốp lam gỗ sồi tiêu âm cách âm trên vách hậu phòng phỏng vấn. |
| **Concrete Plaster / Matte Paint** | [ambientCG](https://ambientcg.com/) | **CC0 (Public Domain)** | Sơn tường nhám mờ hấp thụ quang tán xạ, giảm phản xạ gắt. |
| **Architectural Window Glass** | Blender Principled BSDF | Tự sinh (Procedural) | Kính kiến trúc 2 lớp Low-E phản xạ đường chân trời Shinjuku Tokyo. |
| **Brushed Titanium Metal** | Procedural Anisotropic BSDF | Tự sinh (Procedural) | Gọng kính phỏng vấn viên, chân bàn kim loại sơn tĩnh điện mờ. |
| **Corporate Document Paper** | Procedural Canvas Generator | Bản quyền SenpaiAI | Hồ sơ ứng viên và biên bản đánh giá phỏng vấn `【採用面接評価記録票】`. |

---

## 2. Bản đồ Chiều sâu & Hình ảnh Không gian (ArchViz Plates & Depth Maps)

| Thành phần | Đường dẫn tập tin | Định dạng | Giấy phép / Nguồn |
| :--- | :--- | :--- | :--- |
| **Phòng phỏng vấn điều hành (POV Plate)** | `frontend/public/archviz/room_executive_pov.webp` | WebP 2048x1152 (2K) | Dựng bằng Blender Cycles ArchViz Pipeline, ánh sáng 5000K LED + Sky HDRI. |
| **Bản đồ chiều sâu (Z-Depth Map)** | `frontend/public/archviz/room_executive_depth.webp` | WebP 2048x1152 (8-bit normalized) | Xuất trực tiếp từ Blender Compositor Normalize Node, hiệu chuẩn thị sai (Parallax Calibrated). |
| **Phỏng vấn viên - Trạng thái Lắng nghe** | `frontend/public/archviz/interviewer_neutral.webp` | WebP 1024x1024 Alpha | Trang phục vest len công sở may đo Nhật Bản, tư thế trang trọng, vi chuyển động thở. |
| **Phỏng vấn viên - Trạng thái Phát biểu** | `frontend/public/archviz/interviewer_speaking.webp` | WebP 1024x1024 Alpha | Trạng thái phát biểu đồng bộ thời gian thực qua `EventBridge`. |

---

## 3. Kiểu chữ & Biểu tượng (Typography & Icons)

| Thành phần | Nguồn | Giấy phép |
| :--- | :--- | :--- |
| **Noto Serif JP / Mincho** | [Google Fonts](https://fonts.google.com/specimen/Noto+Serif+JP) | **SIL Open Font License 1.1** |
| **Inter / Plus Jakarta Sans** | [Google Fonts](https://fonts.google.com/specimen/Inter) | **SIL Open Font License 1.1** |
| **Lucide Icons** | [Lucide](https://lucide.dev/) | **ISC License** |

---

## 4. Công nghệ & Thư viện Lõi (Core Frameworks)

- **Three.js**: MIT License (Mr.doob and Three.js authors).
- **Blender 4.x (Cycles Render Engine)**: GNU General Public License (GPL).
- **OpenImageDenoise (Intel OIDN)**: Apache License 2.0.
- **WebP & Pillow (PIL)**: BSD / HPND.
- **FastAPI / Python**: MIT License.
- **React / Vite / Tailwind CSS**: MIT License.

---

## 5. Tuyên bố Miễn trừ Thương hiệu (Trademark Disclaimer)

- Mọi tên công ty xuất hiện trong các bài tập phỏng vấn (ví dụ: *株式会社ネクステック - NexTech Corp.*, *株式会社グローバル - Global Corp.*) là **pháp nhân hư cấu** phục vụ mục đích đào tạo và giảng dạy tác phong doanh nghiệp.
- Không sử dụng quốc huy, cờ chính phủ, hoặc logo nhãn hiệu đã được bảo hộ độc quyền của bất kỳ tổ chức kinh tế nào tại Nhật Bản và Việt Nam.
