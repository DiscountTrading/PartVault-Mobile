import { useState, useEffect } from 'react'
import { sb } from '../lib/supabase'
import { C, MAKES } from '../lib/constants'

export default function Home({ onSelectCar, storeId, stores = [], activeStoreId, setActiveStore }) {
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ make: '', model: '', year: '', purchase_price: '' })
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('active') // active (default) | complete | all

  const load = async () => {
    setLoading(true)
    let q = sb.from('cars').select('*').eq('store_id', storeId)
    if (statusFilter !== 'all') q = q.eq('status', statusFilter)
    const { data } = await q.order('created_at', { ascending: false })
    setCars(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [storeId, statusFilter])

  const addCar = async () => {
    if (!form.make) return
    setSaving(true)
    const { data: { user } } = await sb.auth.getUser()
    const { data, error } = await sb.from('cars').insert({
      store_id: storeId,
      created_by: user.id,
      make: form.make,
      model: form.model,
      year: form.year,
      purchase_price: form.purchase_price ? +form.purchase_price : null,
      status: 'active',
    }).select().single()
    setSaving(false)
    if (!error) {
      setShowAdd(false)
      setForm({ make: '', model: '', year: '', purchase_price: '' })
      onSelectCar(data)
    }
  }

  const partCountStyle = count => ({
    fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
    background: count > 0 ? C.accent + '18' : C.border,
    color: count > 0 ? C.accent : C.muted,
  })

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <div style={{ background: C.headerBg, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 18, fontFamily: "'Inter Tight',system-ui,sans-serif" }}>PartVault</div>
          {stores.length > 1 ? (
            <select value={activeStoreId || ''} onChange={e => setActiveStore(e.target.value)}
              style={{ marginTop: 4, maxWidth: '60vw', background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '4px 8px', fontSize: 13, fontWeight: 600, outline: 'none' }}>
              {stores.map(s => <option key={s.store_id} value={s.store_id} style={{ color: '#111' }}>{s.store_name}</option>)}
            </select>
          ) : stores.length === 1 ? (
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 }}>{stores[0].store_name}</div>
          ) : null}
        </div>
        <button onClick={() => sb.auth.signOut()} style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>
          Sign Out
        </button>
      </div>

      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>Cars</div>
          <button onClick={() => setShowAdd(true)} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            + Add Car
          </button>
        </div>

        {/* Status filter — defaults to Active */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[['active', 'Active'], ['complete', 'Complete'], ['all', 'All']].map(([val, label]) => (
            <button key={val} onClick={() => setStatusFilter(val)}
              style={{ padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${statusFilter === val ? C.accent : C.border}`, background: statusFilter === val ? C.accent : '#fff', color: statusFilter === val ? '#fff' : C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>

        {loading && <div style={{ textAlign: 'center', color: C.muted, padding: 40 }}>Loading…</div>}

        {!loading && cars.length === 0 && (
          <div style={{ textAlign: 'center', color: C.muted, padding: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🚗</div>
            <div style={{ fontSize: 15 }}>{statusFilter === 'active' ? 'No active cars' : statusFilter === 'complete' ? 'No completed cars' : 'No cars yet'}</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Add a car to start adding parts</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cars.map(car => (
            <button key={car.id} onClick={() => onSelectCar(car)}
              style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, textAlign: 'left', cursor: 'pointer', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {car.make} {car.model}
                    {car.status !== 'active' && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, background: C.border, borderRadius: 6, padding: '1px 7px', textTransform: 'capitalize' }}>{car.status}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{car.year}{car.purchase_price ? ` · $${car.purchase_price}` : ''}</div>
                </div>
                <div style={{ fontSize: 20 }}>›</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Add Car Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: C.card, borderRadius: '20px 20px 0 0', padding: 24, width: '100%', boxSizing: 'border-box' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 20 }}>Add Car</div>

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Make *</label>
            <select value={form.make} onChange={e => setForm(f => ({ ...f, make: e.target.value }))}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 16, marginBottom: 14, boxSizing: 'border-box', background: '#fff' }}>
              <option value="">Select Make</option>
              {MAKES.map(m => <option key={m}>{m}</option>)}
            </select>

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Model</label>
            <input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
              placeholder="e.g. Camry" style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 16, marginBottom: 14, boxSizing: 'border-box', outline: 'none' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Year</label>
                <input value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                  placeholder="e.g. 2018" type="number" style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 16, boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Purchase Price</label>
                <input value={form.purchase_price} onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))}
                  placeholder="$" type="number" style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 16, boxSizing: 'border-box', outline: 'none' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: 14, background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={addCar} disabled={saving || !form.make} style={{ flex: 2, padding: 14, background: C.accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: (saving || !form.make) ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Add Car'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
