import { useState, useEffect } from 'react'
import { sb } from '../lib/supabase'
import { C, CATEGORY_NAMES } from '../lib/constants'

const STATUS_COLORS = { in_stock: C.blue, listed: C.accent, sold: C.green, scrapped: C.muted }
const STATUS_LABELS = { in_stock: 'In Stock', listed: 'Listed', sold: 'Sold', scrapped: 'Scrapped' }

export default function CarDetail({ car, storeId, onBack, onAddPart }) {
  const [parts, setParts] = useState([])
  const [loading, setLoading] = useState(true)
  const [completingCar, setCompletingCar] = useState(false)
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [carStatus, setCarStatus] = useState(car.status || 'active')
  const [editPart, setEditPart] = useState(null)   // the part being edited
  const [editForm, setEditForm] = useState(null)
  const [savingPart, setSavingPart] = useState(false)

  const openEdit = (p) => {
    setEditPart(p)
    setEditForm({ title: p.title || '', list_price: p.list_price ?? '', category: p.category || '', cost: p.costs?.acquisition ?? '' })
  }
  const savePart = async () => {
    if (!editPart) return
    setSavingPart(true)
    const { error } = await sb.from('parts').update({
      title: editForm.title,
      list_price: +editForm.list_price || 0,
      category: editForm.category,
      costs: { ...(editPart.costs || {}), acquisition: +editForm.cost || 0 },
    }).eq('id', editPart.id)
    setSavingPart(false)
    if (error) { alert(`Could not save: ${error.message}`); return }
    setEditPart(null); setEditForm(null)
    load()
  }

  const load = async () => {
    setLoading(true)
    const { data } = await sb.from('parts').select('*').eq('car_id', car.id).is('deleted_at', null).order('created_at', { ascending: false })
    setParts(data || [])
    setLoading(false)
  }

  // Reload on mount, when returning to the app, and live via realtime — so the
  // server-side AI assessment (price/title/category) appears within seconds.
  useEffect(() => {
    load()
    const ch = sb.channel(`car-parts-${car.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parts', filter: `car_id=eq.${car.id}` }, load)
      .subscribe()
    const onVisible = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { sb.removeChannel(ch); document.removeEventListener('visibilitychange', onVisible) }
  }, [car.id])

  const completeCar = async () => {
    setCompletingCar(true)
    await sb.from('cars').update({ status: 'complete' }).eq('id', car.id)
    setCompletingCar(false)
    setConfirmComplete(false)
    onBack()
  }

  const reactivateCar = async () => {
    setCompletingCar(true)
    await sb.from('cars').update({ status: 'active' }).eq('id', car.id)
    setCarStatus('active')
    setCompletingCar(false)
  }

  // Show "Assessing…" only while genuinely in progress and recent — so a failed
  // or missed assessment never spins forever.
  const isAssessing = (p) => p.ai_pending && !p.ai_assessed && (Date.now() - new Date(p.created_at).getTime() < 120000)
  const anyAssessing = parts.some(isAssessing)

  // Poll while anything is still assessing, in case realtime misses the update.
  useEffect(() => {
    if (!anyAssessing) return
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [anyAssessing])

  const inStock = parts.filter(p => p.status === 'in_stock')
  const listed  = parts.filter(p => p.status === 'listed')

  // The car's purchase price spread across its parts, proportional to sale price.
  // Each part's share drops as more parts are added — visible live here.
  const carPrice = +car.purchase_price || 0
  const partsValue = parts.reduce((a, p) => a + (+p.list_price || 0), 0)
  const carShareOf = (p) => (carPrice > 0 && partsValue > 0) ? carPrice * ((+p.list_price || 0) / partsValue) : 0

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <div style={{ background: C.headerBg, padding: '16px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: 22, cursor: 'pointer', padding: 0, lineHeight: 1 }}>‹</button>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 17 }}>{car.make} {car.model} {car.year}</div>
          {carStatus !== 'active' && (
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.18)', borderRadius: 6, padding: '2px 8px', textTransform: 'capitalize' }}>{carStatus}</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', paddingLeft: 34 }}>
          {parts.length} part{parts.length !== 1 ? 's' : ''} · {inStock.length} in stock · {listed.length} listed
        </div>
      </div>

      <div style={{ padding: 20, paddingBottom: 180 }}>
        {loading && <div style={{ textAlign: 'center', color: C.muted, padding: 40 }}>Loading…</div>}

        {!loading && parts.length === 0 && (
          <div style={{ textAlign: 'center', color: C.muted, padding: 60 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔧</div>
            <div style={{ fontSize: 15 }}>No parts yet</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Tap Add Part to get started</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {parts.map(p => {
            const statusColor = STATUS_COLORS[p.status] || C.muted
            const thumb = p.photos?.[0]?.url || p.photos?.[0]?.ebay_url
            return (
              <div key={p.id} onClick={() => openEdit(p)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer' }}>
                {thumb
                  ? <img src={thumb} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                  : <div style={{ width: 56, height: 56, background: C.bg, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🔧</div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{p.category}</div>
                  {carPrice > 0 && (+p.list_price > 0) && (
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Car cost: <strong style={{ color: C.text }}>${carShareOf(p).toFixed(2)}</strong></div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {isAssessing(p)
                    ? <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed' }}>✨ Assessing…</div>
                    : <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>${p.list_price}</div>}
                  <div style={{ fontSize: 11, fontWeight: 600, color: statusColor, marginTop: 2 }}>{STATUS_LABELS[p.status] || p.status}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Fixed bottom actions — two large buttons, with a smaller complete/reactivate below */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 20px', background: C.bg, borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onAddPart}
            style={{ flex: 1, padding: 16, background: C.accent, color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
            + Add Part
          </button>
          <button onClick={onBack}
            style={{ flex: 1, padding: 16, background: '#fff', color: C.text, border: `1.5px solid ${C.border}`, borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
            Main Menu
          </button>
        </div>
        {carStatus === 'complete' ? (
          <button onClick={reactivateCar} disabled={completingCar}
            style={{ padding: 8, background: 'none', color: C.accent, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {completingCar ? '…' : '↻ Reactivate car'}
          </button>
        ) : (
          <button onClick={() => setConfirmComplete(true)} disabled={completingCar}
            style={{ padding: 8, background: 'none', color: C.muted, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Mark car complete
          </button>
        )}
      </div>

      {/* Edit a part — quick yard corrections (name, price, cost, category) */}
      {editPart && editForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }} onClick={() => { setEditPart(null); setEditForm(null) }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: '20px 20px 0 0', padding: 24, width: '100%', boxSizing: 'border-box', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 16 }}>Edit part</div>

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Name</label>
            <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 16, marginBottom: 14, boxSizing: 'border-box', outline: 'none' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Sale price</label>
                <input value={editForm.list_price} onChange={e => setEditForm(f => ({ ...f, list_price: e.target.value }))}
                  type="number" inputMode="decimal" placeholder="$"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 16, boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Cost base</label>
                <input value={editForm.cost} onChange={e => setEditForm(f => ({ ...f, cost: e.target.value }))}
                  type="number" inputMode="decimal" placeholder="$"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 16, boxSizing: 'border-box', outline: 'none' }} />
              </div>
            </div>

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Category</label>
            <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 16, marginBottom: 20, boxSizing: 'border-box', background: '#fff' }}>
              <option value="">— Select —</option>
              {CATEGORY_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <div style={{ fontSize: 11, color: C.muted, marginBottom: 16 }}>Full details (description, specifics, fitment) are done in the admin app.</div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setEditPart(null); setEditForm(null) }} style={{ flex: 1, padding: 14, background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={savePart} disabled={savingPart} style={{ flex: 2, padding: 14, background: C.accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: savingPart ? 0.6 : 1 }}>
                {savingPart ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm completion — prevents an accidental tap from archiving the car */}
      {confirmComplete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: C.card, borderRadius: '20px 20px 0 0', padding: 24, width: '100%', boxSizing: 'border-box' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>Mark car complete?</div>
            <div style={{ fontSize: 14, color: C.muted, marginBottom: 20, lineHeight: 1.5 }}>
              {car.make} {car.model} will move out of Active Cars. You can still find it under the Complete filter and reactivate it if more parts come off.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmComplete(false)} style={{ flex: 1, padding: 14, background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={completeCar} disabled={completingCar} style={{ flex: 2, padding: 14, background: C.accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: completingCar ? 0.6 : 1 }}>
                {completingCar ? 'Saving…' : 'Mark Complete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
