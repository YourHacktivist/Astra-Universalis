export type Id = string
export type Vec3 = [number, number, number]
export type Hex = string

export interface Orbit {
  a: number
  e: number
  i: number
  node: number
  peri: number
  m0: number
  period: number | null
  retrograde: boolean
  fixed: boolean
  show: boolean
}

export interface Rotation {
  period: number
  tilt: number
  azimuth: number
  locked: boolean
  phase: number
}

export interface Notes {
  description: string
  population: string
  faction: string
  atmosphere: string
  hazards: string
  resources: string
  pois: string
  rumors: string
  gm: string
}

export type BodyKind =
  | 'star'
  | 'barycenter'
  | 'planet'
  | 'moon'
  | 'belt'
  | 'nebula'
  | 'comet'
  | 'station'
  | 'ship'
  | 'gate'
  | 'marker'

export type AddKind = BodyKind | 'blackhole'

interface BodyBase<K extends BodyKind, P> {
  id: Id
  kind: K
  name: string
  parentId: Id | null
  order: number
  orbit: Orbit | null
  rotation: Rotation
  visible: boolean
  playerVisible: boolean
  locked: boolean
  showLabel: boolean
  color: Hex
  tags: string[]
  notes: Notes
  seed: number
  props: P
}

export type StarClass =
  | 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M'
  | 'BD'
  | 'WD'
  | 'NS'
  | 'PSR'
  | 'BH'

export type LuminosityClass = 'Ia' | 'Ib' | 'II' | 'III' | 'IV' | 'V'

export interface StarProps {
  starClass: StarClass
  subclass: number
  lumClass: LuminosityClass
  temperature: number
  radius: number
  mass: number
  luminosity: number
  colorOverride: Hex | null
  corona: number
  rays: number
  flare: boolean
  spots: number
  granulation: number
  activity: number
  diskInner: number
  diskOuter: number
  diskColorInner: Hex
  diskColorOuter: Hex
  diskBrightness: number
  beamAngle: number
  beamLength: number
  pulseRate: number
}

export interface BarycenterProps {
  showMarker: boolean
}

export type PlanetType =
  | 'terran'
  | 'ocean'
  | 'jungle'
  | 'desert'
  | 'arid'
  | 'ice'
  | 'lava'
  | 'barren'
  | 'toxic'
  | 'gas'
  | 'icegiant'
  | 'hotjupiter'
  | 'chthonian'
  | 'city'
  | 'exotic'

export interface CloudLayer {
  enabled: boolean
  coverage: number
  color: Hex
  opacity: number
  speed: number
  scale: number
}

export interface AtmosphereLayer {
  enabled: boolean
  color: Hex
  density: number
  height: number
  sunsetColor: Hex
}

export interface RingSystem {
  enabled: boolean
  inner: number
  outer: number
  colorA: Hex
  colorB: Hex
  opacity: number
  bands: number
  tilt: number
}

export interface PlanetProps {
  planetType: PlanetType
  radius: number
  mass: number
  albedo: number
  greenhouse: number
  palette: [Hex, Hex, Hex, Hex, Hex]
  seaLevel: number
  terrainScale: number
  relief: number
  craters: number
  iceCaps: number
  bands: number
  turbulence: number
  storms: number
  emissive: number
  emissiveColor: Hex
  clouds: CloudLayer
  atmosphere: AtmosphereLayer
  rings: RingSystem
}

export type BeltType = 'asteroid' | 'kuiper' | 'debris' | 'ice' | 'dust'

export interface BeltProps {
  beltType: BeltType
  inner: number
  outer: number
  thickness: number
  count: number
  dust: number
  colorA: Hex
  colorB: Hex
  dustColor: Hex
  rockSize: number
  eccentricity: number
  inclination: number
  node: number
  clumping: number
}

export type NebulaType = 'emission' | 'reflection' | 'dark' | 'planetary' | 'remnant' | 'cloud'

export interface NebulaProps {
  nebulaType: NebulaType
  size: number
  shape: Vec3
  colors: [Hex, Hex, Hex]
  density: number
  puffs: number
  turbulence: number
  glow: number
  darkLanes: number
  stars: number
  drift: number
  rotation: Vec3
}

export interface CometProps {
  nucleusKm: number
  comaColor: Hex
  ionColor: Hex
  dustColor: Hex
  tailLength: number
  activity: number
}

export type StationType = 'ring' | 'modular' | 'spindle' | 'outpost' | 'shipyard' | 'refinery' | 'derelict'
export type ShipType = 'freighter' | 'corvette' | 'hauler' | 'shuttle' | 'miner' | 'cruiser' | 'derelict'
export type GateType = 'ring' | 'anomaly' | 'beacon'
export type MarkerType =
  | 'poi'
  | 'distress'
  | 'derelict'
  | 'anomaly'
  | 'danger'
  | 'outpost'
  | 'cache'
  | 'combat'
  | 'unknown'

export interface StationProps {
  stationType: StationType
  size: number
  hullColor: Hex
  accentColor: Hex
  lightsColor: Hex
  spin: number
  damaged: boolean
  lengthM: number
}

export interface ShipProps {
  shipType: ShipType
  size: number
  hullColor: Hex
  engineColor: Hex
  thrusting: boolean
  trail: boolean
  damaged: boolean
  lengthM: number
  transponder: string
}

export interface GateProps {
  gateType: GateType
  size: number
  color: Hex
  active: boolean
  destination: string
}

export interface MarkerProps {
  markerType: MarkerType
  size: number
  pulse: boolean
  code: string
}

export type StarBody = BodyBase<'star', StarProps>
export type BarycenterBody = BodyBase<'barycenter', BarycenterProps>
export type PlanetBody = BodyBase<'planet', PlanetProps>
export type MoonBody = BodyBase<'moon', PlanetProps>
export type BeltBody = BodyBase<'belt', BeltProps>
export type NebulaBody = BodyBase<'nebula', NebulaProps>
export type CometBody = BodyBase<'comet', CometProps>
export type StationBody = BodyBase<'station', StationProps>
export type ShipBody = BodyBase<'ship', ShipProps>
export type GateBody = BodyBase<'gate', GateProps>
export type MarkerBody = BodyBase<'marker', MarkerProps>

export type Body =
  | StarBody
  | BarycenterBody
  | PlanetBody
  | MoonBody
  | BeltBody
  | NebulaBody
  | CometBody
  | StationBody
  | ShipBody
  | GateBody
  | MarkerBody

export type BodyOfKind<K extends BodyKind> = Extract<Body, { kind: K }>
export type PlanetLike = PlanetBody | MoonBody

export type RouteKind = 'trade' | 'patrol' | 'transfer' | 'danger' | 'smuggling' | 'custom'

export interface Route {
  id: Id
  name: string
  kind: RouteKind
  from: Id
  to: Id
  color: Hex
  style: 'solid' | 'dashed' | 'dotted'
  arc: number
  animated: boolean
  traffic: number
  visible: boolean
  playerVisible: boolean
  notes: string
}

export type ScaleMode = 'linear' | 'compressed' | 'log'

export interface DisplaySettings {
  scaleMode: ScaleMode
  distanceScale: number
  bodyScale: number
  moonDistanceScale: number
}

export interface EnvironmentSettings {
  starDensity: number
  milkyWay: number
  milkyWayTilt: number
  nebulaColor: Hex
  nebulaColor2: Hex
  nebulaIntensity: number
  ambient: number
  seed: number
}

export interface CalendarSettings {
  epochYear: number
  era: string
}

export interface CameraState {
  position: Vec3
  target: Vec3
}

export interface StarSystem {
  id: Id
  name: string
  designation: string
  description: string
  seed: string
  createdAt: number
  updatedAt: number
  calendar: CalendarSettings
  display: DisplaySettings
  environment: EnvironmentSettings
  bodies: Record<Id, Body>
  routes: Record<Id, Route>
  view: { time: number; camera: CameraState | null }
}

export type GalaxyShape = 'spiral' | 'barred' | 'elliptical' | 'ring' | 'irregular'

export interface GalaxySystemMarker {
  id: Id
  name: string
  position: Vec3
  systemId: Id | null
  starClass: StarClass
  color: Hex
  faction: string
  notes: string
  playerVisible: boolean
  importance: number
}

export type GalaxyRouteKind = 'jump' | 'trade' | 'danger' | 'unknown'

export interface GalaxyRoute {
  id: Id
  from: Id
  to: Id
  kind: GalaxyRouteKind
  label: string
  jump: number
  playerVisible: boolean
}

export interface GalaxyRegion {
  id: Id
  name: string
  center: Vec3
  radius: number
  color: Hex
  notes: string
  playerVisible: boolean
}

export interface Galaxy {
  id: Id
  name: string
  seed: string
  shape: GalaxyShape
  arms: number
  twist: number
  radius: number
  thickness: number
  bulge: number
  bar: number
  coreColor: Hex
  armColor: Hex
  outerColor: Hex
  dustColor: Hex
  dust: number
  starCount: number
  systems: Record<Id, GalaxySystemMarker>
  routes: Record<Id, GalaxyRoute>
  regions: Record<Id, GalaxyRegion>
  view: { camera: CameraState | null }
}

export const PROJECT_FORMAT = 'astra-universalis'
export const PROJECT_VERSION = 1

export interface Project {
  format: typeof PROJECT_FORMAT
  version: number
  id: Id
  name: string
  createdAt: number
  updatedAt: number
  systems: Record<Id, StarSystem>
  systemOrder: Id[]
  galaxy: Galaxy | null
  activeSystemId: Id | null
}
