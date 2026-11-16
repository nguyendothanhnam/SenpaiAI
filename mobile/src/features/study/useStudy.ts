import AsyncStorage from '@react-native-async-storage/async-storage'
import { useQuery } from 'react-query'
import { useAuth } from '../../auth/AuthProvider'
import { queryClient } from '../../api/services'
import { StudyStore } from './storage'

export const studyStore = new StudyStore(AsyncStorage)
export function useStudy() {
  const { user } = useAuth()
  const account = user?.id
  const query = useQuery(['study-library', account], () => studyStore.read(account!), { enabled: account !== undefined, cacheTime: 0, staleTime: 0 })
  const refresh = () => queryClient.invalidateQueries(['study-library', account])
  return { account, query, refresh, sets: query.data?.sets || [], writable: query.data?.writable === true }
}
