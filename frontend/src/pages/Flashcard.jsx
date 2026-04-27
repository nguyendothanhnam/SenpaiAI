import { motion } from 'framer-motion'
import { Layers3, PlayCircle, PencilLine } from 'lucide-react'
import { Link } from 'react-router-dom'

const options = [
  {
    title: 'Manual create',
    description: 'Create your own front/back flashcards for targeted review.',
    to: '/flashcard/manual',
    icon: PencilLine,
    accent: 'from-indigo-500 to-sky-500',
  },
  {
    title: 'Start learning',
    description: 'Flip through cards and keep your memory active.',
    to: '/flashcard/play',
    icon: PlayCircle,
    accent: 'from-emerald-500 to-lime-500',
  },
]

export default function Flashcard() {
  return (
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-sky-500 via-cyan-500 to-teal-500 px-6 py-8 text-white">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/80">Flashcard Studio</p>
        <h1 className="mt-3 text-3xl font-semibold">Build Or Learn</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/90">
          Add flashcards manually or start a quick memory practice session.
        </p>
      </div>

      <div className="grid gap-5 px-6 py-8 md:grid-cols-2">
        {options.map((item, index) => {
          const Icon = item.icon

          return (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
            >
              <Link to={item.to} className="block h-full">
                <motion.div
                  whileHover={{ y: -6 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  className="group h-full rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 p-5 shadow-sm"
                >
                  <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${item.accent} text-white shadow-md`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h2 className="mt-5 text-lg font-semibold text-gray-900">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{item.description}</p>
                  <p className="mt-5 text-sm font-semibold text-gray-900 transition group-hover:translate-x-1">
                    Open mode ->
                  </p>
                </motion.div>
              </Link>
            </motion.div>
          )
        })}
      </div>

      <div className="px-6 pb-8 text-sm text-gray-500">
        <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2">
          <Layers3 className="h-4 w-4" />
          Flip cards daily for stronger long-term recall.
        </div>
      </div>
    </div>
  )
}
