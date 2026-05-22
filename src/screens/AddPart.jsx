import { useState, useRef } from 'react'
import { sb } from '../lib/supabase'
import { C, PART_CONDITIONS, EBAY_AU_CATEGORIES, CATEGORY_NAMES } from '../lib/constants'

export default function AddPart({ car, storeId, onSave, onCancel }) {
  const [photo, setPhoto] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [form, setForm] = useState({
    title: '', category: CATEGORY_NAMES[0], subcategory: '',
    condition: 'Used – Good', list_price: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const onPhoto = e => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhoto(URL.createObjectURL(file))
  }

  const uploadPhoto = async (file) => {
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${storeId}/${Date.now()}.${ext}`
    const { error } = await sb.storage.from('part-photos').upload(path, file, { contentType: file.type })
    if (error) throw error
    const { data } = sb.storage.from('part-photos').getPublicUrl(path)
    return data.publicUrl
  }

  const save = async () => {
    if (!form.title || !form.list_price) { setError('Title and price are required'); return }
    setError('')
    setSaving(true)
    try {
      const { data: { user } } = await sb.auth.getUser()
      let photos = []
      if (photoFile) {
        const url = await uploadPhoto(photoFile)
        photos = [{ url }]
      }
      const subcategory = form.subcategory || (EBAY_AU_CATEGORIES[form.category]?.[0] || '')
      const now = new Date()
      const yy = String(now.getFullYear()).slice(-2)
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const carRef = (car.make || 'UNKN').replace(/\s+/g, '').toUpperCase().slice(0, 4).padEnd(4, 'X')
      const { count } = await sb.from('parts').select('*', { count: 'exact', head: true }).eq('car_id', car.id).is('deleted_at', null)
      const partSeq = String((count || 0) + 1).padStart(3, '0')
      const sku = `${yy}${mm}-${carRef}-${partSeq}`
      const { data, error } = await sb.from('parts').insert({
        store_id: storeId,
        car_id: car.id,
        sku,
        title: form.title,
        category: form.category,
        subcategory,
        condition: form.condition,
        list_price: +form.list_price,
        notes: form.notes,
        status: 'in_stock',
        source: 'manual',
        photos,
        make: car.make || '',
        model: car.model || '',
        year: car.year || '',
        costs: { acquisition: 0, labour: 0, storage: 0, packaging: 0, postage: 0, holding: 0 },
        ai_assessed: false,
      }).select().single()
      if (error) throw error
      onSave(data)
    } catch (e) {
      setError(e.message)
    }
    setSaving(false)
  }

  const subcats = EBAY_AU_CATEGORIES[form.category] || []

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <div style={{ background: C.headerBg, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: 22, cursor: 'pointer', padding: 0, lineHeight: 1 }}>‹</button>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 17 }}>Add Part — {car.make} {car.model}</div>
      </div>

      <div style={{ padding: 20, paddingBottom: 100 }}>
        {/* Photo */}
        <div style={{ marginBottom: 20 }}>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPhoto} style={{ display: 'none' }} />
          {photo ? (
            <div style={{ position: 'relative' }}>
              <img src={photo} alt="Part" style={{ width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 12, display: 'block' }} />
              <button onClick={() => fileRef.current?.click()}
                style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>
                Retake
              </button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()}
              style={{ width: '100%', height: 180, background: C.card, border: `2px dashed ${C.border}`, borderRadius: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <div style={{ fontSize: 36 }}>📷</div>
              <div style={{ fontSize: 15, color: C.muted, fontWeight: 600 }}>Take Photo</div>
              <div style={{ fontSize: 12, color: C.muted }}>Opens camera</div>
            </button>
          )}
        </div>

        {/* Title */}
        <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Title *</label>
        <input value={form.title} onChange={e => set('title', e.target.value)}
          placeholder={`${car.make} ${car.model} ${car.year || ''} …`}
          style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 16, marginBottom: 14, boxSizing: 'border-box', outline: 'none' }} />

        {/* Category */}
        <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Category</label>
        <select value={form.category} onChange={e => { set('category', e.target.value); set('subcategory', '') }}
          style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 15, marginBottom: 14, boxSizing: 'border-box', background: '#fff' }}>
          {CATEGORY_NAMES.map(c => <option key={c}>{c}</option>)}
        </select>

        {/* Subcategory */}
        <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Subcategory</label>
        <select value={form.subcategory} onChange={e => set('subcategory', e.target.value)}
          style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 15, marginBottom: 14, boxSizing: 'border-box', background: '#fff' }}>
          {subcats.map(s => <option key={s}>{s}</option>)}
        </select>

        {/* Condition + Price */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Condition</label>
            <select value={form.condition} onChange={e => set('condition', e.target.value)}
              style={{ width: '100%', padding: '12px 10px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 14, boxSizing: 'border-box', background: '#fff' }}>
              {PART_CONDITIONS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>List Price *</label>
            <input value={form.list_price} onChange={e => set('list_price', e.target.value)}
              placeholder="$0" type="number" inputMode="decimal"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 16, boxSizing: 'border-box', outline: 'none' }} />
          </div>
        </div>

        {/* Notes */}
        <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Notes</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
          placeholder="Any additional details…" rows={3}
          style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 15, boxSizing: 'border-box', resize: 'none', outline: 'none', marginBottom: 8 }} />

        {error && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>✗ {error}</div>}
      </div>

      {/* Fixed bottom button */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 20px', background: C.bg, borderTop: `1px solid ${C.border}` }}>
        <button onClick={save} disabled={saving || !form.title || !form.list_price}
          style={{ width: '100%', padding: 16, background: C.accent, color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: (saving || !form.title || !form.list_price) ? 0.6 : 1 }}>
          {saving ? 'Saving…' : '✓ Save Part'}
        </button>
      </div>
    </div>
  )
}
