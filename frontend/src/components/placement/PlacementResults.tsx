import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { PlacementAttempt } from '../../services/placement'

export function SkillBars({ scores }: { scores: Record<string, { score: number | null; correct: number; total: number }> }) {
  const { t } = useTranslation('placement')
  return <dl className="space-y-4">{['vocab', 'kanji', 'grammar', 'reading', 'listening'].map(skill => {
    const value = scores[skill]
    return <div key={skill}><div className="mb-1 flex items-center justify-between gap-3 text-sm"><dt>{t(`skills.${skill}`)}</dt><dd>{value?.score == null ? t('notTested') : t('score', { score: value.score, correct: value.correct, total: value.total })}</dd></div>
      <progress aria-label={t(`skills.${skill}`)} className="h-2 w-full accent-[color:var(--primary)]" value={value?.score || 0} max={100} />
    </div>
  })}</dl>
}

export default function PlacementResults({ attempt, busy, onConfirm, onRetake, onAdjacent }: {
  attempt: PlacementAttempt; busy: boolean; onConfirm: () => void; onRetake: () => void; onAdjacent: (level: string) => void
}) {
  const { t } = useTranslation('placement')
  const result = attempt.result
  if (!result) return null
  const legacy = attempt.assessment_mode === 'legacy'
  const estimate = legacy ? result.recommended_level : result.estimated_level
  const skills = (list: string[]) => list.length ? list.map(skill => t(`skills.${skill}`)).join(', ') : t('noPattern')
  return <div className="space-y-5">
    <section className="theme-card motion-reduce:transition-none space-y-6 p-6 sm:p-8" aria-labelledby="placement-result-title">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-sm font-semibold text-[color:var(--primary)]">{t('resultTitle')}</p><h2 id="placement-result-title" className="text-3xl font-bold">{estimate ? t('result', { level: estimate }) : t('insufficientEvidence')}</h2>
        {attempt.selected_level && <p className="mt-2 text-[color:var(--text-muted)]">{t('selectedLevelResult', { level: attempt.selected_level })}</p>}</div>
        {result.total_score != null && <div className="rounded-2xl bg-[color:var(--accent)] px-5 py-4 text-center"><p className="text-3xl font-bold text-[color:var(--primary)]">{result.total_score}<span className="text-base">/100</span></p><p className="mt-1 text-xs text-[color:var(--text-muted)]">{t('internalScore')}</p></div>}
      </div>
      {result.is_demo && <p className="rounded-xl bg-[color:var(--accent)] p-4 text-sm">{t('demoNotice')}</p>}
      <p className="text-sm text-[color:var(--text-muted)]">{t('ceiling', { level: result.estimated_up_to, ceiling: result.data_ceiling })}</p>
      <p className="text-sm">{t(legacy ? 'legacyResult' : estimate ? 'evidenceSufficient' : 'evidenceInsufficient')}</p>
      {result.stop_reason === 'expired' && <p className="font-semibold">{t('timeExpired')}</p>}
      <SkillBars scores={result.skill_scores} />
      <div className="grid gap-4 sm:grid-cols-2"><p><strong className="block">{t('strengths')}</strong><span className="text-[color:var(--text-muted)]">{skills(result.strengths)}</span></p><p><strong className="block">{t('weaknesses')}</strong><span className="text-[color:var(--text-muted)]">{skills(result.weaknesses)}</span></p></div>
      {result.outcome && !result.is_demo && <p className="rounded-xl border border-[color:var(--border)] p-4">{t(`outcomes.${result.outcome}`)}</p>}
      <div><h3 className="mb-2 font-semibold">{t('roadmapTitle')}</h3><p className="text-sm leading-relaxed text-[color:var(--text-muted)]">{t('roadmap', { level: estimate || 'N5', skills: skills(result.focus_skills) })}</p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm"><Link to={`/grammar/practice?level=${estimate || 'N5'}`} className="underline">{t('practiceGrammar')}</Link><Link to={`/kanji?mode=study&level=${estimate || 'N5'}`} className="underline">{t('practiceKanji')}</Link><Link to={`/listening?level=${estimate || 'N5'}`} className="underline">{t('skills.listening')}</Link></div>
      </div>
      <p className="text-sm text-[color:var(--text-muted)]">{t(estimate ? 'confirmationNote' : 'saveReferenceNote')}</p>
      <div className="flex flex-wrap gap-3"><button type="button" disabled={busy || Boolean(attempt.confirmed_at)} onClick={onConfirm} className="rounded-xl bg-[color:var(--primary)] px-5 py-3 font-semibold text-[color:var(--primary-contrast)] disabled:opacity-50">{t(attempt.confirmed_at ? 'confirmed' : estimate ? 'confirm' : 'saveReference')}</button>
        <button type="button" disabled={busy} onClick={onRetake} className="rounded-xl border border-[color:var(--border)] px-5 py-3 font-semibold">{t('retakeShort')}</button>
        {result.next_level && !result.is_demo && <button type="button" disabled={busy} onClick={() => onAdjacent(result.next_level!)} className="rounded-xl border border-[color:var(--border)] px-5 py-3">{t('tryLevel', { level: result.next_level })}</button>}
      </div>
    </section>
  </div>
}
