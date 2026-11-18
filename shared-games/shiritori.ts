import { shuffle } from './random'
import type { WordItem } from './types'

const SMALL: Record<string, string> = { 'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ', 'ぁ': 'あ', 'ぃ': 'い', 'ぅ': 'う', 'ぇ': 'え', 'ぉ': 'お', 'っ': 'つ', 'ゎ': 'わ', 'ゕ': 'か', 'ゖ': 'け' }
export function hiragana(text: string): string {
  return text.normalize('NFKC').replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60))
}
export function katakana(text: string): string { return hiragana(text).replace(/[ぁ-ゖ]/g, char => String.fromCharCode(char.charCodeAt(0) + 0x60)) }
export function firstKana(text: string): string { const first = [...hiragana(text)][0] || ''; return SMALL[first] || first }
export function lastKana(text: string): string {
  const chars = [...hiragana(text)]
  let last = chars.pop() || ''
  if (last === 'ー') {
    while (last === 'ー' && chars.length) last = chars.pop()!
    if ('ぁあかがさざただなはばぱまゃやらゎわ'.includes(last)) return 'あ'
    if ('ぃいきぎしじちぢにひびぴみり'.includes(last)) return 'い'
    if ('ぅうくぐすずつづぬふぶぷむゅゆるゔ'.includes(last)) return 'う'
    if ('ぇえけげせぜてでねへべぺめれ'.includes(last)) return 'え'
    if ('ぉおこごそぞとどのほぼぽもょよろを'.includes(last)) return 'お'
    return ''
  }
  return SMALL[last] || last
}
export function legalWords(current: WordItem, pool: WordItem[], used: string[]): WordItem[] {
  const tail = lastKana(current.reading)
  if (!tail || tail === 'ん') return []
  return pool.filter(word => word.level === current.level && !used.includes(word.id) && word.id !== current.id && firstKana(word.reading) === tail && lastKana(word.reading) !== 'ん')
}
export function shiritoriChoices(current: WordItem, pool: WordItem[], used: string[], random: () => number): WordItem[] {
  const valid = shuffle(legalWords(current, pool, used), random)
  if (!valid.length) return []
  const invalid = shuffle(pool.filter(word => word.level === current.level && !used.includes(word.id) && word.id !== current.id && !valid.some(v => v.id === word.id)), random)
  if (invalid.length < 3) return []
  return shuffle([valid[0], ...invalid.slice(0, 3)], random)
}
export function shiritoriStart(pool: WordItem[], random: () => number): WordItem | undefined {
  return shuffle(pool, random).find(word => lastKana(word.reading) !== 'ん' && shiritoriChoices(word, pool, [word.id], random).length === 4)
}
