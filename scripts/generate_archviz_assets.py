"""
Generate photorealistic ArchViz base plates and normalized 16-bit/8-bit depth maps
for the SenpaiAI Executive Interview Suite (Tokyo Headquarters).
"""
import os
import math
from PIL import Image, ImageDraw, ImageFilter

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "archviz")
os.makedirs(OUTPUT_DIR, exist_ok=True)

WIDTH = 2048
HEIGHT = 1152

def create_photoreal_executive_room():
    """Generates a high-fidelity ArchViz plate representing a modern Tokyo executive interview suite."""
    img = Image.new("RGBA", (WIDTH, HEIGHT), (245, 245, 248, 255))
    draw = ImageDraw.Draw(img)

    # 1. Soft daylight ceiling & acoustic panel gradient (4500K - 5000K neutral daylight)
    for y in range(int(HEIGHT * 0.35)):
        ratio = y / (HEIGHT * 0.35)
        # Soft neutral office white with subtle ceiling lighting
        r = int(240 - 25 * ratio)
        g = int(242 - 25 * ratio)
        b = int(245 - 25 * ratio)
        draw.line([(0, y), (WIDTH, y)], fill=(r, g, b, 255))

    # Recessed LED architectural light troughs on ceiling
    for lx in [WIDTH * 0.25, WIDTH * 0.5, WIDTH * 0.75]:
        draw.rectangle([lx - 90, 0, lx + 90, 70], fill=(255, 255, 255, 255))
        draw.rectangle([lx - 100, 0, lx - 90, 75], fill=(200, 205, 210, 255))
        draw.rectangle([lx + 90, 0, lx + 100, 75], fill=(200, 205, 210, 255))

    # 2. Large floor-to-ceiling panoramic glass window (Tokyo Shinjuku daylight view)
    win_left = int(WIDTH * 0.52)
    win_right = int(WIDTH * 0.96)
    win_top = int(HEIGHT * 0.08)
    win_bottom = int(HEIGHT * 0.62)

    # Sky gradient outside window
    for wy in range(win_top, win_bottom):
        w_ratio = (wy - win_top) / (win_bottom - win_top)
        # Tokyo morning sky: soft pale azure to warm horizon haze
        sr = int(175 + 50 * w_ratio)
        sg = int(205 + 35 * w_ratio)
        sb = int(235 + 15 * w_ratio)
        draw.line([(win_left, wy), (win_right, wy)], fill=(sr, sg, sb, 255))

    # Tokyo high-rise silhouettes through window
    skyscrapers = [
        (win_left + 40, win_top + 180, 110, 240, (140, 155, 175)),
        (win_left + 180, win_top + 110, 140, 310, (125, 140, 162)),
        (win_left + 350, win_top + 70, 160, 350, (115, 130, 155)),
        (win_left + 540, win_top + 140, 120, 280, (135, 150, 170)),
        (win_left + 690, win_top + 90, 150, 330, (120, 135, 158)),
    ]
    for sx, sy, sw, sh, scol in skyscrapers:
        draw.rectangle([sx, sy, sx + sw, win_bottom], fill=(*scol, 255))
        # Subtle illuminated architectural window grid
        for gy in range(sy + 20, win_bottom - 20, 18):
            for gx in range(sx + 15, sx + sw - 15, 14):
                draw.rectangle([gx, gy, gx + 5, gy + 8], fill=(245, 248, 255, 180))

    # Window frame mullions (black anodized architectural aluminum)
    frame_color = (45, 48, 54, 255)
    draw.rectangle([win_left - 8, win_top - 8, win_right + 8, win_top], fill=frame_color)
    draw.rectangle([win_left - 8, win_bottom, win_right + 8, win_bottom + 8], fill=frame_color)
    draw.rectangle([win_left - 8, win_top, win_left, win_bottom], fill=frame_color)
    draw.rectangle([win_right, win_top, win_right + 8, win_bottom], fill=frame_color)
    # Vertical mullion divider
    mid_mullion = int((win_left + win_right) / 2)
    draw.rectangle([mid_mullion - 4, win_top, mid_mullion + 4, win_bottom], fill=frame_color)

    # 3. Left Wall: Acoustic timber slats (Japanese Hinoki / White Oak slat wall)
    slat_start = 0
    slat_end = int(WIDTH * 0.48)
    wall_bottom = int(HEIGHT * 0.65)
    draw.rectangle([slat_start, int(HEIGHT * 0.08), slat_end, wall_bottom], fill=(225, 218, 208, 255))

    # Vertical oak slats with natural shadow grooves
    for sx in range(slat_start + 60, slat_end - 40, 28):
        # Shadow groove
        draw.rectangle([sx - 2, int(HEIGHT * 0.08), sx, wall_bottom], fill=(130, 115, 100, 255))
        # Warm oak slat face
        draw.rectangle([sx, int(HEIGHT * 0.08), sx + 18, wall_bottom], fill=(215, 195, 172, 255))
        # Highlight edge
        draw.rectangle([sx + 17, int(HEIGHT * 0.08), sx + 18, wall_bottom], fill=(235, 220, 205, 255))

    # 4. Far wall: Minimalist frosted glass executive corporate board
    board_x1 = int(WIDTH * 0.12)
    board_x2 = int(WIDTH * 0.42)
    board_y1 = int(HEIGHT * 0.18)
    board_y2 = int(HEIGHT * 0.48)
    draw.rectangle([board_x1, board_y1, board_x2, board_y2], fill=(245, 248, 252, 230))
    draw.rectangle([board_x1, board_y1, board_x2, board_y2], outline=(180, 190, 205, 255), width=3)
    # Stand-off steel bolts
    for bx, by in [(board_x1 + 15, board_y1 + 15), (board_x2 - 15, board_y1 + 15),
                  (board_x1 + 15, board_y2 - 15), (board_x2 - 15, board_y2 - 15)]:
        draw.ellipse([bx - 6, by - 6, bx + 6, by + 6], fill=(160, 170, 180, 255))

    # Japanese corporate typography on board
    # Subtle elegant heading
    draw.text((board_x1 + 45, board_y1 + 40), "SENPAI INNOVATIONS TOKYO", fill=(70, 80, 95, 255))
    draw.text((board_x1 + 45, board_y1 + 75), "採用選考・総合評価会議", fill=(45, 55, 70, 255))
    draw.line([(board_x1 + 45, board_y1 + 115), (board_x2 - 45, board_y1 + 115)], fill=(190, 200, 215, 255), width=2)
    draw.text((board_x1 + 45, board_y1 + 135), "1. 専門技術力・論理的思考", fill=(90, 100, 115, 255))
    draw.text((board_x1 + 45, board_y1 + 170), "2. ビジネスマナー・報連相", fill=(90, 100, 115, 255))
    draw.text((board_x1 + 45, board_y1 + 205), "3. 日本企業への適応力", fill=(90, 100, 115, 255))

    # 5. Executive Boardroom Conference Table (Foreground ArchViz anchor)
    # Deep Japanese Smoked Oak veneer with beveled edge and chamfer
    table_y = int(HEIGHT * 0.58)
    draw.rectangle([0, table_y, WIDTH, HEIGHT], fill=(28, 26, 24, 255))
    
    # Table top veneer surface with subtle perspective reflection
    for ty in range(table_y, HEIGHT):
        t_ratio = (ty - table_y) / (HEIGHT - table_y)
        # Smoked walnut gradient
        vr = int(45 - 20 * t_ratio)
        vg = int(40 - 18 * t_ratio)
        vb = int(36 - 15 * t_ratio)
        draw.line([(0, ty), (WIDTH, ty)], fill=(vr, vg, vb, 255))

    # Brushed aluminum chamfer edge across table front
    draw.line([(0, table_y), (WIDTH, table_y)], fill=(195, 190, 182, 255), width=3)
    draw.line([(0, table_y + 3), (WIDTH, table_y + 3)], fill=(120, 115, 110, 255), width=2)

    # 6. Natural soft bounce reflection on table surface
    # Reflection of Shinjuku window on polished table
    ref_x1 = int(WIDTH * 0.52)
    ref_x2 = int(WIDTH * 0.94)
    ref_y = int(HEIGHT * 0.59)
    for ry in range(ref_y, ref_y + 90):
        fade = 1.0 - (ry - ref_y) / 90.0
        draw.line([(ref_x1, ry), (ref_x2, ry)], fill=(65, 75, 90, int(45 * fade)))

    # Apply subtle realistic lens dispersion / bloom
    img = img.filter(ImageFilter.SMOOTH_MORE)
    img_path = os.path.join(OUTPUT_DIR, "room_executive_pov.webp")
    img.save(img_path, "WEBP", quality=92)
    print(f"[OK] Generated ArchViz Plate: {img_path} ({WIDTH}x{HEIGHT})")
    return img

def create_photoreal_depth_map():
    """
    Generates a calibrated 8-bit normalized Z-depth map.
    255 = extreme foreground (table near camera), 0 = infinite background (Tokyo skyline).
    """
    depth = Image.new("L", (WIDTH, HEIGHT), 0)
    draw = ImageDraw.Draw(depth)

    # 1. Sky outside window: Depth = 0 (farthest)
    win_left = int(WIDTH * 0.52)
    win_right = int(WIDTH * 0.96)
    win_top = int(HEIGHT * 0.08)
    win_bottom = int(HEIGHT * 0.62)
    draw.rectangle([win_left, win_top, win_right, win_bottom], fill=15)

    # Distant buildings: Depth = 30-45
    skyscrapers = [
        (win_left + 40, win_top + 180, 110, 240, 35),
        (win_left + 180, win_top + 110, 140, 310, 40),
        (win_left + 350, win_top + 70, 160, 350, 48),
        (win_left + 540, win_top + 140, 120, 280, 38),
        (win_left + 690, win_top + 90, 150, 330, 42),
    ]
    for sx, sy, sw, sh, sdepth in skyscrapers:
        draw.rectangle([sx, sy, sx + sw, win_bottom], fill=sdepth)

    # 2. Back architectural wall & window mullions: Depth = 85
    draw.rectangle([0, 0, WIDTH, int(HEIGHT * 0.58)], fill=85)
    # Window cutout re-cleared
    draw.rectangle([win_left, win_top, win_right, win_bottom], fill=20)
    for sx, sy, sw, sh, sdepth in skyscrapers:
        draw.rectangle([sx, sy, sx + sw, win_bottom], fill=sdepth)

    # 3. Intermediary zone: Interviewer chair position: Depth = 130
    chair_cx = int(WIDTH * 0.5)
    chair_cy = int(HEIGHT * 0.48)
    draw.ellipse([chair_cx - 240, chair_cy - 180, chair_cx + 240, chair_cy + 180], fill=135)

    # 4. Foreground Conference Table: Smooth depth gradient from 165 to 255 (closest)
    table_y = int(HEIGHT * 0.58)
    for y in range(table_y, HEIGHT):
        ratio = (y - table_y) / (HEIGHT - table_y)
        # Power curve for realistic perspective depth
        val = int(165 + 90 * math.pow(ratio, 0.85))
        draw.line([(0, y), (WIDTH, y)], fill=min(255, val))

    # Smooth depth transitions to prevent stair-step parallax artifacts
    depth = depth.filter(ImageFilter.GaussianBlur(radius=6))
    depth_path = os.path.join(OUTPUT_DIR, "room_executive_depth.webp")
    depth.save(depth_path, "WEBP", quality=90)
    print(f"[OK] Generated ArchViz Depth Map: {depth_path} ({WIDTH}x{HEIGHT})")
    return depth

def create_interviewer_character():
    """Generates a professional, dignified Japanese corporate executive interviewer character plate."""
    char_w = 960
    char_h = 1080
    img = Image.new("RGBA", (char_w, char_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx = char_w // 2

    # Executive Ergonomic Chair Back (Black leather with brushed chrome framing)
    draw.rectangle([cx - 210, 260, cx + 210, 840], fill=(24, 26, 30, 255))
    draw.rectangle([cx - 220, 250, cx - 208, 850], fill=(160, 165, 172, 255))
    draw.rectangle([cx + 208, 250, cx + 220, 850], fill=(160, 165, 172, 255))
    draw.rectangle([cx - 210, 248, cx + 210, 260], fill=(160, 165, 172, 255))

    # Suit Jacket & Shoulders (Bespoke Japanese Wool Navy Suit)
    shoulder_y = 520
    # Left shoulder
    draw.polygon([
        (cx - 260, 880),
        (cx - 220, shoulder_y + 40),
        (cx - 90, shoulder_y),
        (cx, shoulder_y + 110),
        (cx, 880)
    ], fill=(26, 35, 50, 255))
    # Right shoulder
    draw.polygon([
        (cx + 260, 880),
        (cx + 220, shoulder_y + 40),
        (cx + 90, shoulder_y),
        (cx, shoulder_y + 110),
        (cx, 880)
    ], fill=(24, 32, 46, 255))

    # Crisp White Business Shirt (Spread Collar)
    draw.polygon([(cx - 70, shoulder_y + 10), (cx + 70, shoulder_y + 10), (cx + 45, shoulder_y + 180), (cx - 45, shoulder_y + 180)], fill=(248, 250, 252, 255))

    # Silk Tie (Formal Executive Deep Burgundy / Navy pattern)
    draw.polygon([(cx - 22, shoulder_y + 40), (cx + 22, shoulder_y + 40), (cx + 32, 850), (cx - 32, 850)], fill=(120, 28, 38, 255))
    # Tie knot
    draw.polygon([(cx - 24, shoulder_y + 32), (cx + 24, shoulder_y + 32), (cx + 18, shoulder_y + 70), (cx - 18, shoulder_y + 70)], fill=(145, 34, 46, 255))

    # Suit Lapels
    draw.polygon([(cx - 90, shoulder_y), (cx - 120, shoulder_y + 120), (cx - 30, shoulder_y + 240), (cx - 40, shoulder_y + 90)], fill=(32, 44, 62, 255))
    draw.polygon([(cx + 90, shoulder_y), (cx + 120, shoulder_y + 120), (cx + 30, shoulder_y + 240), (cx + 40, shoulder_y + 90)], fill=(30, 40, 58, 255))

    # Corporate Lapel Pin (Gold crest)
    draw.ellipse([cx - 105, shoulder_y + 110, cx - 93, shoulder_y + 122], fill=(215, 175, 75, 255))

    # Neck
    draw.rectangle([cx - 38, 410, cx + 38, shoulder_y + 20], fill=(232, 198, 172, 255))
    # Subtle neck shadow
    draw.rectangle([cx - 38, 450, cx + 38, shoulder_y + 20], fill=(210, 172, 145, 255))

    # Head & Jaw (Realistic executive masculine proportions)
    head_cy = 340
    draw.polygon([
        (cx - 72, head_cy - 70),
        (cx + 72, head_cy - 70),
        (cx + 68, head_cy + 30),
        (cx + 42, head_cy + 95),
        (cx - 42, head_cy + 95),
        (cx - 68, head_cy + 30),
    ], fill=(238, 204, 178, 255))

    # Ears
    draw.ellipse([cx - 82, head_cy - 10, cx - 68, head_cy + 35], fill=(225, 185, 160, 255))
    draw.ellipse([cx + 68, head_cy - 10, cx + 82, head_cy + 35], fill=(225, 185, 160, 255))

    # Hair (Impeccably groomed executive Japanese side-part hairstyle)
    hair_color = (25, 28, 32, 255)
    draw.polygon([
        (cx - 80, head_cy - 20),
        (cx - 82, head_cy - 90),
        (cx - 30, head_cy - 120),
        (cx + 40, head_cy - 122),
        (cx + 84, head_cy - 85),
        (cx + 80, head_cy - 10),
        (cx + 60, head_cy - 50),
        (cx - 60, head_cy - 45),
    ], fill=hair_color)

    # Eyes & Eyebrows (Focused, dignified, professional gaze)
    # Eyebrows
    draw.line([(cx - 52, head_cy - 16), (cx - 18, head_cy - 14)], fill=hair_color, width=4)
    draw.line([(cx + 18, head_cy - 14), (cx + 52, head_cy - 16)], fill=hair_color, width=4)
    # Eyes
    draw.ellipse([cx - 45, head_cy - 2, cx - 25, head_cy + 10], fill=(250, 250, 252, 255))
    draw.ellipse([cx - 38, head_cy - 1, cx - 28, head_cy + 9], fill=(32, 28, 24, 255))
    draw.ellipse([cx + 25, head_cy - 2, cx + 45, head_cy + 10], fill=(250, 250, 252, 255))
    draw.ellipse([cx + 28, head_cy - 1, cx + 38, head_cy + 9], fill=(32, 28, 24, 255))

    # Modern Titanium Wireframe Spectacles (Smart Japanese CTO)
    spec_color = (130, 138, 148, 255)
    draw.rectangle([cx - 52, head_cy - 8, cx - 18, head_cy + 14], outline=spec_color, width=2)
    draw.rectangle([cx + 18, head_cy - 8, cx + 52, head_cy + 14], outline=spec_color, width=2)
    draw.line([(cx - 18, head_cy + 2), (cx + 18, head_cy + 2)], fill=spec_color, width=2)

    # Nose & Mouth
    draw.line([(cx, head_cy + 10), (cx - 4, head_cy + 38), (cx + 6, head_cy + 40)], fill=(195, 155, 130, 255), width=2)
    # Closed calm mouth
    draw.line([(cx - 24, head_cy + 65), (cx + 24, head_cy + 65)], fill=(160, 95, 85, 255), width=3)

    # Executive Acrylic Desk Nameplate
    np_w = 260
    np_h = 55
    np_y = 800
    draw.rectangle([cx - np_w // 2, np_y, cx + np_w // 2, np_y + np_h], fill=(20, 25, 32, 240))
    draw.rectangle([cx - np_w // 2, np_y, cx + np_w // 2, np_y + np_h], outline=(180, 190, 205, 255), width=2)
    draw.text((cx - 85, np_y + 8), "面接官 / CTO", fill=(180, 195, 215, 255))
    draw.text((cx - 85, np_y + 28), "高橋 健一 (Takahashi Kenichi)", fill=(245, 248, 252, 255))

    char_path = os.path.join(OUTPUT_DIR, "interviewer_neutral.webp")
    img.save(char_path, "WEBP", quality=94)
    print(f"[OK] Generated Executive Interviewer Plate: {char_path}")

    # Speaking variation (subtle open mouth)
    img_speaking = img.copy()
    draw_spk = ImageDraw.Draw(img_speaking)
    draw_spk.ellipse([cx - 14, head_cy + 62, cx + 14, head_cy + 74], fill=(130, 50, 45, 255))
    spk_path = os.path.join(OUTPUT_DIR, "interviewer_speaking.webp")
    img_speaking.save(spk_path, "WEBP", quality=94)
    print(f"[OK] Generated Speaking Interviewer Plate: {spk_path}")

if __name__ == "__main__":
    create_photoreal_executive_room()
    create_photoreal_depth_map()
    create_interviewer_character()
    print("[SUCCESS] All ArchViz base assets generated successfully.")
