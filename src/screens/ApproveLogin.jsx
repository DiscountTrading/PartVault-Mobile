import { useState } from 'react'
import { sb } from '../lib/supabase'
import { C, EDGE_FN } from '../lib/constants'
import Icon from '../components/Icon'

// Approve a computer sign-in. Reached by scanning the QR the admin login shows
// (opens /approve?code=…) or from Settings → "Approve a computer sign-in".
// The app itself is behind Face ID (if enabled), so approving = phone in hand
// + face verified. Approval only ever signs the computer into THIS account.
export default function ApproveLogin({ initialCode = '', email, onClose }) {
  const [code, setCode] = useState(initialCode)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  const approve = async () => {
    setBusy(true); setErr('')
    try {
      const { data: { session } } = await sb.auth.getSession()
      const res = await fetch(EDGE_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'phone_login_approve', code: code.trim() }),
      })
      const d = await res.json()
      if (!res.ok || d.error) throw new Error(d.error || 'Approval failed')
      setDone(true)
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const fmt = c => c.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
        <div style={{ marginBottom: 12 }}><Icon name="monitor" size={44} strokeWidth={1.5} /></div>
        {done ? (
          <>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 8 }}>Computer signed in</div>
            <div style={{ fontSize: 15, color: C.muted, marginBottom: 24, lineHeight: 1.6 }}>
              The computer showing this code is now signed in as <strong style={{ color: C.text }}>{email}</strong>. You can put your phone away.
            </div>
            <button onClick={onClose} style={{ width: '100%', minHeight: 56, background: C.accent, color: '#fff', border: 'none', borderRadius: 12, fontSize: 17, fontWeight: 700, cursor: 'pointer' }}>Done</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 8 }}>Approve a computer sign-in</div>
            <div style={{ fontSize: 15, color: C.muted, marginBottom: 20, lineHeight: 1.6 }}>
              This signs the computer in as <strong style={{ color: C.text }}>{email}</strong>.
              Only approve if <strong>you</strong> are signing in on a computer right now.
            </div>
            <input value={code} onChange={e => { setCode(fmt(e.target.value)); setErr('') }}
              placeholder="CODE FROM THE SCREEN" autoFocus={!initialCode}
              autoCapitalize="characters" autoCorrect="off" spellCheck={false}
              style={{ width: '100%', minHeight: 56, padding: '0 14px', borderRadius: 12, border: `1.5px solid ${C.borderControl}`, fontSize: 22, fontWeight: 700, letterSpacing: 4, textAlign: 'center', fontFamily: 'monospace', marginBottom: 14, boxSizing: 'border-box', outline: 'none' }} />
            {err && <div style={{ fontSize: 13, color: C.red, marginBottom: 12 }}>{err}</div>}
            <button onClick={approve} disabled={busy || code.length < 8}
              style={{ width: '100%', minHeight: 56, background: C.accent, color: '#fff', border: 'none', borderRadius: 12, fontSize: 17, fontWeight: 700, cursor: 'pointer', opacity: (busy || code.length < 8) ? 0.6 : 1 }}>
              {busy ? 'Approving…' : <><Icon name="check" /> Approve sign-in</>}
            </button>
            <button onClick={onClose} style={{ marginTop: 14, background: 'none', border: 'none', color: C.muted, fontSize: 14, cursor: 'pointer', minHeight: 48 }}>Cancel</button>
          </>
        )}
      </div>
    </div>
  )
}
