import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const g=require('../../tmp/minigames-tests/index.js')

test('wave 2 eligibility uses actual pairs, same-level compounds and stroke data',()=>{
  assert.equal(g.pairsFor('N3').length,362)
  assert.equal(g.compoundsFor('N3').length,97)
  for(const recipe of g.compoundsFor('N3')) {
    assert.match(recipe.word,/^[\u3400-\u9fff々]{2,}$/)
    assert.ok([...recipe.word].every(c=>g.kanjiFor('N3').some(k=>k.id===c)))
  }
  for(const level of ['N5','N4']) for(const game of ['battle','workshop','wordsearch','ninja']) assert.equal(g.availability(game,level).enabled,false)
  for(const level of ['N5','N4','N3']) for(const difficulty of ['easy','normal','hard']) assert.equal(g.availability('missing',level,difficulty).enabled,true)
})

test('battle pairs have unambiguous meanings; combo damage is bounded; bosses have more health',()=>{
  const b=g.createBattle(g.pairsFor('N3'),'N3','normal',1,new g.Random(3).next)
  assert.equal(new Set(b.pairs.map(p=>p.meaning)).size,b.pairs.length)
  assert.deepEqual([...b.rightOrder].sort(),b.pairs.map(p=>p.id).sort())
  assert.ok(g.battleDamage(3)>g.battleDamage(1));assert.equal(g.battleDamage(100),50)
  assert.ok(g.battleRules('N3','normal',3).hp>g.battleRules('N3','normal',2).hp)
  const [a,c]=b.pairs
  assert.equal(g.battleMatch(b,a.id,c.id),'wrong')
  assert.equal(g.battleMatch({...b,matched:[a.id]},a.id,a.id),'ignored')
})
test('battle win, lose, combo timeout and stale board guards share the round lifecycle',()=>{
  let r=g.createRound('battle','N3','normal',11)
  const first=r.battle.pairs[0].id
  r=g.reduceRound(r,{type:'match',wordId:first,meaningId:first,boardId:r.battle.boardId})
  assert.equal(r.battle.lastDamage,25);assert.equal(r.battle.combo,1)
  for(let i=0;i<21;i++)r=g.reduceRound(r,{type:'tick',ms:250})
  const second=r.battle.pairs.find(p=>!r.battle.matched.includes(p.id)).id
  r=g.reduceRound(r,{type:'match',wordId:second,meaningId:second,boardId:r.battle.boardId})
  assert.equal(r.battle.combo,1)
  const hp=r.battle.hp
  r=g.reduceRound(r,{type:'match',wordId:second,meaningId:second,boardId:-1})
  assert.equal(r.battle.hp,hp)
  let count=0
  while(r.session.status==='playing'&&count++<100){const id=r.battle.pairs.find(p=>!r.battle.matched.includes(p.id)).id;r=g.reduceRound(r,{type:'match',wordId:id,meaningId:id,boardId:r.battle.boardId})}
  assert.equal(r.session.reason,'completed');assert.equal(r.battle.stage,5);assert.equal(r.battle.hp,0)
  let loss=g.createRound('battle','N3','hard',2)
  for(let i=0;i<300&&loss.session.status==='playing';i++)loss=g.reduceRound(loss,{type:'tick',ms:250})
  assert.equal(loss.session.reason,'lives');assert.equal(loss.session.lives,0)
})

test('workshop keeps repeated characters as separate cards and excludes other-level distractors',()=>{
  const item={id:'人人',word:'人人',reading:'ひとびと',meaning:'people',level:'N3'}
  let b=g.createWorkshop([item],[{id:'人',level:'N3'},{id:'才',level:'N3'},{id:'能',level:'N3'},{id:'日',level:'N5'}],'hard',new g.Random(1).next)
  assert.equal(b.cards.filter(c=>c.kanji==='人').length,2)
  assert.ok(!b.cards.some(c=>c.kanji==='日'))
  const two=b.cards.filter(c=>c.kanji==='人')
  b=g.selectWorkshopCard(b,two[0].id)
  assert.equal(g.selectWorkshopCard(b,two[0].id),b)
  b=g.selectWorkshopCard(b,two[1].id)
  assert.equal(g.assembledWord(b),'人人');assert.equal(g.validRecipe(b,[item]),true)
  assert.equal(g.validRecipe(b,[]),false)
})
test('workshop records only correct dictionary recipes, handles undo, prevents duplicate submission and completes eight',()=>{
  let r=g.createRound('workshop','N3','normal',88), turns=0
  const initial=g.reduceRound(r,{type:'tile',id:r.workshop.cards[0].id})
  assert.equal(g.reduceRound(initial,{type:'undo'}).workshop.selected.length,0)
  while(r.session.status==='playing'&&turns++<9){
    const board=r.workshop, taken=new Set()
    for(const char of board.target.word){const card=board.cards.find(c=>c.kanji===char&&!taken.has(c.id));taken.add(card.id);r=g.reduceRound(r,{type:'tile',id:card.id})}
    const answer={type:'answer',value:'',questionId:String(board.questionId)}
    r=g.reduceRound(r,answer)
    const score=r.session.score
    r=g.reduceRound(r,answer)
    assert.equal(r.session.score,score)
  }
  assert.equal(r.session.reason,'completed');assert.equal(r.workshop.discovered.length,8)
  const pool=g.compoundsFor('N3'), id=pool[0].id
  assert.deepEqual(g.mergeRecipes([id,'unknown'],[id],pool),[id])
})

test('word-search generator places unique readable targets horizontally, vertically and diagonally in both alphabets',()=>{
  for(const difficulty of ['easy','normal','hard'])for(const alphabet of ['hiragana','katakana'])for(let seed=1;seed<=25;seed++){
    const b=g.createWordSearch(g.searchWordsFor('N3'),alphabet,difficulty,new g.Random(seed).next)
    assert.equal(b.words.length,g.searchRules(difficulty).count)
    assert.equal(new Set(b.words.map(w=>w.text)).size,b.words.length)
    const orientations=new Set()
    for(const w of b.words){
      assert.equal(g.occurrences(b.grid,w.text).length,1)
      assert.equal(w.cells.map(c=>b.grid[c.row][c.col]).join(''),w.text)
      assert.equal(g.checkSearchPath(b,w.cells).kind,'found')
      assert.equal(g.checkSearchPath(b,[...w.cells].reverse()).kind,b.reverse?'found':'wrong')
      const a=w.cells[0],z=w.cells.at(-1)
      orientations.add(a.row===z.row?'h':a.col===z.col?'v':'d')
      assert.ok(b.words.every(other=>other===w||(!other.text.includes(w.text)&&!w.text.includes(other.text))))
    }
    assert.deepEqual([...orientations].sort(),['d','h','v'])
    assert.ok(b.grid.flat().every(c=>/^[ぁ-ゖァ-ヺー]$/u.test(c)))
  }
})
test('word search rejects crooked, skipped and out-of-bounds paths; repeats do not score; all targets win',()=>{
  let r=g.createRound('wordsearch','N3','normal',42)
  const w=r.wordsearch.words[0]
  assert.equal(g.checkSearchPath(r.wordsearch,[w.cells[0]]).kind,'ignored')
  assert.equal(g.checkSearchPath(r.wordsearch,[{row:-1,col:0},{row:0,col:0}]).kind,'wrong')
  assert.equal(g.checkSearchPath(r.wordsearch,[{row:0,col:0},{row:0,col:1},{row:1,col:1}]).kind,'wrong')
  r=g.reduceRound(r,{type:'selectPath',cells:w.cells})
  const score=r.session.score
  r=g.reduceRound(r,{type:'selectPath',cells:w.cells})
  assert.equal(r.session.score,score)
  for(const next of r.wordsearch.words.slice(1))r=g.reduceRound(r,{type:'selectPath',cells:next.cells})
  assert.equal(r.session.reason,'completed')
  assert.deepEqual(g.lineCells({row:0,col:0},{row:2,col:1}),[])
})

test('pure slash collision handles horizontal, vertical, diagonal, edge, degenerate and invalid segments',()=>{
  const rect={x:10,y:10,width:20,height:20}
  for(const [a,b]of[[{x:0,y:20},{x:40,y:20}],[{x:20,y:0},{x:20,y:40}],[{x:0,y:0},{x:40,y:40}],[{x:0,y:10},{x:10,y:10}]])assert.equal(g.segmentIntersectsRect(a,b,rect),true)
  assert.equal(g.segmentIntersectsRect({x:0,y:0},{x:40,y:0},rect),false)
  assert.equal(g.segmentIntersectsRect({x:NaN,y:0},{x:20,y:20},rect),false)
  assert.equal(g.segmentIntersectsRect({x:0,y:0},{x:20,y:20},{...rect,width:-1}),false)
})
test('ninja trajectories, wave prompts and pure swipe hits are finite, fair and cannot score a removed word twice',()=>{
  for(const difficulty of ['easy','normal','hard'])for(let seed=1;seed<=15;seed++){
    let r=g.createRound('ninja','N3',difficulty,seed)
    assert.equal(r.ninja.entities.filter(e=>g.ninjaMatches(e.item,r.ninja.request,r.mode)).length,1)
    assert.ok(r.ninja.entities.length<=4)
    for(let i=0;i<3;i++)r=g.reduceRound(r,{type:'tick',ms:250})
    const target=r.ninja.entities.find(e=>g.ninjaMatches(e.item,r.ninja.request,r.mode)), p=g.flyingPosition(target,r.ninja.timeMs)
    assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y))
    const points=[{x:p.x-1.8,y:p.y,atMs:r.ninja.timeMs},{x:p.x+1.8,y:p.y,atMs:r.ninja.timeMs}]
    assert.equal(g.swipeHits(target,points,r.ninja.timeMs),true)
    assert.equal(g.swipeHits(target,[points[0]],r.ninja.timeMs),false)
    assert.equal(g.swipeHits(target,points.map(p=>({...p,atMs:r.ninja.timeMs+1})),r.ninja.timeMs),false)
    const next=g.reduceRound(r,{type:'slash',points})
    assert.equal(next.ninja.hits,1);assert.ok(next.session.score>0)
    assert.equal(g.reduceRound(next,{type:'slash',points}).session.score,next.session.score)
  }
})
test('ninja misses, wrong slashes and progress use common lives and score rules',()=>{
  let r=g.createRound('ninja','N3','hard',12)
  for(let i=0;i<3;i++)r=g.reduceRound(r,{type:'tick',ms:250})
  const wrong=r.ninja.entities.find(e=>!g.ninjaMatches(e.item,r.ninja.request,r.mode)),p=g.flyingPosition(wrong,r.ninja.timeMs)
  r=g.reduceRound(r,{type:'slash',points:[{x:p.x-1.8,y:p.y},{x:p.x+1.8,y:p.y}]})
  assert.equal(r.session.lives,1)
  for(let i=0;i<20&&r.session.status==='playing';i++)r=g.reduceRound(r,{type:'tick',ms:250})
  assert.equal(r.session.reason,'lives')
  assert.ok(g.ninjaRules('N3','hard',12).speed>g.ninjaRules('N5','easy',0).speed)
})
test('slashes outside the visible arena cannot hit words before they enter',()=>{
  const r=g.createRound('ninja','N3','normal',9), entity=r.ninja.entities[0], p=g.flyingPosition(entity,0)
  assert.ok(p.y>100)
  assert.equal(g.swipeHits(entity,[{x:p.x-5,y:p.y},{x:p.x+5,y:p.y}],0),false)
  assert.deepEqual(g.segmentRectInterval({x:50,y:80},{x:50,y:120},{x:0,y:0,width:100,height:100}),[0,.5])
})
test('ninja can complete a full round by slashing each correct word while leaving distractors alone',()=>{
  let r=g.createRound('ninja','N3','easy',111), turns=0
  while(r.session.status==='playing'&&turns++<10){
    for(let i=0;i<3;i++)r=g.reduceRound(r,{type:'tick',ms:250})
    const e=r.ninja.entities.find(e=>g.ninjaMatches(e.item,r.ninja.request,r.mode)),p=g.flyingPosition(e,r.ninja.timeMs)
    r=g.reduceRound(r,{type:'slash',points:[{x:p.x-1.8,y:p.y},{x:p.x+1.8,y:p.y}]})
    const wave=r.ninja.wave
    for(let i=0;i<25&&r.session.status==='playing'&&r.ninja.wave===wave;i++)r=g.reduceRound(r,{type:'tick',ms:250})
  }
  assert.equal(r.session.reason,'completed');assert.equal(r.ninja.hits,8);assert.equal(r.session.lives,4)
  const meaning=g.createRound('ninja','N3','normal',2,'meaning')
  assert.ok(g.ninjaValue(meaning.ninja.request,'meaning'))
  assert.equal(meaning.ninja.entities.filter(e=>g.ninjaMatches(e.item,meaning.ninja.request,'meaning')).length,1)
})

test('all 5452 source vector paths are supported by the platform-free sampler',()=>{
  let count=0
  for(const glyph of g.strokeGlyphs)for(const path of glyph.paths){const points=g.resamplePath(path);assert.equal(points.length,12);assert.ok(points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));count++}
  assert.equal(count,5452)
  assert.deepEqual(g.samplePath('M0 0 l10 10 h10 v-5').at(-1),{x:20,y:5})
  assert.deepEqual(g.samplePath('M0 0 Q5 10 10 0 T20 0').at(-1),{x:20,y:0})
  assert.deepEqual(g.samplePath('M0 0 C2 4 8 4 10 0 S18 -4 20 0').at(-1),{x:20,y:0})
})
test('missing strokes have one visually distinct correct choice, same-level decoys and at least one visible stroke',()=>{
  for(const level of ['N5','N4','N3'])for(const difficulty of ['easy','normal','hard'])for(let seed=1;seed<=5;seed++){
    const b=g.createMissingStroke(level,difficulty,new g.Random(seed).next)
    assert.ok(b);assert.ok(b.glyph.paths.length>=2);assert.equal(b.choices.length,4)
    const pool=new Set(g.strokeGlyphs.filter(s=>s.level===level).flatMap(s=>s.paths))
    assert.equal(b.choices.filter(c=>c.path===b.glyph.paths[b.hidden]).length,1)
    for(const choice of b.choices){assert.ok(pool.has(choice.path));if(choice.id!==b.targetId)assert.ok(g.strokeDifference(choice.path,b.glyph.paths[b.hidden])>=5)}
  }
})
test('missing-stroke scoring rewards speed; stale/repeated choices do not score; ten different glyphs win',()=>{
  assert.ok(g.missingPoints(0)>g.missingPoints(3000));assert.equal(g.missingPoints(100000),30)
  let r=g.createRound('missing','N5','normal',3), seen=new Set()
  while(r.session.status==='playing'){
    const b=r.missing;assert.ok(!seen.has(b.glyph.id));seen.add(b.glyph.id)
    const action={type:'answer',value:b.targetId,questionId:String(b.questionId)}
    r=g.reduceRound(r,action);const score=r.session.score
    r=g.reduceRound(r,action);assert.equal(r.session.score,score)
  }
  assert.equal(r.session.reason,'completed');assert.equal(seen.size,10)
  let wrong=g.createRound('missing','N3','normal',4)
  const option=wrong.missing.choices.find(c=>c.id!==wrong.missing.targetId)
  const action={type:'answer',value:option.id,questionId:String(wrong.missing.questionId)}
  wrong=g.reduceRound(wrong,action);assert.equal(wrong.session.lives,2)
  assert.equal(g.reduceRound(wrong,action).session.lives,2)
})

test('every new game freezes its own board while paused, including gestures and recipe input',()=>{
  for(const game of g.WAVE2_GAMES){
    const r=g.reduceRound(g.createRound(game,'N3','normal',1),{type:'pause'}), snapshot=JSON.stringify(r)
    for(const action of [{type:'tick',ms:250},{type:'tile',id:'fake'},{type:'slash',points:[{x:0,y:0},{x:100,y:100}]},{type:'selectPath',cells:[{row:0,col:0},{row:0,col:1}]}])assert.equal(g.reduceRound(r,action),r)
    assert.equal(JSON.stringify(r),snapshot)
  }
})
