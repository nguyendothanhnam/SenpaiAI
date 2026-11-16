import type { Game } from '@games/types'
import { GameGuide } from '../components/minigames/GameGuide'
import { useCallback, useState } from 'react'
import { router, useFocusEffect } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { GAMES, LEVELS } from '@games/types'
import { availability } from '@games/availability'
import type { StatStore } from '@games/stats'
import { useAuth } from '../auth/AuthProvider'
import { gameStore } from '../features/minigames/native'
import { Button, Card, ErrorNotice, Muted, Screen, Title } from '../components/ui'

export function MiniGamesScreen() {
  const { t } = useTranslation('common'), { t: m } = useTranslation('mobile'), { user } = useAuth()
  const [guide, setGuide] = useState<Game>()
  const [stats, setStats] = useState<StatStore>({ version: 1, entries: {} }), [error, setError] = useState(false)
  const load = useCallback(() => {
    let alive = true
    setStats({ version: 1, entries: {} })
    setError(false)
    if (user) void gameStore.read(String(user.id)).then(value => { if (alive) setStats(value) }).catch(() => { if (alive) setError(true) })
    return () => { alive = false }
  }, [user])
  useFocusEffect(load)
  return <Screen><Title>{t('minigames.title')}</Title><Muted>{t('minigames.localNotice')}</Muted>
    {error && <ErrorNotice message={m('minigames.storageError')} />}
    {guide && <GameGuide game={guide} onClose={() => setGuide(undefined)} />}
    {GAMES.map(game => <Card key={game}>
      <Title>{t(`minigames.games.${game}.name`)}</Title><Muted>{t(`minigames.games.${game}.description`)}</Muted>
      <Muted>{t('minigames.suggestLevels', { levels: LEVELS.filter(level => availability(game, level).enabled).join(', ') })}</Muted>
      <Muted>{t('minigames.highScore', { score: Math.max(0, ...Object.entries(stats.entries).filter(([key]) => key.startsWith(`${game}:`)).map(([, value]) => value.highScore)) })}</Muted>
      <Button secondary title={t('gameHelp.title')} onPress={() => setGuide(game)} />
      <Button title={t('minigames.start')} onPress={() => router.push({ pathname: '/games/[game]', params: { game } })} />
    </Card>)}
  </Screen>
}
