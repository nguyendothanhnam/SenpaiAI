import { motion } from 'framer-motion'
import { ArrowLeft, Brain, FileUp, PencilLine, PlayCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

const options = [
  {
    title: 'Manual input',
    description: 'Create your own questions with four options and answer keys.',
    to: '/quiz/manual',
    icon: PencilLine,
  },
  {
    title: 'Upload file',
    description: 'Upload an Excel or JSON file and auto-generate quiz rounds.',
    to: '/quiz/upload',
    icon: FileUp,
  },
  {
    title: 'Play',
    description: 'Start now with AI or your existing saved quiz data.',
    to: '/quiz/play',
    icon: PlayCircle,
  },
]

export default function Quiz() {
  return (
    <div className="space-y-4">
      <Link to="/games" className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--card-glass)] px-4 py-2 text-sm font-semibold text-[color:var(--text)] transition hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]">
        <ArrowLeft className="h-4 w-4" /> Back to Games
      </Link>

      <div className="theme-card overflow-hidden rounded-3xl shadow-sm">
      <div className="px-6 py-8" style={{ backgroundImage: 'var(--primary-gradient)', color: 'var(--primary-contrast)' }}>
        <p className="text-sm font-medium uppercase tracking-[0.2em] opacity-80">Quiz Arena</p>
        <h1 className="mt-3 text-3xl font-bold">Choose Your Quiz Flow</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 opacity-95">
          Build questions manually, upload a file, or jump directly into play mode.
        </p>
      </div>

      <div className="grid gap-5 px-6 py-8 md:grid-cols-3">
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
                  className="theme-card group h-full rounded-2xl p-5 transition-all hover:-translate-y-1 hover:border-[color:var(--primary)] hover:shadow-md"
                >
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--primary)] text-[color:var(--primary-contrast)] shadow-sm">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h2 className="mt-5 text-lg font-semibold text-[color:var(--text)]">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">{item.description}</p>
                  <p className="mt-5 text-sm font-semibold text-[color:var(--primary)] transition group-hover:translate-x-1">
                    Open mode &rarr;
                  </p>
                </motion.div>
              </Link>
            </motion.div>
          )
        })}
      </div>

      <div className="px-6 pb-8 text-sm text-[color:var(--text-muted)]">
        <div className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] px-4 py-2 font-medium text-[color:var(--text)]">
          <Brain className="h-4 w-4" />
          Tip: Uploading or manual creation can send you straight to play mode.
        </div>
      </div>
    </div>
    </div>
  )
}

