// Biometric app-lock via WebAuthn. On iPhone the platform authenticator is
// Face ID / Touch ID. This gates access to the already-persisted Supabase
// session — it's a convenience lock, not server-verified auth.
const KEY = 'pv_biometric' // { userId, credId (base64url) }

const enc = new TextEncoder()
const rand = (n = 32) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return a.buffer }
const bufToB64 = (buf) => {
  const b = new Uint8Array(buf); let s = ''
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const b64ToBuf = (b64) => {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'))
  const b = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i)
  return b.buffer
}

export function biometricSupported() {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials?.create
}

export function getStored() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') } catch { return null }
}

export function isEnabledFor(userId) {
  const s = getStored()
  return !!(s && s.userId === userId && s.credId)
}

// Register a platform passkey (prompts Face ID). Call from a user gesture.
export async function enableBiometric(userId, label) {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: rand(32),
      rp: { name: 'PartVault', id: location.hostname },
      user: { id: enc.encode(userId), name: label || userId, displayName: label || userId },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      timeout: 60000,
      attestation: 'none',
    },
  })
  if (!cred) throw new Error('Could not set up Face ID')
  localStorage.setItem(KEY, JSON.stringify({ userId, credId: bufToB64(cred.rawId) }))
  return true
}

export function disableBiometric() {
  localStorage.removeItem(KEY)
}

// Prompt Face ID to unlock. Resolves on success; throws on failure/cancel.
export async function unlockBiometric(userId) {
  const s = getStored()
  if (!s || s.userId !== userId || !s.credId) throw new Error('Face ID is not set up on this device')
  await navigator.credentials.get({
    publicKey: {
      challenge: rand(32),
      allowCredentials: [{ type: 'public-key', id: b64ToBuf(s.credId) }],
      userVerification: 'required',
      timeout: 60000,
      rpId: location.hostname,
    },
  })
  return true
}
