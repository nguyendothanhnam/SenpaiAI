import type { QueryClient } from 'react-query'
import type { User } from '../api/types'
import type { Session } from './session'

// A GET started before the save must not replace the confirmed PUT response.
export async function publishProfile(client: QueryClient, session: Session, updated: User) {
  await client.cancelQueries(['profile', updated.id])
  if (session.getSnapshot().user?.id !== updated.id) return
  client.setQueryData(['profile', updated.id], updated)
  session.updateUser(updated)
}
