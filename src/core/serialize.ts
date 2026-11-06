import { createBody, createGalaxy, createSystem, defaultDisplay, defaultEnvironment, defaultNotes, defaultOrbit, defaultRotation } from './defaults'
import { PROJECT_FORMAT, PROJECT_VERSION, type Body, type BodyKind, type Galaxy, type Project, type Route, type StarSystem } from './types'
import { uid } from '@/lib/id'

const KINDS: BodyKind[] = ['star', 'barycenter', 'planet', 'moon', 'belt', 'nebula', 'comet', 'station', 'ship', 'gate', 'marker']

export class ProjectFormatError extends Error {}

export function serializeProject(project: Project, opts: { pretty?: boolean } = {}): string {
  const out: Project = { ...project, format: PROJECT_FORMAT, version: PROJECT_VERSION, updatedAt: Date.now() }
  return JSON.stringify(out, null, opts.pretty === false ? undefined : 1)
}

type Json = Record<string, unknown>
const isObj = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v)

function fill<T>(defaults: T, value: unknown): T {
  if (!isObj(defaults) || !isObj(value)) {
    if (value === undefined || value === null) return defaults
    if (typeof defaults === 'number' && typeof value !== 'number') return defaults
    if (typeof defaults === 'string' && typeof value !== 'string') return defaults
    if (typeof defaults === 'boolean' && typeof value !== 'boolean') return defaults
    if (Array.isArray(defaults) && !Array.isArray(value)) return defaults
    return value as T
  }
  const out: Json = { ...value }
  for (const [k, d] of Object.entries(defaults)) out[k] = fill(d, (value as Json)[k])
  return out as T
}

function repairBody(raw: unknown): Body | null {
  if (!isObj(raw)) return null
  const kind = raw.kind as BodyKind
  if (!KINDS.includes(kind)) return null
  const template = createBody(kind, { id: typeof raw.id === 'string' ? raw.id : uid(kind.slice(0, 3)) })
  const b = fill(template, raw) as Body
  b.orbit = raw.orbit === null || raw.orbit === undefined ? (raw.orbit === null ? null : template.orbit) : fill(defaultOrbit(1), raw.orbit)
  b.rotation = fill(defaultRotation(), raw.rotation)
  b.notes = fill(defaultNotes(), raw.notes)
  if (!Array.isArray(b.tags)) b.tags = []
  return b
}

function repairRoute(raw: unknown): Route | null {
  if (!isObj(raw) || typeof raw.from !== 'string' || typeof raw.to !== 'string') return null
  const d: Route = {
    id: typeof raw.id === 'string' ? raw.id : uid('rte'),
    name: 'Route',
    kind: 'trade',
    from: raw.from,
    to: raw.to,
    color: '#8AB0FF',
    style: 'dashed',
    arc: 0.25,
    animated: true,
    traffic: 1,
    visible: true,
    playerVisible: true,
    notes: '',
  }
  return fill(d, raw)
}

export function repairSystem(raw: unknown): StarSystem {
  if (!isObj(raw)) throw new ProjectFormatError('Système invalide')
  const base = createSystem(typeof raw.name === 'string' ? raw.name : 'Système')
  const sys = fill(base, raw) as StarSystem
  sys.id = typeof raw.id === 'string' ? raw.id : base.id
  sys.display = fill(defaultDisplay(), raw.display)
  sys.environment = fill(defaultEnvironment(), raw.environment)
  sys.view = fill({ time: 0, camera: null }, raw.view) as StarSystem['view']
  const bodies: StarSystem['bodies'] = {}
  if (isObj(raw.bodies)) {
    for (const v of Object.values(raw.bodies)) {
      const b = repairBody(v)
      if (b) bodies[b.id] = b
    }
  }
  for (const b of Object.values(bodies)) if (b.parentId && !bodies[b.parentId]) b.parentId = null
  sys.bodies = bodies
  const routes: StarSystem['routes'] = {}
  if (isObj(raw.routes)) {
    for (const v of Object.values(raw.routes)) {
      const r = repairRoute(v)
      if (r && bodies[r.from] && bodies[r.to]) routes[r.id] = r
    }
  }
  sys.routes = routes
  return sys
}

function repairGalaxy(raw: unknown): Galaxy | null {
  if (!isObj(raw)) return null
  const base = createGalaxy()
  const g = fill(base, raw) as Galaxy
  g.systems = isObj(raw.systems) ? (raw.systems as Galaxy['systems']) : {}
  g.routes = isObj(raw.routes) ? (raw.routes as Galaxy['routes']) : {}
  g.regions = isObj(raw.regions) ? (raw.regions as Galaxy['regions']) : {}
  return g
}

export function parseProject(text: string): Project {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new ProjectFormatError("Le fichier n'est pas un JSON valide.")
  }
  if (!isObj(raw)) throw new ProjectFormatError('Contenu inattendu.')

  if (raw.format === 'astra-universalis-system' || (isObj(raw.bodies) && !isObj(raw.systems))) {
    const sys = repairSystem(isObj(raw.system) ? raw.system : raw)
    return wrapSystem(sys)
  }
  if (raw.format !== PROJECT_FORMAT) throw new ProjectFormatError("Ce fichier n'est pas un projet Astra Universalis.")
  if (typeof raw.version === 'number' && raw.version > PROJECT_VERSION) {
    console.warn(`Projet version ${raw.version} plus récent que l'application (${PROJECT_VERSION}).`)
  }
  const systems: Project['systems'] = {}
  if (isObj(raw.systems)) {
    for (const v of Object.values(raw.systems)) {
      try {
        const s = repairSystem(v)
        systems[s.id] = s
      } catch {
      }
    }
  }
  const order = Array.isArray(raw.systemOrder) ? (raw.systemOrder as unknown[]).filter((x): x is string => typeof x === 'string' && !!systems[x]) : []
  for (const id of Object.keys(systems)) if (!order.includes(id)) order.push(id)
  const active = typeof raw.activeSystemId === 'string' && systems[raw.activeSystemId] ? raw.activeSystemId : order[0] ?? null
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    id: typeof raw.id === 'string' ? raw.id : uid('prj'),
    name: typeof raw.name === 'string' ? raw.name : 'Projet',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
    systems,
    systemOrder: order,
    galaxy: repairGalaxy(raw.galaxy),
    activeSystemId: active,
  }
}

export function wrapSystem(system: StarSystem): Project {
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    id: uid('prj'),
    name: system.name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    systems: { [system.id]: system },
    systemOrder: [system.id],
    galaxy: null,
    activeSystemId: system.id,
  }
}

export function serializeSystem(system: StarSystem): string {
  return JSON.stringify({ format: 'astra-universalis-system', version: PROJECT_VERSION, system }, null, 1)
}
