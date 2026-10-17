"""Vietnamese-guided role-play scenarios for spoken Japanese practice."""

SCENARIOS = {
    "restaurant": {"name": "Gọi món", "description": "Gọi món và hỏi về thực đơn.", "opening": "いらっしゃいませ。ご注文はお決まりですか？"},
    "directions": {"name": "Hỏi đường", "description": "Hỏi đường đến một địa điểm.", "opening": "こんにちは。どちらへ行きたいですか？"},
    "interview": {"name": "Phỏng vấn xin việc", "description": "Luyện trả lời phỏng vấn cơ bản.", "opening": "本日はよろしくお願いします。まず、自己紹介をお願いします。"},
    "shopping": {"name": "Mua sắm", "description": "Tìm món đồ, hỏi giá và thanh toán.", "opening": "いらっしゃいませ。何をお探しですか？"},
    "airport": {"name": "Ở sân bay", "description": "Làm thủ tục và hỏi thông tin chuyến bay.", "opening": "こんにちは。チェックインですか？パスポートをお願いします。"},
    "free": {"name": "Hội thoại tự do", "description": "Trò chuyện tự nhiên về chủ đề bạn chọn.", "opening": "こんにちは！今日は何について話しましょうか？"},
}

LEVEL_GUIDANCE = {
    "N5": "Dùng câu ngắn, từ vựng cơ bản và mẫu ngữ pháp N5. Nói chậm, mỗi lượt một ý.",
    "N4": "Dùng ngữ pháp và từ vựng N4, câu đơn giản, giải thích lại bằng cách dễ hiểu khi cần.",
    "N3": "Dùng hội thoại tự nhiên ở mức N3, kết hợp câu ghép vừa phải và từ vựng thông dụng.",
}


def build_system_prompt(scenario_id: str, jlpt_level: str) -> str:
    scenario = SCENARIOS[scenario_id]
    guidance = LEVEL_GUIDANCE[jlpt_level]
    return (
        "Bạn là người Nhật đang cùng người học Việt Nam luyện hội thoại nhập vai. "
        "Chỉ trả lời bằng tiếng Nhật tự nhiên, không viết romaji hoặc bản dịch trừ khi người học yêu cầu. "
        f"Kịch bản: {scenario['name']}. {scenario['description']} "
        f"Cấp độ người học: {jlpt_level}. {guidance} "
        "Giữ vai, trả lời ngắn gọn (1-3 câu), đặt tối đa một câu hỏi tiếp nối mỗi lượt. "
        "Không sửa lỗi trực tiếp trong cuộc hội thoại; phần phản hồi sẽ được tạo riêng."
    )


def build_recent_context(rows, max_turns: int = 6) -> str:
    selected = list(rows)[-max_turns:]
    return "\n".join(f"Người học: {r.question}\nBạn: {r.answer}" for r in selected)
