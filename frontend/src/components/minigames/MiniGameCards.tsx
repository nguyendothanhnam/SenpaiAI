import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowDown, Brain, KeyRound, Link2, ArrowUpRight, Swords, Hammer, Search, Scissors, PenTool } from 'lucide-react'
import { availability, GAMES, LEVELS } from '../../../../shared-games'
import { useAuth } from '../../services/auth'
import { loadStats } from '../../features/minigames/storage'
import './minigames.css'
const icons = { falling: ArrowDown, shiritori: Link2, cipher: KeyRound, memory: Brain, battle: Swords, workshop: Hammer, wordsearch: Search, ninja: Scissors, missing: PenTool }
export default function MiniGameCards() {
  const { t } = useTranslation('common'), { user } = useAuth()
  const entries = user ? loadStats(user.id).store.entries : {}
  return <section className="mg-section" aria-labelledby="minigames-title">
    <div className="mg-section-heading"><div><h2 id="minigames-title">{t('minigames.title')}</h2></div><span className="mg-pill">{t('minigames.localOnly')}</span></div>
    <p className="mg-muted">{t('minigames.localNotice')}</p>
    <div className="mg-cards">{GAMES.map((game, index) => {
      const Icon = icons[game], supported = LEVELS.filter(level => availability(game, level).enabled)
      const high = Math.max(0, ...Object.entries(entries).filter(([key]) => key.startsWith(`${game}:`)).map(([, value]) => value.highScore))
      return <Link className="mg-game-card" to={`/games/${game}`} key={game}>
        <div className="mg-card-top"><span className="mg-number">{String(index + 1).padStart(2, '0')}</span><Icon size={30} aria-hidden="true" /></div>
        <h3>{t(`minigames.games.${game}.name`)}</h3><p>{t(`minigames.games.${game}.description`)}</p>
        <div className="mg-tags">{supported.map(level => <span className="mg-pill" key={level}>{level}</span>)}</div>
        <div className="mg-card-bottom"><span>{t('minigames.highScore', { score: high })}</span><ArrowUpRight size={20} aria-hidden="true" /></div>
      </Link>
    })}</div>
  </section>
}
