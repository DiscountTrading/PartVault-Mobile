import { useState, useEffect } from 'react'
import { sb } from '../lib/supabase'
import { C, EDGE_FN } from '../lib/constants'

const STATUS_COLORS = { in_stock: C.blue, listed: C.accent, sold: C.green, scrapped: C.muted }
const STATUS_LABELS = { in_stock: 'In Stock', listed: 'Listed', sold: 'Sold', scrapped: 'Scrapped' }

export default function CarDetail({ car, storeId, onBack, onAddPart }) {
  const [parts, setParts] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [completingCar, setCompletingCar] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await sb.from('parts').select('*').eq('car_id', car.id).is('deleted_at', null).order('created_at', { ascending: false })
    setParts(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [car.id])

  const uploadToDrafts = async () => {
    const eligible = parts.filter(p => p.status === 'in_stock')
    if (!eligible.length) return

    setUploading(true)
    setUploadResult(null)

    try {
      const res = await fetch(EDGE_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_draft_listings',
          storeId,
          partIds: eligible.map(p => p.id),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setUploadResult(data)
      await load()
    } catch (e) {
      setUploadResult({ error: e.message })
    }
    setUploading(false)
  }

  const completeCar = async () => {
    setCompletingCar(true)
    await sb.from('cars').update({ status: 'complete' }).eq('id', car.id)
    setCompletingCar(false)
    onBack()
  }

  const inStock = parts.filter(p => p.status === 'in_stock')
  const listed  = parts.filter(p => p.status === 'listed')

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <div style={{ background: C.headerBg, padding: '16px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: 22, cursor: 'pointer', padding: 0, lineHeight: 1 }}>‹</button>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 17 }}>{car.make} {car.model} {car.year}</div>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', paddingLeft: 34 }}>
          {parts.length} part{parts.length !== 1 ? 's' : ''} · {inStock.length} in stock · {listed.length} listed
        </div>
      </div>

      <div style={{ padding: 20, paddingBottom: 180 }}>
        {/* Upload result */}
        {uploadResult && (
          <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 16, background: uploadResult.error ? '#fef2f2' : '#f0fdf4', border: `1px solid ${uploadResult.error ? '#fca5a5' : '#86efac'}` }}>
            {uploadResult.error
              ? <span style={{ color: C.red, fontSize: 13 }}>✗ {uploadResult.error}</span>
              : <span style={{ color: C.green, fontSize: 13 }}>✓ {uploadResult.drafted} part{uploadResult.drafted !== 1 ? 's' : ''} uploaded as eBay drafts · {uploadResult.failed || 0} failed</span>
            }
          </div>
        )}

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
              <div key={p.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
                {thumb
                  ? <img src={thumb} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                  : <div style={{ width: 56, height: 56, background: C.bg, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🔧</div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{p.category}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>${p.list_price}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: statusColor, marginTop: 2 }}>{STATUS_LABELS[p.status] || p.status}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Fixed bottom actions */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 20px', background: C.bg, borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {inStock.length > 0 && (
          <button onClick={uploadToDrafts} disabled={uploading}
            style={{ width: '100%', padding: 15, background: C.blue, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: uploading ? 0.6 : 1 }}>
            {uploading ? '⏳ Uploading…' : `📤 Upload ${inStock.length} Part${inStock.length !== 1 ? 's' : ''} to eBay Drafts`}
          </button>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onAddPart}
            style={{ flex: 2, padding: 14, background: C.accent, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            + Add Part
          </button>
          <button onClick={completeCar} disabled={completingCar}
            style={{ flex: 1, padding: 14, background: '#fff', color: C.text, border: `1.5px solid ${C.border}`, borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            {completingCar ? '…' : 'Complete'}
          </button>
        </div>
      </div>
    </div>
  )
}
