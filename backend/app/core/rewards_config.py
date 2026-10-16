"""Server-owned prices and identifiers for themes and backgrounds."""

SHOP_CATALOG = {
    "themes": [
        {"id": "classic", "name": "Cổ điển", "price": 0},
        {"id": "than-khe", "name": "Thần Khê", "price": 500},
        {"id": "sakura", "name": "Sakura", "price": 500},
    ],
    "backgrounds": [
        {"id": "fuji-reading", "name": "Đọc sách dưới núi Phú Sĩ", "image": "/themes/background1.webp", "price": 150},
        {"id": "hydrangea-garden", "name": "Vườn cẩm tú cầu", "image": "/themes/background2.webp", "price": 150},
        {"id": "zen-samurai", "name": "Vườn thiền Samurai", "image": "/themes/background3.webp", "price": 150},
        {"id": "bamboo-shrine", "name": "Đền giữa rừng trúc", "image": "/themes/background4.webp", "price": 150},
        {"id": "bamboo-night", "name": "Rừng trúc đêm", "image": "/themes/background5.webp", "price": 150},
        {"id": "sakura-shrine", "name": "Đền hoa anh đào", "image": "/themes/background6.webp", "price": 150},
        {"id": "bamboo-path", "name": "Lối đi rừng trúc", "image": "/themes/background7.webp", "price": 150},
        {"id": "bonsai-tea", "name": "Vườn bonsai và trà", "image": "/themes/background8.webp", "price": 150},
        {"id": "spring-koinobori", "name": "Cờ cá chép mùa xuân", "image": "/themes/background9.webp", "price": 150},
        {"id": "sakura-picnic", "name": "Dã ngoại dưới hoa anh đào", "image": "/themes/background10.webp", "price": 150},
        {"id": "cherry-torii", "name": "Cổng Torii mùa hoa", "image": "/themes/background11.webp", "price": 150},
        {"id": "calligraphy-cat", "name": "Mèo luyện thư pháp", "image": "/themes/background12.webp", "price": 150},
        {"id": "sakura-path", "name": "Đường hoa anh đào", "image": "/themes/background13.webp", "price": 150},
    ],
}

# Daily task defaults; prices and reward values remain server-owned.
DAILY_ITEM_COUNT = 10
DAILY_ITEM_DISTRIBUTION = {"grammar": 4, "kanji": 3, "vocab": 2, "flashcard": 1}
DAILY_BASE_POINTS = 20
POINTS_PER_CORRECT = 2
PERFECT_BONUS = 10
STREAK_BONUS_PER_DAY = 2
STREAK_BONUS_CAP_DAYS = 7
STREAK_MILESTONE_BONUSES = {7: 50, 30: 200, 100: 500}


def catalog_item(item_type: str, item_id: str):
    key = "themes" if item_type == "theme" else "backgrounds" if item_type == "background" else None
    if key is None:
        return None
    return next((item for item in SHOP_CATALOG[key] if item["id"] == item_id), None)
