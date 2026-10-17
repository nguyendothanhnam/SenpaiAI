"""Idempotently seed editable N5/N4 listening dialogues and VOICEVOX audio."""
import os
import sys
from pathlib import Path

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.database import ListeningLesson
from app.services.audio_service import VoicevoxProvider, choose_speaker_id, furigana_tokens, synthesize_segments

# Starter content: review the Japanese and Vietnamese before publishing to learners.
LESSONS = [
    ("N5", "Chào hỏi ở lớp", "giao_tiep", [
        ("おはようございます。", "Chào buổi sáng."), ("田中さん、おはようございます。", "Chào buổi sáng, bạn Tanaka."),
        ("今日は何時に来ましたか。", "Hôm nay bạn đến lúc mấy giờ?"), ("八時に来ました。", "Tôi đến lúc tám giờ."),
        ("そうですか。授業は九時からですね。", "Vậy à. Lớp học bắt đầu từ chín giờ nhỉ."), ("はい。一緒に教室へ行きましょう。", "Vâng. Chúng ta cùng đến lớp nhé."),
    ]),
    ("N5", "Một ngày cuối tuần", "doi_song", [
        ("日曜日は何をしますか。", "Chủ nhật bạn làm gì?"), ("午前中、家で日本語を勉強します。", "Buổi sáng tôi học tiếng Nhật ở nhà."),
        ("午後は友達と映画を見ます。", "Buổi chiều tôi xem phim với bạn."), ("どんな映画ですか。", "Phim như thế nào?"),
        ("日本の新しい映画です。", "Đó là một bộ phim Nhật mới."), ("いいですね。楽しんでください。", "Hay quá. Chúc bạn vui nhé."),
    ]),
    ("N5", "Gọi món ở quán ăn", "an_uong", [
        ("いらっしゃいませ。", "Xin kính chào quý khách."), ("カレーを一つください。", "Cho tôi một phần cà ri."),
        ("飲み物はいかがですか。", "Quý khách dùng đồ uống gì không ạ?"), ("水をお願いします。", "Cho tôi xin nước lọc."),
        ("カレーと水ですね。", "Một cà ri và một nước lọc ạ."), ("はい、お願いします。", "Vâng, nhờ bạn nhé."),
    ]),
    ("N5", "Hỏi đường đến ga", "di_chuyen", [
        ("すみません、駅はどこですか。", "Xin lỗi, nhà ga ở đâu ạ?"), ("この道をまっすぐ行ってください。", "Xin hãy đi thẳng con đường này."),
        ("信号のところで右に曲がりますか。", "Tôi rẽ phải ở chỗ đèn giao thông phải không?"), ("いいえ、左に曲がってください。", "Không, xin hãy rẽ trái."),
        ("駅まで歩いて何分ですか。", "Đi bộ đến ga mất mấy phút?"), ("五分ぐらいです。", "Khoảng năm phút."),
    ]),
    ("N5", "Mua trái cây", "mua_sam", [
        ("りんごはいくらですか。", "Táo giá bao nhiêu?"), ("一つ百円です。", "Một quả một trăm yên."),
        ("三つください。", "Cho tôi ba quả."), ("みかんも買いますか。", "Bạn có mua quýt nữa không?"),
        ("はい、みかんを二つください。", "Vâng, cho tôi hai quả quýt."), ("全部で五百円です。", "Tổng cộng là năm trăm yên."),
    ]),
    ("N5", "Mượn sách ở thư viện", "hoc_tap", [
        ("この本を借りてもいいですか。", "Tôi có thể mượn quyển sách này không?"), ("学生証を見せてください。", "Xin hãy cho tôi xem thẻ học sinh."),
        ("はい、どうぞ。", "Vâng, đây ạ."), ("返す日は来週の月曜日です。", "Ngày trả sách là thứ Hai tuần sau."),
        ("分かりました。ありがとうございます。", "Tôi hiểu rồi. Cảm ơn ạ."), ("どういたしまして。", "Không có gì."),
    ]),
    ("N4", "Nhận phòng khách sạn", "du_lich", [
        ("今日から二泊で予約したグエンです。", "Tôi là Nguyễn, đã đặt phòng hai đêm từ hôm nay."), ("ご予約を確認しますので、少々お待ちください。", "Để tôi kiểm tra đặt phòng, xin vui lòng đợi một chút."),
        ("予約が確認できました。こちらにお名前をお願いします。", "Đã xác nhận được đặt phòng. Xin ghi tên vào đây."), ("朝食は何時から何時までですか。", "Bữa sáng phục vụ từ mấy giờ đến mấy giờ?"),
        ("七時から十時まで、二階のレストランでございます。", "Từ bảy đến mười giờ tại nhà hàng tầng hai ạ."), ("分かりました。ありがとうございます。", "Tôi hiểu rồi. Cảm ơn."),
    ]),
    ("N4", "Đổi lịch hẹn khám", "suc_khoe", [
        ("明日の予約を変更したいのですが。", "Tôi muốn đổi lịch hẹn ngày mai."), ("何時の予約でしょうか。", "Lịch hẹn của bạn lúc mấy giờ ạ?"),
        ("午前十時に予約しています。", "Tôi đặt lịch lúc mười giờ sáng."), ("午後なら三時に空きがあります。", "Nếu buổi chiều thì còn trống lúc ba giờ."),
        ("では、三時にお願いします。", "Vậy cho tôi đổi sang ba giờ."), ("かしこまりました。お大事になさってください。", "Vâng, chúng tôi đã đổi lịch. Chúc bạn mau khỏe."),
    ]),
    ("N4", "Kế hoạch đi chơi", "doi_song", [
        ("今度の土曜日、海へ行きませんか。", "Thứ Bảy tới bạn đi biển cùng tôi không?"), ("いいですね。何時に出発しますか。", "Được đấy. Mấy giờ chúng ta xuất phát?"),
        ("朝八時に駅で会いましょう。", "Hãy gặp nhau ở ga lúc tám giờ sáng."), ("電車が混むかもしれませんね。", "Có thể tàu sẽ đông nhỉ."),
        ("そうですね。切符を先に買っておきます。", "Ừ nhỉ. Tôi sẽ mua vé trước."), ("ありがとうございます。楽しみにしています。", "Cảm ơn bạn. Tôi đang mong chờ chuyến đi."),
    ]),
    ("N4", "Trao đổi công việc", "cong_viec", [
        ("この資料を今日中に確認してもらえますか。", "Bạn có thể kiểm tra tài liệu này trong hôm nay không?"), ("はい。何時までに必要ですか。", "Được. Bạn cần trước mấy giờ?"),
        ("できれば、午後四時までにお願いします。", "Nếu được, nhờ bạn hoàn thành trước bốn giờ chiều."), ("分かりました。会議の前にお送りします。", "Tôi hiểu rồi. Tôi sẽ gửi trước cuộc họp."),
        ("助かります。変更点があれば教えてください。", "Thế thì tốt quá. Nếu có điểm nào thay đổi hãy cho tôi biết."), ("はい、確認して連絡します。", "Vâng, tôi sẽ kiểm tra rồi liên lạc."),
    ]),
    ("N4", "Dự báo thời tiết", "thoi_tiet", [
        ("明日は雨が降るそうですよ。", "Nghe nói ngày mai trời sẽ mưa đấy."), ("本当ですか。傘を持って行ったほうがいいですね。", "Thật sao? Tôi nên mang ô theo nhỉ."),
        ("午後から強くなるらしいです。", "Nghe nói từ chiều mưa sẽ nặng hạt hơn."), ("じゃあ、洗濯は今日しておきます。", "Vậy thì hôm nay tôi sẽ giặt đồ trước."),
        ("それがよさそうですね。", "Làm vậy có vẻ tốt đấy."), ("天気予報を教えてくれてありがとう。", "Cảm ơn bạn đã cho tôi biết dự báo thời tiết."),
    ]),
    ("N4", "Đổi tàu ở nhà ga", "di_chuyen", [
        ("大阪へ行くには、どの電車に乗ればいいですか。", "Để đến Osaka, tôi nên đi chuyến tàu nào?"), ("次の駅で快速電車に乗り換えてください。", "Hãy đổi sang tàu nhanh ở ga tiếp theo."),
        ("この電車は次の駅に止まりますか。", "Tàu này có dừng ở ga tiếp theo không?"), ("はい、止まります。三番線に着きます。", "Có. Tàu sẽ đến sân ga số ba."),
        ("乗り換えに時間がかかりますか。", "Đổi tàu có mất nhiều thời gian không?"), ("五分あれば大丈夫ですよ。", "Có năm phút là kịp thôi."),
    ]),
]


def _choose_speaker(provider: VoicevoxProvider) -> int:
    try:
        return choose_speaker_id(provider, settings.listening_voicevox_speaker_id)
    except Exception as exc:
        raise RuntimeError(f"Không kết nối được VOICEVOX. Hãy khởi động service rồi chạy seed lại: {exc}") from exc


def seed(db=None, provider=None) -> dict[str, int]:
    owns_session = db is None
    db = db or SessionLocal()
    provider = provider or VoicevoxProvider()
    speaker_id = None

    def ensure_speaker_id():
        nonlocal speaker_id
        if speaker_id is None:
            speaker_id = _choose_speaker(provider)
        return speaker_id
    created = generated = 0
    try:
        for level, title, topic, content in LESSONS:
            lesson = db.query(ListeningLesson).filter(
                ListeningLesson.jlpt_level == level, ListeningLesson.title == title
            ).first()
            is_new = lesson is None
            if is_new:
                lesson = ListeningLesson(title=title, jlpt_level=level, topic=topic,
                                         description=f"Hội thoại tiếng Nhật cấp độ {level}: {title.lower()}.",
                                         segments=[], source="seed", is_published=True)
                db.add(lesson)
                db.flush()
                created += 1
            audio_exists = bool(lesson.audio_path and (Path(settings.listening_media_dir) / lesson.audio_path).is_file())
            if is_new or not lesson.segments:
                wav_name, assembled = synthesize_segments([ja for ja, _ in content], ensure_speaker_id(), provider)
                segments = []
                for index, ((ja, vi), timing) in enumerate(zip(content, assembled.timings)):
                    segments.append({"idx": index, **timing, "ja": ja,
                                     "tokens": furigana_tokens(ja), "vi": vi})
                lesson.segments = segments
                lesson.audio_path = wav_name
                lesson.duration_ms = assembled.duration_ms
                generated += 1
            elif not audio_exists:
                # Rebuild audio from persisted Japanese text without duplicating the lesson.
                wav_name, assembled = synthesize_segments([segment["ja"] for segment in lesson.segments],
                                                            ensure_speaker_id(), provider)
                for segment, timing in zip(lesson.segments, assembled.timings):
                    segment.update(timing)
                lesson.audio_path = wav_name
                lesson.duration_ms = assembled.duration_ms
                generated += 1
        db.commit()
        return {"lessons_created": created, "audio_generated": generated}
    except Exception:
        db.rollback()
        raise
    finally:
        if owns_session:
            db.close()


if __name__ == "__main__":
    print(seed())
