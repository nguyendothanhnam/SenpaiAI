import { useEffect, useRef, useState } from 'react'
import { Switch, View } from 'react-native'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { remindersAPI, reminderTypes, type ReminderSettings } from '../api/reminders'
import { queryClient } from '../api/services'
import { mobileSettings, validateReminderSettings } from '../features/reminders/logic'
import { KeyboardInput } from '../components/KeyboardLayout'
import { AppText, Button, Card, ErrorNotice, Loading, Muted, Screen, Title, styles } from '../components/ui'
import { useTheme } from '../theme/ThemeProvider'
import { getErrorMessage } from '../utils/getErrorMessage'
import { formatTimestamp } from '../utils/date'
import { useLocalReminders } from '../features/reminders/LocalReminderProvider'
import { LocalReminderStatus } from '../components/LocalReminderStatus'

export function ReminderSettingsScreen() {
  const { t, i18n } = useTranslation('mobile')
  const { user } = useAuth()
  const local = useLocalReminders()
  const { colors } = useTheme()
  const settingsKey = ['mobile-reminders', user?.id, 'settings']
  const settings = useQuery(settingsKey, ({ signal }) => remindersAPI.settings(signal), { staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: false, refetchOnReconnect: false })
  const suggestion = useQuery(['mobile-reminders', user?.id, 'suggested'], ({ signal }) => remindersAPI.suggested(signal))
  const [values, setValues] = useState<ReminderSettings>()
  const [max, setMax] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<unknown>()
  const [validation, setValidation] = useState<string>()
  const [saved, setSaved] = useState(false)
  const lock = useRef(false)
  useEffect(() => {
    // Initialize once; reconnect/refetch must not erase an unfinished draft.
    if (settings.data && !settings.isFetching && !settings.isError && !values) { setValues(settings.data); setMax(String(settings.data.max_per_day)) }
  }, [settings.data, settings.isFetching, settings.isError, values])
  const patch = (value: Partial<ReminderSettings>) => { setSaved(false); setValidation(undefined); setValues(current => current ? { ...current, ...value } : current) }
  async function save() {
    if (!values || lock.current) return
    const payload = { ...mobileSettings(values), max_per_day: /^\d+$/.test(max) ? Number(max) : NaN }
    const invalid = validateReminderSettings(payload)
    setValidation(invalid); setSaved(false)
    if (invalid) return
    lock.current = true; setBusy(true); setFailure(undefined)
    try {
      const updated = await remindersAPI.save(payload)
      setValues(updated); setMax(String(updated.max_per_day)); queryClient.setQueryData(settingsKey, updated)
      await local.refresh(updated)
      void queryClient.invalidateQueries(['mobile-reminders', user?.id, 'suggested'])
      setSaved(true)
    } catch (error) { setFailure(error) }
    finally { lock.current = false; setBusy(false) }
  }
  if (!values) return settings.isError ? <Screen><ErrorNotice message={getErrorMessage(settings.error, i18n)} retry={() => void settings.refetch()} /></Screen> : <Loading />
  function field(label: string, value: string, onChangeText: (text: string) => void, numeric = false) {
    return <View style={{ gap: 6 }}><AppText>{t(`reminders.${label}`)}</AppText><KeyboardInput accessibilityLabel={t(`reminders.${label}`)} editable={!busy} value={value} onChangeText={onChangeText} keyboardType={numeric ? 'number-pad' : 'default'} autoCapitalize="none" autoCorrect={false} style={[styles.field, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} /></View>
  }
  function toggle(label: string, selected: boolean, onValueChange: (enabled: boolean) => void) {
    return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><AppText style={{ flex: 1 }}>{label}</AppText><Switch accessibilityLabel={label} disabled={busy} value={selected} onValueChange={onValueChange} trackColor={{ false: colors.border, true: colors.primary }} /></View>
  }
  return <Screen>
    <Title>{t('reminders.title')}</Title><Muted>{t('reminders.description')}</Muted>
    <Card>
      {toggle(t('reminders.enabled'), values.enabled, enabled => { patch({ enabled }); if (enabled) void local.enable() })}
      {field('time', values.reminder_time, reminder_time => patch({ reminder_time }))}
      {field('timezone', values.timezone, timezone => patch({ timezone }))}
      <Muted>{t('reminders.timezoneHelp')}</Muted>
      <AppText>{t('reminders.days')}</AppText>
      {/* Python weekday(): Monday=0, Sunday=6. Do not copy the web's shifted indices. */}
      {Array.from({ length: 7 }, (_, day) => <View key={day}>{toggle(t(`reminders.weekdays.${day}`), values.days_of_week.includes(day), selected => patch({ days_of_week: selected ? [...values.days_of_week, day].sort() : values.days_of_week.filter(value => value !== day) }))}</View>)}
      <AppText>{t('reminders.types')}</AppText>
      {reminderTypes.map(type => <View key={type} style={{ gap: 4 }}>{toggle(t(`reminders.kinds.${type}.title`), values.types.includes(type), selected => patch({ types: selected ? [...values.types, type] : values.types.filter(value => value !== type) }))}<Muted>{t(`reminders.kinds.${type}.description`)}</Muted></View>)}
      {field('quietStart', values.quiet_start, quiet_start => patch({ quiet_start }))}
      {field('quietEnd', values.quiet_end, quiet_end => patch({ quiet_end }))}
      <Muted>{t('reminders.quietHelp')}</Muted>
      {field('max', max, value => { setMax(value); setSaved(false); setValidation(undefined) }, true)}
      {values.snooze_until && <Muted>{t('reminders.snoozed', { time: formatTimestamp(values.snooze_until, i18n.resolvedLanguage ?? 'vi') })}</Muted>}
      {validation && <ErrorNotice message={t(`reminders.${validation}`)} />}
      {!!failure && <ErrorNotice message={getErrorMessage(failure, i18n)} />}
      {saved && <AppText accessibilityLiveRegion="polite">{t('reminders.saved')}</AppText>}
      <Button title={t(busy ? 'reminders.saving' : 'reminders.save')} disabled={busy} onPress={() => void save()} />
    </Card>
    <Card><Title>{t('reminders.suggested')}</Title>
      {suggestion.isLoading && <Muted>{t('loading')}</Muted>}
      {suggestion.isError && <ErrorNotice message={getErrorMessage(suggestion.error, i18n)} retry={() => void suggestion.refetch()} />}
      {!suggestion.isLoading && !suggestion.isError && (suggestion.data?.suggested_time ? <>
        <AppText>{t('reminders.suggestion', { time: suggestion.data.suggested_time, count: suggestion.data.sample_count, timezone: suggestion.data.timezone })}</AppText>
        <Button secondary title={t('reminders.apply')} disabled={busy} onPress={() => patch({ reminder_time: suggestion.data!.suggested_time! })} />
        <Muted>{t('reminders.applyHelp')}</Muted>
      </> : <Muted>{t('reminders.noSuggestion')}</Muted>)}
    </Card>
    <LocalReminderStatus />
  </Screen>
}
