import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import ts from 'typescript'

// Names, license identifiers and numeric notation stay identical in both locales.
const allowed = new Set(['SenpaiAI', 'KanjiVG · CC BY-SA 3.0'])
async function files(folder) {
  const entries = await readdir(folder, { withFileTypes: true })
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(new URL(`${e.name}/`, folder)) : e.name.endsWith('.tsx') ? [new URL(e.name, folder)] : []))).flat()
}
const issues = []
for (const file of [...await files(new URL('../src/', import.meta.url)), ...await files(new URL('../app/', import.meta.url))]) {
  const source = ts.createSourceFile(file.pathname, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  function inspect(node) {
    let text
    if (ts.isJsxText(node)) text = node.text.trim()
    if (ts.isJsxAttribute(node) && ['title', 'placeholder', 'accessibilityLabel'].includes(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer)) text = node.initializer.text.trim()
    if (text && /[a-zA-ZÀ-ỹ]/u.test(text) && !allowed.has(text)) issues.push(`${file.pathname}:${source.getLineAndCharacterOfPosition(node.pos).line + 1}: ${text}`)
    ts.forEachChild(node, inspect)
  }
  inspect(source)
}
assert.deepEqual(issues, [], 'Untranslated static UI text. Use a shared i18next key.')
console.log('Static mobile JSX labels use translations; product/license names are allowlisted.')
