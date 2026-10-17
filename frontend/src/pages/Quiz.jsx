import { motion } from 'framer-motion'
import { ArrowLeft, Brain, FileUp, PencilLine, PlayCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const options = [
  {
    titleKey: 'quiz.manual.title',
    descriptionKey: 'quiz.manual.description',
    to: '/quiz/manual',
    icon: PencilLine,
  },
  {
    titleKey: 'quiz.upload.title',
    descriptionKey: 'quiz.upload.description',
    to: '/quiz/upload',
    icon: FileUp,
  },
  {
    titleKey: 'quiz.play.title',
    descriptionKey: 'quiz.play.description',
    to: '/quiz/play',
    icon: PlayCircle,
  },
]

export default function Quiz() {
  const { t } = useTranslation('common')
  return (
    <div className="space-y-4">
      <Link to="/games" className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--card-glass)] px-4 py-2 text-sm font-semibold text-[color:var(--text)] transition hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]">
        <ArrowLeft className="h-4 w-4" /> {t('shared.backToGames')}
      </Link>

      <div className="theme-card overflow-hidden rounded-3xl shadow-sm">
      <div className="px-6 py-8" style={{ backgroundImage: 'var(--primary-gradient)', color: 'var(--primary-contrast)' }}>
        <p className="text-sm font-medium uppercase tracking-[0.2em] opacity-80">{t('quiz.eyebrow')}</p>
        <h1 className="mt-3 text-3xl font-bold">{t('quiz.title')}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 opacity-95">
          {t('quiz.subtitle')}
        </p>
      </div>

      <div className="grid gap-5 px-6 py-8 md:grid-cols-3">
        {options.map((item, index) => {
          const Icon = item.icon

          return (
            <motion.div
              key={item.titleKey}
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
                  <h2 className="mt-5 text-lg font-semibold text-[color:var(--text)]">{t(item.titleKey)}</h2>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">{t(item.descriptionKey)}</p>
                  <p className="mt-5 text-sm font-semibold text-[color:var(--primary)] transition group-hover:translate-x-1">
                    {t('gameHub.openMode')} &rarr;
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
          {t('quiz.tip')}
        </div>
      </div>
    </div>
    </div>
  )
}

