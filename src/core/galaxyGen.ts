import { blackbodyHex, hslHex, mixHex } from '@/lib/color'
import { uid } from '@/lib/id'
import { Rng } from '@/lib/random'
import { createGalaxy } from './defaults'
import { NameGen, FACTIONS } from './names'
import { starPreset } from './starPresets'
import type { Galaxy, GalaxyRegion, GalaxyRoute, GalaxyRouteKind, GalaxyShape, GalaxySystemMarker, StarClass, Vec3 } from './types'

export interface GalaxyGenOptions {
  markers: number
  routes: boolean
  regions: boolean
}

const DEFAULT_OPTS: GalaxyGenOptions = { markers: 28, routes: true, regions: true }

export type GalaxyShapeParams = Pick<Galaxy, 'shape' | 'arms' | 'twist' | 'radius' | 'thickness' | 'bulge' | 'bar'>

export function armStartRadius(g: GalaxyShapeParams) {
  return g.shape === 'barred' ? g.bar * 0.32 * g.radius : g.radius * 0.04
}

export function armAngle(g: GalaxyShapeParams, r: number) {
  const r0 = armStartRadius(g)
  const rr = Math.max(0, r - r0)
  return g.twist * 4.2 * Math.log(1 + (3 * rr) / g.radius)
}

export type GalaxyPointKind = 'bulge' | 'bar' | 'arm' | 'disk' | 'halo' | 'ring' | 'clump'

export interface GalaxySample {
  x: number
  y: number
  z: number
  r: number
  kind: GalaxyPointKind
  armOffset: number
}

export function irregularClumps(g: GalaxyShapeParams, seed: string) {
  const rng = new Rng(`${seed}:clumps`)
  const n = 6 + rng.int(0, 5)
  return Array.from({ length: n }, () => {
    const a = rng.range(0, Math.PI * 2)
    const d = Math.sqrt(rng.float()) * g.radius * 0.6
    return { x: Math.cos(a) * d, z: Math.sin(a) * d, s: g.radius * rng.range(0.08, 0.22), w: rng.range(0.5, 1.5) }
  })
}

export function sampleGalaxy(
  rng: Rng,
  g: GalaxyShapeParams,
  kind: GalaxyPointKind,
  clumps?: { x: number; z: number; s: number; w: number }[],
): GalaxySample {
  const R = g.radius
  const H = R * g.thickness
  switch (kind) {
    case 'bulge': {
      const s = R * (0.06 + 0.12 * g.bulge)
      const r3 = Math.abs(rng.gaussian(0, s)) * (0.4 + rng.float() * 0.9)
      const u = rng.range(-1, 1)
      const t = rng.range(0, Math.PI * 2)
      const k = Math.sqrt(1 - u * u)
      const x = r3 * k * Math.cos(t)
      const z = r3 * k * Math.sin(t)
      const y = r3 * u * 0.62
      return { x, y, z, r: Math.hypot(x, z), kind, armOffset: 0 }
    }
    case 'bar': {
      const L = g.bar * 0.32 * R
      const x = rng.gaussian(0, L * 0.45)
      const z = rng.gaussian(0, L * 0.12)
      const y = rng.gaussian(0, H * 0.6)
      return { x, y, z, r: Math.hypot(x, z), kind, armOffset: 0 }
    }
    case 'halo': {
      const r3 = R * Math.pow(rng.float(), 0.6) * 1.1
      const u = rng.range(-1, 1)
      const t = rng.range(0, Math.PI * 2)
      const k = Math.sqrt(1 - u * u)
      const x = r3 * k * Math.cos(t)
      const z = r3 * k * Math.sin(t)
      return { x, y: r3 * u * 0.5, z, r: Math.hypot(x, z), kind, armOffset: 0 }
    }
    case 'ring': {
      const r = Math.max(0, rng.gaussian(R * 0.62, R * 0.065))
      const t = rng.range(0, Math.PI * 2)
      return { x: Math.cos(t) * r, y: rng.gaussian(0, H * 0.5), z: Math.sin(t) * r, r, kind, armOffset: 0 }
    }
    case 'clump': {
      const c = clumps && clumps.length ? clumps[Math.floor(rng.float() * clumps.length)] : { x: 0, z: 0, s: R * 0.3, w: 1 }
      const x = c.x + rng.gaussian(0, c.s)
      const z = c.z + rng.gaussian(0, c.s)
      return { x, y: rng.gaussian(0, H * 0.8), z, r: Math.hypot(x, z), kind, armOffset: 0 }
    }
    case 'disk': {
      const r = Math.min(R * 1.05, -Math.log(1 - rng.float() * 0.97) * R * 0.3)
      const t = rng.range(0, Math.PI * 2)
      const y = rng.gaussian(0, H * (1 - 0.5 * Math.min(1, r / R)))
      return { x: Math.cos(t) * r, y, z: Math.sin(t) * r, r, kind, armOffset: 0 }
    }
    case 'arm':
    default: {
      if (g.shape === 'elliptical') return sampleGalaxy(rng, g, 'bulge')
      const r0 = armStartRadius(g)
      const r = Math.min(R * 1.02, r0 + -Math.log(1 - rng.float() * 0.95) * (R - r0) * 0.34)
      const arms = Math.max(1, Math.round(g.arms))
      const arm = Math.floor(rng.float() * arms)
      const width = 0.07 + 0.2 * (r / R)
      const off = rng.gaussian(0, width) * (rng.bool(0.65) ? 0.55 : 1.15)
      const t = armAngle(g, r) + (arm / arms) * Math.PI * 2 + off
      const y = rng.gaussian(0, H * (1 - 0.5 * Math.min(1, r / R)))
      return { x: Math.cos(t) * r, y, z: Math.sin(t) * r, r, kind: 'arm', armOffset: off }
    }
  }
}

const MARKER_CLASSES: [StarClass, number][] = [
  ['M', 24], ['K', 22], ['G', 20], ['F', 10], ['A', 6], ['B', 3], ['O', 1], ['WD', 5], ['BD', 2], ['PSR', 2], ['NS', 1], ['BH', 2],
]

export function starClassColor(cls: StarClass): string {
  if (cls === 'BH') return '#A792FF'
  if (cls === 'PSR' || cls === 'NS') return '#8AB0FF'
  return blackbodyHex(starPreset(cls).temperature)
}

const REGION_COLORS = ['#E9B96E', '#8AB0FF', '#7EE2A8', '#FF7B6B', '#A792FF', '#5AD0D8', '#F08AC0']

export function generateGalaxy(
  seed: string,
  name = 'Nouvelle galaxie',
  opts: Partial<GalaxyGenOptions> = {},
  overrides: Partial<Galaxy> = {},
): Galaxy {
  const rng = new Rng(seed)
  const g = createGalaxy(name, seed)
  const shape: GalaxyShape = overrides.shape ?? rng.weighted([['spiral', 40], ['barred', 35], ['elliptical', 7], ['ring', 9], ['irregular', 9]] as [GalaxyShape, number][])
  g.shape = shape
  g.arms = shape === 'barred' ? rng.weighted([[2, 0.7], [3, 0.2], [4, 0.1]] as [number, number][]) : rng.int(2, 5)
  g.twist = Number(rng.range(0.75, 1.55).toFixed(2))
  g.radius = Math.round(rng.range(40000, 70000) / 1000) * 1000
  g.thickness = Number(rng.range(0.03, 0.07).toFixed(3))
  g.bulge = Number((shape === 'elliptical' ? rng.range(0.7, 1) : rng.range(0.3, 0.65)).toFixed(2))
  g.bar = shape === 'barred' ? Number(rng.range(0.35, 0.65).toFixed(2)) : 0
  const hue = rng.range(0.55, 0.68)
  g.coreColor = mixHex('#ffd9a0', hslHex(rng.range(0.07, 0.12), 0.8, 0.78), 0.4)
  g.armColor = hslHex(hue, rng.range(0.45, 0.7), rng.range(0.68, 0.8))
  g.outerColor = hslHex(hue + rng.range(-0.05, 0.08), rng.range(0.4, 0.6), rng.range(0.5, 0.62))
  g.dustColor = '#2a1a14'
  g.dust = Number((shape === 'elliptical' ? 0.1 : rng.range(0.45, 0.85)).toFixed(2))
  Object.assign(g, overrides)
  g.seed = seed
  g.name = name

  const o = { ...DEFAULT_OPTS, ...opts }
  const pop = populateGalaxy(g, `${seed}:pop`, o)
  g.systems = pop.systems
  g.routes = pop.routes
  g.regions = pop.regions
  return g
}

export function populateGalaxy(
  g: Galaxy,
  seed: string,
  opts: Partial<GalaxyGenOptions> = {},
): Pick<Galaxy, 'systems' | 'routes' | 'regions'> {
  const o = { ...DEFAULT_OPTS, ...opts }
  const rng = new Rng(seed)
  const names = new NameGen(rng.fork('names'))
  const R = g.radius
  const clumps = g.shape === 'irregular' ? irregularClumps(g, g.seed) : undefined
  const systems: Galaxy['systems'] = {}
  const list: GalaxySystemMarker[] = []
  const minSpacing = R * 0.035

  if (o.markers > 0 && g.shape !== 'irregular') {
    const core: GalaxySystemMarker = {
      id: uid('gsy'),
      name: rng.pick(['Noyau galactique', 'Le Cœur', 'Abîme central']),
      position: [0, 0, 0],
      systemId: null,
      starClass: 'BH',
      color: starClassColor('BH'),
      faction: '',
      notes: 'Trou noir supermassif au centre de la galaxie. Rayonnement mortel.',
      playerVisible: true,
      importance: 2,
    }
    list.push(core)
  }

  let guard = 0
  while (list.length < o.markers && guard++ < o.markers * 60) {
    const kind = g.shape === 'elliptical' ? 'bulge' : g.shape === 'irregular' ? 'clump' : g.shape === 'ring' ? (rng.bool(0.7) ? 'ring' : 'disk') : rng.bool(0.8) ? 'arm' : 'disk'
    const s = sampleGalaxy(rng, g, kind, clumps)
    if (s.r < R * 0.1 || s.r > R * 0.95) continue
    if (list.some((m) => Math.hypot(m.position[0] - s.x, m.position[2] - s.z) < minSpacing)) continue
    const cls = rng.weighted(MARKER_CLASSES)
    const importance = rng.weighted([[0, 0.6], [1, 0.3], [2, 0.1]] as [number, number][])
    list.push({
      id: uid('gsy'),
      name: names.systemName(),
      position: [Math.round(s.x), Math.round(s.y * 0.3), Math.round(s.z)],
      systemId: null,
      starClass: cls,
      color: starClassColor(cls),
      faction: '',
      notes: '',
      playerVisible: rng.bool(0.88),
      importance,
    })
  }
  for (const m of list) systems[m.id] = m

  const regions: Galaxy['regions'] = {}
  if (o.regions && list.length > 3) {
    const nReg = Math.min(list.length - 1, rng.int(3, 6))
    const candidates = rng.shuffle(list.filter((m) => m.starClass !== 'BH' || m.importance < 2).slice())
    const centres: GalaxySystemMarker[] = []
    for (const c of candidates) {
      if (centres.length >= nReg) break
      if (centres.some((x) => dist(x.position, c.position) < R * 0.3)) continue
      centres.push(c)
    }
    centres.forEach((c, k) => {
      const reg: GalaxyRegion = {
        id: uid('grg'),
        name: names.region(),
        center: [c.position[0], 0, c.position[2]],
        radius: Math.round(R * rng.range(0.12, 0.22)),
        color: REGION_COLORS[k % REGION_COLORS.length],
        notes: '',
        playerVisible: true,
      }
      regions[reg.id] = reg
      const faction = FACTIONS[(rng.int(0, FACTIONS.length - 1) + k) % FACTIONS.length]
      reg.notes = `Sous l’influence de : ${faction}.`
      for (const m of list) if (dist(m.position, reg.center) < reg.radius && !m.faction) m.faction = faction
    })
  }

  const routes: Galaxy['routes'] = {}
  if (o.routes && list.length > 1) {
    const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
    const edges = new Map<string, [GalaxySystemMarker, GalaxySystemMarker]>()
    const inTree = new Set<string>([list[0].id])
    while (inTree.size < list.length) {
      let best: [GalaxySystemMarker, GalaxySystemMarker, number] | null = null
      for (const a of list) {
        if (!inTree.has(a.id)) continue
        for (const b of list) {
          if (inTree.has(b.id)) continue
          const d = dist(a.position, b.position)
          if (!best || d < best[2]) best = [a, b, d]
        }
      }
      if (!best) break
      inTree.add(best[1].id)
      edges.set(key(best[0].id, best[1].id), [best[0], best[1]])
    }
    for (const a of list) {
      const near = list
        .filter((b) => b !== a)
        .map((b) => [b, dist(a.position, b.position)] as const)
        .sort((x, y) => x[1] - y[1])
        .slice(0, 2)
      for (const [b, d] of near) if (d < R * 0.2 && rng.bool(0.45)) edges.set(key(a.id, b.id), [a, b])
    }
    for (const [a, b] of edges.values()) {
      const d = dist(a.position, b.position)
      const sameFaction = a.faction && a.faction === b.faction
      const kind: GalaxyRouteKind = sameFaction && rng.bool(0.45) ? 'trade' : d > R * 0.16 && rng.bool(0.35) ? 'unknown' : rng.bool(0.12) ? 'danger' : 'jump'
      const r: GalaxyRoute = {
        id: uid('grt'),
        from: a.id,
        to: b.id,
        kind,
        label: kind === 'trade' ? `Route ${names.systemName()}` : '',
        jump: Math.min(9, Math.max(1, Math.ceil(d / (R * 0.035)))),
        playerVisible: kind !== 'unknown' || rng.bool(0.5),
      }
      routes[r.id] = r
    }
  }
  return { systems, routes, regions }
}

function dist(a: Vec3, b: Vec3) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

export function markerDistance(a: GalaxySystemMarker, b: GalaxySystemMarker) {
  return dist(a.position, b.position)
}
