import type { AtmosphereLayer, CloudLayer, Hex, PlanetProps, PlanetType, RingSystem } from './types'

type Preset = Omit<PlanetProps, 'clouds' | 'atmosphere' | 'rings'> & {
  clouds: Partial<CloudLayer>
  atmosphere: Partial<AtmosphereLayer>
}

const NO_RINGS: RingSystem = {
  enabled: false,
  inner: 1.3,
  outer: 2.3,
  colorA: '#d9c7a4',
  colorB: '#8f7c62',
  opacity: 0.8,
  bands: 0.6,
  tilt: 0,
}

const CLOUDS: CloudLayer = { enabled: true, coverage: 0.5, color: '#ffffff', opacity: 0.9, speed: 0.15, scale: 1 }
const ATMO: AtmosphereLayer = { enabled: true, color: '#6fa8ff', density: 0.6, height: 0.05, sunsetColor: '#ff9a5a' }

const P = (palette: Hex[]) => palette as [Hex, Hex, Hex, Hex, Hex]

const PRESETS: Record<PlanetType, Preset> = {
  terran: {
    planetType: 'terran', radius: 1, mass: 1, albedo: 0.3, greenhouse: 33,
    palette: P(['#0b2346', '#1d5a7a', '#3f6b34', '#8a7a5a', '#f0f2f5']),
    seaLevel: 0.58, terrainScale: 1, relief: 0.5, craters: 0, iceCaps: 0.35,
    bands: 0, turbulence: 0.35, storms: 0.15, emissive: 0.35, emissiveColor: '#ffc677',
    clouds: { coverage: 0.55 }, atmosphere: { color: '#6fa8ff', density: 0.6 },
  },
  ocean: {
    planetType: 'ocean', radius: 1.3, mass: 1.8, albedo: 0.28, greenhouse: 40,
    palette: P(['#071a3a', '#14507a', '#4a7a4a', '#c9b88a', '#e9eef2']),
    seaLevel: 0.9, terrainScale: 1.3, relief: 0.35, craters: 0, iceCaps: 0.2,
    bands: 0, turbulence: 0.45, storms: 0.4, emissive: 0.1, emissiveColor: '#ffd28a',
    clouds: { coverage: 0.66, scale: 1.2 }, atmosphere: { color: '#7ab3ff', density: 0.7 },
  },
  jungle: {
    planetType: 'jungle', radius: 1.1, mass: 1.25, albedo: 0.22, greenhouse: 45,
    palette: P(['#0b2b3a', '#1b5d5e', '#1f4d1d', '#4f7a2a', '#8a8a6a']),
    seaLevel: 0.35, terrainScale: 1.4, relief: 0.55, craters: 0, iceCaps: 0.05,
    bands: 0, turbulence: 0.4, storms: 0.2, emissive: 0.05, emissiveColor: '#c8ff9a',
    clouds: { coverage: 0.62, scale: 0.8 }, atmosphere: { color: '#8fd0ff', density: 0.72 },
  },
  desert: {
    planetType: 'desert', radius: 0.9, mass: 0.75, albedo: 0.38, greenhouse: 15,
    palette: P(['#7a4a28', '#b8834a', '#e0b878', '#8a6a4a', '#efe2c8']),
    seaLevel: 0.02, terrainScale: 1.1, relief: 0.6, craters: 0.1, iceCaps: 0.05,
    bands: 0, turbulence: 0.6, storms: 0.1, emissive: 0.15, emissiveColor: '#ffc677',
    clouds: { coverage: 0.12, opacity: 0.6 }, atmosphere: { color: '#ffcf9a', density: 0.35, sunsetColor: '#ff7a3a' },
  },
  arid: {
    planetType: 'arid', radius: 0.53, mass: 0.107, albedo: 0.25, greenhouse: 5,
    palette: P(['#4a352e', '#8f5a3c', '#c08a62', '#a07858', '#f2ece4']),
    seaLevel: 0, terrainScale: 1, relief: 0.7, craters: 0.35, iceCaps: 0.25,
    bands: 0, turbulence: 0.5, storms: 0.05, emissive: 0, emissiveColor: '#ffc677',
    clouds: { enabled: false, coverage: 0.08, opacity: 0.4 }, atmosphere: { color: '#e8a070', density: 0.22, height: 0.03, sunsetColor: '#7ab3ff' },
  },
  ice: {
    planetType: 'ice', radius: 0.8, mass: 0.4, albedo: 0.65, greenhouse: 0,
    palette: P(['#7a5646', '#b8cfdc', '#e4ebee', '#f2f5f6', '#ffffff']),
    seaLevel: 0, terrainScale: 1.2, relief: 0.45, craters: 0.15, iceCaps: 0,
    bands: 0, turbulence: 0.3, storms: 0, emissive: 0, emissiveColor: '#9fd8ff',
    clouds: { enabled: false, coverage: 0.1 }, atmosphere: { color: '#bfe0ff', density: 0.15, height: 0.03 },
  },
  lava: {
    planetType: 'lava', radius: 0.9, mass: 0.85, albedo: 0.1, greenhouse: 60,
    palette: P(['#120a08', '#2a1610', '#4a3a34', '#ff5a1a', '#ffd27a']),
    seaLevel: 0.2, terrainScale: 1.3, relief: 0.65, craters: 0.05, iceCaps: 0,
    bands: 0, turbulence: 0.7, storms: 0, emissive: 1, emissiveColor: '#ff6a22',
    clouds: { enabled: false, coverage: 0.15, color: '#4a3a34', opacity: 0.6 }, atmosphere: { color: '#ff8a4a', density: 0.3, sunsetColor: '#ffcf6a' },
  },
  barren: {
    planetType: 'barren', radius: 0.38, mass: 0.055, albedo: 0.12, greenhouse: 0,
    palette: P(['#3a3a3c', '#6e6c6a', '#9a9894', '#b8b4ae', '#dcd8d0']),
    seaLevel: 0, terrainScale: 1, relief: 0.75, craters: 0.8, iceCaps: 0,
    bands: 0, turbulence: 0.2, storms: 0, emissive: 0, emissiveColor: '#ffc677',
    clouds: { enabled: false, coverage: 0 }, atmosphere: { enabled: false, color: '#9aa0b2', density: 0.05 },
  },
  toxic: {
    planetType: 'toxic', radius: 0.95, mass: 0.815, albedo: 0.75, greenhouse: 500,
    palette: P(['#6a5022', '#a8803a', '#d8b86a', '#c09a50', '#f0e0a8']),
    seaLevel: 0, terrainScale: 0.8, relief: 0.3, craters: 0.05, iceCaps: 0,
    bands: 6, turbulence: 0.75, storms: 0.2, emissive: 0, emissiveColor: '#ffb04a',
    clouds: { coverage: 0.92, color: '#e8d49a', opacity: 0.95, speed: 0.6, scale: 0.6 }, atmosphere: { color: '#f0c870', density: 0.9, height: 0.07, sunsetColor: '#ff9a3a' },
  },
  gas: {
    planetType: 'gas', radius: 11.2, mass: 318, albedo: 0.34, greenhouse: 0,
    palette: P(['#c9a27a', '#e8d6b8', '#a8724a', '#7a5a40', '#c8583a']),
    seaLevel: 0, terrainScale: 1, relief: 0.05, craters: 0, iceCaps: 0,
    bands: 14, turbulence: 0.55, storms: 0.5, emissive: 0, emissiveColor: '#ffb04a',
    clouds: { enabled: false, coverage: 0 }, atmosphere: { color: '#e8c8a0', density: 0.4, height: 0.03, sunsetColor: '#ff9a5a' },
  },
  icegiant: {
    planetType: 'icegiant', radius: 4, mass: 15, albedo: 0.3, greenhouse: 0,
    palette: P(['#5ab0c8', '#7fd0e0', '#3a8aa8', '#a8e0ea', '#2a5a8a']),
    seaLevel: 0, terrainScale: 1, relief: 0.03, craters: 0, iceCaps: 0,
    bands: 8, turbulence: 0.25, storms: 0.25, emissive: 0, emissiveColor: '#9fe8ff',
    clouds: { enabled: false, coverage: 0 }, atmosphere: { color: '#9fe8ff', density: 0.5, height: 0.04, sunsetColor: '#bfe6ff' },
  },
  hotjupiter: {
    planetType: 'hotjupiter', radius: 13, mass: 250, albedo: 0.05, greenhouse: 0,
    palette: P(['#3a1a12', '#7a3a22', '#b8582a', '#2a1410', '#ff9a4a']),
    seaLevel: 0, terrainScale: 1, relief: 0.05, craters: 0, iceCaps: 0,
    bands: 10, turbulence: 0.7, storms: 0.6, emissive: 0.45, emissiveColor: '#ff5a2a',
    clouds: { enabled: false, coverage: 0 }, atmosphere: { color: '#ff9a5a', density: 0.55, height: 0.05, sunsetColor: '#ffd08a' },
  },
  chthonian: {
    planetType: 'chthonian', radius: 1.8, mass: 8, albedo: 0.08, greenhouse: 0,
    palette: P(['#1a1614', '#3a302a', '#6a4a3a', '#ff6a2a', '#ffc07a']),
    seaLevel: 0.15, terrainScale: 1.1, relief: 0.6, craters: 0.3, iceCaps: 0,
    bands: 0, turbulence: 0.5, storms: 0, emissive: 0.6, emissiveColor: '#ff6a2a',
    clouds: { enabled: false, coverage: 0 }, atmosphere: { enabled: false, color: '#ff8a4a', density: 0.1 },
  },
  city: {
    planetType: 'city', radius: 1.05, mass: 1.1, albedo: 0.25, greenhouse: 40,
    palette: P(['#1a1c22', '#2a2e36', '#5a606a', '#8a909a', '#ffd08a']),
    seaLevel: 0.1, terrainScale: 2, relief: 0.35, craters: 0, iceCaps: 0.05,
    bands: 0, turbulence: 0.2, storms: 0, emissive: 1, emissiveColor: '#ffcf80',
    clouds: { coverage: 0.3, color: '#c8ccd4', opacity: 0.7 }, atmosphere: { color: '#a0b8d8', density: 0.5, sunsetColor: '#ff9a6a' },
  },
  exotic: {
    planetType: 'exotic', radius: 1.2, mass: 1.6, albedo: 0.4, greenhouse: 20,
    palette: P(['#1a0a2a', '#5a1a8a', '#a04ad8', '#40e0d0', '#f0c0ff']),
    seaLevel: 0.3, terrainScale: 1.5, relief: 0.6, craters: 0, iceCaps: 0,
    bands: 0, turbulence: 0.8, storms: 0.1, emissive: 0.6, emissiveColor: '#c070ff',
    clouds: { coverage: 0.2, color: '#e0c8ff', opacity: 0.6 }, atmosphere: { color: '#c88aff', density: 0.6, sunsetColor: '#40e0d0' },
  },
}

export function planetPreset(type: PlanetType): PlanetProps {
  const p = PRESETS[type]
  return {
    ...p,
    palette: [...p.palette] as PlanetProps['palette'],
    clouds: { ...CLOUDS, ...p.clouds },
    atmosphere: { ...ATMO, ...p.atmosphere },
    rings: { ...NO_RINGS },
  }
}

export function moonPreset(type: PlanetType = 'barren'): PlanetProps {
  const p = planetPreset(type)
  if (type === 'barren') {
    p.radius = 0.27
    p.mass = 0.0123
  } else {
    p.radius = Math.min(p.radius, 0.45)
    p.mass = Math.min(p.mass, 0.03)
  }
  return p
}

export function isGiant(type: PlanetType) {
  return type === 'gas' || type === 'icegiant' || type === 'hotjupiter'
}

export function hasSurface(type: PlanetType) {
  return !isGiant(type)
}
