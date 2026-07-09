// Client-side image resize/compress. Phones produce 3–8 MB photos; we downscale
// to a web/eBay-friendly main image (~1600px) plus a small thumbnail (~320px)
// for fast list rendering. Both are JPEG.
//
// The main image uses ADAPTIVE quality: a quick on-device detail read picks a
// higher JPEG quality for detailed shots (part numbers / fine text) and a lower
// one for flat shots — so bits are spent where legibility matters, keeping
// storage roughly neutral without any per-image AI call.

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')) }
    img.src = url
  })
}

// Draw `source` (image / video / canvas) into a canvas capped at maxDim (downscale
// only). Returns the canvas + its 2d context and size.
function scaledCanvas(source, maxDim) {
  const sw = source.videoWidth || source.width
  const sh = source.videoHeight || source.height
  const scale = Math.min(1, maxDim / Math.max(sw, sh))
  const w = Math.max(1, Math.round(sw * scale))
  const h = Math.max(1, Math.round(sh * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, w, h)
  return { canvas, ctx, w, h }
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not process image')), 'image/jpeg', quality))
}

// Grayscale gradient stats from an ImageData:
//   mean = average edge energy (overall detail → drives adaptive quality)
//   peak = strongest edge magnitude (near-zero only when EVERYTHING is out of
//          focus, so it's a decent blur signal even for plain subjects that still
//          have one crisp silhouette edge).
export function gradientStats(id) {
  const { data, width: w, height: h } = id
  const gray = i => data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
  let sum = 0, n = 0, peak = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4
      const gx = gray(i + 4) - gray(i - 4)
      const gy = gray(i + w * 4) - gray(i - w * 4)
      const m = gx * gx + gy * gy
      sum += m; n++
      if (m > peak) peak = m
    }
  }
  return { mean: n ? sum / n : 0, peak: Math.sqrt(peak) }
}

// Analyse a source (image/video/canvas) cheaply at ~400px → { mean, peak }.
export function analyzeDetail(source) {
  try {
    const { ctx, w, h } = scaledCanvas(source, 400)
    return gradientStats(ctx.getImageData(0, 0, w, h))
  } catch { return { mean: 0, peak: null } }
}

// Map overall detail to a JPEG quality in [0.80, 0.90]: flat images compress
// harder, detailed ones keep more. (Current fixed baseline was 0.82.)
export function qualityForDetail(mean) {
  return Math.max(0.80, Math.min(0.90, 0.80 + (mean / 1200) * 0.10))
}

// Peak edge magnitude below this ⇒ the frame reads as soft/out-of-focus.
// Conservative so plain-but-sharp shots don't false-trigger. Tune with real shots.
export const SOFT_PEAK = 38

// Returns { main, thumb } blobs for one selected file, main at adaptive quality.
export async function makeMainAndThumb(file) {
  const img = await loadImage(file)
  let quality = 0.84
  try { quality = qualityForDetail(analyzeDetail(img).mean) } catch { /* default quality */ }
  const main = await canvasToBlob(scaledCanvas(img, 1600).canvas, quality)
  const thumb = await canvasToBlob(scaledCanvas(img, 320).canvas, 0.7)
  return { main, thumb }
}

// A small base64 (no data: prefix) for fast AI naming — tiny image the model can
// read quickly, sent inline so naming needn't wait for the upload.
export async function toSmallBase64(file, maxDim = 512, quality = 0.72) {
  const img = await loadImage(file)
  const blob = await canvasToBlob(scaledCanvas(img, maxDim).canvas, quality)
  return await new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = () => reject(new Error('Could not read image'))
    r.readAsDataURL(blob)
  })
}
