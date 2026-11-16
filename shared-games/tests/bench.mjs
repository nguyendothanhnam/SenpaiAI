import { createRequire } from 'node:module'
import { performance } from 'node:perf_hooks'
const require=createRequire(import.meta.url),g=require('../../tmp/minigames-tests/index.js')
const sample=(count,work)=>{
  const times=[]
  for(let i=0;i<count;i++){const start=performance.now();work(i);times.push(performance.now()-start)}
  times.sort((a,b)=>a-b)
  return {samples:count,medianMs:+times[Math.floor(count/2)].toFixed(3),p95Ms:+times[Math.min(count-1,Math.floor(count*.95))].toFixed(3),maxMs:+times.at(-1).toFixed(3)}
}
const start=performance.now()
g.createRound('missing','N3','normal',77)
const coldMissingMs=+(performance.now()-start).toFixed(3)
const results={kind:'Node engine benchmark; not browser FPS or device performance',coldMissingMs}
for(const game of g.WAVE2_GAMES)results[game]=sample(40,i=>g.createRound(game,'N3','normal',i+1))
const round=g.createRound('ninja','N3','hard',1)
const swipe=Array.from({length:32},(_,i)=>({x:i*100/31,y:50+Math.sin(i)*10}))
results.ninjaCollision=sample(1000,()=>round.ninja.entities.forEach(entity=>g.swipeHits(entity,swipe,1000)))
console.log(JSON.stringify(results,null,2))
