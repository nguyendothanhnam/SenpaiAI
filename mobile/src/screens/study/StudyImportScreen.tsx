import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import { File, Paths } from 'expo-file-system'
import { useTranslation } from 'react-i18next'
import { AppText, Button, Card, Loading, Muted, Screen, Title, styles } from '../../components/ui'
import { importStudyFile } from '../../api/studyImport'
import { importIssues } from '../../features/study/importErrors'
import { newSet, type StudySet } from '../../features/study/types'
import { StudyError, parseQuizJson, validateFile, validateManual } from '../../features/study/validation'
import { studyStore, useStudy } from '../../features/study/useStudy'
import { Field, Issues, StorageNotice, StudyList, useLeaveGuard, useWork } from './shared'

export function StudyImportScreen() {
  const { kind } = useLocalSearchParams<{ kind?: string }>(), library = useStudy()
  if (library.query.isLoading) return <Loading />
  if (!library.writable || (kind !== 'quiz' && kind !== 'flashcard')) return <Screen><StorageNotice library={library} /></Screen>
  return <ImportForm key={`${library.account}:${kind}`} kind={kind} library={library} />
}
function ImportForm({ kind, library }: { kind: 'quiz' | 'flashcard'; library: ReturnType<typeof useStudy> }) {
  const { t } = useTranslation('mobile'), work = useWork()
  const [preview, setPreview] = useState<StudySet>(), [name, setName] = useState(''), [json, setJson] = useState(''), [saved, setSaved] = useState(false)
  const controller = useRef<AbortController | null>(null), alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort() } }, [])
  const disableGuard = useLeaveGuard((!!preview || !!json.trim()) && !saved, work.busy && !saved)
  function show(questions: StudySet['questions'], cards: StudySet['cards'], fileName: string) {
    if (!alive.current) return
    const items = kind === 'quiz' ? questions : cards
    const levels = [...new Set(items.map(item => item.jlpt_level).filter(Boolean))], categories = [...new Set(items.map(item => item.category).filter(Boolean))]
    setPreview({ ...newSet(kind), source: 'imported', file_name: fileName, questions, cards, jlpt_level: levels.length === 1 ? levels[0]! : '', category: categories.length === 1 ? categories[0]! : '' })
    if (fileName) setName(fileName.replace(/\.[^.]+$/, '').slice(0, 120))
  }
  async function pick() {
    let cached: File | undefined
    try {
      // Wildcard lets cloud providers with inaccurate MIME labels expose Excel;
      // validate the extension and actual cache size before reading or posting.
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true })
      if (result.canceled || !alive.current) return
      const asset = result.assets[0]
      cached = new File(asset.uri)
      const size = cached.exists ? cached.size : asset.size
      validateFile(asset.name, size, kind)
      if (!cached.exists) throw new StudyError('fileRead')
      if (kind === 'quiz' && asset.name.toLowerCase().endsWith('.json')) show(parseQuizJson(await cached.text()), [], asset.name)
      else {
        controller.current = new AbortController()
        const data = await importStudyFile(kind, { ...asset, size: size! }, controller.current.signal)
        show(data.questions, data.cards, asset.name)
      }
    } catch (error) {
      if (error instanceof StudyError || (error && typeof error === 'object' && ('response' in error || 'isAxiosError' in error))) throw error
      throw new StudyError('fileRead')
    } finally {
      controller.current = null
      if (cached?.uri.startsWith(Paths.cache.uri)) { try { cached.delete() } catch { /* OS also reclaims its cache. */ } }
    }
  }
  const issues = work.error ? importIssues(work.error) : []
  const rows = preview ? kind === 'quiz' ? preview.questions.map((q, index) => ({ index, text: q.question, details: `${q.options.join('\n')}\n${q.answer}${q.explanation ? `\n${q.explanation}` : ''}` })) : preview.cards.map((card, index) => ({ index, text: card.front, details: card.back })) : []
  return <StudyList data={preview ? rows : issues.map((issue, index) => ({ index, text: issue.raw || t(`phase4.${issue.key}`, issue.values || {}), details: '' }))} header={<View style={{ gap: 14 }}><Title>{t('phase4.import')}</Title><Muted>{t('phase4.localNotice')}</Muted><Muted>{t(kind === 'quiz' ? 'phase4.quizFormats' : 'phase4.flashFormats')}</Muted><Muted>{t('phase4.importHelp')}</Muted>
    {!preview && <><Field label={t('phase4.name')} value={name} onChange={setName} limit={120} disabled={work.busy} /><Button title={t(work.busy ? 'phase4.working' : 'phase4.chooseFile')} disabled={work.busy} onPress={() => void work.run(pick)} />
      {kind === 'quiz' && <><Field label={t('phase4.pasteJson')} value={json} onChange={setJson} multiline limit={1024 * 1024} disabled={work.busy} /><Button secondary title={t('phase4.preview')} disabled={work.busy || !json.trim()} onPress={() => void work.run(async () => { show(parseQuizJson(json), [], ''); setJson('') })} /></>}
    </>}
    {work.busy && <Button secondary title={t('phase4.cancel')} onPress={() => controller.current?.abort()} />}
    {!!issues.length && <Muted>{t('phase4.fixFile')}</Muted>}
    {preview && <><Title>{t('phase4.preview')}</Title><AppText>{t('phase4.itemCount', { count: rows.length })}</AppText><Field label={t('phase4.name')} value={name} onChange={setName} limit={120} disabled={work.busy} /><Issues error={work.error} /></>}
  </View>} renderItem={({ item }) => <Card style={{ marginTop: 12 }}>{preview && <Muted>{t('phase4.rowNumber', { count: item.index + 1 })}</Muted>}<AppText selectable>{item.text}</AppText>{!!item.details && <AppText selectable>{item.details}</AppText>}</Card>}
    footer={preview ? <View style={{ gap: 12, marginTop: 18 }}><View style={styles.row}><Button title={t('phase4.confirmSave')} disabled={work.busy} onPress={() => void work.run(async () => { await studyStore.save(library.account!, validateManual({ ...preview, name })); setSaved(true); disableGuard(); await library.refresh(); router.replace(kind === 'quiz' ? '/study/quiz' : '/study/flashcard') })} /><Button secondary title={t('phase4.discardPreview')} disabled={work.busy} onPress={() => { setPreview(undefined); work.setError(undefined) }} /></View></View> : undefined} />
}
