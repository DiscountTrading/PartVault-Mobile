import { sb } from '../lib/supabase'
import { C } from '../lib/constants'

export default function Account({ email, stores = [], activeStoreId, setActiveStore }) {
  const active = stores.find(s => s.store_id === activeStoreId)

  const labelStyle = { fontSize: 12, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }
  const cardStyle = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingBottom: 90 }}>
      <div style={{ background: C.headerBg, padding: '16px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 18, fontFamily: "'Inter Tight',system-ui,sans-serif" }}>Account</div>
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

        <button onClick={() => sb.auth.signOut()}
          style={{ marginTop: 24, width: '100%', padding: 14, background: '#fff', color: C.red, border: `1.5px solid ${C.border}`, borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          Sign Out
        </button>
      </div>
    </div>
  )
}
