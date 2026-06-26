import { useEffect, useState } from 'react'
import './App.css'
import { supabase } from './supabase'

const SERVICE_LEVELS = [
  { value: 'regular', label: 'Regular', description: 'Standard 4-door vehicle' },
  { value: 'xl', label: 'XL', description: 'SUV/minivan, 6 passenger seats' },
  { value: 'premium', label: 'Premium', description: 'Higher-quality sedan/SUV' },
  { value: 'premium_xl', label: 'Premium XL', description: 'Large premium SUV' },
]

function formatServiceLevel(value) {
  if (value === 'premium_xl') return 'Premium XL'
  if (value === 'premium') return 'Premium'
  if (value === 'xl') return 'XL'
  return 'Regular'
}

function formatServiceLevels(levels) {
  if (!Array.isArray(levels) || levels.length === 0) return 'None'
  return levels.map(formatServiceLevel).join(', ')
}

function eligibleServiceLevelsForRide(rideType) {
  if (rideType === 'premium_xl') return ['premium_xl']
  if (rideType === 'premium') return ['premium', 'premium_xl']
  if (rideType === 'xl') return ['xl', 'premium_xl']
  return ['regular', 'xl', 'premium', 'premium_xl']
}

function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [activePage, setActivePage] = useState('dashboard')
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

  const [licenseFrontFile, setLicenseFrontFile] = useState(null)
  const [licenseBackFile, setLicenseBackFile] = useState(null)
  const [insuranceFile, setInsuranceFile] = useState(null)

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
  const [vehicleColor, setVehicleColor] = useState('')
  const [vehicleSeats, setVehicleSeats] = useState('4')
  const [requestedServiceLevels, setRequestedServiceLevels] = useState(['regular'])

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
        setVehicleColor(data.vehicle_color || '')
        setVehicleSeats(data.vehicle_seats ? String(data.vehicle_seats) : '4')
        setRequestedServiceLevels(
          Array.isArray(data.requested_service_levels) && data.requested_service_levels.length > 0
            ? data.requested_service_levels
            : ['regular']
        )
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
    setActivePage('dashboard')
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
    setActivePage('dashboard')
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
    setVehicleColor('')
    setVehicleSeats('4')
    setRequestedServiceLevels(['regular'])
    setLicenseFrontFile(null)
    setLicenseBackFile(null)
    setInsuranceFile(null)
  }

  async function uploadDriverDocument(file, folder) {
    if (!file || !driverId) return null

    const fileExt = file.name.split('.').pop()
    const fileName = `${driverId}-${Date.now()}.${fileExt}`
    const filePath = `${folder}/${fileName}`

    const { error } = await supabase.storage
      .from('driver-documents')
      .upload(filePath, file, {
        upsert: true,
      })

    if (error) {
      throw new Error(error.message)
    }

    return filePath
  }

  function toggleRequestedServiceLevel(value) {
    setRequestedServiceLevels((currentLevels) => {
      if (value === 'regular') {
        return currentLevels.includes('regular') ? currentLevels : ['regular', ...currentLevels]
      }

      if (currentLevels.includes(value)) {
        const nextLevels = currentLevels.filter((level) => level !== value)
        return nextLevels.length > 0 ? nextLevels : ['regular']
      }

      return [...currentLevels, value]
    })
  }

  function driverCanReceiveRide(rideType) {
    const approvedLevels = Array.isArray(driverProfile?.approved_service_levels)
      ? driverProfile.approved_service_levels
      : []

    const eligibleLevels = eligibleServiceLevelsForRide(rideType || 'regular')
    return approvedLevels.some((level) => eligibleLevels.includes(level))
  }

  async function submitOnboarding() {
    if (!driverId) return

    if (
      !firstName ||
      !lastName ||
      !phone ||
      !licenseNumber ||
      !vehicleMake ||
      !vehicleModel ||
      !vehicleYear ||
      !vehiclePlate ||
      !vehicleColor ||
      !vehicleSeats ||
      requestedServiceLevels.length === 0
    ) {
      setMessage('Please complete all onboarding fields.')
      return
    }

    if (!driverProfile?.license_front_url && !licenseFrontFile) {
      setMessage('Please upload the front of your driver license.')
      return
    }

    if (!driverProfile?.license_back_url && !licenseBackFile) {
      setMessage('Please upload the back of your driver license.')
      return
    }

    if (!driverProfile?.insurance_card_url && !insuranceFile) {
      setMessage('Please upload your insurance card.')
      return
    }

    setLoading(true)
    setMessage('')

    let licenseFrontUrl = driverProfile?.license_front_url || null
    let licenseBackUrl = driverProfile?.license_back_url || null
    let insuranceCardUrl = driverProfile?.insurance_card_url || null

    try {
      if (licenseFrontFile) {
        licenseFrontUrl = await uploadDriverDocument(licenseFrontFile, 'licenses/front')
      }

      if (licenseBackFile) {
        licenseBackUrl = await uploadDriverDocument(licenseBackFile, 'licenses/back')
      }

      if (insuranceFile) {
        insuranceCardUrl = await uploadDriverDocument(insuranceFile, 'insurance')
      }
    } catch (error) {
      setLoading(false)
      setMessage(error.message)
      return
    }

    const { error } = await supabase
      .from('drivers')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone,
        license_number: licenseNumber,
        license_front_url: licenseFrontUrl,
        license_back_url: licenseBackUrl,
        vehicle_make: vehicleMake,
        vehicle_model: vehicleModel,
        vehicle_year: Number(vehicleYear),
        vehicle_plate: vehiclePlate,
        vehicle_color: vehicleColor,
        vehicle_seats: Number(vehicleSeats),
        requested_service_levels: requestedServiceLevels,
        insurance_card_url: insuranceCardUrl,
        onboarding_status: 'pending_review',
        background_check_status: 'pending',
        vehicle_service_status: 'pending',
        approved_service_levels: [],
        vehicle_reviewed_at: null,
        vehicle_rejected_at: null,
        vehicle_rejection_reason: null,
        vehicle_suspended_at: null,
      })
      .eq('id', driverId)

    setLoading(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setLicenseFrontFile(null)
    setLicenseBackFile(null)
    setInsuranceFile(null)
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

    if (
      driverProfile?.vehicle_service_status !== 'approved' ||
      !Array.isArray(driverProfile?.approved_service_levels) ||
      driverProfile.approved_service_levels.length === 0
    ) {
      setMessage('Your vehicle service level must be approved before going online.')
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
        await loadRideRequests()
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
    setRides([])
    setMessage('You are now offline.')
  }

  async function loadRideRequests() {
    if (!driverId) {
      setRides([])
      return
    }

    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .eq('status', 'requested')
      .contains('dispatched_driver_ids', [driverId])
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

    if (
      driverProfile?.vehicle_service_status !== 'approved' ||
      !Array.isArray(driverProfile?.approved_service_levels) ||
      driverProfile.approved_service_levels.length === 0
    ) {
      setMessage('Your vehicle service level must be approved before accepting rides.')
      return
    }

    if (!driverCanReceiveRide(ride.ride_type)) {
      setMessage('Your vehicle is not approved for this ride type.')
      await loadRideRequests()
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
      .contains('dispatched_driver_ids', [driverId])
      .select('*')
      .single()

    if (error) {
      setMessage('This ride is no longer available.')
      await loadRideRequests()
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
    if (!driverId) return

    setMessage('')

    const { data: ride, error: readError } = await supabase
      .from('rides')
      .select('dispatched_driver_ids')
      .eq('id', rideId)
      .eq('status', 'requested')
      .maybeSingle()

    if (readError) {
      setMessage(readError.message)
      return
    }

    if (!ride) {
      setMessage('This ride is no longer available.')
      await loadRideRequests()
      return
    }

    const currentDriverIds = Array.isArray(ride.dispatched_driver_ids)
      ? ride.dispatched_driver_ids
      : []

    const nextDriverIds = currentDriverIds.filter((id) => id !== driverId)

    const updates = {
      dispatched_driver_ids: nextDriverIds,
    }

    if (nextDriverIds.length === 0) {
      updates.status = 'no_driver_available'
    }

    const { error } = await supabase
      .from('rides')
      .update(updates)
      .eq('id', rideId)
      .eq('status', 'requested')

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Ride declined.')
    await loadRideRequests()
    await loadRideHistory()
  }

  function formatDate(value) {
    if (!value) return ''
    return new Date(value).toLocaleString()
  }

  const onboardingStatus = driverProfile?.onboarding_status || 'not_started'
  const vehicleServiceStatus = driverProfile?.vehicle_service_status || 'pending'
  const isApproved = onboardingStatus === 'approved'
  const isPendingReview = onboardingStatus === 'pending_review'
  const isVehicleApproved =
    vehicleServiceStatus === 'approved' &&
    Array.isArray(driverProfile?.approved_service_levels) &&
    driverProfile.approved_service_levels.length > 0

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
              <button type="button" onClick={() => { setMessage(''); setAuthMode('signup') }}>
                Create Driver Account
              </button>
            ) : (
              <button type="button" onClick={() => { setMessage(''); setAuthMode('login') }}>
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

      <section className="card">
        <button type="button" onClick={() => setActivePage('dashboard')}>Dashboard</button>
        <button type="button" onClick={() => setActivePage('history')}>Trip History</button>
      </section>

      {activePage === 'dashboard' && (
        <>
          {showOnboarding && !isApproved && (
            <section className="card">
              <h2>Driver Onboarding</h2>
              <p><strong>Status:</strong> {onboardingStatus}</p>
              <p><strong>Vehicle Service Status:</strong> {vehicleServiceStatus}</p>

              {isPendingReview ? (
                <>
                  <p>Your application has been submitted and is waiting for admin approval.</p>
                  <p><strong>Requested Services:</strong> {formatServiceLevels(driverProfile?.requested_service_levels)}</p>
                </>
              ) : (
                <>
                  <input
                    placeholder="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />

                  <input
                    placeholder="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />

                  <input
                    placeholder="Phone Number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />

                  <input
                    placeholder="License Number"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                  />

                  <label>License Front</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setLicenseFrontFile(e.target.files[0])}
                  />
                  {driverProfile?.license_front_url && <p>License front uploaded.</p>}

                  <label>License Back</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setLicenseBackFile(e.target.files[0])}
                  />
                  {driverProfile?.license_back_url && <p>License back uploaded.</p>}

                  <input
                    placeholder="Vehicle Make"
                    value={vehicleMake}
                    onChange={(e) => setVehicleMake(e.target.value)}
                  />

                  <input
                    placeholder="Vehicle Model"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                  />

                  <input
                    placeholder="Vehicle Year"
                    value={vehicleYear}
                    onChange={(e) => setVehicleYear(e.target.value)}
                  />

                  <input
                    placeholder="License Plate"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                  />

                  <input
                    placeholder="Vehicle Color"
                    value={vehicleColor}
                    onChange={(e) => setVehicleColor(e.target.value)}
                  />

                  <input
                    placeholder="Passenger Seats"
                    type="number"
                    min="1"
                    max="8"
                    value={vehicleSeats}
                    onChange={(e) => setVehicleSeats(e.target.value)}
                  />

                  <div className="ride-card">
                    <h3>Requested Service Levels</h3>
                    <p>Select what this vehicle should be reviewed for. Admin makes the final approval.</p>

                    {SERVICE_LEVELS.map((level) => (
                      <label key={level.value} style={{ display: 'block', marginBottom: '8px' }}>
                        <input
                          type="checkbox"
                          checked={requestedServiceLevels.includes(level.value)}
                          onChange={() => toggleRequestedServiceLevel(level.value)}
                        />
                        {' '}
                        <strong>{level.label}</strong> — {level.description}
                      </label>
                    ))}
                  </div>

                  <label>Insurance Card</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setInsuranceFile(e.target.files[0])}
                  />
                  {driverProfile?.insurance_card_url && <p>Insurance card uploaded.</p>}

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
            <p><strong>Vehicle Approval:</strong> {vehicleServiceStatus}</p>
            <p><strong>Requested Services:</strong> {formatServiceLevels(driverProfile?.requested_service_levels)}</p>
            <p><strong>Approved Services:</strong> {formatServiceLevels(driverProfile?.approved_service_levels)}</p>
            <p><strong>GPS:</strong> {locationText}</p>

            {status === 'offline' ? (
              <button type="button" onClick={goOnline} disabled={loading || !isApproved || !isVehicleApproved}>
                {loading ? 'Updating...' : 'Go Online'}
              </button>
            ) : (
              <button type="button" onClick={goOffline} disabled={loading}>
                {loading ? 'Updating...' : 'Go Offline'}
              </button>
            )}

            {!isApproved && <p>You must complete onboarding and be approved before going online.</p>}

            {isApproved && !isVehicleApproved && (
              <p>Your driver account is approved, but your vehicle service level is still waiting for approval.</p>
            )}

            {status === 'online' && (
              <button type="button" onClick={updateDriverLocation}>Update GPS Now</button>
            )}

            {message && <p>{message}</p>}
          </section>

          <section className="card">
            <h2>Today</h2>
            <p>Trips completed: {tripsCompleted}</p>
            <p>Earnings: ${earnings.toFixed(2)}</p>
            <p>Rating: {averageRating ? `${averageRating.toFixed(1)} ★ (${ratingsCount})` : 'No ratings yet'}</p>
          </section>

          {activeRide && (
            <section className="card">
              <h2>Active Ride</h2>
              <p><strong>Status:</strong> {activeRide.status}</p>
              <p><strong>Ride Type:</strong> {formatServiceLevel(activeRide.ride_type)}</p>
              {activeRide.requested_capacity && (
                <p><strong>Requested Capacity:</strong> {activeRide.requested_capacity} seats</p>
              )}
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
                <p>No dispatched ride requests yet.</p>
              ) : (
                rides.map((ride) => (
                  <div key={ride.id} className="ride-card">
                    <p><strong>Ride Type:</strong> {formatServiceLevel(ride.ride_type)}</p>
                    {ride.requested_capacity && (
                      <p><strong>Requested Capacity:</strong> {ride.requested_capacity} seats</p>
                    )}
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
        </>
      )}

      {activePage === 'history' && (
        <section className="card">
          <h2>Trip History</h2>

          {rideHistory.length === 0 ? (
            <p>No trips yet.</p>
          ) : (
            rideHistory.map((ride) => (
              <div key={ride.id} className="ride-card">
                <p><strong>Status:</strong> {ride.status}</p>
                <p><strong>Ride Type:</strong> {formatServiceLevel(ride.ride_type)}</p>
                {ride.requested_capacity && (
                  <p><strong>Requested Capacity:</strong> {ride.requested_capacity} seats</p>
                )}
                <p><strong>Pickup:</strong> {ride.pickup_address || 'Unknown'}</p>
                <p><strong>Dropoff:</strong> {ride.destination_address || 'Unknown'}</p>
                <p><strong>Fare:</strong> ${((ride.final_fare_cents || ride.estimated_fare_cents || 0) / 100).toFixed(2)}</p>
                <p><strong>Date:</strong> {formatDate(ride.created_at)}</p>
                {ride.completed_at && <p><strong>Completed:</strong> {formatDate(ride.completed_at)}</p>}
              </div>
            ))
          )}
        </section>
      )}
    </div>
  )
}

export default App