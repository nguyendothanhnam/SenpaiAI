import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import { AppState } from 'react-native'
import { useQuery } from 'react-query'
import { useAuth } from '../../auth/AuthProvider'
import { notificationsAPI } from '../../api/reminders'
import { queryClient } from '../../api/services'

const Context = createContext({ active: false, count: 0, countError: false })
export const notificationKey = ['mobile-notifications'] as const
export function NotificationProvider({ children }: PropsWithChildren) {
  const { status, user } = useAuth()
  const [foreground, setForeground] = useState(AppState.currentState === 'active')
  const active = foreground && status === 'authenticated'
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setForeground(state === 'active')
      if (state !== 'active') void queryClient.cancelQueries(notificationKey)
    })
    return () => subscription.remove()
  }, [])
  const count = useQuery([...notificationKey, user?.id, 'count'], ({ signal }) => notificationsAPI.count(signal), {
    enabled: active, staleTime: 0, refetchInterval: active ? 60_000 : false, refetchIntervalInBackground: false,
  })
  return <Context.Provider value={{ active, count: count.data?.unread_count ?? 0, countError: count.isError }}>{children}</Context.Provider>
}
export const useNotifications = () => useContext(Context)
