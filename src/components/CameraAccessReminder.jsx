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

  const btn = (bg, color, extra = {}) => ({ flex: 1, padding: '12px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', background: bg, color, ...extra })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex', alignItems: 'flex-end' }} onClick={gotIt}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, paddingBottom: 'calc(20px + env(safe-area-inset-bottom))', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 8 }}>📷 Allow camera access</div>
        <div style={{ fontSize: 14, color: C.text, lineHeight: 1.5, marginBottom: 12 }}>
          So PartVault doesn't ask for the camera every time, set this site's camera permission to <b>Allow</b> (not "Ask"):
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', fontSize: 13, color: C.text, lineHeight: 1.6, marginBottom: 16 }}>
          <div><b>iPhone (Safari):</b> tap <b>aA</b> in the address bar → <b>Website Settings</b> → <b>Camera → Allow</b>. Using it from a Safari tab remembers this better than the home-screen icon.</div>
          <div style={{ marginTop: 8 }}><b>Android (Chrome):</b> tap the <b>🔒</b> in the address bar → <b>Permissions → Camera → Allow</b>.</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={never} style={btn(C.card, C.muted, { border: `1.5px solid ${C.border}` })}>Don't ask again</button>
          <button onClick={gotIt} style={btn(C.accent, '#fff')}>Got it</button>
        </div>
      </div>
    </div>
  )
}
