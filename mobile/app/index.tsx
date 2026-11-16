import { Redirect } from 'expo-router'
import { useAuth } from '../src/auth/AuthProvider'

export default function Index() {
  const { status } = useAuth()
  return <Redirect href={status === 'authenticated' ? '/(tabs)/daily' : '/(auth)/login'} />
}
