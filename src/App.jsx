import { useEffect, useState } from 'react'
import './App.css'
import { supabase } from './supabase'

function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [authMode, setAuthMode] = useState('login')
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
  const [rideHistory, setRideHistory] = useState([])
  const [averageRating, setAverageRating] = useState(null)
  const [ratingsCount, setRatingsCount] = useState(0)
  const [locationText, setLocationText] = useState('Location not shared yet')

  const [driverProfile, setDriverProfile] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(false)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [vehicleMake, setVehicleMake] = useState('')
  const [vehicleModel, setVehicleModel] = useState('')
  const [vehicleYear, setVehicleYear] = useState('')
  const [vehiclePlate, setVehiclePlate] = useState('')

  useEffect(() => {
    restoreSession()
  }, [])

  useEffect(() => {
    if (!loggedIn) return

    loadRideRequests()
    loadActiveRide()
    loadRideHistory()
    loadRatings()

    const channel = supabase
      .channel(`driver-${driverId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, () => {
        loadRideRequests()
        loadActiveRide()
        loadRideHistory()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ratings' }, () => {
        loadRatings()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => {
        if (driverId) loadDriverProfile(driverId)
      })
      .subscribe()

    const interval = setInterval(() => {
      loadRideRequests()
      loadActiveRide()
      loadRideHistory()
      loadRatings()
      if (driverId) loadDriverProfile(driverId)
    }, 5000)

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [loggedIn, driverId])

  useEffect(() => {
    if (!loggedIn || !driverId || status !== 'online') return

    const locationInterval = setInterval(() => {
      updateDriverLocation()
    }, 15000)

    return () => clearInterval(locationInterval)
  }, [loggedIn, driverId, status])

  async function loadDriverProfile(id) {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      setMessage(error.message)
      return
    }

    if (data) {
      setDriverProfile(data)

      if (!driverProfile) {
        setFirstName(data.first_name || '')
        setLastName(data.last_name || '')
        setPhone(data.phone || '')
        setLicenseNumber(data.license_number || '')
        setVehicleMake(data.vehicle_make || '')
        setVehicleModel(data.vehicle_model || '')
        setVehicleYear(data.vehicle_year ? String(data.vehicle_year) : '')
        setVehiclePlate(data.vehicle_plate || '')
      }

      setShowOnboarding(data.onboarding_status !== 'approved')
    }
  }

  async function restoreSession() {
    const { data } = await supabase.auth.getSession()

    if (data.session?.user) {
      const user = data.session.user
      setEmail(user.email)

      const { data: driver } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (driver) {
        setDriverId(driver.id)
        await loadDriverProfile(driver.id)
        setStatus(driver.availability_status || 'offline')
        setTripsCompleted(driver.total_trips || 0)
        setEarnings(Number(driver.total_earnings || 0))

        if (driver.current_lat && driver.current_lng) {
          setLocationText(`${driver.current_lat}, ${driver.current_lng}`)
        }

        setLoggedIn(true)
      }
    }
  }

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
    await loadDriverProfile(driver.id)
    setStatus(driver.availability_status || 'offline')
    setTripsCompleted(driver.total_trips || 0)
    setEarnings(Number(driver.total_earnings || 0))

    if (driver.current_lat && driver.current_lng) {
      setLocationText(`${driver.current_lat}, ${driver.current_lng}`)
    }

    setLoggedIn(true)
    setMessage('')
  }

  async function signup(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    setLoading(false)

    if (error) {
      setMessage(error.message)
      return
    }

    if (data.user) {
      setMessage('Account created successfully. Check your email for verification, then log in.')
      setAuthMode('login')
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    setLoggedIn(false)
    setAuthMode('login')
    setEmail('')
    setPassword('')
    setStatus('offline')
    setMessage('')
    setRides([])
    setDriverId(null)
    setActiveRide(null)
    setEarnings(0)
    setTripsCompleted(0)
    setRideHistory([])
    setAverageRating(null)
    setRatingsCount(0)
    setLocationText('Location not shared yet')
    setDriverProfile(null)
    setShowOnboarding(false)
    setFirstName('')
    setLastName('')
    setPhone('')
    setLicenseNumber('')
    setVehicleMake('')
    setVehicleModel('')
    setVehicleYear('')
    setVehiclePlate('')
  }

  async function submitOnboarding() {
    if (!driverId) return

    if (!firstName || !lastName || !phone || !licenseNumber || !vehicleMake || !vehicleModel || !vehicleYear || !vehiclePlate) {
      setMessage('Please complete all onboarding fields.')
      return
    }

    setLoading(true)
    setMessage('')

    const { error } = await supabase
      .from('drivers')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone,
        license_number: licenseNumber,
        vehicle_make: vehicleMake,
        vehicle_model: vehicleModel,
        vehicle_year: Number(vehicleYear),
        vehicle_plate: vehiclePlate,
        onboarding_status: 'pending_review',
        background_check_status: 'pending',
      })
      .eq('id', driverId)

    setLoading(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Onboarding submitted. Waiting for admin approval.')
    await loadDriverProfile(driverId)
  }

  async function updateDriverLocation() {
    if (!driverId) return

    if (!navigator.geolocation) {
      setMessage('GPS is not supported on this device.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude

        const { error } = await supabase
          .from('drivers')
          .update({
            current_lat: lat,
            current_lng: lng,
            last_location_update: new Date().toISOString(),
          })
          .eq('id', driverId)

        if (error) {
          setMessage(error.message)
          return
        }

        setLocationText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`)
      },
      () => {
        setMessage('Location permission is required.')
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    )
  }

  async function goOnline() {
    if (!driverId) return

    if (driverProfile?.onboarding_status !== 'approved') {
      setMessage('Complete onboarding and wait for admin approval before going online.')
      return
    }

    setLoading(true)
    setMessage('')

    if (!navigator.geolocation) {
      setLoading(false)
      setMessage('GPS is not supported on this device.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude

        const { error } = await supabase
          .from('drivers')
          .update({
            is_online: true,
            availability_status: 'online',
            current_lat: lat,
            current_lng: lng,
            last_location_update: new Date().toISOString(),
          })
          .eq('id', driverId)

        setLoading(false)

        if (error) {
          setMessage(error.message)
          return
        }

        setStatus('online')
        setLocationText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`)
        setMessage('You are now online and sharing location.')
      },
      () => {
        setLoading(false)
        setMessage('Location permission is required to go online.')
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    )
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

  async function loadActiveRide() {
    if (!driverId) return

    const { data } = await supabase
      .from('rides')
      .select('*')
      .eq('driver_id', driverId)
      .in('status', ['accepted', 'arrived', 'in_progress'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    setActiveRide(data || null)
  }

  async function loadRideHistory() {
    if (!driverId) return

    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) return

    setRideHistory(data || [])
  }

  async function loadRatings() {
    if (!driverId) return

    const { data, error } = await supabase
      .from('ratings')
      .select('rating')
      .eq('driver_id', driverId)

    if (error) return

    if (!data || data.length === 0) {
      setAverageRating(null)
      setRatingsCount(0)
      return
    }

    const total = data.reduce((sum, item) => sum + Number(item.rating), 0)
    setAverageRating(total / data.length)
    setRatingsCount(data.length)
  }

  async function acceptRide(ride) {
    if (!driverId) return

    if (driverProfile?.onboarding_status !== 'approved') {
      setMessage('You must be approved before accepting rides.')
      return
    }

    if (status !== 'online') {
      setMessage('You must be online before accepting rides.')
      return
    }

    setMessage('')

    const { data, error } = await supabase
      .from('rides')
      .update({
        status: 'accepted',
        driver_id: driverId,
        matched_at: new Date().toISOString(),
      })
      .eq('id', ride.id)
      .eq('status', 'requested')
      .select('*')
      .single()

    if (error) {
      setMessage(error.message)
      return
    }

    setActiveRide(data)
    setMessage('Ride accepted.')

    await loadRideRequests()
    await loadActiveRide()
    await loadRideHistory()
  }

  async function updateRideStatus(newStatus) {
    if (!activeRide) return

    setMessage('')

    const updates = {
      status: newStatus,
    }

    if (newStatus === 'arrived') {
      updates.driver_arrived_at = new Date().toISOString()
    }

    if (newStatus === 'in_progress') {
      updates.trip_started_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('rides')
      .update(updates)
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

    loadRideHistory()
  }

  async function completeTrip() {
    if (!activeRide || !driverId) return

    setMessage('')

    const fareCents = activeRide.estimated_fare_cents || 0
    const fareDollars = fareCents / 100

    const { error: rideError } = await supabase
      .from('rides')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        final_fare_cents: fareCents,
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

    await loadRideRequests()
    await loadActiveRide()
    await loadRideHistory()
    await loadRatings()
  }

  async function declineRide(rideId) {
    setMessage('')

    const { error } = await supabase
      .from('rides')
      .update({
        status: 'declined',
        cancellation_reason: 'Declined by driver',
      })
      .eq('id', rideId)
      .eq('status', 'requested')

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Ride declined.')
    loadRideRequests()
    loadRideHistory()
  }

  function formatDate(value) {
    if (!value) return ''
    return new Date(value).toLocaleString()
  }

  const onboardingStatus = driverProfile?.onboarding_status || 'not_started'
  const isApproved = onboardingStatus === 'approved'
  const isPendingReview = onboardingStatus === 'pending_review'

  if (!loggedIn) {
    return (
      <div className="driver-app">
        <section className="card">
          <h1>LibreRide Driver</h1>
          <p>{authMode === 'login' ? 'Sign in to continue' : 'Create driver account'}</p>

          <form onSubmit={authMode === 'login' ? login : signup}>
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
              {loading
                ? authMode === 'login'
                  ? 'Signing In...'
                  : 'Creating Account...'
                : authMode === 'login'
                ? 'Login'
                : 'Create Driver Account'}
            </button>
          </form>

          <div style={{ marginTop: '12px' }}>
            {authMode === 'login' ? (
              <button
                type="button"
                onClick={() => {
                  setMessage('')
                  setAuthMode('signup')
                }}
              >
                Create Driver Account
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMessage('')
                  setAuthMode('login')
                }}
              >
                Back To Login
              </button>
            )}
          </div>

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
        <button type="button" onClick={logout}>Logout</button>
      </header>

      {showOnboarding && !isApproved && (
        <section className="card">
          <h2>Driver Onboarding</h2>
          <p><strong>Status:</strong> {onboardingStatus}</p>

          {isPendingReview ? (
            <p>Your application has been submitted and is waiting for admin approval.</p>
          ) : (
            <>
              <input placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              <input placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              <input placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <input placeholder="License Number" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
              <input placeholder="Vehicle Make" value={vehicleMake} onChange={(e) => setVehicleMake(e.target.value)} />
              <input placeholder="Vehicle Model" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} />
              <input placeholder="Vehicle Year" value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)} />
              <input placeholder="License Plate" value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} />

              <button type="button" onClick={submitOnboarding} disabled={loading}>
                {loading ? 'Submitting...' : 'Submit For Review'}
              </button>
            </>
          )}
        </section>
      )}

      <section className="card">
        <h2>Status</h2>
        <p className="status">{status === 'online' ? 'Online' : 'Offline'}</p>
        <p><strong>Approval:</strong> {onboardingStatus}</p>
        <p><strong>GPS:</strong> {locationText}</p>

        {status === 'offline' ? (
          <button type="button" onClick={goOnline} disabled={loading || !isApproved}>
            {loading ? 'Updating...' : 'Go Online'}
          </button>
        ) : (
          <button type="button" onClick={goOffline} disabled={loading}>
            {loading ? 'Updating...' : 'Go Offline'}
          </button>
        )}

        {!isApproved && (
          <p>You must complete onboarding and be approved before going online.</p>
        )}

        {status === 'online' && (
          <button type="button" onClick={updateDriverLocation}>
            Update GPS Now
          </button>
        )}

        {message && <p>{message}</p>}
      </section>

      <section className="card">
        <h2>Today</h2>
        <p>Trips completed: {tripsCompleted}</p>
        <p>Earnings: ${earnings.toFixed(2)}</p>
        <p>
          Rating:{' '}
          {averageRating
            ? `${averageRating.toFixed(1)} ★ (${ratingsCount})`
            : 'No ratings yet'}
        </p>
      </section>

      {activeRide && (
        <section className="card">
          <h2>Active Ride</h2>
          <p><strong>Status:</strong> {activeRide.status}</p>
          <p><strong>Pickup:</strong> {activeRide.pickup_address || 'Unknown'}</p>
          <p><strong>Dropoff:</strong> {activeRide.destination_address || 'Unknown'}</p>
          <p><strong>Fare:</strong> ${((activeRide.estimated_fare_cents || 0) / 100).toFixed(2)}</p>

          {activeRide.status === 'accepted' && (
            <button type="button" onClick={() => updateRideStatus('arrived')}>Arrived</button>
          )}

          {activeRide.status === 'arrived' && (
            <button type="button" onClick={() => updateRideStatus('in_progress')}>Start Trip</button>
          )}

          {activeRide.status === 'in_progress' && (
            <button type="button" onClick={completeTrip}>Complete Trip</button>
          )}
        </section>
      )}

      {!activeRide && isApproved && status === 'online' && (
        <section className="card">
          <h2>Ride Requests</h2>

          <button type="button" onClick={loadRideRequests}>Refresh Requests</button>

          {rides.length === 0 ? (
            <p>No active ride requests yet.</p>
          ) : (
            rides.map((ride) => (
              <div key={ride.id} className="ride-card">
                <p><strong>Pickup:</strong> {ride.pickup_address || 'Unknown'}</p>
                <p><strong>Dropoff:</strong> {ride.destination_address || 'Unknown'}</p>
                <p><strong>Fare:</strong> ${((ride.estimated_fare_cents || 0) / 100).toFixed(2)}</p>

                <button type="button" onClick={() => acceptRide(ride)}>Accept</button>
                <button type="button" onClick={() => declineRide(ride.id)}>Decline</button>
              </div>
            ))
          )}
        </section>
      )}

      {!activeRide && isApproved && status !== 'online' && (
        <section className="card">
          <h2>Ride Requests</h2>
          <p>Go online to receive ride requests.</p>
        </section>
      )}

      <section className="card">
        <h2>Recent Trips</h2>

        {rideHistory.length === 0 ? (
          <p>No trips yet.</p>
        ) : (
          rideHistory.map((ride) => (
            <div key={ride.id} className="ride-card">
              <p><strong>Status:</strong> {ride.status}</p>
              <p><strong>Pickup:</strong> {ride.pickup_address || 'Unknown'}</p>
              <p><strong>Dropoff:</strong> {ride.destination_address || 'Unknown'}</p>
              <p><strong>Fare:</strong> ${((ride.final_fare_cents || ride.estimated_fare_cents || 0) / 100).toFixed(2)}</p>
              <p><strong>Date:</strong> {formatDate(ride.created_at)}</p>
              {ride.completed_at && (
                <p><strong>Completed:</strong> {formatDate(ride.completed_at)}</p>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  )
}

export default App