import { sb } from './supabase'
import { CATEGORY_NAMES } from './constants'

const AI_PROXY = 'https://partvault-proxy.leap00.workers.dev'

export async function getStoreAnthropicKey(storeId) {
  const { data } = await sb.from('stores').select('settings').eq('id', storeId).single()
  return data?.settings?.anthropicKey || ''
}

async function urlToBase64(url) {
  const blob = await (await fetch(url)).blob()
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

// Identify a part from its photo + the donor car, returning eBay-ready fields.
export async function assessPartFromUrl(photoUrl, car, apiKey) {
  if (!apiKey || apiKey.length < 20) throw new Error('No Anthropic API key set for this store')
  const photoBase64 = await urlToBase64(photoUrl)
  const sys = `You are an expert Australian used car parts eBay seller. Return JSON only.\nCategories: ${CATEGORY_NAMES.join(', ')}\nReturn: {"title":"max 80 chars","category":"exact","subcategory":"exact","condition":"Used – Good","description":"3-4 sentences","partNumber":"OEM or empty","listPrice":number,"weight":number,"notes":""}`
  const res = await fetch(AI_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514', max_tokens: 800, system: sys,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photoBase64 } },
        { type: 'text', text: `Vehicle: ${car?.make || ''} ${car?.model || ''} ${car?.year || ''}. Identify this car part.` },
      ] }],
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  const raw = data.content?.filter(b => b.type === 'text').map(b => b.text).join('').trim()
  let parsed
  try { parsed = JSON.parse(raw) } catch { const m = raw?.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]) }
  if (!parsed) throw new Error('Could not parse AI response')
  return parsed
}
