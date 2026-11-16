import './polyfills'
import { createInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'
import { getLocales } from 'expo-localization'
import { resources } from './resources'
import type { Language } from '../api/types'

export const isLanguage = (value: unknown): value is Language => value === 'vi' || value === 'en'
const deviceLanguage = getLocales()[0]?.languageCode
export const i18n = createInstance()
void i18n.use(initReactI18next).init({
  resources,
  lng: isLanguage(deviceLanguage) ? deviceLanguage : 'vi',
  fallbackLng: 'vi',
  supportedLngs: ['vi', 'en'],
  defaultNS: 'common',
  initImmediate: false,
  interpolation: { escapeValue: false },
  returnNull: false,
})
