import { motion } from 'framer-motion'
import { Brain, FileUp, PencilLine, PlayCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

const options = [
  {
    title: 'Manual input',
    description: 'Create your own questions with four options and answer keys.',
    to: '/quiz/manual',
    icon: PencilLine,
    accent: 'from-orange-500 to-orange-400',
  },
  {
    title: 'Upload file',
    description: 'Upload an Excel or JSON file and auto-generate quiz rounds.',
    to: '/quiz/upload',
    icon: FileUp,
    accent: 'from-amber-500 to-amber-400',
  },
  {
    title: 'Play',
    description: 'Start now with AI or your existing saved quiz data.',
    to: '/quiz/play',
    icon: PlayCircle,
    accent: 'from-orange-500 to-amber-400',
  },
]

export default function Quiz() {
  return (
    <div className="overflow-hidden rounded-3xl border border-orange-200 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-orange-500 via-orange-400 to-amber-500 px-6 py-8 text-white">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/80">Quiz Arena</p>
        <h1 className="mt-3 text-3xl font-bold">Choose Your Quiz Flow</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/95">
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
                  className="group h-full rounded-2xl border border-orange-200 bg-gradient-to-b from-white to-orange-50 p-5 shadow-sm hover:shadow-md hover:border-orange-300 transition-all"
                >
                  <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${item.accent} text-white shadow-md`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h2 className="mt-5 text-lg font-semibold text-gray-900">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-gray-700">{item.description}</p>
                  <p className="mt-5 text-sm font-semibold text-orange-600 transition group-hover:translate-x-1">
                    Open mode &rarr;
                  </p>
                </motion.div>
              </Link>
            </motion.div>
          )
        })}
      </div>

      <div className="px-6 pb-8 text-sm text-gray-600">
        <div className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-orange-800 font-medium">
          <Brain className="h-4 w-4" />
          Tip: Uploading or manual creation can send you straight to play mode.
        </div>
      </div>
    </div>
  )
}

