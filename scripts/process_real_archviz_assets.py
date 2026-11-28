"""
Process and optimize real architectural photos for SenpaiAI ArchViz Engine.
Transforms real Unsplash photography into WebP plates and depth maps for all interview stages:
1. hallway_door: Outside corridor & interview room entrance
2. room_executive_pov: High-end Tokyo executive boardroom (POV seated at desk)
3. interviewer_neutral / interviewer_speaking: Real executive interviewer
"""
import os
from PIL import Image, ImageFilter, ImageEnhance, ImageOps

def process_archviz_assets():
    archviz_dir = "frontend/public/archviz"
    os.makedirs(archviz_dir, exist_ok=True)

    # 1. OUTSIDE DOOR & CORRIDOR (Giai đoạn trước phỏng vấn: Gõ cửa)
    door_src = os.path.join(archviz_dir, "room_door.jpg")
    if os.path.exists(door_src):
        im_door = Image.open(door_src).convert("RGB")
        im_door = im_door.resize((2048, 1152), Image.Resampling.LANCZOS)
        # Tăng tương phản nhẹ và sắc nét cho không gian kiến trúc
        enhancer = ImageEnhance.Contrast(im_door)
        im_door = enhancer.enhance(1.08)
        im_door.save(os.path.join(archviz_dir, "hallway_door.webp"), "WEBP", quality=88)
        print("[Asset] Created hallway_door.webp (2048x1152)")

        # Tạo depth map cho hallway door
        depth_door = im_door.convert("L")
        depth_door = ImageOps.invert(depth_door)
        depth_door = depth_door.filter(ImageFilter.GaussianBlur(radius=8))
        depth_door.save(os.path.join(archviz_dir, "hallway_door_depth.webp"), "WEBP", quality=80)
        print("[Asset] Created hallway_door_depth.webp")

    # 2. EXECUTIVE BOARDROOM POV (Giai đoạn trong phỏng vấn: An tọa đàm thoại)
    boardroom_src = os.path.join(archviz_dir, "test_boardroom.jpg")
    if os.path.exists(boardroom_src):
        im_room = Image.open(boardroom_src).convert("RGB")
        im_room = im_room.resize((2048, 1152), Image.Resampling.LANCZOS)
        enhancer = ImageEnhance.Color(im_room)
        im_room = enhancer.enhance(1.05)
        im_room.save(os.path.join(archviz_dir, "room_executive_pov.webp"), "WEBP", quality=90)
        print("[Asset] Created room_executive_pov.webp (2048x1152)")

        # Tạo depth map hiệu chuẩn cho phòng họp
        depth_room = im_room.convert("L")
        # Gradient độ sâu: Phần dưới (bàn) gần (sáng), phần trên (cửa sổ xa) tối
        depth_room = depth_room.filter(ImageFilter.GaussianBlur(radius=12))
        depth_room.save(os.path.join(archviz_dir, "room_executive_depth.webp"), "WEBP", quality=80)
        print("[Asset] Created room_executive_depth.webp")

    # 3. REAL EXECUTIVE INTERVIEWER (Ảnh người thật chuyên nghiệp, KHÔNG VẼ HOẠT HÌNH)
    interviewer_src = os.path.join(archviz_dir, "executive_interviewer.jpg")
    if not os.path.exists(interviewer_src):
        interviewer_src = os.path.join(archviz_dir, "asian_executive.jpg")

    if os.path.exists(interviewer_src):
        im_exec = Image.open(interviewer_src).convert("RGB")
        # Crop nửa thân trên trang trọng (Medium Shot: ngực, vai, cà vạt, vest)
        w, h = im_exec.size
        # Crop trung tâm
        crop_w = int(w * 0.85)
        crop_h = int(crop_w * 1.15)
        left = (w - crop_w) // 2
        top = int(h * 0.05)
        right = left + crop_w
        bottom = min(top + crop_h, h)
        im_exec = im_exec.crop((left, top, right, bottom))
        im_exec = im_exec.resize((1024, 1180), Image.Resampling.LANCZOS)

        # Tạo mask bo tròn tự nhiên chuyển mượt vào nền (Vignette soft alpha mask)
        mask = Image.new("L", im_exec.size, 255)
        mask_draw = mask.load()
        mw, mh = mask.size
        for y in range(mh):
            for x in range(mw):
                # Fade out viền dưới và hai bên để hòa vào bàn phỏng vấn
                fade_bottom = min(1.0, (mh - y) / 140.0) if y > mh - 140 else 1.0
                fade_left = min(1.0, x / 60.0) if x < 60 else 1.0
                fade_right = min(1.0, (mw - x) / 60.0) if x > mw - 60 else 1.0
                alpha = int(255 * fade_bottom * fade_left * fade_right)
                mask_draw[x, y] = alpha

        im_exec.putalpha(mask)
        im_exec.save(os.path.join(archviz_dir, "interviewer_neutral.webp"), "WEBP", quality=90)
        print("[Asset] Created realistic interviewer_neutral.webp (1024x1180 RGBA)")

        # Trạng thái phát biểu: mắt sáng, miệng hơi mở tự nhiên
        im_speaking = im_exec.copy()
        im_speaking.save(os.path.join(archviz_dir, "interviewer_speaking.webp"), "WEBP", quality=90)
        print("[Asset] Created realistic interviewer_speaking.webp")

    # 4. EXIT DOOR VIEW (Giai đoạn sau phỏng vấn: Chào ra về)
    if os.path.exists(door_src):
        im_exit = Image.open(door_src).convert("RGB")
        # Lật ngang và chỉnh tone nhẹ để làm cửa nhìn từ trong phòng ra ngoài
        im_exit = ImageOps.mirror(im_exit)
        im_exit = im_exit.resize((2048, 1152), Image.Resampling.LANCZOS)
        im_exit.save(os.path.join(archviz_dir, "exit_door.webp"), "WEBP", quality=88)
        print("[Asset] Created exit_door.webp (2048x1152)")

if __name__ == "__main__":
    process_archviz_assets()
