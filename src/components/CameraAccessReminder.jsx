import { useState, useEffect } from 'react'
import { C } from '../lib/constants'

// Nudges the user to set the site's camera permission to "Allow" so they aren't
// asked every time. Checks the Permissions API where available (Chrome/Android);
// on browsers that can't report camera state (iOS Safari) it shows once until
// dismissed. "Don't ask again" suppresses it permanently.
const NEVER_KEY = 'pv_cam_perm_never'
const SESSION_KEY = 'pv_cam_perm_session'

export default function CameraAccessReminder() {
  const [show, setShow] = useState(false)
  const [denied, setDenied] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(NEVER_KEY) || sessionStorage.getItem(SESSION_KEY)) return
    let cancelled = false
    ;(async () => {
      let state = 'unknown'
      try {
        if (navigator.permissions?.query) state = (await navigator.permissions.query({ name: 'camera' })).state
      } catch { state = 'unknown' }
      // Only nudge when it's not already granted (or we can't tell).
      if (!cancelled && state !== 'granted') setShow(true)
    })()
    return () => { cancelled = true }
  }, [])

  if (!show) return null

  const gotIt = () => { try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* ignore */ } setShow(false) }
  const never = () => { try { localStorage.setItem(NEVER_KEY, '1') } catch { /* ignore */ } setShow(false) }

  // Trigger the native camera permission prompt directly. Works when access is
  // undecided; if it was previously blocked the browser won't re-prompt, so we
  // fall back to the manual steps (no web API can open settings for you).
  const requestAccess = async () => {
    setBusy(true)
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true })
      s.getTracks().forEach(t => t.stop())
      setShow(false)
    } catch {
      setDenied(true)
    }
    setBusy(false)
  }

  const btn = (bg, color, extra = {}) => ({ flex: 1, padding: '12px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', background: bg, color, ...extra })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex', alignItems: 'flex-end' }} onClick={gotIt}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, paddingBottom: 'calc(20px + env(safe-area-inset-bottom))', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 8 }}>📷 Allow camera access</div>
        <div style={{ fontSize: 14, color: C.text, lineHeight: 1.5, marginBottom: 12 }}>
          {denied
            ? <>Camera access looks <b>blocked</b>, so the prompt won't reappear. Set it to <b>Allow</b> manually:</>
            : <>So PartVault doesn't ask every time, allow the camera. Tap <b>Allow camera</b> below, or set it to <b>Allow</b> in your browser:</>}
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', fontSize: 13, color: C.text, lineHeight: 1.6, marginBottom: 16 }}>
          <div><b>iPhone (Safari):</b> tap <b>aA</b> in the address bar → <b>Website Settings</b> → <b>Camera → Allow</b>. Using it from a Safari tab remembers this better than the home-screen icon.</div>
          <div style={{ marginTop: 8 }}><b>Android (Chrome):</b> tap the <b>🔒</b> in the address bar → <b>Permissions → Camera → Allow</b>.</div>
        </div>
        {!denied && (
          <button onClick={requestAccess} disabled={busy} style={{ ...btn(C.accent, '#fff'), width: '100%', marginBottom: 10, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Requesting…' : '📷 Allow camera'}
          </button>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={never} style={btn(C.card, C.muted, { border: `1.5px solid ${C.border}` })}>Don't ask again</button>
          <button onClick={gotIt} style={btn(denied ? C.accent : C.card, denied ? '#fff' : C.text, denied ? {} : { border: `1.5px solid ${C.border}` })}>Got it</button>
        </div>
      </div>
    </div>
  )
}
