import { useEffect, useState } from 'react'
import { BellRing, Clock3, Lightbulb, Loader2, Send, Smartphone } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import toast from 'react-hot-toast'
import { pushAPI, remindersAPI, type ReminderSettings } from '../services/api'
import { getErrorMessage } from '../utils/getErrorMessage'

const DEFAULTS: ReminderSettings = {
  enabled: true, timezone: 'Asia/Ho_Chi_Minh', reminder_time: '20:00', days_of_week: [0, 1, 2, 3, 4, 5, 6],
  types: ['daily_task', 'streak_risk', 'review_due'], quiet_start: '22:00', quiet_end: '07:00', push_enabled: false, max_per_day: 3, snooze_until: null,
}
const DAYS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật']
const REMINDER_TYPES = [
  { id: 'daily_task' as const, label: 'Nhiệm vụ hằng ngày', description: 'Nhắc khi nhiệm vụ hôm nay chưa hoàn thành.' },
  { id: 'streak_risk' as const, label: 'Giữ chuỗi ngày học', description: 'Nhắc vào buổi tối nếu chuỗi học đang có nguy cơ đứt.' },
  { id: 'review_due' as const, label: 'Ôn tập nội dung', description: 'Gợi ý ôn lại những mục bạn thường trả lời sai.' },
]

function base64ToBytes(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const normalized = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(normalized)
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

function isLocalhost() { return ['localhost', '127.0.0.1'].includes(window.location.hostname) }

export default function RemindersSettings() {
  const queryClient = useQueryClient()
  const settingsQuery = useQuery(['reminders', 'settings'], () => remindersAPI.getSettings().then((response) => response.data), { retry: 1 })
  const suggestedQuery = useQuery(['reminders', 'suggested-time'], () => remindersAPI.getSuggestedTime().then((response) => response.data), { retry: 1 })
  const publicKeyQuery = useQuery(['push', 'public-key'], () => pushAPI.getPublicKey().then((response) => response.data), { retry: 1 })
  const [values, setValues] = useState<ReminderSettings>(DEFAULTS)
  const [pushState, setPushState] = useState<'unknown' | 'unsupported' | 'disabled' | 'enabled'>('unknown')
  const [pushBusy, setPushBusy] = useState(false)
  const secure = window.isSecureContext || isLocalhost()
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)

  useEffect(() => { if (settingsQuery.data) setValues(settingsQuery.data) }, [settingsQuery.data])
  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) setPushState('unsupported')
    else setPushState(Notification.permission === 'granted' ? 'enabled' : Notification.permission === 'denied' ? 'disabled' : 'unknown')
  }, [])

  const saveMutation = useMutation((payload: Partial<ReminderSettings>) => remindersAPI.updateSettings(payload).then((response) => response.data), {
    onSuccess: (updated) => { setValues(updated); queryClient.setQueryData(['reminders', 'settings'], updated); toast.success('Đã lưu cài đặt nhắc học.') },
    onError: (error) => { toast.error(getErrorMessage(error)) },
  })

  const setPatch = (patch: Partial<ReminderSettings>) => setValues((current) => ({ ...current, ...patch }))
  const toggleType = (id: ReminderSettings['types'][number]) => setPatch({ types: values.types.includes(id) ? values.types.filter((type) => type !== id) : [...values.types, id] })
  const toggleDay = (day: number) => setPatch({ days_of_week: values.days_of_week.includes(day) ? values.days_of_week.filter((value) => value !== day) : [...values.days_of_week, day].sort() })

  const enablePush = async () => {
    if (!secure) { toast.error('Web Push cần HTTPS; khi phát triển trên máy cá nhân, hãy dùng localhost.'); return }
    if (!publicKeyQuery.data?.enabled || !publicKeyQuery.data.public_key) { toast.error('Máy chủ chưa cấu hình khóa VAPID Web Push.'); return }
    setPushBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setPushState('disabled'); toast.error('Bạn chưa cấp quyền thông báo cho trình duyệt.'); return }
      const registration = await navigator.serviceWorker.register('/sw.js')
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(publicKeyQuery.data.public_key) })
      const json = subscription.toJSON()
      await pushAPI.subscribe(json)
      await remindersAPI.updateSettings({ push_enabled: true })
      setPatch({ push_enabled: true })
      setPushState('enabled')
      queryClient.invalidateQueries(['reminders'])
      toast.success('Đã bật thông báo trên trình duyệt.')
    } catch (error) { toast.error(getErrorMessage(error)) }
    finally { setPushBusy(false) }
  }

  const disablePush = async () => {
    setPushBusy(true)
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) { await pushAPI.unsubscribe(subscription.endpoint); await subscription.unsubscribe() }
      await remindersAPI.updateSettings({ push_enabled: false })
      setPatch({ push_enabled: false })
      setPushState(Notification.permission === 'denied' ? 'disabled' : 'unknown')
      toast.success('Đã tắt thông báo trên trình duyệt.')
    } catch (error) { toast.error(getErrorMessage(error)) }
    finally { setPushBusy(false) }
  }

  const sendTest = async () => {
    try { await pushAPI.test(); toast.success('Đã gửi thông báo thử. Kiểm tra thông báo của trình duyệt.') }
    catch (error) { toast.error(getErrorMessage(error)) }
  }

  if (settingsQuery.isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>

  return <section className="mx-auto max-w-4xl space-y-6 text-[color:var(--text)]">
    <header><h1 className="text-3xl font-bold">Cài đặt nhắc học</h1><p className="mt-2 text-sm text-[color:var(--text-muted)]">Chọn thời điểm và loại thông báo phù hợp với lịch học của bạn.</p></header>
    <section className="theme-card space-y-5 p-5 sm:p-6">
      <label className="flex items-center justify-between gap-4"><span><span className="block font-semibold">Bật nhắc học</span><span className="text-sm text-[color:var(--text-muted)]">Cho phép SenpaiAI gửi thông báo học tập.</span></span><input type="checkbox" checked={values.enabled} onChange={(event) => setPatch({ enabled: event.target.checked })} className="h-5 w-5 accent-[color:var(--primary)]" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Giờ nhắc chính<input type="time" value={values.reminder_time} onChange={(event) => setPatch({ reminder_time: event.target.value })} className="input mt-2 w-full" /></label>
        <label className="text-sm font-medium">Múi giờ (IANA)<input value={values.timezone} onChange={(event) => setPatch({ timezone: event.target.value })} placeholder="Asia/Ho_Chi_Minh" className="input mt-2 w-full" /></label>
      </div>
      <div><h2 className="mb-2 font-semibold">Ngày nhận nhắc</h2><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{DAYS.map((label, index) => { const day = (index + 1) % 7; return <label key={label} className="flex items-center gap-2 rounded-xl border border-[color:var(--border)] p-2 text-sm"><input type="checkbox" checked={values.days_of_week.includes(day)} onChange={() => toggleDay(day)} />{label}</label> })}</div></div>
      <div><h2 className="mb-2 font-semibold">Loại lời nhắc</h2><div className="space-y-3">{REMINDER_TYPES.map((item) => <label key={item.id} className="flex items-start justify-between gap-4 rounded-xl border border-[color:var(--border)] p-3"><span><span className="block text-sm font-semibold">{item.label}</span><span className="text-xs text-[color:var(--text-muted)]">{item.description}</span></span><input type="checkbox" checked={values.types.includes(item.id)} onChange={() => toggleType(item.id)} className="mt-1 h-4 w-4" /></label>)}</div></div>
      <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-medium">Bắt đầu giờ yên lặng<input type="time" value={values.quiet_start} onChange={(event) => setPatch({ quiet_start: event.target.value })} className="input mt-2 w-full" /></label><label className="text-sm font-medium">Kết thúc giờ yên lặng<input type="time" value={values.quiet_end} onChange={(event) => setPatch({ quiet_end: event.target.value })} className="input mt-2 w-full" /></label><label className="text-sm font-medium">Tối đa mỗi ngày<input type="number" min={1} max={20} value={values.max_per_day} onChange={(event) => setPatch({ max_per_day: Number(event.target.value) })} className="input mt-2 w-full" /></label></div>
      <button type="button" onClick={() => saveMutation.mutate(values)} disabled={saveMutation.isLoading} className="btn btn-primary inline-flex items-center gap-2">{saveMutation.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}Lưu cài đặt</button>
    </section>

    <section className="theme-card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6"><div className="flex items-start gap-3"><Lightbulb className="mt-1 h-5 w-5 text-[color:var(--primary)]" /><div><h2 className="font-semibold">Gợi ý giờ học</h2>{suggestedQuery.data?.suggested_time ? <p className="mt-1 text-sm text-[color:var(--text-muted)]">Bạn thường học lúc {suggestedQuery.data.suggested_time} ({suggestedQuery.data.sample_count} lần ghi nhận).</p> : <p className="mt-1 text-sm text-[color:var(--text-muted)]">Cần thêm hoạt động học để gợi ý giờ phù hợp.</p>}</div></div>{suggestedQuery.data?.suggested_time && <button type="button" onClick={() => setPatch({ reminder_time: suggestedQuery.data!.suggested_time! })} className="btn btn-outline btn-sm">Dùng giờ này</button>}</section>

    <section className="theme-card space-y-4 p-5 sm:p-6"><div className="flex items-start gap-3"><BellRing className="mt-1 h-5 w-5 text-[color:var(--primary)]" /><div><h2 className="font-semibold">Thông báo trình duyệt</h2><p className="mt-1 text-sm text-[color:var(--text-muted)]">Trạng thái: {pushState === 'enabled' ? 'đã cấp quyền' : pushState === 'unsupported' ? 'trình duyệt không hỗ trợ Web Push' : pushState === 'disabled' ? 'đang bị chặn' : 'chưa bật'}.</p></div></div>
      {!secure && <p className="rounded-xl bg-[color:var(--accent)] p-3 text-sm">Web Push cần HTTPS; localhost được hỗ trợ khi phát triển.</p>}
      {ios && !standalone && <p className="inline-flex items-start gap-2 rounded-xl bg-[color:var(--accent)] p-3 text-sm"><Smartphone className="h-4 w-4 shrink-0" />Trên iPhone/iPad, hãy thêm ứng dụng vào Màn hình chính trước khi bật thông báo.</p>}
      {publicKeyQuery.data && !publicKeyQuery.data.enabled && <p className="text-sm text-[color:var(--text-muted)]">Máy chủ chưa cấu hình VAPID, vì vậy chưa thể đăng ký Web Push.</p>}
      <div className="flex flex-wrap gap-2">{pushState === 'enabled' && values.push_enabled ? <button type="button" onClick={disablePush} disabled={pushBusy} className="btn btn-outline">Tắt Web Push</button> : <button type="button" onClick={enablePush} disabled={pushBusy || pushState === 'unsupported'} className="btn btn-primary">{pushBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellRing className="mr-2 h-4 w-4" />}Bật Web Push</button>}{values.push_enabled && <button type="button" onClick={sendTest} className="btn btn-outline"><Send className="mr-2 h-4 w-4" />Gửi thử</button>}</div>
      <p className="inline-flex items-center gap-2 text-xs text-[color:var(--text-muted)]"><Clock3 className="h-4 w-4" />Thông báo trong ứng dụng sẽ xuất hiện ở biểu tượng chuông trên thanh đầu trang.</p>
    </section>
  </section>
}
