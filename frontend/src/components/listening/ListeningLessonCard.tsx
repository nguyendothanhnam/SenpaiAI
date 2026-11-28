import { Clock3, Headphones, MessageSquare, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery } from 'react-query'
import { Link } from 'react-router-dom'
import { listeningAPI, type ListeningLessonSummary } from '../../services/api'
import { localizeListeningLesson } from '../../utils/listeningLocale'
import { listeningSourceKey, listeningTimestamp } from '../../utils/listeningPresentation'

export default function ListeningLessonCard({ lesson, userId }: { lesson: ListeningLessonSummary; userId?: number }) {
  const { t } = useTranslation('common')
  // Reuse the player's cached detail request for sentence count/preview; never request TTS/audio here.
  const detail = useQuery(['listening-lesson', userId ?? null, lesson.id], () => listeningAPI.getLesson(lesson.id).then(({ data }) => data), { staleTime: 30000, refetchOnWindowFocus: false, retry: 1 })
  const display = localizeListeningLesson(lesson, t)
  const segments = detail.data?.segments
  return <article className="listening-glass group flex min-w-0 flex-col p-5 sm:p-6">
    <div className="flex flex-wrap items-center gap-2"><span className="listening-badge">{lesson.jlpt_level}</span><span className="rounded-lg border border-[color:var(--border)] px-2.5 py-1 text-xs font-medium text-[color:var(--text-muted)]">{t(listeningSourceKey(lesson.source))}</span><span className="ml-auto text-xs text-[color:var(--text-muted)]">{display.topic}</span></div>
    <h3 className="mt-4 break-words text-lg font-bold leading-7">{display.title}</h3>
    <p className="mt-2 line-clamp-2 text-sm leading-6 text-[color:var(--text-muted)]">{display.description}</p>
    <div className="my-4 min-h-[4.5rem] flex-1 rounded-xl bg-[color:var(--bg-elevated)] px-3.5 py-3">
      {segments?.[0]?.ja ? <p lang="ja" className="listening-japanese line-clamp-2 break-words text-sm leading-7">{segments[0].ja}</p> : <div className="flex h-full items-center gap-2 text-sm text-[color:var(--text-muted)]"><Headphones className="h-4 w-4 shrink-0" aria-hidden="true" />{detail.isLoading ? t('listening.ui.previewLoading') : t('listening.ui.previewUnavailable')}</div>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border)] pt-4">
      <div className="flex flex-wrap gap-3 text-xs text-[color:var(--text-muted)]">{lesson.duration_ms > 0 && <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />{listeningTimestamp(lesson.duration_ms / 1000)}</span>}{segments && <span className="inline-flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />{t('listening.ui.sentenceCount', { count: segments.length })}</span>}</div>
      <Link to={`/listening/${lesson.id}`} className="listening-action"><Play className="h-4 w-4" aria-hidden="true" />{t('listening.ui.startListening')}</Link>
    </div>
  </article>
}
