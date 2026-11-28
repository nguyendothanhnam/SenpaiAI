import GameGuide from '../gameHub/GameGuide'
import { confirmDialog } from '../../features/dialogs/queue'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { readLevel } from '../../features/gameHub/catalog'
import { useTranslation } from 'react-i18next'
import { BookOpen, ArrowLeft, Pause, Play, RotateCcw, Heart, Trophy } from 'lucide-react'
import { availability, compoundsFor, DIFFICULTY, EMPTY_STATS, finish, LEVELS, mergeRecipes, statsKey, createLearningRun, advanceLearningRun, campaign, unlocked, dailyChallenge, appGameDay, playerLevel, playStreak, missionStars, type LearningRun, type Action, type Alphabet, type AnswerMode, type Difficulty, type Game, type Level, type Round } from '../../../../shared-games'
import { loadRecipes, loadStats, saveRecipes, saveSession } from '../../features/minigames/storage'
import { loadArcade,saveArcadeRound,queueLearning,markTutorial } from '../../features/minigames/learningStorage'
import { syncArcade } from '../../services/minigameLearning'
import FallingGame from './FallingGame'
import ShiritoriGame from './ShiritoriGame'
import CipherGame from './CipherGame'
import MemoryGame from './MemoryGame'
import BattleGame from './BattleGame'
import WorkshopGame, { RecipeCollection } from './WorkshopGame'
import WordSearchGame from './WordSearchGame'
import NinjaGame from './NinjaGame'
import MissingStrokeGame from './MissingStrokeGame'
import './minigames.css'

const gameComponents = { falling: FallingGame, shiritori: ShiritoriGame, cipher: CipherGame, memory: MemoryGame, battle: BattleGame, workshop: WorkshopGame, wordsearch: WordSearchGame, ninja: NinjaGame, missing: MissingStrokeGame }
const recipePool = LEVELS.flatMap(compoundsFor)
const variant = (round: Round) => ['falling', 'ninja'].includes(round.session.game) ? round.mode : ['cipher', 'memory', 'wordsearch'].includes(round.session.game) ? round.alphabet : ''
const roundKey = (round: Round) => statsKey(round.session.game, round.session.level, round.session.difficulty, variant(round))
export default function GameFrame({ game, account, preferredLevel, onLearningSynced }: { game: Game; account: number; preferredLevel?: Level; onLearningSynced?: (count:number)=>void }) {
  const { t } = useTranslation('common')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [difficulty, setDifficulty] = useState<Difficulty>('normal'), [mode, setMode] = useState<AnswerMode>('reading'), [alphabet, setAlphabet] = useState<Alphabet>('hiragana')
  const [level, setLevel] = useState<Level>(() => { const requested = readLevel(searchParams.toString()); return requested && availability(game, requested).enabled ? requested : LEVELS.find(candidate => availability(game, candidate).enabled) || 'N3' })
  const [run,setRun]=useState<LearningRun|null>(null), [storageError, setStorageError] = useState(false), [highScore, setHighScore] = useState(0)
  const round=run?.round||null, runtime=useRef(run);runtime.current=run
  const [arcade,setArcade]=useState(()=>loadArcade(account)),[syncError,setSyncError]=useState(false)
  const [playMode,setPlayMode]=useState<'free'|'campaign'|'daily'>(()=>searchParams.has('challenge')?'daily':'campaign'),[stageId,setStageId]=useState('')
  const stages=campaign(game,level),selectedStage=stages.find(s=>s.id===stageId)||stages[0]
  const today=appGameDay(Date.now()),daily=dailyChallenge(today,preferredLevel||level)
  const mission=playMode==='campaign'?selectedStage:playMode==='daily'&&daily?.game===game?daily:undefined
  const playDifficulty=mission?.difficulty||difficulty,playAnswerMode=mission?'reading':mode,playAlphabet=mission?'hiragana':alphabet
  const [played, setPlayed] = useState(0)
  const [guide, setGuide] = useState(false)
  const [lookupActive,setLookupActive]=useState(false)
  const closeGuide = useCallback(() => {setGuide(false);markTutorial(account,game);setArcade(loadArcade(account))}, [account,game])
  const [recipes, setRecipes] = useState<string[]>(() => game === 'workshop' ? loadRecipes(account).recipes : [])
  const [recipeError, setRecipeError] = useState(false), [generationError, setGenerationError] = useState(false)
  const current = useRef(round), saved = useRef('')
  const exitText = useRef(t('minigames.confirmExit'))
  exitText.current = t('minigames.confirmExit')
  current.current = round
  const dispatch = useCallback((action: Action) => {if(action.type==='resume')setLookupActive(false);setRun(previous => previous ? advanceLearningRun(previous, action) : previous)}, [])
  const synchronize=useCallback(()=>{void syncArcade(account).then(count=>{setSyncError(false);setArcade(loadArcade(account));if(count)onLearningSynced?.(count)}).catch(()=>{setSyncError(true);setArcade(loadArcade(account))})},[account,onLearningSynced])
  useEffect(()=>{if(!loadArcade(account).store.progress.tutorials.includes(game))setGuide(true);synchronize();window.addEventListener('online',synchronize);return()=>window.removeEventListener('online',synchronize)},[account,game,synchronize])
  const events=run?.events
  useEffect(()=>{if(events?.length){const ok=queueLearning(account,events);setStorageError(!ok);if(ok)synchronize()}},[account,events,synchronize])
  const persistRecipes = useCallback((added: string[]) => {
    const ok = saveRecipes(account, added)
    setRecipeError(!ok)
    if (ok) setRecipes(loadRecipes(account).recipes)
    else setRecipes(previous => mergeRecipes(previous, added, recipePool))
  }, [account])
  const discoveries = round?.workshop?.discovered
  useEffect(() => { if (discoveries?.length) persistRecipes(discoveries) }, [discoveries, persistRecipes])
  const status = round?.session.status
  const persist = useCallback((snapshot: Round) => {
    const statsOk = saved.current === snapshot.session.id || saveSession(account, roundKey(snapshot), snapshot.session)
    const progressOk=saveArcadeRound(account,snapshot.session,appGameDay(Date.now()),runtime.current?.round.session.id===snapshot.session.id?runtime.current.mission:undefined)
    const ok=statsOk&&progressOk;setArcade(loadArcade(account))
    setStorageError(!ok)
    if (ok) { const stats = loadStats(account).store.entries[roundKey(snapshot)] || EMPTY_STATS; saved.current = snapshot.session.id; setHighScore(stats.highScore); setPlayed(stats.played) }
  }, [account])
  useEffect(() => { if (round?.session.status === 'finished') persist(round) }, [round, persist])
  useEffect(() => {
    if (status !== 'playing') return
    let previous = performance.now()
    if (game === 'ninja') {
      let frame = 0
      const tick = (now: number) => {
        if (now - previous >= 16) { dispatch({ type: 'tick', ms: now - previous }); previous = now }
        frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(frame)
    }
    const timer = window.setInterval(() => { const now = performance.now(); dispatch({ type: 'tick', ms: now - previous }); previous = now }, 50)
    return () => window.clearInterval(timer)
  }, [status, dispatch, game])
  useEffect(() => {
    const pause = () => { if (document.hidden) dispatch({ type: 'pause' }) }
    const blur = () => dispatch({ type: 'pause' })
    const lookup = () => {setLookupActive(true);dispatch({type:'pause'})}
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.repeat && !event.isComposing && current.current?.session.status !== 'finished') {
        event.preventDefault(); dispatch({ type: current.current?.session.status === 'paused' ? 'resume' : 'pause' })
      }
    }
    document.addEventListener('visibilitychange', pause); window.addEventListener('blur', blur); window.addEventListener('keydown', key); window.addEventListener('kanji-lookup-open', lookup)
    return () => { document.removeEventListener('visibilitychange', pause); window.removeEventListener('blur', blur); window.removeEventListener('keydown', key); window.removeEventListener('kanji-lookup-open', lookup) }
  }, [dispatch])
  useEffect(() => {
    const active = () => current.current && current.current.session.status !== 'finished'
    const beforeUnload = (event: BeforeUnloadEvent) => { if (active()) { event.preventDefault(); event.returnValue = '' } }
    const saveExit = () => {
      const snapshot = current.current
      if (snapshot?.workshop?.discovered.length) saveRecipes(account, snapshot.workshop.discovered)
      if (snapshot && saved.current !== snapshot.session.id) {
        const session = snapshot.session.status === 'finished' ? snapshot.session : finish(snapshot.session, 'quit')
        saveArcadeRound(account,session,appGameDay(Date.now()),runtime.current?.mission)
        if (saveSession(account, roundKey(snapshot), session)) saved.current = session.id
      }
    }
    const linkClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('a[href]') as HTMLAnchorElement | null : null
      if (!target || !active() || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || target.target === '_blank' || target.hasAttribute('download')) return
      const destination = new URL(target.href, window.location.href)
      if (destination.href === window.location.href) return
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation()
      dispatch({ type: 'pause' })
      void confirmDialog(exitText.current, { tone: 'warning' }).then(confirmed => {
        if (!confirmed || !current.current) return
        saveExit()
        current.current = { ...current.current, session: finish(current.current.session, 'quit') }
        if (destination.origin === window.location.origin) navigate(destination.pathname + destination.search + destination.hash)
        else window.location.assign(destination.href)
      })
    }
    window.addEventListener('beforeunload', beforeUnload); window.addEventListener('pagehide', saveExit); document.addEventListener('click', linkClick, true)
    return () => { saveExit(); window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('pagehide', saveExit); document.removeEventListener('click', linkClick, true) }
  }, [account, dispatch, navigate])
  const start = () => {
    if (!availability(game, mission?.level||level, playDifficulty, playAnswerMode, playAlphabet).enabled || arcade.error&&playMode!=='free' || playMode==='campaign'&&(!mission||!unlocked(arcade.store.progress,mission)) || playMode==='daily'&&!mission) return
    setGenerationError(false)
    try {
      const seed = mission?.kind==='daily' ? parseInt(today.replace(/-/g,''),10) : Date.now() >>> 0
      const nextRun=createLearningRun(game,mission?.level||level,playDifficulty,seed,playAnswerMode,playAlphabet,`${account}:${Date.now()}:${Math.random()}`,today,mission)
      const next=nextRun.round
      const stored = loadStats(account)
      const stats = stored.store.entries[roundKey(next)] || EMPTY_STATS
      saved.current = ''; setStorageError(stored.error); setHighScore(stats.highScore); setPlayed(stats.played); setRun(nextRun)
    } catch { setGenerationError(true) }
  }
  const ready = useMemo(() => availability(game, mission?.level||level, playDifficulty, playAnswerMode, playAlphabet), [game,level,mission?.level,playDifficulty,playAnswerMode,playAlphabet])
  const supported = useMemo(() => LEVELS.filter(candidate => availability(game, candidate, difficulty, mode, alphabet).enabled), [game, difficulty, mode, alphabet])
  const session = round?.session, GameComponent = gameComponents[game]
  return <div className="mg-shell" data-kanji-lookup-blocked={session && session.status !== 'finished' ? 'true' : undefined}>
    {guide && <GameGuide gameId={game} name={t(`minigames.games.${game}.name`)} onClose={closeGuide} />}
    <button type="button" className="mg-btn" onClick={() => { dispatch({ type: 'pause' }); setGuide(true) }}><BookOpen size={18} aria-hidden="true" />{t('gameHelp.title')}</button>
    <Link to="/games" className="mg-back"><ArrowLeft size={18} aria-hidden="true" />{t('minigames.back')}</Link>
    <h1>{t(`minigames.games.${game}.name`)}</h1><p className="mg-muted">{t(`minigames.games.${game}.description`)}</p>
    <div className="mg-panel" style={{marginBottom:16}}><strong>{t('arcadeLearning.player',{level:playerLevel(arcade.store.progress.xp).level,xp:arcade.store.progress.xp})}</strong><p className="mg-muted">{t('arcadeLearning.streak',{count:playStreak(arcade.store.progress.days,today)})} · {t('arcadeLearning.separateXp')}</p>{(syncError||arcade.error||arcade.store.outbox.length>0)&&<p role="status">{t(arcade.error?'arcadeLearning.localError':'arcadeLearning.pending',{count:arcade.store.outbox.length})} <button className="mg-btn" onClick={synchronize}>{t('arcadeLearning.sync')}</button></p>}</div>
    <div className="mg-panel">
      {!round ? <>
        <div className="mg-actions" role="group" aria-label={t('arcadeLearning.mode')}>{(['campaign','daily','free'] as const).map(value=><button type="button" className="mg-btn" aria-pressed={playMode===value} key={value} onClick={()=>setPlayMode(value)}>{t(`arcadeLearning.modes.${value}`)}</button>)}</div>
        {playMode==='campaign'&&<div className="my-4 grid gap-2 sm:grid-cols-3">{stages.map((stage,index)=><button type="button" key={stage.id} className="mg-btn" disabled={!unlocked(arcade.store.progress,stage)} aria-pressed={stage.id===mission?.id} onClick={()=>setStageId(stage.id)}>{t(stage.boss?'arcadeLearning.boss':'arcadeLearning.stage',{number:index+1})} · {'★'.repeat(arcade.store.progress.stars[stage.id]||0)||'☆'}<br/>{t('arcadeLearning.objective',{count:stage.target,seconds:stage.limitMs/1000})}</button>)}</div>}
        {playMode==='daily'&&daily&&<p className="my-3">{t('arcadeLearning.dailyRules',{game:t(`minigames.games.${daily.game}.name`),level:daily.level,seconds:45})}{daily.game!==game&&<Link className="mg-btn" to={`/games/${daily.game}?level=${daily.level}&challenge=${today}`}>{t('arcadeLearning.openDaily')}</Link>}</p>}
        <p className="mg-muted">{t(`minigames.games.${game}.rules`)}</p>
        <div className="mg-setup">
          <label className="mg-field">{t('minigames.level')}<select value={level} onChange={event => setLevel(event.target.value as Level)}>{LEVELS.map(candidate => { const data = availability(game, candidate, difficulty, mode, alphabet); return <option key={candidate} value={candidate} disabled={!data.enabled}>{t(data.enabled ? 'minigames.levelAvailable' : 'minigames.levelUnavailable', { level: candidate, count: data.count })}</option> })}</select></label>
          {playMode==='free'&&<label className="mg-field">{t('minigames.difficulty')}<select value={difficulty} onChange={event => setDifficulty(event.target.value as Difficulty)}>{Object.keys(DIFFICULTY).map(value => <option key={value} value={value}>{t(`minigames.difficulties.${value}`)}</option>)}</select></label>}
          {playMode==='free' && (game === 'falling' || game === 'ninja') && <label className="mg-field">{t('minigames.answerMode')}<select value={mode} onChange={event => setMode(event.target.value as AnswerMode)}>{(['reading', 'meaning'] as const).map(value => <option key={value} value={value}>{t(`minigames.modes.${value}`)}</option>)}</select></label>}
          {playMode==='free' && (game === 'cipher' || game === 'memory' || game === 'wordsearch') && <label className="mg-field">{t('minigames.alphabet')}<select value={alphabet} onChange={event => setAlphabet(event.target.value as Alphabet)}>{(['hiragana', 'katakana'] as const).map(value => <option key={value} value={value}>{t(`minigames.alphabets.${value}`)}</option>)}</select></label>}
        </div>
        <div className="mg-alert"><p>{t('minigames.dataReport', { count: ready.count, minimum: ready.minimum })}</p><p>{t('minigames.suggestLevels', { levels: supported.join(', ') || t('minigames.noLevels') })}</p>{!ready.enabled && <p role="alert">{t('minigames.insufficientData')}</p>}</div>
        {game === 'falling' && mode === 'meaning' && <p className="mg-muted">{t('minigames.meaningNotice')}</p>}
        <button type="button" className="mg-btn mg-btn-primary" onClick={start} disabled={!ready.enabled||arcade.error&&playMode!=='free'||playMode==='daily'&&!mission}><Play size={18} aria-hidden="true" />{t('minigames.start')}</button>
      </> : <>
        <div className="mg-hud"><div className="mg-hud-numbers"><span>{t('minigames.score')}<strong>{session!.score}</strong></span><span>{t('minigames.lives')}<strong><Heart size={17} style={{ display: 'inline' }} aria-hidden="true" /> {session!.lives}</strong></span><span>{t('minigames.best')}<strong>{Math.max(highScore, session!.score)}</strong></span></div><span className="mg-pill">{session!.level} · {t(`minigames.difficulties.${session!.difficulty}`)}</span><span className={`arcade-avatar arcade-avatar-${arcade.store.progress.cosmetic}`} aria-label={t(`arcadeLearning.cosmetics.${arcade.store.progress.cosmetic}`)}>✧</span></div>
        <div className="my-3"><p role="status">{t('arcadeLearning.questionProgress',{done:Math.min(session!.correct,run!.goal),total:run!.goal,remaining:Math.max(0,run!.goal-session!.correct)})}</p><progress className="mt-2 h-3 w-full accent-[color:var(--primary)]" value={Math.min(session!.correct,run!.goal)} max={run!.goal} aria-label={t('arcadeLearning.progressLabel')} />{run!.mission?.boss&&game==='battle'&&<p>{t('arcadeLearning.defeatBoss')}</p>}</div><p className="mg-muted">{t('arcadeLearning.adaptive',{difficulty:t(`minigames.difficulties.${run!.adaptive.difficulty}`)})}{run!.mission&&` · ${t('arcadeLearning.remaining',{seconds:Math.max(0,Math.ceil((run!.mission.limitMs-session!.elapsedMs)/1000))})}`}</p>{session!.chain>=3&&<p key={session!.chain} className="arcade-combo font-bold text-[color:var(--primary)]" role="status">{t('arcadeLearning.combo',{count:session!.chain})}</p>}
        {session!.status === 'finished' ? <section aria-live="polite">
          <Trophy size={36} color="var(--primary)" aria-hidden="true" /><h2 style={{ fontSize: 24, fontWeight: 800, marginTop: 12 }}>{t('minigames.finished')}</h2><p className="mg-muted">{t(run!.mission&&session!.reason==='exhausted'&&session!.elapsedMs>=run!.mission.limitMs?'arcadeLearning.timeExpired':`minigames.endReasons.${session!.reason}`)}</p>
          <div className="mg-summary"><div>{t('minigames.score')}<strong>{session!.score}</strong></div><div>{t('minigames.best')}<strong>{highScore}</strong></div><div>{t('minigames.longestChain')}<strong>{session!.longestChain}</strong></div><div>{t('minigames.correct')}<strong>{session!.correct}</strong></div></div>
          <p className="mg-muted">{t('minigames.played', { count: played })}</p>
          {run!.mission&&<p className="text-2xl font-bold text-[color:var(--primary)]">{t('arcadeLearning.stars',{count:missionStars(session!,run!.mission)})}</p>}
          <div className="mg-actions"><button type="button" className="mg-btn mg-btn-primary" onClick={start}><RotateCcw size={18} aria-hidden="true" />{t('minigames.replay')}</button><button type="button" className="mg-btn" onClick={() => setRun(null)}>{t('minigames.changeLevel')}</button><Link className="mg-btn" to="/games?review=1">{t('arcadeLearning.review')}</Link></div>
        </section> : <>
          <div className="mg-actions" style={{ marginBottom: 16 }}><button type="button" className="mg-btn" onClick={() => dispatch({ type: session!.status === 'paused' ? 'resume' : 'pause' })}><Pause size={18} aria-hidden="true" />{t(session!.status === 'paused' ? 'minigames.resume' : 'minigames.pause')}</button><button type="button" className="mg-btn" onClick={() => { dispatch({ type: 'pause' }); void confirmDialog(t('minigames.confirmExit'), { title: t('minigames.quit'), confirmLabel: t('minigames.quit'), cancelLabel: t('dialogs.stay'), tone: 'warning' }).then(confirmed => { if (confirmed) dispatch({ type: 'quit' }) }) }}>{t('minigames.quit')}</button></div>
          {session!.status === 'paused' && <div className="mg-paused" role="status"><h2>{t('minigames.paused')}</h2><p className="mg-muted">{t('minigames.pausedHelp')}</p><button type="button" className="mg-btn mg-btn-primary" onClick={() => dispatch({ type: 'resume' })}>{t('minigames.resume')}</button></div>}
          <div className="mg-stage" hidden={session!.status === 'paused'&&!lookupActive}><GameComponent key={session!.id} round={round} onAction={dispatch} /></div>
          <p className="mg-feedback" aria-live="polite">{round.feedback ? t(`minigames.feedback.${round.feedback}`) : ''}</p>
        </>}
      </>}
      {generationError && <div className="mg-alert" role="alert">{t('minigames2.generationError')}</div>}
      {(storageError || recipeError) && <div className="mg-alert" role="alert">{t('minigames.storageError')}{round?.session.status === 'finished' && <button type="button" className="mg-btn" onClick={() => { persist(round); if (round.workshop) persistRecipes(round.workshop.discovered) }}>{t('minigames.retrySave')}</button>}</div>}
    </div>
    {(game === 'battle' || game === 'workshop' || (game === 'ninja' && mode === 'meaning')) && <p className="mg-muted" style={{ marginTop: 16 }}>{t('minigames2.meaningData')}</p>}
    {game === 'workshop' && <RecipeCollection ids={recipes} />}
    <p className="mg-muted" style={{ marginTop: 16 }}>{t('minigames.localNotice')}</p>
  </div>
}
