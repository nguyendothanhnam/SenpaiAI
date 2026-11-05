import { useTranslation } from 'react-i18next'
import { Muted, Screen, Title } from '../components/ui'

export function PlaceholderScreen({ titleKey, practice = false }: { titleKey: string; practice?: boolean }) {
  const { t } = useTranslation()
  return <Screen><Title>{t(titleKey)}</Title>{practice && <Muted>{t('mobile:practiceHint')}</Muted>}<Muted>{t('mobile:comingSoon')}</Muted></Screen>
}
