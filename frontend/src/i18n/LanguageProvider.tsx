import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../services/auth'
import { authAPI } from '../services/api'
import i18n, { isAppLanguage, LANGUAGE_STORAGE_KEY, type AppLanguage } from './index'

const LanguageContext = createContext<{ language: AppLanguage; setLanguage: (language: AppLanguage) => void } | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { t } = useTranslation('common')
  const handledUser = useRef<number | null>(null)
  const language = isAppLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : 'vi'

  const setLanguage = useCallback((next: AppLanguage) => {
    if (!isAppLanguage(next)) return
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
    void i18n.changeLanguage(next)
    if (user) authAPI.updateMe({ ui_language: next }).catch((error) => console.warn('Could not save language preference', error))
  }, [user])

  useEffect(() => {
    const updateDocument = () => {
      const current = isAppLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : 'vi'
      document.documentElement.lang = current
      document.title = i18n.t('appTitle', { ns: 'common' })
    }
    updateDocument()
    i18n.on('languageChanged', updateDocument)
    return () => { i18n.off('languageChanged', updateDocument) }
  }, [t])

  useEffect(() => {
    if (!user || handledUser.current === user.id) return
    handledUser.current = user.id
    if (isAppLanguage(user.ui_language)) {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, user.ui_language)
      void i18n.changeLanguage(user.ui_language)
    } else {
      void authAPI.updateMe({ ui_language: language }).catch((error) => console.warn('Could not initialize language preference', error))
    }
  }, [user?.id, user?.ui_language])

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('useLanguage must be used within LanguageProvider')
  return value
}

