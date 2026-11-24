import { useTranslation } from 'react-i18next'
import type { DailyPayload } from '../api/types'
import { AppText, Card, Muted } from './ui'

export function ExerciseSelectionNotice({ selections }: { selections: DailyPayload['selection'][] }) {
  const { t } = useTranslation('common')
  const review = selections.some(item => item?.review_mode)
  const relaxed = selections.some(item => item?.cooldown_relaxed)
  const levels = [...new Set(selections.filter(item => item?.fallback).map(item => item!.actual_level))]
  if (!review && !levels.length) return null
  return <Card accessibilityLiveRegion="polite">
    {review && <><AppText>{t('exerciseSelection.reviewTitle')}</AppText><Muted>{t(relaxed ? 'exerciseSelection.cooldownRelaxed' : 'exerciseSelection.reviewDescription')}</Muted></>}
    {levels.length > 0 && <Muted>{t('exerciseSelection.fallback', { level: levels.join(', ') })}</Muted>}
  </Card>
}
