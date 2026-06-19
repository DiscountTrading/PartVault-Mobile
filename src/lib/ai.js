import { sb } from './supabase'
import { CATEGORY_NAMES } from './constants'

const EDGE_FN = 'https://mtpektsxaklhedknincs.supabase.co/functions/v1/ai-assess'

// Assess a part from all its photos and write the result back to the part row.
// The edge function holds the Anthropic key (a secret — never in the client),
// loads the photos, runs the assessment across every angle/close-up, and saves
// the result server-side with the service role, so it doesn't depend on the
// mobile role's RLS update rights or the app staying open. Pass partId to have
// it applied automatically. photoUrls is an array of all the part's photos.
// Identify a car's make/model/year from its photos (replaces VIN lookup).
export async function identifyCar(photoUrls, storeId) {
  const { data: { session } } = await sb.auth.getSession()
  const res = await fetch(EDGE_FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ storeId, mode: 'identify-car', photoUrls }),
  })
  const d = await res.json()
  if (!res.ok || d.error) throw new Error(d.error || 'Could not identify the car')
  return d.result
}

export async function assessPartFromUrls(photoUrls, car, storeId, opts = {}) {
  const { data: { session } } = await sb.auth.getSession()
  const res = await fetch(EDGE_FN, {
    method: 'POST',
    // keepalive lets the request finish even though the screen navigates away
    // right after Save (otherwise the browser can cancel the in-flight request
    // and the part keeps its insert defaults — no assessment).
    keepalive: true,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({
      storeId, photoUrls, car, carId: car?.id, categories: CATEGORY_NAMES,
      partId: opts.partId, existingTitle: opts.existingTitle, existingPrice: opts.existingPrice,
    }),
  })
  const d = await res.json()
  if (!res.ok || d.error) throw new Error(d.error || 'AI assessment failed')
  return d.result
}
