import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../services/auth'
import { chatFeedbackAPI } from '../../services/chatFeedback'
import type { AnswerRating } from '../../services/chatFeedback'

export default function ChatAnswerFeedback({ messageId }: { messageId: number }) {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const cache = useQueryClient()
  const key = ['chatAnswerFeedback', user?.id, messageId]
  const [rating, setRating] = useState<AnswerRating | null>(null)
  const [comment, setComment] = useState<string | undefined>()
  // Read feedback only when the form opens, rather than one query per visible message.
  const query = useQuery(key, () => chatFeedbackAPI.get(messageId), { enabled: Boolean(user && rating), retry: false, staleTime: 60000 })
  const save = useMutation((body: { rating: AnswerRating; comment: string }) => chatFeedbackAPI.save(messageId, body), {
    onSuccess: data => { cache.setQueryData(key, data); setRating(null); setComment(undefined) },
  })
  if (!user) return null
  return <div className="mt-3 space-y-2 text-sm">
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('chatQuality.rate')}>
      {(['helpful', 'incorrect'] as const).map(value => <button key={value} type="button" disabled={save.isLoading} aria-pressed={(rating || query.data?.rating) === value} className="min-h-[44px] rounded-xl border border-[color:var(--border)] px-3 text-[color:var(--text-muted)] hover:bg-[color:var(--accent)] aria-pressed:border-[color:var(--primary)] aria-pressed:text-[color:var(--primary)] disabled:opacity-50 motion-reduce:transition-none" onClick={() => { setRating(value); setComment(undefined); save.reset() }}>{t(`chatQuality.${value}`)}</button>)}
    </div>
    {save.isSuccess && <p role="status" className="text-[color:var(--primary)]">{t('chatQuality.saved')}</p>}
    {rating && <form aria-label={t('chatQuality.formTitle')} className="space-y-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-3" onSubmit={event => { event.preventDefault(); save.mutate({ rating, comment: comment ?? query.data?.comment ?? '' }) }}>
      <p className="font-semibold">{t('chatQuality.formTitle')}</p><label className="block"><span>{t('chatQuality.comment')}</span><textarea rows={3} maxLength={1000} value={comment ?? query.data?.comment ?? ''} onChange={event => setComment(event.target.value)} disabled={save.isLoading} className="input mt-2 w-full resize-y" placeholder={t('chatQuality.placeholder')} /></label>
      <p className="text-xs text-[color:var(--text-muted)]">{t('chatQuality.privacy')}</p>
      {query.isLoading && <p role="status">{t('chatQuality.loading')}</p>}
      {query.isError && <p role="alert">{t('chatQuality.loadError')} <button className="underline" type="button" onClick={() => query.refetch()}>{t('chatQuality.retry')}</button></p>}
      {save.isError && <p role="alert">{t('chatQuality.saveError')}</p>}
      <div className="flex flex-wrap gap-2"><button type="submit" disabled={save.isLoading || query.isLoading} className="btn btn-primary min-h-[44px] px-4">{t(save.isLoading ? 'chatQuality.saving' : 'chatQuality.send')}</button><button type="button" disabled={save.isLoading} className="btn btn-outline min-h-[44px] px-4" onClick={() => { setRating(null); setComment(undefined); save.reset() }}>{t('chatQuality.cancel')}</button></div>
    </form>}
  </div>
}
