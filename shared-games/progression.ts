import { availability } from './availability'
import { GAMES, LEVELS, type Game, type Level, type Difficulty, type Session } from './types'
export interface Mission { kind: 'campaign' | 'daily'; id: string; game: Game; level: Level; difficulty: Difficulty; target: number; limitMs: number; boss: boolean; day?: string }
export interface ArcadeProgress { version: 1; xp: number; stars: Record<string, number>; badges: string[]; days: string[]; dailyWins: string[]; processed: string[]; cosmetic: string; tutorials: string[] }
export const emptyProgress = (): ArcadeProgress => ({ version: 1, xp: 0, stars: {}, badges: [], days: [], dailyWins: [], processed: [], cosmetic: 'plain', tutorials: [] })
export function appGameDay(time: number) { return new Date(time + 420 * 60000).toISOString().slice(0, 10) }
export function validDay(day: string) { return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(`${day}T12:00:00Z`)) && new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day }
export function campaign(game: Game, level: Level): Mission[] {
  return (['easy', 'normal', 'hard'] as Difficulty[]).filter(d => availability(game, level, d).enabled).map((difficulty, index, all) => ({
    kind: 'campaign', id: `${game}:${level}:${difficulty}`, game, level, difficulty, target: (game==='wordsearch'?[3,5,6]:[3,5,7])[index], limitMs: [60000, 75000, 90000][index], boss: index === all.length - 1,
  }))
}
export function unlocked(progress: ArcadeProgress, mission: Mission) {
  const stages = campaign(mission.game, mission.level), index = stages.findIndex(s => s.id === mission.id)
  return index >= 0 && (index === 0 || (progress.stars[stages[index - 1].id] || 0) >= 1)
}
export function hashDay(value: string) { let hash = 2166136261; for (const c of value) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619); return hash >>> 0 }
export function dailyChallenge(day: string, preferred: Level): Mission | null {
  if (!validDay(day)) throw new Error('invalid_day')
  const choices = GAMES.flatMap(game => {
    const levels = [...LEVELS].sort((a,b) => Math.abs(LEVELS.indexOf(a)-LEVELS.indexOf(preferred))-Math.abs(LEVELS.indexOf(b)-LEVELS.indexOf(preferred)))
    const level = levels.find(l => availability(game,l,'normal').enabled)
    return level ? [{ game, level }] : []
  })
  if (!choices.length) return null
  const chosen = choices[hashDay(`${day}:${preferred}`) % choices.length]
  return { ...chosen, kind:'daily', id:`daily:${day}:${preferred}`, difficulty:'normal', target:4, limitMs:45000, boss:false, day }
}
export function missionStars(session: Session, mission: Mission) {
  if (session.status !== 'finished' || session.reason !== 'completed' || session.correct < mission.target) return 0
  const accuracy = session.correct / Math.max(1,session.correct+session.mistakes)
  return accuracy >= .95 ? 3 : accuracy >= .8 ? 2 : accuracy >= .6 ? 1 : 0
}
export function playStreak(days: string[], today: string) {
  const set = new Set(days), back = (d:string) => new Date(Date.parse(`${d}T12:00:00Z`)-86400000).toISOString().slice(0,10)
  let day = set.has(today) ? today : back(today), count = 0
  while (set.has(day)) { count++; day=back(day) }
  return count
}
export function playerLevel(xp: number) { const level=1+Math.floor(Math.sqrt(Math.max(0,xp)/100)); return { level, nextXp: level*level*100 } }
export function cosmetics(progress: ArcadeProgress) { return ['plain', ...(progress.badges.includes('perfect') ? ['sakura'] : []), ...(progress.badges.includes('streak7') ? ['flame'] : []), ...(progress.badges.includes('chapter') ? ['crown'] : [])] }
export function recordProgress(previous: ArcadeProgress, session: Session, day: string, mission?: Mission): ArcadeProgress {
  if (!validDay(day) || session.status!=='finished' || previous.processed.includes(session.id)) return previous
  const result: ArcadeProgress = { ...previous, stars:{...previous.stars}, badges:[...previous.badges], days:[...previous.days], dailyWins:[...previous.dailyWins], processed:[...previous.processed,session.id].slice(-4096) }
  if (session.reason==='quit' || session.correct<1 || session.elapsedMs<=0) return result
  const stars=mission ? missionStars(session,mission) : 0
  result.days=[...new Set([...result.days,day])].sort().slice(-400)
  result.xp+=Math.min(180,session.correct*5+stars*15)
  if (mission?.kind==='campaign' && unlocked(previous,mission)) {
    result.stars[mission.id]=Math.max(stars,result.stars[mission.id]||0)
    const stages=campaign(mission.game,mission.level)
    if (stages.length && stages.every(s=>(result.stars[s.id]||0)===3)) result.badges.push('chapter')
  }
  if (mission?.kind==='daily' && mission.day===day && stars>0 && !result.dailyWins.includes(day)) { result.dailyWins.push(day); result.xp+=30 }
  if (session.longestChain>=5) result.badges.push('combo5')
  if (session.longestChain>=10) result.badges.push('combo10')
  if (session.correct>=3 && session.mistakes===0) result.badges.push('perfect')
  if (playStreak(result.days,day)>=3) result.badges.push('streak3')
  if (playStreak(result.days,day)>=7) result.badges.push('streak7')
  result.badges=[...new Set(result.badges)]; result.dailyWins=result.dailyWins.slice(-400)
  return result
}
export function parseProgress(value: unknown): ArcadeProgress {
  const p=value as ArcadeProgress
  if (!p || p.version!==1 || !Number.isSafeInteger(p.xp) || p.xp<0 || !p.stars || Array.isArray(p.stars) || typeof p.stars!=='object' || !Object.values(p.stars).every(x=>Number.isInteger(x)&&x>=0&&x<=3) || !['badges','days','dailyWins','processed','tutorials'].every(k=>Array.isArray(p[k as keyof ArcadeProgress]) && (p[k as keyof ArcadeProgress] as unknown[]).every(x=>typeof x==='string')) || typeof p.cosmetic!=='string' || !p.days.every(validDay)) throw new Error('invalid_progress')
  if(!cosmetics(p).includes(p.cosmetic))throw new Error('invalid_cosmetic')
  return p
}
export interface Adaptive { difficulty: Difficulty; good: number; bad: number }
export function adapt(state: Adaptive, correct: boolean): Adaptive {
  const levels: Difficulty[]=['easy','normal','hard']; let index=levels.indexOf(state.difficulty)
  let good=correct?state.good+1:0,bad=correct?0:state.bad+1
  if(good>=3){index=Math.min(2,index+1);good=0}
  if(bad>=2){index=Math.max(0,index-1);bad=0}
  return { difficulty:levels[index],good,bad }
}
