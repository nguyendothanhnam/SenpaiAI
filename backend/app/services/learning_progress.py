"""Deterministic competence, calendar reports and roadmap projections. No writes/AI."""
from collections import Counter, defaultdict
from datetime import date, timedelta
from math import isfinite

from ..core import learning_progress_config as policy
from .learning_history import utc, local_date


def proficiency(events, now, target_level=None, *, item=False):
    weighted, weights, samples, days, sources = 0.0, 0.0, 0, set(), Counter()
    objective_correct, objective_total = 0, 0
    latest = None
    for event in events:
        if not isfinite(event.score):
            continue
        age = max(0, (utc(now) - utc(event.at)).total_seconds() / 86400)
        difficulty = event.difficulty
        if target_level in policy.LEVELS and event.level in policy.LEVELS:
            difficulty *= max(0.55, min(1.6, 1 + 0.15 * (policy.LEVELS.index(event.level) - policy.LEVELS.index(target_level))))
        weight = 2 ** (-age / policy.HALF_LIFE_DAYS) * difficulty * event.reliability * event.count
        weighted += weight * event.score; weights += weight; samples += event.count
        days.add(local_date(event.at)); sources[event.source] += event.count
        latest = max(latest, event.at) if latest else event.at
        if event.reliability >= 0.5 and event.dated:
            objective_total += event.count
            objective_correct += round(event.score * event.count)
    score = round(100 * weighted / weights, 1) if weights else None
    minimum = policy.MIN_ITEM_ANSWERS if item else policy.MIN_SKILL_ANSWERS
    sufficient = samples >= minimum and len(days) >= 2 and weights >= 1 and latest and (utc(now) - latest).days <= 90
    return {'score': score, 'samples': samples, 'sample_days': len(days), 'effective_weight': round(weights, 2),
        'evidence': 'sufficient' if sufficient else 'insufficient', 'sources': dict(sources),
        'accuracy': round(100 * objective_correct / objective_total, 1) if objective_total else None,
        'graded_answers': objective_total, 'correct_answers': objective_correct, 'last_practiced_at': latest,
        'mastered': bool(sufficient and score >= policy.MASTERY_THRESHOLD),
        'proxy_only': bool(samples and not objective_total)}


def skills(snapshot, level=None, events=None):
    pool = snapshot.events if events is None else events
    return {skill: proficiency([event for event in pool if event.skill == skill and (level is None or event.level == level)],
                              snapshot.now, level or snapshot.user.current_jlpt_level) for skill in policy.SKILLS}


def mastery_items(snapshot, skill=None, level=None):
    grouped = defaultdict(list)
    for event in snapshot.events:
        if event.item_type and event.item_id and (not skill or event.skill == skill) and (not level or event.level == level):
            grouped[(event.skill, event.item_type, event.item_id, event.level)].append(event)
    result = []
    for (kind, item_type, item_id, actual_level), rows in grouped.items():
        value = proficiency(rows, snapshot.now, actual_level, item=True)
        result.append({'skill': kind, 'item_type': item_type, 'item_id': item_id, 'level': actual_level,
            'label': next((row.label for row in reversed(rows) if row.label), item_id),
            'wrong_count': sum(round((1 - row.score) * row.count) for row in rows), **value})
    return sorted(result, key=lambda row: (row['score'] if row['score'] is not None else -1, -row['wrong_count'], row['item_type'], row['item_id']))


def period_bounds(period, anchor):
    if period == 'week':
        start = anchor - timedelta(days=anchor.weekday())
        return start, start + timedelta(days=7)
    start = anchor.replace(day=1)
    end = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    return start, end


def previous_start(period, start):
    return start - timedelta(days=7) if period == 'week' else (start - timedelta(days=1)).replace(day=1)


def period_metrics(snapshot, start, end):
    events = [row for row in snapshot.events if row.dated and start <= local_date(row.at) < end]
    activity = [row for row in snapshot.activities if start <= local_date(row.at) < end]
    by_skill = skills(snapshot, events=events)
    total = sum(row['graded_answers'] for row in by_skill.values())
    correct = sum(row['correct_answers'] for row in by_skill.values())
    error_counts = Counter()
    for row in events:
        error_counts.update(row.errors)
    items = defaultdict(lambda: {'wrong_count': 0, 'answers': 0})
    for row in events:
        if row.item_id:
            key = (row.skill, row.item_type, row.item_id)
            items[key]['wrong_count'] += round((1 - row.score) * row.count)
            items[key]['answers'] += row.count
            items[key]['label'] = row.label or row.item_id
    wrong_items = [{'skill': key[0], 'item_type': key[1], 'item_id': key[2], **value} for key, value in items.items() if value['wrong_count']]
    # Aggregate legacy stats are useful context, but cannot be attributed to this period.
    return {'study_days': len({local_date(row.at) for row in activity}),
        'lessons': len({(row.source, row.key) for row in activity if row.completed}),
        'recorded_minutes': round(sum(row.seconds for row in activity) / 60, 1),
        'contains_estimated_time': any(row.estimated_time for row in activity),
        'answered': total, 'correct': correct, 'accuracy': round(100 * correct / total, 1) if total else None,
        'skills': by_skill, 'common_errors': [{'code': key, 'count': count} for key, count in error_counts.most_common(10)],
        'frequent_wrong_items': sorted(wrong_items, key=lambda row: (-row['wrong_count'], row['item_id']))[:10]}


def report(snapshot, period='week', anchor=None):
    start, nominal_end = period_bounds(period, anchor or snapshot.today)
    end = min(nominal_end, snapshot.today + timedelta(days=1))
    previous = previous_start(period, start)
    _, previous_nominal_end = period_bounds(period, previous)
    # A partial current period is compared with the same number of elapsed days.
    previous_end = min(previous_nominal_end, previous + (end - start)) if end < nominal_end else previous_nominal_end
    current, before = period_metrics(snapshot, start, end), period_metrics(snapshot, previous, previous_end)
    comparison_available = previous >= local_date(snapshot.since) and not snapshot.truncated
    delta = round(current['accuracy'] - before['accuracy'], 1) if comparison_available and current['accuracy'] is not None and before['accuracy'] is not None else None
    skill_deltas = {skill: round(current['skills'][skill]['accuracy'] - before['skills'][skill]['accuracy'], 1)
        if comparison_available and current['skills'][skill]['accuracy'] is not None and before['skills'][skill]['accuracy'] is not None else None for skill in policy.SKILLS}
    strong = [key for key, value in current['skills'].items() if value['evidence'] == 'sufficient' and (value['score'] or 0) >= 80]
    weak = [key for key, value in current['skills'].items() if value['evidence'] == 'sufficient' and (value['score'] or 0) < 60]
    narrative = 'insufficient' if not current['answered'] else 'baseline' if delta is None else 'improving' if delta >= 5 else 'needs_review' if delta <= -5 else 'steady'
    return {'period': period, 'start': start, 'end_exclusive': end, 'is_partial_period': end < nominal_end,
        'comparison': {'start': previous, 'end_exclusive': previous_end,
            'same_elapsed_days': end < nominal_end and (previous_end - previous) == (end - start),
            'available': comparison_available, 'accuracy_delta': delta, 'skill_deltas': skill_deltas,
            'lessons_delta': current['lessons'] - before['lessons'] if comparison_available else None},
        **current, 'strengths': strong, 'weaknesses': weak,
        'narrative': {'key': f'learning.summaries.{narrative}', 'params': {'lessons': current['lessons'], 'days': current['study_days'],
            'accuracy': current['accuracy'], 'delta': abs(delta) if delta is not None else None}},
        'recommendations': [{'key': 'learning.reportAdvice.review', 'params': {}}] if weak or current['frequent_wrong_items'] else [{'key': 'learning.reportAdvice.continue', 'params': {}}],
        'coverage': snapshot.coverage()}


def weekly_goals(snapshot):
    start, end = period_bounds('week', snapshot.today)
    metrics = period_metrics(snapshot, start, min(end, snapshot.today + timedelta(days=1)))
    days = snapshot.goal.study_days if snapshot.goal else policy.DEFAULT_WEEK_DAYS
    lessons = snapshot.goal.lessons if snapshot.goal else policy.DEFAULT_WEEK_LESSONS
    return {'study_days': days, 'lessons': lessons, 'week_start': start, 'week_end_exclusive': end,
        'completed_days': metrics['study_days'], 'completed_lessons': metrics['lessons'],
        'days_percent': min(100, round(100 * metrics['study_days'] / days)),
        'lessons_percent': min(100, round(100 * metrics['lessons'] / lessons))}


def practice_url(skill, level):
    return {'vocab': '/library', 'grammar': f'/grammar/practice?level={level}', 'kanji': f'/kanji?mode=study&level={level}',
            'listening': f'/listening?level={level}', 'conversation': '/chat', 'interview': '/interview'}.get(skill, '/placement')


def next_actions(snapshot):
    actions = []
    level = snapshot.user.current_jlpt_level if snapshot.user.current_jlpt_level in policy.LEVELS else 'N5'
    completed = any(row.task_date == snapshot.today and row.status == 'completed' for row in snapshot.tasks)
    if not completed:
        actions.append({'id': 'daily', 'reason': 'daily_pending', 'href': '/daily', 'params': {}})
    if snapshot.due:
        first = snapshot.due[0]
        skill = first.skill if first.skill in policy.SKILLS else 'grammar'
        actions.append({'id': 'review', 'reason': 'review_due', 'skill': skill,
                        'href': '/games?review=1' if getattr(first,'source',None)=='minigame' else practice_url(skill, first.jlpt_level if first.jlpt_level in policy.LEVELS else level),
                        'params': {'count': len(snapshot.due)}})
    values = skills(snapshot)
    known = sorted((key for key in policy.SKILLS if values[key]['evidence'] == 'sufficient'), key=lambda key: values[key]['score'])
    if known:
        key = known[0]
        actions.append({'id': 'weakest', 'reason': 'weakest_skill', 'skill': key, 'href': practice_url(key, level), 'params': {'score': values[key]['score']}})
    else:
        actions.append({'id': 'assessment', 'reason': 'collect_evidence', 'href': '/placement', 'params': {}})
    for key in policy.SKILLS:
        if len(actions) >= 3:
            break
        if not any(row.get('skill') == key for row in actions):
            actions.append({'id': f'practice_{key}', 'reason': 'build_skill', 'skill': key, 'href': practice_url(key, level), 'params': {}})
    return actions[:3]


def roadmap(snapshot):
    items = mastery_items(snapshot)
    global_skills = skills(snapshot)
    levels = []
    for level in policy.LEVELS:
        values = skills(snapshot, level)
        milestones = []
        for skill, item_type in (('kanji', 'kanji'), ('grammar', 'grammar_rule')):
            total = snapshot.catalog[level][skill]
            mastered = sum(row['mastered'] and row['level'] == level and row['item_type'] == item_type for row in items)
            mastered = min(mastered, total)
            milestones.append({'id': skill, 'current': mastered, 'target': total,
                'percent': round(100 * mastered / total) if total else None, 'available': bool(total),
                'complete': bool(total and mastered / total >= 0.7)})
        for skill in ('vocab', 'listening', 'conversation', 'interview'):
            value = global_skills[skill] if skill == 'interview' else values[skill]
            threshold = 75 if skill == 'vocab' else 70
            milestones.append({'id': skill, 'current': value['score'], 'target': threshold,
                'percent': min(100, round(100 * value['score'] / threshold)) if value['score'] is not None and value['evidence'] == 'sufficient' else None,
                'available': value['evidence'] == 'sufficient', 'complete': value['evidence'] == 'sufficient' and value['score'] >= threshold,
                'proxy': skill in ('conversation', 'interview'), 'level_unattributed': skill == 'interview'})
        tested = any(row.assessment_mode == 'confirmation' and row.selected_level == level and row.estimated_level == level
                     and row.confirmed_at and not (row.result or {}).get('is_demo') for row in snapshot.placements)
        milestones.append({'id': 'assessment', 'current': int(tested), 'target': 1, 'percent': 100 if tested else 0,
                           'available': True, 'complete': tested})
        pending = [row['id'] for row in milestones if not row['complete']]
        percentages = [row['percent'] for row in milestones]
        levels.append({'level': level, 'curriculum': snapshot.catalog[level], 'milestones': milestones,
            'completion_percent': round(sum(value or 0 for value in percentages) / len(percentages)),
            'current_milestone': pending[0] if pending else None, 'next_milestone': pending[1] if len(pending) > 1 else None,
            'ready_for_level_review': not pending and not snapshot.truncated,
            'automatic_promotion': False, 'catalog_complete': all(snapshot.catalog[level].values())})
    return {'current_level': snapshot.user.current_jlpt_level, 'levels': levels,
            'actions': next_actions(snapshot), 'coverage': snapshot.coverage(), 'official_jlpt': False}


def overview(snapshot):
    week_start, _ = period_bounds('week', snapshot.today)
    trend = []
    for index in range(7, -1, -1):
        start = week_start - timedelta(days=index * 7)
        value = period_metrics(snapshot, start, min(start + timedelta(days=7), snapshot.today + timedelta(days=1)))
        trend.append({'start': start, 'lessons': value['lessons'], 'study_days': value['study_days'], 'accuracy': value['accuracy']})
    return {'as_of': snapshot.now, 'current_level': snapshot.user.current_jlpt_level, 'skills': skills(snapshot),
        'weekly_goal': weekly_goals(snapshot), 'trend': trend, 'actions': next_actions(snapshot),
        'has_activity': bool(snapshot.activities), 'coverage': snapshot.coverage(),
        'roadmap': roadmap(snapshot),
        'legacy_wrong_items': [{'skill': row.item_type, 'item_id': row.item_id, 'wrong_count': row.wrong_count,
                               'attempts': row.attempts, 'dated': False} for row in sorted(snapshot.legacy_stats, key=lambda row: -row.wrong_count)[:10] if row.wrong_count]}


def export_progress(snapshot):
    return {'overview': overview(snapshot), 'roadmap': roadmap(snapshot),
            'weekly_report': report(snapshot, 'week'), 'monthly_report': report(snapshot, 'month')}
