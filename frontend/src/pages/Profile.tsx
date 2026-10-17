import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from 'react-query'
import { 
  User, 
  Save, 
  Loader2, 
  Target, 
  Trophy,
  BookOpen,
  MessageCircle,
  Coins,
  Flame,
  CalendarDays
} from 'lucide-react'
import { authAPI, dailyAPI } from '../services/api'
import { useAuth } from '../services/auth'
import { formatDate } from '../utils/helpers'
import toast from 'react-hot-toast'
import { useQuery } from 'react-query'
import { useRewardsMe } from '../services/rewards'
import { useTranslation } from 'react-i18next'
import { getErrorMessage } from '../utils/getErrorMessage'

interface ProfileFormData {
  username: string
  current_jlpt_level: string
  learning_goals: string[]
}

const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

export default function Profile() {
  const { t } = useTranslation('profile')
  const { t: c } = useTranslation('common')
  const { user } = useAuth()
  const { data: rewardProfile } = useRewardsMe(user?.id)
  const { data: historyResult } = useQuery(['daily', 'history', user?.id, 30], async () => {
    const response = await dailyAPI.getHistory(30)
    const serverInstant = response.headers.date ? new Date(response.headers.date) : null
    const parts = serverInstant ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(serverInstant) : []
    const serverDate = parts.length ? `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}` : null
    return { entries: response.data, serverDate }
  }, { enabled: Boolean(user?.id), retry: 1 })
  const dailyHistory = historyResult?.entries || []
  const queryClient = useQueryClient()
  const [newGoal, setNewGoal] = useState('')

  const form = useForm<ProfileFormData>({
    defaultValues: {
      username: user?.username || '',
      current_jlpt_level: user?.current_jlpt_level || 'N5',
      learning_goals: user?.learning_goals || [],
    }
  })

  const updateProfileMutation = useMutation(
    (data: ProfileFormData) => authAPI.updateMe(data).then(res => res.data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['auth'])
        toast.success(t('profileUpdated'))
      },
      onError: (error: any) => {
        toast.error(getErrorMessage(error))
      },
    }
  )

  const handleSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data)
  }

  const addGoal = () => {
    if (!newGoal.trim()) return
    
    const currentGoals = form.getValues('learning_goals')
    if (currentGoals.includes(newGoal.trim())) {
      toast.error(t('duplicateGoal'))
      return
    }
    
    form.setValue('learning_goals', [...currentGoals, newGoal.trim()])
    setNewGoal('')
  }

  const removeGoal = (index: number) => {
    const currentGoals = form.getValues('learning_goals')
    form.setValue('learning_goals', currentGoals.filter((_, i) => i !== index))
  }

  const calendarEnd = historyResult?.serverDate || rewardProfile?.last_completed_date || dailyHistory[0]?.date
  const calendarDates = calendarEnd ? Array.from({ length: 30 }, (_, index) => {
    const [year, month, day] = calendarEnd.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    date.setUTCDate(date.getUTCDate() - 29 + index)
    return date.toISOString().slice(0, 10)
  }) : []
  const historyMap = new Map(dailyHistory.map((entry) => [entry.date, entry]))

  return (
    <div className="space-y-6">
      <section className="theme-card rounded-3xl p-5 shadow-[var(--shadow-card)] sm:p-7">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[color:var(--accent)]"><Trophy className="h-5 w-5 text-[color:var(--primary)]" /></div>
          <div><h2 className="text-xl font-bold text-[color:var(--text)]">{t('rewards')}</h2><p className="mt-1 text-sm text-[color:var(--text-muted)]">{t('rewardsDescription')}</p></div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4"><Coins className="h-6 w-6 text-[color:var(--primary)]" /><div><p className="text-xs text-[color:var(--text-muted)]">{t('pointsBalance')}</p><p className="text-xl font-extrabold text-[color:var(--text)]">{rewardProfile?.points_balance ?? '—'}</p></div></div>
          <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4"><Flame className="h-6 w-6 text-[color:var(--primary)]" /><div><p className="text-xs text-[color:var(--text-muted)]">{t('currentStreak')}</p><p className="text-xl font-extrabold text-[color:var(--text)]">{rewardProfile?.current_streak ?? 0} {c('days')}</p></div></div>
          <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4"><CalendarDays className="h-6 w-6 text-[color:var(--primary)]" /><div><p className="text-xs text-[color:var(--text-muted)]">{t('longestStreak')}</p><p className="text-xl font-extrabold text-[color:var(--text)]">{rewardProfile?.longest_streak ?? 0} {c('days')}</p></div></div>
        </div>
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-bold text-[color:var(--text)]">{t('calendar')}</h3>
          {calendarDates.length ? <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">{calendarDates.map((date) => {
            const entry = historyMap.get(date)
            return <div key={date} title={`${date}${entry ? ` · ${entry.points_awarded} điểm` : ''}`} className={`grid aspect-square place-items-center rounded-xl border text-[10px] font-semibold sm:text-xs ${entry ? 'border-[color:var(--primary)] bg-[color:var(--accent)] text-[color:var(--primary)]' : 'border-[color:var(--border)] bg-[color:var(--bg-elevated)] text-[color:var(--text-muted)]'}`}><span>{Number(date.slice(-2))}</span>{entry && <Flame className="h-3 w-3" />}</div>
          })}</div> : <p className="rounded-xl bg-[color:var(--bg-elevated)] p-4 text-sm text-[color:var(--text-muted)]">{t('calendarEmpty')}</p>}
        </div>
      </section>
      {/* Header */}
      <div className="flex items-center space-x-4">
        <div className="h-12 w-12 rounded-2xl bg-[color:var(--primary)] flex items-center justify-center shadow-lg">
          <User className="h-6 w-6 text-[color:var(--primary-contrast)]" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-[color:var(--primary)]">{t('title')}</h1>
          <p className="text-sm text-gray-600 mt-1">
            {t('subtitle')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Form */}
        <div className="lg:col-span-2">
          <div className="card bg-white border border-orange-100 rounded-2xl shadow-md hover:shadow-lg transition-shadow">
            <div className="card-header border-b border-orange-100">
              <h2 className="card-title text-orange-900">{t('accountInformation')}</h2>
              <p className="card-description text-gray-600">
                {t('accountDescription')}
              </p>
            </div>
            <div className="card-content">
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('email')}
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="input w-full bg-gray-100 border-gray-300 text-gray-600"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {t('emailImmutable')}
                  </p>
                </div>

                <div>
                  <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('username')}
                  </label>
                  <input
                    {...form.register('username', {
                      required: 'usernameRequired',
                      minLength: { value: 3, message: 'usernameMin' },
                      maxLength: { value: 20, message: 'usernameMax' },
                      pattern: {
                        value: /^[a-zA-Z0-9_]+$/,
                        message: 'usernamePattern'
                      }
                    })}
                    type="text"
                    className="input w-full border-orange-200 focus:ring-orange-300 bg-orange-50"
                    placeholder={t('usernamePlaceholder')}
                  />
                  {form.formState.errors.username && (
                    <p className="mt-1 text-sm text-red-600 font-medium">
                      {t(form.formState.errors.username.message || '')}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="current_jlpt_level" className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('currentLevel')}
                  </label>
                  <select
                    {...form.register('current_jlpt_level', { required: 'levelRequired' })}
                    className="input w-full border-orange-200 focus:ring-orange-300 bg-orange-50"
                  >
                    {JLPT_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level} - {t(`jlptDescriptions.${level}`)}
                      </option>
                    ))}
                  </select>
                  {form.formState.errors.current_jlpt_level && (
                    <p className="mt-1 text-sm text-red-600 font-medium">
                      {t(form.formState.errors.current_jlpt_level.message || '')}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('learningGoals')}
                  </label>
                  <div className="space-y-3">
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={newGoal}
                        onChange={(e) => setNewGoal(e.target.value)}
                        placeholder={t('goalPlaceholder')}
                        className="input flex-1 border-orange-200 focus:ring-orange-300 bg-orange-50"
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addGoal())}
                      />
                      <button
                        type="button"
                        onClick={addGoal}
                        className="btn btn-outline border-orange-300 text-orange-600 hover:bg-orange-50 font-semibold"
                        disabled={!newGoal.trim()}
                      >
                        {t('add')}
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      {form.watch('learning_goals').map((goal, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-orange-50 border border-orange-100 rounded-lg">
                          <span className="text-sm text-gray-800 font-medium">{goal}</span>
                          <button
                            type="button"
                            onClick={() => removeGoal(index)}
                            className="text-red-500 hover:text-red-700 font-bold transition-colors"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={updateProfileMutation.isLoading}
                  className="btn btn-primary w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  {updateProfileMutation.isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {c('saving')}
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      {c('save')}
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Profile Stats */}
        <div className="space-y-6">
          {/* Account Info */}
          <div className="card bg-white border border-orange-100 rounded-2xl shadow-md">
            <div className="card-header border-b border-orange-100">
              <h3 className="card-title text-orange-900">{t('accountInformation')}</h3>
            </div>
            <div className="card-content space-y-4">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 rounded-full bg-[color:var(--primary)] flex items-center justify-center shadow-md">
                  <span className="text-lg font-bold text-[color:var(--primary-contrast)]">
                    {user?.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{user?.username}</p>
                  <p className="text-sm text-gray-600">{user?.email}</p>
                </div>
              </div>
              
              <div className="space-y-3 pt-2 border-t border-orange-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">{t('memberSince')}</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {user?.created_at ? formatDate(user.created_at) : c('notAvailable')}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">{t('currentLevelShort')}</span>
                  <span className="inline-block px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold">
                    {user?.current_jlpt_level}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">{t('learningGoals')}</span>
                  <span className="text-sm font-semibold text-gray-900 bg-amber-100 px-2 py-1 rounded">
                    {user?.learning_goals?.length || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Learning Progress */}
          <div className="card bg-white border border-orange-100 rounded-2xl shadow-md">
            <div className="card-header border-b border-orange-100">
              <h3 className="card-title text-orange-900">{t('progress')}</h3>
            </div>
            <div className="card-content space-y-4">
              <div className="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                <Trophy className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{t('currentLevel')}</p>
                  <p className="text-xs text-gray-600">
                    {user?.current_jlpt_level} - {t(`jlptDescriptions.${user?.current_jlpt_level || 'N5'}`)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                <Target className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{t('learningGoals')}</p>
                  <p className="text-xs text-gray-600">
                    {user?.learning_goals?.length || 0} {t('goalSet')}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                <MessageCircle className="h-8 w-8 text-orange-400" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{t('chatSessions')}</p>
                  <p className="text-xs text-gray-600">{t('chatDescription')}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                <BookOpen className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{t('studyMaterials')}</p>
                  <p className="text-xs text-gray-600">{t('studyDescription')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card bg-white border border-orange-100 rounded-2xl shadow-md">
            <div className="card-header border-b border-orange-100">
              <h3 className="card-title text-orange-900">{t('quickActions')}</h3>
            </div>
            <div className="card-content space-y-2">
              <button className="w-full btn btn-outline btn-sm border-orange-300 text-orange-600 hover:bg-orange-50 font-semibold transition-colors">
                {t('export')}
              </button>
              <button className="w-full btn btn-outline btn-sm border-orange-300 text-orange-600 hover:bg-orange-50 font-semibold transition-colors">
                {t('reset')}
              </button>
              <button className="w-full btn btn-outline btn-sm border-red-300 text-red-600 hover:bg-red-50 font-semibold transition-colors">
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

