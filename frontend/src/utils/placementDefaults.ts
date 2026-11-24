/** Prefer an explicit practice filter; never write a profile level from navigation. */
export function placementDefault(search: string, currentLevel: string | undefined, supported: readonly string[], fallback: string): string {
  const requested = new URLSearchParams(search).get('level')
  if (requested && supported.includes(requested)) return requested
  if (currentLevel && supported.includes(currentLevel)) return currentLevel
  return fallback
}

type TrendRow = { mode: string; selected_level: string | null; scoring_version: string; is_demo: boolean; total_score: number | null }
/** Raw scores from different levels/modes/versions must not imply progress. */
export function comparableAttempts<T extends TrendRow>(rows: T[]): T[] {
  const eligible = rows.filter(row => !row.is_demo && row.mode === 'confirmation' && row.total_score !== null)
  const latest = eligible[0]
  return latest ? eligible.filter(row => row.selected_level === latest.selected_level && row.scoring_version === latest.scoring_version).slice(0, 6).reverse() : []
}
