import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import commonVi from './locales/vi/common.json'
import navVi from './locales/vi/nav.json'
import authVi from './locales/vi/auth.json'
import profileVi from './locales/vi/profile.json'
import settingsVi from './locales/vi/settings.json'
import errorsVi from './locales/vi/errors.json'
import grammarVi from './locales/vi/grammar.json'
import commonEn from './locales/en/common.json'
import navEn from './locales/en/nav.json'
import authEn from './locales/en/auth.json'
import profileEn from './locales/en/profile.json'
import settingsEn from './locales/en/settings.json'
import errorsEn from './locales/en/errors.json'
import grammarEn from './locales/en/grammar.json'

export const LANGUAGE_STORAGE_KEY = 'senpai-ai-language'
export const supportedLanguages = ['vi', 'en'] as const
export type AppLanguage = (typeof supportedLanguages)[number]
export const isAppLanguage = (value: unknown): value is AppLanguage =>
  typeof value === 'string' && supportedLanguages.includes(value as AppLanguage)

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      vi: { common: commonVi, nav: navVi, auth: authVi, profile: profileVi, settings: settingsVi, errors: errorsVi, grammar: grammarVi },
      en: { common: commonEn, nav: navEn, auth: authEn, profile: profileEn, settings: settingsEn, errors: errorsEn, grammar: grammarEn },
    },
    supportedLngs: [...supportedLanguages],
    fallbackLng: 'vi',
    defaultNS: 'common',
    ns: ['common', 'nav', 'auth', 'profile', 'settings', 'errors', 'grammar'],
    load: 'languageOnly',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
    debug: import.meta.env.DEV,
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: (_languages, namespace, key) => {
      if (import.meta.env.DEV) console.warn(`[i18n] Missing translation: ${namespace}:${key}`)
    },
  })

export default i18n
