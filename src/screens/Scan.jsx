import { useState, useEffect, useRef, useCallback } from 'react'
import jsQR from 'jsqr'
import { sb } from '../lib/supabase'
import { C } from '../lib/constants'
import { warehouseConfig, formatGridLoc } from '../lib/warehouse'
import TopTabs from '../components/TopTabs'

// Phone-as-scanner. Reads the QR labels the admin prints (containers → /c/<code>,
// parts → /p/<sku>) with jsQR — a pure-JS decoder, because iOS Safari doesn't
// expose the native BarcodeDetector to web apps. Two modes:
//   • Putting away → scan a bucket, then scan parts to drop them IN.
//   • Pulling      → scan parts to take them OUT of their bucket.
// A part scanned in "putting away" inherits the bucket's home grid spot.

const RESCAN_MS = 2500 // ignore the same code again within this window

export default function Scan({ storeId, activeStore, warehouse, onCars, onCollect, onAccount }) {
  const wc = warehouseConfig(warehouse)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(0)
  const lastRef = useRef({ text: '', at: 0 })
  const busyRef = useRef(false)

  const [mode, setMode] = useState('in')       // 'in' = putting away · 'out' = pulling
  const [bucket, setBucket] = useState(null)    // active container row
  const [bucketCount, setBucketCount] = useState(0)
  const [log, setLog] = useState([])            // recent scan results (newest first)
  const [error, setError] = useState('')
  const [torch, setTorch] = useState(false)

  const modeRef = useRef(mode); useEffect(() => { modeRef.current = mode }, [mode])
  const bucketRef = useRef(bucket); useEffect(() => { bucketRef.current = bucket }, [bucket])

  const pushLog = (entry) => setLog(l => [{ ...entry, id: Date.now() + Math.random() }, ...l].slice(0, 12))
  const beep = (ok) => { try { navigator.vibrate?.(ok ? 40 : [30, 40, 30]) } catch { /* ignore */ } }

  // Parse a scanned string into { kind, value }. Accepts the printed deep links
  // (…/c/<code>, …/p/<sku>) or a bare code/SKU as a fallback.
  const parseCode = (text) => {
    const t = (text || '').trim()
    let m = t.match(/\/c\/([^/?#]+)/i); if (m) return { kind: 'container', value: decodeURIComponent(m[1]) }
    m = t.match(/\/p\/([^/?#]+)/i);     if (m) return { kind: 'part', value: decodeURIComponent(m[1]) }
    if (/^https?:\/\//i.test(t)) return { kind: 'unknown', value: t }
    return { kind: 'bare', value: t } // could be a part SKU or a container code
  }

  const loadBucketCount = useCallback(async (containerId) => {
    const { count } = await sb.from('parts').select('id', { count: 'exact', head: true })
      .eq('store_id', storeId).eq('container_id', containerId).is('deleted_at', null)
    setBucketCount(count || 0)
  }, [storeId])

  const setActiveBucket = async (code) => {
    const { data: ct } = await sb.from('containers').select('*')
      .eq('store_id', storeId).eq('code', code).is('deleted_at', null).maybeSingle()
    if (!ct) { beep(false); pushLog({ ok: false, text: `Unknown ${wc.containerLabel.toLowerCase()}: ${code}` }); return }
    setBucket(ct); beep(true)
    await loadBucketCount(ct.id)
    pushLog({ ok: true, text: `${wc.containerLabel}: ${[ct.code, ct.name].filter(Boolean).join(' · ')}`, accent: true })
  }

  const handlePart = async (sku) => {
    const { data: parts } = await sb.from('parts')
      .select('id, sku, title, container_id, loc_row, loc_bay, loc_shelf')
      .eq('store_id', storeId).eq('sku', sku).is('deleted_at', null).limit(1)
    const part = parts?.[0]
    if (!part) { beep(false); pushLog({ ok: false, text: `No part for ${sku}` }); return }

    if (modeRef.current === 'in') {
      const b = bucketRef.current
      if (!b) { beep(false); pushLog({ ok: false, text: `Scan a ${wc.containerLabel.toLowerCase()} first` }); return }
      const patch = { container_id: b.id }
      // Inherit the bucket's home spot so the part's location matches where the tub sits.
      if (b.loc_row != null || b.loc_bay != null || b.loc_shelf != null) {
        patch.loc_row = b.loc_row ?? null; patch.loc_bay = b.loc_bay ?? null; patch.loc_shelf = b.loc_shelf ?? null
      }
      const { error } = await sb.from('parts').update(patch).eq('id', part.id)
      if (error) { beep(false); pushLog({ ok: false, text: error.message }); return }
      beep(true); pushLog({ ok: true, text: `＋ ${part.title || part.sku} → ${b.code}` })
      loadBucketCount(b.id)
    } else {
      if (!part.container_id) { beep(false); pushLog({ ok: false, text: `${part.sku} isn't in a ${wc.containerLabel.toLowerCase()}` }); return }
      const fromId = part.container_id
      const { error } = await sb.from('parts').update({ container_id: null }).eq('id', part.id)
      if (error) { beep(false); pushLog({ ok: false, text: error.message }); return }
      beep(true); pushLog({ ok: true, text: `− ${part.title || part.sku} pulled` })
      if (bucketRef.current?.id === fromId) loadBucketCount(fromId)
    }
  }

  const onDecode = async (text) => {
    const now = Date.now()
    if (busyRef.current) return
    if (text === lastRef.current.text && now - lastRef.current.at < RESCAN_MS) return
    lastRef.current = { text, at: now }
    busyRef.current = true
    try {
      const { kind, value } = parseCode(text)
      if (kind === 'container') await setActiveBucket(value)
      else if (kind === 'part') await handlePart(value)
      else if (kind === 'bare') {
        // Unknown label type — try container code first, then part SKU.
        const { data: ct } = await sb.from('containers').select('code').eq('store_id', storeId).eq('code', value).is('deleted_at', null).maybeSingle()
        if (ct) await setActiveBucket(value); else await handlePart(value)
      } else { beep(false); pushLog({ ok: false, text: 'Not a PartVault code' }) }
    } finally {
      setTimeout(() => { busyRef.current = false }, 500)
    }
  }

  // Camera + decode loop.
  useEffect(() => {
    let active = true
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    const tick = () => {
      if (!active) return
      const v = videoRef.current
      if (v && v.readyState === v.HAVE_ENOUGH_DATA && v.videoWidth) {
        const w = 400, h = Math.round((v.videoHeight / v.videoWidth) * 400)
        canvas.width = w; canvas.height = h
        ctx.drawImage(v, 0, 0, w, h)
        try {
          const img = ctx.getImageData(0, 0, w, h)
          const code = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' })
          if (code && code.data) onDecode(code.data)
        } catch { /* frame not ready */ }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
        })
        if (!active) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        const v = videoRef.current
        v.srcObject = stream
        await v.play().catch(() => {})
        rafRef.current = requestAnimationFrame(tick)
      } catch (e) {
        setError(e?.name === 'NotAllowedError' ? 'Camera permission denied — allow camera access to scan.' : (e?.message || 'Could not start the camera.'))
      }
    })()

    return () => {
      active = false
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId])

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks?.()[0]
    if (!track) return
    try { await track.applyConstraints({ advanced: [{ torch: !torch }] }); setTorch(t => !t) }
    catch { pushLog({ ok: false, text: 'Torch not supported on this phone' }) }
  }

  const modeBtn = (id, label, emoji) => (
    <button onClick={() => setMode(id)} style={{
      flex: 1, padding: '10px 8px', borderRadius: 10, border: `1.5px solid ${mode === id ? C.accent : C.border}`,
      background: mode === id ? C.accent : '#fff', color: mode === id ? '#fff' : C.text,
      fontSize: 14, fontWeight: 700, cursor: 'pointer',
    }}>{emoji} {label}</button>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div style={{ background: C.headerBg, padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 'calc(12px + env(safe-area-inset-top))' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 18, fontFamily: "'Inter Tight',system-ui,sans-serif" }}>PartVault</div>
          {activeStore && <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeStore.store_name}</div>}
        </div>
        <TopTabs active="scan" onCars={onCars} onCollect={onCollect} onAccount={onAccount} onScan={() => {}} />
      </div>

      <div style={{ padding: 16, paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 4 }}>Scan</div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 8, margin: '10px 0 14px' }}>
          {modeBtn('in', 'Putting away', '📥')}
          {modeBtn('out', 'Pulling', '📤')}
        </div>

        {/* Active bucket banner (in "putting away") */}
        {mode === 'in' && (
          <div style={{ marginBottom: 12, padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${bucket ? C.accent : C.border}`, background: bucket ? '#fff7ed' : '#fff' }}>
            {bucket ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.accent }}>🪣 {[bucket.code, bucket.name].filter(Boolean).join(' · ')}</div>
                <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>
                  {bucketCount} part{bucketCount === 1 ? '' : 's'} inside{formatGridLoc(bucket, warehouse) ? ` · 📍 ${formatGridLoc(bucket, warehouse)}` : ''}
                </div>
                <button onClick={() => { setBucket(null); setBucketCount(0) }} style={{ marginTop: 8, background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '4px 10px', fontSize: 12, color: C.muted, cursor: 'pointer' }}>Change {wc.containerLabel.toLowerCase()}</button>
              </>
            ) : (
              <div style={{ fontSize: 13.5, color: C.muted }}>Scan a {wc.containerLabel.toLowerCase()}'s QR first, then scan parts to drop them in.</div>
            )}
          </div>
        )}

        {/* Camera viewport */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', background: '#000', borderRadius: 14, overflow: 'hidden' }}>
          <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          {/* Reticle */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ width: '58%', aspectRatio: '1', border: '3px solid rgba(255,255,255,0.9)', borderRadius: 16, boxShadow: '0 0 0 2000px rgba(0,0,0,0.28)' }} />
          </div>
          <button onClick={toggleTorch} style={{ position: 'absolute', right: 10, bottom: 10, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: 20, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}>{torch ? '🔦 On' : '🔦'}</button>
        </div>
        {error && <div style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{error}</div>}
        <div style={{ fontSize: 12, color: C.muted, marginTop: 8, textAlign: 'center' }}>Point at a printed QR — it scans automatically.</div>

        {/* Scan log */}
        {log.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 6 }}>Recent</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {log.map(e => (
                <div key={e.id} style={{ fontSize: 13, padding: '8px 12px', borderRadius: 10, background: e.ok ? (e.accent ? '#fff7ed' : '#f0fdf4') : '#fef2f2', border: `1px solid ${e.ok ? (e.accent ? C.accent + '55' : '#bbf7d0') : '#fecaca'}`, color: e.ok ? (e.accent ? C.accent : '#166534') : '#991b1b', fontWeight: e.accent ? 700 : 500 }}>
                  {e.text}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
