// Hermes can lack these Intl APIs. Load them before initializing i18next so
// shared JSON v4 keys (_one/_other) work instead of falling back to JSON v3.
import '@formatjs/intl-getcanonicallocales/polyfill.js'
import '@formatjs/intl-locale/polyfill.js'
import '@formatjs/intl-pluralrules/polyfill-force.js'
import '@formatjs/intl-pluralrules/locale-data/vi.js'
import '@formatjs/intl-pluralrules/locale-data/en.js'
