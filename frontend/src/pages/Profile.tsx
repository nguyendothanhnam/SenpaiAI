import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PlacementEntry } from '../components/placement/PlacementEntry'
import PlacementProfileSummary from '../components/placement/PlacementProfileSummary'
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
import ActivityCalendar from '../components/profile/ActivityCalendar'
import PersonalExport from '../components/profile/PersonalExport'
import { appCalendarDate } from '../utils/profileCalendar'

interface ProfileFormData {
  username: string
  learning_goals: string[]
}

export default function Profile() {
  const { t } = useTranslation('profile')
  const { t: c } = useTranslation('common')
  const { user } = useAuth()
  const { data: rewardProfile } = useRewardsMe(user?.id)
  const { data: historyResult, isLoading: historyLoading, isError: historyError, refetch: refetchHistory } = useQuery(['daily', 'history', user?.id, 30], async () => {
    const response = await dailyAPI.getHistory(30)
    const serverInstant = response.headers.date ? new Date(response.headers.date) : null
    const serverDate = serverInstant ? appCalendarDate(serverInstant) : undefined
    return { entries: response.data, serverDate }
  }, { enabled: Boolean(user?.id), retry: 1 })
  const dailyHistory = historyResult?.entries || []
  const queryClient = useQueryClient()
  const [newGoal, setNewGoal] = useState('')

  const form = useForm<ProfileFormData>({
    defaultValues: {
      username: user?.username || '',
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

  const calendarEnd = historyResult?.serverDate || appCalendarDate()

  return (
    <div className="space-y-6">
      <PlacementEntry />
      <PlacementProfileSummary />
      <Link to="/analytics" className="theme-card flex min-h-[56px] items-center justify-between gap-3 rounded-2xl p-5 font-semibold text-[color:var(--primary)] focus-visible:ring-2 focus-visible:ring-[color:var(--primary)] motion-reduce:transition-none"><span>{c('learning.title')}</span><span aria-hidden="true">→</span></Link>
      <p className="text-sm text-[color:var(--text-muted)]">{t('pointsExplanation')}</p>
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
          {historyLoading ? <p role="status" className="text-sm text-[color:var(--text-muted)]">{t('calendarLoading')}</p> : historyError ? <div role="alert" className="space-y-3 text-sm text-[color:var(--text-muted)]"><p>{t('calendarError')}</p><button type="button" className="min-h-[44px] font-semibold text-[color:var(--primary)] underline" onClick={() => void refetchHistory()}>{t('calendarRetry')}</button></div> : <ActivityCalendar endDate={calendarEnd} history={dailyHistory} />}
        </div>
      </section>
      {/* Header */}
      <div className="flex items-center space-x-4">
        <div className="h-12 w-12 rounded-2xl bg-[color:var(--primary)] flex items-center justify-center shadow-lg">
          <User className="h-6 w-6 text-[color:var(--primary-contrast)]" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-[color:var(--primary)]">{t('title')}</h1>
          <p className="text-sm text-[color:var(--text-muted)] mt-1">
            {t('subtitle')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Form */}
        <div className="lg:col-span-2">
          <div className="card bg-[color:var(--card)] border border-[color:var(--border)] rounded-2xl shadow-md hover:shadow-lg transition-shadow">
            <div className="card-header border-b border-[color:var(--border)]">
              <h2 className="card-title text-[color:var(--primary)]">{t('accountInformation')}</h2>
              <p className="card-description text-[color:var(--text-muted)]">
                {t('accountDescription')}
              </p>
            </div>
            <div className="card-content">
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-[color:var(--text)] mb-2">
                    {t('email')}
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="input w-full bg-[color:var(--bg-elevated)] border-[color:var(--border)] text-[color:var(--text-muted)]"
                  />
                  <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                    {t('emailImmutable')}
                  </p>
                </div>

                <div>
                  <label htmlFor="username" className="block text-sm font-semibold text-[color:var(--text)] mb-2">
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
                    className="input w-full border-[color:var(--border)] focus:ring-[color:var(--primary)] bg-[color:var(--accent)]"
                    placeholder={t('usernamePlaceholder')}
                  />
                  {form.formState.errors.username && (
                    <p className="mt-1 text-sm text-red-600 font-medium">
                      {t(form.formState.errors.username.message || '')}
                    </p>
                  )}
                </div>

                <div>
                  <p className="block text-sm font-semibold text-[color:var(--text)] mb-2">
                    {t('currentLevel')}
                  </p>
                  <p className="rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] p-3">{user?.current_jlpt_level}</p>
                  <p className="mt-2 text-sm text-[color:var(--text-muted)]">{t('levelFromPlacement')}</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[color:var(--text)] mb-2">
                    {t('learningGoals')}
                  </label>
                  <div className="space-y-3">
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={newGoal}
                        onChange={(e) => setNewGoal(e.target.value)}
                        placeholder={t('goalPlaceholder')}
                        className="input flex-1 border-[color:var(--border)] focus:ring-[color:var(--primary)] bg-[color:var(--accent)]"
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addGoal())}
                      />
                      <button
                        type="button"
                        onClick={addGoal}
                        className="btn btn-outline border-[color:var(--border)] text-[color:var(--primary)] hover:bg-[color:var(--accent)] font-semibold"
                        disabled={!newGoal.trim()}
                      >
                        {t('add')}
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      {form.watch('learning_goals').map((goal, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-[color:var(--accent)] border border-[color:var(--border)] rounded-lg">
                          <span className="text-sm text-[color:var(--text)] font-medium">{goal}</span>
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
                  className="btn btn-primary w-full bg-[image:var(--primary-gradient)] hover:from-[color:var(--primary)] hover:to-[color:var(--accent)] text-[color:var(--primary-contrast)] font-semibold shadow-md hover:shadow-lg transition-all"
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
          <div className="card bg-[color:var(--card)] border border-[color:var(--border)] rounded-2xl shadow-md">
            <div className="card-header border-b border-[color:var(--border)]">
              <h3 className="card-title text-[color:var(--primary)]">{t('accountInformation')}</h3>
            </div>
            <div className="card-content space-y-4">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 rounded-full bg-[color:var(--primary)] flex items-center justify-center shadow-md">
                  <span className="text-lg font-bold text-[color:var(--primary-contrast)]">
                    {user?.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-[color:var(--text)]">{user?.username}</p>
                  <p className="text-sm text-[color:var(--text-muted)]">{user?.email}</p>
                </div>
              </div>
              
              <div className="space-y-3 pt-2 border-t border-[color:var(--border)]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[color:var(--text-muted)]">{t('memberSince')}</span>
                  <span className="text-sm font-semibold text-[color:var(--text)]">
                    {user?.created_at ? formatDate(user.created_at) : c('notAvailable')}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[color:var(--text-muted)]">{t('currentLevelShort')}</span>
                  <span className="inline-block px-3 py-1 bg-[color:var(--accent)] text-[color:var(--primary)] rounded-full text-sm font-semibold">
                    {user?.current_jlpt_level}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[color:var(--text-muted)]">{t('learningGoals')}</span>
                  <span className="text-sm font-semibold text-[color:var(--text)] bg-amber-100 px-2 py-1 rounded">
                    {user?.learning_goals?.length || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Learning Progress */}
          <div className="card bg-[color:var(--card)] border border-[color:var(--border)] rounded-2xl shadow-md">
            <div className="card-header border-b border-[color:var(--border)]">
              <h3 className="card-title text-[color:var(--primary)]">{t('progress')}</h3>
            </div>
            <div className="card-content space-y-4">
              <div className="flex items-center space-x-3 p-3 bg-[color:var(--accent)] rounded-lg border border-[color:var(--border)]">
                <Trophy className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-sm font-semibold text-[color:var(--text)]">{t('currentLevel')}</p>
                  <p className="text-xs text-[color:var(--text-muted)]">
                    {user?.current_jlpt_level} - {t(`jlptDescriptions.${user?.current_jlpt_level || 'N5'}`)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-[color:var(--accent)] rounded-lg border border-[color:var(--border)]">
                <Target className="h-8 w-8 text-[color:var(--primary)]" />
                <div>
                  <p className="text-sm font-semibold text-[color:var(--text)]">{t('learningGoals')}</p>
                  <p className="text-xs text-[color:var(--text-muted)]">
                    {user?.learning_goals?.length || 0} {t('goalSet')}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-[color:var(--accent)] rounded-lg border border-[color:var(--border)]">
                <MessageCircle className="h-8 w-8 text-[color:var(--primary)]" />
                <div>
                  <p className="text-sm font-semibold text-[color:var(--text)]">{t('chatSessions')}</p>
                  <p className="text-xs text-[color:var(--text-muted)]">{t('chatDescription')}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-[color:var(--accent)] rounded-lg border border-[color:var(--border)]">
                <BookOpen className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-sm font-semibold text-[color:var(--text)]">{t('studyMaterials')}</p>
                  <p className="text-xs text-[color:var(--text-muted)]">{t('studyDescription')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card bg-[color:var(--card)] border border-[color:var(--border)] rounded-2xl shadow-md">
            <div className="card-header border-b border-[color:var(--border)]">
              <h3 className="card-title text-[color:var(--primary)]">{t('quickActions')}</h3>
            </div>
            <div className="card-content space-y-2">
              <PersonalExport />
              <button className="w-full btn btn-outline btn-sm border-[color:var(--border)] text-[color:var(--primary)] hover:bg-[color:var(--accent)] font-semibold transition-colors">
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

