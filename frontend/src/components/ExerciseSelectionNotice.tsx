import { useTranslation } from 'react-i18next'
import type { ExerciseSelectionInfo } from '../services/api'

export default function ExerciseSelectionNotice({ selections }: { selections: (ExerciseSelectionInfo | undefined)[] }) {
  const { t } = useTranslation('common')
  const review = selections.some(item => item?.review_mode)
  const relaxed = selections.some(item => item?.cooldown_relaxed)
  const levels = [...new Set(selections.filter(item => item?.fallback).map(item => item!.actual_level))]
  if (!review && !levels.length) return null
  return <aside role="note" className="space-y-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] p-4 text-sm text-[color:var(--text-muted)] motion-reduce:transition-none">
    {review && <><p className="font-semibold text-[color:var(--text)]">{t('exerciseSelection.reviewTitle')}</p><p>{t(relaxed ? 'exerciseSelection.cooldownRelaxed' : 'exerciseSelection.reviewDescription')}</p></>}
    {levels.length > 0 && <p>{t('exerciseSelection.fallback', { level: levels.join(', ') })}</p>}
  </aside>
}
