"""Small reviewed references and relevance filtering for chat generation."""
import re
from .chat_language import is_translation_question

MIN_CHAT_RELEVANCE = 0.72

PARTICLE_COMPARISON = """**は (wa): đánh dấu chủ đề**
は cho biết câu đang nói về ai hoặc điều gì; cũng có thể dùng để đối chiếu.

私は学生です。→ Tôi là sinh viên.
Nói về “tôi”, thông tin muốn truyền đạt là “sinh viên”.

**が (ga): đánh dấu chủ ngữ**
が thường giới thiệu thông tin mới hoặc xác định ai/cái gì được nhắc đến.

誰が学生ですか。→ Ai là sinh viên?
私が学生です。→ Tôi là sinh viên. (Xác định “tôi” là người được hỏi.)
猫がいます。→ Có một con mèo. (Giới thiệu con mèo.)

**Cách phân biệt**
- は đặt chủ đề: “Nói về X thì…”.
- が xác định chủ ngữ: “Ai/cái gì…?”.
- Việc chọn は hay が phụ thuộc ngữ cảnh; không thể thay thế tùy ý.
- Tân ngữ trực tiếp của động từ thường đi với を: 本を読みます。→ Tôi đọc sách.
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
    if "は" in question and "が" in question and re.search(
        r"khác|phân biệt|so sánh|difference|compare|違い|使い分け", question, re.IGNORECASE
    ):
        return (
            "Reviewed reference:\n" + (PARTICLE_COMPARISON_EN if language == 'en' else PARTICLE_COMPARISON),
            [{"title": "Tae Kim — は and が" if language == 'en' else "Tae Kim — Trợ từ は và が", "url": "https://guidetojapanese.org/particles.html",
              "type": "grammar_reference", "relevance": 1.0}],
        )
    if '今日は何をしましたか' in question and is_translation_question(question):
        answer = ('**Translation:** What did you do today?\n\n今日は: today (topic); 何を: what (object); しました: did (polite past); か: question marker.'
                  if language == 'en' else '**Bản dịch:** Hôm nay bạn đã làm gì?\n\n今日は: hôm nay (chủ đề); 何を: cái gì (tân ngữ); しました: đã làm (quá khứ lịch sự); か: trợ từ nghi vấn.')
        return answer, [{"title": "Reviewed sentence translation" if language == 'en' else "Bản dịch câu đã đối chiếu", "type": "reviewed_translation", "relevance": 1.0}]
    return "", []


def relevant_chat_documents(results: list[dict], question: str = '') -> list[dict]:
    candidates = [result for result in results if result.get("similarity_score", 0) >= MIN_CHAT_RELEVANCE]
    if not question:
        return candidates
    # Meaning/translation requests don't need loosely similar Library pages.
    if is_translation_question(question):
        return []
    anchors = re.findall(r'[\u3040-\u30ff\u3400-\u9fff]+', question)
    if anchors:
        return [result for result in candidates if all(anchor in result.get('content', '') for anchor in anchors)]
    return candidates


def clean_chat_answer(answer: str, language: str = 'vi') -> str:
    lines = []
    for line in answer.splitlines():
        plain = line.strip().replace("**", "").strip("# ")
        if re.match(r"^(?:Intent|Output|Task|Classification)\s*[:：]", plain, re.IGNORECASE):
            continue
        if re.fullmatch(r"(?:Explanation|Therefore,? the answer is)\s*[:：]?", plain, re.IGNORECASE):
            line = "**Explanation:**" if language == 'en' else "**Giải thích:**"
        lines.append(line)
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def finalize_chat_answer(question: str, answer: str, language: str = 'vi') -> str:
    cleaned = clean_chat_answer(answer, language)
    reference, sources = reviewed_reference(question, language)
    if sources and sources[0]['type'] == 'reviewed_translation':
        # A model can translate the sentence correctly and still invent an
        # incorrect breakdown. Keep this entire reviewed explanation together.
        return reference
    if sources:
        if sources[0]['type'] != 'grammar_reference':
            return cleaned
        plain = cleaned.replace("**", "")
        has_topic = re.search(r"は[^\n]{0,80}" + ('topic' if language == 'en' else 'chủ đề'), plain, re.IGNORECASE)
        has_subject = re.search(r"が[^\n]{0,80}" + ('subject' if language == 'en' else 'chủ ngữ'), plain, re.IGNORECASE)
        wrong_object = re.search(r"が[^\n]{0,80}(?:đánh dấu|chỉ|là|marks|is)\s+(?:the\s+)?(?:tân ngữ|đối tượng của động từ|direct object)", plain, re.IGNORECASE)
        if not has_topic or not has_subject or wrong_object:
            # When the small model contradicts this reviewed reference, show the
            # reference explanation with its citation instead of its bad answer.
            return (PARTICLE_COMPARISON_EN if language == 'en' else PARTICLE_COMPARISON).strip()
    return cleaned
