import Icon from './Icon'

// Top-of-header Cars/Collect/Scan/Settings switch. Field rules: every tab is a
// ≥48px target (gloves), the row stretches full-width so thumbs don't hunt,
// and the selected state is a light fill — orange is reserved for actions.
export default function TopTabs({ active, onCars, onCollect, onAccount, onScan }) {
  const pill = on => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    flex: 1, minHeight: 'var(--tap, 48px)',
    background: on ? '#fff' : 'transparent',
    color: on ? 'var(--ink, #17150F)' : 'rgba(255,255,255,0.85)',
    border: 'none', borderRadius: 'var(--r-sm, 8px)', padding: '0 12px',
    fontSize: 15, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
  })
  return (
    <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 'var(--r-md, 12px)', padding: 4, flex: 1 }}>
      <button style={pill(active === 'cars')} onClick={onCars}><Icon name="car" /> Cars</button>
      {onCollect && <button style={pill(active === 'collect')} onClick={onCollect}><Icon name="inbox" /> Collect</button>}
      {onScan && <button style={pill(active === 'scan')} onClick={onScan}><Icon name="camera" /> Scan</button>}
      <button style={{ ...pill(active === 'settings'), flex: '0 0 auto', width: 'var(--tap, 48px)' }} onClick={onAccount} aria-label="Settings"><Icon name="gear" /></button>
    </div>
  )
}
