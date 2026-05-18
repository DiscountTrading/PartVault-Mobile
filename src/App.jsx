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

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadStore(session.user.id)
    })
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, session) => {
      setSession(session)
      if (session) loadStore(session.user.id)
      else { setStoreId(null); setScreen('home') }
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadStore = async (userId) => {
    const { data } = await sb.from('store_users').select('store_id').eq('user_id', userId).single()
    if (data) setStoreId(data.store_id)
  }

  if (session === undefined) return null

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
