import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// GitHub Pages has no SPA fallback, so deep links like /p/<sku> (scanned part
// QR) or /c/<code> (container QR) would 404. Emit a 404.html that is a copy of
// the built index.html — Pages serves it for any unknown path, the app boots,
// reads window.location.pathname and resolves the code. Uses the hashed asset
// refs from the real index, so bundles still load.
function spa404Fallback() {
  return {
    name: 'spa-404-fallback',
    closeBundle() {
      const idx = resolve('dist/index.html')
      if (existsSync(idx)) copyFileSync(idx, resolve('dist/404.html'))
    },
  }
}

export default defineConfig({
  plugins: [react(), spa404Fallback()],
  base: '/',
})
