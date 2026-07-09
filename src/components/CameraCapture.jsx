import { useRef, useEffect, useState } from 'react'
import { C } from '../lib/constants'

const ADJUST_KEY = 'pv_cam_adjust'
const DEFAULTS = { zoom: 1, brightness: 1, contrast: 1, saturate: 1 }

// Full-screen continuous camera: live preview, tap shutter to snap frame after
// frame with no re-opening. Each snap fires onCapture(blob) immediately and the
// camera stays live — built for fast yard capture. Optional confirm step.
export default function CameraCapture({ onCapture, onClose, count = 0, max = 24, recentThumbs = [], confirm = false, keepAliveRef = null }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [error, setError] = useState('')
  const [facing, setFacing] = useState('environment')
  const [flash, setFlash] = useState(false)
  const [pending, setPending] = useState(null) // { url, blob } when confirm mode
  // Live camera adjustments (persisted → act as the user's "standard" settings).
  const [adj, setAdj] = useState(() => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(ADJUST_KEY) || '{}') } } catch { return { ...DEFAULTS } }
  })
  const [showAdjust, setShowAdjust] = useState(false)
  const [focusRing, setFocusRing] = useState(null) // { x, y, id } — tap-to-focus indicator
  const [resInfo, setResInfo] = useState('')        // actual stream resolution (so we can see what we got)
  const lastPinchEndRef = useRef(0)
  useEffect(() => { try { localStorage.setItem(ADJUST_KEY, JSON.stringify(adj)) } catch { /* ignore */ } }, [adj])
  const filterCss = `brightness(${adj.brightness}) contrast(${adj.contrast}) saturate(${adj.saturate})`
  const setA = (k, v) => setAdj(a => ({ ...a, [k]: +v }))
  const resetAdj = () => setAdj({ ...DEFAULTS })

  // Pinch-to-zoom the image inside the square (not the page). Listeners are
  // non-passive so we can preventDefault the browser's page zoom.
  const viewportRef = useRef(null)
  const pinchRef = useRef(null)
  const zoomRef = useRef(adj.zoom)
  useEffect(() => { zoomRef.current = adj.zoom }, [adj.zoom])
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const onStart = (e) => { if (e.touches.length === 2) { e.preventDefault(); pinchRef.current = { d: dist(e.touches) || 1, z: zoomRef.current } } }
    const onMove = (e) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault()
        const z = Math.max(1, Math.min(5, +(pinchRef.current.z * (dist(e.touches) / pinchRef.current.d)).toFixed(2)))
        setAdj(a => ({ ...a, zoom: z }))
      }
    }
    const onEnd = (e) => { if (e.touches.length < 2) { if (pinchRef.current) lastPinchEndRef.current = Date.now(); pinchRef.current = null } }
    el.addEventListener('touchstart', onStart, { passive: false })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  useEffect(() => {
    let active = true
    async function start() {
      try {
        // Reuse a kept-alive stream (parent-owned) so reopening the camera doesn't
        // re-prompt / re-initialise. Only request access when we don't have one.
        let stream = keepAliveRef?.current
        if (!stream || !stream.active) {
          // Ask for the sharpest stream the camera can give (degrades gracefully via
          // `ideal`). Without this, Safari hands back a low default (~640/720p) and
          // close-up part numbers turn to mush once you zoom. High source res is the
          // biggest win for legibility since our zoom is digital (a centre crop).
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: facing }, width: { ideal: 3840 }, height: { ideal: 2160 } },
            audio: false,
          })
          if (keepAliveRef) keepAliveRef.current = stream
        }
        if (!active) { if (!keepAliveRef) stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}) }
        // Report the resolution we actually got, and ask for continuous autofocus
        // where the browser supports it (Android/Chrome). No-ops on iOS Safari.
        try {
          const track = stream.getVideoTracks?.()[0]
          const st = track?.getSettings?.() || {}
          if (st.width && st.height) setResInfo(`${Math.max(st.width, st.height)}×${Math.min(st.width, st.height)}`)
          if (track?.getCapabilities?.().focusMode?.includes('continuous')) {
            await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] })
          }
        } catch { /* focus/settings control unsupported — fine */ }
      } catch (e) {
        setError('Could not open the camera. Check camera permissions for this site, or use "From album" instead.')
      }
    }
    start()
    // Keep the stream alive when a parent owns it; only stop it here in legacy mode.
    return () => { active = false; if (!keepAliveRef) streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [facing])

  // Flip: drop the current stream so a new facing one is acquired.
  const flip = () => {
    (keepAliveRef?.current || streamRef.current)?.getTracks().forEach(t => t.stop())
    if (keepAliveRef) keepAliveRef.current = null
    streamRef.current = null
    setFacing(f => f === 'environment' ? 'user' : 'environment')
  }

  // Tap-to-focus (Apple-camera style). Point the lens at whatever you tapped so
  // part numbers / small text come out sharp. On Android/Chrome this drives the
  // real hardware focus via a point-of-interest; on iOS Safari (no web focus API)
  // it can't move focus, but the ring still confirms the tap and the OS keeps its
  // own continuous autofocus running.
  const focusAtPoint = async (nx, ny) => {
    const track = streamRef.current?.getVideoTracks?.()[0]
    if (!track?.getCapabilities) return
    let caps = {}
    try { caps = track.getCapabilities() } catch { return }
    const modes = caps.focusMode || []
    const hasPOI = caps.pointsOfInterest !== undefined
    if (!modes.length && !hasPOI) return // unsupported (e.g. iOS Safari)
    const advanced = {}
    if (modes.includes('single-shot')) advanced.focusMode = 'single-shot'
    else if (modes.includes('continuous')) advanced.focusMode = 'continuous'
    if (hasPOI) advanced.pointsOfInterest = [{ x: nx, y: ny }]
    if (!Object.keys(advanced).length) return
    try { await track.applyConstraints({ advanced: [advanced] }) } catch { /* ignore */ }
  }

  // Map a tap on the square viewport to a focus point in the camera's source frame,
  // undoing the digital-zoom scale and the object-fit:cover crop, then focus there.
  const handleTapFocus = (e) => {
    if (pinchRef.current || Date.now() - lastPinchEndRef.current < 300) return // not during/just after a pinch
    const el = viewportRef.current, v = videoRef.current
    if (!el || !v) return
    const rect = el.getBoundingClientRect()
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top
    if (cx < 0 || cy < 0 || cx > rect.width || cy > rect.height) return
    setFocusRing({ x: cx, y: cy, id: Date.now() })
    const vw = v.videoWidth || 1, vh = v.videoHeight || 1
    const zoom = adj.zoom || 1
    // undo CSS scale(zoom) about centre, in viewport space
    const px = (cx - rect.width / 2) / zoom + rect.width / 2
    const py = (cy - rect.height / 2) / zoom + rect.height / 2
    // undo object-fit:cover (scale to the shorter source edge, centre-cropped)
    const scale = Math.max(rect.width / vw, rect.height / vh)
    const offX = (vw * scale - rect.width) / 2, offY = (vh * scale - rect.height) / 2
    const nx = Math.min(1, Math.max(0, (px + offX) / scale / vw))
    const ny = Math.min(1, Math.max(0, (py + offY) / scale / vh))
    focusAtPoint(nx, ny)
  }

  // Clear the focus ring shortly after it appears.
  useEffect(() => {
    if (!focusRing) return
    const t = setTimeout(() => setFocusRing(null), 750)
    return () => clearTimeout(t)
  }, [focusRing])

  // Capture a centred SQUARE crop (eBay's photo format), with digital zoom and the
  // brightness/contrast/colour adjustments baked in so the file matches the preview.
  const grabBlob = () => new Promise((resolve) => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return resolve(null)
    const vw = v.videoWidth, vh = v.videoHeight
    const base = Math.min(vw, vh)                 // largest centred square in the frame
    const side = base / (adj.zoom || 1)          // digital zoom = tighter centre crop
    const sx = (vw - side) / 2, sy = (vh - side) / 2
    // Output at the crop's NATIVE pixel size (no upscaling a zoomed crop back up to
    // a fixed size — that only bakes in blur), capped at 2400 so files stay sane.
    // Combined with the high-res stream request, this keeps part numbers legible.
    const out = Math.min(Math.round(side), 2400)
    const canvas = document.createElement('canvas')
    canvas.width = out; canvas.height = out
    const ctx = canvas.getContext('2d')
    try { ctx.filter = filterCss } catch { /* filter unsupported → preview still shows it */ }
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(v, sx, sy, side, side, 0, 0, out, out)
    canvas.toBlob(b => resolve(b), 'image/jpeg', 0.92)
  })

  const snap = async () => {
    if (count >= max) return
    const blob = await grabBlob()
    if (!blob) return
    setFlash(true); setTimeout(() => setFlash(false), 110)
    if (confirm) {
      setPending({ url: URL.createObjectURL(blob), blob })
    } else {
      onCapture(blob) // accept immediately — stay live for the next shot
    }
  }

  const keep = () => { onCapture(pending.blob); URL.revokeObjectURL(pending.url); setPending(null) }
  const retake = () => { URL.revokeObjectURL(pending.url); setPending(null) }

  const btn = { background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: 22, padding: '8px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }

  if (error) return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
      <div style={{ color: '#fff', textAlign: 'center', fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>{error}</div>
      <button onClick={onClose} style={{ ...btn, background: C.accent, padding: '12px 24px' }}>Close</button>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 2000 }}>
      <style>{`@keyframes pvFocus { 0% { transform: scale(1.5); opacity: 0; } 25% { opacity: 1; } 100% { transform: scale(1); opacity: 0.9; } }`}</style>
      {/* Fixed square viewport — never changes size. The image zooms INSIDE it
          (video is clipped to the square), matching eBay's square photo format. */}
      <div ref={viewportRef} onClick={handleTapFocus} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '100vw', height: '100vw', maxWidth: '100vh', maxHeight: '100vh', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.65)', boxSizing: 'border-box', background: '#000', touchAction: 'none', cursor: 'crosshair' }}>
        <video ref={videoRef} playsInline muted autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover', filter: filterCss, transform: `scale(${adj.zoom})`, transformOrigin: 'center' }} />
        {focusRing && (
          <div key={focusRing.id} style={{ position: 'absolute', left: focusRing.x, top: focusRing.y, width: 74, height: 74, marginLeft: -37, marginTop: -37, border: '2px solid #ffd60a', borderRadius: 10, boxShadow: '0 0 0 1px rgba(0,0,0,0.35)', pointerEvents: 'none', animation: 'pvFocus 0.45s ease-out' }} />
        )}
      </div>
      {flash && <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: 0.7 }} />}
      <div style={{ position: 'absolute', top: 'calc(50px + env(safe-area-inset-top))', left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 600, pointerEvents: 'none' }}>◻︎ Square · tap to focus{resInfo ? ` · ${resInfo}` : ''}</div>

      {/* Top bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 'calc(16px + env(safe-area-inset-top))' }}>
        <button onClick={onClose} style={btn}>✓ Done {count > 0 ? `(${count})` : ''}</button>
        <div style={{ color: '#fff', background: 'rgba(0,0,0,0.55)', borderRadius: 22, padding: '8px 16px', fontWeight: 800 }}>{count}/{max}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowAdjust(s => !s)} style={{ ...btn, background: showAdjust ? C.accent : 'rgba(0,0,0,0.55)' }}>⚙︎ Adjust</button>
          <button onClick={flip} style={btn}>⟲ Flip</button>
        </div>
      </div>

      {/* Adjustment sliders (zoom / brightness / contrast / colour) — saved as default.
          zIndex keeps it above the thumbnail strip/shutter so Reset stays tappable. */}
      {showAdjust && (
        <div style={{ position: 'absolute', bottom: 148, left: 12, right: 12, background: 'rgba(0,0,0,0.62)', borderRadius: 14, padding: '12px 14px', zIndex: 10 }}>
          {[
            ['Zoom', 'zoom', 1, 5, 0.1],
            ['Brightness', 'brightness', 0.5, 1.8, 0.05],
            ['Contrast', 'contrast', 0.5, 1.8, 0.05],
            ['Colour', 'saturate', 0, 2, 0.05],
          ].map(([label, key, min, max, step]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ color: '#fff', fontSize: 12, width: 78 }}>{label}</span>
              <input type="range" min={min} max={max} step={step} value={adj[key]}
                onChange={e => setA(key, e.target.value)} style={{ flex: 1, accentColor: C.accent }} />
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>✓ Saved as your default</span>
            <button onClick={resetAdj} style={{ background: 'none', border: 'none', color: C.accent, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Reset</button>
          </div>
        </div>
      )}

      {/* Recent thumbnails — hidden while the Adjust panel is open (it occupies
          the same strip and would otherwise overlap the Reset button). */}
      {!showAdjust && recentThumbs.length > 0 && (
        <div style={{ position: 'absolute', bottom: 130, left: 0, right: 0, display: 'flex', gap: 6, padding: '0 16px', overflowX: 'auto' }}>
          {recentThumbs.slice(-6).map((t, i) => <img key={i} src={t} alt="" style={{ width: 46, height: 46, objectFit: 'cover', borderRadius: 6, border: '2px solid rgba(255,255,255,0.85)', flexShrink: 0 }} />)}
        </div>
      )}

      {/* Shutter */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 26, paddingBottom: 'calc(26px + env(safe-area-inset-bottom))' }}>
        <button onClick={snap} disabled={count >= max}
          style={{ width: 74, height: 74, borderRadius: '50%', background: count >= max ? '#888' : '#fff', border: '4px solid rgba(255,255,255,0.45)', cursor: count >= max ? 'default' : 'pointer' }} />
      </div>
      {count >= max && <div style={{ position: 'absolute', bottom: 116, width: '100%', textAlign: 'center', color: '#fff', fontSize: 13 }}>Max {max} photos</div>}

      {/* Confirm overlay */}
      {pending && (
        <div style={{ position: 'absolute', inset: 0, background: '#000', display: 'flex', flexDirection: 'column' }}>
          <img src={pending.url} alt="" style={{ flex: 1, width: '100%', objectFit: 'contain' }} />
          <div style={{ display: 'flex', gap: 12, padding: 24, paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
            <button onClick={retake} style={{ flex: 1, ...btn, background: 'rgba(255,255,255,0.2)', padding: 14 }}>Retake</button>
            <button onClick={keep} style={{ flex: 2, ...btn, background: C.accent, padding: 14 }}>Keep</button>
          </div>
        </div>
      )}
    </div>
  )
}
