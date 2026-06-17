import { sb } from './supabase'
import { CATEGORY_NAMES } from './constants'

const EDGE_FN = 'https://mtpektsxaklhedknincs.supabase.co/functions/v1/ai-assess'

// Assess a part from its photo and write the result back to the part row. The
// edge function holds the Anthropic key (a secret — never in the client),
// fetches the photo, runs the assessment, and saves the result server-side with
// the service role, so it doesn't depend on the mobile role's RLS update rights
// or the app staying open. Pass partId to have it applied automatically.
export async function assessPartFromUrl(photoUrl, car, storeId, opts = {}) {
  const { data: { session } } = await sb.auth.getSession()
  const res = await fetch(EDGE_FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({
      storeId, photoUrl, car, categories: CATEGORY_NAMES,
      partId: opts.partId, existingTitle: opts.existingTitle, existingPrice: opts.existingPrice,
    }),
  })
  const d = await res.json()
  if (!res.ok || d.error) throw new Error(d.error || 'AI assessment failed')
  return d.result
}
