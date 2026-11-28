"""Bounded, owned source adapters. Never creates tasks, calls AI or returns answers."""
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from math import isfinite
from types import SimpleNamespace

from ..core.config import settings
from ..core import learning_progress_config as policy
from ..models.database import (User, WeeklyLearningGoal, GrammarPracticeAttempt, GrammarRule, GrammarQuestion,
    DailyTask, DailyTaskItem, ListeningAttempt, ListeningLesson, ChatHistory, VoiceConversation,
    InternshipSession, PlacementAttempt, StudyItemStat, ExerciseHistory, LearningSession, Vocabulary, KanjiWritingAttempt, MinigameLearningEvent, FlashcardSession)
from .kanji_dictionary_service import kanji_dictionary_service


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value and value.tzinfo is None else value


def local_date(value):
    return utc(value).astimezone(ZoneInfo(settings.app_timezone)).date()


def bounded_number(value, default=0, maximum=100):
    try:
        number = float(value)
        return max(0, min(maximum, number)) if isfinite(number) else default
    except (TypeError, ValueError):
        return default


@dataclass
class Evidence:
    skill: str
    level: str | None
    at: datetime
    score: float
    count: int = 1
    source: str = "practice"
    item_type: str | None = None
    item_id: str | None = None
    label: str | None = None
    difficulty: float = 1.0
    reliability: float = 1.0
    dated: bool = True
    errors: dict = field(default_factory=dict)


@dataclass
class Activity:
    at: datetime
    source: str
    key: str
    seconds: float = 0
    completed: bool = False
    estimated_time: bool = False


class LearningSnapshot:
    def __init__(self, db, user, now=None):
        self.db, self.user = db, user
        self.now = utc(now or datetime.now(timezone.utc))
        self.since = self.now - timedelta(days=policy.WINDOW_DAYS)
        self.today = local_date(self.now)
        self.events, self.activities, self.truncated = [], [], []
        self.legacy_stats, self.placements, self.due, self.tasks = [], [], [], []
        self.catalog = {}
        self.goal = db.query(WeeklyLearningGoal).filter_by(user_id=user.id).first()
        self._load_catalog()
        self._load()

    def rows(self, query, timestamp, name):
        rows = query.filter(timestamp >= self.since, timestamp <= self.now).order_by(timestamp.desc()).limit(policy.SOURCE_ROW_LIMIT + 1).all()
        if len(rows) > policy.SOURCE_ROW_LIMIT:
            self.truncated.append(name)
        return rows[:policy.SOURCE_ROW_LIMIT]

    def add(self, event):
        if event.skill in policy.SKILLS and self.since <= utc(event.at) <= self.now:
            event.at = utc(event.at)
            self.events.append(event)

    def _load_catalog(self):
        rules = self.db.query(GrammarRule.id, GrammarRule.rule_name, GrammarRule.jlpt_level, GrammarRule.difficulty_score).order_by(GrammarRule.id).limit(10001).all()
        questions = self.db.query(GrammarQuestion.id, GrammarQuestion.grammar_rule_id, GrammarQuestion.jlpt_level, GrammarQuestion.prompt).filter(GrammarQuestion.is_active.is_(True)).order_by(GrammarQuestion.id).limit(10001).all()
        words = self.db.query(Vocabulary.id, Vocabulary.japanese_word, Vocabulary.reading, Vocabulary.jlpt_level).order_by(Vocabulary.id).limit(10001).all()
        if any(len(rows) > 10000 for rows in (rules, questions, words)):
            self.truncated.append('catalog')
        self.rules = {row.id: row for row in rules[:10000]}
        self.questions = {str(row.id): row for row in questions[:10000]}
        self.words = {str(row.id): row for row in words[:10000]}
        entries, _ = kanji_dictionary_service.list_entries(limit=10000)
        self.kanji = {row['kanji']: row for row in entries}
        active_rules = {row.grammar_rule_id for row in questions[:10000] if row.grammar_rule_id}
        for level in policy.LEVELS:
            self.catalog[level] = {
                'grammar': sum(row.jlpt_level == level and row.id in active_rules for row in self.rules.values()),
                'kanji': sum(row.get('jlpt') == level for row in entries),
                'vocab': len({(row.japanese_word, row.reading) for row in words[:10000] if row.jlpt_level == level}),
            }

    def _load(self):
        db, uid = self.db, self.user.id
        grammar = self.rows(db.query(GrammarPracticeAttempt).filter_by(user_id=uid), GrammarPracticeAttempt.created_at, 'grammar')
        grammar_times = Counter()
        for row in grammar:
            rule = self.rules.get(row.grammar_rule_id)
            errors = {f'grammar.{row.question_type}': 1} if not row.is_correct else {}
            self.add(Evidence('grammar', row.jlpt_level, row.created_at, float(row.is_correct),
                item_type='grammar_rule' if rule else 'grammar_question', item_id=str(row.grammar_rule_id if rule else row.question_id),
                label=rule.rule_name if rule else None, difficulty=1 + bounded_number(rule.difficulty_score, maximum=10) / 50 if rule else 1,
                errors=errors))
            seconds = bounded_number(row.time_spent_ms, maximum=300000) / 1000
            grammar_times[row.learning_session_id] += seconds
            self.activities.append(Activity(utc(row.created_at), 'grammar_answer', str(row.id), seconds))

        daily_rows = self.rows(db.query(DailyTaskItem).join(DailyTask).filter(DailyTask.user_id == uid, DailyTaskItem.answered_at.isnot(None)), DailyTaskItem.answered_at, 'daily_answers')
        seen_stats = set()
        for row in daily_rows:
            payload = row.payload or {}
            skill = 'vocab' if row.item_type == 'flashcard' else row.item_type
            item_type, item_id, label = skill, row.source_id, None
            if skill == 'grammar':
                question = self.questions.get(str(row.source_id))
                rid = question.grammar_rule_id if question else (payload.get('grammar_rule') or {}).get('id')
                rule = self.rules.get(rid)
                item_type, item_id, label = ('grammar_rule', str(rid), rule.rule_name) if rule else ('grammar_question', row.source_id, None)
            elif skill == 'vocab':
                label = payload.get('word')
            elif skill == 'kanji':
                label = payload.get('kanji') or row.source_id
            seen_stats.add((skill, str(row.source_id)))
            self.add(Evidence(skill, payload.get('level') or payload.get('jlpt_level'), row.answered_at,
                float(bool(row.is_correct)), source='daily', item_type=item_type, item_id=str(item_id), label=label,
                reliability=0.35 if row.item_type == 'flashcard' else 1,
                errors={f'{skill}.{row.question_type}': 1} if row.is_correct is False else {}))
            self.activities.append(Activity(utc(row.answered_at), 'daily_answer', str(row.id), bounded_number(row.time_spent_ms, maximum=300000) / 1000))
        self.tasks = self.rows(db.query(DailyTask).filter_by(user_id=uid), DailyTask.created_at, 'daily_tasks')
        for row in self.tasks:
            if row.completed_at:
                self.activities.append(Activity(utc(row.completed_at), 'daily', str(row.id), completed=True))

        listening = self.rows(db.query(ListeningAttempt, ListeningLesson.jlpt_level).join(ListeningLesson).filter(ListeningAttempt.user_id == uid), ListeningAttempt.created_at, 'listening')
        for row, level in listening:
            details = row.details or {}
            count = int(bounded_number(details.get('total'), maximum=50))
            if count:
                wrong = max(0, count - int(bounded_number(details.get('correct_count'), maximum=count)))
                self.add(Evidence('listening', level, row.created_at, bounded_number(row.score) / 100,
                    count=count, source='listening', errors={f'listening.{row.mode}': wrong} if wrong else {}))
            self.activities.append(Activity(utc(row.created_at), 'listening', str(row.id), bounded_number(row.duration_ms, maximum=7200000) / 1000, True))

        chats = self.rows(db.query(ChatHistory.id, ChatHistory.created_at, ChatHistory.jlpt_level, ChatHistory.feedback).filter(ChatHistory.user_id == uid), ChatHistory.created_at, 'conversation')
        for row in chats:
            self.activities.append(Activity(utc(row.created_at), 'conversation_turn', str(row.id)))
            issues = (row.feedback or {}).get('issues') if isinstance(row.feedback, dict) else None
            if isinstance(issues, list):
                kinds = Counter(f"conversation.{issue.get('type')}" for issue in issues[:20] if isinstance(issue, dict) and issue.get('type') in ('grammar', 'vocab', 'politeness'))
                self.add(Evidence('conversation', row.jlpt_level, row.created_at, 1 / (1 + len(issues)),
                    source='feedback_proxy', reliability=0.25, errors=dict(kinds)))
        voice = self.rows(db.query(VoiceConversation).filter_by(user_id=uid), VoiceConversation.started_at, 'voice_sessions')
        for row in voice:
            if row.ended_at:
                self.activities.append(Activity(utc(row.ended_at), 'voice', str(row.id),
                    min(3600, max(0, (utc(row.ended_at) - utc(row.started_at)).total_seconds())), True, True))

        interviews = self.rows(db.query(InternshipSession).filter_by(user_id=uid, status='completed'), InternshipSession.created_at, 'interview')
        for row in interviews:
            if not row.completed_at:
                continue
            skill = 'interview' if row.session_type == 'interview' else 'conversation'
            errors = {f'interview.{name}': 1 for name, value in (('grammar', row.grammar_score), ('keigo', row.keigo_score), ('manner', row.manner_score)) if bounded_number(value) < 70}
            # Internship's 1–5 workplace progression is not a JLPT level.
            self.add(Evidence(skill, None, row.completed_at, bounded_number(row.overall_score) / 100,
                source='interview_proxy', reliability=0.4, errors=errors))
            self.activities.append(Activity(utc(row.completed_at), 'interview', str(row.id),
                min(3600, max(0, (utc(row.completed_at) - utc(row.created_at)).total_seconds())), True, True))

        fields = (PlacementAttempt.id, PlacementAttempt.skill_scores, PlacementAttempt.result, PlacementAttempt.completed_at,
            PlacementAttempt.selected_level, PlacementAttempt.assessment_mode, PlacementAttempt.confirmed_at, PlacementAttempt.estimated_level)
        self.placements = self.rows(db.query(*fields).filter(PlacementAttempt.user_id == uid, PlacementAttempt.status == 'completed'), PlacementAttempt.completed_at, 'placement')
        for row in self.placements:
            self.activities.append(Activity(utc(row.completed_at), 'placement', str(row.id), completed=True))
            if (row.result or {}).get('is_demo'):
                continue
            for skill, values in (row.skill_scores or {}).items():
                total = int(bounded_number(values.get('total'), maximum=30))
                if skill in policy.SKILLS and total and values.get('score') is not None:
                    self.add(Evidence(skill, row.selected_level if row.assessment_mode == 'confirmation' else None,
                        row.completed_at, bounded_number(values['score']) / 100, count=total, source='placement', reliability=0.6))

        writing = self.rows(db.query(KanjiWritingAttempt).filter_by(user_id=uid), KanjiWritingAttempt.created_at, 'kanji_writing')
        for row in writing:
            writing_score = bounded_number((row.result or {}).get('overall_score'))
            if not (row.result or {}).get('passed'):
                writing_score = min(79, writing_score)
            self.add(Evidence('kanji', row.jlpt_level, row.created_at, writing_score/100,
                source='kanji_writing', item_type='kanji', item_id=row.kanji, label=row.kanji, reliability=0.45))
            self.activities.append(Activity(utc(row.created_at), 'kanji_writing', str(row.id),
                bounded_number(row.elapsed_seconds, maximum=3600), True))
            seen_stats.add(('kanji', row.kanji))

        game_events = self.rows(db.query(MinigameLearningEvent).filter_by(user_id=uid), MinigameLearningEvent.created_at, 'minigame_learning')
        game_due={}
        for row in game_events:
            if row.source_type=='mechanic':continue
            skill='kanji' if row.source_type=='kanji' else 'vocab'
            item_id=row.source_id if skill=='kanji' else f'minigame:{row.source_id}'
            self.add(Evidence(skill,row.jlpt_level,row.created_at,float(row.action=='reviewed'),source='minigame_review',
                item_type=skill,item_id=item_id,label=row.source_id,reliability=0.2))
            self.activities.append(Activity(utc(row.created_at),'minigame_review',str(row.id),completed=row.action=='reviewed'))
            seen_stats.add((skill,item_id))
            key=(row.source_type,row.source_id)
            if key not in game_due or row.id>game_due[key].id:game_due[key]=row

        flashcards = self.rows(db.query(FlashcardSession).filter_by(user_id=uid), FlashcardSession.created_at, 'flashcard_sessions')
        for row in flashcards:
            # User-authored cards count as study activity, never verified JLPT skill evidence.
            self.activities.append(Activity(utc(row.created_at), 'flashcard', str(row.id),
                bounded_number(row.duration_seconds, maximum=14400), True))
        sessions = self.rows(db.query(LearningSession).filter_by(user_id=uid), LearningSession.created_at, 'learning_sessions')
        for row in sessions:
            if row.completed_at and row.session_type != 'speaking':
                seconds = 0 if grammar_times[row.id] > 0 else bounded_number(row.duration_minutes, maximum=120) * 60
                self.activities.append(Activity(utc(row.completed_at), 'learning_session', str(row.id), seconds, True))
        stats = self.rows(db.query(StudyItemStat).filter_by(user_id=uid), StudyItemStat.last_seen_at, 'legacy_item_stats')
        for row in stats:
            self.legacy_stats.append(row)
            if (row.item_type, str(row.item_id)) in seen_stats or not row.attempts or row.attempts < 0:
                continue
            entry = self.kanji.get(str(row.item_id)) if row.item_type == 'kanji' else self.words.get(str(row.item_id))
            level = entry.get('jlpt') if isinstance(entry, dict) else entry.jlpt_level if entry else None
            label = str(row.item_id) if row.item_type == 'kanji' else entry.japanese_word if entry else str(row.item_id)
            # Old aggregates have no answer dates; never allocate them to a weekly report.
            self.add(Evidence(row.item_type, level, row.last_seen_at, max(0, row.attempts - row.wrong_count) / row.attempts,
                count=min(row.attempts, 10), source='legacy_aggregate', item_type=row.item_type, item_id=str(row.item_id),
                label=label, reliability=0.2, dated=False))
        self.due = db.query(ExerciseHistory).filter(ExerciseHistory.user_id == uid,
            ExerciseHistory.due_at <= self.now).order_by(ExerciseHistory.due_at).limit(100).all()
        self.due.extend(SimpleNamespace(skill='kanji' if row.source_type=='kanji' else 'vocab',jlpt_level=row.jlpt_level,source='minigame') for row in game_due.values() if row.action=='wrong')
        self.activities = [row for row in self.activities if self.since <= utc(row.at) <= self.now]

    def coverage(self):
        return {'version': policy.VERSION, 'window_start': self.since, 'window_end': self.now,
            'source_row_limit': policy.SOURCE_ROW_LIMIT, 'truncated_sources': sorted(set(self.truncated)),
            'partial': bool(self.truncated), 'contains_proxy_scores': any(row.reliability < 0.5 for row in self.events),
            'contains_undated_aggregates': any(not row.dated for row in self.events)}
