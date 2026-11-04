"""Conservative surface rules used to ground model output and partial analyses.

These identify forms, not a full parse or a verified sentence translation.
Only matched input is used as evidence; longer forms take precedence.
"""
import re


# regex, display form, level, Vietnamese explanation, English explanation
RULES = [
    (r'好きな', '好きな＋N', 'N5', '好き là tính từ đuôi な, khi bổ nghĩa trực tiếp cho danh từ thì dùng 好きな＋danh từ: món hoặc thứ yêu thích.',
     '好き is a な-adjective; 好きな modifies the following noun to mean a favorite or liked thing.'),
    (r'は何ですか', 'Nは何ですか', 'N5', 'Mẫu hỏi một sự vật là gì: は đánh dấu chủ đề, 何 hỏi “gì”, です tạo cách nói lịch sự và か đánh dấu câu hỏi.',
     'Asks what something is: は marks the topic, 何 means what, です is polite and か marks a question.'),
    (r'です(?:が|けど)', '～ですが', 'N5', 'Nối hai vế có ý tương phản: tuy… nhưng…; ですが cũng có thể mở lời nhẹ nhàng tùy ngữ cảnh.',
     'Connects contrasting clauses, although or but; it can also soften an introduction depending on context.'),
    (r'(?:書け|読め|行け|聞け|話せ|飲め|買え|待て|使え|練習すれ|勉強すれ|すれ|見れ|食べれ)ば', 'Vば', 'N4',
     'Thể điều kiện ば của động từ: nếu làm hành động ở vế trước thì dẫn đến kết quả ở vế sau. Ví dụ 書く → 書けば.',
     'The conditional ば-form links a condition to its result: if the first action is done, the second clause follows. For example, 書く → 書けば.'),
    (r'(?:覚え|食べ|見|教え|考え|続け|受け|起き)られる', 'Vられる（khả năng／bị động）', 'N4',
     'Với động từ nhóm 2, thay る bằng られる có thể tạo thể khả năng; cùng hình thức này cũng có thể là bị động hoặc kính ngữ. Cần dựa vào ngữ cảnh: 覚えられる thường là “có thể nhớ”.',
     'For an ichidan verb, replacing る with られる can express ability, but the same form may be passive or honorific. Context determines the reading; 覚えられる commonly means can remember.'),
    (r'(?:話せる|読める|書ける|行ける|飲める|使える)', 'V（thể khả năng）', 'N4',
     'Thể khả năng của động từ nhóm 1: đổi âm cuối hàng う sang hàng え rồi thêm る. Ví dụ 読む → 読める, nghĩa là có thể đọc.',
     'The potential form of a godan verb changes the final u-row sound to the e-row and adds る. For example, 読む → 読める means can read.'),
    (r'(?:なければなりません|なければならない|なくてはいけません|なくてはいけない)', 'Vなければならない', 'N4',
     'Diễn tả nghĩa vụ: phải làm một việc. Dạng phủ định kết hợp với điều kiện tạo nghĩa bắt buộc.',
     'Expresses obligation: something must be done.'),
    (r'ことが(?:できます|できる|できません|できない|できました)', 'Vることができる', 'N4',
     'Động từ thể từ điển + ことができる diễn tả khả năng làm một việc. できない／できません là dạng phủ định.',
     'A dictionary-form verb followed by ことができる expresses ability; できない／できません is negative.'),
    (r'たことが(?:あります|ある|ありません|ない)', 'Vたことがある', 'N4',
     'Động từ thể た + ことがある diễn tả trải nghiệm đã từng làm một việc; dạng phủ định là chưa từng.',
     'A た-form verb followed by ことがある expresses past experience; the negative means never having done it.'),
    (r'(?:て|で)(?:はいけません|はいけない)', 'Vてはいけない', 'N4',
     'Thể て + はいけない diễn tả sự cấm đoán: không được làm một việc.',
     'The て-form followed by はいけない expresses prohibition: something must not be done.'),
    (r'(?:て|で)(?:もいいです|もいい)', 'Vてもいい', 'N5',
     'Thể て + もいい diễn tả sự cho phép: có thể hoặc được phép làm một việc.',
     'The て-form followed by もいい expresses permission.'),
    (r'(?:て|で)(?:ください)', 'Vてください', 'N5',
     'Thể て + ください dùng để yêu cầu hoặc đề nghị người nghe làm một việc.',
     'The て-form followed by ください makes a polite request.'),
    (r'と思(?:っています|いました|います|っている|う)', '～と思う', 'N4',
     'Mệnh đề + と + 思う diễn tả suy nghĩ hoặc ý kiến. 思っている nhấn mạnh suy nghĩ hay ý định đang được duy trì.',
     'A clause followed by と + 思う expresses a thought or opinion; 思っている can express a continuing thought or intention.'),
    (r'(?:て|で)(?:いませんでした|いません|いました|います|いない|いた|いる)', 'Vている', 'N5',
     'Thể て + いる diễn tả hành động đang diễn ra hoặc trạng thái còn tiếp diễn. Nghĩa cụ thể tùy động từ và ngữ cảnh.',
     'The て-form plus いる expresses an ongoing action or a resulting state, depending on the verb and context.'),
    (r'つもり(?:です|だ)', 'Vる／Vないつもり', 'N4',
     'Động từ thể từ điển hoặc thể ない + つもり diễn tả dự định làm hoặc không làm một việc.',
     'A dictionary-form or negative verb plus つもり expresses an intention to do or not do something.'),
    (r'ように(?:なりました|なります|なる)', '～ようになる', 'N4',
     'Diễn tả sự thay đổi để một hành động, khả năng hoặc trạng thái bắt đầu trở thành hiện thực.',
     'Expresses a change in which an action, ability or state comes about.'),
    (r'ませんでした', 'Vませんでした', 'N5', 'Dạng phủ định quá khứ lịch sự của động từ: đã không làm.', 'Polite negative past form of a verb: did not do.'),
    (r'ません', 'Vません', 'N5', 'Dạng phủ định lịch sự chưa chia quá khứ của động từ: không làm.', 'Polite negative non-past form of a verb: does not or will not do.'),
    (r'ました', 'Vました', 'N5', 'Dạng quá khứ lịch sự của động từ: đã làm.', 'Polite past form of a verb: did something.'),
    (r'ましょう', 'Vましょう', 'N5', 'Dạng rủ rê hoặc đề nghị cùng làm một việc.', 'Polite volitional form used to suggest doing something together.'),
    (r'ます', 'Vます', 'N5', 'Dạng lịch sự chưa chia quá khứ; diễn tả hiện tại, thói quen hoặc tương lai tùy ngữ cảnh.', 'Polite non-past verb form: present, habitual or future according to context.'),
    (r'(?:では|じゃ)(?:ありません|ないです|ない)', 'Nではない', 'N5', 'Dạng phủ định của câu danh từ: không phải là.', 'Negative nominal predicate: is not.'),
]


def grounded_patterns(text: str, language: str = 'vi') -> list[dict]:
    matches = []
    occupied: list[tuple[int, int]] = []
    for regex, pattern, level, vi, en in RULES:
        if language == 'en' and pattern == 'Vられる（khả năng／bị động）':
            pattern = 'Vられる (potential / passive)'
        if language == 'en' and pattern == 'V（thể khả năng）':
            pattern = 'V (potential form)'
        if pattern in {'Vます', 'Vました', 'Vません', 'Vませんでした', 'Vましょう'}:
            regex = r'(?<=[一-龯ぁ-ん])' + regex + r'(?=$|[。！？?!、,\s」』]|か|が|から|ので|けど|よ|ね)'
        for match in re.finditer(regex, text):
            if any(match.start() < end and match.end() > start for start, end in occupied):
                continue
            occupied.append(match.span())
            matches.append((match.start(), {'pattern': pattern, 'evidence': match.group(),
                'explanation': en if language == 'en' else vi, 'example': text, 'jlpt_level': level}))
            break
    # Desire is matched only with known verbal stems, avoiding adjectives such
    # as 眠たい. Other verb stems remain the model's responsibility.
    desire = re.search(r'(?:読み|書き|行き|来|帰り|食べ|飲み|見|買い|会い|話し|聞き|勉強し|し|なり|働き|休み|遊び|知り|作り)(たくない|たかった|たい)', text)
    if desire:
        matches.append((desire.start(), {'pattern': 'Vたい', 'evidence': desire.group(), 'jlpt_level': 'N5',
            'explanation': 'Động từ bỏ ます + たい diễn tả mong muốn làm một việc. たくない là không muốn; たかった là đã muốn.' if language == 'vi' else
                'The verb stem plus たい expresses a desire to do something; たくない means not wanting to, and たかった expresses a past desire.', 'example': text}))
    # Require a noun-like left context to avoid matching は in こんにちは,
    # が in がんばる, etc. More ambiguous particles are left to the model.
    for match in re.finditer(r'(?:[一-龯ァ-ヶー]+|わたし|あなた|これ|それ|あれ)(は|を|へ)', text):
        particle = match[1]
        if any(start <= match.end() - 1 < end for start, end in occupied):
            continue
        vi, en = {
            'は': ('Đánh dấu chủ đề đang được nói tới trong câu.', 'Marks the topic being discussed.'),
            'を': ('Đánh dấu tân ngữ với động từ tác động; cũng có thể chỉ nơi đi qua hoặc điểm rời đi với động từ di chuyển.', 'Marks an object, or a traversed place or departure point with movement verbs.'),
            'へ': ('Chỉ hướng đến của hành động di chuyển.', 'Marks the direction of movement.'),
        }[particle]
        if not any(point['pattern'] == particle for _, point in matches):
            matches.append((match.end() - 1, {'pattern': particle, 'evidence': particle, 'jlpt_level': 'N5',
                'explanation': en if language == 'en' else vi, 'example': text}))
    return [point for _, point in sorted(matches, key=lambda item: item[0])][:12]


def partial_analysis(text: str, language: str) -> dict | None:
    points = grounded_patterns(text, language)
    if not points:
        return None
    level = min((point['jlpt_level'] for point in points), key=lambda value: int(value[1]))
    note = ('Đã nhận diện các cấu trúc có trong câu. Chưa xác minh được bản dịch toàn câu bằng model hiện tại; cấp độ và độ khó chỉ là ước lượng theo các cấu trúc đã nhận diện.' if language == 'vi' else
            'The forms below were identified in your input. A full sentence translation could not be verified with the current model; level and difficulty are estimates based on the identified forms.')
    return {'sentence_meaning': None, 'translation': None, 'vocabulary': [],
        'grammar_patterns': points, 'grammar_points': points, 'jlpt_level': level,
        'difficulty_score': {'N5': 2.5, 'N4': 4.0, 'N3': 5.5, 'N2': 7.5, 'N1': 9.5}[level],
        'suggestions': ['Thử thay từ vựng và đặt câu với các cấu trúc vừa phân tích.'] if language == 'vi' else
            ['Practice the identified forms by changing the vocabulary and writing a new sentence.'],
        'analysis_status': 'partial', 'analysis_note': note}
