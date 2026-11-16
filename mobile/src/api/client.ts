import axios from 'axios'
import type { TokenStorage } from '../storage/types'

export function createApiClient({ baseURL, storage, onUnauthorized }: {
  baseURL: string
  storage: TokenStorage
  onUnauthorized: (token: string) => Promise<void>
}) {
  const client = axios.create({ baseURL, timeout: 15000, headers: { 'Content-Type': 'application/json' } })
  client.interceptors.request.use(async (config) => {
    const token = await storage.get()
    if (token) config.headers.set('Authorization', `Bearer ${token}`)
    return config
  })
  client.interceptors.response.use((response) => response, async (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401 && !/\/auth\/(login|register)$/.test(error.config?.url ?? '')) {
      const header = error.config?.headers?.get('Authorization')
      if (typeof header === 'string' && header.startsWith('Bearer ')) await onUnauthorized(header.slice(7))
    }
    return Promise.reject(error)
  })
  return client
}
