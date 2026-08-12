// Guard: sw.js VERSION must equal APP_VERSION in src/lib/constants.js.
// A browser only installs a new service worker when sw.js's BYTES change —
// a forgotten bump leaves every phone on the old cached app with no error
// anywhere. This runs before every build and fails loudly instead.
import { readFileSync } from 'node:fs'

const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/lib/constants.js', import.meta.url), 'utf8')

const swVersion = sw.match(/const VERSION = '([^']+)'/)?.[1]
const appVersion = app.match(/export const APP_VERSION = '([^']+)'/)?.[1]

if (!swVersion || !appVersion || swVersion !== appVersion) {
  console.error(`VERSION DRIFT: public/sw.js has '${swVersion}', constants.js has '${appVersion}'.`)
  console.error('Phones will silently keep the old app. Bump BOTH to the same value.')
  process.exit(1)
}
console.log(`version check ok: ${appVersion}`)
