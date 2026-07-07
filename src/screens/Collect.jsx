import { useState, useEffect } from 'react'
import { sb } from '../lib/supabase'
import { C } from '../lib/constants'
import TopTabs from '../components/TopTabs'

// "Collect" — a yard pick-list of sold parts that still need pulling from stock.
// Reads the same ebay_sales + sale_workflow the admin Sales pipeline uses, so
// marking a part Collected here ticks its stage in the admin fulfilment queue
// live (shared sale_workflow table). Shows the part photo, SKU and the donor car
// so it's easy to find on the shelf.
const DAY = 86400000
const fmtDate = t => t ? new Date(t).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : ''

export default function Collect({ storeId, activeStore, onCars, onCollect, onAccount }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [err, setErr] = useState('')

  const load = async () => {
    setLoading(true); setErr('')
    const since = new Date(Date.now() - 60 * DAY).toISOString()
    // Sold, matched to an inventory part, in the last 60 days.
    const { data: sales, error } = await sb.from('ebay_sales')
      .select('id, sku, title, sold_at, buyer, ship_to, part_id, quantity')
      .eq('store_id', storeId).eq('cancelled', false).not('part_id', 'is', null)
      .gte('sold_at', since).order('sold_at', { ascending: false })
    if (error) { setErr('Could not load sales.'); setItems([]); setLoading(false); return }
    const rows = sales || []
    if (!rows.length) { setItems([]); setLoading(false); return }

    const saleIds = rows.map(r => r.id)
    const partIds = [...new Set(rows.map(r => r.part_id))]
    const [wfRes, partsRes, photosRes] = await Promise.all([
      sb.from('sale_workflow').select('sale_id, collected_at').in('sale_id', saleIds),
      sb.from('parts').select('id, sku, title, car_id, location').in('id', partIds),
      sb.from('photos').select('parent_id, thumb_url, url, is_primary').eq('parent_type', 'part').in('parent_id', partIds),
    ])
    const collected = new Set((wfRes.data || []).filter(w => w.collected_at).map(w => w.sale_id))
    const partById = Object.fromEntries((partsRes.data || []).map(p => [p.id, p]))
    const carIds = [...new Set((partsRes.data || []).map(p => p.car_id).filter(Boolean))]
    let carById = {}
    if (carIds.length) {
      const { data: cars } = await sb.from('cars').select('id, make, model, year').in('id', carIds)
      carById = Object.fromEntries((cars || []).map(c => [c.id, c]))
    }
    // Prefer the primary photo's thumb; fall back to any photo.
    const photoByPart = {}
    for (const ph of (photosRes.data || [])) {
      if (!photoByPart[ph.parent_id] || ph.is_primary) photoByPart[ph.parent_id] = ph.thumb_url || ph.url
    }

    const list = rows.filter(r => !collected.has(r.id)).map(r => {
      const p = partById[r.part_id] || {}
      const car = p.car_id ? carById[p.car_id] : null
      return {
        saleId: r.id,
        title: p.title || r.title || 'Untitled part',
        sku: p.sku || r.sku || '',
        location: p.location || null,
        thumb: photoByPart[r.part_id] || null,
        car: car ? [car.make, car.model, car.year].filter(Boolean).join(' ') : null,
        buyer: r.buyer || null,
        city: r.ship_to?.city || null,
        soldAt: r.sold_at,
      }
    })
    setItems(list); setLoading(false)
  }

  useEffect(() => { load() }, [storeId])

  const markCollected = async (saleId) => {
    setBusyId(saleId)
    const { data: { user } } = await sb.auth.getUser()
    const now = new Date().toISOString()
    const { error } = await sb.from('sale_workflow').upsert(
      { sale_id: saleId, store_id: storeId, collected_at: now, collected_by: user?.id || null, updated_at: now, updated_by: user?.id || null },
      { onConflict: 'sale_id' })
    if (error) { setErr('Could not save — try again.'); setBusyId(null); return }
    setItems(list => list.filter(i => i.saleId !== saleId))
    setBusyId(null)
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div style={{ background: C.headerBg, padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 'calc(12px + env(safe-area-inset-top))' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 18, fontFamily: "'Inter Tight',system-ui,sans-serif" }}>PartVault</div>
          {activeStore && <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeStore.store_name}</div>}
        </div>
        <TopTabs active="collect" onCars={onCars} onCollect={onCollect} onAccount={onAccount} />
      </div>

      <div style={{ padding: 20, paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>Collect</div>
          <button onClick={load} style={{ background: 'none', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '7px 12px', fontSize: 13, fontWeight: 600, color: C.muted, cursor: 'pointer' }}>↻ Refresh</button>
        </div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
          {loading ? 'Loading…' : items.length ? `${items.length} sold part${items.length === 1 ? '' : 's'} to pull from stock` : ''}
        </div>

        {err && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{err}</div>}

        {!loading && items.length === 0 && (
          <div style={{ textAlign: 'center', color: C.muted, padding: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 15 }}>All caught up</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>No sold parts waiting to be collected.</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(it => (
            <div key={it.saleId} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
              {it.thumb
                ? <img src={it.thumb} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />
                : <div style={{ width: 56, height: 56, borderRadius: 10, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>📦</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
                {it.location
                  ? <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e', fontSize: 13, fontWeight: 800, borderRadius: 8, padding: '3px 9px', maxWidth: '100%', overflow: 'hidden' }}>
                      <span>📍</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.location}</span>
                    </div>
                  : <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontStyle: 'italic' }}>📍 No location set</div>}
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                  {it.sku ? <span style={{ fontFamily: 'monospace', fontWeight: 700, color: C.text }}>{it.sku}</span> : 'no SKU'} · sold {fmtDate(it.soldAt)}
                </div>
                {it.car && <div style={{ fontSize: 12, color: C.accent, fontWeight: 600, marginTop: 2 }}>🚗 {it.car}</div>}
                {(it.buyer || it.city) && <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{[it.buyer, it.city].filter(Boolean).join(' · ')}</div>}
              </div>
              <button onClick={() => markCollected(it.saleId)} disabled={busyId === it.saleId}
                style={{ flexShrink: 0, background: C.green, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: busyId === it.saleId ? 0.6 : 1 }}>
                {busyId === it.saleId ? '…' : '✓ Collected'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
