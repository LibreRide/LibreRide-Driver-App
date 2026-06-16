import { useEffect, useState } from 'react'
import './App.css'
import { supabase } from './supabase'

function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('offline')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [rides, setRides] = useState([])
  const [driverId, setDriverId] = useState(null)
  const [activeRide, setActiveRide] = useState(null)
  const [earnings, setEarnings] = useState(0)
  const [tripsCompleted, setTripsCompleted] = useState(0)

  useEffect(() => {
    async function restoreSession() {
      const { data } = await supabase.auth.getSession()

      if (data.session?.user) {
        const user = data.session.user
        setEmail(user.email)

        const { data: driver } = await supabase
          .from('drivers')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (driver) {
          setDriverId(driver.id)
          setStatus(driver.availability_status || 'offline')
          setTripsCompleted(driver.total_trips || 0)
          setEarnings(Number(driver.total_earnings || 0))
          setLoggedIn(true)
        }
      }
    }

    restoreSession()
  }, [])

  useEffect(() => {
    if (!loggedIn) return

    loadRideRequests()

    const channel = supabase
      .channel('ride-requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rides',
        },
        () => {
          loadRideRequests()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loggedIn])

  async function login(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setLoading(false)
      setMessage(error.message)
      return
    }

    const user = data.user

    const { data: driver, error: insertError } = await supabase
      .from('drivers')
      .upsert(
        {
          user_id: user.id,
          email: user.email,
        },
        { onConflict: 'user_id' }
      )
      .select('*')
      .single()

    setLoading(false)

    if (insertError) {
      setMessage(insertError.message)
      return
    }

    setDriverId(driver.id)
    setStatus(driver.availability_status || 'offline')
    setTripsCompleted(driver.total_trips || 0)
    setEarnings(Number(driver.total_earnings || 0))
    setLoggedIn(true)
    setMessage('')
  }

  async function logout() {
    await supabase.auth.signOut()
    setLoggedIn(false)
    setEmail('')
    setPassword('')
    setStatus('offline')
    setMessage('')
    setRides([])
    setDriverId(null)
    setActiveRide(null)
    setEarnings(0)
    setTripsCompleted(0)
  }

  async function goOnline() {
    if (!driverId) return

    setLoading(true)
    setMessage('')

    const { error } = await supabase
      .from('drivers')
      .update({
        is_online: true,
        availability_status: 'online',
        last_location_update: new Date().toISOString(),
      })
      .eq('id', driverId)

    setLoading(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setStatus('online')
    setMessage('You are now online and ready for ride requests.')
  }

  async function goOffline() {
    if (!driverId) return

    setLoading(true)
    setMessage('')

    const { error } = await supabase
      .from('drivers')
      .update({
        is_online: false,
        availability_status: 'offline',
        last_location_update: new Date().toISOString(),
      })
      .eq('id', driverId)

    setLoading(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setStatus('offline')
    setMessage('You are now offline.')
  }

  async function loadRideRequests() {
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .eq('status', 'requested')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
      return
    }

    setRides(data || [])
  }

  async function acceptRide(ride) {
    if (!driverId) return

    setMessage('')

    const { data, error } = await supabase
      .from('rides')
      .update({
        status: 'accepted',
        driver_id: driverId,
      })
      .eq('id', ride.id)
      .select('*')
      .single()

    if (error) {
      setMessage(error.message)
      return
    }

    setActiveRide(data)
    setMessage('Ride accepted.')
    loadRideRequests()
  }

  async function updateRideStatus(newStatus) {
    if (!activeRide) return

    setMessage('')

    const { data, error } = await supabase
      .from('rides')
      .update({
        status: newStatus,
      })
      .eq('id', activeRide.id)
      .select('*')
      .single()

    if (error) {
      setMessage(error.message)
      return
    }

    setActiveRide(data)

    if (newStatus === 'arrived') setMessage('Marked as arrived.')
    if (newStatus === 'in_progress') setMessage('Trip started.')
  }

  async function completeTrip() {
    if (!activeRide || !driverId) return

    setMessage('')

    const fareDollars = (activeRide.estimated_fare_cents || 0) / 100

    const { error: rideError } = await supabase
      .from('rides')
      .update({
        status: 'completed',
      })
      .eq('id', activeRide.id)

    if (rideError) {
      setMessage(rideError.message)
      return
    }

    const newTripsCompleted = tripsCompleted + 1
    const newEarnings = earnings + fareDollars

    const { error: driverError } = await supabase
      .from('drivers')
      .update({
        total_trips: newTripsCompleted,
        total_earnings: newEarnings,
        availability_status: 'online',
        is_online: true,
      })
      .eq('id', driverId)

    if (driverError) {
      setMessage(driverError.message)
      return
    }

    setTripsCompleted(newTripsCompleted)
    setEarnings(newEarnings)
    setActiveRide(null)
    setStatus('online')
    setMessage('Trip completed successfully.')
    loadRideRequests()
  }

  async function declineRide(rideId) {
    setMessage('')

    const { error } = await supabase
      .from('rides')
      .update({
        status: 'declined',
      })
      .eq('id', rideId)

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Ride declined.')
    loadRideRequests()
  }

  if (!loggedIn) {
    return (
      <div className="driver-app">
        <section className="card">
          <h1>LibreRide Driver</h1>
          <p>Sign in to continue</p>

          <form onSubmit={login}>
            <input
              type="email"
              placeholder="Driver email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button type="submit" disabled={loading}>
              {loading ? 'Signing In...' : 'Login'}
            </button>
          </form>

          {message && <p>{message}</p>}
        </section>
      </div>
    )
  }

  return (
    <div className="driver-app">
      <header className="card">
        <h1>LibreRide Driver</h1>
        <p>{email}</p>
        <button onClick={logout}>Logout</button>
      </header>

      <section className="card">
        <h2>Status</h2>
        <p className="status">{status === 'online' ? 'Online' : 'Offline'}</p>

        {status === 'offline' ? (
          <button onClick={goOnline} disabled={loading}>
            {loading ? 'Updating...' : 'Go Online'}
          </button>
        ) : (
          <button onClick={goOffline} disabled={loading}>
            {loading ? 'Updating...' : 'Go Offline'}
          </button>
        )}

        {message && <p>{message}</p>}
      </section>

      <section className="card">
        <h2>Today</h2>
        <p>Trips completed: {tripsCompleted}</p>
        <p>Earnings: ${earnings.toFixed(2)}</p>
      </section>

      {activeRide && (
        <section className="card">
          <h2>Active Ride</h2>
          <p><strong>Status:</strong> {activeRide.status}</p>
          <p><strong>Pickup:</strong> {activeRide.pickup_address || 'Unknown'}</p>
          <p><strong>Dropoff:</strong> {activeRide.destination_address || 'Unknown'}</p>
          <p><strong>Fare:</strong> ${((activeRide.estimated_fare_cents || 0) / 100).toFixed(2)}</p>

          {activeRide.status === 'accepted' && (
            <button onClick={() => updateRideStatus('arrived')}>Arrived</button>
          )}

          {activeRide.status === 'arrived' && (
            <button onClick={() => updateRideStatus('in_progress')}>Start Trip</button>
          )}

          {activeRide.status === 'in_progress' && (
            <button onClick={completeTrip}>Complete Trip</button>
          )}
        </section>
      )}

      {!activeRide && (
        <section className="card">
          <h2>Ride Requests</h2>

          <button onClick={loadRideRequests}>Refresh Requests</button>

          {rides.length === 0 ? (
            <p>No active ride requests yet.</p>
          ) : (
            rides.map((ride) => (
              <div key={ride.id} className="ride-card">
                <p><strong>Pickup:</strong> {ride.pickup_address || 'Unknown'}</p>
                <p><strong>Dropoff:</strong> {ride.destination_address || 'Unknown'}</p>
                <p><strong>Fare:</strong> ${((ride.estimated_fare_cents || 0) / 100).toFixed(2)}</p>

                <button onClick={() => acceptRide(ride)}>Accept</button>
                <button onClick={() => declineRide(ride.id)}>Decline</button>
              </div>
            ))
          )}
        </section>
      )}
    </div>
  )
}

export default App