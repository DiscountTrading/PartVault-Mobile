// Client-side image resize/compress. Phones produce 3–8 MB photos; we downscale
// to a web/eBay-friendly main image (~1600px) plus a small thumbnail (~320px)
// for fast list rendering. Both are JPEG.

function resizeToBlob(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not process image')), 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')) }
    img.src = url
  })
}

// Returns { main, thumb } blobs for one selected file.
export async function makeMainAndThumb(file) {
  const main = await resizeToBlob(file, 1600, 0.82)
  const thumb = await resizeToBlob(file, 320, 0.7)
  return { main, thumb }
}
