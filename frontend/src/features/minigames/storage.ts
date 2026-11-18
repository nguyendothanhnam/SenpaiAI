import { accountStorageKey, compoundsFor, LEVELS, mergeRecipes, parseStats, recordStats, type Session, type StatStore } from '../../../../shared-games'
const recipePool = LEVELS.flatMap(compoundsFor)
export const recipeStorageKey = (account: number) => `${accountStorageKey(account)}:recipes`
export function loadRecipes(account: number): { recipes: string[]; error: boolean } {
  try {
    const raw = localStorage.getItem(recipeStorageKey(account))
    if (!raw) return { recipes: [], error: false }
    const value = JSON.parse(raw)
    if (value.version !== 1 || !Array.isArray(value.recipes) || !value.recipes.every((id: unknown) => typeof id === 'string')) return { recipes: [], error: true }
    return { recipes: mergeRecipes([], value.recipes, recipePool), error: false }
  } catch { return { recipes: [], error: true } }
}
export function saveRecipes(account: number, added: string[]): boolean {
  const current = loadRecipes(account)
  if (current.error) return false
  try { localStorage.setItem(recipeStorageKey(account), JSON.stringify({ version: 1, recipes: mergeRecipes(current.recipes, added, recipePool) })); return true } catch { return false }
}
export function loadStats(account: number): { store: StatStore; error: boolean } {
  try { return { store: parseStats(localStorage.getItem(accountStorageKey(account))), error: false } }
  catch { return { store: { version: 1, entries: {} }, error: true } }
}
export function saveSession(account: number, key: string, session: Session): boolean {
  try {
    const raw = localStorage.getItem(accountStorageKey(account))
    if (raw) { const parsed = JSON.parse(raw); if (parsed.version !== 1) return false }
    const store = recordStats(parseStats(raw), key, session)
    localStorage.setItem(accountStorageKey(account), JSON.stringify(store))
    return true
  } catch { return false }
}
