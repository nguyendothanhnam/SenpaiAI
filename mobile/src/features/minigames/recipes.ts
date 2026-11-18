import { accountStorageKey } from '@games/stats'
import { mergeRecipes } from '@games/workshop'
import type { PairItem } from '@games/types'
interface Storage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
export const recipeKey = (account: string) => `${accountStorageKey(account)}:recipes`
export class RecipeStore {
  private locks = new Map<string, Promise<unknown>>()
  constructor(private storage: Storage) {}
  async read(account: string): Promise<string[]> {
    if (!account.trim()) throw new Error('unauthorized')
    const raw = await this.storage.getItem(recipeKey(account))
    if (!raw) return []
    if (raw.length > 256_000) throw new Error('corrupt_recipes')
    const value = JSON.parse(raw)
    if (value?.version !== 1 || !Array.isArray(value.recipes) || !value.recipes.every((id: unknown) => typeof id === 'string')) throw new Error('corrupt_recipes')
    return [...new Set<string>(value.recipes)]
  }
  add(account: string, added: string[], pool: PairItem[]): Promise<string[]> {
    const next = (this.locks.get(account) || Promise.resolve()).catch(() => undefined).then(async () => {
      const current = await this.read(account)
      // Preserve recipes from other levels / earlier dictionary versions.
      const recipes = [...new Set([...current, ...mergeRecipes([], added, pool)])].sort()
      if (recipes.length !== current.length) await this.storage.setItem(recipeKey(account), JSON.stringify({ version: 1, recipes }))
      return recipes
    })
    this.locks.set(account, next)
    void next.finally(() => { if (this.locks.get(account) === next) this.locks.delete(account) }).catch(() => undefined)
    return next
  }
}
