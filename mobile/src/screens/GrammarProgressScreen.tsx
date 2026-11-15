import { FlatList, View } from 'react-native'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { grammarAPI } from '../api/phase2'
import { useAuth } from '../auth/AuthProvider'
import { AppText, Card, ErrorNotice, Loading, Title, styles } from '../components/ui'
import { useTheme } from '../theme/ThemeProvider'
import { getErrorMessage } from '../utils/getErrorMessage'

export function GrammarProgressScreen() {
  const { user } = useAuth(); const { t, i18n } = useTranslation('mobile'); const { colors } = useTheme()
  const query = useQuery(['grammar-stats', user?.id], grammarAPI.stats)
  if (query.isLoading) return <Loading />
  return <FlatList style={{ backgroundColor: colors.screen }} contentContainerStyle={styles.screen} data={query.data?.activity_7_days || []} keyExtractor={r => r.date} refreshing={query.isRefetching} onRefresh={() => void query.refetch()} ListHeaderComponent={<View style={{ gap: 16 }}><Title>{t('phase2.progress')}</Title>{query.isError && <ErrorNotice message={getErrorMessage(query.error, i18n)} retry={() => void query.refetch()} />}{Object.entries(query.data?.by_jlpt || {}).map(([level, value]) => <Card key={level}><Title>{level}</Title><AppText>{Math.round(value.accuracy * 100)}% · {value.correct}/{value.total}</AppText></Card>)}<Title>{t('phase2.weakPatterns')}</Title>{query.data?.weak_patterns.map(p => <AppText key={p.grammar_rule_id}>{p.rule_name} · {Math.round(p.accuracy * 100)}%</AppText>)}<Title>{t('phase2.activity')}</Title></View>} renderItem={({ item }) => <Card><AppText>{new Date(`${item.date}T12:00:00`).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'vi-VN')}</AppText><AppText>{item.correct}/{item.total}</AppText></Card>} />
}
