import { BarChart3 } from 'lucide-react'

export default function Analytics() {
  return (
    <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card-glass)] p-6 shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--accent)] text-[color:var(--primary)]">
        <BarChart3 className="h-5 w-5" />
      </div>
      <h1 className="mt-5 text-3xl font-bold text-[color:var(--text)]">Analytics</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--text-muted)]">
        Learning analytics can be connected here when real progress data is available.
      </p>
    </div>
  )
}
