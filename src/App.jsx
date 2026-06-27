import { useEffect, useState } from 'react'
import './App.css'
import { supabase } from './supabase'
import {
  VEHICLE_COLORS,
  VEHICLE_MAKES,
  VEHICLE_MODELS_BY_MAKE,
  VEHICLE_TYPES,
  VEHICLE_YEAR_OPTIONS,
  getVehicleSuggestion,
} from './vehicleCatalog'

const API_BASE = 'https://libreride-backend.libreride.workers.dev'

const SERVICE_LABELS = {
  regular: 'Regular',
  xl: 'XL',
  premium: 'Premium',
  premium_xl: 'Premium XL',
}

function formatServiceLevel(value) {
  return SERVICE_LABELS[value] || 'Regular'
}

function formatServiceLevels(levels) {
  if (!Array.isArray(levels) || levels.length === 0) return 'Not approved yet'
  return levels.map(formatServiceLevel).join(', ')
}

function formatRideType(value) {
  return SERVICE_LABELS[value] || 'Regular'
}

function eligibleServiceLevelsForRide(rideType) {
  if (rideType === 'premium_xl') return ['premium_xl']
  if (rideType === 'premium') return ['premium', 'premium_xl']
  if (rideType === 'xl') return ['xl', 'premium_xl']
  return ['regular', 'xl', 'premium', 'premium_xl']
}

function formatMoneyFromCents(value) {
  return `$${(Number(value || 0) / 100).toFixed(2)}`
}

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleString()
}

function statusText(value) {
  if (!value) return 'Pending'
  return String(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
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
  const [driverPhotoFile, setDriverPhotoFile] = useState(null)
  const [registrationFile, setRegistrationFile] = useState(null)
  const [vehicleFrontFile, setVehicleFrontFile] = useState(null)
  const [vehicleBackFile, setVehicleBackFile] = useState(null)
  const [vehicleLeftFile, setVehicleLeftFile] = useState(null)
  const [vehicleRightFile, setVehicleRightFile] = useState(null)
  const [vehicleInteriorFrontFile, setVehicleInteriorFrontFile] = useState(null)
  const [vehicleInteriorBackFile, setVehicleInteriorBackFile] = useState(null)
  const [vehicleTrunkFile, setVehicleTrunkFile] = useState(null)

  const [driverProfile, setDriverProfile] = useState(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [vehicleType, setVehicleType] = useState('sedan')
  const [vehicleMake, setVehicleMake] = useState('')
  const [vehicleModel, setVehicleModel] = useState('')
  const [vehicleYear, setVehicleYear] = useState('')
  const [vehiclePlate, setVehiclePlate] = useState('')
  const [vehicleColor, setVehicleColor] = useState('')
  const [vehicleSeats, setVehicleSeats] = useState('4')
  const [ssn, setSsn] = useState('')

  useEffect(() => {
    restoreSession()
  }, [])

  useEffect(() => {
    if (!loggedIn || !driverId) return

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
        loadDriverProfile(driverId)
      })
      .subscribe()

    const interval = setInterval(() => {
      loadRideRequests()
      loadActiveRide()
      loadRideHistory()
      loadRatings()
      loadDriverProfile(driverId)
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

  async function restoreSession() {
    const { data } = await supabase.auth.getSession()

    if (!data.session?.user) {
      return
    }

    const user = data.session.user
    setEmail(user.email || '')

    const { data: driver, error: driverError } = await supabase
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

    if (driverError) {
      setMessage(driverError.message)
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

    const params = new URLSearchParams(window.location.search)

    if (params.get('verified') === 'true') {
      setMessage('Email verified. Continue your onboarding.')
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }

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

    if (!data) return

    setDriverProfile(data)

    setFirstName(data.first_name || '')
    setLastName(data.last_name || '')
    setPhone(data.phone || '')
    setLicenseNumber(data.license_number || '')
    setVehicleType(data.vehicle_type || 'sedan')
    setVehicleMake(data.vehicle_make || '')
    setVehicleModel(data.vehicle_model || '')
    setVehicleYear(data.vehicle_year ? String(data.vehicle_year) : '')
    setVehiclePlate(data.vehicle_plate || '')
    setVehicleColor(data.vehicle_color || '')
    setVehicleSeats(data.vehicle_seats ? String(data.vehicle_seats) : '4')
  }

  async function signup(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'https://driver.libreride.com/?verified=true',
        data: {
          app: 'LibreRide Driver',
          role: 'driver',
        },
      },
    })

    setLoading(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Account created. Please check your email to verify your account.')
    setAuthMode('login')
  }

  async function login(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (error) {
      setMessage(error.message)
      return
    }

    const user = data.session.user

    const { data: driver, error: driverError } = await supabase
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

    if (driverError) {
      setMessage(driverError.message)
      return
    }

    setDriverId(driver.id)
    await loadDriverProfile(driver.id)
    setStatus(driver.availability_status || 'offline')
    setTripsCompleted(driver.total_trips || 0)
    setEarnings(Number(driver.total_earnings || 0))
    setLoggedIn(true)
    setActivePage('dashboard')
    setMessage('')
  }

  async function logout() {
    if (driverId) {
      await goOffline()
    }

    await supabase.auth.signOut()
    setLoggedIn(false)
    setDriverProfile(null)
    setDriverId(null)
    setEmail('')
    setPassword('')
    setStatus('offline')
    setRides([])
    setActiveRide(null)
    setRideHistory([])
    setMessage('')
  }

  function handleVehicleMakeChange(nextMake) {
    setVehicleMake(nextMake)
    setVehicleModel('')
  }

  function handleVehicleModelChange(nextModel) {
    setVehicleModel(nextModel)

    try {
      const suggestion = getVehicleSuggestion?.({
        make: vehicleMake,
        model: nextModel,
      })

      if (suggestion?.type) {
        setVehicleType(suggestion.type)
      }

      if (suggestion?.seats) {
        setVehicleSeats(String(suggestion.seats))
      }
    } catch {
      // Vehicle suggestion is optional.
    }
  }

  function handleVehicleTypeChange(nextType) {
    setVehicleType(nextType)
  }

  function handleVehicleSeatsChange(nextSeats) {
    setVehicleSeats(nextSeats)
  }

  async function verifyDriverIdentity() {
    const cleanSsn = ssn.replace(/\D/g, '')

    if (driverProfile?.identity_verification_status === 'cleared') {
      return true
    }

    if (cleanSsn.length !== 9) {
      setMessage('Please enter a valid 9-digit SSN.')
      return false
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setMessage('Please log in again.')
      return false
    }

    const response = await fetch(`${API_BASE}/api/drivers/identity-check`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ssn: cleanSsn,
      }),
    })

    let result = {}

    try {
      result = await response.json()
    } catch {
      result = {}
    }

    if (!response.ok) {
      setMessage(result.error || 'Identity verification failed.')
      await loadDriverProfile(driverId)
      return false
    }

    setSsn('')
    await loadDriverProfile(driverId)

    return true
  }

  async function uploadDriverDocument(file, folder) {
    if (!file) return null

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      throw new Error('Please log in again.')
    }

    const extension = file.name.split('.').pop() || 'jpg'
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`
    const filePath = `${user.id}/${folder}/${fileName}`

    const { error } = await supabase.storage
      .from('driver-documents')
      .upload(filePath, file, {
        upsert: false,
        contentType: file.type || undefined,
      })

    if (error) {
      throw error
    }

    return filePath
  }

  async function submitOnboarding() {
    if (!driverId) return

    if (
      !firstName ||
      !lastName ||
      !phone ||
      !licenseNumber ||
      !vehicleType ||
      !vehicleMake ||
      !vehicleModel ||
      !vehicleYear ||
      !vehiclePlate ||
      !vehicleColor ||
      !vehicleSeats
    ) {
      setMessage('Please complete all required fields.')
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

    if (!driverProfile?.driver_photo_url && !driverPhotoFile) {
      setMessage('Please upload a driver photo.')
      return
    }

    if (!driverProfile?.vehicle_registration_url && !registrationFile) {
      setMessage('Please upload your vehicle registration.')
      return
    }

    if (!driverProfile?.vehicle_photo_front_url && !vehicleFrontFile) {
      setMessage('Please upload a front photo of your vehicle.')
      return
    }

    if (!driverProfile?.vehicle_photo_back_url && !vehicleBackFile) {
      setMessage('Please upload a back photo of your vehicle.')
      return
    }

    if (!driverProfile?.vehicle_photo_left_url && !vehicleLeftFile) {
      setMessage('Please upload a left-side photo of your vehicle.')
      return
    }

    if (!driverProfile?.vehicle_photo_right_url && !vehicleRightFile) {
      setMessage('Please upload a right-side photo of your vehicle.')
      return
    }

    if (!driverProfile?.vehicle_photo_interior_front_url && !vehicleInteriorFrontFile) {
      setMessage('Please upload a front interior photo of your vehicle.')
      return
    }

    if (!driverProfile?.vehicle_photo_interior_back_url && !vehicleInteriorBackFile) {
      setMessage('Please upload a back-seat interior photo of your vehicle.')
      return
    }

    if (!driverProfile?.vehicle_photo_trunk_url && !vehicleTrunkFile) {
      setMessage('Please upload a trunk photo of your vehicle.')
      return
    }

    const identityOk = await verifyDriverIdentity()

    if (!identityOk) {
      return
    }

    setLoading(true)
    setMessage('')

    let licenseFrontUrl = driverProfile?.license_front_url || null
    let licenseBackUrl = driverProfile?.license_back_url || null
    let insuranceCardUrl = driverProfile?.insurance_card_url || null
    let driverPhotoUrl = driverProfile?.driver_photo_url || null
    let registrationUrl = driverProfile?.vehicle_registration_url || null
    let vehicleFrontUrl = driverProfile?.vehicle_photo_front_url || null
    let vehicleBackUrl = driverProfile?.vehicle_photo_back_url || null
    let vehicleLeftUrl = driverProfile?.vehicle_photo_left_url || null
    let vehicleRightUrl = driverProfile?.vehicle_photo_right_url || null
    let vehicleInteriorFrontUrl = driverProfile?.vehicle_photo_interior_front_url || null
    let vehicleInteriorBackUrl = driverProfile?.vehicle_photo_interior_back_url || null
    let vehicleTrunkUrl = driverProfile?.vehicle_photo_trunk_url || null

    try {
      if (licenseFrontFile) licenseFrontUrl = await uploadDriverDocument(licenseFrontFile, 'licenses/front')
      if (licenseBackFile) licenseBackUrl = await uploadDriverDocument(licenseBackFile, 'licenses/back')
      if (insuranceFile) insuranceCardUrl = await uploadDriverDocument(insuranceFile, 'insurance')
      if (driverPhotoFile) driverPhotoUrl = await uploadDriverDocument(driverPhotoFile, 'driver-photo')
      if (registrationFile) registrationUrl = await uploadDriverDocument(registrationFile, 'vehicle-registration')
      if (vehicleFrontFile) vehicleFrontUrl = await uploadDriverDocument(vehicleFrontFile, 'vehicle-photos/front')
      if (vehicleBackFile) vehicleBackUrl = await uploadDriverDocument(vehicleBackFile, 'vehicle-photos/back')
      if (vehicleLeftFile) vehicleLeftUrl = await uploadDriverDocument(vehicleLeftFile, 'vehicle-photos/left')
      if (vehicleRightFile) vehicleRightUrl = await uploadDriverDocument(vehicleRightFile, 'vehicle-photos/right')
      if (vehicleInteriorFrontFile) vehicleInteriorFrontUrl = await uploadDriverDocument(vehicleInteriorFrontFile, 'vehicle-photos/interior-front')
      if (vehicleInteriorBackFile) vehicleInteriorBackUrl = await uploadDriverDocument(vehicleInteriorBackFile, 'vehicle-photos/interior-back')
      if (vehicleTrunkFile) vehicleTrunkUrl = await uploadDriverDocument(vehicleTrunkFile, 'vehicle-photos/trunk')
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
        vehicle_type: vehicleType,
        license_front_url: licenseFrontUrl,
        license_back_url: licenseBackUrl,
        vehicle_make: vehicleMake,
        vehicle_model: vehicleModel,
        vehicle_year: Number(vehicleYear),
        vehicle_plate: vehiclePlate,
        vehicle_color: vehicleColor,
        vehicle_seats: Number(vehicleSeats),
        requested_service_levels: [],
        insurance_card_url: insuranceCardUrl,
        driver_photo_url: driverPhotoUrl,
        vehicle_registration_url: registrationUrl,
        vehicle_photo_front_url: vehicleFrontUrl,
        vehicle_photo_back_url: vehicleBackUrl,
        vehicle_photo_left_url: vehicleLeftUrl,
        vehicle_photo_right_url: vehicleRightUrl,
        vehicle_photo_interior_front_url: vehicleInteriorFrontUrl,
        vehicle_photo_interior_back_url: vehicleInteriorBackUrl,
        vehicle_photo_trunk_url: vehicleTrunkUrl,
        onboarding_status: 'pending_review',
        background_check_status: 'pending',
        vehicle_service_status: 'pending',
        approved_service_levels: [],
        vehicle_reviewed_at: null,
        vehicle_rejected_at: null,
        vehicle_rejection_reason: null,
        vehicle_suspended_at: null,
        is_online: false,
        availability_status: 'offline',
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
    setDriverPhotoFile(null)
    setRegistrationFile(null)
    setVehicleFrontFile(null)
    setVehicleBackFile(null)
    setVehicleLeftFile(null)
    setVehicleRightFile(null)
    setVehicleInteriorFrontFile(null)
    setVehicleInteriorBackFile(null)
    setVehicleTrunkFile(null)
    setMessage('Onboarding submitted for review.')
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

  function validateDriverCanWork(actionText) {
    if (driverProfile?.onboarding_status !== 'approved') {
      setMessage(`Complete onboarding and wait for approval before ${actionText}.`)
      return false
    }

    if ((driverProfile?.deactivation_status || 'active') !== 'active') {
      setMessage('This driver account is not active.')
      return false
    }

    if (driverProfile?.identity_verification_status !== 'cleared') {
      setMessage('Identity verification is required.')
      return false
    }

    if (driverProfile?.background_check_status !== 'passed') {
      setMessage('Background check approval is required.')
      return false
    }

    if (
      driverProfile?.vehicle_service_status !== 'approved' ||
      !Array.isArray(driverProfile?.approved_service_levels) ||
      driverProfile.approved_service_levels.length === 0
    ) {
      setMessage('Vehicle approval is required.')
      return false
    }

    return true
  }

  async function goOnline() {
    if (!driverId) return

    if (!validateDriverCanWork('going online')) {
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
        setMessage('You are online.')
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
    setMessage('You are offline.')
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

  function driverCanReceiveRide(rideType) {
    const approvedLevels = Array.isArray(driverProfile?.approved_service_levels)
      ? driverProfile.approved_service_levels
      : []

    const eligibleLevels = eligibleServiceLevelsForRide(rideType)
    return approvedLevels.some((level) => eligibleLevels.includes(level))
  }

  async function acceptRide(ride) {
    if (!driverId) return

    if (!validateDriverCanWork('accepting rides')) {
      return
    }

    if (!driverCanReceiveRide(ride.ride_type)) {
      setMessage('Your vehicle is not approved for this ride type.')
      await loadRideRequests()
      return
    }

    if (status !== 'online') {
      setMessage('Go online before accepting rides.')
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

    await loadRideHistory()
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
    setMessage('Trip completed.')

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

  const availableVehicleModels = vehicleMake
    ? VEHICLE_MODELS_BY_MAKE[vehicleMake] || []
    : []

  const onboardingStatus = driverProfile?.onboarding_status || 'not_started'
  const vehicleServiceStatus = driverProfile?.vehicle_service_status || 'pending'
  const identityStatus = driverProfile?.identity_verification_status || 'not_submitted'
  const backgroundCheckStatus = driverProfile?.background_check_status || 'not_started'
  const deactivationStatus = driverProfile?.deactivation_status || 'active'
  const isApproved = onboardingStatus === 'approved'
  const isPendingReview = onboardingStatus === 'pending_review'
  const isDriverActive = deactivationStatus === 'active'
  const isVehicleApproved =
    vehicleServiceStatus === 'approved' &&
    Array.isArray(driverProfile?.approved_service_levels) &&
    driverProfile.approved_service_levels.length > 0
  const canGoOnline =
    isApproved &&
    isVehicleApproved &&
    identityStatus === 'cleared' &&
    backgroundCheckStatus === 'passed' &&
    isDriverActive

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
                  ? 'Signing in...'
                  : 'Creating account...'
                : authMode === 'login'
                  ? 'Login'
                  : 'Create account'}
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
          {!isApproved && (
            <section className="card">
              <h2>Driver Onboarding</h2>
              <p><strong>Status:</strong> {statusText(onboardingStatus)}</p>

              {isPendingReview ? (
                <p>Your application is under review.</p>
              ) : (
                <>
                  {onboardingStatus === 'rejected' && (
                    <p className="warning">
                      Please review your information and resubmit.
                    </p>
                  )}

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

                  <label>SSN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder={
                      driverProfile?.identity_verification_status === 'cleared'
                        ? 'Verified'
                        : 'Enter 9-digit SSN'
                    }
                    value={ssn}
                    onChange={(e) => setSsn(e.target.value)}
                    disabled={driverProfile?.identity_verification_status === 'cleared'}
                  />

                  <label>Driver Photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setDriverPhotoFile(e.target.files[0])}
                  />
                  {driverProfile?.driver_photo_url && <p>Uploaded.</p>}

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
                  {driverProfile?.license_front_url && <p>Uploaded.</p>}

                  <label>License Back</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setLicenseBackFile(e.target.files[0])}
                  />
                  {driverProfile?.license_back_url && <p>Uploaded.</p>}

                  <label>Vehicle Make</label>
                  <select value={vehicleMake} onChange={(e) => handleVehicleMakeChange(e.target.value)}>
                    <option value="">Select vehicle make</option>
                    {VEHICLE_MAKES.map((make) => (
                      <option key={make} value={make}>
                        {make}
                      </option>
                    ))}
                  </select>

                  <label>Vehicle Model</label>
                  <select
                    value={vehicleModel}
                    onChange={(e) => handleVehicleModelChange(e.target.value)}
                    disabled={!vehicleMake}
                  >
                    <option value="">Select vehicle model</option>
                    {availableVehicleModels.map((item) => (
                      <option key={item.model} value={item.model}>
                        {item.model}
                      </option>
                    ))}
                  </select>

                  <label>Vehicle Type</label>
                  <select value={vehicleType} onChange={(e) => handleVehicleTypeChange(e.target.value)}>
                    {VEHICLE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>

                  <label>Vehicle Year</label>
                  <select value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)}>
                    <option value="">Select vehicle year</option>
                    {VEHICLE_YEAR_OPTIONS.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>

                  <input
                    placeholder="License Plate"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                  />

                  <label>Vehicle Color</label>
                  <select value={vehicleColor} onChange={(e) => setVehicleColor(e.target.value)}>
                    <option value="">Select vehicle color</option>
                    {VEHICLE_COLORS.map((color) => (
                      <option key={color} value={color}>
                        {color}
                      </option>
                    ))}
                  </select>

                  <label>Passenger Seats</label>
                  <select value={vehicleSeats} onChange={(e) => handleVehicleSeatsChange(e.target.value)}>
                    {[4, 5, 6, 7, 8].map((seatCount) => (
                      <option key={seatCount} value={String(seatCount)}>
                        {seatCount} passenger seats
                      </option>
                    ))}
                  </select>

                  <label>Vehicle Registration</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setRegistrationFile(e.target.files[0])}
                  />
                  {driverProfile?.vehicle_registration_url && <p>Uploaded.</p>}

                  <label>Insurance Card</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setInsuranceFile(e.target.files[0])}
                  />
                  {driverProfile?.insurance_card_url && <p>Uploaded.</p>}

                  <div className="ride-card">
                    <h3>Vehicle Photos</h3>

                    <label>Front Photo</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setVehicleFrontFile(e.target.files[0])}
                    />
                    {driverProfile?.vehicle_photo_front_url && <p>Uploaded.</p>}

                    <label>Back Photo</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setVehicleBackFile(e.target.files[0])}
                    />
                    {driverProfile?.vehicle_photo_back_url && <p>Uploaded.</p>}

                    <label>Left Side Photo</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setVehicleLeftFile(e.target.files[0])}
                    />
                    {driverProfile?.vehicle_photo_left_url && <p>Uploaded.</p>}

                    <label>Right Side Photo</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setVehicleRightFile(e.target.files[0])}
                    />
                    {driverProfile?.vehicle_photo_right_url && <p>Uploaded.</p>}

                    <label>Front Interior Photo</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setVehicleInteriorFrontFile(e.target.files[0])}
                    />
                    {driverProfile?.vehicle_photo_interior_front_url && <p>Uploaded.</p>}

                    <label>Back Seat Interior Photo</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setVehicleInteriorBackFile(e.target.files[0])}
                    />
                    {driverProfile?.vehicle_photo_interior_back_url && <p>Uploaded.</p>}

                    <label>Trunk Photo</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setVehicleTrunkFile(e.target.files[0])}
                    />
                    {driverProfile?.vehicle_photo_trunk_url && <p>Uploaded.</p>}
                  </div>

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
            <p><strong>Application:</strong> {statusText(onboardingStatus)}</p>
            <p><strong>Vehicle:</strong> {statusText(vehicleServiceStatus)}</p>
            <p><strong>Identity:</strong> {identityStatus === 'cleared' ? 'Verified' : statusText(identityStatus)}</p>
            <p><strong>Background:</strong> {statusText(backgroundCheckStatus)}</p>
            <p><strong>Account:</strong> {statusText(deactivationStatus)}</p>
            <p><strong>Approved Services:</strong> {formatServiceLevels(driverProfile?.approved_service_levels)}</p>
            <p><strong>Location:</strong> {locationText}</p>

            {!isApproved && (
              <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                Complete Onboarding
              </button>
            )}

            <button type="button" onClick={updateDriverLocation}>
              Update Location
            </button>

            {status === 'online' ? (
              <button type="button" onClick={goOffline} disabled={loading}>
                Go Offline
              </button>
            ) : (
              <button type="button" onClick={goOnline} disabled={loading || !canGoOnline}>
                Go Online
              </button>
            )}

            {!canGoOnline && isApproved && (
              <p className="warning">Your account is not eligible to go online yet.</p>
            )}

            {message && <p>{message}</p>}
          </section>

          <section className="card">
            <h2>Active Ride</h2>

            {activeRide ? (
              <div className="ride-card">
                <p><strong>Status:</strong> {statusText(activeRide.status)}</p>
                <p><strong>Ride Type:</strong> {formatRideType(activeRide.ride_type)}</p>
                <p><strong>Pickup:</strong> {activeRide.pickup_address}</p>
                <p><strong>Destination:</strong> {activeRide.destination_address}</p>
                <p><strong>Estimated Fare:</strong> {formatMoneyFromCents(activeRide.estimated_fare_cents)}</p>

                {activeRide.status === 'accepted' && (
                  <button type="button" onClick={() => updateRideStatus('arrived')}>
                    Mark Arrived
                  </button>
                )}

                {activeRide.status === 'arrived' && (
                  <button type="button" onClick={() => updateRideStatus('in_progress')}>
                    Start Trip
                  </button>
                )}

                {activeRide.status === 'in_progress' && (
                  <button type="button" onClick={completeTrip}>
                    Complete Trip
                  </button>
                )}
              </div>
            ) : (
              <p>No active ride.</p>
            )}
          </section>

          <section className="card">
            <h2>Ride Requests</h2>

            {status !== 'online' && <p>Go online to receive requests.</p>}

            {status === 'online' && rides.length === 0 && <p>No ride requests.</p>}

            {rides.map((ride) => (
              <div className="ride-card" key={ride.id}>
                <p><strong>Ride Type:</strong> {formatRideType(ride.ride_type)}</p>
                <p><strong>Pickup:</strong> {ride.pickup_address}</p>
                <p><strong>Destination:</strong> {ride.destination_address}</p>
                <p><strong>Estimated Fare:</strong> {formatMoneyFromCents(ride.estimated_fare_cents)}</p>

                <button type="button" onClick={() => acceptRide(ride)}>
                  Accept
                </button>

                <button type="button" onClick={() => declineRide(ride.id)}>
                  Decline
                </button>
              </div>
            ))}
          </section>

          <section className="card">
            <h2>Performance</h2>
            <p><strong>Trips:</strong> {tripsCompleted}</p>
            <p><strong>Earnings:</strong> ${earnings.toFixed(2)}</p>
            <p>
              <strong>Rating:</strong>{' '}
              {averageRating ? `${averageRating.toFixed(1)} (${ratingsCount})` : 'No ratings yet'}
            </p>
          </section>
        </>
      )}

      {activePage === 'history' && (
        <section className="card">
          <h2>Trip History</h2>

          {rideHistory.length === 0 ? (
            <p>No trips yet.</p>
          ) : (
            rideHistory.map((ride) => (
              <div className="ride-card" key={ride.id}>
                <p><strong>Status:</strong> {statusText(ride.status)}</p>
                <p><strong>Ride Type:</strong> {formatRideType(ride.ride_type)}</p>
                <p><strong>Pickup:</strong> {ride.pickup_address}</p>
                <p><strong>Destination:</strong> {ride.destination_address}</p>
                <p><strong>Fare:</strong> {formatMoneyFromCents(ride.final_fare_cents || ride.estimated_fare_cents)}</p>
                <p><strong>Date:</strong> {formatDate(ride.created_at)}</p>
              </div>
            ))
          )}
        </section>
      )}
    </div>
  )
}

export default App
