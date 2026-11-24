import { Navigate, useParams } from 'react-router-dom'
import { GAMES, LEVELS, type Game, type Level } from '../../../shared-games'
import { useCallback } from 'react'
import { useQueryClient } from 'react-query'
import { useAuth } from '../services/auth'
import GameFrame from '../components/minigames/GameFrame'
export default function MiniGame() {
  const { gameId } = useParams(), { user } = useAuth()
  const cache=useQueryClient()
  const synced=useCallback(()=>{void cache.invalidateQueries(['learning',user?.id]);void cache.invalidateQueries(['gameReview',user?.id])},[cache,user?.id])
  if (!user || !GAMES.includes(gameId as Game)) return <Navigate to="/games" replace />
  return <GameFrame key={`${user.id}:${gameId}`} game={gameId as Game} account={user.id} preferredLevel={LEVELS.includes(user.current_jlpt_level as Level)?user.current_jlpt_level as Level:undefined} onLearningSynced={synced} />
}
