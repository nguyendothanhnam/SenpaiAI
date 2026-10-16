import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api } from './api'

interface User {
  id: number
  email: string
  username: string
  is_active: boolean
  current_jlpt_level: string
  learning_goals: string[]
  exercise_points: number
  created_at: string
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      fetchUser()
    } else {
      setIsLoading(false)
    }
  }, [])

  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/me')
      setUser(response.data)
    } catch (error) {
      localStorage.removeItem('access_token')
      delete api.defaults.headers.common['Authorization']
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password })
    const { access_token } = response.data
    
    localStorage.setItem('access_token', access_token)
    api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
    
    await fetchUser()
  }

  const register = async (email: string, username: string, password: string) => {
    await api.post('/auth/register', { email, username, password })
    await login(email, password)
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    delete api.defaults.headers.common['Authorization']
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

