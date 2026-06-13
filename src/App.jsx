import { useState, useEffect } from 'react'
import { sb } from './lib/supabase'
import Login from './screens/Login'
import Home from './screens/Home'
import CarDetail from './screens/CarDetail'
import AddPart from './screens/AddPart'

const ACTIVE_KEY = 'pv_active_store'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [stores, setStores] = useState([])
  const [activeStoreId, setActiveStoreId] = useState(null)
  const [storesLoaded, setStoresLoaded] = useState(false)
  const [screen, setScreen] = useState('home')
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
      else { setStores([]); setActiveStoreId(null); setStoresLoaded(false); setScreen('home') }
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
    setScreen('home')
  }

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

  if (screen === 'add-part') return (
    <AddPart
      car={selectedCar}
      storeId={activeStoreId}
      onSave={() => setScreen('car-detail')}
      onCancel={() => setScreen('car-detail')}
    />
  )

  if (screen === 'car-detail') return (
    <CarDetail
      car={selectedCar}
      storeId={activeStoreId}
      onBack={() => { setSelectedCar(null); setScreen('home') }}
      onAddPart={() => setScreen('add-part')}
    />
  )

  return (
    <Home
      storeId={activeStoreId}
      stores={stores}
      activeStoreId={activeStoreId}
      setActiveStore={setActiveStore}
      onSelectCar={car => { setSelectedCar(car); setScreen('car-detail') }}
    />
  )
}
