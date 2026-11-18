import { useCallback, useRef, useState } from 'react'
import { Image, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { writingAPI, type Recognition } from '../api/kanjiWriting'
import { kanjiAPI } from '../api/phase3'
import { recognitionPayload, type InkStroke } from '../features/kanji/handwriting'
import { KanjiDrawingCanvas } from '../components/KanjiDrawingCanvas'
import { AppText, Button, Card, ErrorNotice, Muted, Screen, Title } from '../components/ui'
import { StrokeAnimation } from '../components/StrokeAnimation'
import { getErrorMessage } from '../utils/getErrorMessage'

export function KanjiWritingScreen() {
  const { character } = useLocalSearchParams<{ character?: string }>(), { t, i18n } = useTranslation('mobile')
  const [target, setTarget] = useState(character || '')
  const [strokes, setStrokes] = useState<InkStroke[]>([]), [drawing, setDrawing] = useState(false)
  const [result, setResult] = useState<Recognition | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const pending = useRef<AbortController | null>(null)
  const model = useQuery(['kanji-model-info'], writingAPI.model)
  const supported = useQuery(['kanji-writing-supported'], writingAPI.supported)
  const detail = useQuery(['kanji-detail', target], () => kanjiAPI.detail(target), { enabled: !!target })
  const reference = useQuery(['kanji-strokes', target], () => kanjiAPI.strokes(target), { enabled: !!target, retry: false })
  const samples = useQuery(['kanji-writing-samples', target], () => writingAPI.samples(target), { enabled: !!target, retry: false })
  const controller = () => { pending.current?.abort(); pending.current = null }
  useFocusEffect(useCallback(() => () => { pending.current?.abort(); pending.current = null; setBusy(false) }, []))
  const change = (next: InkStroke[]) => { controller(); setBusy(false); setResult(null); setError(''); setStrokes(next) }
  const begin = (active: boolean) => { setDrawing(active); if (active) { controller(); setBusy(false); setResult(null); setError('') } }
  const targetSupported = !target || !!model.data?.supported_kanji.includes(target)
  const hasReference = !!reference.data?.available && !!reference.data.strokes?.length
  const recognize = async () => {
    if (pending.current || drawing || !strokes.length || !targetSupported) return
    const request = new AbortController(); pending.current = request; setBusy(true); setError(''); setResult(null)
    try {
      // Yield once so the processing state paints before the small CPU-only PNG export.
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      if (request.signal.aborted) return
      const response = await writingAPI.recognize(recognitionPayload(strokes, target, detail.data?.jlpt), request.signal)
      if (!request.signal.aborted) { setResult(response); if (!response.success) setError(response.message || t('writing.noResult')) }
    } catch (e) { if (!request.signal.aborted) setError(getErrorMessage(e, i18n)) }
    finally { if (pending.current === request) { pending.current = null; setBusy(false) } }
  }
  const next = () => {
    const guided = supported.data?.kanji || []
    const recognized = guided.filter(kanji => model.data?.supported_kanji.includes(kanji))
    const candidates = model.data?.available && recognized.length ? recognized : guided
    if (candidates.length) { change([]); setTarget(candidates[(candidates.indexOf(target) + 1) % candidates.length]) }
  }
  return <Screen scrollEnabled={!drawing}>
    <Title>{t(target ? 'writing.practice' : 'writing.recognize')}</Title>
    <Muted>{t('writing.scope', { levels: model.data?.supported_jlpt.join(', ') || t('writing.none'), count: model.data?.classes_count || 0 })}</Muted>
    {model.data?.available && (model.data.dictionary_classes || 0) > model.data.classes_count && <ErrorNotice message={t('coverageGap', { ns: 'kanjiStatus', count: model.data.classes_count, total: model.data.dictionary_classes })} />}
    {model.isLoading && <Muted>{t('loading')}</Muted>}
    {model.isError && <ErrorNotice message={getErrorMessage(model.error, i18n)} retry={() => void model.refetch()} />}
    {model.data && !model.data.available && <ErrorNotice message={t('writing.unavailable')} />}
    {target && <Card><Title>{target}</Title><AppText>{detail.data?.meaning_vi || detail.data?.meaning || ''}</AppText><Muted>{t('writing.practiceHint')}</Muted></Card>}
    {target && model.data && !targetSupported && <ErrorNotice message={t('writing.unsupported', { character: target })} />}
    {target && reference.isLoading && <Muted>{t('loading')}</Muted>}
    {target && reference.isError && <ErrorNotice message={getErrorMessage(reference.error, i18n)} retry={() => void reference.refetch()} />}
    {target && reference.data && !hasReference && <Muted>{t('phase3.strokesUnsupported')}</Muted>}
    <>
      <KanjiDrawingCanvas strokes={strokes} onChange={change} onDrawing={begin} reference={target ? reference.data : undefined} />
      <Button title={t(busy ? 'writing.processing' : target ? 'writing.check' : 'writing.recognize')} disabled={busy || drawing || !strokes.length || !model.data?.available || !targetSupported} onPress={() => void recognize()} />
    </>
    <Muted>{t('writing.privacy')}</Muted>
    {error && <ErrorNotice message={error} />}
    {result && <Card>
      {!!target && result.success && !!result.predictions.length && <Title>{t(result.predictions[0].kanji === target ? 'writing.match' : 'writing.mismatch')}</Title>}
      {!!target && <Muted>{t('writing.strokeComparison', { actual: strokes.length, expected: detail.data?.stroke_count || detail.data?.strokes || reference.data?.strokes?.length || 0 })}</Muted>}
      {result.low_confidence && <Muted>{t('writing.lowConfidence')}</Muted>}
      {!result.predictions.length && <Muted>{t('writing.noResult')}</Muted>}
      {result.predictions.map(p => <Button key={p.kanji} secondary title={t('writing.candidate', { character: p.kanji, confidence: Math.round(p.confidence * 100) })} onPress={() => router.push({ pathname: '/kanji/[character]', params: { character: p.kanji } })} />)}
      <Button secondary title={t('writing.retry')} onPress={() => change([])} />
    </Card>}
    {!!target && <>
      {supported.isError && <ErrorNotice message={getErrorMessage(supported.error, i18n)} retry={() => void supported.refetch()} />}
      <Button secondary title={t('writing.next')} disabled={!supported.data?.kanji.length || drawing} onPress={next} />
      {hasReference && <StrokeAnimation data={reference.data!} />}
      {samples.isError && <ErrorNotice message={getErrorMessage(samples.error, i18n)} retry={() => void samples.refetch()} />}
      {!!samples.data?.items.length && <Card><AppText>{t('writing.samples')}</AppText><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{samples.data.items.map(item => <Image key={item.filename} accessibilityLabel={t('writing.sample', { character: target })} source={{ uri: item.image_data }} style={{ width: 80, height: 80 }} />)}</View></Card>}
    </>}
  </Screen>
}
