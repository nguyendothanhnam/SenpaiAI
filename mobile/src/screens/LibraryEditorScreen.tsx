import { useEffect, useRef, useState } from 'react'
import { Alert, TextInput, View } from 'react-native'
import { router, useLocalSearchParams, usePreventRemove } from 'expo-router'
import { useMutation, useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { libraryAPI, queryClient } from '../api/services'
import { useAuth } from '../auth/AuthProvider'
import { useTheme } from '../theme/ThemeProvider'
import { DOCUMENT_TYPES, JLPT_LEVELS, documentPayload, documentPermissions, emptyDocument, libraryLimitError, safeHttpUrl, validateDocument, type DocumentForm } from '../features/library/logic'
import { getErrorMessage } from '../utils/getErrorMessage'
import { AppText, Button, Card, ErrorNotice, Loading, Muted, Screen, Title, styles } from '../components/ui'
import { ChoiceSheet } from '../components/ChoiceSheet'

export function LibraryEditorScreen() {
  const { id: parameter } = useLocalSearchParams<{ id?: string }>()
  const id = parameter ? Number(parameter) : undefined
  const editing = id !== undefined
  const validId = id !== undefined && Number.isInteger(id) && id > 0
  const { user } = useAuth()
  const { colors } = useTheme()
  const { t, i18n } = useTranslation('common')
  const { t: mobile } = useTranslation('mobile')
  const [form, setForm] = useState<DocumentForm>(emptyDocument)
  const [initial, setInitial] = useState<DocumentForm>(emptyDocument)
  const [errors, setErrors] = useState<Partial<Record<keyof DocumentForm, string>>>({})
  const [picker, setPicker] = useState<'type' | 'level' | null>(null)
  const [allowLeave, setAllowLeave] = useState(false)
  const [imported, setImported] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const initialized = useRef<number | null>(null)
  const savingLock = useRef(false)
  const original = useQuery(['library', user?.id, 'original', id], () => libraryAPI.document(id!), { enabled: !!user && validId, retry: false })
  useEffect(() => {
    const document = original.data
    if (!document || initialized.current === document.id) return
    const values = { title: document.title, content: document.content, document_type: document.document_type, jlpt_level: document.jlpt_level ?? '', tags: document.tags.join(', '), source_url: document.source_url ?? '' }
    initialized.current = document.id
    setForm(values); setInitial(values)
  }, [original.data])
  const dirty = JSON.stringify(initial) !== JSON.stringify(form)
  const save = useMutation(async () => {
    if (editing) {
      if (!validId || !documentPermissions(await libraryAPI.document(id!)).edit) throw new Error('permission-denied')
      return libraryAPI.update(id!, documentPayload(form))
    }
    return libraryAPI.create(documentPayload(form))
  }, {
    retry: false,
    onSuccess: (document) => {
      setAllowLeave(true)
      disablePrevention()
      void queryClient.invalidateQueries(['library', user?.id])
      Alert.alert(t(document.indexing_warning ? 'library.indexingWarning' : editing ? 'library.documentUpdated' : 'library.documentAdded'))
      router.replace({ pathname: '/library-document/[id]', params: { id: String(document.id) } })
    },
    onError: (error) => {
      if (!editing && !(error as { response?: unknown })?.response) setUncertain(true)
    },
    onSettled: () => { savingLock.current = false },
  })
  const importedPage = useMutation(libraryAPI.fetchUrl, {
    retry: false,
    onSuccess: (page) => { setForm((current) => ({ ...current, title: current.title.trim() ? current.title : page.title, content: page.content })); setImported(true); setErrors({}) },
  })
  const disablePrevention = usePreventRemove(!!user && (dirty || save.isLoading || importedPage.isLoading) && !allowLeave, ({ repeat }) => {
    if (save.isLoading || importedPage.isLoading) { Alert.alert(t(save.isLoading ? 'library.saving' : 'library.fetching')); return }
    Alert.alert(mobile('phase1.library.unsavedTitle'), mobile('phase1.library.unsavedHint'), [
      { text: mobile('phase1.library.keepEditing'), style: 'cancel' }, { text: mobile('phase1.library.discard'), style: 'destructive', onPress: () => { setAllowLeave(true); repeat() } },
    ])
  })
  if (editing && original.isLoading) return <Loading />
  if (editing && (original.isError || !validId || !original.data || !documentPermissions(original.data).edit)) return <Screen><ErrorNotice message={original.isError ? getErrorMessage(original.error, i18n) : mobile('phase1.library.permissionDenied')} /><Button title={t('library.close')} onPress={() => router.back()} /></Screen>
  const busy = save.isLoading || importedPage.isLoading
  const change = (key: keyof DocumentForm, value: string) => { setForm((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: undefined })) }
  const importUrl = () => {
    if (!safeHttpUrl(form.source_url.trim())) { setErrors((current) => ({ ...current, source_url: 'common:library.validation.sourceUrlInvalid' })); return }
    const run = () => importedPage.mutate(form.source_url.trim())
    if (form.content.trim()) Alert.alert(mobile('phase1.library.importConfirmTitle'), t('library.replaceContentConfirm'), [{ text: t('library.cancel'), style: 'cancel' }, { text: mobile('phase1.library.importConfirmAction'), onPress: run }])
    else run()
  }
  const submit = () => {
    if (savingLock.current || busy || uncertain) return
    const nextErrors = validateDocument(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    savingLock.current = true
    save.mutate()
  }
  const fields = ['title', 'tags', 'source_url', 'content'] as const
  const labels = { title: 'library.fields.title', tags: 'library.fields.tags', source_url: 'library.fields.sourceUrl', content: 'library.fields.content' }
  return <Screen>
    <Title>{t(editing ? 'library.editDocument' : 'library.addNewDocument')}</Title>
    <Muted>{editing ? mobile('phase1.library.originalEditing') : mobile('phase1.library.privacyNotice')}</Muted>
    <Card>
      <View style={styles.row}><Button secondary disabled={busy} title={t(`library.documentTypes.${form.document_type}`)} onPress={() => setPicker('type')} /><Button secondary disabled={busy} title={form.jlpt_level || t('library.noLevel')} onPress={() => setPicker('level')} /></View>
      {fields.map((field) => <View key={field} style={{ gap: 8 }}>
        <AppText>{t(labels[field])}</AppText>
        <TextInput accessibilityLabel={t(labels[field])} value={form[field]} onChangeText={(value) => change(field, value)} editable={!busy && !uncertain} multiline={field === 'content'} scrollEnabled={field === 'content'} textAlignVertical="top" autoCapitalize={field === 'source_url' ? 'none' : 'sentences'} autoCorrect={false} keyboardType={field === 'source_url' ? 'url' : 'default'} style={[styles.field, { color: colors.text, backgroundColor: colors.bgElevated, borderColor: colors.border }, field === 'content' ? { minHeight: 300, maxHeight: 460, lineHeight: 26 } : {}]} />
        {errors[field] && <AppText accessibilityRole="alert">{i18n.t(errors[field]!)}</AppText>}
        {field === 'source_url' && <Button secondary title={t(importedPage.isLoading ? 'library.fetching' : 'library.fetchFromUrl')} disabled={busy || uncertain} onPress={importUrl} />}
      </View>)}
      <Muted>{t('library.contentCharacterCount', { count: form.content.length })}</Muted>
      {imported && <Muted>{mobile('phase1.library.importPreview')}</Muted>}
      {importedPage.isError && <ErrorNotice message={getErrorMessage(importedPage.error, i18n)} />}
      {save.isError && <ErrorNotice message={uncertain ? mobile('phase1.library.saveUncertain') : (save.error as Error)?.message === 'permission-denied' ? mobile('phase1.library.permissionDenied') : libraryLimitError(save.error) ? t('library.limitError') : getErrorMessage(save.error, i18n)} />}
      {uncertain ? <Button title={mobile('phase1.library.checkList')} onPress={() => { setAllowLeave(true); disablePrevention(); router.replace('/(tabs)/library') }} /> : <Button title={t(save.isLoading ? 'library.saving' : editing ? 'library.saveChanges' : 'library.addDocument')} disabled={busy} onPress={submit} />}
      <Button secondary title={t('library.cancel')} disabled={busy} onPress={() => router.back()} />
    </Card>
    <ChoiceSheet title={t(picker === 'type' ? 'library.fields.documentType' : 'library.fields.jlptLevel')} visible={picker !== null} value={picker === 'type' ? form.document_type : form.jlpt_level} options={picker === 'type' ? DOCUMENT_TYPES.map((value) => ({ value, label: t(`library.documentTypes.${value}`) })) : [{ value: '', label: t('library.noLevel') }, ...JLPT_LEVELS.map((value) => ({ value, label: value }))]} onClose={() => setPicker(null)} onSelect={(value) => change(picker === 'type' ? 'document_type' : 'jlpt_level', value)} />
  </Screen>
}
