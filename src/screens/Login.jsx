import { useState } from 'react'
import { sb } from '../lib/supabase'
import { C } from '../lib/constants'

export default function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const sendCode = async () => {
    setError('')
    setLoading(true)
    const { error: e } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    if (e) setError(e.message)
    else setStep('code')
    setLoading(false)
  }

  const verifyCode = async () => {
    setError('')
    setLoading(true)
    const { error: e } = await sb.auth.verifyOtp({ email, token: code, type: 'email' })
    if (e) setError(e.message)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.accent, fontFamily: "'Inter Tight',system-ui,sans-serif", letterSpacing: '-0.5px' }}>PartVault</div>
          <div style={{ fontSize: 14, color: C.muted, marginTop: 4 }}>Field App</div>
        </div>

        <div style={{ background: C.card, borderRadius: 16, padding: 24, border: `1px solid ${C.border}` }}>
          {step === 'email' ? (
            <>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendCode()}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 16, boxSizing: 'border-box', outline: 'none' }}
                  placeholder="you@example.com" autoComplete="email"
                />
              </div>
              {error && <div style={{ color: C.red, fontSize: 13, marginBottom: 16 }}>{error}</div>}
              <button
                onClick={sendCode} disabled={loading || !email}
                style={{ width: '100%', padding: '14px', background: C.accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: (loading || !email) ? 0.6 : 1 }}
              >
                {loading ? 'Sending…' : 'Send Code'}
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 14, color: C.muted, marginBottom: 20 }}>
                Check your email at <strong style={{ color: C.text }}>{email}</strong> and enter the 6-digit code.
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Code</label>
                <input
                  type="number" inputMode="numeric" value={code} onChange={e => setCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && verifyCode()}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 22, letterSpacing: 6, textAlign: 'center', boxSizing: 'border-box', outline: 'none' }}
                  placeholder="000000" maxLength={6}
                />
              </div>
              {error && <div style={{ color: C.red, fontSize: 13, marginBottom: 16 }}>{error}</div>}
              <button
                onClick={verifyCode} disabled={loading || code.length < 6}
                style={{ width: '100%', padding: '14px', background: C.accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: (loading || code.length < 6) ? 0.6 : 1 }}
              >
                {loading ? 'Verifying…' : 'Sign In'}
              </button>
              <button onClick={() => { setStep('email'); setCode(''); setError('') }}
                style={{ width: '100%', marginTop: 10, padding: '10px', background: 'none', border: 'none', color: C.muted, fontSize: 14, cursor: 'pointer' }}>
                ← Back
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
