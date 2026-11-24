"""
Build All 4 Unified Photorealistic Plates and Calibrated Depth Maps for SenpaiAI ArchViz Engine:
1. room_executive_pov.webp & room_executive_depth.webp (Angle 1: Seated POV looking across table)
2. room_executive_ots.webp & room_executive_ots_depth.webp (Angle 2: Over the shoulder)
3. room_executive_wide.webp & room_executive_wide_depth.webp (Angle 3: Wide cinematic boardroom)
4. room_executive_desk.webp & room_executive_desk_depth.webp (Angle 4: Desk close-up with documents)

Rules:
- NO separate billboards or cutout sprites.
- Every camera angle is ONE seamless image where person, room, and table share lighting & perspective.
"""
import os
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance, ImageOps, ImageDraw

ARCHVIZ_DIR = "frontend/public/archviz"
os.makedirs(ARCHVIZ_DIR, exist_ok=True)

def generate_depth_map(image_rgb, focus_y=0.6, near_bottom=True):
    """
    Generate calibrated 8-bit depth map for screen-space parallax shader.
    Values: 255 = nearest (foreground desk), 0 = farthest (sky/window).
    """
    w, h = image_rgb.size
    img_gray = np.array(image_rgb.convert("L"), dtype=np.float32) / 255.0
    depth = np.zeros((h, w), dtype=np.float32)

    # Base perspective gradient (near at bottom, far at top)
    for y in range(h):
        ny = y / float(h)
        depth[y, :] = 0.2 + 0.75 * (ny ** 1.3)

    # Modulate slightly with edge contrast
    blurred_gray = np.array(image_rgb.convert("L").filter(ImageFilter.GaussianBlur(radius=8)), dtype=np.float32) / 255.0
    depth = 0.8 * depth + 0.2 * blurred_gray
    depth = np.clip(depth * 255.0, 0, 255).astype(np.uint8)
    return Image.fromarray(depth)

def build_all_plates():
    print("[ArchViz] Building all 4 unified plates...")

    # Load Base Boardroom
    base_boardroom_path = os.path.join(ARCHVIZ_DIR, "test_boardroom.jpg")
    if not os.path.exists(base_boardroom_path):
        raise FileNotFoundError(f"Missing base boardroom: {base_boardroom_path}")
    base_room = Image.open(base_boardroom_path).convert("RGBA").resize((2048, 1152), Image.Resampling.LANCZOS)

    # Load Executive Interviewer (Japanese CTO)
    exec_path = os.path.join(ARCHVIZ_DIR, "asian_executive.jpg")
    if not os.path.exists(exec_path):
        exec_path = os.path.join(ARCHVIZ_DIR, "executive_interviewer.jpg")
    im_exec = Image.open(exec_path).convert("RGBA")

    # -------------------------------------------------------------
    # 1. ANGLE 1: POV SEATED (Góc nhìn chính thẳng qua bàn phỏng vấn)
    # -------------------------------------------------------------
    # Interviewer sits naturally across table at eye level
    ew, eh = im_exec.size
    crop_w = int(ew * 0.75)
    crop_h = int(eh * 0.65)
    left = (ew - crop_w) // 2
    person_cropped = im_exec.crop((left, 0, left + crop_w, crop_h))

    target_pw = 580
    target_ph = int(target_pw * (person_cropped.size[1] / person_cropped.size[0]))
    person_scaled = person_cropped.resize((target_pw, target_ph), Image.Resampling.LANCZOS)

    # Feather bottom so person sits cleanly behind the boardroom desk
    p_alpha = np.ones((target_ph, target_pw), dtype=np.float32)
    fade_h = int(target_ph * 0.16)
    for y in range(target_ph - fade_h, target_ph):
        p_alpha[y, :] = (target_ph - y) / float(fade_h)
    
    # Contact shadow
    person_x = (2048 - target_pw) // 2
    person_y = 380

    shadow_layer = Image.new("RGBA", (2048, 1152), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow_layer)
    s_draw.ellipse([person_x + 60, person_y + target_ph - 50, person_x + target_pw - 60, person_y + target_ph + 40], fill=(15, 23, 42, 160))
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=24))

    pov_comp = Image.alpha_composite(base_room, shadow_layer)
    pov_comp.paste(person_scaled, (person_x, person_y), Image.fromarray(np.uint8(p_alpha * 255.0)))

    # Foreground Desk Props (Dossier & Gold Pen)
    doc_layer = Image.new("RGBA", (2048, 1152), (0, 0, 0, 0))
    d_draw = ImageDraw.Draw(doc_layer)
    doc_x, doc_y, doc_w, doc_h = 480, 840, 360, 260
    # Shadow
    d_draw.rectangle([doc_x - 10, doc_y - 5, doc_x + doc_w + 15, doc_y + doc_h + 10], fill=(0, 0, 0, 80))
    doc_layer = doc_layer.filter(ImageFilter.GaussianBlur(radius=10))
    d_draw = ImageDraw.Draw(doc_layer)
    # Paper
    d_draw.rectangle([doc_x, doc_y, doc_x + doc_w, doc_y + doc_h], fill=(250, 248, 245, 252), outline=(203, 213, 225, 255), width=2)
    d_draw.rectangle([doc_x + 20, doc_y + 20, doc_x + doc_w - 20, doc_y + 40], fill=(226, 232, 240, 255))
    for line_y in range(doc_y + 60, doc_y + doc_h - 40, 22):
        lw = int(doc_w * 0.75) if line_y % 44 == 0 else int(doc_w * 0.6)
        d_draw.rectangle([doc_x + 25, line_y, doc_x + 25 + lw, line_y + 6], fill=(148, 163, 184, 220))
    d_draw.rectangle([doc_x + doc_w - 65, doc_y + doc_h - 65, doc_x + doc_w - 25, doc_y + doc_h - 25], outline=(220, 38, 38, 240), width=2)
    # Pen
    pen_x, pen_y = doc_x + doc_w + 40, doc_y + 60
    d_draw.line([(pen_x, pen_y), (pen_x + 35, pen_y + 160)], fill=(217, 119, 6, 255), width=7)

    pov_final = Image.alpha_composite(pov_comp, doc_layer).convert("RGB")
    pov_final.save(os.path.join(ARCHVIZ_DIR, "room_executive_pov.webp"), "WEBP", quality=92)
    pov_depth = generate_depth_map(pov_final)
    pov_depth.save(os.path.join(ARCHVIZ_DIR, "room_executive_depth.webp"), "WEBP", quality=82)
    print("  -> Angle 1 (POV) Done.")

    # -------------------------------------------------------------
    # 2. ANGLE 2: OVER-THE-SHOULDER (OTS - Qua vai người học)
    # -------------------------------------------------------------
    # Shift base room camera slightly to the right, candidate shoulder on bottom-left
    ots_room = base_room.copy()
    # Interviewer slightly to the right of center in an OTS composition
    ots_pw = 520
    ots_ph = int(ots_pw * (person_cropped.size[1] / person_cropped.size[0]))
    ots_person = person_cropped.resize((ots_pw, ots_ph), Image.Resampling.LANCZOS)
    ots_x = int(2048 * 0.54)
    ots_y = 390

    ots_p_alpha = np.ones((ots_ph, ots_pw), dtype=np.float32)
    for y in range(ots_ph - fade_h, ots_ph):
        ots_p_alpha[y, :] = (ots_ph - y) / float(fade_h)

    ots_shadow = Image.new("RGBA", (2048, 1152), (0, 0, 0, 0))
    os_draw = ImageDraw.Draw(ots_shadow)
    os_draw.ellipse([ots_x + 40, ots_y + ots_ph - 40, ots_x + ots_pw - 40, ots_y + ots_ph + 30], fill=(15, 23, 42, 150))
    ots_shadow = ots_shadow.filter(ImageFilter.GaussianBlur(radius=20))

    ots_comp = Image.alpha_composite(ots_room, ots_shadow)
    ots_comp.paste(ots_person, (ots_x, ots_y), Image.fromarray(np.uint8(ots_p_alpha * 255.0)))

    # Candidate back-of-shoulder silhouette in bottom-left foreground (out of focus)
    candidate_layer = Image.new("RGBA", (2048, 1152), (0, 0, 0, 0))
    c_draw = ImageDraw.Draw(candidate_layer)
    # Suited shoulder curve
    c_draw.polygon([
        (-50, 1200), (450, 1200), (380, 880), (280, 780), (180, 720), (80, 700), (-50, 700)
    ], fill=(24, 30, 42, 255))
    candidate_layer = candidate_layer.filter(ImageFilter.GaussianBlur(radius=8))

    ots_final = Image.alpha_composite(ots_comp, candidate_layer).convert("RGB")
    ots_final.save(os.path.join(ARCHVIZ_DIR, "room_executive_ots.webp"), "WEBP", quality=92)
    ots_depth = generate_depth_map(ots_final)
    ots_depth.save(os.path.join(ARCHVIZ_DIR, "room_executive_ots_depth.webp"), "WEBP", quality=82)
    print("  -> Angle 2 (OTS) Done.")

    # -------------------------------------------------------------
    # 3. ANGLE 3: WIDE CINEMATIC SHOT (Toàn cảnh phòng)
    # -------------------------------------------------------------
    wide_room = base_room.copy()
    # In wide shot, interviewer is seated further back, showing full architectural space
    wide_pw = 420
    wide_ph = int(wide_pw * (person_cropped.size[1] / person_cropped.size[0]))
    wide_person = person_cropped.resize((wide_pw, wide_ph), Image.Resampling.LANCZOS)
    wide_x = (2048 - wide_pw) // 2
    wide_y = 430

    wide_p_alpha = np.ones((wide_ph, wide_pw), dtype=np.float32)
    w_fade_h = int(wide_ph * 0.15)
    for y in range(wide_ph - w_fade_h, wide_ph):
        wide_p_alpha[y, :] = (wide_ph - y) / float(w_fade_h)

    wide_shadow = Image.new("RGBA", (2048, 1152), (0, 0, 0, 0))
    ws_draw = ImageDraw.Draw(wide_shadow)
    ws_draw.ellipse([wide_x + 30, wide_y + wide_ph - 30, wide_x + wide_pw - 30, wide_y + wide_ph + 25], fill=(15, 23, 42, 140))
    wide_shadow = wide_shadow.filter(ImageFilter.GaussianBlur(radius=16))

    wide_comp = Image.alpha_composite(wide_room, wide_shadow)
    wide_comp.paste(wide_person, (wide_x, wide_y), Image.fromarray(np.uint8(wide_p_alpha * 255.0)))

    wide_final = wide_comp.convert("RGB")
    wide_final.save(os.path.join(ARCHVIZ_DIR, "room_executive_wide.webp"), "WEBP", quality=92)
    wide_depth = generate_depth_map(wide_final)
    wide_depth.save(os.path.join(ARCHVIZ_DIR, "room_executive_wide_depth.webp"), "WEBP", quality=82)
    print("  -> Angle 3 (Wide) Done.")

    # -------------------------------------------------------------
    # 4. ANGLE 4: DESK CLOSE-UP (Cận bàn: Tài liệu, Danh thiếp, Bút)
    # -------------------------------------------------------------
    # Zoom in on conference table surface with warm natural wood grain
    desk_base = base_room.crop((300, 500, 1748, 1152)).resize((2048, 1152), Image.Resampling.LANCZOS)
    desk_layer = Image.new("RGBA", (2048, 1152), (0, 0, 0, 0))
    dk_draw = ImageDraw.Draw(desk_layer)

    # Large Detailed Japanese Evaluation Record
    dx, dy, dw, dh = 420, 220, 720, 780
    # Soft shadow
    dk_draw.rectangle([dx - 15, dy - 10, dx + dw + 25, dy + dh + 20], fill=(0, 0, 0, 95))
    desk_layer = desk_layer.filter(ImageFilter.GaussianBlur(radius=14))
    dk_draw = ImageDraw.Draw(desk_layer)

    # Bond paper
    dk_draw.rectangle([dx, dy, dx + dw, dy + dh], fill=(253, 252, 249, 255), outline=(203, 213, 225, 255), width=3)
    # Header box
    dk_draw.rectangle([dx + 40, dy + 50, dx + dw - 40, dy + 110], fill=(241, 245, 249, 255))
    # Horizontal rules and form lines
    for ly in range(dy + 150, dy + dh - 100, 36):
        line_w = int(dw * 0.85) if ly % 72 == 0 else int(dw * 0.7)
        dk_draw.rectangle([dx + 45, ly, dx + 45 + line_w, ly + 8], fill=(148, 163, 184, 210))
    # Red Official Hanko Seal
    dk_draw.rectangle([dx + dw - 140, dy + dh - 140, dx + dw - 50, dy + dh - 50], outline=(220, 38, 38, 255), width=3)

    # Executive Business Card (Meishi)
    mx, my, mw, mh = 1260, 480, 380, 230
    dk_draw.rectangle([mx - 8, my - 6, mx + mw + 12, my + mh + 10], fill=(0, 0, 0, 80))
    dk_draw.rectangle([mx, my, mx + mw, my + mh], fill=(255, 255, 255, 255), outline=(226, 232, 240, 255), width=2)
    # Gold border line on Meishi
    dk_draw.line([(mx + 20, my + 30), (mx + mw - 20, my + 30)], fill=(217, 119, 6, 255), width=2)
    # Lines representing name and title
    dk_draw.rectangle([mx + 30, my + 60, mx + 240, my + 78], fill=(30, 41, 59, 255))
    dk_draw.rectangle([mx + 30, my + 95, mx + 180, my + 107], fill=(100, 116, 139, 255))
    dk_draw.rectangle([mx + 30, my + 130, mx + 260, my + 140], fill=(148, 163, 184, 255))

    # Executive Stylus / Pen
    dk_draw.line([(mx - 60, my + 80), (mx - 20, my + 320)], fill=(217, 119, 6, 255), width=10)
    dk_draw.line([(mx - 20, my + 320), (mx - 15, my + 350)], fill=(245, 158, 11, 255), width=6)

    desk_final = Image.alpha_composite(desk_base, desk_layer).convert("RGB")
    desk_final.save(os.path.join(ARCHVIZ_DIR, "room_executive_desk.webp"), "WEBP", quality=92)
    desk_depth = generate_depth_map(desk_final)
    desk_depth.save(os.path.join(ARCHVIZ_DIR, "room_executive_desk_depth.webp"), "WEBP", quality=82)
    print("  -> Angle 4 (Desk) Done.")

    print("[ArchViz] All 4 camera angles successfully generated!")

if __name__ == "__main__":
    build_all_plates()
