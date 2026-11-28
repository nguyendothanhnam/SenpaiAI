import { Modal } from 'react-native'
import { router, usePathname } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/AuthProvider'
import { session } from '../../api/services'
import { KeyboardLayout, KeyboardScrollView } from '../KeyboardLayout'
import { AppText, Button, Card, Title } from '../ui'
import { useTheme } from '../../theme/ThemeProvider'

export function PlacementInvitation() {
  const { placementInvite, status } = useAuth(), { t } = useTranslation('placement'), { colors } = useTheme(), pathname = usePathname()
  const close = () => session.dismissPlacementInvite()
  return <Modal transparent visible={status === 'authenticated' && !!placementInvite && pathname !== '/placement'} onRequestClose={close} animationType="fade"><KeyboardLayout safeTop style={{ backgroundColor: colors.scrim }}><KeyboardScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}><Card>
    <Title>{t('title')}</Title><AppText>{t('invite')}</AppText>
    <Button title={t('start')} onPress={() => { close(); router.push('/placement') }} />
    <Button secondary title={t('skip')} onPress={close} />
  </Card></KeyboardScrollView></KeyboardLayout></Modal>
}
