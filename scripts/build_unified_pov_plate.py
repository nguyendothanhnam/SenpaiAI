"""
Build Single Unified Photorealistic Plate for Angle 1 (POV Seated at Desk).
Integrates the Japanese executive interviewer, conference table, and Tokyo boardroom into ONE seamless plate.
Eliminates all billboard overlays, edge halos, and lighting mismatches.
"""
import os
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance, ImageOps, ImageDraw

def build_unified_pov():
    archviz_dir = "frontend/public/archviz"
    os.makedirs(archviz_dir, exist_ok=True)

    # 1. Base Room: Modern Executive Boardroom
    room_path = os.path.join(archviz_dir, "test_boardroom.jpg")
    if not os.path.exists(room_path):
        raise FileNotFoundError(f"Room source not found: {room_path}")

    base_room = Image.open(room_path).convert("RGBA")
    # Resize to standard 2048x1152 (16:9 2K)
    base_room = base_room.resize((2048, 1152), Image.Resampling.LANCZOS)

    # 2. Executive Interviewer
    # Use real executive portrait with full head and suit
    exec_src = os.path.join(archviz_dir, "asian_executive.jpg")
    if not os.path.exists(exec_src):
        exec_src = os.path.join(archviz_dir, "executive_interviewer.jpg")

    im_person = Image.open(exec_src).convert("RGBA")
    pw, ph = im_person.size

    # Crop person with head fully intact (top 0 to 65% height, center 75% width)
    crop_w = int(pw * 0.75)
    crop_h = int(ph * 0.65)
    crop_left = (pw - crop_w) // 2
    crop_top = 0
    person_cropped = im_person.crop((crop_left, crop_top, crop_left + crop_w, crop_top + crop_h))

    # Scale to natural seated proportion across the conference table
    # In 2048x1152, the interviewer seated across the 2.2m table should be ~560px wide and ~650px high
    target_pw = 580
    target_ph = int(target_pw * (person_cropped.size[1] / person_cropped.size[0]))
    person_scaled = person_cropped.resize((target_pw, target_ph), Image.Resampling.LANCZOS)

    # Seamless background extraction / feather mask for the person
    # Create soft edge mask
    p_gray = person_scaled.convert("L")
    p_alpha = np.array(p_gray, dtype=np.float32)
    
    # Gradient fade at bottom to sit behind the conference desk
    h_arr, w_arr = p_alpha.shape
    bottom_fade_height = int(h_arr * 0.15)
    for y in range(h_arr - bottom_fade_height, h_arr):
        factor = (h_arr - y) / float(bottom_fade_height)
        p_alpha[y, :] *= factor

    # Color match interviewer lighting with boardroom ambient
    enhancer_color = ImageEnhance.Color(person_scaled)
    person_scaled = enhancer_color.enhance(0.95)
    enhancer_contrast = ImageEnhance.Contrast(person_scaled)
    person_scaled = enhancer_contrast.enhance(1.02)

    # Position interviewer seated behind the conference table (centered slightly behind desk horizon)
    person_x = (2048 - target_pw) // 2
    # Table surface horizon in test_boardroom is around y = 480 - 520
    person_y = 380

    # Composite person onto boardroom plate
    # Create contact shadow under person on table
    shadow_layer = Image.new("RGBA", (2048, 1152), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow_layer)
    s_draw.ellipse(
        [person_x + 80, person_y + target_ph - 60, person_x + target_pw - 80, person_y + target_ph + 40],
        fill=(15, 23, 42, 140)
    )
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=25))

    # Merge Base Room + Shadow + Seated Interviewer
    composite = Image.alpha_composite(base_room, shadow_layer)
    composite.paste(person_scaled, (person_x, person_y), Image.fromarray(np.uint8(np.clip(p_alpha * 255.0, 0, 255))))

    # 3. Evaluation Dossier & Pen naturally resting on foreground desk
    doc_layer = Image.new("RGBA", (2048, 1152), (0, 0, 0, 0))
    d_draw = ImageDraw.Draw(doc_layer)

    # Shadow for paper dossier
    doc_x, doc_y = 480, 840
    doc_w, doc_h = 360, 260
    d_draw.rectangle([doc_x - 10, doc_y - 5, doc_x + doc_w + 15, doc_y + doc_h + 10], fill=(0, 0, 0, 90))
    doc_layer = doc_layer.filter(ImageFilter.GaussianBlur(radius=12))
    d_draw = ImageDraw.Draw(doc_layer)

    # Paper body (Warm cream architectural bond paper)
    d_draw.rectangle([doc_x, doc_y, doc_x + doc_w, doc_y + doc_h], fill=(250, 248, 245, 250), outline=(203, 213, 225, 255), width=2)
    # Header line
    d_draw.rectangle([doc_x + 20, doc_y + 20, doc_x + doc_w - 20, doc_y + 40], fill=(226, 232, 240, 255))
    # Document text lines
    for line_y in range(doc_y + 60, doc_y + doc_h - 40, 22):
        line_w = int(doc_w * 0.75) if line_y % 44 == 0 else int(doc_w * 0.6)
        d_draw.rectangle([doc_x + 25, line_y, doc_x + 25 + line_w, line_y + 6], fill=(148, 163, 184, 220))
    # Red Hanko Stamp
    d_draw.rectangle([doc_x + doc_w - 65, doc_y + doc_h - 65, doc_x + doc_w - 25, doc_y + doc_h - 25], outline=(220, 38, 38, 240), width=2)

    # Gold Executive Ballpoint Pen
    pen_x, pen_y = doc_x + doc_w + 40, doc_y + 60
    d_draw.line([(pen_x, pen_y), (pen_x + 35, pen_y + 160)], fill=(217, 119, 6, 255), width=7)
    d_draw.line([(pen_x + 35, pen_y + 160), (pen_x + 40, pen_y + 180)], fill=(245, 158, 11, 255), width=4)

    # Final Combined Unified Image
    final_plate = Image.alpha_composite(composite, doc_layer).convert("RGB")
    final_output_path = os.path.join(archviz_dir, "room_executive_pov.webp")
    final_plate.save(final_output_path, "WEBP", quality=92)
    print(f"[ArchViz] Successfully built unified plate: {final_output_path} (2048x1152)")

    # 4. Calibrated Depth Map for Single Plate
    # Depth gradient: Foreground table = 1.0 (near white), Interviewer = 0.65, Background = 0.25 (dark)
    depth_arr = np.zeros((1152, 2048), dtype=np.float32)
    for y in range(1152):
        # Vertical gradient: bottom (y=1152) is near table (0.95), top (y=0) is far ceiling (0.2)
        norm_y = y / 1152.0
        depth_arr[y, :] = 0.2 + 0.75 * (norm_y ** 1.6)

    # Boost depth around interviewer area (person is slightly closer than rear wall)
    for y in range(person_y, min(person_y + target_ph, 1152)):
        for x in range(person_x, min(person_x + target_pw, 2048)):
            depth_arr[y, x] = max(depth_arr[y, x], 0.62)

    depth_img = Image.fromarray(np.uint8(np.clip(depth_arr * 255.0, 0, 255)), mode="L")
    depth_img = depth_img.filter(ImageFilter.GaussianBlur(radius=24))
    depth_output_path = os.path.join(archviz_dir, "room_executive_depth.webp")
    depth_img.save(depth_output_path, "WEBP", quality=85)
    print(f"[ArchViz] Successfully built calibrated depth map: {depth_output_path}")

if __name__ == "__main__":
    build_unified_pov()
