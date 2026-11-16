import { Navigate, useParams } from 'react-router-dom'
import { GAMES, type Game } from '../../../shared-games'
import { useAuth } from '../services/auth'
import GameFrame from '../components/minigames/GameFrame'
export default function MiniGame() {
  const { gameId } = useParams(), { user } = useAuth()
  if (!user || !GAMES.includes(gameId as Game)) return <Navigate to="/games" replace />
  return <GameFrame key={`${user.id}:${gameId}`} game={gameId as Game} account={user.id} />
}
