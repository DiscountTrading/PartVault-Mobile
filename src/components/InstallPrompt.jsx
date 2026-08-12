import { useState, useEffect } from 'react'
import { C } from '../lib/constants'
import Icon from './Icon'

// "Put PartVault on your home screen" — as close to one-tap install as each
// platform allows. Android fires beforeinstallprompt, so our button opens the
// browser's real install dialog. iOS has NO install API (Apple policy): the
// best legal move is a coach mark showing the Share → Add to Home Screen steps.
// Hidden once installed, and a dismissal snoozes it for 14 days.
const DISMISS_KEY = 'pv_install_dismissed'
const SNOOZE_DAYS = 14

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const snoozed = () => {
  try { return Date.now() - (+localStorage.getItem(DISMISS_KEY) || 0) < SNOOZE_DAYS * 86400000 } catch { return false }
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null)   // Android install event
  const [show, setShow] = useState(false)
  const [iosSteps, setIosSteps] = useState(false)

  useEffect(() => {
    if (isStandalone() || snoozed()) return
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); setShow(true) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    const onInstalled = () => { setShow(false); try { localStorage.setItem(DISMISS_KEY, String(Date.now() + 10 * 365 * 86400000)) } catch { /* ignore */ } }
    window.addEventListener('appinstalled', onInstalled)
    if (isIos()) setShow(true)   // no event ever comes on iOS — show the coach mark path
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [])

  const dismiss = () => { setShow(false); try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ } }
  const install = async () => {
    if (!deferred) return
    deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome !== 'accepted') dismiss(); else setShow(false)
    setDeferred(null)
  }

  if (!show) return null

  return (
    <div style={{ margin: '0 16px 12px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src="/icons/icon-192.png" alt="" width="38" height="38" style={{ borderRadius: 9 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Put PartVault on your home screen</div>
          <div style={{ fontSize: 13, color: C.muted }}>Opens full-screen, works offline in the yard.</div>
        </div>
        <button onClick={dismiss} aria-label="Not now" style={{ background: 'none', border: 'none', color: C.muted, minHeight: 48, padding: '0 6px', cursor: 'pointer' }}><Icon name="close" size={16} /></button>
      </div>
      {deferred ? (
        <button onClick={install} style={{ width: '100%', marginTop: 10, minHeight: 48, background: C.accent, color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
          Install app
        </button>
      ) : iosSteps ? (
        <div style={{ marginTop: 10, fontSize: 14, color: C.text, lineHeight: 1.7, background: C.bg, borderRadius: 8, padding: '10px 12px' }}>
          <strong>1.</strong> Tap the <strong>Share</strong> button <Icon name="upload" size={14} /> in Safari's toolbar<br />
          <strong>2.</strong> Scroll down and tap <strong>Add to Home Screen</strong><br />
          <strong>3.</strong> Tap <strong>Add</strong> — done.
        </div>
      ) : (
        <button onClick={() => setIosSteps(true)} style={{ width: '100%', marginTop: 10, minHeight: 48, background: C.accent, color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
          Show me how
        </button>
      )}
    </div>
  )
}
