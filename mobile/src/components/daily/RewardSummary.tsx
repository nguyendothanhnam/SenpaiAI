import { useTranslation } from 'react-i18next'
import { AppText, Card, Title } from '../ui'
import type { DailyOverview, DailyCompletion } from '../../api/types'

export function RewardSummary({ reward, balance }: { reward: NonNullable<DailyOverview['reward']> | DailyCompletion; balance?: number }) {
  const { t } = useTranslation('common')
  const { t: mobile } = useTranslation('mobile')
  const b = reward.breakdown
  const rows = [[t('daily.basePoints'), b.base_points], [t('daily.correctPoints'), b.correct_points], [t('daily.perfectBonus'), b.perfect_bonus], [t('daily.streakBonus'), b.streak_bonus], [mobile('phase1.daily.milestone'), b.streak_milestone_bonus]] as const
  return <Card><Title>{t('daily.pointsAwarded', { count: reward.points_awarded })}</Title><AppText>{t('daily.streak', { count: reward.streak })}</AppText>{rows.map(([label, value]) => <AppText key={label}>{label}: {value}</AppText>)}<AppText style={{ fontWeight: '700' }}>{t('daily.balance')}: {balance ?? '—'}</AppText></Card>
}
