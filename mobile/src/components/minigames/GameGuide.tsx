import { View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { Game } from '@games/types'
import { AppDialog } from '../AppDialog'
import { AppText, Muted } from '../ui'
export function GameGuide({ game, onClose, reduced = false }: { game: Game; onClose: () => void; reduced?: boolean }) {
  const { t } = useTranslation('common'), steps = [1, 2, 3].map(step => t(`gameGuides.${game}.steps.${step}`))
  return <AppDialog visible title={t(`minigames.games.${game}.name`)} message={t(`gameGuides.${game}.goal`)} primaryLabel={t('gameHelp.understood')} onConfirm={onClose} onClose={onClose} hideCancel reduced={reduced}>
    <AppText>{t('gameHelp.title')}</AppText>{Array.isArray(steps) && steps.map((step, index) => <View key={index} style={{ flexDirection: 'row', gap: 10 }}><AppText style={{ fontWeight: '700' }}>{index + 1}</AppText><View style={{ flex: 1 }}><AppText>{step}</AppText></View></View>)}<Muted>{t(`gameGuides.${game}.tip`)}</Muted>
  </AppDialog>
}
