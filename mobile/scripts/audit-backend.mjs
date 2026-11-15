import { readFile } from 'node:fs/promises'

const root = new URL('../../', import.meta.url)
const read = path => readFile(new URL(path, root), 'utf8')
const main = await read('backend/app/main.py')
const router = await read('backend/app/api/grammar_practice.py')
const web = await read('frontend/src/services/api.ts')
const mobile = await read('mobile/src/api/phase2.ts')
const checks = {
  routerPrefix: router.includes('prefix="/grammar-practice"'),
  registeredWithoutApi: main.includes('include_router(grammar_practice.router)'),
  registeredWithApi: main.includes('include_router(grammar_practice.router, prefix="/api")'),
  sessionRoute: router.includes('@router.post("/sessions")'),
  generateRoute: router.includes('@router.post("/generate")'),
  mobileMatchesWeb: mobile.includes("'/grammar-practice/sessions'") && web.includes("'/grammar-practice/sessions'"),
  semantic404WhenNoQuestions: /if not selected:[\s\S]*?HTTPException\(404/.test(router),
}
console.log('SOURCE ROUTE AUDIT', checks)
console.log('With a base URL ending /api, use /grammar-practice/sessions, not /api/grammar-practice/sessions in the Axios call.')
const base = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000/api'
try {
  const response = await fetch(new URL('/openapi.json', base), { signal: AbortSignal.timeout(6000) })
  if (!response.ok) throw new Error(`OpenAPI HTTP ${response.status}`)
  const schema = await response.json()
  for (const path of ['/grammar-practice/sessions', '/api/grammar-practice/sessions', '/grammar-practice/generate', '/api/grammar-practice/generate']) console.log('LIVE', path, Boolean(schema.paths[path]?.post))
} catch {
  console.log('LIVE NOT VERIFIED: the configured backend is not reachable or does not expose OpenAPI. Start the intended backend, then rerun. This script never starts or restarts it.')
}
if (Object.values(checks).some(value => !value)) process.exitCode = 1
