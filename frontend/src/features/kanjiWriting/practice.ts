import type { WritingDictionaryEntry, WritingHistory, WritingPoint, WritingStroke, WritingResult } from '../../services/kanjiWriting'

export function writingScoreSummary(result: WritingResult) {
  const errors = { wrong_order: 0, wrong_direction: 0, wrong_shape: 0, extra: 0, missing: 0 }
  for (const row of result.strokes) {
    if (row.order_error || row.status === 'wrong_order') errors.wrong_order++
    if (row.direction_error || row.status === 'wrong_direction') errors.wrong_direction++
    if (row.status === 'wrong_shape') errors.wrong_shape++
    if (row.status === 'extra') errors.extra++
    if (row.status === 'missing') errors.missing++
  }
  const weights = result.score_weights || { order: .2, direction: .2, shape: .4, completeness: .2 }
  return { errors, weights, passScore: result.pass_score ?? 80 }
}

/** Same per-stroke shape formula as the server; a diagnostic, not a new grade. */
export function strokeShapeScore(row: WritingStroke, result: WritingResult): number | null {
  if (row.criterion_scores) return row.criterion_scores.shape
  if (!row.metrics || !result.thresholds) return null
  const score = Math.max(0, 1 - Math.max(0, row.metrics.distance - .025) / (result.thresholds.distance * 2)) * Math.min(1, row.metrics.length_ratio / result.thresholds.length_ratio)
  return Math.round(score * 100)
}

export const WRITING_LEVELS = ['N5','N4','N3','N2','N1'] as const
export interface PracticeCharacter extends WritingDictionaryEntry { level: string; stroke_count: number }
export function writingStatus(history?: WritingHistory): 'unseen'|'learning'|'mastered' {
  if(!history?.attempts)return 'unseen'
  return history.passed_count>=2&&history.last_passed?'mastered':'learning'
}
const searchable=(text:string)=>text.normalize('NFKC').normalize('NFD')
  .replace(/\p{M}/gu,mark=>mark==='\u3099'||mark==='\u309a'?mark:'').normalize('NFC')
  .replace(/đ/g,'d').replace(/Đ/g,'D').toLocaleLowerCase()
  .replace(/[\u30a1-\u30f6]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60))
export function gridNavigationIndex(key:string,index:number,count:number,columns:number){
  if(index<0||!count)return -1
  const width=Math.max(1,columns)
  const step=key==='ArrowRight'?1:key==='ArrowLeft'?-1:key==='ArrowDown'?width:key==='ArrowUp'?-width:0
  return key==='Home'?0:key==='End'?count-1:step?Math.max(0,Math.min(count-1,index+step)):-1
}
export function filterCharacters(items:PracticeCharacter[],level:string,query:string){
  const needles=searchable(query.trim()).split(/\s+/).filter(Boolean)
  return items.filter(item=>item.level===level&&needles.every(n=>searchable([item.kanji,item.meaning_vi,item.meaning_en,...item.onyomi||[],...item.kunyomi||[]].join(' ')).includes(n)))
}
export function suggestCharacters(items:PracticeCharacter[],history:WritingHistory[],count=8){
  const records=new Map(history.map(row=>[row.kanji,row]))
  return [...items].filter(item=>writingStatus(records.get(item.kanji))!=='mastered').sort((a,b)=>{
    const x=records.get(a.kanji),y=records.get(b.kanji)
    const priority=(h?:WritingHistory)=>h&&!h.last_passed?0:!h?1:2
    return priority(x)-priority(y)||(x?.last_score??0)-(y?.last_score??0)||a.kanji.localeCompare(b.kanji)
  }).slice(0,count)
}
export function recentCharacters(items:PracticeCharacter[],history:WritingHistory[]){
  const bank=new Set(items.map(item=>item.kanji))
  return history.filter(h=>bank.has(h.kanji)).sort((a,b)=>b.last_practiced.localeCompare(a.last_practiced)).slice(0,8)
}
export function readPreference(account:number|undefined){
  try{const p=JSON.parse(localStorage.getItem(`senpaiai.writing.selection.${account??'guest'}`)||'null');return p&&typeof p.kanji==='string'&&Array.from(p.kanji).length===1&&WRITING_LEVELS.includes(p.level)?p as {kanji:string;level:string}:null}catch{return null}
}
export function savePreference(account:number|undefined,kanji:string,level:string){
  try{localStorage.setItem(`senpaiai.writing.selection.${account??'guest'}`,JSON.stringify({kanji,level}))}catch{/* A preference must not block practice when storage is unavailable. */}
}
const distance=(a:WritingPoint,b:WritingPoint)=>Math.hypot(a.x-b.x,a.y-b.y)
function sample(points:WritingPoint[],count:number){
  if(!points.length)return []
  const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+distance(points[i],points[i-1]))
  let index=1
  return Array.from({length:count},(_,i)=>{
    const target=lengths[lengths.length-1]*i/(count-1)
    while(index<points.length-1&&lengths[index]<target)index++
    const a=points[index-1]||points[0],b=points[index]||a,r=(target-(lengths[index-1]||0))/Math.max(1e-12,(lengths[index]||0)-(lengths[index-1]||0))
    return{x:a.x+r*(b.x-a.x),y:a.y+r*(b.y-a.y)}
  })
}
export function normalizeWriting(strokes:WritingPoint[][]){
  const smoothed=strokes.filter(s=>s.length).map(stroke=>{
    const s=sample(stroke,64)
    return s.map((p,i)=>i===0||i===s.length-1?p:{x:(s[i-1].x+2*p.x+s[i+1].x)/4,y:(s[i-1].y+2*p.y+s[i+1].y)/4})
  })
  const points=smoothed.flat();if(!points.length)return []
  const x0=Math.min(...points.map(p=>p.x)),y0=Math.min(...points.map(p=>p.y))
  const w=Math.max(...points.map(p=>p.x))-x0,h=Math.max(...points.map(p=>p.y))-y0,scale=Math.max(w,h,1e-9)
  return smoothed.map(s=>sample(s.map(p=>({x:(p.x-x0+(scale-w)/2)/scale,y:(p.y-y0+(scale-h)/2)/scale})),32))
}
export const displayPoints=(points:WritingPoint[])=>points.map(p=>({x:10+p.x*80,y:10+p.y*80}))
export const polylinePoints=(points:WritingPoint[])=>points.map(p=>`${p.x},${p.y}`).join(' ')
export function buildOverlay(strokes:WritingPoint[][],reference:WritingPoint[][],row:WritingStroke,provisional=false){
  const user=normalizeWriting(strokes)
  // The server normalizes only the reference prefix for provisional feedback.
  const target=provisional?normalizeWriting(reference.slice(0,Math.max(1,strokes.length))):reference
  const expected=row.status==='extra'||row.expected_index===null?[]:target[(row.expected_index??row.index)-1]||[]
  return {user:displayPoints(user[row.index-1]||[]),template:displayPoints(expected)}
}
export function strokeDetail(row:WritingStroke,overlay:ReturnType<typeof buildOverlay>):string{
  if(row.status!=='wrong_shape')return `writing.status.${row.status}`
  const size=(s:WritingPoint[])=>s.slice(1).reduce((sum,p,i)=>sum+distance(p,s[i]),0)
  const ratio=size(overlay.user)/Math.max(size(overlay.template),1e-9)
  if(ratio<.65)return 'writingUI.tooShort'
  if(ratio>1.45)return 'writingUI.tooLong'
  const center=(s:WritingPoint[])=>s.reduce((p,q)=>({x:p.x+q.x/Math.max(1,s.length),y:p.y+q.y/Math.max(1,s.length)}),{x:0,y:0})
  const a=center(overlay.user),b=center(overlay.template),dx=a.x-b.x,dy=a.y-b.y
  if(Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy))return dx>0?'writingUI.tooRight':'writingUI.tooLeft'
  if(Math.abs(dy)>8)return dy>0?'writingUI.tooLow':'writingUI.tooHigh'
  return row.message_key
}
