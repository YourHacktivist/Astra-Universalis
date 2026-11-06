import { blackbodyHex } from '@/lib/color'
import { uid } from '@/lib/id'
import { planetPreset, moonPreset } from './planetPresets'
import { starPreset } from './starPresets'
import {
  PROJECT_FORMAT,
  PROJECT_VERSION,
  type BarycenterProps,
  type BeltProps,
  type Body,
  type BodyKind,
  type BodyOfKind,
  type CometProps,
  type DisplaySettings,
  type EnvironmentSettings,
  type Galaxy,
  type GateProps,
  type Id,
  type MarkerProps,
  type MarkerType,
  type NebulaProps,
  type Notes,
  type Orbit,
  type PlanetProps,
  type Project,
  type Rotation,
  type Route,
  type ShipProps,
  type StarProps,
  type StarSystem,
  type StationProps,
} from './types'

export function defaultNotes(partial: Partial<Notes> = {}): Notes {
  return {
    description: '',
    population: '',
    faction: '',
    atmosphere: '',
    hazards: '',
    resources: '',
    pois: '',
    rumors: '',
    gm: '',
    ...partial,
  }
}

export function defaultRotation(partial: Partial<Rotation> = {}): Rotation {
  return { period: 24, tilt: 0, azimuth: 0, locked: false, phase: 0, ...partial }
}

export function defaultOrbit(a: number, partial: Partial<Orbit> = {}): Orbit {
  return {
    a,
    e: 0,
    i: 0,
    node: 0,
    peri: 0,
    m0: 0,
    period: null,
    retrograde: false,
    fixed: false,
    show: true,
    ...partial,
  }
}

export function defaultDisplay(): DisplaySettings {
  return { scaleMode: 'compressed', distanceScale: 1, bodyScale: 1, moonDistanceScale: 1 }
}

export function defaultEnvironment(seed = 1): EnvironmentSettings {
  return {
    starDensity: 0.6,
    milkyWay: 0.55,
    milkyWayTilt: 28,
    nebulaColor: '#3b2a6e',
    nebulaColor2: '#123a5c',
    nebulaIntensity: 0.35,
    ambient: 0.04,
    seed,
  }
}

export const MARKER_COLORS: Record<MarkerType, string> = {
  poi: '#8AB0FF',
  distress: '#FF7B6B',
  derelict: '#B8A58A',
  anomaly: '#A792FF',
  danger: '#FF5A4A',
  outpost: '#7EE2A8',
  cache: '#E9B96E',
  combat: '#FF8A3A',
  unknown: '#C8CCD8',
}

type PropsOf<K extends BodyKind> = BodyOfKind<K>['props']

const PROPS: { [K in BodyKind]: () => PropsOf<K> } = {
  star: () => starPreset('G', 2, 'V'),
  barycenter: (): BarycenterProps => ({ showMarker: true }),
  planet: () => planetPreset('terran'),
  moon: () => moonPreset('barren'),
  belt: (): BeltProps => ({
    beltType: 'asteroid',
    inner: 2.2,
    outer: 3.3,
    thickness: 0.06,
    count: 2400,
    dust: 0.45,
    colorA: '#8a7f72',
    colorB: '#5a524a',
    dustColor: '#b8a68a',
    rockSize: 1,
    eccentricity: 0.08,
    inclination: 0,
    node: 0,
    clumping: 0,
  }),
  nebula: (): NebulaProps => ({
    nebulaType: 'emission',
    size: 40,
    shape: [1, 0.55, 0.8],
    colors: ['#ff5aa0', '#5a8cff', '#ffcf8a'],
    density: 0.6,
    puffs: 120,
    turbulence: 0.6,
    glow: 1,
    darkLanes: 0.35,
    stars: 12,
    drift: 0.3,
    rotation: [0, 0, 0],
  }),
  comet: (): CometProps => ({
    nucleusKm: 6,
    comaColor: '#cfe8ff',
    ionColor: '#5ab4ff',
    dustColor: '#ffe6b8',
    tailLength: 1,
    activity: 1,
  }),
  station: (): StationProps => ({
    stationType: 'ring',
    size: 1,
    hullColor: '#9aa0aa',
    accentColor: '#E9B96E',
    lightsColor: '#ffd59a',
    spin: 1,
    damaged: false,
    lengthM: 1800,
  }),
  ship: (): ShipProps => ({
    shipType: 'freighter',
    size: 1,
    hullColor: '#8a8f98',
    engineColor: '#7ccbff',
    thrusting: true,
    trail: true,
    damaged: false,
    lengthM: 240,
    transponder: '',
  }),
  gate: (): GateProps => ({ gateType: 'ring', size: 1, color: '#A792FF', active: true, destination: '' }),
  marker: (): MarkerProps => ({ markerType: 'poi', size: 1, pulse: true, code: '' }),
}

function defaultColorFor(kind: BodyKind, props: unknown): string {
  switch (kind) {
    case 'star': {
      const p = props as StarProps
      return p.colorOverride ?? blackbodyHex(p.temperature)
    }
    case 'planet':
    case 'moon':
      return (props as PlanetProps).palette[2]
    case 'belt':
      return '#b8a68a'
    case 'nebula':
      return (props as NebulaProps).colors[0]
    case 'comet':
      return '#9fd8ff'
    case 'station':
      return '#8AB0FF'
    case 'ship':
      return '#E9B96E'
    case 'gate':
      return '#A792FF'
    case 'marker':
      return MARKER_COLORS[(props as MarkerProps).markerType]
    case 'barycenter':
      return '#9AA0B2'
  }
}

const DEFAULT_NAMES: Record<BodyKind, string> = {
  star: 'Étoile',
  barycenter: 'Barycentre',
  planet: 'Planète',
  moon: 'Lune',
  belt: 'Ceinture',
  nebula: 'Nébuleuse',
  comet: 'Comète',
  station: 'Station',
  ship: 'Vaisseau',
  gate: 'Portail',
  marker: 'Balise',
}

export interface CreateBodyInit<K extends BodyKind> {
  id?: Id
  name?: string
  parentId?: Id | null
  order?: number
  orbit?: Orbit | null
  rotation?: Partial<Rotation>
  visible?: boolean
  playerVisible?: boolean
  showLabel?: boolean
  color?: string
  tags?: string[]
  notes?: Partial<Notes>
  seed?: number
  props?: Partial<PropsOf<K>>
}

function defaultRotationFor(kind: BodyKind): Partial<Rotation> {
  switch (kind) {
    case 'star':
      return { period: 609, tilt: 7.25 }
    case 'planet':
      return { period: 24, tilt: 15 }
    case 'moon':
      return { period: 0, locked: true, tilt: 2 }
    case 'station':
      return { period: 0.05 }
    case 'comet':
      return { period: 52 }
    default:
      return { period: 0 }
  }
}

function defaultOrbitFor(kind: BodyKind): Orbit | null {
  switch (kind) {
    case 'star':
    case 'barycenter':
    case 'belt':
      return null
    case 'planet':
      return defaultOrbit(1)
    case 'moon':
      return defaultOrbit(0.0026)
    case 'comet':
      return defaultOrbit(12, { e: 0.86, i: 18, peri: 110 })
    case 'station':
    case 'ship':
      return defaultOrbit(0.0004)
    case 'nebula':
    case 'gate':
    case 'marker':
      return defaultOrbit(12, { fixed: true, show: false })
  }
}

export function createBody<K extends BodyKind>(kind: K, init: CreateBodyInit<K> = {}): BodyOfKind<K> {
  const props = { ...(PROPS[kind]() as object), ...(init.props ?? {}) } as PropsOf<K>
  const body = {
    id: init.id ?? uid(kind.slice(0, 3)),
    kind,
    name: init.name ?? DEFAULT_NAMES[kind],
    parentId: init.parentId ?? null,
    order: init.order ?? 0,
    orbit: init.orbit === undefined ? defaultOrbitFor(kind) : init.orbit,
    rotation: defaultRotation({ ...defaultRotationFor(kind), ...init.rotation }),
    visible: init.visible ?? true,
    playerVisible: init.playerVisible ?? true,
    locked: false,
    showLabel: init.showLabel ?? true,
    color: init.color ?? defaultColorFor(kind, props),
    tags: init.tags ?? [],
    notes: defaultNotes(init.notes),
    seed: init.seed ?? Math.floor(Math.random() * 2147483647),
    props,
  }
  return body as unknown as BodyOfKind<K>
}

export function createRoute(from: Id, to: Id, init: Partial<Route> = {}): Route {
  return {
    id: uid('rte'),
    name: 'Route',
    kind: 'trade',
    from,
    to,
    color: '#8AB0FF',
    style: 'dashed',
    arc: 0.25,
    animated: true,
    traffic: 1,
    visible: true,
    playerVisible: true,
    notes: '',
    ...init,
  }
}

export function createSystem(name = 'Nouveau système', init: Partial<StarSystem> = {}): StarSystem {
  const now = Date.now()
  const seed = init.seed ?? uid().slice(0, 8).toUpperCase()
  const system: StarSystem = {
    id: uid('sys'),
    name,
    designation: '',
    description: '',
    seed,
    createdAt: now,
    updatedAt: now,
    calendar: { epochYear: 2491, era: '' },
    display: defaultDisplay(),
    environment: defaultEnvironment(Math.floor(Math.random() * 1e6)),
    bodies: {},
    routes: {},
    view: { time: 0, camera: null },
    ...init,
  }
  return system
}

export function createStarterSystem(name = 'Nouveau système'): StarSystem {
  const system = createSystem(name)
  const star = createBody('star', { name })
  system.bodies[star.id] = star
  return system
}

export function createGalaxy(name = 'Nouvelle galaxie', seed = uid().slice(0, 8).toUpperCase()): Galaxy {
  return {
    id: uid('gal'),
    name,
    seed,
    shape: 'spiral',
    arms: 4,
    twist: 1.1,
    radius: 50000,
    thickness: 0.05,
    bulge: 0.45,
    bar: 0,
    coreColor: '#ffd9a0',
    armColor: '#9fc0ff',
    outerColor: '#6a7ad8',
    dustColor: '#2a1a14',
    dust: 0.6,
    starCount: 160000,
    systems: {},
    routes: {},
    regions: {},
    view: { camera: null },
  }
}

export function createProject(name = 'Projet sans titre', system?: StarSystem): Project {
  const now = Date.now()
  const sys = system ?? createStarterSystem()
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    id: uid('prj'),
    name,
    createdAt: now,
    updatedAt: now,
    systems: { [sys.id]: sys },
    systemOrder: [sys.id],
    galaxy: null,
    activeSystemId: sys.id,
  }
}

export function cloneBody<T extends Body>(b: T): T {
  return structuredClone(b)
}
