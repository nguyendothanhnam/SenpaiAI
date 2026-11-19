import { Linking } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useLocalReminders } from '../features/reminders/LocalReminderProvider'
import { AppText, Button, Card, ErrorNotice, Muted, Title } from './ui'

export function LocalReminderStatus() {
  const { t } = useTranslation('mobile')
  const local = useLocalReminders()
  return <Card><Title>{t('localReminders.title')}</Title>
    <AppText>{t(`localReminders.permission.${local.optedIn || local.permission === 'unsupported' ? local.permission : 'off'}`)}</AppText>
    {local.permission === 'provisional' && local.optedIn && <Muted>{t('localReminders.provisionalHelp')}</Muted>}
    <Muted>{t(`localReminders.schedule.${local.state.status}`, { count: local.state.count })}</Muted>
    {local.permission !== 'unsupported' && (!local.optedIn || !['granted', 'provisional'].includes(local.permission)) && <Button title={t(local.requesting ? 'localReminders.requesting' : 'localReminders.enable')} disabled={local.requesting} onPress={() => void local.enable()} />}
    {(local.permission === 'denied' || local.permission === 'provisional') && <><Muted>{t('localReminders.settingsHelp')}</Muted><Button secondary title={t('localReminders.openSettings')} onPress={() => void Linking.openSettings().catch(() => local.refresh())} /></>}
    <Button secondary title={t('localReminders.refresh')} disabled={local.requesting || local.state.status === 'syncing'} onPress={() => void local.refresh()} />
    {(local.failed || local.state.status === 'error') && <ErrorNotice message={t('localReminders.error')} retry={() => void local.refresh()} />}
    <Muted>{t('localReminders.deliveryHelp')}</Muted>
  </Card>
}
