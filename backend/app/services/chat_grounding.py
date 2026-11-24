"""Small reviewed references and relevance filtering for chat generation."""
import re
from .chat_language import is_translation_question, is_chitchat_query

MIN_CHAT_RELEVANCE = 0.68

PARTICLE_COMPARISON = """**Phân biệt trợ từ は (wa) và が (ga):**

1. **は (wa): đánh dấu chủ đề của câu ("Nói về X thì...")**
- Giới thiệu điều mà người nói muốn truyền đạt, thông tin quan trọng nằm ở vị ngữ phía sau.
- Dùng để nhấn mạnh sự tương phản, đối chiếu.
- Ví dụ: 私は学生です。(Watashi wa gakusei desu.) → Tôi là sinh viên.

2. **が (ga): đánh dấu chủ ngữ hành động / giới thiệu thông tin mới**
- Xác định chính xác ai hoặc cái gì là chủ thể được nhắc đến ("Chính X là...").
- Dùng cho câu trả lời cho từ để hỏi (Dare, nani...).
- Dùng miêu tả hiện tượng tự nhiên hoặc sự tồn tại (いる / ある).
- Ví dụ:
  - 誰が学生ですか。(Dare ga gakusei desu ka?) → Ai là sinh viên?
  - 私が学生です。(Watashi ga gakusei desu.) → Chính tôi là sinh viên.
  - 猫がいます。(Neko ga imasu.) → Có một con mèo.
"""

PARTICLE_NI_DE = """**Phân biệt trợ từ に (ni) và で (de) chỉ nơi chốn / địa điểm:**

1. **で (de): Nơi diễn ra HÀNH ĐỘNG cụ thể**
- Dùng khi tại địa điểm đó có một hoạt động, hành vi, sự kiện được thực hiện (học, ăn, đọc sách, làm việc...).
- Ví dụ:
  - 図書館**で**本を読みます。(Toshokan de hon o yomimasu.) → Tôi đọc sách **tại** thư viện.
  - レストラン**で**ご飯を食べます。(Resutoran de gohan o tabemasu.) → Tôi ăn cơm **ở** nhà hàng.

2. **に (ni): Nơi TỒN TẠI hoặc ĐÍCH ĐẾN của di chuyển**
- Chỉ sự tồn tại của người hoặc vật (đi với động từ います, あります, 住みます - sinh sống).
  - 部屋**に**猫がいます。(Heya ni neko ga imasu.) → Có con mèo **trong** phòng.
  - 東京**に**住んでいます。(Toukyou ni sunde imasu.) → Tôi đang sống **ở** Tokyo.
- Chỉ đích đến, hướng đến của hành động di chuyển (đi với 行きます, 来ます, 帰ります).
  - 学校**に**行きます。(Gakkou ni ikimasu.) → Tôi đi **đến** trường.

**Mẹo nhớ nhanh:**
- Có **hành động làm gì đó** (ăn, chơi, làm việc...) → dùng **で**.
- Chỉ **ở/tồn tại** (います, あります) hoặc **đi tới đâu** (行きます) → dùng **に**.
"""

KARA_NODE_COMPARISON = """**Phân biệt から và ので:**
Cả hai nối lý do với kết quả. から thường nêu lý do trực tiếp; ので thường tạo sắc thái mềm và lịch sự hơn, kể cả khi nói lý do cá nhân.
Không nên coi đây là ranh giới tuyệt đối giữa “chủ quan” và “khách quan”; cần xét hoàn cảnh và cách nói.

**Ví dụ đối chiếu:**
- 雨が降っているから、家にいます。
  (あめがふっているから、いえにいます。) → Vì trời đang mưa nên tôi ở nhà.
- 雨が降っているので、家にいます。
  (あめがふっているので、いえにいます。) → Vì trời đang mưa nên tôi ở nhà; cách nêu lý do mềm hơn.
"""

PARTICLE_COMPARISON_EN = """**は (wa): marks the topic**
は introduces what the sentence is about and can also express contrast.
私は学生です。→ I am a student. Speaking about me, the information is that I am a student.

**が (ga): marks the subject**
が often introduces new information or identifies who or what is being discussed.
誰が学生ですか。→ Who is a student?
私が学生です。→ I am the one who is a student.
猫がいます。→ There is a cat.

The choice depends on context; は and が are not freely interchangeable.
The direct object of a verb is usually marked with を: 本を読みます。→ I read a book.
"""


def reviewed_reference(question: str, language: str = 'vi') -> tuple[str, list[dict]]:
    q_lower = question.lower()
    
    # 1. Trợ từ wa và ga
    if ("は" in question and "が" in question) or ("wa" in q_lower and "ga" in q_lower and ("trợ từ" in q_lower or "particle" in q_lower or "phân biệt" in q_lower or "khác" in q_lower)):
        if re.search(r"khác|phân biệt|so sánh|difference|compare|違い|使い分け", question, re.IGNORECASE):
            return (
                "Reviewed reference:\n" + (PARTICLE_COMPARISON_EN if language == 'en' else PARTICLE_COMPARISON),
                [{"title": "Trợ từ は (wa) và が (ga)", "url": "https://guidetojapanese.org/particles.html",
                  "type": "grammar_reference", "relevance": 1.0}],
            )

    # 2. Trợ từ ni và de
    if (("に" in question and "で" in question) or ("ni" in q_lower and "de" in q_lower and ("trợ từ" in q_lower or "particle" in q_lower or "địa điểm" in q_lower))) and re.search(r"khác|phân biệt|so sánh|difference|compare|khi nào", question, re.IGNORECASE):
        return (
            "Reviewed reference:\n" + (PARTICLE_NI_DE if language=='vi' else
                '**に vs で:** に marks a location of existence or a destination; で marks where an action takes place.\n\nExample: 部屋に猫がいます。(へやにねこがいます。) → There is a cat in the room.\n図書館で勉強します。(としょかんでべんきょうします。) → I study at the library.'),
            [{"title": "Trợ từ に (ni) và で (de) chỉ địa điểm", "url":"https://a1.marugotoweb.jp/ja/grammar_topic5_10.php", "type": "grammar_reference", "relevance": 1.0}]
        )

    # 3. Phân biệt kara và node
    if (("から" in question and "ので" in question) or ("kara" in q_lower and "node" in q_lower)) and re.search(r"khác|phân biệt|so sánh|difference|compare|khi nào", question, re.IGNORECASE):
        return (
            "Reviewed reference:\n" + (KARA_NODE_COMPARISON if language=='vi' else
                '**から vs ので:** Both give a reason. ので is often softer and more polite, including personal reasons; the difference is contextual, not an absolute subjective/objective division.\n\nExample: 雨が降っているので、家にいます。(あめがふっているので、いえにいます。) → I am staying home because it is raining.'),
            [{"title": "Phân biệt 〜から và 〜ので", "url":"https://www.irodori.jpf.go.jp/assets/data/Grammar_all.pdf", "type": "grammar_reference", "relevance": 1.0}]
        )

    if '今日は何をしましたか' in question and is_translation_question(question):
        answer = ('**Translation:** What did you do today?\n\n今日は: today (topic); 何を: what (object); しました: did (polite past); か: question marker.'
                  if language == 'en' else '**Bản dịch:** Hôm nay bạn đã làm gì?\n\n- 今日は: hôm nay (chủ đề)\n- 何を: cái gì (tân ngữ)\n- しました: đã làm (quá khứ lịch sự)\n- か: trợ từ nghi vấn.')
        return answer, [{"title": "Bản dịch câu đã đối chiếu", "type": "reviewed_translation", "relevance": 1.0}]

    return "", []


GENERIC_QUERY_STOPWORDS = {
    'ngữ', 'pháp', 'ngu', 'phap', 'ngữ pháp', 'cấu trúc', 'cau truc', 'mẫu câu', 'mau cau',
    'cách dùng', 'cach dung', 'dùng', 'dung', 'thế nào', 'the nao', 'nghĩa là gì', 'la gi',
    'ý nghĩa', 'y nghia', 'ví dụ', 'vi du', 'cho', 'hỏi', 'về', 'trong', 'tiếng nhật', 'tieng nhat',
    'tiếng', 'nhật', 'nhat', 'hoc', 'học', 'n5', 'n4', 'n3', 'n2', 'n1', 'jlpt', 'của', 'và',
    'các', 'là', 'có', 'được', 'gì', 'nào', 'sao', 'thế', 'thì', 'như', 'nhu', 'với', 'bạn', 'tôi',
    'sentence', 'grammar', 'meaning', 'example', 'usage', 'japanese'
}


def relevant_chat_documents(results: list[dict], question: str = '') -> list[dict]:
    if not results:
        return []
    if not question.strip():
        return [row for row in results if row.get('similarity_score',0)>=MIN_CHAT_RELEVANCE][:3]

    # Don't inject library documents for chitchat or short translation queries
    if is_chitchat_query(question):
        return []
    if is_translation_question(question):
        return []

    candidates = [result for result in results if result.get("similarity_score", 0) >= MIN_CHAT_RELEVANCE]
    if not candidates:
        return []

    # 1. Japanese anchor check: if question has Japanese words (>= 2 chars), document MUST contain them
    anchors = re.findall(r'[\u3040-\u30ff\u3400-\u9fff]+', question)
    if anchors:
        matched = [
            result for result in candidates
            if all(anchor in result.get('content', '') or anchor in result.get('source', {}).get('title', '') for anchor in anchors)
        ]
        return matched[:3]

    # 2. Extract specific domain terms (filter out generic stopwords like "ngữ pháp", "cách dùng", "n4")
    specific_terms = [
        w for w in re.findall(r'[a-zA-ZÀ-ỹ0-9_-]+', question.lower())
        if len(w) >= 2 and w not in GENERIC_QUERY_STOPWORDS
    ]

    if specific_terms:
        matched = []
        for r in candidates:
            title_lower = r.get('source', {}).get('title', '').lower()
            content_snippet = r.get('content', '')[:400].lower()
            combined = f"{title_lower} {content_snippet}"
            matched_terms = [t for t in specific_terms if t in combined]
            if len(specific_terms) >= 2 and len(matched_terms) == len(specific_terms):
                matched.append(r)
            elif len(specific_terms) == 1 and matched_terms:
                matched.append(r)
        if matched:
            return matched[:3]

    # A high embedding score alone is insufficient evidence of relevance.
    return []


CHINESE_GRAMMAR_TERMS = {
    '动词': 'Động từ',
    '連体形': 'thể liên kết/thông thường',
    '连体形': 'thể liên kết/thông thường',
    '形容词': 'Tính từ',
    '名词': 'Danh từ',
    '助词': 'Trợ từ',
    '副词': 'Phó từ',
    '句型': 'Mẫu câu',
    '例句': 'Ví dụ',
}


def clean_chat_answer(answer: str, language: str = 'vi') -> str:
    lines = []
    for line in answer.splitlines():
        plain = line.strip().replace("**", "").strip("# ")
        if re.match(r"^(?:Intent|Output|Task|Classification)\s*[:：]", plain, re.IGNORECASE):
            continue
        if re.fullmatch(r"(?:Explanation|Therefore,? the answer is)\s*[:：]?", plain, re.IGNORECASE):
            line = "**Explanation:**" if language == 'en' else "**Giải thích:**"
        lines.append(line)
    text = re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()
    if language == 'vi':
        for cn, vi in CHINESE_GRAMMAR_TERMS.items():
            text = text.replace(cn, vi)
    return text


def finalize_chat_answer(question: str, answer: str, language: str = 'vi') -> str:
    cleaned = clean_chat_answer(answer, language)
    reference, sources = reviewed_reference(question, language)
    if sources and sources[0].get('type') in ('reviewed_translation', 'grammar_reference'):
        ref_text = reference.replace("Reviewed reference:\n", "").strip()
        # Preserve a correct explanation; repair known factual inversions rather than
        # replacing every answer (which concealed generation failures and follow-ups).
        particle_pair = ('は' in question and 'が' in question)
        correct_pair = (all(term in cleaned.lower() for term in ('topic','subject')) if language=='en' else
                        all(term in cleaned.lower() for term in ('chủ đề','chủ ngữ')))
        wrong_pair = bool(re.search(r'が\s*(?:là|marks? the)\s*(?:tân ngữ|object)|は\s*(?:chỉ|là)\s*chủ ngữ',cleaned,re.I))
        if particle_pair and correct_pair and not wrong_pair:
            return cleaned
        if ref_text and (particle_pair or sources[0].get('type')=='reviewed_translation' or not cleaned):
            return ref_text
        if ref_text and sources[0].get('type')=='grammar_reference':
            needed=('tồn tại','hành động') if 'に' in question and 'で' in question else ('lý do','lịch sự')
            if language=='en':needed=('existence','action') if 'に' in question and 'で' in question else ('reason','polite')
            if not all(term in cleaned.lower() for term in needed):return ref_text
    return cleaned
