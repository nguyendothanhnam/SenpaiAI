import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Gamepad2, SearchX, Sparkles } from 'lucide-react'
import type { StatStore } from '../../../../shared-games'
import { useAuth } from '../../services/auth'
import { loadStats } from '../../features/minigames/storage'
import { filterGames, gameDestination, gameRecord, GAMES_DATA, type Category, type HubGame } from '../../features/gameHub/catalog'
import GameGuide from './GameGuide'
import HeroBanner from './HeroBanner'
import FilterBar from './FilterBar'
import GameCard from './GameCard'
import LevelSelectModal from './LevelSelectModal'
import './gameHub.css'

export default function GameHubContent() {
  const { t } = useTranslation('common'), { user } = useAuth(), navigate = useNavigate()
  const [category, setCategory] = useState<Category>('all'), [search, setSearch] = useState(''), [selected, setSelected] = useState<HubGame | null>(null), [guide, setGuide] = useState<HubGame | null>(null)
  const [store, setStore] = useState<StatStore>(() => user ? loadStats(user.id).store : { version: 1, entries: {} })
  const [storageError, setStorageError] = useState(false)
  useEffect(() => {
    const read = () => { const result = user ? loadStats(user.id) : { store: { version: 1 as const, entries: {} }, error: false }; setStore(result.store); setStorageError(result.error) }
    read(); window.addEventListener('storage', read); window.addEventListener('focus', read)
    return () => { window.removeEventListener('storage', read); window.removeEventListener('focus', read) }
  }, [user])
  const filtered = useMemo(() => filterGames(GAMES_DATA, category, search, key => t(key)), [category, search, t])
  const closeGuide = useCallback(() => setGuide(null), [])
  const close = useCallback(() => setSelected(null), [])
  const openGame = (game: HubGame) => { if (game.engine) setSelected(game); else navigate(game.to) }
  return <div className="game-hub relative isolate min-w-0 pb-8 text-[color:var(--text)]">
    <div className="gh-bamboo pointer-events-none absolute -inset-4 -z-10 rounded-[32px] sm:-inset-6" aria-hidden="true" />
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--text-muted)]"><Gamepad2 size={17} aria-hidden="true" />{t('arcade.eyebrow')}</div><span className="gh-glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold"><Sparkles size={12} aria-hidden="true" />{t('arcade.smallSteps')}</span></div>
    <HeroBanner onPlay={() => setSelected(GAMES_DATA.find(game => game.id === 'falling')!)} />
    <section className="mt-8" aria-labelledby="gh-library-title"><div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><h2 id="gh-library-title" className="text-xl font-extrabold tracking-tight sm:text-2xl">{t('arcade.libraryTitle')}</h2><p className="mt-1 text-sm text-[color:var(--text-muted)]">{t('arcade.libraryDescription')}</p></div><span role="status" aria-live="polite" className="text-xs font-semibold text-[color:var(--text-muted)]">{t('arcade.resultCount', { count: filtered.length })}</span></div>
      <FilterBar category={category} onCategory={setCategory} search={search} onSearch={setSearch} />
      {storageError && <p role="alert" className="mt-4 text-sm text-[color:var(--text-muted)]">{t('minigames.storageError')}</p>}
      {category === 'ranked' && <p className="gh-glass mt-4 rounded-2xl p-5 text-sm text-[color:var(--text-muted)]">{t('arcade.rankedNotice')}</p>}
      {filtered.length ? <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{filtered.map(game => <GameCard key={game.id} game={game} record={gameRecord(game, store.entries)} onSelect={() => openGame(game)} onGuide={() => setGuide(game)} />)}</div> : <div className="gh-glass mt-5 flex flex-col items-center rounded-3xl px-5 py-14 text-center"><SearchX size={36} className="mb-4 text-[color:var(--text-muted)]" aria-hidden="true" /><h3 className="text-lg font-bold">{t('arcade.emptyTitle')}</h3><p className="mt-2 text-sm text-[color:var(--text-muted)]">{t('arcade.emptyDescription')}</p><button type="button" onClick={() => { setCategory('all'); setSearch('') }} className="mt-5 min-h-[44px] rounded-full bg-[#147A5E] px-5 py-2 text-sm font-semibold text-white">{t('arcade.resetFilters')}</button></div>}
      <p className="mt-6 text-center text-xs leading-6 text-[color:var(--text-muted)]">{t('arcade.activityNotice')}<br />{t('arcade.rewardNotice')}</p>
    </section>
    {guide && <GameGuide gameId={guide.id} name={t(guide.title)} onClose={closeGuide} />}
    {selected && <LevelSelectModal key={selected.id} game={selected} preferredLevel={user?.current_jlpt_level} onClose={close} onStart={level => { navigate(gameDestination(selected, level)); close() }} />}
  </div>
}
