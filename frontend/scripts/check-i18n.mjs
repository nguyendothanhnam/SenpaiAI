import { readFile } from 'node:fs/promises'

const locales = new URL('../src/i18n/locales/', import.meta.url)
const namespaces = ['common', 'nav', 'auth', 'profile', 'settings', 'errors', 'grammar']
function flatten(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return child && typeof child === 'object' && !Array.isArray(child) ? flatten(child, path) : [[path, child]]
  })
}
let failed = false
for (const namespace of namespaces) {
  const vi = flatten(JSON.parse(await readFile(new URL(`vi/${namespace}.json`, locales), 'utf8')))
  const en = flatten(JSON.parse(await readFile(new URL(`en/${namespace}.json`, locales), 'utf8')))
  const viKeys = vi.map(([key]) => key).sort()
  const enKeys = en.map(([key]) => key).sort()
  if (JSON.stringify(viKeys) !== JSON.stringify(enKeys)) { failed = true; console.error(`${namespace}: locale keys differ`) }
  for (const [locale, entries] of [['vi', vi], ['en', en]]) {
    const empty = entries.filter(([, value]) => typeof value !== 'string' || !value.trim()).map(([key]) => key)
    if (empty.length) { failed = true; console.error(`${locale}/${namespace}: empty values: ${empty.join(', ')}`) }
  }
}
if (failed) process.exit(1)
console.log('i18n locale keys and values are valid.')
