import { motion } from 'framer-motion'
import { Copy, FileUp, PencilLine, PlayCircle, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
    if (!window.confirm('Are you sure you want to delete this flashcard set?')) return
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
      setImportError(error?.response?.data?.detail || 'Failed to import flashcard set.')
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-orange-100 bg-orange-50 p-4 shadow-sm sm:p-5">
      <section className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-500">Flashcard Studio</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-950">Flashcard Learning Management</h1>
            <p className="mt-1 text-sm text-gray-500">Organize, import, and study flashcards by set.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate('/flashcard/manual')} className="inline-flex items-center rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white">
              <Plus className="mr-2 h-4 w-4" /> Create New Flashcard Set
            </button>
            <label className="inline-flex cursor-pointer items-center rounded-xl border border-orange-200 bg-white px-4 py-2 text-sm font-bold text-orange-700">
              <FileUp className="mr-2 h-4 w-4" /> Import Flashcard Set
              <input type="file" accept=".xlsx,.xls,.csv,.json" onChange={handleImport} className="sr-only" />
            </label>
          </div>
        </div>

        {importError && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{importError}</div>}

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl bg-orange-50 px-4 py-3">
            <p className="text-xs font-bold text-orange-600">Total Flashcard Sets</p>
            <p className="mt-1 text-2xl font-black text-gray-950">{sets.length}</p>
          </div>
          <div className="rounded-xl bg-orange-50 px-4 py-3">
            <p className="text-xs font-bold text-orange-600">Total Flashcards</p>
            <p className="mt-1 text-2xl font-black text-gray-950">{totalCards}</p>
          </div>
          <div className="rounded-xl bg-orange-50 px-4 py-3">
            <p className="text-xs font-bold text-orange-600">Recently Studied Set</p>
            <p className="mt-1 truncate text-base font-black text-gray-950">{recentlyStudied?.name || 'Not yet'}</p>
          </div>
          <div className="rounded-xl bg-orange-50 px-4 py-3">
            <p className="text-xs font-bold text-orange-600">Study Progress</p>
            <p className="mt-1 text-2xl font-black text-gray-950">{aggregateAccuracy}%</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_repeat(3,auto)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search flashcard sets" className="w-full rounded-xl border border-orange-100 bg-orange-50 py-2.5 pl-10 pr-4 text-sm font-semibold outline-none focus:border-orange-300 focus:bg-white" />
          </div>
          <select value={filters.jlpt} onChange={(event) => setFilters((current) => ({ ...current, jlpt: event.target.value }))} className="rounded-xl border border-orange-200 bg-white px-4 py-2 text-sm font-bold text-orange-700">
            <option value="all">All JLPT</option>
            {filterOptions.jlpt.map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
          <select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))} className="rounded-xl border border-orange-200 bg-white px-4 py-2 text-sm font-bold text-orange-700">
            <option value="all">All categories</option>
            {filterOptions.category.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select value={filters.source} onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value }))} className="rounded-xl border border-orange-200 bg-white px-4 py-2 text-sm font-bold text-orange-700">
            <option value="all">All sources</option>
            <option value="user">User-created</option>
            <option value="imported">Imported</option>
            <option value="built-in">Built-in</option>
            <option value="legacy">Legacy</option>
          </select>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {visibleSets.length ? visibleSets.map((set, index) => (
          <motion.div key={set.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-gray-950">{set.name}</h2>
                <p className="mt-1 text-xs font-semibold text-gray-500">{set.file_name || set.source || 'user'}</p>
              </div>
              <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">{set.jlpt_level || 'Mixed'}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><p className="font-black text-gray-950">{set.cards?.length || 0}</p><p className="text-xs text-gray-500">Cards</p></div>
              <div><p className="font-black text-gray-950">{set.category || 'Mixed'}</p><p className="text-xs text-gray-500">Category</p></div>
              <div><p className="font-black text-gray-950">{formatDate(set.created_at)}</p><p className="text-xs text-gray-500">Created</p></div>
              <div><p className="font-black text-gray-950">{formatDate(set.last_studied_at)}</p><p className="text-xs text-gray-500">Last studied</p></div>
            </div>
            <div className="mt-4 rounded-xl bg-orange-50 px-3 py-2 text-xs font-bold text-orange-800">
              Accuracy {set.stats?.accuracy || 0}% · Correct {set.stats?.correct || 0} · Wrong {set.stats?.wrong || 0} · Streak {set.stats?.streak || 0}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => navigate('/flashcard/play', { state: { setId: set.id } })} className="inline-flex items-center rounded-xl bg-orange-500 px-3 py-2 text-sm font-bold text-white"><PlayCircle className="mr-2 h-4 w-4" /> Study</button>
              <button onClick={() => navigate('/flashcard/manual', { state: { editSetId: set.id } })} className="inline-flex items-center rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm font-bold text-orange-700"><PencilLine className="mr-2 h-4 w-4" /> Edit</button>
              <button onClick={() => handleDuplicate(set)} className="inline-flex items-center rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm font-bold text-orange-700"><Copy className="mr-2 h-4 w-4" /> Duplicate</button>
              <button onClick={() => handleDelete(set)} className="inline-flex items-center rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-600"><Trash2 className="mr-2 h-4 w-4" /> Delete</button>
            </div>
          </motion.div>
        )) : (
          <div className="rounded-2xl bg-white p-8 text-center text-sm font-semibold text-gray-600 lg:col-span-2">No flashcard sets match the current filters.</div>
        )}
      </section>
    </div>
  )
}
