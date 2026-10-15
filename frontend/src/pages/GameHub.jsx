import { motion } from 'framer-motion'
import { BookOpen, Brain, ChevronRight, Layers3 } from 'lucide-react'
import { Link } from 'react-router-dom'

const games = [
  {
    title: 'Quiz',
    description: 'Quick challenge rounds to sharpen recall and track your momentum.',
    to: '/quiz',
    icon: Brain,
  },
  {
    title: 'Flashcard',
    description: 'Flip through focused review sets built for steady spaced practice.',
    to: '/flashcard',
    icon: Layers3,
  },
  {
    title: 'Kanji',
    description: 'Train recognition with bite-sized character study and repetition.',
    to: '/games/kanji',
    icon: BookOpen,
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
    <div className="theme-card relative overflow-hidden rounded-3xl px-6 py-10 sm:px-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[color:var(--accent)] opacity-40 blur-3xl" />

      <div className="relative">
        <div className="max-w-2xl">
          <span className="inline-flex items-center rounded-full border border-[color:var(--border)] bg-[color:var(--accent)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--primary)] backdrop-blur">
            Learning Arcade
          </span>
          <h1 className="mt-4 text-3xl font-semibold text-[color:var(--text)] sm:text-4xl">
            Pick a study mode that fits your energy.
          </h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)] sm:text-base">
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
                    className="theme-card group relative flex h-full min-h-[240px] flex-col overflow-hidden rounded-2xl p-6 transition-all hover:-translate-y-1 hover:border-[color:var(--primary)]"
                  >
                    <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[color:var(--accent)] opacity-60 blur-2xl transition-transform duration-300 group-hover:scale-125" />
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--primary)] text-[color:var(--primary-contrast)] shadow-sm">
                      <Icon className="h-7 w-7" />
                    </div>

                    <div className="mt-6 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <h2 className="text-xl font-semibold text-[color:var(--text)]">{game.title}</h2>
                        <ChevronRight className="mt-1 h-5 w-5 text-[color:var(--text-muted)] transition-transform duration-300 group-hover:translate-x-1 group-hover:text-[color:var(--primary)]" />
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)]">
                        {game.description}
                      </p>
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-[color:var(--border)] pt-4 text-sm">
                      <span className="font-medium text-[color:var(--text-muted)]">Open mode</span>
                      <span className="font-semibold text-[color:var(--primary)]">Start now</span>
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
