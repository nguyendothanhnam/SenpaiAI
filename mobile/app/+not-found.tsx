import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Button, Screen, Title } from '../src/components/ui'

export default function NotFound() {
  const { t } = useTranslation('mobile')
  return <Screen><Title>{t('notFound')}</Title><Button title={t('home')} onPress={() => router.replace('/')} /></Screen>
}
