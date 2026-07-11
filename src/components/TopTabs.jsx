// Top-of-header Cars/Settings switch — replaces the bottom tab bar to free
// vertical screen space. Rendered inside each top-level screen's dark header.
export default function TopTabs({ active, onCars, onCollect, onAccount, onScan }) {
  const pill = on => ({
    background: on ? '#fff' : 'transparent',
    color: on ? '#1c1c1e' : 'rgba(255,255,255,0.85)',
    border: 'none', borderRadius: 16, padding: '6px 11px',
    fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
  })
  return (
    <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 20, padding: 3 }}>
      <button style={pill(active === 'cars')} onClick={onCars}>🚗 Cars</button>
      {onCollect && <button style={pill(active === 'collect')} onClick={onCollect}>📥 Collect</button>}
      {onScan && <button style={pill(active === 'scan')} onClick={onScan}>📷 Scan</button>}
      <button style={pill(active === 'settings')} onClick={onAccount}>⚙️</button>
    </div>
  )
}
