import { useEffect, useRef, useState } from 'react'
import { LogOut, Settings, ShoppingBag, User } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '../../utils/helpers'

type MenuItem = { key: string; href?: string; icon: typeof User; action?: () => void }

export default function UserMenu({ username, level, points, onLogout, onNavigate }: {
  username?: string; level?: string; points: number; onLogout: () => void; onNavigate?: () => void
}) {
  const { t } = useTranslation('nav')
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const firstItemRef = useRef<HTMLAnchorElement>(null)
  const items: MenuItem[] = [
    { key: 'profile', href: '/profile', icon: User },
    { key: 'settings', href: '/settings', icon: Settings },
    { key: 'shop', href: '/shop', icon: ShoppingBag },
    { key: 'signOut', icon: LogOut, action: onLogout },
  ]

  useEffect(() => {
    if (open) firstItemRef.current?.focus()
  }, [open])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
        const links = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
        if (!links.length) return
        event.preventDefault()
        const current = links.indexOf(document.activeElement as HTMLElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length
        links[next].focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const close = () => { setOpen(false); onNavigate?.() }

  return <div ref={rootRef} className="relative border-t border-[color:var(--border)] p-3">
    {open && <div role="menu" aria-label={t('userMenu')} className="theme-card absolute bottom-[calc(100%-0.25rem)] left-3 right-3 z-50 overflow-hidden rounded-2xl p-1.5 shadow-xl">
      {items.map(({ key, href, icon: Icon, action }, index) => {
        const active = href ? pathname === href || pathname.startsWith(`${href}/`) : false
        const className = cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors', active ? 'bg-[color:var(--accent)] font-semibold text-[color:var(--primary)]' : 'text-[color:var(--text)] hover:bg-[color:var(--accent)] hover:text-[color:var(--primary)]')
        return href ? <Link key={key} ref={index === 0 ? firstItemRef : undefined} to={href} role="menuitem" onClick={close} className={className}><Icon className="h-4 w-4" aria-hidden="true" />{t(key)}</Link>
          : <button key={key} type="button" role="menuitem" onClick={() => { close(); action?.() }} className={className}><Icon className="h-4 w-4" aria-hidden="true" />{t(key)}</button>
      })}
    </div>}
    <button ref={triggerRef} type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)] text-sm font-bold text-[color:var(--primary-contrast)]">{username?.charAt(0).toUpperCase() || '?'}</span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[color:var(--text)]">{username || t('profile')}</span><span className="block truncate text-xs text-[color:var(--primary)]">{level || '—'} · {points} {t('exercisePoints')}</span></span>
      <span aria-hidden="true" className="text-xs text-[color:var(--text-muted)]">⌃</span>
    </button>
  </div>
}
