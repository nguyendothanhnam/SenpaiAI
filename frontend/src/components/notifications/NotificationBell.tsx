import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, CheckCheck, Loader2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import { useNavigate } from 'react-router-dom'
import { notificationsAPI } from '../../services/api'
import { formatRelativeTime } from '../../utils/helpers'
import toast from 'react-hot-toast'

export default function NotificationBell() {
  const { t, i18n } = useTranslation('common')
  const language = i18n.resolvedLanguage === 'en' ? 'en' : 'vi'
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: countData } = useQuery(['notifications', 'unread-count'], () => notificationsAPI.unreadCount().then((response) => response.data), { refetchInterval: 60_000, retry: 1 })
  const { data: notifications = [], isLoading } = useQuery(['notifications', 'list'], () => notificationsAPI.list(20).then((response) => response.data), { refetchInterval: 60_000, enabled: open, retry: 1 })
  const refresh = () => {
    void queryClient.invalidateQueries(['notifications'])
  }
  const markRead = useMutation((id: number) => notificationsAPI.markRead(id), { onSuccess: refresh })
  const markAll = useMutation(() => notificationsAPI.markAllRead(), { onSuccess: refresh, onError: () => { toast.error(t('notifications.markError')) } })

  const openNotification = (item: (typeof notifications)[number]) => {
    if (!item.read_at) markRead.mutate(item.id)
    setOpen(false)
    const target = item.url?.startsWith('/') && !item.url.startsWith('//') ? item.url : '/'
    navigate(target)
  }

  return <div className="relative">
    <button type="button" onClick={() => setOpen((value) => !value)} className="relative rounded-full p-2 text-[color:var(--text-muted)] transition hover:bg-[color:var(--accent)] hover:text-[color:var(--primary)]" aria-label={t('notifications.unread', { count: countData?.unread_count ?? 0 })} aria-expanded={open}>
      <Bell className="h-5 w-5" />
      {!!countData?.unread_count && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-[color:var(--primary)] px-1 text-center text-[10px] font-bold leading-4 text-[color:var(--primary-contrast)]">{countData.unread_count > 99 ? '99+' : countData.unread_count}</span>}
    </button>
    {open && <div className="theme-card absolute right-0 top-full z-[60] mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl shadow-xl">
      <div className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-3"><h2 className="font-semibold">{t('notifications.title')}</h2><button type="button" disabled={!countData?.unread_count || markAll.isLoading} onClick={() => markAll.mutate()} className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--primary)] disabled:opacity-50"><CheckCheck className="h-4 w-4" />{t('notifications.markAll')}</button></div>
      <div className="max-h-[65vh] overflow-y-auto">
        {isLoading ? <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin" /></div> : notifications.length === 0 ? <p className="p-5 text-sm text-[color:var(--text-muted)]">{t('notifications.empty')}</p> : notifications.map((item) => {
          const kind = ['daily_task', 'streak_risk', 'review_due'].includes(item.type) ? item.type : 'unknown'
          const data = item.data as Record<string, string | number | undefined>
          const streak = Number(data.streak ?? 0)
          const reviewCount = Number(data.review_count ?? 0)
          return <button type="button" key={item.id} onClick={() => openNotification(item)} className={`block w-full border-b border-[color:var(--border)] px-4 py-3 text-left transition hover:bg-[color:var(--accent)] ${item.read_at ? 'opacity-70' : ''}`}><span className="flex items-start gap-2"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read_at ? 'bg-transparent' : 'bg-[color:var(--primary)]'}`} /><span className="min-w-0"><span className="block text-sm font-semibold">{t(`notificationTypes.${kind}.title`, { streak, count: reviewCount })}</span><span className="mt-1 block text-xs text-[color:var(--text-muted)]">{t(`notificationTypes.${kind}.body`, { streak, count: reviewCount })}</span><span className="mt-1 block text-[10px] text-[color:var(--text-muted)]">{formatRelativeTime(item.created_at, language)}</span></span></span></button>
        })}
      </div>
    </div>}
  </div>
}
