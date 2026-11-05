import type { AxiosInstance } from 'axios'
import type { User } from '../api/types'
import type { TokenStorage } from '../storage/types'

export interface SessionSnapshot {
  status: 'loading' | 'anonymous' | 'authenticated' | 'offline' | 'storage-error'
  user: User | null
  expired: boolean
}

export class Session {
  private snapshot: SessionSnapshot = { status: 'loading', user: null, expired: false }
  private listeners = new Set<() => void>()
  private generation = 0

  constructor(private api: AxiosInstance, private storage: TokenStorage, private clearPrivateData: () => Promise<void>) {}

  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }

  private emit(snapshot: SessionSnapshot) {
    this.snapshot = snapshot
    this.listeners.forEach((listener) => listener())
  }

  updateUser(user: User) {
    if (this.snapshot.user?.id === user.id) this.emit({ ...this.snapshot, user })
  }

  restore = async () => {
    const generation = ++this.generation
    this.emit({ status: 'loading', user: null, expired: false })
    let token: string | null
    try { token = await this.storage.get() } catch {
      if (generation === this.generation) this.emit({ status: 'storage-error', user: null, expired: false })
      return
    }
    if (generation !== this.generation) return
    if (!token) { this.emit({ status: 'anonymous', user: null, expired: false }); return }
    try {
      const { data } = await this.api.get<User>('/auth/me')
      if (generation === this.generation) this.emit({ status: 'authenticated', user: data, expired: false })
    } catch {
      // A 401 is handled centrally; a lost connection keeps the secure token for retry.
      if (generation === this.generation) this.emit({ status: 'offline', user: null, expired: false })
    }
  }

  login = async (email: string, password: string) => {
    const generation = ++this.generation
    const { data } = await this.api.post<{ access_token: string }>('/auth/login', { email, password })
    if (generation !== this.generation) return
    if (!data.access_token) throw new Error('Invalid authentication response')
    try { await this.storage.set(data.access_token) } catch (error) {
      if (generation === this.generation) this.emit({ status: 'storage-error', user: null, expired: false })
      throw error
    }
    if (generation !== this.generation) return
    await this.clearPrivateData()
    try {
      const response = await this.api.get<User>('/auth/me')
      if (generation === this.generation) this.emit({ status: 'authenticated', user: response.data, expired: false })
    } catch (error) {
      if (generation === this.generation) this.emit({ status: 'offline', user: null, expired: false })
      throw error
    }
  }

  register = async (email: string, username: string, password: string, onRegistered?: () => void) => {
    await this.api.post('/auth/register', { email, username, password })
    onRegistered?.()
    await this.login(email, password)
  }

  logout = async () => {
    ++this.generation
    try {
      await this.storage.remove()
      await this.clearPrivateData()
      this.emit({ status: 'anonymous', user: null, expired: false })
    } catch {
      this.emit({ status: 'storage-error', user: null, expired: false })
    }
  }

  expire = async (rejectedToken: string) => {
    // An old request must never sign out a newer login.
    if (await this.storage.get() !== rejectedToken) return
    ++this.generation
    try {
      await this.storage.remove()
      await this.clearPrivateData()
      this.emit({ status: 'anonymous', user: null, expired: true })
    } catch {
      this.emit({ status: 'storage-error', user: null, expired: true })
    }
  }
}
