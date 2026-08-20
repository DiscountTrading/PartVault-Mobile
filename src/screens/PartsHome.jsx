import { useState, useEffect, useCallback } from 'react'
import { sb } from '../lib/supabase'
import { C, statusColor, statusLabel } from '../lib/constants'
import TopTabs from '../components/TopTabs'
import Icon from '../components/Icon'

// Buy-in home: a flat, capture-first parts list for stores that don't dismantle
// cars. "+ Add Part" goes straight to a carless capture. Parts are read-only
// here (edited on the admin app) — this view is for capturing and confirming.

export default function PartsHome({ storeId, activeStore, sourcing, onAddPartDirect, onCars, onCollect, onAccount, onScan }) {
  const [parts, setParts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    // Newest first; cap at a sensible page — this is a capture-confirm list, not
    // the full catalogue (that's the admin app).
    const { data } = await sb.from('parts')
      .select('id, title, make, model, year, sku, status, list_price, condition, created_at')
      .eq('store_id', storeId).is('deleted_at', null)
      .order('created_at', { ascending: false }).limit(100)
    setParts(data || [])
    setLoading(false)
  }, [storeId])
  useEffect(() => { load() }, [load])

  const q = search.trim().toLowerCase()
  const shown = q
    ? parts.filter(p => [p.title, p.make, p.model, p.year, p.sku].filter(Boolean).join(' ').toLowerCase().includes(q))
    : parts

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div style={{ background: C.headerBg, padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 'calc(12px + env(safe-area-inset-top))' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 18, fontFamily: "'Inter Tight',system-ui,sans-serif" }}>PartVault</div>
          {activeStore && <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeStore.store_name}</div>}
        </div>
        <TopTabs active="cars" onCars={onCars} onCollect={onCollect} onAccount={onAccount} onScan={onScan} />
      </div>

      <div style={{ padding: 20, paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>Parts</div>
          <button onClick={onAddPartDirect} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 12, minHeight: 48, padding: '0 20px', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
            + Add Part
          </button>
        </div>

        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search parts…"
          style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${C.borderControl}`, fontSize: 16, marginBottom: 16, boxSizing: 'border-box', outline: 'none' }} />

        {loading && <div style={{ textAlign: 'center', color: C.muted, padding: 40 }}>Loading…</div>}

        {!loading && shown.length === 0 && (
          <div style={{ textAlign: 'center', color: C.muted, padding: 60 }}>
            <div style={{ marginBottom: 12 }}><Icon name="box" size={44} strokeWidth={1.5} /></div>
            <div style={{ fontSize: 15 }}>{q ? 'No matching parts' : 'No parts yet'}</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>{q ? 'Try a different search' : 'Tap + Add Part to capture your first one'}</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shown.map(p => (
            <div key={p.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', minHeight: 72 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title || 'Untitled part'}</div>
                  <div style={{ fontSize: 15, color: C.muted, marginTop: 2 }}>
                    {[p.make, p.model, p.year].filter(Boolean).join(' ') || p.condition || '—'}
                    {p.sku ? ` · ${p.sku}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {p.list_price > 0 && <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>${p.list_price}</div>}
                  <div style={{ fontSize: 12, fontWeight: 600, color: statusColor(p.status), marginTop: 2 }}>{statusLabel(p.status)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
