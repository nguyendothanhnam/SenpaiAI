export interface ResumeStorage { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void>; removeItem: (key: string) => Promise<void> }
// This is only a navigation hint, never an answer/deadline or an authority on session state.
export function createPlacementResume(storage: ResumeStorage) {
  const key = (owner: number) => `senpaiai.placement.resume.v1.${owner}`
  return {
    async read(owner: number) {
      try { const value = Number(await storage.getItem(key(owner))); return Number.isSafeInteger(value) && value > 0 ? value : null }
      catch { return null }
    },
    async remember(owner: number, id: number) { await storage.setItem(key(owner), String(id)) },
    async forget(owner: number) { await storage.removeItem(key(owner)) },
  }
}
