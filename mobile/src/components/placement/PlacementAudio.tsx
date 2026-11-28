import { useEffect, useRef, useState } from 'react'
import { AppState, View } from 'react-native'
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio'
import * as FileSystem from 'expo-file-system/legacy'
import { useTranslation } from 'react-i18next'
import { session } from '../../api/services'
import { secureToken } from '../../storage/secureToken'
import { apiConfiguration } from '../../config/env'
import { placementMediaPath, type PlacementQuestion } from '../../features/placement/model'
import { AppText, Button, ErrorNotice } from '../ui'
import { getErrorMessage } from '../../utils/getErrorMessage'

function Clip({ uri, question, disabled }: { uri: string; question: PlacementQuestion; disabled: boolean }) {
  const { t } = useTranslation('mobile')
  const player = useAudioPlayer(uri, { updateInterval: 100 }), status = useAudioPlayerStatus(player)
  const [error, setError] = useState(false), pending = useRef(false)
  const start = (question.start_ms || 0) / 1000, end = (question.end_ms || 0) / 1000
  useEffect(() => {
    if (status.playing && end > start && status.currentTime >= end) player.pause()
  }, [status.currentTime, status.playing, end, start, player])
  useEffect(() => { if (disabled) player.pause() }, [disabled, player])
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state !== 'active') player.pause() })
    return () => listener.remove()
  }, [player])
  async function play() {
    if (pending.current) return
    pending.current = true; setError(false)
    try {
      if (status.playing) player.pause()
      else {
        await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'doNotMix' })
        await player.seekTo(start)
        player.play()
      }
    } catch { setError(true) }
    finally { pending.current = false }
  }
  return <View style={{ gap: 8 }}><Button secondary title={t(status.playing ? 'placement.pauseAudio' : 'placement.playAudio')} disabled={disabled || !status.isLoaded} onPress={() => void play()} />{(error || status.error) && <AppText accessibilityRole="alert">{t('placement.audioError')}</AppText>}</View>
}

export function PlacementAudio({ attemptId, question, disabled }: { attemptId: number; question: PlacementQuestion; disabled: boolean }) {
  const { t, i18n } = useTranslation('placement'), { t: mobile } = useTranslation('mobile')
  const [uri, setUri] = useState(''), [error, setError] = useState<unknown>(), [retry, setRetry] = useState(0)
  const path = placementMediaPath(attemptId, question)
  useEffect(() => {
    let alive = true, local = '', download: FileSystem.DownloadResumable | undefined
    let timeout: ReturnType<typeof setTimeout> | undefined
    setUri(''); setError(undefined)
    void (async () => {
      try {
        const token = await secureToken.get(), owner = session.getSnapshot().user?.id
        if (!alive) return
        if (!path || !token || !owner || !FileSystem.cacheDirectory) throw new Error('media unavailable')
        local = `${FileSystem.cacheDirectory}placement-${owner}-${attemptId}-${Math.random().toString(36).slice(2)}.wav`
        download = FileSystem.createDownloadResumable(`${apiConfiguration.url}${path}`, local, { headers: { Authorization: `Bearer ${token}` } })
        timeout = setTimeout(() => { void download?.cancelAsync().catch(() => undefined) }, 20000)
        const result = await download.downloadAsync()
        if (result?.status === 401) await session.expire(token)
        if (!result || result.status !== 200) throw { response: result ? { status: result.status, data: { detail: 'placement_media_unavailable' } } : undefined }
        if (alive && session.getSnapshot().user?.id === owner && await secureToken.get() === token) setUri(local)
      } catch (err) { if (alive) setError(err) }
      finally { clearTimeout(timeout); if (!alive && local) void FileSystem.deleteAsync(local, { idempotent: true }).catch(() => undefined) }
    })()
    return () => { alive = false; clearTimeout(timeout); void download?.cancelAsync().catch(() => undefined); if (local) void FileSystem.deleteAsync(local, { idempotent: true }).catch(() => undefined) }
  }, [path, attemptId, retry])
  if (error) return <ErrorNotice message={getErrorMessage(error, i18n)} retry={() => setRetry(value => value + 1)} />
  if (!uri) return <AppText>{t('loadingAudio')}</AppText>
  return <View style={{ gap: 8 }}><Clip uri={uri} question={question} disabled={disabled} /><Button secondary title={mobile('placement.reloadAudio')} disabled={disabled} onPress={() => setRetry(value => value + 1)} /></View>
}
