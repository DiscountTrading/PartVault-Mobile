import { useState, useRef } from 'react'
import { sb } from '../lib/supabase'
import { C, PART_CONDITIONS, EBAY_AU_CATEGORIES, CATEGORY_NAMES } from '../lib/constants'
import { makeMainAndThumb } from '../lib/image'

const MAX_PHOTOS = 12

export default function AddPart({ car, storeId, onSave, onCancel }) {
  const [photos, setPhotos] = useState([]) // { id, preview, url, thumb_url, uploading }
  const [form, setForm] = useState({
    title: '', category: CATEGORY_NAMES[0], subcategory: '',
    condition: 'Used – Good', list_price: '', notes: '', weight: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Compress to a main (~1600px) + thumb (~320px) and upload both.
  const uploadOne = async (file) => {
    const { main, thumb } = await makeMainAndThumb(file)
    const base = `${storeId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const up = async (blob, suffix) => {
      const path = `${base}${suffix}.jpg`
      const { error } = await sb.storage.from('part-photos').upload(path, blob, { contentType: 'image/jpeg' })
      if (error) throw error
      return sb.storage.from('part-photos').getPublicUrl(path).data.publicUrl
    }
    const url = await up(main, '')
    const thumb_url = await up(thumb, '_t')
    return { url, thumb_url }
  }

  const addPhotos = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    for (const file of files) {
      if (photos.length >= MAX_PHOTOS) { setError(`Up to ${MAX_PHOTOS} photos per part`); break }
      const id = Math.random().toString(36).slice(2)
      setPhotos(p => [...p, { id, preview: URL.createObjectURL(file), uploading: true }])
      try {
        const { url, thumb_url } = await uploadOne(file)
        setPhotos(p => p.map(x => x.id === id ? { ...x, url, thumb_url, uploading: false } : x))
      } catch (err) {
        setError(err.message)
        setPhotos(p => p.filter(x => x.id !== id))
      }
    }
  }

  const removePhoto = (id) => setPhotos(p => p.filter(x => x.id !== id))
  const anyUploading = photos.some(p => p.uploading)

  const save = async () => {
    if (!form.title || !form.list_price) { setError('Title and price are required'); return }
    setError('')
    setSaving(true)
    try {
      const uploaded = photos.filter(p => p.url)
      const subcategory = form.subcategory || (EBAY_AU_CATEGORIES[form.category]?.[0] || '')
      // SKU comes from the store's admin-configured format (atomic store-wide counter),
      // so mobile and admin stay consistent — the PWA is just an extension of the admin app.
      const { data: sku, error: skuErr } = await sb.rpc('generate_next_sku', { p_store_id: storeId, p_car_make: car.make || null })
      if (skuErr || !sku) throw new Error(skuErr?.message || 'Could not generate SKU')
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
        weight: form.weight ? +form.weight : null,
        photos: uploaded.map(p => ({ url: p.url })),
        make: car.make || '',
        model: car.model || '',
        year: car.year || '',
        costs: { acquisition: 0, labour: 0, storage: 0, packaging: 0, postage: 0, holding: 0 },
        ai_assessed: false,
      }).select().single()
      if (error) throw error
      // Dual-write: also insert into the new photos table (the source of truth)
      if (uploaded.length) {
        const { error: photoErr } = await sb.from('photos').insert(
          uploaded.map((ph, i) => ({
            parent_type: 'part', parent_id: data.id, url: ph.url, thumb_url: ph.thumb_url,
            display_order: i, is_primary: i === 0, source: 'upload',
          }))
        )
        if (photoErr) console.warn('photos table insert failed', photoErr)
      }
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
        {/* Photos */}
        <div style={{ marginBottom: 20 }}>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={addPhotos} style={{ display: 'none' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Photos {photos.length > 0 && `(${photos.length}/${MAX_PHOTOS})`}</label>
            {photos.length > 0 && <span style={{ fontSize: 11, color: C.muted }}>First = main image</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {photos.map((p, i) => (
              <div key={p.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', background: C.card, border: `1px solid ${C.border}` }}>
                <img src={p.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: p.uploading ? 0.5 : 1 }} />
                {p.uploading && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', background: 'rgba(0,0,0,0.3)' }}>⏳</div>}
                {i === 0 && !p.uploading && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: C.accent, color: '#fff', fontSize: 10, fontWeight: 700, textAlign: 'center', padding: '2px 0' }}>MAIN</div>}
                <button onClick={() => removePhoto(p.id)} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, fontSize: 13, cursor: 'pointer', padding: 0, lineHeight: '22px' }}>×</button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button onClick={() => fileRef.current?.click()}
                style={{ aspectRatio: '1', background: C.card, border: `2px dashed ${C.border}`, borderRadius: 10, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <div style={{ fontSize: 26 }}>📷</div>
                <div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{photos.length ? 'Add' : 'Add photos'}</div>
              </button>
            )}
          </div>
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

        {/* Weight */}
        <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Weight (grams) — for accurate shipping</label>
        <input value={form.weight} onChange={e => set('weight', e.target.value)}
          placeholder="e.g. 1500" type="number" inputMode="numeric"
          style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 16, marginBottom: 14, boxSizing: 'border-box', outline: 'none' }} />

        {/* Notes */}
        <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Notes</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
          placeholder="Any additional details…" rows={3}
          style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 15, boxSizing: 'border-box', resize: 'none', outline: 'none', marginBottom: 8 }} />

        {error && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>✗ {error}</div>}
      </div>

      {/* Fixed bottom button */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 20px', background: C.bg, borderTop: `1px solid ${C.border}` }}>
        <button onClick={save} disabled={saving || anyUploading || !form.title || !form.list_price}
          style={{ width: '100%', padding: 16, background: C.accent, color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: (saving || anyUploading || !form.title || !form.list_price) ? 0.6 : 1 }}>
          {saving ? 'Saving…' : anyUploading ? 'Processing photos…' : '✓ Save Part'}
        </button>
      </div>
    </div>
  )
}
