import { motion } from 'framer-motion'
import { ArrowLeft, Copy, FileUp, PencilLine, PlayCircle, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { importFlashcard } from '../services/api.js'
import {
  deleteFlashcardSet,
  duplicateFlashcardSet,
  getStoredFlashcardSets,
  saveFlashcardSet,
} from '../utils/storage.js'

function formatDate(value) {
  if (!value) return 'Not yet'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not yet' : date.toLocaleDateString()
}

export default function Flashcard() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const [sets, setSets] = useState(() => getStoredFlashcardSets())
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ jlpt: 'all', category: 'all', source: 'all' })
  const [importError, setImportError] = useState('')

  const totalCards = sets.reduce((sum, set) => sum + (set.cards?.length || 0), 0)
  const recentlyStudied = sets
    .filter((set) => set.last_studied_at)
    .sort((a, b) => new Date(b.last_studied_at).getTime() - new Date(a.last_studied_at).getTime())[0]
  const aggregateStats = sets.reduce((stats, set) => {
    stats.correct += set.stats?.correct || 0
    stats.wrong += set.stats?.wrong || 0
    return stats
  }, { correct: 0, wrong: 0 })
  const aggregateTotal = aggregateStats.correct + aggregateStats.wrong
  const aggregateAccuracy = aggregateTotal ? Math.round((aggregateStats.correct / aggregateTotal) * 100) : 0

  const filterOptions = useMemo(() => ({
    jlpt: [...new Set(sets.map((set) => set.jlpt_level).filter(Boolean))],
    category: [...new Set(sets.map((set) => set.category).filter(Boolean))],
  }), [sets])

  const visibleSets = useMemo(() => {
    const query = search.trim().toLowerCase()
    return sets.filter((set) => {
      const matchesSearch = !query || set.name.toLowerCase().includes(query) || (set.file_name || '').toLowerCase().includes(query)
      const matchesJlpt = filters.jlpt === 'all' || set.jlpt_level === filters.jlpt
      const matchesCategory = filters.category === 'all' || set.category === filters.category
      const matchesSource = filters.source === 'all' || set.source === filters.source
      return matchesSearch && matchesJlpt && matchesCategory && matchesSource
    })
  }, [filters, search, sets])

  const refreshSets = () => setSets(getStoredFlashcardSets())

  const handleDelete = (set) => {
    if (!window.confirm(t('flashcard.confirmDelete'))) return
    setSets(deleteFlashcardSet(set.id))
  }

  const handleDuplicate = (set) => {
    duplicateFlashcardSet(set.id)
    refreshSets()
  }

  const handleImport = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setImportError('')
    try {
      const response = await importFlashcard(file)
      const imported = saveFlashcardSet({
        name: file.name.replace(/\.[^.]+$/, ''),
        cards: response.data?.cards || [],
        source: 'imported',
        fileName: file.name,
      })
      refreshSets()
      if (imported) navigate('/flashcard/play', { state: { setId: imported.id } })
    } catch (error) {
      setImportError(error?.response?.data?.detail || t('flashcard.importError'))
    }
  }

  return (
    <div className="space-y-4">
      <Link to="/games" className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--card-glass)] px-4 py-2 text-sm font-semibold text-[color:var(--text)] transition hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]">
        <ArrowLeft className="h-4 w-4" /> {t('shared.backToGames')}
      </Link>
    <div className="space-y-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--accent)] p-4 shadow-sm sm:p-5">
      <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">{t('flashcard.eyebrow')}</p>
            <h1 className="mt-1 text-2xl font-bold text-[color:var(--text)]">{t('flashcard.title')}</h1>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">{t('flashcard.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate('/flashcard/manual')} className="inline-flex items-center rounded-xl bg-[color:var(--primary)] px-4 py-2 text-sm font-bold text-[color:var(--primary-contrast)]">
              <Plus className="mr-2 h-4 w-4" /> {t('flashcard.createSet')}
            </button>
            <label className="inline-flex cursor-pointer items-center rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-2 text-sm font-bold text-[color:var(--primary)]">
              <FileUp className="mr-2 h-4 w-4" /> {t('flashcard.importSet')}
              <input type="file" accept=".xlsx,.xls,.csv,.json" onChange={handleImport} className="sr-only" />
            </label>
          </div>
        </div>

        {importError && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{importError}</div>}

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl bg-[color:var(--accent)] px-4 py-3">
            <p className="text-xs font-bold text-[color:var(--primary)]">{t('flashcard.totalSets')}</p>
            <p className="mt-1 text-2xl font-black text-[color:var(--text)]">{sets.length}</p>
          </div>
          <div className="rounded-xl bg-[color:var(--accent)] px-4 py-3">
            <p className="text-xs font-bold text-[color:var(--primary)]">{t('flashcard.totalCards')}</p>
            <p className="mt-1 text-2xl font-black text-[color:var(--text)]">{totalCards}</p>
          </div>
          <div className="rounded-xl bg-[color:var(--accent)] px-4 py-3">
            <p className="text-xs font-bold text-[color:var(--primary)]">{t('flashcard.recentSet')}</p>
            <p className="mt-1 truncate text-base font-black text-[color:var(--text)]">{recentlyStudied?.name || t('shared.notYet')}</p>
          </div>
          <div className="rounded-xl bg-[color:var(--accent)] px-4 py-3">
            <p className="text-xs font-bold text-[color:var(--primary)]">{t('flashcard.studyProgress')}</p>
            <p className="mt-1 text-2xl font-black text-[color:var(--text)]">{aggregateAccuracy}%</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_repeat(3,auto)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--primary)]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('flashcard.search')} className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] py-2.5 pl-10 pr-4 text-sm font-semibold outline-none focus:border-[color:var(--border)] focus:bg-[color:var(--card)]" />
          </div>
          <select value={filters.jlpt} onChange={(event) => setFilters((current) => ({ ...current, jlpt: event.target.value }))} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-2 text-sm font-bold text-[color:var(--primary)]">
            <option value="all">{t('shared.allJlpt')}</option>
            {filterOptions.jlpt.map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
          <select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-2 text-sm font-bold text-[color:var(--primary)]">
            <option value="all">{t('shared.allCategories')}</option>
            {filterOptions.category.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select value={filters.source} onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value }))} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-2 text-sm font-bold text-[color:var(--primary)]">
            <option value="all">{t('flashcard.allSources')}</option>
            <option value="user">{t('flashcard.sourceUser')}</option>
            <option value="imported">{t('flashcard.sourceImported')}</option>
            <option value="built-in">{t('flashcard.sourceBuiltIn')}</option>
            <option value="legacy">{t('flashcard.sourceLegacy')}</option>
          </select>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {visibleSets.length ? visibleSets.map((set, index) => (
          <motion.div key={set.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-[color:var(--text)]">{set.name}</h2>
                <p className="mt-1 text-xs font-semibold text-[color:var(--text-muted)]">{set.file_name || (set.source ? t(`flashcard.source${set.source[0].toUpperCase()}${set.source.slice(1)}`) : t('flashcard.sourceUser'))}</p>
              </div>
              <span className="rounded-full bg-[color:var(--accent)] px-3 py-1 text-xs font-bold text-[color:var(--primary)]">{set.jlpt_level || t('shared.mixed')}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><p className="font-black text-[color:var(--text)]">{set.cards?.length || 0}</p><p className="text-xs text-[color:var(--text-muted)]">{t('flashcard.cards')}</p></div>
              <div><p className="font-black text-[color:var(--text)]">{set.category || t('shared.mixed')}</p><p className="text-xs text-[color:var(--text-muted)]">{t('shared.category')}</p></div>
              <div><p className="font-black text-[color:var(--text)]">{formatDate(set.created_at, t('shared.notYet'))}</p><p className="text-xs text-[color:var(--text-muted)]">{t('shared.created')}</p></div>
              <div><p className="font-black text-[color:var(--text)]">{formatDate(set.last_studied_at, t('shared.notYet'))}</p><p className="text-xs text-[color:var(--text-muted)]">{t('flashcard.lastStudied')}</p></div>
            </div>
            <div className="mt-4 rounded-xl bg-[color:var(--accent)] px-3 py-2 text-xs font-bold text-[color:var(--primary)]">
              {t('flashcard.stats', { accuracy: set.stats?.accuracy || 0, correct: set.stats?.correct || 0, wrong: set.stats?.wrong || 0, streak: set.stats?.streak || 0 })}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => navigate('/flashcard/play', { state: { setId: set.id } })} className="inline-flex items-center rounded-xl bg-[color:var(--primary)] px-3 py-2 text-sm font-bold text-[color:var(--primary-contrast)]"><PlayCircle className="mr-2 h-4 w-4" /> {t('shared.study')}</button>
              <button onClick={() => navigate('/flashcard/manual', { state: { editSetId: set.id } })} className="inline-flex items-center rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm font-bold text-[color:var(--primary)]"><PencilLine className="mr-2 h-4 w-4" /> {t('shared.edit')}</button>
              <button onClick={() => handleDuplicate(set)} className="inline-flex items-center rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm font-bold text-[color:var(--primary)]"><Copy className="mr-2 h-4 w-4" /> {t('shared.duplicate')}</button>
              <button onClick={() => handleDelete(set)} className="inline-flex items-center rounded-xl border border-red-200 bg-[color:var(--card)] px-3 py-2 text-sm font-bold text-red-600"><Trash2 className="mr-2 h-4 w-4" /> {t('shared.delete')}</button>
            </div>
          </motion.div>
        )) : (
          <div className="rounded-2xl bg-[color:var(--card)] p-8 text-center text-sm font-semibold text-[color:var(--text-muted)] lg:col-span-2">{t('flashcard.noMatches')}</div>
        )}
      </section>
    </div>
    </div>
  )
}

