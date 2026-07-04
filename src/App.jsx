import { useState, useEffect } from 'react'
import { sb } from './lib/supabase'
import { C } from './lib/constants'
import Login from './screens/Login'
import Home from './screens/Home'
import CarDetail from './screens/CarDetail'
import AddPart from './screens/AddPart'
import Account from './screens/Account'
import { isEnabledFor, unlockBiometric } from './lib/biometric'

const ACTIVE_KEY = 'pv_active_store'

function LockScreen({ userId, email, onUnlock }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const tryUnlock = async () => {
    setBusy(true); setErr('')
    try { await unlockBiometric(userId); onUnlock() }
    catch { setErr('Face ID failed or was cancelled. Try again, or sign out.') }
    setBusy(false)
  }
  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 6 }}>PartVault is locked</div>
      <div style={{ fontSize: 14, color: C.muted, marginBottom: 22 }}>{email}</div>
      <button onClick={tryUnlock} disabled={busy}
        style={{ padding: '14px 28px', background: C.accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
        {busy ? 'Unlocking…' : '🔓 Unlock with Face ID'}
      </button>
      {err && <div style={{ color: C.red, fontSize: 13, marginTop: 14, textAlign: 'center', maxWidth: 280 }}>{err}</div>}
      <button onClick={() => sb.auth.signOut()} style={{ marginTop: 18, background: 'none', border: 'none', color: C.muted, fontSize: 13, cursor: 'pointer' }}>Sign out instead</button>
    </div>
  )
}

function JoinStore({ onJoined }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const join = async () => {
    if (!code.trim()) return
    setBusy(true); setErr('')
    const { error } = await sb.rpc('join_store', { p_join_code: code.trim() })
    setBusy(false)
    if (error) { setErr(error.message); return }
    onJoined()
  }
  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🏪</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 6 }}>Join a store</div>
        <div style={{ fontSize: 14, color: C.muted, marginBottom: 20, lineHeight: 1.5 }}>Enter the join code your store owner gave you.</div>
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && join()}
          placeholder="JOIN CODE" autoCapitalize="characters"
          style={{ width: '100%', padding: '14px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 18, fontWeight: 700, letterSpacing: 2, textAlign: 'center', boxSizing: 'border-box', outline: 'none', marginBottom: 14, fontFamily: 'monospace' }} />
        {err && <div style={{ color: C.red, fontSize: 13, marginBottom: 14 }}>{err}</div>}
        <button onClick={join} disabled={busy || !code.trim()}
          style={{ width: '100%', padding: 14, background: C.accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: (busy || !code.trim()) ? 0.6 : 1 }}>
          {busy ? 'Joining…' : 'Join Store'}
        </button>
        <button onClick={() => sb.auth.signOut()} style={{ marginTop: 16, background: 'none', border: 'none', color: C.muted, fontSize: 13, cursor: 'pointer' }}>Sign Out</button>
      </div>
    </div>
  )
}

function DesktopNotice() {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 820px)').matches)
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 820px)')
    const handler = e => setWide(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  if (!wide || dismissed) return null
  return (
    <div style={{ background: '#fffbeb', borderBottom: '1px solid #fcd34d', padding: '9px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontSize: 13, color: '#1c1c1e' }}>
      <span>📱 The PartVault field app is built for phones. On a computer, the <a href="https://admin.partvault.app" target="partvault-admin" style={{ color: C.accent, fontWeight: 700 }}>Admin panel</a> works better.</span>
      <button onClick={() => setDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a8c66', fontSize: 14, lineHeight: 1 }}>✕</button>
    </div>
  )
}

function BottomBar({ tab, onCars, onAccount }) {
  const item = (active, icon, label, onClick) => (
    <button onClick={onClick}
      style={{ flex: 1, background: 'none', border: 'none', padding: '8px 0', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: active ? C.accent : C.muted }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
    </button>
  )
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: `1px solid ${C.border}`, display: 'flex', zIndex: 50, paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {item(tab === 'cars', '🚗', 'Cars', onCars)}
      {item(tab === 'account', '👤', 'Account', onAccount)}
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [stores, setStores] = useState([])
  const [activeStoreId, setActiveStoreId] = useState(null)
  const [marketplace, setMarketplace] = useState('EBAY_AU') // active store's marketplace (for region make ordering)
  const [storesLoaded, setStoresLoaded] = useState(false)
  const [tab, setTab] = useState('cars')          // 'cars' | 'account'
  const [screen, setScreen] = useState('list')     // within Cars: 'list' | 'car-detail' | 'add-part'
  const [selectedCar, setSelectedCar] = useState(null)
  const [initError, setInitError] = useState(null)
  const [locked, setLocked] = useState(false)

  // Name this window so the admin's "Field App" link returns to this tab
  useEffect(() => { window.name = 'partvault-app' }, [])

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session }, error }) => {
      if (error) { setInitError(error.message); return }
      setSession(session)
      if (session) { loadStores(); if (isEnabledFor(session.user.id)) setLocked(true) }
    }).catch(e => setInitError(e.message))
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (session) {
        loadStores()
        // Lock on a restored session (app re-open); a fresh sign-in unlocks.
        if (event === 'INITIAL_SESSION' && isEnabledFor(session.user.id)) setLocked(true)
        if (event === 'SIGNED_IN') setLocked(false)
      } else { setStores([]); setActiveStoreId(null); setStoresLoaded(false); setTab('cars'); setScreen('list'); setLocked(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Re-lock when the app is sent to the background, so returning needs Face ID.
  useEffect(() => {
    const onHide = () => { if (document.hidden && session && isEnabledFor(session.user.id)) setLocked(true) }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [session])

  // All stores this user can access — same source as the admin switcher, so a
  // store created in the admin appears here automatically.
  const loadStores = async () => {
    const { data } = await sb.rpc('get_my_stores')
    const list = data || []
    setStores(list)
    const saved = localStorage.getItem(ACTIVE_KEY)
    const chosen =
      (list.find(s => s.store_id === saved) || list.find(s => s.is_default) || list[0])?.store_id || null
    setActiveStoreId(chosen)
    if (chosen) localStorage.setItem(ACTIVE_KEY, chosen)
    setStoresLoaded(true)
  }

  const setActiveStore = (id) => {
    if (!stores.some(s => s.store_id === id)) return
    setActiveStoreId(id)
    localStorage.setItem(ACTIVE_KEY, id)
    setSelectedCar(null)
    setScreen('list')
  }

  // Active store's marketplace → regional make ordering in the car form.
  useEffect(() => {
    if (!activeStoreId) return
    sb.from('stores').select('settings').eq('id', activeStoreId).single()
      .then(({ data }) => setMarketplace(data?.settings?.marketplace || 'EBAY_AU'))
  }, [activeStoreId])

  const goCars = () => { setTab('cars'); setScreen('list') }
  const goAccount = () => setTab('account')

  if (initError) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, flexDirection: 'column', gap: 8 }}>
      <div style={{ color: '#dc2626', fontWeight: 600 }}>Failed to connect</div>
      <div style={{ color: '#6b7280', fontSize: 13, textAlign: 'center' }}>{initError}</div>
    </div>
  )

  if (session === undefined) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
      Loading…
    </div>
  )

  if (!session) return <><DesktopNotice /><Login /></>

  if (locked) return <LockScreen userId={session.user.id} email={session.user?.email} onUnlock={() => setLocked(false)} />

  if (!storesLoaded) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
      Loading…
    </div>
  )

  if (!activeStoreId) return <JoinStore onJoined={loadStores} />

  // The bottom bar shows on the top-level screens; deep capture flows hide it to stay focused.
  const inCarsFlow = tab === 'cars' && (screen === 'car-detail' || screen === 'add-part')
  const showBottomBar = !inCarsFlow

  return (
    <div>
      <DesktopNotice />
      {tab === 'account' ? (
        <Account email={session.user?.email} userId={session.user?.id} stores={stores} activeStoreId={activeStoreId} setActiveStore={setActiveStore} />
      ) : screen === 'add-part' ? (
        <AddPart
          car={selectedCar}
          storeId={activeStoreId}
          onSave={() => setScreen('car-detail')}
          onCancel={() => setScreen('car-detail')}
        />
      ) : screen === 'car-detail' ? (
        <CarDetail
          car={selectedCar}
          storeId={activeStoreId}
          onBack={() => { setSelectedCar(null); setScreen('list') }}
          onAddPart={() => setScreen('add-part')}
        />
      ) : (
        <Home
          storeId={activeStoreId}
          activeStore={stores.find(s => s.store_id === activeStoreId)}
          marketplace={marketplace}
          onSelectCar={car => { setSelectedCar(car); setScreen('car-detail') }}
        />
      )}
      {showBottomBar && <BottomBar tab={tab} onCars={goCars} onAccount={goAccount} />}
    </div>
  )
}
