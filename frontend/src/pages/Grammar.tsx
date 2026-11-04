import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation } from 'react-query'
import { useTranslation } from 'react-i18next'
import { BookOpen, Loader2, Languages, Star, Lightbulb } from 'lucide-react'
import { analysisAPI } from '../services/api'
import toast from 'react-hot-toast'
import GrammarTabs from '../components/layout/GrammarTabs'
import { getErrorMessage } from '../utils/getErrorMessage'

interface GrammarFormData {
  text: string
}

interface GrammarAnalysis {
  text: string
  analysis_status?: 'complete' | 'partial'
  analysis_note?: string
  jlpt_level: string
  sentence_meaning?: string
  vocabulary: Array<{
    term: string
    meaning: string
    jlpt_level?: string
  }>
  grammar_patterns: Array<{
    pattern: string
    explanation: string
    example: string
  }>
  grammar_points: Array<{
    pattern: string
    explanation: string
    example: string
  }>
  translation?: string
  difficulty_score: number
  suggestions: string[]
}

export default function Grammar() {
  const { t, i18n } = useTranslation('grammar')
  const [analysis, setAnalysis] = useState<GrammarAnalysis | null>(null)
  const language = i18n.resolvedLanguage === 'en' ? 'en' : 'vi'
  const currentLanguage = useRef(language)
  currentLanguage.current = language
  
  const form = useForm<GrammarFormData>({
    defaultValues: { text: '' }
  })

  useEffect(() => {
    setAnalysis(null)
  }, [language])

  const analyzeMutation = useMutation(
    (data: { text: string; language: 'vi' | 'en' }) =>
      analysisAPI.analyzeGrammar(data.text, data.language).then(res => res.data),
    {
      onSuccess: (data, request) => {
        if (request.language !== currentLanguage.current) return
        setAnalysis(data)
        if (data.analysis_status !== 'partial') toast.success(t('analysis.success'))
      },
      onError: (error) => {
        toast.error(getErrorMessage(error))
      },
    }
  )

  const handleSubmit = (data: GrammarFormData) => {
    if (!data.text.trim()) return
    setAnalysis(null)
    analyzeMutation.mutate({ text: data.text.trim(), language })
  }

  return (
    <div className="space-y-6">
      <GrammarTabs />
      {/* Header */}
      <div className="flex items-center space-x-4">
        <div className="h-12 w-12 shrink-0 rounded-2xl bg-[color:var(--primary)] flex items-center justify-center shadow-lg">
          <BookOpen className="h-6 w-6 text-[color:var(--primary-contrast)]" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-[color:var(--text)]">{t('analysis.title')}</h1>
          <p className="text-sm text-[color:var(--text-muted)] mt-1">
            {t('analysis.subtitle')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="card bg-[color:var(--card)] border border-[color:var(--border)] rounded-2xl shadow-md hover:shadow-lg transition-shadow">
          <div className="card-header border-b border-[color:var(--border)]">
            <h2 className="card-title text-[color:var(--primary)]">{t('analysis.formTitle')}</h2>
            <p className="card-description text-[color:var(--text-muted)]">
              {t('analysis.formDescription')}
            </p>
          </div>
          <div className="card-content pt-5">
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div>
                <label htmlFor="text" className="block text-sm font-semibold text-[color:var(--text)] mb-2">
                  {t('analysis.japaneseText')}
                </label>
                <textarea
                  {...form.register('text', { required: t('analysis.textRequired') })}
                  rows={6}
                  id="text"
                  className="input !h-auto min-h-[180px] w-full resize-y border-[color:var(--border)] focus:ring-[color:var(--primary)] bg-[color:var(--bg-elevated)] text-[color:var(--text)] leading-7"
                  placeholder={t('analysis.inputPlaceholder')}
                  disabled={analyzeMutation.isLoading}
                />
                {form.formState.errors.text && (
                  <p className="mt-1 text-sm text-red-600 font-medium">
                    {form.formState.errors.text.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={analyzeMutation.isLoading || !form.watch('text')?.trim()}
                className="btn btn-primary btn-lg w-full text-[color:var(--primary-contrast)] font-semibold shadow-md hover:shadow-lg transition-all"
              >
                {analyzeMutation.isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('analysis.analyzing')}
                  </>
                ) : (
                  <>
                    <BookOpen className="mr-2 h-4 w-4" />
                    {t('analysis.analyze')}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Analysis Results */}
        <div className="space-y-6">
          {analysis ? (
            <>
                {analysis.analysis_note && <div role="status" className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--accent)] p-4 text-sm leading-7 text-[color:var(--text)]">{analysis.analysis_note}</div>}
              {/* Basic Info */}
              <div className="card bg-[color:var(--card)] border border-[color:var(--border)] rounded-2xl shadow-md">
                <div className="card-header border-b border-[color:var(--border)]">
                  <h3 className="card-title text-[color:var(--primary)]">{t('analysis.jlptLevel')}</h3>
                </div>
                <div className="card-content space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[color:var(--text)]">{t('analysis.level')}</span>
                    <span className={`jlpt-badge bg-[color:var(--accent)] text-[color:var(--primary)]`}>
                      {analysis.jlpt_level}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[color:var(--text)]">{t('analysis.difficulty')}</span>
                    <div className="flex items-center space-x-2">
                      <div className="flex">
                        {[...Array(10)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < Math.round(analysis.difficulty_score)
                                ? 'text-amber-400 fill-current'
                                : 'text-[color:var(--text-muted)]'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-medium text-[color:var(--text-muted)]">
                        {analysis.difficulty_score.toFixed(1)}/10
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sentence Meaning */}
              {(analysis.sentence_meaning || analysis.translation) && (
                <div className="card bg-[color:var(--card)] border border-[color:var(--border)] rounded-2xl shadow-md">
                  <div className="card-header border-b border-[color:var(--border)]">
                    <h3 className="card-title text-[color:var(--primary)]">{t('analysis.sentenceMeaning')}</h3>
                  </div>
                  <div className="card-content">
                    <div className="flex items-start space-x-2 p-3 bg-[color:var(--accent)] rounded-xl border-l-4 border-[color:var(--border)]">
                      <Languages className="h-4 w-4 text-[color:var(--primary)] mt-0.5 flex-shrink-0" />
                      <p className="text-sm leading-7 text-[color:var(--text)]">{analysis.sentence_meaning || analysis.translation}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Vocabulary */}
              {analysis.vocabulary?.length > 0 && (
                <div className="card bg-[color:var(--card)] border border-[color:var(--border)] rounded-2xl shadow-md">
                  <div className="card-header border-b border-[color:var(--border)]">
                    <h3 className="card-title text-[color:var(--primary)]">{t('analysis.vocabulary')}</h3>
                  </div>
                  <div className="card-content">
                    <div className="space-y-3">
                      {analysis.vocabulary.map((item, index) => (
                        <div key={`${item.term}-${index}`} className="border border-[color:var(--border)] rounded-xl p-4 bg-[color:var(--accent)]">
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="text-sm font-semibold text-[color:var(--primary)] japanese-text">
                              {item.term}
                            </h4>
                            {item.jlpt_level && (
                              <span className="jlpt-badge bg-[color:var(--accent)] text-[color:var(--primary)]">{item.jlpt_level}</span>
                            )}
                          </div>
                          <p className="mt-2 text-sm text-[color:var(--text)]">{item.meaning}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Grammar Patterns */}
              {(analysis.grammar_patterns?.length || analysis.grammar_points.length) > 0 && (
                <div className="card bg-[color:var(--card)] border border-[color:var(--border)] rounded-2xl shadow-md">
                  <div className="card-header border-b border-[color:var(--border)]">
                    <h3 className="card-title text-[color:var(--primary)]">{t('analysis.patterns')}</h3>
                  </div>
                  <div className="card-content">
                    <div className="space-y-3">
                      {(analysis.grammar_patterns?.length ? analysis.grammar_patterns : analysis.grammar_points).map((point, index) => (
                        <div key={index} className="border border-[color:var(--border)] rounded-xl p-4 bg-[color:var(--accent)] hover:shadow-md transition-shadow">
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0">
                              <div className="h-6 w-6 rounded-full bg-[color:var(--primary)] flex items-center justify-center shadow-md">
                                <span className="text-xs font-bold text-[color:var(--primary-contrast)]">
                                  {index + 1}
                                </span>
                              </div>
                            </div>
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-[color:var(--primary)] mb-1">
                                {point.pattern}
                              </h4>
                              <p className="text-sm text-[color:var(--text)] mb-2">
                                {point.explanation}
                              </p>
                              {point.example && (
                                <div className="p-2 bg-[color:var(--card)] border border-[color:var(--border)] rounded-lg text-sm japanese-text text-[color:var(--text)]">
                                  {point.example}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Learning Suggestions */}
              {analysis.suggestions.length > 0 && (
                <div className="card bg-[color:var(--card)] border border-[color:var(--border)] rounded-2xl shadow-md">
                  <div className="card-header border-b border-[color:var(--border)]">
                    <h3 className="card-title text-[color:var(--primary)]">{t('analysis.suggestions')}</h3>
                  </div>
                  <div className="card-content">
                    <div className="space-y-3">
                      {analysis.suggestions.map((suggestion, index) => (
                        <div key={index} className="flex items-start space-x-3 p-3 bg-[color:var(--accent)] rounded-lg border border-[color:var(--border)]">
                          <Lightbulb className="h-4 w-4 text-[color:var(--primary)] mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-[color:var(--text)] font-medium">{suggestion}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card bg-[color:var(--card)] border border-[color:var(--border)] rounded-2xl shadow-md">
              <div className="card-content">
                <div className="text-center py-12 text-[color:var(--text-muted)]">
                  <div className="h-16 w-16 rounded-full bg-[color:var(--accent)] flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="h-8 w-8 text-[color:var(--primary)]" />
                  </div>
                  <p className="text-lg font-semibold text-[color:var(--text)]">{t('analysis.emptyTitle')}</p>
                  <p className="text-sm text-[color:var(--text-muted)] mt-1">{t('analysis.emptyDescription')}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

