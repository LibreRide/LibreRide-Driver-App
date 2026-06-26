export const VEHICLE_TYPES = [
  { value: 'sedan', label: 'Sedan' },
  { value: 'suv', label: 'SUV' },
  { value: 'minivan', label: 'Minivan' },
  { value: 'pickup', label: 'Pickup Truck' },
  { value: 'luxury_sedan', label: 'Luxury Sedan' },
  { value: 'luxury_suv', label: 'Luxury SUV' },
]

export const VEHICLE_COLORS = [
  'Black',
  'White',
  'Silver',
  'Gray',
  'Blue',
  'Red',
  'Brown',
  'Green',
  'Gold',
  'Beige',
  'Orange',
  'Yellow',
  'Other',
]

export const VEHICLE_YEAR_OPTIONS = Array.from(
  { length: new Date().getFullYear() - 2009 + 1 },
  (_, index) => String(new Date().getFullYear() + 1 - index)
)

export const VEHICLE_MAKES = [
  'Toyota',
  'Honda',
  'Nissan',
  'Hyundai',
  'Kia',
  'Ford',
  'Chevrolet',
  'Dodge',
  'Chrysler',
  'Jeep',
  'Mazda',
  'Subaru',
  'Volkswagen',
  'Tesla',
  'Lexus',
  'Acura',
  'Infiniti',
  'BMW',
  'Mercedes-Benz',
  'Audi',
  'Cadillac',
  'Lincoln',
  'Volvo',
  'Other',
]

export const VEHICLE_MODELS_BY_MAKE = {
  Toyota: [
    { model: 'Camry', type: 'sedan', seats: 4 },
    { model: 'Corolla', type: 'sedan', seats: 4 },
    { model: 'Avalon', type: 'sedan', seats: 4 },
    { model: 'Prius', type: 'sedan', seats: 4 },
    { model: 'RAV4', type: 'suv', seats: 4 },
    { model: 'Highlander', type: 'suv', seats: 6 },
    { model: '4Runner', type: 'suv', seats: 5 },
    { model: 'Sienna', type: 'minivan', seats: 7 },
  ],
  Honda: [
    { model: 'Accord', type: 'sedan', seats: 4 },
    { model: 'Civic', type: 'sedan', seats: 4 },
    { model: 'CR-V', type: 'suv', seats: 4 },
    { model: 'HR-V', type: 'suv', seats: 4 },
    { model: 'Pilot', type: 'suv', seats: 6 },
    { model: 'Odyssey', type: 'minivan', seats: 7 },
  ],
  Nissan: [
    { model: 'Altima', type: 'sedan', seats: 4 },
    { model: 'Sentra', type: 'sedan', seats: 4 },
    { model: 'Maxima', type: 'sedan', seats: 4 },
    { model: 'Rogue', type: 'suv', seats: 4 },
    { model: 'Murano', type: 'suv', seats: 4 },
    { model: 'Pathfinder', type: 'suv', seats: 6 },
    { model: 'Armada', type: 'suv', seats: 7 },
  ],
  Hyundai: [
    { model: 'Elantra', type: 'sedan', seats: 4 },
    { model: 'Sonata', type: 'sedan', seats: 4 },
    { model: 'Tucson', type: 'suv', seats: 4 },
    { model: 'Santa Fe', type: 'suv', seats: 5 },
    { model: 'Palisade', type: 'suv', seats: 7 },
  ],
  Kia: [
    { model: 'Forte', type: 'sedan', seats: 4 },
    { model: 'K5', type: 'sedan', seats: 4 },
    { model: 'Sportage', type: 'suv', seats: 4 },
    { model: 'Sorento', type: 'suv', seats: 6 },
    { model: 'Telluride', type: 'suv', seats: 7 },
    { model: 'Carnival', type: 'minivan', seats: 7 },
  ],
  Ford: [
    { model: 'Fusion', type: 'sedan', seats: 4 },
    { model: 'Escape', type: 'suv', seats: 4 },
    { model: 'Edge', type: 'suv', seats: 4 },
    { model: 'Explorer', type: 'suv', seats: 6 },
    { model: 'Expedition', type: 'suv', seats: 7 },
    { model: 'F-150', type: 'pickup', seats: 4 },
  ],
  Chevrolet: [
    { model: 'Malibu', type: 'sedan', seats: 4 },
    { model: 'Equinox', type: 'suv', seats: 4 },
    { model: 'Traverse', type: 'suv', seats: 6 },
    { model: 'Tahoe', type: 'suv', seats: 7 },
    { model: 'Suburban', type: 'suv', seats: 7 },
    { model: 'Silverado', type: 'pickup', seats: 4 },
  ],
  Dodge: [
    { model: 'Charger', type: 'sedan', seats: 4 },
    { model: 'Durango', type: 'suv', seats: 6 },
    { model: 'Grand Caravan', type: 'minivan', seats: 7 },
  ],
  Chrysler: [
    { model: '300', type: 'sedan', seats: 4 },
    { model: 'Pacifica', type: 'minivan', seats: 7 },
    { model: 'Voyager', type: 'minivan', seats: 7 },
  ],
  Jeep: [
    { model: 'Compass', type: 'suv', seats: 4 },
    { model: 'Cherokee', type: 'suv', seats: 4 },
    { model: 'Grand Cherokee', type: 'suv', seats: 5 },
    { model: 'Grand Wagoneer', type: 'luxury_suv', seats: 7 },
  ],
  Mazda: [
    { model: 'Mazda3', type: 'sedan', seats: 4 },
    { model: 'Mazda6', type: 'sedan', seats: 4 },
    { model: 'CX-5', type: 'suv', seats: 4 },
    { model: 'CX-9', type: 'suv', seats: 6 },
    { model: 'CX-90', type: 'suv', seats: 6 },
  ],
  Subaru: [
    { model: 'Legacy', type: 'sedan', seats: 4 },
    { model: 'Impreza', type: 'sedan', seats: 4 },
    { model: 'Forester', type: 'suv', seats: 4 },
    { model: 'Outback', type: 'suv', seats: 4 },
    { model: 'Ascent', type: 'suv', seats: 6 },
  ],
  Volkswagen: [
    { model: 'Jetta', type: 'sedan', seats: 4 },
    { model: 'Passat', type: 'sedan', seats: 4 },
    { model: 'Tiguan', type: 'suv', seats: 5 },
    { model: 'Atlas', type: 'suv', seats: 6 },
  ],
  Tesla: [
    { model: 'Model 3', type: 'luxury_sedan', seats: 4 },
    { model: 'Model S', type: 'luxury_sedan', seats: 4 },
    { model: 'Model X', type: 'luxury_suv', seats: 6 },
    { model: 'Model Y', type: 'luxury_suv', seats: 4 },
  ],
  Lexus: [
    { model: 'ES', type: 'luxury_sedan', seats: 4 },
    { model: 'GS', type: 'luxury_sedan', seats: 4 },
    { model: 'LS', type: 'luxury_sedan', seats: 4 },
    { model: 'RX', type: 'luxury_suv', seats: 4 },
    { model: 'GX', type: 'luxury_suv', seats: 6 },
    { model: 'LX', type: 'luxury_suv', seats: 7 },
  ],
  Acura: [
    { model: 'TLX', type: 'luxury_sedan', seats: 4 },
    { model: 'MDX', type: 'luxury_suv', seats: 6 },
    { model: 'RDX', type: 'luxury_suv', seats: 4 },
  ],
  Infiniti: [
    { model: 'Q50', type: 'luxury_sedan', seats: 4 },
    { model: 'QX50', type: 'luxury_suv', seats: 4 },
    { model: 'QX60', type: 'luxury_suv', seats: 6 },
    { model: 'QX80', type: 'luxury_suv', seats: 7 },
  ],
  BMW: [
    { model: '3 Series', type: 'luxury_sedan', seats: 4 },
    { model: '5 Series', type: 'luxury_sedan', seats: 4 },
    { model: '7 Series', type: 'luxury_sedan', seats: 4 },
    { model: 'X3', type: 'luxury_suv', seats: 4 },
    { model: 'X5', type: 'luxury_suv', seats: 5 },
    { model: 'X7', type: 'luxury_suv', seats: 6 },
  ],
  'Mercedes-Benz': [
    { model: 'C-Class', type: 'luxury_sedan', seats: 4 },
    { model: 'E-Class', type: 'luxury_sedan', seats: 4 },
    { model: 'S-Class', type: 'luxury_sedan', seats: 4 },
    { model: 'GLC', type: 'luxury_suv', seats: 4 },
    { model: 'GLE', type: 'luxury_suv', seats: 5 },
    { model: 'GLS', type: 'luxury_suv', seats: 6 },
  ],
  Audi: [
    { model: 'A4', type: 'luxury_sedan', seats: 4 },
    { model: 'A6', type: 'luxury_sedan', seats: 4 },
    { model: 'A8', type: 'luxury_sedan', seats: 4 },
    { model: 'Q5', type: 'luxury_suv', seats: 4 },
    { model: 'Q7', type: 'luxury_suv', seats: 6 },
    { model: 'Q8', type: 'luxury_suv', seats: 5 },
  ],
  Cadillac: [
    { model: 'CT5', type: 'luxury_sedan', seats: 4 },
    { model: 'XT5', type: 'luxury_suv', seats: 4 },
    { model: 'XT6', type: 'luxury_suv', seats: 6 },
    { model: 'Escalade', type: 'luxury_suv', seats: 7 },
  ],
  Lincoln: [
    { model: 'MKZ', type: 'luxury_sedan', seats: 4 },
    { model: 'Corsair', type: 'luxury_suv', seats: 4 },
    { model: 'Aviator', type: 'luxury_suv', seats: 6 },
    { model: 'Navigator', type: 'luxury_suv', seats: 7 },
  ],
  Volvo: [
    { model: 'S60', type: 'luxury_sedan', seats: 4 },
    { model: 'S90', type: 'luxury_sedan', seats: 4 },
    { model: 'XC60', type: 'luxury_suv', seats: 4 },
    { model: 'XC90', type: 'luxury_suv', seats: 6 },
  ],
  Other: [
    { model: 'Other', type: 'sedan', seats: 4 },
  ],
}

export function getVehicleSuggestion(make, model) {
  const models = VEHICLE_MODELS_BY_MAKE[make] || []
  return models.find((item) => item.model === model) || null
}

export function getSuggestedServiceLevels(vehicle) {
  if (!vehicle) return ['regular']

  const seats = Number(vehicle.seats || 4)
  const type = vehicle.type || 'sedan'

  if (type === 'luxury_suv' && seats >= 6) {
    return ['regular', 'xl', 'premium', 'premium_xl']
  }

  if (type === 'luxury_suv') {
    return ['regular', 'premium']
  }

  if (type === 'luxury_sedan') {
    return ['regular', 'premium']
  }

  if (type === 'minivan' || seats >= 6) {
    return ['regular', 'xl']
  }

  return ['regular']
}