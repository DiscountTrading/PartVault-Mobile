import { useState, useEffect, useRef } from 'react'
import { sb } from '../lib/supabase'
import { C, MAKES } from '../lib/constants'
import { makeMainAndThumb } from '../lib/image'
import { identifyCar } from '../lib/ai'

const MAX_CAR_PHOTOS = 8

export default function Home({ onSelectCar, storeId, activeStore }) {
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ make: '', model: '', year: '', purchase_price: '' })
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('active') // active (default) | complete | all
  const [search, setSearch] = useState('')
  const [carPhotos, setCarPhotos] = useState([]) // { id, preview, url, thumb_url, uploading }
  const carFileRef = useRef()
  const [identifying, setIdentifying] = useState(false)
  const [idMsg, setIdMsg] = useState('')

  // Identify make/model/year from the car photos via AI (replaces VIN lookup).
  const identifyFromPhotos = async () => {
    const urls = carPhotos.filter(p => p.url).map(p => p.url)
    if (!urls.length) { setIdMsg('Add a car photo first'); return }
    setIdentifying(true); setIdMsg('')
    try {
      const r = await identifyCar(urls, storeId)
      if (!r.make && !r.model) { setIdMsg('Could not identify — enter manually'); setIdentifying(false); return }
      setForm(f => ({
        ...f,
        make: MAKES.includes(r.make) ? r.make : f.make,
        model: r.model || f.model,
        year: r.year || f.year,
      }))
      setIdMsg(`✓ ${[r.make, r.model, r.year].filter(Boolean).join(' ')}${r.confidence === 'low' ? ' (low confidence — please check)' : ''}`)
    } catch (e) { setIdMsg(e.message || 'Identify failed') }
    setIdentifying(false)
  }

  const load = async () => {
    setLoading(true)
    let q = sb.from('cars').select('*').eq('store_id', storeId)
    if (statusFilter !== 'all') q = q.eq('status', statusFilter)
    const { data } = await q.order('created_at', { ascending: false })
    setCars(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [storeId, statusFilter])

  const uploadCarPhoto = async (file) => {
    const { main, thumb } = await makeMainAndThumb(file)
    const base = `car-photos/${storeId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const up = async (blob, suffix) => {
      const path = `${base}${suffix}.jpg`
      const { error } = await sb.storage.from('part-photos').upload(path, blob, { contentType: 'image/jpeg' })
      if (error) throw error
      return sb.storage.from('part-photos').getPublicUrl(path).data.publicUrl
    }
    return { url: await up(main, ''), thumb_url: await up(thumb, '_t') }
  }

  const addCarPhotos = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    for (const file of files) {
      if (carPhotos.length >= MAX_CAR_PHOTOS) break
      const id = Math.random().toString(36).slice(2)
      setCarPhotos(p => [...p, { id, preview: URL.createObjectURL(file), uploading: true }])
      try {
        const { url, thumb_url } = await uploadCarPhoto(file)
        setCarPhotos(p => p.map(x => x.id === id ? { ...x, url, thumb_url, uploading: false } : x))
      } catch { setCarPhotos(p => p.filter(x => x.id !== id)) }
    }
  }
  const removeCarPhoto = (id) => setCarPhotos(p => p.filter(x => x.id !== id))
  const carUploading = carPhotos.some(p => p.uploading)
  const closeAddCar = () => { setShowAdd(false); setForm({ make: '', model: '', year: '', purchase_price: '' }); setCarPhotos([]); setIdMsg('') }

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
    if (!error && data) {
      const uploaded = carPhotos.filter(p => p.url)
      if (uploaded.length) {
        await sb.from('photos').insert(uploaded.map((ph, i) => ({
          parent_type: 'car', parent_id: data.id, url: ph.url, thumb_url: ph.thumb_url,
          display_order: i, is_primary: i === 0, source: 'upload',
        })))
      }
    }
    setSaving(false)
    if (!error) {
      setShowAdd(false)
      setForm({ make: '', model: '', year: '', purchase_price: '' })
      setCarPhotos([])
      onSelectCar(data)
    }
  }

  const q = search.trim().toLowerCase()
  const visibleCars = q
    ? cars.filter(c => [c.make, c.model, c.year].filter(Boolean).join(' ').toLowerCase().includes(q))
    : cars

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <div style={{ background: C.headerBg, padding: '16px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 18, fontFamily: "'Inter Tight',system-ui,sans-serif" }}>PartVault</div>
        {activeStore && <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 }}>{activeStore.store_name}</div>}
      </div>

      <div style={{ padding: 20, paddingBottom: 90 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>Cars</div>
          <button onClick={() => setShowAdd(true)} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            + Add Car
          </button>
        </div>

        {/* Status filter — defaults to Active */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {[['active', 'Active'], ['complete', 'Complete'], ['all', 'All']].map(([val, label]) => (
            <button key={val} onClick={() => setStatusFilter(val)}
              style={{ padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${statusFilter === val ? C.accent : C.border}`, background: statusFilter === val ? C.accent : '#fff', color: statusFilter === val ? '#fff' : C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search make, model, year…"
          style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 15, marginBottom: 16, boxSizing: 'border-box', outline: 'none' }} />

        {loading && <div style={{ textAlign: 'center', color: C.muted, padding: 40 }}>Loading…</div>}

        {!loading && visibleCars.length === 0 && (
          <div style={{ textAlign: 'center', color: C.muted, padding: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🚗</div>
            <div style={{ fontSize: 15 }}>{q ? 'No matching cars' : statusFilter === 'active' ? 'No active cars' : statusFilter === 'complete' ? 'No completed cars' : 'No cars yet'}</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>{q ? 'Try a different search' : 'Add a car to start adding parts'}</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visibleCars.map(car => (
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

            {/* Car photos — shared across every part from this car */}
            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Car photos {carPhotos.length > 0 && `(${carPhotos.length})`}</label>
            <input ref={carFileRef} type="file" accept="image/*" multiple onChange={addCarPhotos} style={{ display: 'none' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 20 }}>
              {carPhotos.map(p => (
                <div key={p.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: '#fff', border: `1px solid ${C.border}` }}>
                  <img src={p.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: p.uploading ? 0.5 : 1 }} />
                  {p.uploading && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', color: '#fff' }}>⏳</div>}
                  <button onClick={() => removeCarPhoto(p.id)} style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 11, cursor: 'pointer', padding: 0, lineHeight: '18px' }}>×</button>
                </div>
              ))}
              {carPhotos.length < MAX_CAR_PHOTOS && (
                <button onClick={() => carFileRef.current?.click()} style={{ aspectRatio: '1', background: '#fff', border: `2px dashed ${C.border}`, borderRadius: 8, cursor: 'pointer', fontSize: 22 }}>📷</button>
              )}
            </div>

            {/* AI identify make/model/year from the car photos (replaces VIN lookup) */}
            <button onClick={identifyFromPhotos} disabled={identifying || carUploading || !carPhotos.some(p => p.url)}
              style={{ width: '100%', padding: 12, background: '#fff', border: `1.5px solid #7c3aed`, color: '#7c3aed', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: idMsg ? 6 : 20, opacity: (identifying || carUploading || !carPhotos.some(p => p.url)) ? 0.5 : 1 }}>
              {identifying ? '⏳ Identifying…' : '✨ Identify car from photos'}
            </button>
            {idMsg && <div style={{ fontSize: 11, color: idMsg.startsWith('✓') ? C.green : C.red, marginBottom: 16 }}>{idMsg}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={closeAddCar} style={{ flex: 1, padding: 14, background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={addCar} disabled={saving || carUploading || !form.make} style={{ flex: 2, padding: 14, background: C.accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: (saving || carUploading || !form.make) ? 0.6 : 1 }}>
                {saving ? 'Saving…' : carUploading ? 'Processing…' : 'Add Car'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
