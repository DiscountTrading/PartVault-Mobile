import { useState, useEffect } from 'react'
import { sb } from '../lib/supabase'
import { C } from '../lib/constants'
import { warehouseConfig, formatGridLoc, hasGridLoc } from '../lib/warehouse'
import WarehouseMap from '../components/WarehouseMap'

// Resolves a scanned QR deep link to a real screen: /p/<sku> → part detail,
// /c/<code> → container + its contents. Read-only "what is this / where is it".
// Searches the active store first, then any store the user can access (RLS keeps
// it to their own), so a label still resolves after switching stores.
const STATUS_COLOR = { in_stock: C.blue, listed: C.accent, sold: C.green, scrapped: C.muted, deferred: C.yellow }
const STATUS_LABEL = { in_stock: 'In stock', listed: 'Listed', sold: 'Sold', scrapped: 'Scrapped', deferred: 'Deferred' }

export default function Lookup({ storeId, target, warehouse, onClose }) {
  const wc = warehouseConfig(warehouse)
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    let live = true
    ;(async () => {
      setState({ loading: true })
      try {
        if (target.kind === 'part') {
          // Active store first, then any accessible store.
          let { data } = await sb.from('parts')
            .select('id, sku, title, status, list_price, make, model, year, location, loc_row, loc_bay, loc_shelf, container_id, store_id')
            .eq('store_id', storeId).eq('sku', target.value).is('deleted_at', null).limit(1)
          if (!data?.length) {
            ({ data } = await sb.from('parts')
              .select('id, sku, title, status, list_price, make, model, year, location, loc_row, loc_bay, loc_shelf, container_id, store_id')
              .eq('sku', target.value).is('deleted_at', null).limit(1))
          }
          const part = data?.[0]
          if (!part) { if (live) setState({ loading: false, notFound: true }); return }
          const [{ data: photos }, ctRes] = await Promise.all([
            sb.from('photos').select('thumb_url, url, is_primary').eq('parent_type', 'part').eq('parent_id', part.id),
            part.container_id ? sb.from('containers').select('code, name').eq('id', part.container_id).maybeSingle() : Promise.resolve({ data: null }),
          ])
          let thumb = null
          for (const ph of (photos || [])) { if (!thumb || ph.is_primary) thumb = ph.thumb_url || ph.url }
          if (live) setState({ loading: false, part, thumb, container: ctRes.data, otherStore: part.store_id !== storeId })
        } else {
          let { data } = await sb.from('containers').select('*')
            .eq('store_id', storeId).eq('code', target.value).is('deleted_at', null).limit(1)
          if (!data?.length) {
            ({ data } = await sb.from('containers').select('*').eq('code', target.value).is('deleted_at', null).limit(1))
          }
          const ct = data?.[0]
          if (!ct) { if (live) setState({ loading: false, notFound: true }); return }
          const { data: parts } = await sb.from('parts')
            .select('id, sku, title, status').eq('container_id', ct.id).is('deleted_at', null).order('title')
          if (live) setState({ loading: false, container: ct, parts: parts || [], otherStore: ct.store_id !== storeId })
        }
      } catch (e) {
        if (live) setState({ loading: false, error: e.message || 'Lookup failed' })
      }
    })()
    return () => { live = false }
  }, [target, storeId])

  const header = (
    <div style={{ background: C.headerBg, padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: 12, paddingTop: 'calc(12px + env(safe-area-inset-top))' }}>
      <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>← Back</button>
      <div style={{ color: '#fff', fontWeight: 800, fontSize: 17, fontFamily: "'Inter Tight',system-ui,sans-serif" }}>{target.kind === 'part' ? 'Part' : wc.containerLabel}</div>
    </div>
  )

  const wrap = (inner) => <div style={{ minHeight: '100vh', background: C.bg }}>{header}<div style={{ padding: 18, paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>{inner}</div></div>

  if (state.loading) return wrap(<div style={{ color: C.muted, textAlign: 'center', padding: 40 }}>Looking up {target.value}…</div>)
  if (state.error) return wrap(<div style={{ color: C.red }}>{state.error}</div>)
  if (state.notFound) return wrap(
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🤔</div>
      <div style={{ fontSize: 15, color: C.text }}>Nothing found for <b>{target.value}</b></div>
      <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>The label may belong to a different account, or the item was deleted.</div>
    </div>
  )

  const otherStoreNote = state.otherStore && (
    <div style={{ fontSize: 12, color: C.yellow, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
      This is in a different store from the one you have open.
    </div>
  )

  if (target.kind === 'part') {
    const p = state.part
    const fitment = [p.make, p.model, p.year].filter(Boolean).join(' ')
    const grid = formatGridLoc(p, warehouse)
    return wrap(
      <>
        {otherStoreNote}
        <div style={{ display: 'flex', gap: 14 }}>
          {state.thumb
            ? <img src={state.thumb} alt="" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 12, flexShrink: 0 }} />
            : <div style={{ width: 96, height: 96, borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, flexShrink: 0 }}>📦</div>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.text, lineHeight: 1.25 }}>{p.title || 'Untitled part'}</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 4, fontFamily: 'monospace', fontWeight: 700 }}>{p.sku || 'no SKU'}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: STATUS_COLOR[p.status] || C.muted, borderRadius: 20, padding: '3px 10px' }}>{STATUS_LABEL[p.status] || p.status}</span>
              {+p.list_price > 0 && <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>${(+p.list_price).toFixed(0)}</span>}
            </div>
          </div>
        </div>

        {fitment && <div style={{ fontSize: 13, color: C.accent, fontWeight: 600, marginTop: 14 }}>🚗 {fitment}</div>}

        <div style={{ marginTop: 16, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, marginBottom: 8 }}>WHERE IT IS</div>
          {state.container && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 8, background: '#eef2ff', border: '1px solid #c7d2fe', color: '#3730a3', fontSize: 14, fontWeight: 800, borderRadius: 8, padding: '4px 10px' }}>🪣 {[state.container.code, state.container.name].filter(Boolean).join(' · ')}</div>}
          {grid ? <div style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>🗺️ {grid}</div> : null}
          {p.location && <div style={{ fontSize: 13, color: C.text, marginTop: 6 }}>📍 {p.location}</div>}
          {!grid && !p.location && !state.container && <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No location recorded.</div>}
          {hasGridLoc(p) && wc.rows > 0 && wc.bays > 0 && (
            <div style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
              <WarehouseMap warehouse={warehouse} part={p} compact />
            </div>
          )}
        </div>
      </>
    )
  }

  // Container view
  const ct = state.container
  const home = formatGridLoc(ct, warehouse)
  return wrap(
    <>
      {otherStoreNote}
      <div style={{ fontSize: 20, fontWeight: 800, color: C.accent }}>🪣 {ct.code}</div>
      {ct.name && <div style={{ fontSize: 15, color: C.text, marginTop: 2 }}>{ct.name}</div>}
      {home && <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginTop: 8 }}>🗺️ {home}</div>}
      {hasGridLoc(ct) && wc.rows > 0 && wc.bays > 0 && (
        <div style={{ marginTop: 12, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
          <WarehouseMap warehouse={warehouse} part={ct} compact />
        </div>
      )}
      <div style={{ fontSize: 13, color: C.muted, margin: '16px 0 8px', fontWeight: 700 }}>
        {state.parts.length} part{state.parts.length === 1 ? '' : 's'} inside
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {state.parts.map(p => (
          <div key={p.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title || 'Untitled part'}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{p.sku || 'no SKU'}</span> · {STATUS_LABEL[p.status] || p.status}
            </div>
          </div>
        ))}
        {state.parts.length === 0 && <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>Empty — scan parts into it from the Scan tab.</div>}
      </div>
    </>
  )
}
