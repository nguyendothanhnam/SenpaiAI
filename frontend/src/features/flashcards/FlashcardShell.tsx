import type { ReactNode } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BookOpen, ChevronRight, Layers } from 'lucide-react'

/** Presentation only: routes, session state and requests remain owned by each view. */
export default function FlashcardShell({ children, deckTitle }: { children: ReactNode; deckTitle?: string }) {
  const { t } = useTranslation('common')
  const f = (key: string, values?: Record<string, unknown>) => String(t(`flashcardsManager.${key}`, values))
  const location = useLocation(), params = useParams(), [search] = useSearchParams()
  const id = Number(params.deckId || search.get('set') || (location.state as { setId?: number } | null)?.setId) || undefined
  const mode = location.pathname.split('/')[2] || 'library'
  const tabs = id ? [
    { key: 'overview', to: `/flashcard/${id}`, active: mode === String(id) },
    { key: 'flipMode', to: `/flashcard/play?set=${id}`, active: mode === 'play' },
    { key: 'learn', to: `/flashcard/learn?set=${id}`, active: mode === 'learn' },
    { key: 'test', to: `/flashcard/test?set=${id}`, active: mode === 'test' },
    { key: 'statistics', to: `/flashcard/stats?set=${id}`, active: mode === 'stats' },
    { key: 'edit', to: `/flashcard/manual?set=${id}`, active: mode === 'manual' },
  ] : [{ key: 'overview', to: '/flashcard', active: mode === 'library' }, { key: 'statistics', to: '/flashcard/stats', active: mode === 'stats' }]
  return <div className="fc-layout">
    <header className="fc-panel fc-navigation">
      <nav className="fc-breadcrumb" aria-label={f('breadcrumb')}><Link to="/flashcard"><span className="fc-brand-icon"><Layers size={20} aria-hidden="true" /></span>{f('title')}</Link>{(id || mode === 'manual') && <><ChevronRight size={16} aria-hidden="true" /><span className="fc-card-text" aria-current="page">{deckTitle || (id ? f('deckNumber', { number: id }) : f('create'))}</span></>}</nav>
      <nav className="fc-tabs" aria-label={f('studyModes')}>{tabs.map(tab => <Link key={tab.key} to={tab.to} aria-current={tab.active ? 'page' : undefined}><BookOpen size={15} aria-hidden="true" />{f(tab.key)}</Link>)}</nav>
    </header>
    {children}
  </div>
}
