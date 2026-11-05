import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'

const shared = new URL('../../frontend/src/i18n/locales/', import.meta.url)
const local = new URL('../src/i18n/locales/', import.meta.url)
function flatten(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return child && typeof child === 'object' ? flatten(child, path) : [[path, child]]
  })
}
const namespaces = (await readdir(new URL('vi/', shared))).filter((file) => file.endsWith('.json'))
for (const name of [...namespaces, 'mobile']) {
  const pairs = await Promise.all(['vi', 'en'].map(async (language) => {
    const path = name === 'mobile' ? new URL(`${language}.json`, local) : new URL(`${language}/${name}`, shared)
    const entries = flatten(JSON.parse(await readFile(path, 'utf8')))
    for (const [key, value] of entries) assert.ok(typeof value === 'string' && value.trim(), `${name}/${language}: ${key} is empty`)
    return new Map(entries)
  }))
  assert.deepEqual([...pairs[0].keys()].sort(), [...pairs[1].keys()].sort(), `${name}: keys differ`)
  for (const [key, value] of pairs[0]) {
    const placeholders = (text) => [...text.matchAll(/{{\s*([^},]+)(?:,[^}]+)?}}/g)].map((match) => match[1]).sort()
    assert.deepEqual(placeholders(value), placeholders(pairs[1].get(key)), `${name}.${key}: interpolation differs`)
  }
}
console.log(`Shared web namespaces (${namespaces.length}) and mobile translations match. No source files written.`)
