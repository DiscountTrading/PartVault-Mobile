import { useState, useRef, useEffect, lazy, Suspense } from 'react'
import { sb } from '../lib/supabase'
import { C, CATEGORY_NAMES } from '../lib/constants'
import { makeMainAndThumb } from '../lib/image'
import CameraCapture from '../components/CameraCapture'
const PhotoEditor = lazy(() => import('../components/PhotoEditor'))

const MAX_PHOTOS = 24

export default function AddPart({ car, storeId, onSave, onCancel }) {
  const [photos, setPhotos] = useState([]) // { id, preview, url, thumb_url, uploading }
  const [form, setForm] = useState({ title: '', list_price: '', notes: '' })
  const [aiAssess, setAiAssess] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [editing, setEditing] = useState(null) // { id, source }
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

  // Compress + upload a single file/blob, tracked in the photos grid. Shared by
  // the album picker and the continuous camera.
  const ingest = async (file) => {
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

  const addPhotos = (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    files.slice(0, Math.max(0, MAX_PHOTOS - photos.length)).forEach(ingest)
  }

  const removePhoto = (id) => setPhotos(p => p.filter(x => x.id !== id))
  const anyUploading = photos.some(p => p.uploading)

  // Save an edited photo: replace the original in place (re-upload).
  const onEditSave = async (edited) => {
    const id = editing?.id
    setEditing(null)
    if (!id || !edited?.imageBase64) return
    try {
      const blob = await (await fetch(edited.imageBase64)).blob()
      const preview = URL.createObjectURL(blob)
      setPhotos(p => p.map(x => x.id === id ? { ...x, preview, uploading: true } : x))
      const { url, thumb_url } = await uploadOne(blob)
      setPhotos(p => p.map(x => x.id === id ? { ...x, url, thumb_url, uploading: false } : x))
    } catch (err) {
      setError(err.message)
      setPhotos(p => p.map(x => x.id === id ? { ...x, uploading: false } : x))
    }
  }

  const save = async () => {
    if (!form.title) { setError('Add a quick label so you can find this part'); return }
    setError('')
    setSaving(true)
    try {
      const uploaded = photos.filter(p => p.url)
      // SKU comes from the store's admin-configured format (atomic store-wide counter),
      // so mobile and admin stay consistent — the PWA is just an extension of the admin app.
      const { data: sku, error: skuErr } = await sb.rpc('generate_next_sku', { p_store_id: storeId, p_car_make: car.make || null })
      if (skuErr || !sku) throw new Error(skuErr?.message || 'Could not generate SKU')
      const { data, error } = await sb.from('parts').insert({
        store_id: storeId,
        car_id: car.id,
        sku,
        title: form.title,
        category: CATEGORY_NAMES[0],
        subcategory: '',
        condition: 'Used – Good',
        list_price: +form.list_price || 0,
        notes: form.notes,
        status: 'in_stock',
        source: 'manual',
        photos: uploaded.map(p => ({ url: p.url })),
        make: car.make || '',
        model: car.model || '',
        year: car.year || '',
        costs: { acquisition: 0, labour: 0, storage: 0, packaging: 0, postage: 0, holding: 0 },
        ai_assessed: false,
        // Opt this capture into server-side AI assessment. A database trigger
        // picks it up and runs it — reliable even if the phone drops off.
        ai_pending: aiAssess,
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
      // AI assessment now runs server-side via a database trigger (see the
      // ai_pending flag above) — no fragile phone-side request to keep alive.
      onSave(data)
    } catch (e) {
      setError(e.message)
    }
    setSaving(false)
  }

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
                {!p.uploading && <button onClick={() => setEditing({ id: p.id, source: p.preview })} style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, fontSize: 12, cursor: 'pointer', padding: 0, lineHeight: '22px' }}>✎</button>}
              </div>
            ))}
          </div>
          {photos.length < MAX_PHOTOS && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => setCameraOpen(true)}
                style={{ flex: 2, padding: 13, background: C.accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>📷 Camera</button>
              <button onClick={() => fileRef.current?.click()}
                style={{ flex: 1, padding: 13, background: C.card, color: C.text, border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>🖼️ Album</button>
            </div>
          )}
        </div>

        {/* Quick reference label */}
        <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Quick label *</label>
        <input value={form.title} onChange={e => set('title', e.target.value)}
          placeholder={`e.g. ${car.make} ${car.model} headlight`}
          style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 16, marginBottom: 4, boxSizing: 'border-box', outline: 'none' }} />
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>Just for you to find it — AI writes the full eBay title before listing.</div>

        {/* Price (optional) */}
        <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>List price (optional)</label>
        <input value={form.list_price} onChange={e => set('list_price', e.target.value)}
          placeholder="$0 — set later or let AI suggest" type="number" inputMode="decimal"
          style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 16, marginBottom: 14, boxSizing: 'border-box', outline: 'none' }} />

        {/* Notes (optional) */}
        <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Notes (optional)</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
          placeholder="Anything worth telling the AI / buyer…" rows={2}
          style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 15, boxSizing: 'border-box', resize: 'none', outline: 'none', marginBottom: 14 }} />

        {/* AI assess toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: C.text, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
          <input type="checkbox" checked={aiAssess} onChange={e => setAiAssess(e.target.checked)} style={{ width: 18, height: 18 }} />
          <span>✨ Assess with AI after saving<br /><span style={{ fontSize: 11, color: C.muted }}>Runs in the background so it's ready when you're back at the office.</span></span>
        </label>

        {error && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>✗ {error}</div>}
      </div>

      {/* Fixed bottom button */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 20px', background: C.bg, borderTop: `1px solid ${C.border}` }}>
        <button onClick={save} disabled={saving || anyUploading || !form.title}
          style={{ width: '100%', padding: 16, background: C.accent, color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: (saving || anyUploading || !form.title) ? 0.6 : 1 }}>
          {saving ? 'Saving…' : anyUploading ? 'Processing photos…' : '✓ Save Part'}
        </button>
      </div>

      {cameraOpen && (
        <CameraCapture
          onCapture={ingest}
          onClose={() => setCameraOpen(false)}
          count={photos.length}
          max={MAX_PHOTOS}
          recentThumbs={photos.map(p => p.preview)}
        />
      )}

      {editing && (
        <Suspense fallback={<div style={{ position: 'fixed', inset: 0, background: '#000', color: '#fff', zIndex: 2500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading editor…</div>}>
          <PhotoEditor source={editing.source} onSave={onEditSave} onClose={() => setEditing(null)} />
        </Suspense>
      )}
    </div>
  )
}
