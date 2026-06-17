import { sb } from './supabase'
import { CATEGORY_NAMES } from './constants'

const EDGE_FN = 'https://mtpektsxaklhedknincs.supabase.co/functions/v1/ai-assess'

async function urlToBase64(url) {
  const blob = await (await fetch(url)).blob()
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

// Identify a part from its photo + the donor car. The Anthropic key lives as an
// edge-function secret — never in the client — so no per-store key is needed.
export async function assessPartFromUrl(photoUrl, car, storeId) {
  const photoBase64 = await urlToBase64(photoUrl)
  const { data: { session } } = await sb.auth.getSession()
  const res = await fetch(EDGE_FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ storeId, photoBase64, car, categories: CATEGORY_NAMES }),
  })
  const d = await res.json()
  if (!res.ok || d.error) throw new Error(d.error || 'AI assessment failed')
  return d.result
}
