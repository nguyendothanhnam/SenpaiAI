import { createContext, useContext, useEffect, useSyncExternalStore, type PropsWithChildren } from 'react'
import { session } from '../api/services'
import type { SessionSnapshot } from './session'

const AuthContext = createContext<SessionSnapshot | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
  useEffect(() => { void session.restore() }, [])
  return <AuthContext.Provider value={snapshot}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthProvider is missing')
  return { ...context, login: session.login, register: session.register, logout: session.logout, retry: session.restore }
}
