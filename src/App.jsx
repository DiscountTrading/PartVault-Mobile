import { useState, useEffect } from 'react'
import { sb } from './lib/supabase'
import { C } from './lib/constants'
import Login from './screens/Login'
import Home from './screens/Home'
import CarDetail from './screens/CarDetail'
import AddPart from './screens/AddPart'
import Account from './screens/Account'

const ACTIVE_KEY = 'pv_active_store'

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
  const [storesLoaded, setStoresLoaded] = useState(false)
  const [tab, setTab] = useState('cars')          // 'cars' | 'account'
  const [screen, setScreen] = useState('list')     // within Cars: 'list' | 'car-detail' | 'add-part'
  const [selectedCar, setSelectedCar] = useState(null)
  const [initError, setInitError] = useState(null)

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session }, error }) => {
      if (error) { setInitError(error.message); return }
      setSession(session)
      if (session) loadStores()
    }).catch(e => setInitError(e.message))
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, session) => {
      setSession(session)
      if (session) loadStores()
      else { setStores([]); setActiveStoreId(null); setStoresLoaded(false); setTab('cars'); setScreen('list') }
    })
    return () => subscription.unsubscribe()
  }, [])

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

  if (!session) return <Login />

  if (!storesLoaded) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
      Loading…
    </div>
  )

  if (!activeStoreId) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, flexDirection: 'column', gap: 8 }}>
      <div style={{ color: '#111827', fontWeight: 600 }}>No store access</div>
      <div style={{ color: '#6b7280', fontSize: 13, textAlign: 'center' }}>Your account isn't a member of any store yet. Ask an admin to add you, or create a store in the admin panel.</div>
      <button onClick={() => sb.auth.signOut()} style={{ marginTop: 8, background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>Sign Out</button>
    </div>
  )

  // The bottom bar shows on the top-level screens; deep capture flows hide it to stay focused.
  const inCarsFlow = tab === 'cars' && (screen === 'car-detail' || screen === 'add-part')
  const showBottomBar = !inCarsFlow

  return (
    <div>
      {tab === 'account' ? (
        <Account email={session.user?.email} stores={stores} activeStoreId={activeStoreId} setActiveStore={setActiveStore} />
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
          onSelectCar={car => { setSelectedCar(car); setScreen('car-detail') }}
        />
      )}
      {showBottomBar && <BottomBar tab={tab} onCars={goCars} onAccount={goAccount} />}
    </div>
  )
}
