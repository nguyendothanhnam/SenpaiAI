"""Versioned, bounded personal archives. No ORM objects or credentials are serialized."""
import csv
import json
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from html import escape
from zoneinfo import ZoneInfo

from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from sqlalchemy import select, func

from ..models import database as m
from ..core.config import settings

SCHEMA_VERSION = 2
MAX_BYTES = 50 * 1024 * 1024
MAX_ROW_BYTES = 2 * 1024 * 1024
MAX_ROWS = 100_000


def export_day():
    return datetime.now(ZoneInfo(settings.app_timezone)).date().isoformat()

# Explicit model registry; child tables are scoped through their owning parent.
MODELS = [m.User, m.WeeklyLearningGoal, m.ChatFolder, m.ChatConversation,
          m.ChatHistory, m.VoiceConversation, m.ChatAnswerFeedback,
          m.LearningSession, m.DailyTask, m.DailyTaskItem, m.StudyItemStat,
          m.UserGameProfile, m.PointTransaction, m.UserUnlockedItem,
          m.GrammarPracticeAttempt, m.ListeningAttempt, m.PlacementAttempt,
          m.PlacementAttemptItem, m.ExerciseHistory, m.ExerciseDelivery,
          m.FlashcardDeck, m.FlashcardCard, m.FlashcardProgress,
          m.FlashcardSession, m.FlashcardAssessment, m.FlashcardTransfer,
          m.ReminderSettings, m.Notification, m.UserKanjiNote,
          m.KanjiWritingAttempt, m.KanjiWritingReport, m.MinigameLearningEvent,
          m.InternshipProfile, m.InternshipSession, m.ListeningLesson, m.GrammarQuestion, m.Document, m.GrammarLessonProgress]

# Frozen public field lists are populated below, never from row.__dict__.
FIELDS = {'grammar_lesson_progress': ['user_id', 'lesson_id', 'status', 'updated_at'],
 'documents': ['id', 'user_id', 'title', 'content', 'document_type', 'jlpt_level', 'tags', 'source_url', 'created_at', 'updated_at'],
 'users': ['id',
           'email',
           'username',
           'is_active',
           'created_at',
           'updated_at',
           'current_jlpt_level',
           'placement_override',
           'learning_goals',
           'exercise_points',
           'ui_language'],
 'weekly_learning_goals': ['user_id', 'study_days', 'lessons', 'updated_at'],
 'chat_folders': ['id', 'user_id', 'name', 'sort_order', 'created_at'],
 'chat_conversations': ['id',
                        'user_id',
                        'folder_id',
                        'title',
                        'title_is_auto',
                        'is_pinned',
                        'mode',
                        'created_at',
                        'last_activity_at'],
 'chat_history': ['id',
                  'user_id',
                  'question',
                  'answer',
                  'jlpt_level',
                  'grammar_points',
                  'translation',
                  'sources',
                  'input_mode',
                  'conversation_id',
                  'scenario',
                  'feedback',
                  'created_at'],
 'voice_conversations': ['id',
                         'user_id',
                         'scenario_id',
                         'jlpt_level',
                         'status',
                         'started_at',
                         'ended_at',
                         'summary'],
 'chat_answer_feedback': ['id',
                          'user_id',
                          'conversation_id',
                          'chat_history_id',
                          'rating',
                          'comment',
                          'created_at',
                          'updated_at'],
 'learning_sessions': ['id',
                       'user_id',
                       'session_type',
                       'topic',
                       'difficulty_level',
                       'duration_minutes',
                       'questions_answered',
                       'correct_answers',
                       'created_at',
                       'completed_at'],
 'daily_tasks': ['id',
                 'user_id',
                 'task_date',
                 'status',
                 'total_items',
                 'correct_count',
                 'points_awarded',
                 'streak_after',
                 'created_at',
                 'completed_at'],
 'daily_task_items': ['id',
                      'daily_task_id',
                      'position',
                      'item_type',
                      'source_id',
                      'question_type',
                      'payload',
                      'answer_key',
                      'user_answer',
                      'is_correct',
                      'time_spent_ms',
                      'answered_at'],
 'study_item_stats': ['id',
                      'user_id',
                      'item_type',
                      'item_id',
                      'attempts',
                      'wrong_count',
                      'last_wrong_at',
                      'last_seen_at'],
 'user_game_profiles': ['user_id',
                        'points_balance',
                        'current_streak',
                        'longest_streak',
                        'last_completed_date',
                        'active_theme_id',
                        'active_background_id',
                        'updated_at'],
 'point_transactions': ['id',
                        'user_id',
                        'amount',
                        'reason',
                        'ref_type',
                        'ref_id',
                        'balance_after',
                        'created_at'],
 'user_unlocked_items': ['id', 'user_id', 'item_type', 'item_id', 'price_paid', 'unlocked_at'],
 'grammar_practice_attempts': ['id',
                               'user_id',
                               'learning_session_id',
                               'question_id',
                               'grammar_rule_id',
                               'jlpt_level',
                               'question_type',
                               'user_answer',
                               'is_correct',
                               'time_spent_ms',
                               'created_at'],
 'listening_attempts': ['id',
                        'user_id',
                        'lesson_id',
                        'mode',
                        'score',
                        'details',
                        'duration_ms',
                        'created_at'],
 'placement_attempts': ['id',
                        'user_id',
                        'status',
                        'language',
                        'questions',
                        'answers',
                        'available_levels',
                        'target_level',
                        'skill_scores',
                        'recommended_level',
                        'result',
                        'created_at',
                        'completed_at',
                        'confirmed_at',
                        'assessment_mode',
                        'selected_level',
                        'estimated_level',
                        'expires_at',
                        'total_score',
                        'scoring_version',
                        'estimation_version',
                        'revision'],
 'placement_attempt_items': ['id',
                             'attempt_id',
                             'question_id',
                             'source_key',
                             'position',
                             'snapshot',
                             'user_answer',
                             'is_correct',
                             'revision',
                             'answered_at'],
 'exercise_history': ['id',
                      'user_id',
                      'source_type',
                      'source_id',
                      'normalized_content',
                      'jlpt_level',
                      'skill',
                      'served_count',
                      'last_served_at',
                      'last_result',
                      'last_answered_at',
                      'correct_streak',
                      'due_at',
                      'last_context'],
 'exercise_deliveries': ['id',
                         'user_id',
                         'history_id',
                         'source_type',
                         'source_id',
                         'context',
                         'context_ref',
                         'served_at',
                         'answered_at',
                         'result'],
 'flashcard_decks': ['id',
                     'user_id',
                     'title',
                     'description',
                     'jlpt_level',
                     'topic',
                     'is_private',
                     'created_at',
                     'updated_at'],
 'flashcard_cards': ['id', 'deck_id', 'position', 'front', 'back', 'reading', 'note'],
 'flashcard_progress': ['user_id',
                        'card_id',
                        'state',
                        'stage',
                        'due_at',
                        'correct',
                        'wrong',
                        'last_reviewed_at',
                        'starred'],
 'flashcard_sessions': ['id',
                        'user_id',
                        'mode',
                        'card_count',
                        'correct',
                        'wrong',
                        'duration_seconds',
                        'results',
                        'created_at'],
 'flashcard_assessments': ['id',
                           'user_id',
                           'deck_id',
                           'mode',
                           'status',
                           'questions',
                           'result',
                           'created_at'],
 'flashcard_transfers': ['id', 'user_id', 'source_key', 'deck_id', 'created_at'],
 'reminder_settings': ['user_id',
                       'enabled',
                       'timezone',
                       'reminder_time',
                       'days_of_week',
                       'types',
                       'quiet_start',
                       'quiet_end',
                       'push_enabled',
                       'max_per_day',
                       'snooze_until',
                       'updated_at'],
 'notifications': ['id',
                   'user_id',
                   'type',
                   'title',
                   'body',
                   'url',
                   'data',
                   'dedupe_key',
                   'created_at',
                   'read_at',
                   'push_sent_at'],
 'user_kanji_notes': ['id',
                      'user_id',
                      'kanji',
                      'sino_vietnamese',
                      'meaning_vi',
                      'mnemonic',
                      'updated_at'],
 'kanji_writing_attempts': ['id',
                            'user_id',
                            'attempt_key',
                            'kanji',
                            'jlpt_level',
                            'mode',
                            'result',
                            'elapsed_seconds',
                            'created_at'],
 'kanji_writing_reports': ['id',
                           'user_id',
                           'report_key',
                           'attempt_key',
                           'kanji',
                           'strokes',
                           'result',
                           'comment',
                           'created_at'],
 'minigame_learning_events': ['id',
                              'user_id',
                              'event_key',
                              'game',
                              'source_type',
                              'source_id',
                              'action',
                              'answer',
                              'jlpt_level',
                              'created_at'],
 'internship_profiles': ['user_id',
                         'current_industry',
                         'current_level',
                         'exp_points',
                         'company_name',
                         'job_title',
                         'interview_passed',
                         'total_interviews',
                         'total_scenarios_completed',
                         'manner_score_avg',
                         'keigo_score_avg',
                         'created_at',
                         'updated_at'],
 'internship_sessions': ['id',
                         'user_id',
                         'session_type',
                         'industry',
                         'level',
                         'scenario_id',
                         'status',
                         'current_turn',
                         'max_turns',
                         'overall_score',
                         'grammar_score',
                         'keigo_score',
                         'manner_score',
                         'turns_data',
                         'final_feedback',
                         'offer_letter',
                         'created_at',
                         'completed_at'],
 'listening_lessons': ['id',
                       'title',
                       'jlpt_level',
                       'topic',
                       'description',
                       'segments',
                       'duration_ms',
                       'source',
                       'is_published',
                       'created_by',
                       'source_document_id',
                       'video_url', 'video_provider', 'video_id', 'source_note',
                       'created_at'],
 'grammar_questions': ['id',
                       'grammar_rule_id',
                       'jlpt_level',
                       'question_type',
                       'prompt',
                       'payload',
                       'correct_answer',
                       'accepted_answers',
                       'explanation_vi',
                       'examples',
                       'source',
                       'is_active',
                       'created_by_user_id',
                       'source_document_id',
                       'created_at']}


def scoped(model, uid):
    if model is m.User:
        return model.id == uid
    if model is m.DailyTaskItem:
        return model.daily_task_id.in_(select(m.DailyTask.id).where(m.DailyTask.user_id == uid))
    if model is m.PlacementAttemptItem:
        return model.attempt_id.in_(select(m.PlacementAttempt.id).where(m.PlacementAttempt.user_id == uid))
    if model is m.FlashcardCard:
        return model.deck_id.in_(select(m.FlashcardDeck.id).where(m.FlashcardDeck.user_id == uid))
    if model is m.ListeningLesson:
        return model.created_by == uid
    if model is m.GrammarQuestion:
        return model.created_by_user_id == uid
    return model.user_id == uid


def encode(value):
    return json.dumps(value, ensure_ascii=False, default=str, separators=(',', ':'))


def spreadsheet(value):
    text = encode(value) if isinstance(value, (dict, list)) else '' if value is None else str(value)
    # Formula neutralization also covers leading whitespace, CR, TAB and LF.
    return "'" + text if text.lstrip().startswith(('=', '+', '-', '@')) or text.startswith(('\t', '\r', '\n')) else text


def build_archive(db, user, kind):
    temp = tempfile.TemporaryDirectory(prefix='senpaiai-export-')
    root = Path(temp.name)
    counts, warnings = {}, []
    metadata = {'schema_version': SCHEMA_VERSION, 'export_date': datetime.now(timezone.utc).isoformat(),
                'limits': {'bytes': MAX_BYTES, 'row_bytes': MAX_ROW_BYTES, 'rows_per_table': MAX_ROWS},
                'unavailable': ['documents_without_owner', 'device_only_data', 'original_uploaded_files']}
    try:
        total = 0
        with (root / 'data.json').open('w', encoding='utf-8') as output:
            output.write('{"schema_version":2,"tables":{')
            for index, model in enumerate(MODELS):
                name = model.__tablename__
                fields = FIELDS[name]
                columns = [getattr(model, field) for field in fields]
                statement = select(*columns).where(scoped(model, user.id)).order_by(*model.__table__.primary_key.columns).limit(MAX_ROWS + 1)
                if index:
                    output.write(',')
                output.write(encode(name) + ':[')
                count = 0
                with (root / f'{name}.csv').open('w', encoding='utf-8-sig', newline='') as csvfile:
                    writer = csv.writer(csvfile)
                    writer.writerow(fields)
                    result = db.execute(statement.execution_options(stream_results=True, yield_per=1))
                    try:
                        skipped = 0
                        for scanned, row in enumerate(result):
                            payload = encode(dict(zip(fields, row)))
                            size = len(payload.encode('utf-8'))
                            if size > MAX_ROW_BYTES:
                                skipped += 1
                                continue
                            if scanned >= MAX_ROWS or total + size > MAX_BYTES:
                                warnings.append({'table': name, 'reason': 'limit_reached'})
                                break
                            if count:
                                output.write(',')
                            output.write(payload)
                            writer.writerow([spreadsheet(v) for v in row])
                            total += size
                            count += 1
                        if skipped:
                            warnings.append({'table': name, 'reason': 'row_too_large', 'omitted_rows': skipped})
                    finally:
                        result.close()
                output.write(']')
                counts[name] = count
            metadata.update(counts=counts, warnings=warnings, truncated=bool(warnings))
            output.write('},"metadata":' + encode(metadata) + '}')
        if kind == 'zip':
            guide = ['HƯỚNG DẪN BẢN XUẤT SENPAIAI', 'data.json: toàn bộ dữ liệu cá nhân trên máy chủ theo lược đồ phiên bản 2.',
                     'metadata.counts: số bản ghi thực xuất; warnings/truncated: phần bị cắt hoặc bỏ qua.',
                     'Giới hạn: 50 MiB dữ liệu JSON, 2 MiB mỗi bản ghi, 100.000 bản ghi mỗi bảng.',
                     'CSV: UTF-8 BOM cho Excel; hàng đầu là tên cột; ô JSON giữ cấu trúc lồng nhau.',
                     "Ô có nguy cơ công thức được thêm dấu nháy đơn ở đầu. Giá trị gốc nằm trong JSON.",
                     'Không gồm mật khẩu, token, đăng ký push, bí mật hệ thống, tệp gốc đã tải lên hoặc dữ liệu chỉ lưu trên thiết bị.',
                     'documents không có chủ sở hữu: không xuất thư viện chung để tránh lộ dữ liệu người khác.', '']
            for model in MODELS:
                name = model.__tablename__
                guide.append(f'{name}.csv — {TABLE_LABELS[name]}; {counts[name]} bản ghi.')
                guide.extend(f'  {field}: {COLUMN_LABELS.get(field, field.replace("_", " "))}' for field in FIELDS[name])
            (root / 'HUONG_DAN.txt').write_text('\n'.join(guide), encoding='utf-8-sig')
            path = root / 'archive.zip'
            with zipfile.ZipFile(path, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
                for item in root.iterdir():
                    if item.suffix in ('.json', '.csv', '.txt'):
                        archive.write(item, item.name)
        else:
            path = root / 'data.json'
        filename = f'senpaiai-{export_day()}.{kind}'
        return FileResponse(path, filename=filename, media_type='application/zip' if kind == 'zip' else 'application/json',
                            headers={'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
                                     'X-Export-Summary': encode(counts), 'X-Export-Truncated': str(bool(warnings)).lower()},
                            background=BackgroundTask(temp.cleanup))
    except BaseException:
        temp.cleanup()
        raise


def report_html(db, user, language):
    labels = dict(_LABELS[language])
    labels.update(TABLE_LABELS if language == "vi" else _LABELS['en_tables'])
    def safe(value):
        return escape(str(value))
    profile = db.get(m.UserGameProfile, user.id)
    sections = [f'<h1>{safe(labels["title"])}</h1><p>{safe(user.username)} · {safe(export_day())}</p>',
                f'<p>{safe(labels["level"])}: {safe(user.current_jlpt_level)} · {safe(labels["points"])}: {user.exercise_points} · '
                f'{safe(labels["balance"])}: {profile.points_balance if profile else 0} · {safe(labels["streak"])}: {profile.current_streak if profile else 0}</p>']
    sections.append(f'<h2>{safe(labels["accuracy"])}</h2><ul>')
    for model, correct in [(m.GrammarPracticeAttempt, m.GrammarPracticeAttempt.is_correct), (m.DailyTaskItem, m.DailyTaskItem.is_correct), (m.PlacementAttemptItem, m.PlacementAttemptItem.is_correct)]:
        total, right = db.query(func.count(), func.sum(correct.cast(m.Integer))).filter(scoped(model, user.id), correct.isnot(None)).one()
        accuracy = f'{right / total * 100:.1f}% ({right}/{total})' if total else labels['missing']
        sections.append(f'<li>{safe(labels[model.__tablename__])}: {safe(accuracy)}</li>')
    score, lessons = db.query(func.avg(m.ListeningAttempt.score), func.count()).filter(m.ListeningAttempt.user_id == user.id).one()
    sections.append(f'<li>{safe(labels["listening"])}: {safe(round(score, 2) if score is not None else labels["missing"])} ({lessons})</li>')
    right, wrong = db.query(func.sum(m.FlashcardProgress.correct), func.sum(m.FlashcardProgress.wrong)).filter(m.FlashcardProgress.user_id == user.id).one()
    total = (right or 0) + (wrong or 0)
    accuracy = f'{right / total * 100:.1f}% ({right}/{total})' if total else labels['missing']
    sections.append(f'<li>{safe(labels["flashcard_progress"])}: {safe(accuracy)}</li></ul>')
    writing_score = m.KanjiWritingAttempt.result['overall_score'].as_float()
    average = db.query(func.avg(writing_score)).filter(m.KanjiWritingAttempt.user_id == user.id).scalar()
    sections.append(f'<p>{safe(labels["writing_score"])}: {safe(round(average, 2) if average is not None else labels["missing"])}</p>')
    sections.append(f'<h2>{safe(labels["counts"])}</h2><ul>')
    for model in [m.LearningSession, m.GrammarPracticeAttempt, m.ListeningAttempt, m.FlashcardSession, m.KanjiWritingAttempt]:
        count = db.query(func.count()).select_from(model).filter(scoped(model, user.id)).scalar()
        sections.append(f'<li>{safe(labels[model.__tablename__])}: {count}</li>')
    sections.append(f'</ul><h2>{safe(labels["mistakes"])}</h2><ul>')
    mistakes = db.query(m.StudyItemStat).filter(m.StudyItemStat.user_id == user.id, m.StudyItemStat.wrong_count > 0).order_by(m.StudyItemStat.wrong_count.desc(), m.StudyItemStat.id).limit(5).all()
    sections.extend(f'<li>{safe(r.item_type)} / {safe(r.item_id)}: {r.wrong_count}/{r.attempts}</li>' for r in mistakes)
    if not mistakes:
        sections.append(f'<li>{safe(labels["missing"])}</li>')
    sections.append(f'</ul><h2>{safe(labels["recent"])}</h2><ul>')
    recent = []
    for model in [m.LearningSession, m.ChatHistory, m.DailyTask, m.GrammarPracticeAttempt,
                  m.ListeningAttempt, m.FlashcardSession, m.KanjiWritingAttempt,
                  m.PlacementAttempt, m.InternshipSession]:
        rows = db.query(model.created_at).filter(scoped(model, user.id), model.created_at.isnot(None)).order_by(model.created_at.desc()).limit(5).all()
        recent.extend((r.created_at.replace(tzinfo=timezone.utc) if r.created_at.tzinfo is None else r.created_at, model.__tablename__) for r in rows)
    recent.sort(key=lambda entry: entry[0], reverse=True)
    sections.extend(f'<li>{safe(at.isoformat())} · {safe(labels[name])}</li>' for at, name in recent[:5])
    if not recent:
        sections.append(f'<li>{safe(labels["missing"])}</li>')
    sections.append(f'</ul><p>{safe(labels["limitations"])}</p>')
    return f'<!doctype html><html lang="{language}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{safe(labels["title"])}</title><style>:root{{--text:#182126;--card:#fff}}body{{font:14px system-ui;max-width:800px;margin:auto;padding:20px;line-height:1.5;overflow-wrap:anywhere;color:var(--text);background:var(--card)}}h2{{font-size:18px;margin:12px 0}}ul{{margin:4px 0}}@media print{{body{{padding:0;font-size:11px}}@page{{size:A4;margin:12mm}}}}@media(prefers-color-scheme:dark){{:root{{--card:#182126;--text:#f4f7f8}}}}@media print{{:root{{--card:white;--text:black}}}}</style><body>' + ''.join(sections) + '</body></html>'


_LABELS = json.loads((Path(__file__).parents[1] / "data/personal_export_labels.json").read_text(encoding="utf-8"))
TABLE_LABELS = _LABELS["tables"]
COLUMN_LABELS = _LABELS["columns"]
