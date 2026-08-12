import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { APP_VERSION } from './lib/constants'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// ── PWA update kit ───────────────────────────────────────────────────────────
// Eager updates: check for a new version on every launch AND whenever the
// installed app returns to the foreground (iOS keeps PWAs alive in the
// background, so launch alone never rechecks). When a new service worker takes
// over, reload once so the new version shows immediately instead of on the
// next open.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
    .then((reg) => {
      reg.update().catch(() => {})
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {})
      })
      // Loud drift guard: a forgotten VERSION bump in sw.js disables updates
      // invisibly — surface it in the console where a deploy check will see it.
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data?.type === 'sw-version' && e.data.version !== APP_VERSION) {
          console.error(`sw.js VERSION ${e.data.version} ≠ APP_VERSION ${APP_VERSION} — updates are broken; bump sw.js`)
        }
      })
      reg.active?.postMessage('version')
    })
    .catch(() => {})

  let hadController = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return } // first install — nothing to swap
    // Never yank a half-finished capture away: AddPart/Add-Car set this flag
    // while a form is open. The update simply lands on the next open instead.
    if (window.__pvFormOpen) return
    const note = document.createElement('div')
    note.textContent = 'Updating to the latest version…'
    note.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#17150F;color:#fff;padding:10px 18px;border-radius:12px;font:600 14px Inter,system-ui,sans-serif;z-index:9999'
    document.body.appendChild(note)
    setTimeout(() => location.reload(), 600)
  })
}
