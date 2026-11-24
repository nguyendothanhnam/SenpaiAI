"""Internal raw scores and evidence rules; no IRT or official JLPT score conversion."""
from ..core import placement_config as policy


def score_assessment(mode, selected_level, levels, items, reason):
    skill_scores = {}
    evidence = {}
    answered = [item for item in items if item["answer"] is not None]
    for skill in policy.SKILLS:
        rows = [item for item in items if item["snapshot"]["skill"] == skill]
        correct = sum(item["correct"] is True for item in rows)
        skill_scores[skill] = {"total": len(rows), "correct": correct,
                               "score": round(100 * correct / len(rows)) if rows else None}
    for level in levels:
        evidence[level] = {}
        for skill in policy.SKILLS:
            rows = [item for item in answered if item["snapshot"]["level"] == level and item["snapshot"]["skill"] == skill]
            evidence[level][skill] = {"total": len(rows), "correct": sum(item["correct"] is True for item in rows)}
    scores = [value["score"] for value in skill_scores.values() if value["score"] is not None]
    total_score = round(sum(scores) / len(policy.SKILLS), 1) if scores else 0.0
    measured = [level for level in levels if any(item["snapshot"]["level"] == level for item in answered)]
    estimated, outcome, next_level = None, "insufficient", None
    enough_count = len(answered) >= (policy.MAX_QUESTIONS if mode == "confirmation" else policy.MIN_QUESTIONS)
    if enough_count and all(value["total"] >= policy.MIN_EVIDENCE_PER_SKILL for value in skill_scores.values()):
        if mode == "confirmation":
            values = [value["score"] or 0 for value in skill_scores.values()]
            if total_score >= policy.CONFIRM_TOTAL_MIN and min(values) >= policy.CONFIRM_SKILL_MIN:
                estimated = selected_level
                outcome = "suitable"
                if total_score >= policy.HIGH_TOTAL_MIN and min(values) >= policy.HIGH_SKILL_MIN:
                    outcome = "strong"
                    rank = policy.LEVELS.index(selected_level)
                    next_level = policy.LEVELS[rank + 1] if rank < len(policy.LEVELS) - 1 else None
            else:
                outcome = "try_lower"
                rank = policy.LEVELS.index(selected_level)
                next_level = policy.LEVELS[rank - 1] if rank else None
        else:
            for level in levels:
                counts = evidence[level]
                if not all(value["total"] >= policy.MIN_EVIDENCE_PER_SKILL for value in counts.values()):
                    continue
                percentages = [100 * value["correct"] / value["total"] for value in counts.values()]
                if min(percentages) >= policy.ADAPTIVE_SKILL_MIN and sum(percentages) / len(percentages) >= policy.ADAPTIVE_TOTAL_MIN:
                    estimated = level
                    outcome = "suitable"
    # Demo content measures the flow, not a verified profile level.
    demo = any(item["snapshot"].get("is_demo") for item in items)
    suggested = estimated
    if demo:
        estimated, outcome = None, "demo"
    strengths = [skill for skill, value in skill_scores.items() if value["score"] is not None and value["score"] >= 80]
    weaknesses = [skill for skill, value in skill_scores.items() if value["score"] is not None and value["score"] < 60]
    focus = weaknesses or sorted(policy.SKILLS, key=lambda skill: skill_scores[skill]["score"] if skill_scores[skill]["score"] is not None else -1)[:1]
    return dict(recommended_level=estimated or "N5", estimated_level=estimated, selected_level=selected_level,
                suggested_level=suggested, estimated_up_to=measured[-1] if measured else levels[0], data_ceiling=levels[-1],
                total_score=total_score, skill_scores=skill_scores, evidence=evidence, strengths=strengths,
                weaknesses=weaknesses, focus_skills=focus, foundation_needed=total_score < 60,
                is_estimate=True, is_demo=demo, evidence_status="sufficient" if estimated else "insufficient",
                outcome=outcome, next_level=next_level, stop_reason=reason,
                scoring_version=policy.SCORING_VERSION, estimation_version=policy.ESTIMATION_VERSION)
