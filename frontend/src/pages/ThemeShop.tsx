import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from 'react-query'
import toast from 'react-hot-toast'
import { Check, Coins, Eye, Lock, Moon, Sun } from 'lucide-react'
import { useAuth } from '../services/auth'
import { rewardsAPI, RewardsMe, ShopItem } from '../services/api'
import { rewardsMeKey, rewardsShopKey, useRewardsMe, useRewardsShop } from '../services/rewards'
import { useTheme } from '../themes/ThemeProvider'
import { themes, themeBackgrounds } from '../themes/themes'
import type { ThemeBackground, ThemeDefinition } from '../themes/themes'

type ShopTab = 'themes' | 'backgrounds'
type PreviewMode = 'light' | 'dark'

export default function ThemeShop() {
  const { user } = useAuth()
  const me = useRewardsMe(user?.id)
  const shop = useRewardsShop(user?.id)
  const queryClient = useQueryClient()
  const { themeId, backgroundId, setTheme, setBackground } = useTheme()
  const [tab, setTab] = useState<ShopTab>('themes')
  const [preview, setPreview] = useState<Record<string, PreviewMode>>({})
  const meData = me.data
  const shopData = shop.data

  const purchase = useMutation(rewardsAPI.purchase, {
    onSuccess: async ({ data }, variables) => {
      const key = rewardsMeKey(user?.id)
      const currentMe = queryClient.getQueryData<RewardsMe>(key)
      if (currentMe) queryClient.setQueryData<RewardsMe>(key, {
        ...currentMe,
        points_balance: data.points_balance,
        active_theme_id: variables.item_type === 'theme' ? variables.item_id : currentMe.active_theme_id,
        active_background_id: variables.item_type === 'background' ? variables.item_id : currentMe.active_background_id,
        unlocked: {
          themes: variables.item_type === 'theme' ? [...new Set([...currentMe.unlocked.themes, variables.item_id])] : currentMe.unlocked.themes,
          backgrounds: variables.item_type === 'background' ? [...new Set([...currentMe.unlocked.backgrounds, variables.item_id])] : currentMe.unlocked.backgrounds,
        },
      })
      const currentShop = queryClient.getQueryData<{ themes: ShopItem[]; backgrounds: ShopItem[] }>(rewardsShopKey(user?.id))
      if (currentShop) queryClient.setQueryData<{ themes: ShopItem[]; backgrounds: ShopItem[] }>(rewardsShopKey(user?.id), {
        themes: currentShop.themes.map((item) => ({ ...item,
          owned: item.item_type === variables.item_type && item.id === variables.item_id ? true : item.owned,
          equipped: item.item_type === variables.item_type ? item.id === variables.item_id : item.equipped,
        })),
        backgrounds: currentShop.backgrounds.map((item) => ({ ...item,
          owned: item.item_type === variables.item_type && item.id === variables.item_id ? true : item.owned,
          equipped: item.item_type === variables.item_type ? item.id === variables.item_id : item.equipped,
        })),
      })
      toast.success('Đã mua và áp dụng giao diện mới!')
      await Promise.all([
        queryClient.invalidateQueries(rewardsMeKey(user?.id)),
        queryClient.invalidateQueries(rewardsShopKey(user?.id)),
      ])
    },
    onError: () => {
      toast.error('Chưa thể mua mục này. Vui lòng tải lại cửa hàng và thử lại.')
      void queryClient.invalidateQueries(rewardsMeKey(user?.id))
      void queryClient.invalidateQueries(rewardsShopKey(user?.id))
    },
  })

  const catalog: Array<{ item: ShopItem; theme?: ThemeDefinition; background?: ThemeBackground }> = useMemo(() => tab === 'themes'
    ? (shopData?.themes ?? []).map((item) => ({ item, theme: themes[item.id] }))
    : (shopData?.backgrounds ?? []).map((item) => ({ item, background: themeBackgrounds.find((entry) => entry.id === item.id) })),
  [tab, shopData])

  const beginPurchase = (item: ShopItem) => {
    const noun = item.item_type === 'theme' ? 'giao diện' : 'hình nền'
    if (!window.confirm(`Mua ${noun} “${item.name}” với ${item.price} điểm?`)) return
    purchase.mutate({ item_type: item.item_type, item_id: item.id, equip: true })
  }

  const currentPoints = meData?.points_balance ?? 0
  const devPreview = import.meta.env.DEV &&
    (import.meta.env as ImportMetaEnv & { VITE_UNLOCK_ALL_THEMES?: string }).VITE_UNLOCK_ALL_THEMES === 'true'

  return (
    <section className="space-y-6 text-[color:var(--text)]">
      <header className="theme-card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-7">
        <div>
          <p className="text-sm font-semibold text-[color:var(--primary)]">Cá nhân hóa không gian học</p>
          <h1 className="mt-1 font-heading text-2xl font-bold sm:text-3xl">Cửa hàng giao diện</h1>
          <p className="mt-2 max-w-2xl text-sm text-[color:var(--text-muted)]">Dùng điểm để mở khóa giao diện và khung cảnh yêu thích.</p>
        </div>
        <div className="flex items-center gap-2 rounded-pill bg-[color:var(--accent)] px-4 py-3 font-bold text-[color:var(--primary)]">
          <Coins className="h-5 w-5" /><span>{currentPoints.toLocaleString('vi-VN')} điểm</span>
        </div>
      </header>

      <div className="flex gap-2 border-b border-[color:var(--border)]" role="tablist" aria-label="Danh mục cửa hàng">
        {([{ id: 'themes', label: 'Giao diện' }, { id: 'backgrounds', label: 'Hình nền' }] as const).map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}
            className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${tab === item.id ? 'border-[color:var(--primary)] text-[color:var(--primary)]' : 'border-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text)]'}`}>
            {item.label}
          </button>
        ))}
      </div>

      {(me.isLoading || shop.isLoading) && !shopData ? (
        <div className="theme-card p-8 text-center text-sm text-[color:var(--text-muted)]">Đang tải cửa hàng…</div>
      ) : me.isError || shop.isError ? (
        <div className="theme-card p-6 text-center">
          <p className="font-semibold">Chưa thể tải dữ liệu cửa hàng.</p>
          <button type="button" onClick={() => { void me.refetch(); void shop.refetch() }} className="mt-3 rounded-pill bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-[color:var(--primary-contrast)]">Thử lại</button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {catalog.map(({ item, theme, background }) => {
            const equipped = tab === 'themes' ? themeId === item.id : backgroundId === item.id
            const owned = item.owned || item.price === 0
            const insufficient = !owned && currentPoints < item.price
            const missing = Math.max(0, item.price - currentPoints)
            const previewMode = preview[item.id] || 'light'
            const setCardPreview = (mode: PreviewMode) => setPreview((current) => ({ ...current, [item.id]: mode }))
            return (
              <article key={item.id} className={`theme-card overflow-hidden transition-shadow ${equipped ? 'ring-2 ring-[color:var(--primary)]' : ''}`}>
                {theme ? (
                  <div className="relative h-44 overflow-hidden p-4" style={{ backgroundImage: theme.palettes[previewMode].bgImage, color: theme.palettes[previewMode].text }}>
                    {theme.background[previewMode] && <img src={theme.background[previewMode]} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />}
                    <div className="relative flex h-full flex-col justify-between">
                      <div className="flex items-start justify-between gap-2">
                        <span className="rounded-pill bg-white/75 px-3 py-1 text-xs font-semibold text-gray-800 backdrop-blur">Xem trước</span>
                        {equipped && <span className="inline-flex items-center gap-1 rounded-pill bg-[color:var(--primary)] px-2.5 py-1 text-xs font-bold text-[color:var(--primary-contrast)]"><Check className="h-3.5 w-3.5" />Đang dùng</span>}
                      </div>
                      <div className="rounded-2xl border p-3 backdrop-blur" style={{ backgroundColor: theme.palettes[previewMode].cardGlass, borderColor: theme.palettes[previewMode].border }}>
                        <div className="text-sm font-bold">{theme.name}</div><div className="mt-1 text-xs opacity-80">SenpaiAI · Học mỗi ngày</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative h-44 overflow-hidden bg-[color:var(--accent)]">
                    <img src={background?.image} alt={background?.name || ''} loading="lazy" className="h-full w-full object-cover" />
                    <div className={`absolute inset-0 ${previewMode === 'dark' ? 'bg-slate-950/45' : 'bg-white/10'}`} />
                    {equipped && <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-pill bg-[color:var(--primary)] px-2.5 py-1 text-xs font-bold text-[color:var(--primary-contrast)]"><Check className="h-3.5 w-3.5" />Đang dùng</span>}
                  </div>
                )}
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><h2 className="font-semibold">{theme?.name || background?.name}</h2>
                      <p className="mt-1 line-clamp-2 min-h-10 text-sm text-[color:var(--text-muted)]">{theme?.description || `Hình nền ${background?.name}`}</p>
                    </div>
                    {!owned && <Lock className="mt-1 h-4 w-4 shrink-0 text-[color:var(--text-muted)]" />}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--border)] pt-3">
                    <div className="text-sm font-semibold">
                      {equipped ? <span className="text-[color:var(--primary)]">Đang dùng</span>
                        : item.price === 0 ? <span>Miễn phí</span>
                          : owned ? <span>Đã sở hữu</span>
                            : insufficient ? <span className="text-amber-600 dark:text-amber-300">Thiếu {missing.toLocaleString('vi-VN')} điểm</span>
                              : <span>Mua • {item.price.toLocaleString('vi-VN')} điểm</span>}
                    </div>
                    {!owned && devPreview ? <button type="button" onClick={() => tab === 'themes' ? setTheme(item.id) : setBackground(item.id)} className="rounded-pill border border-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-[color:var(--primary)]">Dùng thử</button>
                      : !owned && insufficient ? <Link to="/daily" className="text-sm font-semibold text-[color:var(--primary)] underline-offset-4 hover:underline">Làm nhiệm vụ hằng ngày</Link>
                      : owned && !equipped ? <button type="button" onClick={() => tab === 'themes' ? setTheme(item.id) : setBackground(item.id)} className="rounded-pill bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-[color:var(--primary-contrast)]">Dùng</button>
                        : !owned && item.price > 0 && !insufficient ? <button type="button" disabled={purchase.isLoading} onClick={() => beginPurchase(item)} className="rounded-pill bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-[color:var(--primary-contrast)] disabled:opacity-60">{purchase.isLoading ? 'Đang mua…' : `Mua • ${item.price.toLocaleString('vi-VN')}`}</button>
                          : null}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[color:var(--text-muted)]">
                    <Eye className="h-3.5 w-3.5" /><span>Xem trước:</span>
                    <button type="button" onClick={() => setCardPreview('light')} aria-pressed={previewMode === 'light'} className={`inline-flex items-center gap-1 rounded-pill px-2 py-1 ${previewMode === 'light' ? 'bg-[color:var(--accent)] text-[color:var(--primary)]' : 'hover:bg-[color:var(--accent)]'}`}><Sun className="h-3.5 w-3.5" />Sáng</button>
                    <button type="button" onClick={() => setCardPreview('dark')} aria-pressed={previewMode === 'dark'} className={`inline-flex items-center gap-1 rounded-pill px-2 py-1 ${previewMode === 'dark' ? 'bg-[color:var(--accent)] text-[color:var(--primary)]' : 'hover:bg-[color:var(--accent)]'}`}><Moon className="h-3.5 w-3.5" />Tối</button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
