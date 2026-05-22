import { useState, useEffect } from 'react'
import { sb } from './lib/supabase'
import Login from './screens/Login'
import Home from './screens/Home'
import CarDetail from './screens/CarDetail'
import AddPart from './screens/AddPart'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [storeId, setStoreId] = useState(null)
  const [screen, setScreen] = useState('home')
  const [selectedCar, setSelectedCar] = useState(null)
  const [initError, setInitError] = useState(null)

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session }, error }) => {
      if (error) { setInitError(error.message); return }
      setSession(session)
      if (session) loadStore()
    }).catch(e => setInitError(e.message))
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, session) => {
      setSession(session)
      if (session) loadStore()
      else { setStoreId(null); setScreen('home') }
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadStore = async () => {
    const { data } = await sb.rpc('get_my_profile')
    if (data?.length > 0) setStoreId(data[0].store_id)
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

  if (!storeId) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
      Loading…
    </div>
  )

  if (screen === 'add-part') return (
    <AddPart
      car={selectedCar}
      storeId={storeId}
      onSave={() => setScreen('car-detail')}
      onCancel={() => setScreen('car-detail')}
    />
  )

  if (screen === 'car-detail') return (
    <CarDetail
      car={selectedCar}
      storeId={storeId}
      onBack={() => { setSelectedCar(null); setScreen('home') }}
      onAddPart={() => setScreen('add-part')}
    />
  )

  return (
    <Home
      storeId={storeId}
      onSelectCar={car => { setSelectedCar(car); setScreen('car-detail') }}
    />
  )
}
