import assert from 'node:assert/strict'
import test from 'node:test'
import { createInstance } from 'i18next'
import { resources } from '../src/i18n/resources'

test('initializes JSON v4 translations when the runtime lacks Hermes Intl APIs', async () => {
  const nativeDescriptors = ['getCanonicalLocales', 'Locale', 'PluralRules'].map((key) => [key, Object.getOwnPropertyDescriptor(Intl, key)] as const)
  const errors: unknown[][] = []
  const translator = createInstance()
  try {
    for (const [key] of nativeDescriptors) Reflect.deleteProperty(Intl, key)
    await import('../src/i18n/polyfills')
    assert.equal(typeof Intl.PluralRules, 'function')
    translator.use({ type: 'logger', log: () => undefined, warn: () => undefined, error: (...args: unknown[]) => { errors.push(args) } })
    await translator.init({ resources, lng: 'en', fallbackLng: 'vi', defaultNS: 'common', initImmediate: false })
    assert.equal(translator.t('library.documentCount', { count: 1 }), '1 document found')
    assert.equal(translator.t('library.documentCount', { count: 2 }), '2 documents found')
    await translator.changeLanguage('vi')
    assert.equal(translator.t('library.documentCount', { count: 2 }), 'Tìm thấy 2 tài liệu')
    assert.deepEqual(errors, [])
  } finally {
    for (const [key, descriptor] of nativeDescriptors) {
      if (descriptor) Object.defineProperty(Intl, key, descriptor)
      else Reflect.deleteProperty(Intl, key)
    }
  }
})
