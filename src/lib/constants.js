// Shared PartVault product version — keep in sync with the admin app on every ship.
export const APP_VERSION = '3.36.71'

export const EDGE_FN = 'https://mtpektsxaklhedknincs.supabase.co/functions/v1/ebay-import'

// Design tokens (mirrors the :root block in index.css — one system, two
// surfaces). Field-app rules: text read outdoors uses `muted` (8.65:1) or
// darker, never lighter; the accent passed WCAG as a fill (#BD400B, was
// #e8590c at 3.58:1); `borderControl` identifies inputs/secondary buttons
// (3:1, WCAG 1.4.11) while `border` stays decorative.
export const C = {
  bg: '#F5F4F0', card: '#FFFFFF', border: '#D6D2C4', borderControl: '#8E8674',
  accent: '#BD400B', accentHover: '#9E350A', accentSoft: '#FBEDE4', accentOnDark: '#FF8A4C',
  blue: '#2B5378', green: '#2C6B3E',
  red: '#A33128', yellow: '#8A5B0F', text: '#17150F', muted: '#4A453B',
  white: '#ffffff', headerBg: '#17150F',
}

export const PART_CONDITIONS = ['New', 'New – Aftermarket', 'Used – Excellent', 'Used – Good', 'Used – Fair', 'Refurbished', 'For Parts Only']

// How a store gets its stock — see the admin constants for the full note.
// Kept identical across both apps. Stored in stores.settings.sourcing.
export const SOURCING_MODES = {
  dismantle: { id: 'dismantle', label: 'Dismantle vehicles', blurb: 'You pull parts from cars you buy and break.' },
  buyin: { id: 'buyin', label: 'Buy parts in', blurb: 'You buy stock (new, aftermarket or used) to resell — no donor cars.' },
  both: { id: 'both', label: 'Both', blurb: 'You dismantle cars and also buy some parts in.' },
}
export const DEFAULT_SOURCING = 'dismantle'
export const sourcingMode = (settings) => SOURCING_MODES[settings?.sourcing]?.id || DEFAULT_SOURCING
export const usesCars = (settings) => sourcingMode(settings) !== 'buyin'

export const EBAY_AU_CATEGORIES = {
  'Air & Fuel Delivery': ['Air Filters', 'Carburettors & Parts', 'Fuel Filters', 'Fuel Injectors', 'Fuel Pumps', 'Intercoolers', 'Throttle Bodies', 'Turbochargers & Parts', 'Other'],
  'Air Conditioning & Heating': ['A/C Compressors', 'A/C Condensers', 'Blower Motors', 'Evaporators', 'Heater Cores', 'Pollen Filters', 'Other'],
  'Brakes & Brake Parts': ['Brake Disc Rotors', 'Brake Drums', 'Brake Pads', 'Brake Shoes', 'Calipers & Brackets', 'Master Cylinders', 'Brake Hoses', 'ABS Sensors', 'Other'],
  'Engines & Engine Parts': ['Complete Engines', 'Cylinder Heads', 'Engine Mounts', 'Oil Pumps', 'Timing Belts & Kits', 'Valve Covers', 'Water Pumps', 'Other'],
  'Engine Cooling': ['Radiators', 'Water Pumps', 'Thermostats', 'Cooling Fans', 'Oil Coolers', 'Other'],
  'Exhaust & Emission': ['Catalytic Converters', 'DPF Filters', 'EGR Valves', 'Exhaust Manifolds', 'Mufflers', 'Exhaust Pipes', 'Other'],
  'Exterior Parts': ['Bumper Bars', 'Door Mirrors', 'Door Panels', 'Fenders / Guards', 'Grilles', 'Bonnet / Hood', 'Boot Lid', 'Other'],
  'Ignition Systems': ['Coil Packs', 'Glow Plugs', 'Ignition Coils', 'Spark Plugs', 'Distributor', 'Other'],
  'Interior Parts': ['Dashboards', 'Door Cards', 'Instrument Clusters', 'Seats', 'Seat Belts', 'Steering Wheels', 'Window Regulators', 'Other'],
  'Lighting & Bulbs': ['Headlight Assemblies', 'Tail Lights', 'Fog Lights', 'Indicators', 'DRL', 'Other'],
  'Starters, Alternators & Wiring': ['Alternators', 'ECUs', 'Fuse Boxes', 'Starter Motors', 'Wiring Looms', 'Other'],
  'Steering & Suspension': ['Ball Joints', 'Coil Springs', 'Control Arms', 'Power Steering Pumps', 'Shock Absorbers', 'Tie Rod Ends', 'Wheel Bearings', 'Other'],
  'Transmission & Drivetrain': ['Clutch Kits', 'CV Boots', 'Driveshafts', 'Gearboxes -- Auto', 'Gearboxes -- Manual', 'Transfer Cases', 'Other'],
  'Wheels, Tyres & Parts': ['Tyres', 'Wheels -- Alloy', 'Wheels -- Steel', 'Wheel Nuts', 'Other'],
  'Towing Parts': ['Tow Bars', 'Trailer Sockets', 'Other'],
  'Other Car & Truck Parts': ['Other'],
}

export const CATEGORY_NAMES = Object.keys(EBAY_AU_CATEGORIES)

// Superset across marketplaces (AU + US/CA + UK makes) so any region's cars are
// selectable. Alphabetical; 'Other' last.
export const MAKES = [
  'Acura','Alfa Romeo','Aston Martin','Audi','Bentley','BMW','Buick','Cadillac','Chevrolet',
  'Chrysler','Citroen','Dacia','Daihatsu','Dodge','Fiat','Ford','Genesis','GMC','GWM','Haval',
  'Holden','Honda','Hummer','Hyundai','Infiniti','Isuzu','Jaguar','Jeep','Kia','Land Rover',
  'LDV','Lexus','Lincoln','Lotus','Mazda','Mercedes-Benz','Mercury','MG','MINI','Mitsubishi',
  'Nissan','Oldsmobile','Peugeot','Pontiac','Porsche','RAM','Renault','Rolls-Royce','Rover',
  'Saab','Saturn','Scion','SEAT','Skoda','SsangYong','Subaru','Suzuki','Tesla','Toyota',
  'Vauxhall','Volkswagen','Volvo','Other',
]

// Region-prioritised make order for the car dropdown — local makes first so
// yard capture is fast (US sees Ford/Chevy up top, not alphabetical Acura).
const REGION_PRIORITY = {
  EBAY_US: ['Ford','Chevrolet','Toyota','Honda','RAM','GMC','Jeep','Nissan','Dodge','Hyundai','Kia','Subaru','BMW','Mercedes-Benz','Chrysler','Cadillac','Buick','Lincoln','Acura','Infiniti','Tesla'],
  EBAY_GB: ['Ford','Vauxhall','Volkswagen','BMW','Audi','Mercedes-Benz','Toyota','Nissan','Peugeot','Renault','Citroen','MINI','Land Rover','Kia','Hyundai','Skoda','SEAT','Mazda'],
  EBAY_AU: ['Toyota','Ford','Holden','Mazda','Hyundai','Kia','Mitsubishi','Nissan','Subaru','Honda','Volkswagen','BMW','Mercedes-Benz','Isuzu'],
}
export function makesFor(mp) {
  const pri = REGION_PRIORITY[mp] || (mp === 'EBAY_CA' ? REGION_PRIORITY.EBAY_US : REGION_PRIORITY.EBAY_AU)
  const top = pri.filter(m => MAKES.includes(m))
  const rest = MAKES.filter(m => m !== 'Other' && !top.includes(m))
  return [...top, ...rest, 'Other']
}
