import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const g = require('../../tmp/minigames-tests/index.js')
const word = (id, reading, level = 'N3') => ({ id, word: id, reading, level })

test('real catalog reports incomplete N5/N4 without inventing vocabulary', () => {
  assert.equal(g.kanjiFor('N5').length, 79)
  assert.equal(g.kanjiFor('N4').length, 166)
  assert.equal(g.kanjiFor('N3').length, 367)
  assert.equal(g.wordsFor('N5').length, 0)
  assert.equal(g.wordsFor('N4').length, 0)
  assert.equal(g.wordsFor('N3').length, 367)
  assert.equal(g.availability('falling', 'N5').enabled, true)
  assert.equal(g.availability('falling', 'N4').enabled, true)
  for (const game of g.GAMES) for (const difficulty of ['easy', 'normal', 'hard']) {
    assert.equal(g.availability(game, 'N3', difficulty).enabled, true, game + difficulty)
    for (const level of ['N2', 'N1']) assert.equal(g.availability(game, level, difficulty).enabled, false)
  }
  for (const game of ['shiritori', 'cipher', 'memory']) for (const level of ['N5', 'N4']) assert.equal(g.availability(game, level).enabled, false)
})

test('catalog is unique, standalone and has actual readable source data', () => {
  assert.equal(new Set(g.words.map(w => w.id)).size, g.words.length)
  for (const item of g.words) { assert.match(item.reading, /^[ぁ-ゖァ-ヺー]+$/u); assert.match(item.word, /^[ぁ-ゖァ-ヺ一-龯々ー]+$/u) }
})

for (const [reading, expected] of Object.entries({ 'きゃ': 'や', 'きゅ': 'ゆ', 'きょ': 'よ', 'バッグ': 'ぐ', 'コーヒー': 'い', 'タクシー': 'い', 'スーパー': 'あ', 'ケーキ': 'き', 'メニュー': 'う', 'チョー': 'お', 'ティー': 'い', 'カフェー': 'え', 'パン': 'ん', 'しゃしん': 'ん', 'ｺｰﾋｰ': 'い', '': '', 'ー': '' })) {
  test(`shiritori final sound: ${reading || '(empty)'}`, () => assert.equal(g.lastKana(reading), expected))
}
test('small initial kana and katakana normalize consistently', () => { assert.equal(g.firstKana('ャク'), 'や'); assert.equal(g.hiragana('ﾊﾟﾝ'), 'ぱん'); assert.equal(g.katakana('きょう'), 'キョウ') })

test('shiritori choices contain exactly one safe continuation and no repeats or other levels', () => {
  const pool = [word('cat','ねこ'),word('top','こま'),word('pine','まつ'),word('crane','つる'),word('apple','りんご'),word('end','こん'),word('other','こえ','N4')]
  for (let seed = 1; seed <= 100; seed++) {
    const current = pool[0], used = [current.id], choices = g.shiritoriChoices(current, pool, used, new g.Random(seed).next)
    assert.equal(choices.length, 4); assert.equal(new Set(choices.map(w => w.id)).size, 4)
    assert.ok(choices.every(w => w.level === 'N3' && !used.includes(w.id)))
    assert.equal(choices.filter(w => g.firstKana(w.reading) === 'こ' && g.lastKana(w.reading) !== 'ん').length, 1)
  }
  assert.deepEqual(g.legalWords(word('n','ほん'),pool,[]), [])
  assert.deepEqual(g.shiritoriChoices(word('z','すず'),pool,[],Math.random), [])
})
test('actual shiritori rounds never present a dead turn; exhausting choices is a graceful finish', () => {
  for (let seed = 1; seed <= 25; seed++) {
    let round = g.createRound('shiritori','N3','normal',seed), turns = 0
    while (round.session.status === 'playing' && turns++ < 368) {
      const b = round.shiritori
      assert.ok(b.choices.length > 0)
      const legal = g.legalWords(b.current,g.wordsFor('N3'),b.used)
      const selected = b.choices.find(w => legal.some(l => l.id === w.id))
      assert.ok(selected)
      const old = round
      round = g.reduceRound(round,{ type:'answer',value:selected.id })
      assert.equal(new Set(round.shiritori.used).size, round.shiritori.used.length)
      assert.equal(old.session.correct + 1,round.session.correct)
    }
    assert.equal(round.session.reason,'exhausted')
    assert.equal(round.session.lives,3)
  }
})
test('shiritori ends on a matching word ending in ん and cannot reuse an answered choice', () => {
  const round = g.createRound('shiritori','N3','normal',2)
  round.shiritori = { current:word('a','ねこ'), used:['a'], choices:[word('b','こん')] }
  const end = g.reduceRound(round,{type:'answer',value:'b'})
  assert.equal(end.session.reason,'endsN')
  assert.equal(end.session.status,'finished')
  assert.equal(g.reduceRound(end,{type:'answer',value:'b'}),end)
})

test('falling distractors stay in-level, are unique, and exclude every accepted reading', () => {
  for (const level of ['N5','N3']) for (const mode of ['reading','meaning']) for (let seed = 1; seed <= 200; seed++) {
    const q = g.question(g.kanjiFor(level),mode,new g.Random(seed).next,1,10000)
    assert.equal(q.item.level,level); assert.equal(q.options.length,4); assert.equal(new Set(q.options).size,4)
    assert.equal(q.options.filter(a => a === q.answer).length,1)
    const accepted = mode === 'reading' ? q.item.readings.map(g.hiragana) : [q.answer]
    assert.ok(q.options.filter(a => a !== q.answer).every(a => !accepted.includes(a)))
    assert.ok(q.options.every(a => g.kanjiFor(level).some(k => g.answerOf(k,mode) === a)))
  }
})
test('falling speed, concurrency and scoring are bounded and grow with progress', () => {
  const early = g.fallingRules('N5','easy',0), late = g.fallingRules('N3','hard',100)
  assert.ok(late.durationMs < early.durationMs); assert.equal(late.maxActive,3); assert.equal(early.maxActive,1)
  assert.equal(g.fallingPoints(0,1000),150); assert.equal(g.fallingPoints(1000,1000),50); assert.equal(g.fallingPoints(2000,1000),50)
})
test('a missed falling character costs one life and answered questions cannot score twice', () => {
  let round = g.createRound('falling','N5','normal',8)
  const q = round.falling.questions[0]
  const answered = g.reduceRound(round,{type:'answer',id:q.id,value:q.answer})
  assert.equal(answered.session.score,150)
  assert.equal(g.reduceRound(answered,{type:'answer',id:q.id,value:q.answer}).session.score,150)
  round = { ...round,falling:{...round.falling,questions:[{...q,ageMs:q.durationMs-20}]}}
  assert.equal(g.reduceRound(round,{type:'tick',ms:50}).session.lives,2)
})

test('cipher substitution is a derangement bijection and decodes exactly, including repeated and long-vowel kana', () => {
  for (let seed = 1; seed <= 100; seed++) for (const alphabet of ['hiragana','katakana']) {
    const c = g.createCipher(word('coffee','こーひー'),alphabet,'hard',new g.Random(seed).next)
    assert.equal(new Set(c.table.map(p => p.plain)).size,c.table.length)
    assert.equal(new Set(c.table.map(p => p.code)).size,c.table.length)
    assert.ok(c.table.every(p => p.plain !== p.code))
    assert.deepEqual(c.encoded.map(code => c.table.find(p => p.code === code).plain),c.plain)
    assert.ok(g.solveCipher(c,'コーヒー')); assert.ok(!g.solveCipher(c,'こひ'))
    assert.equal(c.encoded[1],c.encoded[3])
  }
})
test('cipher hints reveal a new position, cap safely, reduce rewards and never reveal everything initially', () => {
  let c = g.createCipher(word('a','あいう','N5'), 'hiragana','easy',new g.Random(7).next)
  assert.equal(c.revealed.length,2)
  const before = g.cipherPoints(c); c = g.revealCipher(c)
  assert.equal(c.revealed.length,3); assert.equal(g.cipherPoints(c),before-25)
  assert.equal(g.revealCipher(c),c)
  for (const d of ['easy','normal','hard']) assert.ok(g.cipherCandidates(g.wordsFor('N3'),d).length >= 8)
})
test('cipher round charges hints once, including on the first question with zero starting score', () => {
  let r = g.createRound('cipher','N3','hard',19)
  const expected = r.cipher.plain.length * 40 - 25
  r = g.reduceRound(r,{type:'hint'})
  r = g.reduceRound(r,{type:'answer',value:r.cipher.plain.join('')})
  assert.equal(r.session.score,expected)
  assert.equal(r.cipherUsed.length,2)
})
test('rapid duplicate cipher submission cannot answer or penalize the next question', () => {
  const original=g.createRound('cipher','N3','normal',19)
  const action={type:'answer',value:original.cipher.plain.join(''),questionId:original.cipher.word.id}
  const next=g.reduceRound(original,action)
  assert.equal(next.session.correct,1)
  assert.equal(g.reduceRound(next,action),next)
})

test('memory ignores input during presentation, checks each position and grows by exactly one', () => {
  const random = new g.Random(99), m = g.createMemory(g.wordsFor('N3'),'katakana','hard',random.next)
  assert.equal(m.grid.length,9); assert.equal(new Set(m.grid).size,9); assert.equal(m.sequence.length,2)
  assert.equal(g.memoryInput(m,m.sequence[0]),'ignored')
  const input = {...m,phase:'input'}
  assert.equal(g.memoryInput(input,'?'),'ignored')
  assert.equal(g.memoryInput(input,m.grid.find(k => k !== m.sequence[0])),'wrong')
  assert.equal(g.memoryInput(input,m.sequence[0]),'correct')
  assert.equal(g.memoryInput({...input,entered:1},m.sequence[1]),'complete')
  const next = g.extendMemory(input,random.next)
  assert.deepEqual(next.sequence.slice(0,2),m.sequence); assert.equal(next.sequence.length,3); assert.equal(next.phase,'showing')
  assert.ok(g.memoryPoints(4) > g.memoryPoints(3))
})
test('memory mistakes replay the same sequence while losing a life', () => {
  let r = g.createRound('memory','N3','normal',1)
  r.memory={...r.memory,phase:'input'}
  const seq=[...r.memory.sequence]
  const wrong=r.memory.grid.find(k => k !== seq[0])
  r=g.reduceRound(r,{type:'answer',value:wrong})
  assert.equal(r.session.lives,2); assert.equal(r.memory.phase,'showing'); assert.deepEqual(r.memory.sequence,seq)
})

for (const game of g.GAMES) {
  test(`${game}: seeded start, pause/resume/finish lifecycle is immutable and freezes input and clocks`, () => {
    const original = g.createRound(game,'N3','normal',10)
    assert.deepEqual(original,g.createRound(game,'N3','normal',10))
    const snapshot = JSON.stringify(original)
    let paused=g.reduceRound(original,{type:'pause'})
    assert.equal(g.reduceRound(paused,{type:'tick',ms:200}),paused)
    assert.equal(g.reduceRound(paused,{type:'answer',value:'anything'}),paused)
    paused=g.reduceRound(paused,{type:'resume'})
    const next=g.reduceRound(paused,{type:'tick',ms:100})
    assert.equal(next.session.elapsedMs,100)
    const end=g.reduceRound(next,{type:'quit'})
    assert.equal(end.session.reason,'quit'); assert.equal(g.reduceRound(end,{type:'resume'}),end)
    assert.equal(JSON.stringify(original),snapshot)
  })
}
test('invalid ticks and invalid answers cannot mutate a round or create negative scores', () => {
  const r=g.createRound('falling','N3','normal',99)
  for (const ms of [-1,0,NaN,Infinity]) assert.equal(g.reduceRound(r,{type:'tick',ms}),r)
  assert.equal(g.reduceRound(r,{type:'answer',id:999,value:'fake'}),r)
  assert.equal(g.loseLife({...r.session,lives:1}).status,'finished')
  assert.throws(()=>g.createRound('cipher','N5','normal',1),/insufficient_data/)
})
test('local stats isolate accounts, variants and levels; duplicate finishes and malformed storage are safe', () => {
  assert.notEqual(g.accountStorageKey(1),g.accountStorageKey(2))
  for (const input of [null,'oops','null','{"version":2,"entries":{}}','{"version":1,"entries":[]}']) assert.deepEqual(g.parseStats(input),{version:1,entries:{}})
  const session=g.finish({...g.createRound('falling','N3','normal',7).session,score:500,correct:5,longestChain:4},'completed')
  const key=g.statsKey('falling','N3','normal','reading'), store=g.recordStats(g.parseStats(null),key,session)
  assert.equal(store.entries[key].highScore,500); assert.equal(store.entries[key].played,1)
  assert.equal(g.recordStats(store,key,session),store)
  assert.equal(g.recordStats(store,key,{...session,status:'playing'}),store)
  assert.deepEqual(g.parseStats(JSON.stringify(store)),store)
  assert.notEqual(key,g.statsKey('falling','N5','normal','reading'))
  assert.notEqual(key,g.statsKey('falling','N3','hard','reading'))
  assert.notEqual(key,g.statsKey('falling','N3','normal','meaning'))
})
