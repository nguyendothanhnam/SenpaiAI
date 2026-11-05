import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'expo-router'
import { authAPI, rewardsAPI, session } from '../api/services'
import { useAuth } from '../auth/AuthProvider'
import { AppText, Button, Card, ErrorNotice, Muted, Screen, Title } from '../components/ui'
import { getErrorMessage } from '../utils/getErrorMessage'

export function ProfileScreen() {
  const { user, logout } = useAuth()
  const { t, i18n } = useTranslation('profile')
  const { t: mobile } = useTranslation('mobile')
  const profile = useQuery(['profile', user?.id], authAPI.me, { enabled: !!user, onSuccess: (data) => session.updateUser(data) })
  const rewards = useQuery(['rewards', user?.id], rewardsAPI.me, { enabled: !!user })
  const current = profile.data ?? user
  return <Screen refreshing={profile.isFetching || rewards.isFetching} onRefresh={() => { void profile.refetch(); void rewards.refetch() }}>
    <Title>{t('title')}</Title>
    {profile.isError && <ErrorNotice message={getErrorMessage(profile.error, i18n)} retry={() => void profile.refetch()} />}
    {current && <Card>
      <AppText>{t('username')}: {current.username}</AppText>
      <AppText selectable>{t('email')}: {current.email}</AppText>
      <AppText>{t('currentLevel')}: {current.current_jlpt_level}</AppText>
      <AppText>{i18n.t('exercisePoints', { ns: 'nav' })}: {current.exercise_points ?? 0}</AppText>
      <Muted>{t('memberSince')}: {new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-US' : 'vi-VN', { dateStyle: 'medium' }).format(new Date(current.created_at))}</Muted>
    </Card>}
    <Card>
      <Title>{t('rewards')}</Title>
      {rewards.isLoading && <AppText>{mobile('loading')}</AppText>}
      {rewards.isError && <ErrorNotice message={`${mobile('rewardsUnavailable')} ${getErrorMessage(rewards.error, i18n)}`} retry={() => void rewards.refetch()} />}
      {rewards.data && <>
        <AppText>{t('pointsBalance')}: {rewards.data.points_balance}</AppText>
        <AppText>{t('currentStreak')}: {rewards.data.current_streak}</AppText>
        <AppText>{t('longestStreak')}: {rewards.data.longest_streak}</AppText>
      </>}
    </Card>
    <Link href="/(tabs)/personal/settings" asChild><AppText accessibilityRole="link" style={{ padding: 12 }}>{i18n.t('settings', { ns: 'nav' })} →</AppText></Link>
    <Button secondary title={i18n.t('signOut', { ns: 'nav' })} onPress={() => void logout()} />
  </Screen>
}
