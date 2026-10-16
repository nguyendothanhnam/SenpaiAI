"""Idempotently seed common N5/N4 grammar patterns and one example per exercise type."""
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import func

from app.core.database import SessionLocal
from app.models.database import GrammarQuestion, GrammarRule


# These are starter examples; have a Japanese-language reviewer check them before public use.
PATTERNS = {
    "N5": [
        ("は (chủ đề)", "は", "Đánh dấu chủ đề câu; đọc là wa.", "わたし ____ 学生です。", ["は", "が", "を", "に"], "は", ["私", "は", "学生", "です。"], "私は学生です。", "Tôi là học sinh/sinh viên.", "私は学生です。", True, "行く", "thể lịch sự ます", "行く", "行きます", "Câu 私は学生です dùng は để nêu chủ đề 私.", "学生です"),
        ("が (chủ ngữ/đối tượng được mong muốn)", "が", "Đánh dấu chủ ngữ hoặc đối tượng trong một số cấu trúc như 好きです.", "ねこ ____ います。", ["が", "を", "へ", "で"], "が", ["ねこ", "が", "います", "。"], "ねこがいます。", "Có một con mèo.", "ねこがいます。", True, "行く", "thể ます", "行く", "行きます", "Trong ねこがいます, が đánh dấu thứ đang tồn tại.", "ねこがいます"),
        ("を (tân ngữ trực tiếp)", "を", "Đánh dấu tân ngữ trực tiếp của động từ; thường đọc là o.", "本 ____ 読みます。", ["を", "が", "に", "は"], "を", ["本", "を", "読みます", "。"], "本を読みます。", "Tôi đọc sách.", "本を読みます。", True, "読む", "thể ます", "読む", "読みます", "を đánh dấu 本 là tân ngữ của 読みます.", "本を読みます"),
        ("に (thời điểm/đích đến)", "に", "Có thể đánh dấu thời điểm cụ thể hoặc đích đến.", "七時 ____ 起きます。", ["に", "で", "を", "が"], "に", ["七時", "に", "起きます", "。"], "七時に起きます。", "Tôi thức dậy lúc 7 giờ.", "七時に起きます。", True, "食べる", "thể ます", "食べる", "食べます", "七時 là thời điểm cụ thể nên dùng に.", "七時に起きます"),
        ("で (địa điểm hành động)", "で", "Đánh dấu nơi diễn ra một hành động.", "図書館 ____ 勉強します。", ["で", "に", "を", "へ"], "で", ["図書館", "で", "勉強します", "。"], "図書館で勉強します。", "Tôi học ở thư viện.", "図書館で勉強します。", True, "書く", "thể ます", "書く", "書きます", "勉強する là hành động diễn ra tại 図書館 nên dùng で.", "図書館で勉強します"),
        ("の (sở hữu/bổ nghĩa danh từ)", "の", "Nối hai danh từ, thường biểu thị sở hữu hoặc quan hệ bổ nghĩa.", "これは私 ____ 本です。", ["の", "は", "が", "を"], "の", ["これ", "は", "私", "の", "本", "です。"], "これは私の本です。", "Đây là sách của tôi.", "これは私の本です。", True, "見る", "thể ます", "見る", "見ます", "の nối 私 và 本 để biểu thị sách thuộc về tôi.", "私の本です"),
        ("も (cũng)", "も", "も thay cho は/が/を trong nhiều câu để thêm nghĩa “cũng”.", "私 ____ 学生です。", ["も", "の", "を", "へ"], "も", ["私", "も", "学生", "です。"], "私も学生です。", "Tôi cũng là sinh viên.", "私も学生です。", True, "飲む", "thể ます", "飲む", "飲みます", "も thêm ý người nói cũng là sinh viên.", "私も学生です"),
        ("へ (hướng di chuyển)", "へ", "Đánh dấu hướng đi; thường đọc là e.", "学校 ____ 行きます。", ["へ", "で", "を", "が"], "へ", ["学校", "へ", "行きます", "。"], "学校へ行きます。", "Tôi đi đến trường.", "学校へ行きます。", True, "帰る", "thể ます", "帰る", "帰ります", "へ đứng sau địa điểm chỉ hướng đi.", "学校へ行きます"),
        ("です (câu danh từ lịch sự)", "です", "Đặt sau danh từ/tính từ-na để tạo câu lịch sự.", "田中さんは先生 ____。", ["です", "ます", "でした", "ません"], "です", ["田中さん", "は", "先生", "です。"], "田中さんは先生です。", "Anh/chị Tanaka là giáo viên.", "田中さんは先生です。", True, "帰る", "thể lịch sự ます", "帰る", "帰ります", "先生です là cách kết thúc lịch sự cho câu danh từ hiện tại.", "先生です"),
        ("ます (động từ lịch sự hiện tại/tương lai)", "ます", "Đuôi lịch sự dùng cho hành động hiện tại hoặc tương lai.", "毎日、日本語を勉強し ____。", ["ます", "です", "でした", "ませんでした"], "ます", ["毎日、", "日本語を", "勉強し", "ます。"], "毎日、日本語を勉強します。", "Tôi học tiếng Nhật mỗi ngày.", "毎日日本語を勉強します。", True, "食べる", "thể ます", "食べる", "食べます", "勉強します là dạng lịch sự khẳng định.", "日本語を勉強します"),
    ],
    "N4": [
        ("ている (đang/trạng thái tiếp diễn)", "ている", "Diễn tả hành động đang diễn ra hoặc trạng thái tiếp diễn.", "今、本を読ん ____。", ["でいます", "みます", "ました", "ません"], "でいます", ["今、", "本を", "読んで", "います。"], "今、本を読んでいます。", "Bây giờ tôi đang đọc sách.", "今、本を読んでいます。", True, "読む", "thể て + いる", "読む", "読んでいる", "読む chuyển thành 読んで rồi kết hợp います để diễn tả đang đọc.", "本を読んでいます"),
        ("てください (hãy làm)", "てください", "Dùng thể て + ください để yêu cầu lịch sự.", "ここに名前を書い ____。", ["てください", "てもいいです", "てはいけません", "たことがあります"], "てください", ["ここに", "名前を", "書いて", "ください。"], "ここに名前を書いてください。", "Xin hãy viết tên vào đây.", "ここに名前を書いてください。", True, "書く", "thể て", "書く", "書いて", "書く là động từ nhóm 1 có biến đổi く thành いて ở thể て.", "名前を書いてください"),
        ("てもいい (được phép)", "てもいい", "Thể て + もいいです dùng để xin/cho phép.", "ここで写真を撮っ ____。", ["てもいいです", "てはいけません", "てください", "たことがあります"], "てもいいです", ["ここで", "写真を", "撮って", "もいいです。"], "ここで写真を撮ってもいいです。", "Chụp ảnh ở đây cũng được.", "ここで写真を撮ってもいいです。", True, "食べる", "thể て", "食べる", "食べて", "食べて + もいいです hỏi hoặc cho phép làm việc gì.", "写真を撮ってもいいです"),
        ("てはいけない (cấm/không được)", "てはいけない", "Thể て + はいけません biểu thị điều không được phép.", "ここでタバコを吸っ ____。", ["てはいけません", "てもいいです", "てください", "ています"], "てはいけません", ["ここで", "タバコを", "吸って", "はいけません。"], "ここでタバコを吸ってはいけません。", "Không được hút thuốc ở đây.", "ここでタバコを吸ってはいけません。", True, "飲む", "thể て", "飲む", "飲んで", "吸ってはいけません diễn tả hành động bị cấm.", "タバコを吸ってはいけません"),
        ("ないでください (xin đừng)", "ないでください", "Dạng phủ định ない + でください dùng để yêu cầu đừng làm.", "ここで写真を撮ら ____。", ["ないでください", "てもいいです", "てください", "ています"], "ないでください", ["ここで", "写真を", "撮ら", "ないでください。"], "ここで写真を撮らないでください。", "Xin đừng chụp ảnh ở đây.", "ここで写真を撮らないでください。", True, "行く", "thể ない", "行く", "行かない", "行かないでください là lời nhờ lịch sự đừng đi.", "写真を撮らないでください"),
        ("たい (muốn làm)", "たい", "Gắn たい vào gốc ます để nói mong muốn của người nói.", "日本へ行き ____。", ["たいです", "たことがあります", "てください", "なければなりません"], "たいです", ["日本へ", "行き", "たい", "です。"], "日本へ行きたいです。", "Tôi muốn đi Nhật.", "日本へ行きたいです。", True, "行く", "thể たい", "行く", "行きたい", "行きます bỏ ます rồi thêm たい thành 行きたい.", "日本へ行きたいです"),
        ("ことがある (thỉnh thoảng có làm)", "ことがある", "Động từ thể từ điển + ことがあります diễn tả đôi khi có làm.", "週末に映画を見る ____。", ["ことがあります", "たことがあります", "てください", "てもいいです"], "ことがあります", ["週末に", "映画を", "見る", "ことがあります。"], "週末に映画を見ることがあります。", "Cuối tuần đôi khi tôi xem phim.", "週末に映画を見ることがあります。", True, "見る", "thể từ điển + ことがある", "見る", "見ることがあります", "見ることがあります nói về việc thỉnh thoảng xem phim.", "映画を見ることがあります"),
        ("たことがある (đã từng)", "たことがある", "Động từ thể た + ことがあります diễn tả kinh nghiệm đã từng.", "日本へ行っ ____。", ["たことがあります", "ことがあります", "てください", "たいです"], "たことがあります", ["日本へ", "行った", "ことが", "あります。"], "日本へ行ったことがあります。", "Tôi đã từng đến Nhật.", "日本へ行ったことがあります。", True, "行く", "thể た", "行く", "行った", "行ったことがあります diễn tả kinh nghiệm đã từng đi.", "日本へ行ったことがあります"),
        ("と思う (tôi nghĩ rằng)", "と思う", "Đặt sau mệnh đề thể thông thường để nêu suy nghĩ/ý kiến.", "明日は雨だ ____。", ["と思います", "と言います", "になります", "てあります"], "と思います", ["明日は", "雨だ", "と", "思います。"], "明日は雨だと思います。", "Tôi nghĩ ngày mai trời mưa.", "明日は雨だと思います。", True, "行く", "thể ない", "行く", "行かない", "行かないと思います có nghĩa tôi nghĩ là sẽ không đi.", "雨だと思います"),
        ("から (vì… nên…)", "から", "Đặt sau mệnh đề nêu lý do, trước kết quả.", "忙しい ____、今日は行きません。", ["から", "まで", "だけ", "しか"], "から", ["忙しい", "から、", "今日", "は行きません。"], "忙しいから、今日は行きません。", "Vì bận nên hôm nay tôi không đi.", "忙しいから今日は行きません。", True, "帰る", "thể ない", "帰る", "帰らない", "帰らないから không về nên…; から nối nguyên nhân với kết quả.", "忙しいから行きません"),
    ],
}


def seed(db=None) -> dict:
    own_session = db is None
    db = db or SessionLocal()
    added_rules = added_questions = 0
    try:
        for level, patterns in PATTERNS.items():
            for row in patterns:
                (name, pattern, meaning, fill_prompt, options, fill_answer, tokens,
                 sentence, translation, statement, truth, base, target, conj_base,
                 conj_answer, explanation, example_vi) = row
                rule = db.query(GrammarRule).filter(GrammarRule.jlpt_level == level, GrammarRule.rule_name == name).first()
                if not rule:
                    rule = GrammarRule(rule_name=name, japanese_pattern=pattern, meaning=meaning,
                                       usage_notes=meaning, examples=[{"ja": sentence, "vi": translation}],
                                       jlpt_level=level, difficulty_score=2.0 if level == "N5" else 4.0)
                    db.add(rule)
                    db.flush()
                    added_rules += 1
                examples = [{"ja": sentence, "vi": translation}]
                records = [
                    ("fill_blank", fill_prompt, {"options": options}, fill_answer),
                    ("reorder", f"Sắp xếp token để tạo câu: {translation}", {"tokens": tokens}, sentence),
                    ("true_false", f"Nhận định sau đây {'đúng' if truth else 'sai'} về mẫu {name}: {statement}", {"statement": statement}, truth),
                    ("conjugation", f"Chuyển động từ sang {target}: {conj_base}", {"base_form": conj_base, "target_form": target}, conj_answer),
                ]
                for kind, prompt, payload, answer in records:
                    exists = db.query(GrammarQuestion.id).filter(GrammarQuestion.question_type == kind, GrammarQuestion.prompt == prompt).first()
                    if exists:
                        continue
                    db.add(GrammarQuestion(grammar_rule_id=rule.id, jlpt_level=level, question_type=kind,
                                           prompt=prompt, payload=payload, correct_answer=answer,
                                           accepted_answers=None, explanation_vi=explanation,
                                           examples=examples, source="seed", is_active=True))
                    added_questions += 1
        db.commit()
        return {"rules_added": added_rules, "questions_added": added_questions}
    except Exception:
        db.rollback()
        raise
    finally:
        if own_session:
            db.close()


if __name__ == "__main__":
    print(seed())
