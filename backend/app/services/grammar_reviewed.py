"""Reviewed N5 clause templates. Unknown structures continue to the model."""
import re
from .grammar_grounded import grounded_patterns


CATEGORIES = {
    '日本料理': ('món ăn Nhật', 'Japanese dish'), '料理': ('món ăn', 'dish'),
    '食べ物': ('đồ ăn', 'food'), '飲み物': ('đồ uống', 'drink'),
    '色': ('màu sắc', 'color'), 'スポーツ': ('môn thể thao', 'sport'),
    '映画': ('bộ phim', 'movie'), '本': ('cuốn sách', 'book'),
    '音楽': ('loại nhạc', 'music'), '季節': ('mùa', 'season'),
}
TOPICS = {
    'この漢字': ('chữ Kanji này', 'this kanji'), 'その漢字': ('chữ Kanji đó', 'that kanji'),
    'あの漢字': ('chữ Kanji kia', 'that kanji'), 'この言葉': ('từ này', 'this word'),
    'この文法': ('ngữ pháp này', 'this grammar'), '日本語': ('tiếng Nhật', 'Japanese'),
}
ADJECTIVES = {'難しい': ('khó', 'difficult'), '複雑': ('phức tạp', 'complicated')}
CONDITIONALS = {
    '書けば': ('viết', 'write'), '読めば': ('đọc', 'read'), '聞けば': ('nghe', 'listen'),
    '練習すれば': ('luyện tập', 'practice'), '勉強すれば': ('học', 'study'),
}
ABILITIES = {
    '覚えられる': ('có thể nhớ được', 'can remember it'), '読める': ('có thể đọc được', 'can read it'),
    '話せる': ('có thể nói được', 'can speak it'), 'できる': ('có thể làm được', 'can do it'),
}
FREQUENCIES = {'何度も': ('nhiều lần', 'repeatedly'), '毎日': ('mỗi ngày', 'every day'),
               '繰り返し': ('lặp đi lặp lại', 'repeatedly')}


def _reviewed_composition(text: str, language: str) -> dict | None:
    """Compose only complete, covered clauses. Uncovered words or structures
    return None rather than borrowing the meaning of a similar example.
    """
    normalized = re.sub(r'\s+', '', text)
    index = 1 if language == 'en' else 0
    question = re.fullmatch(r'好きな(' + '|'.join(CATEGORIES) + r')は何ですか[。？?]?', normalized)
    if question:
        noun = question[1]
        meaning = (f'What is your favorite {CATEGORIES[noun][1]}?' if index else
                   f'{CATEGORIES[noun][0][0].upper() + CATEGORIES[noun][0][1:]} bạn yêu thích là gì?')
        vocab = [('好きな', 'yêu thích', 'favorite'), (noun, *CATEGORIES[noun]), ('何', 'gì', 'what')]
        level = 'N5'
    else:
        match = re.fullmatch('(' + '|'.join(TOPICS) + r')は(' + '|'.join(ADJECTIVES) +
            r')ですが[、,]?(' + '|'.join(FREQUENCIES) + r')?(' + '|'.join(CONDITIONALS) +
            r')(' + '|'.join(ABILITIES) + r')(と思います|と思っています|と思う)?[。.]?', normalized)
        if not match:
            return None
        topic, adjective, frequency, conditional, ability, thought = match.groups()
        if index:
            condition = CONDITIONALS[conditional][1]
            if conditional in {'書けば', '読めば', '聞けば'}:
                condition += ' to it' if conditional == '聞けば' else ' it'
            meaning = (('I think that although ' if thought else 'Although ') + TOPICS[topic][1] +
                ' is ' + ADJECTIVES[adjective][1] + ', if you ' + condition +
                (' ' + FREQUENCIES[frequency][1] if frequency else '') + ', you ' + ABILITIES[ability][1] + '.')
        else:
            meaning = (('Tôi nghĩ rằng tuy ' if thought else 'Tuy ') + TOPICS[topic][0] +
                ' ' + ADJECTIVES[adjective][0] + ', nhưng nếu ' + CONDITIONALS[conditional][0] +
                (' ' + FREQUENCIES[frequency][0] if frequency else '') + ' thì ' + ABILITIES[ability][0] + '.')
        vocab = [(topic, *TOPICS[topic]), (adjective, *ADJECTIVES[adjective]),
                 (conditional, 'nếu ' + CONDITIONALS[conditional][0], 'if you ' + CONDITIONALS[conditional][1]),
                 (ability, *ABILITIES[ability])]
        if frequency:
            vocab.insert(2, (frequency, *FREQUENCIES[frequency]))
        if thought:
            vocab.append((thought, 'tôi nghĩ rằng', 'I think that'))
        level = 'N4'
    points = grounded_patterns(text, language)
    if not question and ability == '覚えられる':
        for point in points:
            if 'られる' in point['pattern']:
                point['pattern'] = 'Vられる (potential form)' if index else 'Vられる（thể khả năng）'
                point['explanation'] = ('覚える is an ichidan verb; replacing る with られる gives 覚えられる. In this conditional clause it expresses ability: can remember, rather than a passive action.' if index else
                    '覚える (nhớ, ghi nhớ) là động từ nhóm 2: bỏ る, thêm られる → 覚えられる. Trong ngữ cảnh điều kiện của câu này, đây là thể khả năng: có thể nhớ được.')
    return {'sentence_meaning': meaning,
        'vocabulary': [{'term': term, 'meaning': en if index else vi, 'jlpt_level': level} for term, vi, en in vocab],
        'grammar_patterns': points, 'grammar_points': points, 'jlpt_level': level,
        'difficulty_score': 2.5 if level == 'N5' else 4.0, 'translation': None,
        'suggestions': ['Practice the identified structures with different nouns and verbs.'] if index else
                       ['Tập đặt câu với các cấu trúc trên bằng cách thay danh từ và động từ.']}

SUBJECTS = {'私': ('Tôi', 'I'), '彼': ('Anh ấy', 'He'), '彼女': ('Cô ấy', 'She'), '田中さん': ('Bạn Tanaka', 'Tanaka')}
TIMES = {'毎日': ('mỗi ngày', 'every day'), '毎朝': ('mỗi sáng', 'every morning'), '毎晩': ('mỗi tối', 'every evening'),
         '今日': ('hôm nay', 'today'), '明日': ('ngày mai', 'tomorrow'), '昨日': ('hôm qua', 'yesterday')}
NOUNS = {'学校': ('trường học', 'school'), '会社': ('công ty', 'the office'), '図書館': ('thư viện', 'the library'),
         '家': ('nhà', 'home'), '公園': ('công viên', 'the park'), '本': ('sách', 'a book'), '新聞': ('báo', 'a newspaper'),
         '日本語': ('tiếng Nhật', 'Japanese'), '英語': ('tiếng Anh', 'English'), 'ご飯': ('cơm', 'rice'), '水': ('nước', 'water'),
         'お茶': ('trà', 'tea'), '映画': ('phim', 'a movie')}
# Vietnamese, English base, English third person, English past.
VERBS = {'行き': ('đi đến', 'go to', 'goes to', 'went to'), '来': ('đến', 'come to', 'comes to', 'came to'),
         '帰り': ('trở về', 'return to', 'returns to', 'returned to'), '読み': ('đọc', 'read', 'reads', 'read'),
         '飲み': ('uống', 'drink', 'drinks', 'drank'), '食べ': ('ăn', 'eat', 'eats', 'ate'),
         '勉強し': ('học', 'study', 'studies', 'studied'), '見': ('xem', 'watch', 'watches', 'watched')}


def reviewed_simple_sentence(text: str, language: str) -> dict | None:
    composed = _reviewed_composition(text, language)
    if composed is not None:
        return composed
    normalized = re.sub(r'\s+', '', text)
    match = re.fullmatch(r'(?:(私|彼|彼女|田中さん)は)?(毎日|毎朝|毎晩|今日|明日|昨日)?'
                         r'(学校|会社|図書館|家|公園|本|新聞|日本語|英語|ご飯|水|お茶|映画)'
                         r'(へ|に|を)(行き|来|帰り|読み|飲み|食べ|勉強し|見)'
                         r'(ます|ました|ません|ませんでした|たいです|たくないです|たかったです|たいと思っています)[。.]?', normalized)
    if not match:
        return None
    subject, time, noun, particle, stem, ending = match.groups()
    movement = stem in {'行き', '来', '帰り'}
    if movement != (particle in {'へ', 'に'}):
        return None
    desire = ending in {'たいです', 'たくないです', 'たかったです', 'たいと思っています'}
    negative = ending in {'ません', 'ませんでした', 'たくないです'}
    past = ending in {'ました', 'ませんでした', 'たかったです'}
    if (time == '昨日' and not past) or (time == '明日' and past):
        return None
    en = language == 'en'
    index = 1 if en else 0
    who, what = SUBJECTS[subject or '私'][index], NOUNS[noun][index]
    time_words = TIMES[time][index] if time else ''
    if en:
        base = VERBS[stem][1]
        first_person = not subject or subject == '私'
        if desire:
            action = ('did not want to' if past and negative else 'wanted to' if past else
                      'do not want to' if negative and first_person else 'does not want to' if negative else
                      'want to' if first_person else 'wants to') + ' ' + base
        elif negative:
            action = ('did not' if past else 'do not' if first_person else 'does not') + ' ' + base
        else:
            action = VERBS[stem][3 if past else 1 if first_person else 2]
        if noun == '家' and movement:
            action = action.removesuffix(' to')
        meaning = ' '.join(part for part in (who, action, what, time_words) if part) + '.'
    else:
        meaning = ' '.join(part for part in (who, 'đã' if past else '', 'không' if negative else '',
            'muốn' if desire else '', VERBS[stem][0], what, time_words) if part) + '.'
    vocab = [{'term': subject, 'meaning': who, 'jlpt_level': 'N5'}] if subject else []
    if time:
        vocab.append({'term': time, 'meaning': time_words, 'jlpt_level': 'N5'})
    vocab += [{'term': noun, 'meaning': what, 'jlpt_level': 'N5'},
              {'term': stem + ending, 'meaning': action if en else ' '.join(part for part in
               ('đã' if past else '', 'không' if negative else '', 'muốn' if desire else '', VERBS[stem][0]) if part), 'jlpt_level': 'N5'}]
    pattern_form = 'Vたい' if desire else 'Vませんでした' if past and negative else 'Vません' if negative else 'Vました' if past else 'Vます'
    explanation = (
        ('The verb stem plus たい expresses desire; たくない is negative and たかった is past.' if en else
         'Động từ bỏ ます + たい diễn tả mong muốn làm một việc; たくない là không muốn, たかった là đã muốn.') if desire else
        ('Polite negative past form: did not do.' if en else 'Dạng phủ định quá khứ lịch sự: đã không làm.') if negative and past else
        ('Polite negative non-past verb form.' if en else 'Dạng phủ định lịch sự chưa chia quá khứ: không làm.') if negative else
        ('Polite past form of the verb.' if past else 'Polite non-past form: present, habitual or future according to context.') if en else
        ('Dạng quá khứ lịch sự của động từ.' if past else 'Dạng lịch sự chưa chia quá khứ; diễn tả hiện tại, thói quen hoặc tương lai tùy ngữ cảnh.'))
    points = [
        {'pattern': 'は', 'explanation': 'Marks the topic of the sentence.' if en else 'Đánh dấu chủ đề đang được nói tới trong câu.', 'example': text},
        {'pattern': particle, 'explanation': ('Marks the destination of movement.' if movement else 'Marks the direct object of the action.') if en else ('Chỉ hướng hoặc đích đến của hành động di chuyển.' if movement else 'Đánh dấu tân ngữ trực tiếp của hành động.'), 'example': text},
        {'pattern': pattern_form, 'explanation': explanation, 'example': text},
    ]
    if subject is None:
        points = points[1:]
    if ending == 'たいと思っています':
        points.append({'pattern': '～と思っている', 'explanation': 'Expresses a continuing thought or intention.' if en else
            'Diễn tả suy nghĩ hoặc ý định đang được duy trì; ở đây là ý định muốn làm một việc.', 'example': text})
    level = 'N4' if ending == 'たいと思っています' else 'N5'
    return {'sentence_meaning': meaning, 'vocabulary': vocab, 'grammar_patterns': points, 'grammar_points': points,
            'jlpt_level': level, 'difficulty_score': 4.0 if level == 'N4' else 2.5, 'translation': None,
            'suggestions': [f'Practice the particle {particle} with the verb form {pattern_form}.'] if en else [f'Tập đặt câu với trợ từ {particle} và dạng động từ {pattern_form}.']}
