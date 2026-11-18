export class Random {
  constructor(public seed = 1) { this.seed = seed >>> 0 || 1 }
  next = () => { this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0; return this.seed / 4294967296 }
}
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]] }
  return result
}
export function pick<T>(items: readonly T[], random: () => number): T {
  if (!items.length) throw new Error('empty_pool')
  return items[Math.floor(random() * items.length)]
}
