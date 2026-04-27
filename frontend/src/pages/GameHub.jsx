import { motion } from 'framer-motion'
import { BookOpen, Brain, ChevronRight, Layers3 } from 'lucide-react'
import { Link } from 'react-router-dom'

const games = [
  {
    title: 'Quiz',
    description: 'Quick challenge rounds to sharpen recall and track your momentum.',
    to: '/quiz',
    icon: Brain,
    accent: 'from-orange-500 via-orange-400 to-amber-400',
    glow: 'bg-orange-100',
  },
  {
    title: 'Flashcard',
    description: 'Flip through focused review sets built for steady spaced practice.',
    to: '/flashcard',
    icon: Layers3,
    accent: 'from-amber-500 via-amber-400 to-orange-400',
    glow: 'bg-amber-100',
  },
  {
    title: 'Kanji',
    description: 'Train recognition with bite-sized character study and repetition.',
    to: '/kanji',
    icon: BookOpen,
    accent: 'from-orange-500 via-orange-400 to-amber-400',
    glow: 'bg-orange-100',
  },
]

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

export default function GameHub() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-orange-50 to-amber-50 px-6 py-10 shadow-sm ring-1 ring-orange-200 sm:px-10">
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-r from-orange-100/80 via-amber-100/70 to-orange-100/80 blur-3xl" />

      <div className="relative">
        <div className="max-w-2xl">
          <span className="inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-orange-600 ring-1 ring-orange-200 backdrop-blur">
            Learning Arcade
          </span>
          <h1 className="mt-4 text-3xl font-semibold text-orange-900 sm:text-4xl">
            Pick a study mode that fits your energy.
          </h1>
          <p className="mt-3 text-sm leading-6 text-gray-700 sm:text-base">
            Jump into a fast quiz, review with flashcards, or spend a focused session on kanji practice.
          </p>
        </div>

        <motion.div
          className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {games.map((game) => {
            const Icon = game.icon

            return (
              <motion.div key={game.title} variants={cardVariants}>
                <Link to={game.to} className="block h-full">
                  <motion.div
                    whileHover={{ y: -8, scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    className="group relative flex h-full min-h-[240px] flex-col overflow-hidden rounded-2xl border border-orange-200 bg-white/95 p-6 shadow-[0_18px_45px_-28px_rgba(194,65,12,0.35)] backdrop-blur hover:shadow-[0_20px_50px_-25px_rgba(194,65,12,0.4)] transition-shadow"
                  >
                    <div className={`absolute -right-10 -top-10 h-28 w-28 rounded-full ${game.glow} blur-2xl transition-transform duration-300 group-hover:scale-125`} />
                    <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${game.accent} text-white shadow-lg`}>
                      <Icon className="h-7 w-7" />
                    </div>

                    <div className="mt-6 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <h2 className="text-xl font-semibold text-gray-900">{game.title}</h2>
                        <ChevronRight className="mt-1 h-5 w-5 text-orange-300 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-orange-500" />
                      </div>
                      <p className="mt-3 text-sm leading-6 text-gray-700">
                        {game.description}
                      </p>
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-orange-100 pt-4 text-sm">
                      <span className="font-medium text-gray-600">Open mode</span>
                      <span className="font-semibold text-orange-600">Start now</span>
                    </div>
                  </motion.div>
                </Link>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </div>
  )
}
