import { Link } from 'react-router-dom'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../services/auth'
import { placementAPI } from '../../services/placement'
import { getErrorMessage } from '../../utils/getErrorMessage'
import { SkillBars } from './PlacementResults'
import { comparableAttempts } from '../../utils/placementDefaults'

export default function PlacementProfileSummary() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation('placement')
  const { data, error, isLoading, refetch } = useQuery(['placement', 'summary', user?.id], () => placementAPI.summary().then(res => res.data), { enabled: Boolean(user) })
  const trend = comparableAttempts(data?.history || [])
  return <section className="theme-card motion-reduce:transition-none space-y-5 p-5 text-[color:var(--text)] sm:p-7">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{t('profileTitle')}</h2><Link className="font-semibold text-[color:var(--primary)] underline" to="/placement">{t('profileRetake')}</Link></div>
    {isLoading && <p role="status">{t('loading')}</p>}
    {Boolean(error) && <div role="alert"><p>{getErrorMessage(error)}</p><button onClick={() => refetch()} type="button" className="underline">{t('retry')}</button></div>}
    {data && <><div><p className="text-3xl font-bold text-[color:var(--primary)]">{data.manual_level || data.current_estimated_level || t('unassessed')}</p><p className="mt-1 text-sm text-[color:var(--text-muted)]">{t('profileSource', { source: t(`sources.${data.source}`) })}</p>
      {data.last_assessed_at && <p className="mt-1 text-sm text-[color:var(--text-muted)]">{t('lastAssessment', { date: new Date(data.last_assessed_at).toLocaleString(i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN') })}</p>}</div>
      {Object.keys(data.skill_scores).length > 0 && <SkillBars scores={data.skill_scores} />}
      <p className="text-sm text-[color:var(--text-muted)]">{t('disclaimer')}</p>
      {trend.length > 1 && <figure className="space-y-3"><figcaption className="font-semibold">{t('trendTitle', { level: trend[0].selected_level })}</figcaption>{trend.map(row => <div key={row.id} className="grid grid-cols-[6rem_1fr_3rem] items-center gap-2 text-sm"><span>{new Date(row.completed_at).toLocaleDateString(i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN')}</span><progress aria-label={new Date(row.completed_at).toLocaleDateString()} className="h-2 w-full accent-[color:var(--primary)]" value={row.total_score || 0} max={100} /><span>{row.total_score}/100</span></div>)}</figure>}
      <h3 className="font-semibold">{t('history')}</h3>
      {!data.history.length ? <p>{t('noAssessments')}</p> : <><p className="text-sm text-[color:var(--text-muted)]">{t('trendNote')}</p><ol className="space-y-3">{data.history.map(row => <li key={row.id} className="flex flex-wrap justify-between gap-3 rounded-xl border border-[color:var(--border)] p-3 text-sm"><div><p>{new Date(row.completed_at).toLocaleDateString(i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN')} · {row.is_demo ? t('insufficientEvidence') : row.estimated_level || t('insufficientEvidence')}</p><p className="mt-1 text-xs text-[color:var(--text-muted)]">{t(row.mode === 'confirmation' ? 'modeConfirmationShort' : row.mode === 'legacy' ? 'legacySession' : 'modeAdaptiveShort')} {row.selected_level || ''}</p></div><span>{row.total_score == null ? '—' : `${row.total_score}/100`}</span></li>)}</ol></>}
    </>}
  </section>
}
