import type { Game, Level } from '@games/types'
import { GameGuide } from '../components/minigames/GameGuide'
import { useCallback, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router, useFocusEffect } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { GAMES, LEVELS } from '@games/types'
import { availability } from '@games/availability'
import type { StatStore } from '@games/stats'
import { useAuth } from '../auth/AuthProvider'
import { gameStore } from '../features/minigames/native'
import { AppText, Card, ErrorNotice, Screen } from '../components/ui'
import { nativeThemes, useTheme } from '../theme/ThemeProvider'
import { colorAlpha, gradientColors, readableText } from '../theme/nativeStyle'

const GAME_ICONS: Record<Game, keyof typeof Ionicons.glyphMap> = {
  falling: 'text-outline', shiritori: 'link-outline', cipher: 'key-outline',
  memory: 'grid-outline', battle: 'shield-outline', workshop: 'construct-outline',
  wordsearch: 'search-outline', ninja: 'flash-outline', missing: 'brush-outline',
}
const FILTERS = ['all', 'N5', 'N4', 'N3'] as const
type Filter = typeof FILTERS[number]

export function MiniGamesScreen() {
  const { t, i18n } = useTranslation('common'), { t: m } = useTranslation('mobile'), { user } = useAuth()
  const { colors } = useTheme()
  const [guide, setGuide] = useState<Game>()
  const [filter, setFilter] = useState<Filter>('all')
  const [stats, setStats] = useState<StatStore>({ version: 1, entries: {} }), [error, setError] = useState(false)
  const load = useCallback(() => {
    let alive = true
    setStats({ version: 1, entries: {} })
    setError(false)
    if (user) void gameStore.read(String(user.id)).then(value => { if (alive) setStats(value) }).catch(() => { if (alive) setError(true) })
    return () => { alive = false }
  }, [user])
  useFocusEffect(load)
  const catalog = useMemo(() => GAMES.map(game => ({ game, levels: LEVELS.filter(level => availability(game, level).enabled) })), [])
  const games = catalog.filter(item => filter === 'all' || item.levels.includes(filter as Level))
  const primaryText = readableText(colors.primary, colors.primaryContrast, [colors.text, colors.bg])
  const secondaryText = readableText(colors.accent, colors.primary, [colors.text])
  // Reuse the existing amber stop of Classic's gradient for this semantic trophy
  // indicator; all navigation, level and action colors follow the active theme.
  const trophy = gradientColors(nativeThemes.classic.palettes.light.primaryGradient, colors.primary)[1]
  return <Screen>
    <View style={[layout.notice, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
      <AppText style={[layout.noticeText, { color: colors.textMuted }]}>{m('minigames.catalog.notice')}</AppText>
    </View>
    {error && <ErrorNotice message={m('minigames.storageError')} />}
    {guide && <GameGuide game={guide} onClose={() => setGuide(undefined)} />}
    <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false} accessibilityLabel={m('minigames.catalog.filterLabel')} contentContainerStyle={layout.filters}>
      {FILTERS.map(value => {
        const selected = filter === value
        return <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={value === 'all' ? m('minigames.catalog.all') : value} onPress={() => setFilter(value)} style={({ pressed }) => [layout.filter, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border, opacity: pressed ? 0.8 : 1 }]}>
          <AppText style={[layout.filterText, { color: selected ? primaryText : colors.textMuted }]}>{value === 'all' ? m('minigames.catalog.all') : value}</AppText>
        </Pressable>
      })}
    </ScrollView>
    {!games.length && <Card><AppText style={{ color: colors.textMuted }}>{m('minigames.catalog.empty')}</AppText></Card>}
    {games.map(({ game, levels }) => {
      const score = Math.max(0, ...Object.entries(stats.entries).filter(([key]) => key.startsWith(`${game}:`)).map(([, value]) => value.highScore))
      return <Card key={game} style={layout.card}>
        <View style={layout.heading}>
          <View style={layout.identity}>
            <View style={[layout.icon, { backgroundColor: colors.accent }]}><Ionicons name={GAME_ICONS[game]} size={23} color={secondaryText} /></View>
            <View style={layout.names}>
              <AppText accessibilityRole="header" style={layout.name}>{t(`minigames.games.${game}.name`)}</AppText>
              <AppText style={[layout.japanese, { color: colors.textMuted }]}>{m(`minigames.catalog.japanese.${game}`)}</AppText>
            </View>
          </View>
          <View accessible accessibilityLabel={t('minigames.highScore', { score })} style={[layout.record, { backgroundColor: score > 0 ? colorAlpha(trophy, 0.14) : colors.bgElevated, borderColor: score > 0 ? colorAlpha(trophy, 0.35) : colors.border }]}>
            <Ionicons name="trophy-outline" size={14} color={score > 0 ? trophy : colors.textMuted} />
            <View style={layout.recordText}>
              <AppText style={[layout.recordLabel, { color: colors.textMuted }]}>{m('minigames.catalog.record')}</AppText>
              <AppText numberOfLines={1} style={[layout.recordScore, { color: score > 0 ? readableText(colors.card, trophy, [colors.text]) : colors.textMuted }]}>{score.toLocaleString(i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN')}</AppText>
            </View>
          </View>
        </View>
        <AppText numberOfLines={2} accessibilityLabel={t(`minigames.games.${game}.description`)} style={[layout.description, { color: colors.textMuted }]}>{t(`minigames.games.${game}.description`)}</AppText>
        <View accessible accessibilityLabel={t('minigames.suggestLevels', { levels: levels.join(', ') })} style={layout.levels}>
          {levels.map(level => <View key={level} style={[layout.levelBadge, { backgroundColor: colors.accent }]}><AppText style={[layout.levelText, { color: secondaryText }]}>{level}</AppText></View>)}
          {!levels.length && <AppText style={[layout.levelText, { color: colors.textMuted }]}>{t('minigames.noLevels')}</AppText>}
        </View>
        <View style={layout.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${t('gameHelp.title')} · ${t(`minigames.games.${game}.name`)}`} onPress={() => setGuide(game)} style={({ pressed }) => [layout.action, { flex: 1, backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 }]}>
            <Ionicons name="help-circle-outline" size={17} color={secondaryText} />
            <AppText style={[layout.actionText, { color: secondaryText }]}>{t('gameHelp.title')}</AppText>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`${t('minigames.start')} · ${t(`minigames.games.${game}.name`)}`} onPress={() => router.push({ pathname: '/games/[game]', params: { game } })} style={({ pressed }) => [layout.action, { flex: 1.5, backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}>
            <Ionicons name="play" size={16} color={primaryText} />
            <AppText style={[layout.actionText, { color: primaryText }]}>{t('minigames.start')}</AppText>
          </Pressable>
        </View>
      </Card>
    })}
  </Screen>
}

const layout = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  filters: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  filter: { minHeight: 44, minWidth: 52, paddingHorizontal: 17, paddingVertical: 10, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  filterText: { fontSize: 13, lineHeight: 20, fontWeight: '600' },
  card: { padding: 14, gap: 12, borderRadius: 18 },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  identity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  names: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  japanese: { fontSize: 11, lineHeight: 16 },
  record: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '34%', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  recordText: { flexShrink: 1 },
  recordLabel: { fontSize: 10, lineHeight: 14 },
  recordScore: { fontSize: 12, lineHeight: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  description: { fontSize: 13, lineHeight: 20 },
  levels: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  levelBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 7 },
  levelText: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10 },
  action: { minHeight: 44, paddingHorizontal: 8, paddingVertical: 10, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  actionText: { flexShrink: 1, textAlign: 'center', fontSize: 12, lineHeight: 18, fontWeight: '600' },
})
