import { useRef, useEffect, useState } from 'react'
import { C } from '../lib/constants'

// Full-screen continuous camera: live preview, tap shutter to snap frame after
// frame with no re-opening. Each snap fires onCapture(blob) immediately and the
// camera stays live — built for fast yard capture. Optional confirm step.
export default function CameraCapture({ onCapture, onClose, count = 0, max = 24, recentThumbs = [], confirm = false }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [error, setError] = useState('')
  const [facing, setFacing] = useState('environment')
  const [flash, setFlash] = useState(false)
  const [pending, setPending] = useState(null) // { url, blob } when confirm mode

  useEffect(() => {
    let active = true
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false })
        if (!active) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}) }
      } catch (e) {
        setError('Could not open the camera. Check camera permissions for this site, or use "From album" instead.')
      }
    }
    start()
    return () => { active = false; streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [facing])

  const grabBlob = () => new Promise((resolve) => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return resolve(null)
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    canvas.getContext('2d').drawImage(v, 0, 0)
    canvas.toBlob(b => resolve(b), 'image/jpeg', 0.9)
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
      <video ref={videoRef} playsInline muted autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      {flash && <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: 0.7 }} />}

      {/* Top bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 'calc(16px + env(safe-area-inset-top))' }}>
        <button onClick={onClose} style={btn}>✓ Done {count > 0 ? `(${count})` : ''}</button>
        <div style={{ color: '#fff', background: 'rgba(0,0,0,0.55)', borderRadius: 22, padding: '8px 16px', fontWeight: 800 }}>{count}/{max}</div>
        <button onClick={() => setFacing(f => f === 'environment' ? 'user' : 'environment')} style={btn}>⟲ Flip</button>
      </div>

      {/* Recent thumbnails */}
      {recentThumbs.length > 0 && (
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
