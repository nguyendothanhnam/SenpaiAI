import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { authAPI, session } from '../api/services'
import type { Language } from '../api/types'
import { i18n, isLanguage } from './index'

const LANGUAGE_KEY = 'senpaiai.language'
const pendingKey = (userId: number) => `senpaiai.pending-language.${userId}`
interface LanguageContextValue {
  language: Language
  ready: boolean
  error: 'languageSyncFailed' | 'preferenceError' | null
  setLanguage: (language: Language) => Promise<void>
  sync: () => Promise<void>
}
const Context = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: PropsWithChildren) {
  const { user } = useAuth()
  const userId = user?.id
  const { i18n: translator } = useTranslation()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<LanguageContextValue['error']>(null)
  const handledUser = useRef<number | null>(null)
  const currentUser = useRef(user)
  currentUser.current = user
  const revision = useRef(0)
  const syncQueue = useRef(Promise.resolve())
  const language = isLanguage(translator.resolvedLanguage) ? translator.resolvedLanguage : 'vi'

  useEffect(() => {
    let active = true
    void AsyncStorage.getItem(LANGUAGE_KEY).then(async (saved) => {
      if (active && isLanguage(saved)) await i18n.changeLanguage(saved)
    }).catch(() => { if (active) setError('preferenceError') }).finally(() => { if (active) setReady(true) })
    return () => { active = false }
  }, [])

  const sync = useCallback(() => {
    const operation = syncQueue.current.then(async () => {
      const activeUser = currentUser.current
      if (!activeUser) return
      const languageRevision = revision.current
      try {
        const pending = await AsyncStorage.getItem(pendingKey(activeUser.id))
        if (!isLanguage(pending)) return
        if (currentUser.current?.id !== activeUser.id || languageRevision !== revision.current) return
        const updated = await authAPI.language(pending)
        if (currentUser.current?.id !== activeUser.id || languageRevision !== revision.current) return
        await AsyncStorage.removeItem(pendingKey(activeUser.id))
        session.updateUser(updated)
        setError(null)
      } catch {
        if (currentUser.current?.id === activeUser.id) setError('languageSyncFailed')
      }
    })
    syncQueue.current = operation.catch(() => undefined)
    return operation
  }, [])

  const setLanguage = useCallback(async (next: Language) => {
    revision.current += 1
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, next)
      await i18n.changeLanguage(next)
      setError(null)
      if (currentUser.current) {
        await AsyncStorage.setItem(pendingKey(currentUser.current.id), next)
        await sync()
      }
    } catch { setError('preferenceError') }
  }, [sync])

  useEffect(() => {
    if (!userId) { handledUser.current = null; revision.current += 1; return }
    if (!ready || handledUser.current === userId) return
    handledUser.current = userId
    const id = userId
    let active = true
    void (async () => {
      const pending = await AsyncStorage.getItem(pendingKey(id))
      if (!active) return
      const profileLanguage = currentUser.current?.ui_language
      const localLanguage = isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : 'vi'
      const next = isLanguage(pending) ? pending : isLanguage(profileLanguage) ? profileLanguage : localLanguage
      await AsyncStorage.setItem(LANGUAGE_KEY, next)
      if (!active) return
      await i18n.changeLanguage(next)
      if (isLanguage(pending) || !isLanguage(profileLanguage)) {
        await AsyncStorage.setItem(pendingKey(id), next)
        await sync()
      }
    })().catch(() => { if (active) setError('preferenceError') })
    return () => { active = false }
  }, [userId, ready, sync])

  return <Context.Provider value={{ language, ready, error, setLanguage, sync }}>{children}</Context.Provider>
}

export function useLanguage() {
  const value = useContext(Context)
  if (!value) throw new Error('LanguageProvider is missing')
  return value
}
