import { strokeGlyphs } from '@games/missing-stroke'
import type { RoundPool } from '@games/pool'
import type { Level } from '@games/types'
import type { KanjiPage } from '../../api/phase3Types'

type Loader = (level: string, search: string, offset: number, limit: number) => Promise<KanjiPage>
const kana = /^[ぁ-ゖァ-ヺー]+$/u
const word = /^[ぁ-ゖァ-ヺ一-龯々ー]+$/u
/** Public dictionary cache only: no account data, no requests from a reducer. */
export class PoolCache {
  private cache = new Map<Level, { at: number; pool: RoundPool }>()
  private pending = new Map<Level, Promise<RoundPool>>()
  constructor(private list: Loader, private now = Date.now) {}
  prepare(level: Level): Promise<RoundPool> {
    const cached = this.cache.get(level)
    if (cached && this.now() - cached.at < 10 * 60_000) return Promise.resolve(cached.pool)
    const pending = this.pending.get(level)
    if (pending) return pending
    const request = this.load(level).then(pool => { this.cache.set(level, { pool, at: this.now() }); return pool }).finally(() => this.pending.delete(level))
    this.pending.set(level, request)
    return request
  }
  private async load(level: Level): Promise<RoundPool> {
    const kanji: RoundPool['kanji'] = [], words: RoundPool['words'] = [], seen = new Set<string>(), seenWords = new Set<string>()
    for (let offset = 0; offset < 5000;) {
      const page = await this.list(level, '', offset, 100)
      if (!Array.isArray(page.items) || !Number.isFinite(page.total) || page.total < 0 || page.total > 5000 || (page.total > offset && !page.items.length)) throw new Error('invalid_pool')
      const previousSize = seen.size
      for (const item of page.items) {
        if (item.jlpt !== level || seen.has(item.kanji)) continue
        seen.add(item.kanji)
        kanji.push({ id: item.kanji, level, readings: [...new Set([...item.onyomi, ...item.kunyomi].filter(reading => kana.test(reading)))], meaning: item.meaning_vi || item.meaning || '' })
        for (const example of item.examples || []) {
          if (seenWords.has(example.word) || !word.test(example.word) || !kana.test(example.reading)) continue
          seenWords.add(example.word)
          words.push({ id: example.word, word: example.word, reading: example.reading, meaning: example.meaning, level })
        }
      }
      if (page.items.length && seen.size === previousSize) throw new Error('invalid_pool')
      offset += page.items.length
      if (offset >= page.total) return { kanji, words, strokes: strokeGlyphs.filter(glyph => glyph.level === level && seen.has(glyph.id)) }
    }
    throw new Error('invalid_pool')
  }
}
