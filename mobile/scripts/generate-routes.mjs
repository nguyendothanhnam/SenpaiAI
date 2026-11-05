import path from 'node:path'
import fs from 'node:fs'
import { createRequire } from 'node:module'

// Generate route types without starting a development server, using Expo's
// own generator from the pinned SDK rather than maintaining a separate list.
const require = createRequire(import.meta.url)
const expoRequire = createRequire(require.resolve('expo/package.json'))
const cliRequire = createRequire(expoRequire.resolve('@expo/cli/package.json'))
const directory = path.resolve(import.meta.dirname, '../.expo/types')
fs.mkdirSync(directory, { recursive: true })
process.env.EXPO_ROUTER_APP_ROOT = path.resolve(import.meta.dirname, '../app')
cliRequire('@expo/router-server/build/typed-routes').regenerateDeclarations(directory, {})
