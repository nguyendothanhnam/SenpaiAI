import { availability, LEVELS, type Game, type Level, type Stats } from '../../../../shared-games'

export type Category = 'all' | 'vocabulary' | 'kanji' | 'grammar' | 'reflex' | 'ranked'
export type Tone = 'mint' | 'cream' | 'peach' | 'lavender' | 'sky' | 'rose'
export interface HubGame {
  id: string; title: string; description: string; to: string; category: Exclude<Category, 'all'>
  tags: Category[]; tone: Tone; icon: string; glyph: string; reward: number
  label?: 'hot' | 'new'; engine?: Game
}
export const CATEGORIES: Category[] = ['all', 'vocabulary', 'kanji', 'grammar', 'reflex', 'ranked']
/** Study shortcuts and shared-engine games; only engine games need the hub level picker. */
export const GAMES_DATA: HubGame[] = [
  { id: 'quiz', title: 'arcade.games.quiz.name', description: 'arcade.games.quiz.description', to: '/quiz', category: 'vocabulary', tags: ['vocabulary', 'reflex'], tone: 'mint', icon: 'zap', glyph: '速', reward: 20, label: 'hot' },
  { id: 'flashcard', title: 'arcade.games.flashcard.name', description: 'arcade.games.flashcard.description', to: '/flashcard', category: 'vocabulary', tags: ['vocabulary'], tone: 'cream', icon: 'layers', glyph: '覚', reward: 15 },
  { id: 'shiritori', title: 'arcade.games.shiritori.name', description: 'arcade.games.shiritori.description', to: '/games/shiritori', category: 'reflex', tags: ['vocabulary', 'reflex'], tone: 'sky', icon: 'link', glyph: '繋', reward: 25, label: 'new', engine: 'shiritori' },
  ...([
    ['falling', 'kanji', ['kanji', 'reflex'], 'peach', 'falling', '落'],
    ['cipher', 'vocabulary', ['vocabulary'], 'lavender', 'key', '秘'],
    ['memory', 'reflex', ['reflex', 'vocabulary'], 'cream', 'brain', '記'],
    ['battle', 'kanji', ['kanji', 'vocabulary'], 'mint', 'swords', '戦'],
    ['workshop', 'vocabulary', ['vocabulary', 'kanji'], 'cream', 'hammer', '組'],
    ['wordsearch', 'vocabulary', ['vocabulary'], 'sky', 'search', '探'],
    ['ninja', 'reflex', ['reflex', 'vocabulary'], 'lavender', 'scissors', '忍'],
    ['missing', 'kanji', ['kanji'], 'rose', 'pen', '筆'],
  ] as [Game, HubGame['category'], Category[], Tone, string, string][]).map(([engine, category, tags, tone, icon, glyph]) => ({ id: engine, engine, category, tags, tone, icon, glyph, reward: 20, label: 'new' as const, title: `minigames.games.${engine}.name`, description: `minigames.games.${engine}.description`, to: `/games/${engine}` })),
]
export const normalizeSearch = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLocaleLowerCase().trim()
export function filterGames(games: HubGame[], category: Category, search: string, translate: (key: string) => string) {
  const query = normalizeSearch(search)
  return games.filter(game => (category === 'all' || game.tags.includes(category)) && normalizeSearch(`${translate(game.title)} ${translate(game.description)}`).includes(query))
}
export function supportedLevels(game: HubGame): Level[] { return game.engine ? LEVELS.filter(level => availability(game.engine!, level).enabled) : [...LEVELS] }
export function gameRecord(game: HubGame, entries: Record<string, Stats>) {
  const stats = game.engine ? Object.entries(entries).filter(([key]) => key.startsWith(`${game.engine}:`)) : []
  const completed = new Set(stats.filter(([, stat]) => stat.completed > 0).map(([key]) => key.split(':')[1]))
  const supported = supportedLevels(game)
  return { high: Math.max(0, ...stats.map(([, stat]) => stat.highScore)), completed: supported.filter(level => completed.has(level)).length, total: supported.length }
}
export function gameDestination(game: HubGame, level: Level): string {
  if (!game.engine) return game.to
  const query = new URLSearchParams({ level })
  return `${game.to}?${query}`
}

export function readLevel(search: string): Level | undefined { const value = new URLSearchParams(search).get('level'); return LEVELS.find(level => level === value) }
