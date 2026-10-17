import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const allowedAttributes = new Set(['placeholder', 'title', 'aria-label', 'alt'])
const exceptions = /^(SenpaiAI|JLPT|N[1-5]|[A-Z]{2,5}|https?:\/\/|\/|#[0-9a-f]{3,8}$)/i
const textPattern = /[A-Za-z]{3,}|[À-ỹ]{3,}/u
const files = []

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) await collect(fullPath)
    else if (/\.(tsx|jsx)$/.test(entry.name)) files.push(fullPath)
  }
}

await collect(fileURLToPath(new URL('../src/', import.meta.url)))
const findings = []
for (const file of files) {
  const source = await readFile(file, 'utf8')
  const scriptKind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.JSX
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind)
  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const value = node.getText(ast).replace(/\s+/g, ' ').trim()
      if (textPattern.test(value) && !exceptions.test(value)) findings.push({ file, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, value })
    }
    if (ts.isJsxAttribute(node) && allowedAttributes.has(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const value = node.initializer.text.trim()
      if (textPattern.test(value) && !exceptions.test(value)) findings.push({ file, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, value })
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
}

for (const { file, line, value } of findings) {
  console.log(`${path.relative(path.dirname(fileURLToPath(import.meta.url)), file)}:${line}: ${value}`)
}
if (findings.length) process.exitCode = 1
else console.log('No unlocalized JSX text or UI attributes found.')
