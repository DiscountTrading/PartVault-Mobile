import { useState } from 'react'
import { sb } from '../lib/supabase'
import { C, APP_VERSION } from '../lib/constants'
import { biometricSupported, isEnabledFor, enableBiometric, disableBiometric } from '../lib/biometric'
import TopTabs from '../components/TopTabs'

export default function Account({ email, userId, stores = [], activeStoreId, setActiveStore, onCars, onAccount }) {
  const active = stores.find(s => s.store_id === activeStoreId)
  const [bioOn, setBioOn] = useState(() => !!userId && isEnabledFor(userId))
  const [bioBusy, setBioBusy] = useState(false)
  const [bioErr, setBioErr] = useState('')

  const [refreshing, setRefreshing] = useState(false)

  // Force-refresh: clear any cached app shell and reload the latest deployed build.
  // (This is a website, so a cache-busting reload is all that's needed.)
  const forceRefresh = async () => {
    setRefreshing(true)
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map(r => r.unregister()))
      }
      if (window.caches) {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }
    } catch { /* best effort */ }
    window.location.replace(window.location.pathname + '?r=' + Date.now())
  }

  const toggleBio = async () => {
    setBioErr(''); setBioBusy(true)
    try {
      if (bioOn) { disableBiometric(); setBioOn(false) }
      else { await enableBiometric(userId, email); setBioOn(true) }
    } catch (e) { setBioErr(e?.message || 'Face ID setup failed') }
    setBioBusy(false)
  }

  const labelStyle = { fontSize: 12, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }
  const cardStyle = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
      <div style={{ background: C.headerBg, padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 'calc(12px + env(safe-area-inset-top))' }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 18, fontFamily: "'Inter Tight',system-ui,sans-serif" }}>Settings</div>
        <TopTabs active="settings" onCars={onCars} onAccount={onAccount} />
      </div>

      <div style={{ padding: 20 }}>
        {/* Signed-in user */}
        <label style={labelStyle}>Signed in as</label>
        <div style={{ ...cardStyle, marginBottom: 20, fontSize: 15, color: C.text, fontWeight: 600 }}>{email || '—'}</div>

        {/* Active store / switcher */}
        <label style={labelStyle}>Active store</label>
        {stores.length > 1 ? (
          <select value={activeStoreId || ''} onChange={e => setActiveStore(e.target.value)}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 16, boxSizing: 'border-box', background: '#fff' }}>
            {stores.map(s => <option key={s.store_id} value={s.store_id}>{s.store_name}</option>)}
          </select>
        ) : (
          <div style={{ ...cardStyle, fontSize: 15, color: C.text, fontWeight: 600 }}>{active?.store_name || '—'}</div>
        )}
        {active && (
          <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>
            Role: {active.role}{active.ebay_connected ? ` · eBay: ${active.ebay_user || 'connected'}` : ' · eBay not connected'}
          </div>
        )}

        {/* Where listing happens */}
        <div style={{ marginTop: 20, padding: 14, background: '#f0f6ff', border: '1px solid #cfe0ff', borderRadius: 12, fontSize: 13, color: C.text, lineHeight: 1.5 }}>
          📋 Use this app to capture parts in the yard. Reviewing and listing them to eBay is done from the PartVault admin on a computer.
          <a href="https://admin.partvault.app" target="partvault-admin"
            style={{ display: 'block', marginTop: 12, textAlign: 'center', background: '#fff', color: C.accent, border: `1.5px solid ${C.accent}`, borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
            🖥️ Open Admin Panel ↗
          </a>
        </div>

        {/* Face ID app lock */}
        {biometricSupported() && (
          <div style={{ marginTop: 22 }}>
            <label style={labelStyle}>Security</label>
            <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 15, color: C.text, fontWeight: 600 }}>🔒 Face ID unlock</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{bioOn ? 'On — Face ID is required to open the app.' : 'Require Face ID to open the app on this device.'}</div>
              </div>
              <button onClick={toggleBio} disabled={bioBusy || !userId}
                style={{ padding: '9px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', background: bioOn ? '#fff' : C.accent, color: bioOn ? C.red : '#fff', boxShadow: bioOn ? `inset 0 0 0 1.5px ${C.border}` : 'none', opacity: bioBusy ? 0.6 : 1 }}>
                {bioBusy ? '…' : bioOn ? 'Turn off' : 'Turn on'}
              </button>
            </div>
            {bioErr && <div style={{ fontSize: 12, color: C.red, marginTop: 8 }}>{bioErr}</div>}
          </div>
        )}

        {/* App version + force refresh */}
        <div style={{ marginTop: 22 }}>
          <label style={labelStyle}>App version</label>
          <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 15, color: C.text, fontWeight: 600 }}>PartVault v{APP_VERSION}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Tap refresh to make sure you're on the current version.</div>
            </div>
            <button onClick={forceRefresh} disabled={refreshing}
              style={{ padding: '9px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', background: C.accent, color: '#fff', opacity: refreshing ? 0.6 : 1 }}>
              {refreshing ? '…' : '🔄 Refresh'}
            </button>
          </div>
        </div>

        <button onClick={() => sb.auth.signOut()}
          style={{ marginTop: 24, width: '100%', padding: 14, background: '#fff', color: C.red, border: `1.5px solid ${C.border}`, borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          Sign Out
        </button>
      </div>
    </div>
  )
}
