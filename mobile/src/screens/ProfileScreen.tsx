import { KeyboardInput as TextInput, KeyboardFlatList as FlatList, KeyboardLayout } from '../components/KeyboardLayout'
import { useState } from 'react'
import { View } from 'react-native'
import { useMutation, useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { router } from 'expo-router'
import { authAPI, dailyAPI, queryClient, rewardsAPI, session } from '../api/services'
import { personalAPI } from '../api/phase3'
import { useAuth } from '../auth/AuthProvider'
import { publishProfile } from '../auth/profile'
import { useTheme } from '../theme/ThemeProvider'
import { isValidUsername } from '../utils/validation'
import { formatServerDate } from '../utils/date'
import { AppText, Button, Card, ErrorNotice, Muted, Title, styles } from '../components/ui'
import { SkeletonList } from '../components/SkeletonList'
import { getErrorMessage } from '../utils/getErrorMessage'
import { PlacementProfile } from '../components/placement/PlacementProfile'

export function ProfileScreen() {
  const { user, logout } = useAuth(); const { t, i18n } = useTranslation('profile'); const { t: mobile } = useTranslation('mobile'); const { colors } = useTheme();
  const profile = useQuery(['profile', user?.id], authAPI.me, { enabled: !!user, onSuccess: data => session.updateUser(data) })
  const rewards = useQuery(['rewards', user?.id], rewardsAPI.me, { enabled: !!user })
  const history = useQuery(['daily-history', user?.id, 30], () => dailyAPI.history(30), { enabled: !!user })
  const [editing, setEditing] = useState(false); const [username, setUsername] = useState(''); const [target, setTarget] = useState(''); const [goals, setGoals] = useState(''); const [invalid, setInvalid] = useState(false)
  const current = user || profile.data
  const save = useMutation(() => personalAPI.update({ username: username.trim(), learning_goals: [...new Set([...goals.split('\n').map(g => g.trim()).filter(Boolean), ...(target ? [`JLPT ${target}`] : [])])] }), { onMutate: () => queryClient.cancelQueries(['profile', user?.id]), onSuccess: async data => { await publishProfile(queryClient, session, data); setEditing(false) } })
  const field = [styles.field, { color: colors.text, backgroundColor: colors.bgElevated, borderColor: colors.border }]
  return <KeyboardLayout style={{ flex: 1, backgroundColor: colors.screen }}><FlatList data={history.data || []} keyExtractor={d => d.date} contentContainerStyle={[styles.screen, { paddingBottom: 24 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" refreshing={profile.isRefetching || rewards.isRefetching || history.isRefetching} onRefresh={() => { void profile.refetch(); void rewards.refetch(); void history.refetch() }} ListHeaderComponent={<View style={{ gap: 18 }}>
    <Title>{t('title')}</Title>{profile.isLoading && <SkeletonList count={1} />}{profile.isError && <ErrorNotice message={getErrorMessage(profile.error, i18n)} retry={() => void profile.refetch()} />}
    {current && <Card><AppText selectable>{t('email')}: {current.email}</AppText>{editing ? <>
      <AppText>{t('username')}</AppText><TextInput value={username} onChangeText={setUsername} autoCapitalize="none" editable={!save.isLoading} accessibilityLabel={t('username')} style={field} />{invalid && <ErrorNotice message={i18n.t('validation.usernameInvalid', { ns: 'auth' })} />}
      <AppText>{t('currentLevel')}: {current?.current_jlpt_level}</AppText><Muted>{t('levelFromPlacement')}</Muted>
      <AppText>{mobile('phase3.targetLevel')}</AppText><View style={styles.row}>{['', 'N5', 'N4', 'N3', 'N2', 'N1'].map(l => <Button key={l} title={l || mobile('phase3.noTarget')} secondary={target !== l} disabled={save.isLoading} onPress={() => setTarget(l)} />)}</View>
      <AppText>{t('learningGoals')}</AppText><Muted>{mobile('phase3.goalsHint')}</Muted><TextInput multiline value={goals} onChangeText={setGoals} editable={!save.isLoading} accessibilityLabel={t('learningGoals')} style={[field, { minHeight: 100, textAlignVertical: 'top' }]} />
      {save.isError && <ErrorNotice message={getErrorMessage(save.error, i18n)} />}<Button title={mobile(save.isLoading ? 'loading' : 'phase2.save')} disabled={save.isLoading} onPress={() => { const valid = isValidUsername(username.trim()); setInvalid(!valid); if (valid) save.mutate() }} /><Button secondary title={mobile('phase2.cancel')} disabled={save.isLoading} onPress={() => setEditing(false)} />
    </> : <><Title>{current.username}</Title><AppText>{t('currentLevel')}: {current.current_jlpt_level}</AppText><AppText>{i18n.t('rewardPoints', { ns: 'nav' })}: {rewards.data?.points_balance ?? '—'}</AppText>{current.learning_goals.map((g, n) => <AppText selectable key={n}>{g}</AppText>)}<Muted>{t('memberSince')}: {new Date(current.created_at).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'vi-VN')}</Muted><Button secondary title={mobile('phase3.editProfile')} onPress={() => { setUsername(current.username); setTarget(current.learning_goals.find(g => /^JLPT N[1-5]$/.test(g))?.slice(-2) || ''); setGoals(current.learning_goals.filter(g => !/^JLPT N[1-5]$/.test(g)).join('\n')); setInvalid(false); setEditing(true); save.reset() }} /></>}</Card>}
    <Card><Title>{t('rewards')}</Title><Muted>{t('pointsExplanation')}</Muted>{rewards.isLoading && <SkeletonList count={1} />}{rewards.isError && <ErrorNotice message={getErrorMessage(rewards.error, i18n)} retry={() => void rewards.refetch()} />}{rewards.data && <><AppText>{t('pointsBalance')}: {rewards.data.points_balance}</AppText><AppText>{t('currentStreak')}: {rewards.data.current_streak}</AppText><AppText>{t('longestStreak')}: {rewards.data.longest_streak}</AppText></>}</Card>
    <Button secondary title={i18n.t('themeShop', { ns: 'settings' })} onPress={() => router.push('/theme-shop')} /><Button secondary title={i18n.t('settings', { ns: 'nav' })} onPress={() => router.push('/(tabs)/personal/settings')} /><Button secondary title={i18n.t('signOut', { ns: 'nav' })} onPress={() => void logout()} />
    <PlacementProfile />
    <Title>{mobile('phase3.recentHistory')}</Title>{history.isError && <ErrorNotice message={getErrorMessage(history.error, i18n)} retry={() => void history.refetch()} />}{history.isLoading && <SkeletonList count={1} />}{history.data?.length === 0 && <Muted>{t('calendarEmpty')}</Muted>}
  </View>} renderItem={({ item }) => <Card style={{ marginTop: 10 }}><AppText>{formatServerDate(item.date, i18n.language)}</AppText><AppText>{mobile('phase3.historyRow', { correct: item.correct_count, total: item.total_items, points: item.points_awarded })}</AppText></Card>} /></KeyboardLayout>
}
