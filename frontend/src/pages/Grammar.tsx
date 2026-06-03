import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation } from 'react-query'
import { BookOpen, Loader2, Languages, Star, Lightbulb } from 'lucide-react'
import { analysisAPI } from '../services/api'
import toast from 'react-hot-toast'

interface GrammarFormData {
  text: string
  includeTranslation: boolean
}

interface GrammarAnalysis {
  text: string
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
  const [analysis, setAnalysis] = useState<GrammarAnalysis | null>(null)
  
  const form = useForm<GrammarFormData>({
    defaultValues: {
      includeTranslation: false,
    }
  })

  const analyzeMutation = useMutation(
    (data: { text: string; includeTranslation: boolean }) =>
      analysisAPI.analyzeGrammar(data.text, data.includeTranslation).then(res => res.data),
    {
      onSuccess: (data) => {
        setAnalysis(data)
        toast.success('Grammar analysis completed!')
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.detail || 'Failed to analyze grammar')
      },
    }
  )

  const handleSubmit = (data: GrammarFormData) => {
    if (!data.text.trim()) return
    analyzeMutation.mutate(data)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg">
          <BookOpen className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">Grammar Analysis</h1>
          <p className="text-sm text-gray-600 mt-1">
            Analyze Japanese text for grammar patterns, JLPT level, and difficulty
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="card bg-white border border-orange-100 rounded-2xl shadow-md hover:shadow-lg transition-shadow">
          <div className="card-header border-b border-orange-100">
            <h2 className="card-title text-orange-900">Analyze Japanese Text</h2>
            <p className="card-description text-gray-600">
              Enter Japanese text to get detailed grammar analysis
            </p>
          </div>
          <div className="card-content">
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div>
                <label htmlFor="text" className="block text-sm font-semibold text-gray-700 mb-2">
                  Japanese Text
                </label>
                <textarea
                  {...form.register('text', { required: 'Text is required' })}
                  rows={6}
                  className="input w-full resize-none border-orange-200 focus:ring-orange-300 bg-orange-50"
                  placeholder="Enter Japanese text to analyze..."
                  disabled={analyzeMutation.isLoading}
                />
                {form.formState.errors.text && (
                  <p className="mt-1 text-sm text-red-600 font-medium">
                    {form.formState.errors.text.message}
                  </p>
                )}
              </div>

              <div className="flex items-center">
                <input
                  {...form.register('includeTranslation')}
                  type="checkbox"
                  id="includeTranslation"
                  className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-orange-300 rounded"
                />
                <label htmlFor="includeTranslation" className="ml-2 block text-sm text-gray-700 font-medium">
                  Include Vietnamese translation
                </label>
              </div>

              <button
                type="submit"
                disabled={analyzeMutation.isLoading || !form.watch('text')?.trim()}
                className="btn btn-primary w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold shadow-md hover:shadow-lg transition-all"
              >
                {analyzeMutation.isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <BookOpen className="mr-2 h-4 w-4" />
                    Analyze Grammar
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
              {/* Basic Info */}
              <div className="card bg-white border border-orange-100 rounded-2xl shadow-md">
                <div className="card-header border-b border-orange-100">
                  <h3 className="card-title text-orange-900">JLPT Level</h3>
                </div>
                <div className="card-content space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Level:</span>
                    <span className={`jlpt-badge bg-orange-100 text-orange-700`}>
                      {analysis.jlpt_level}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Difficulty Score:</span>
                    <div className="flex items-center space-x-2">
                      <div className="flex">
                        {[...Array(10)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < Math.round(analysis.difficulty_score)
                                ? 'text-amber-400 fill-current'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-medium text-gray-600">
                        {analysis.difficulty_score.toFixed(1)}/10
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sentence Meaning */}
              {(analysis.sentence_meaning || analysis.translation) && (
                <div className="card bg-white border border-orange-100 rounded-2xl shadow-md">
                  <div className="card-header border-b border-orange-100">
                    <h3 className="card-title text-orange-900">Sentence Meaning</h3>
                  </div>
                  <div className="card-content">
                    <div className="flex items-start space-x-2 p-3 bg-orange-50 rounded-xl border-l-4 border-orange-400">
                      <Languages className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-orange-900">{analysis.sentence_meaning || analysis.translation}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Vocabulary */}
              {analysis.vocabulary?.length > 0 && (
                <div className="card bg-white border border-orange-100 rounded-2xl shadow-md">
                  <div className="card-header border-b border-orange-100">
                    <h3 className="card-title text-orange-900">Vocabulary</h3>
                  </div>
                  <div className="card-content">
                    <div className="space-y-3">
                      {analysis.vocabulary.map((item, index) => (
                        <div key={`${item.term}-${index}`} className="border border-orange-100 rounded-xl p-4 bg-gradient-to-br from-orange-50 to-white">
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="text-sm font-semibold text-orange-900 japanese-text">
                              {item.term}
                            </h4>
                            {item.jlpt_level && (
                              <span className="jlpt-badge bg-orange-100 text-orange-700">{item.jlpt_level}</span>
                            )}
                          </div>
                          <p className="mt-2 text-sm text-gray-700">{item.meaning}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Grammar Patterns */}
              {(analysis.grammar_patterns?.length || analysis.grammar_points.length) > 0 && (
                <div className="card bg-white border border-orange-100 rounded-2xl shadow-md">
                  <div className="card-header border-b border-orange-100">
                    <h3 className="card-title text-orange-900">Grammar Patterns</h3>
                  </div>
                  <div className="card-content">
                    <div className="space-y-3">
                      {(analysis.grammar_patterns?.length ? analysis.grammar_patterns : analysis.grammar_points).map((point, index) => (
                        <div key={index} className="border border-orange-100 rounded-xl p-4 bg-gradient-to-br from-orange-50 to-white hover:shadow-md transition-shadow">
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0">
                              <div className="h-6 w-6 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center shadow-md">
                                <span className="text-xs font-bold text-white">
                                  {index + 1}
                                </span>
                              </div>
                            </div>
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-orange-900 mb-1">
                                {point.pattern}
                              </h4>
                              <p className="text-sm text-gray-700 mb-2">
                                {point.explanation}
                              </p>
                              {point.example && (
                                <div className="p-2 bg-white border border-orange-100 rounded-lg text-sm japanese-text text-gray-900">
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
                <div className="card bg-white border border-orange-100 rounded-2xl shadow-md">
                  <div className="card-header border-b border-orange-100">
                    <h3 className="card-title text-orange-900">Learning Suggestions</h3>
                  </div>
                  <div className="card-content">
                    <div className="space-y-3">
                      {analysis.suggestions.map((suggestion, index) => (
                        <div key={index} className="flex items-start space-x-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                          <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-gray-800 font-medium">{suggestion}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card bg-white border border-orange-100 rounded-2xl shadow-md">
              <div className="card-content">
                <div className="text-center py-12 text-gray-500">
                  <div className="h-16 w-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="h-8 w-8 text-orange-400" />
                  </div>
                  <p className="text-lg font-semibold text-gray-700">No analysis yet</p>
                  <p className="text-sm text-gray-500 mt-1">Enter Japanese text to get started</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

