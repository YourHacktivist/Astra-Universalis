import { createBody, createProject, createRoute, createStarterSystem, defaultOrbit } from '@/core/defaults'
import { createDemoSystem, DEMO_DESIGNATION } from '@/core/demo'
import { buildChildrenMap, descendantIds, illumination, totalLuminosity } from '@/core/hierarchy'
import { equilibriumTemperature, frostLine } from '@/core/physics'
import { moonPreset, planetPreset } from '@/core/planetPresets'
import { parseProject, serializeProject, serializeSystem, wrapSystem } from '@/core/serialize'
import { starPreset } from '@/core/starPresets'
import type { AddKind, Body, BodyKind, Id, Orbit, PlanetType, Project, StarSystem } from '@/core/types'
import { bridge, platform } from '@/lib/platform'
import { getActiveSystem, getProject, useProjectStore } from '@/store/projectStore'
import { simClock, useSimStore } from '@/store/simStore'
import { toast, useUIStore } from '@/store/uiStore'
import * as THREE from 'three'
import { parentScaleInfo, unmapOrbitDistance } from '@/core/scale'
import { cameraApi } from '@/three/scene/CameraRig'
import { parentWorld, solveOrbitAt, type Placement } from '@/three/scene/dragMove'

const AU_PER_KM = 1 / 149_597_870.7

function snapshotView() {
  const cam = cameraApi.getState()
  useProjectStore.getState().updateSystem(
    (s) => {
      s.view.time = simClock.time
      if (cam) s.view.camera = cam
    },
    { viewState: true },
  )
}

function activateLoaded(project: Project) {
  const sys = project.activeSystemId ? project.systems[project.activeSystemId] : null
  useSimStore.getState().setTime(sys?.view.time ?? 0)
  const ui = useUIStore.getState()
  ui.select(null)
  ui.follow(null)
  ui.setMode('system')
  ui.setShowHome(false)
}

export async function confirmDiscardChanges(): Promise<boolean> {
  const st = useProjectStore.getState()
  if (!st.dirty || st.example) return true
  if (bridge && !st.filePath) {
    try {
      snapshotView()
      const project = useProjectStore.getState().project
      await bridge.drafts.save(project.name, serializeProject(project, { pretty: false }))
      toast({ kind: 'info', title: `« ${project.name} » gardé en brouillon`, message: 'Retrouvez-le dans le registre de l’écran d’accueil.' })
      return true
    } catch {
    }
  }
  const choice = await useUIStore.getState().askConfirm({
    title: 'Modifications non enregistrées',
    message: `Le projet « ${st.project.name} » contient des modifications non enregistrées.`,
    actions: [
      { id: 'save', label: 'Enregistrer', tone: 'primary' },
      { id: 'discard', label: 'Ne pas enregistrer', tone: 'danger' },
      { id: 'cancel', label: 'Annuler', tone: 'secondary' },
    ],
    cancelId: 'cancel',
  })
  if (choice === 'cancel') return false
  if (choice === 'save') return await saveProject()
  return true
}

export async function newProject(template: 'empty' | 'demo' | StarSystem = 'empty', opts: { name?: string; example?: boolean } = {}) {
  if (!(await confirmDiscardChanges())) return
  const system = template === 'empty' ? createStarterSystem('Nouveau système') : template === 'demo' ? createDemoSystem() : template
  const project = createProject(opts.name ?? system.name, system)
  useProjectStore.getState().load(project, null, { dirty: false, example: opts.example ?? template === 'demo' })
  activateLoaded(project)
}

export function loadProjectText(text: string, path: string | null) {
  const project = parseProject(text)
  useProjectStore.getState().load(project, path)
  activateLoaded(project)
  if (path) void platform.recentAdd(path, project.name)
  return project
}

export async function openProject() {
  if (!(await confirmDiscardChanges())) return
  try {
    const file = await platform.openProject()
    if (!file) return
    const p = loadProjectText(file.content, file.path)
    toast({ kind: 'success', title: 'Projet ouvert', message: p.name })
  } catch (e) {
    toast({ kind: 'error', title: "Impossible d'ouvrir le fichier", message: (e as Error).message })
  }
}

export async function openRecent(path: string) {
  if (!(await confirmDiscardChanges())) return
  try {
    const file = await platform.readProject(path)
    loadProjectText(file.content, file.path)
  } catch (e) {
    toast({ kind: 'error', title: 'Fichier introuvable', message: path })
    void platform.recentRemove(path)
    void e
  }
}

function safeFileName(name: string) {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim() || 'Projet'
}

export async function saveProject(saveAs = false): Promise<boolean> {
  snapshotView()
  const st = useProjectStore.getState()
  try {
    const content = serializeProject(st.project)
    const res = await platform.saveProject(content, {
      path: st.filePath,
      defaultName: safeFileName(st.project.name),
      saveAs: saveAs || !st.filePath,
    })
    if (!res) return false
    useProjectStore.getState().markSaved(res.path ?? st.filePath)
    if (res.path) void platform.recentAdd(res.path, st.project.name)
    toast({ kind: 'success', title: 'Projet enregistré', message: res.path ?? undefined })
    return true
  } catch (e) {
    toast({ kind: 'error', title: "Échec de l'enregistrement", message: (e as Error).message })
    return false
  }
}

export const saveProjectAs = () => saveProject(true)

export async function exportSystemFile() {
  const sys = getActiveSystem()
  if (!sys) return
  snapshotView()
  const res = await platform.exportText(serializeSystem(getActiveSystem()!), safeFileName(sys.name), 'astra')
  if (res) toast({ kind: 'success', title: 'Système exporté', message: res.path ?? sys.name })
}

export async function importSystemFile() {
  const file = await platform.openProject()
  if (!file) return
  try {
    const p = parseProject(file.content)
    const store = useProjectStore.getState()
    let last: Id | null = null
    for (const id of p.systemOrder) {
      const s = structuredClone(p.systems[id])
      if (store.project.systems[s.id]) s.id = `${s.id}_${Date.now().toString(36)}`
      store.addSystem(s, false)
      last = s.id
    }
    if (last) switchSystem(last)
    toast({ kind: 'success', title: 'Système importé', message: p.name })
  } catch (e) {
    toast({ kind: 'error', title: 'Import impossible', message: (e as Error).message })
  }
}

export function switchSystem(id: Id) {
  snapshotView()
  const p = getProject()
  const sys = p.systems[id]
  if (!sys) return
  useProjectStore.getState().setActiveSystem(id)
  useSimStore.getState().setTime(sys.view.time)
  const ui = useUIStore.getState()
  ui.select(null)
  ui.follow(null)
  ui.setMode('system')
}

export function addSystemToProject(system: StarSystem) {
  snapshotView()
  useProjectStore.getState().addSystem(system, true)
  useSimStore.getState().setTime(system.view.time)
  const ui = useUIStore.getState()
  ui.select(null)
  ui.follow(null)
  ui.setMode('system')
  ui.setShowHome(false)
}

interface AutosavePayload {
  savedAt: number
  filePath: string | null
  dirty: boolean
  example?: boolean
  project: string
}

export async function writeAutosave() {
  const st = useProjectStore.getState()
  snapshotView()
  const payload: AutosavePayload = {
    savedAt: Date.now(),
    filePath: st.filePath,
    dirty: st.dirty,
    example: st.example,
    project: serializeProject(useProjectStore.getState().project, { pretty: false }),
  }
  await platform.autosaveWrite(JSON.stringify(payload))
}

export interface RestoredSession {
  project: Project
  filePath: string | null
  dirty: boolean
  example: boolean
  savedAt: number
}

export async function readAutosave(): Promise<RestoredSession | null> {
  const text = await platform.autosaveRead()
  if (!text) return null
  try {
    const payload = JSON.parse(text) as AutosavePayload
    const project = parseProject(payload.project)
    const example =
      payload.example ?? (!payload.filePath && Object.values(project.systems).every((s) => s.designation === DEMO_DESIGNATION))
    return { project, filePath: payload.filePath, dirty: payload.dirty, example, savedAt: payload.savedAt }
  } catch {
    return null
  }
}

export function restoreSession(s: Pick<RestoredSession, 'project' | 'filePath' | 'dirty' | 'example'>) {
  useProjectStore.getState().load(s.project, s.filePath, { dirty: s.dirty, example: s.example })
  activateLoaded(s.project)
}

function rootLuminous(system: StarSystem): Body | null {
  const roots = Object.values(system.bodies).filter((b) => b.parentId === null && (b.kind === 'star' || b.kind === 'barycenter'))
  return roots[0] ?? null
}

function nearestHost(system: StarSystem, id: Id | null, kinds: BodyKind[]): Body | null {
  let cur = id ? system.bodies[id] : null
  let guard = 0
  while (cur && guard++ < 32) {
    if (kinds.includes(cur.kind)) return cur
    cur = cur.parentId ? system.bodies[cur.parentId] : null
  }
  return null
}

function outermostChildA(system: StarSystem, parentId: Id, kinds?: BodyKind[]): number {
  let a = 0
  for (const b of Object.values(system.bodies)) {
    if (b.parentId !== parentId) continue
    if (kinds && !kinds.includes(b.kind)) continue
    if (b.kind === 'belt') a = Math.max(a, b.props.outer)
    else if (b.orbit && !b.orbit.fixed) a = Math.max(a, b.orbit.a * (1 + b.orbit.e))
  }
  return a
}

function planetTypeForTemperature(t: number, aAU: number, frost: number): PlanetType {
  if (t > 1100) return 'lava'
  if (aAU > frost * 1.1) return t < 90 ? 'icegiant' : 'gas'
  if (t > 500) return 'barren'
  if (t > 340) return 'desert'
  if (t > 240) return 'terran'
  if (t > 170) return 'arid'
  return 'ice'
}

const rand = (min: number, max: number) => min + Math.random() * (max - min)

export function addBody(kind: AddKind, options: { parentId?: Id | null; select?: boolean; at?: Placement } = {}): Id | null {
  const opts = options.at ? { ...options, parentId: options.at.parentId ?? undefined } : options
  const system = getActiveSystem()
  if (!system) return null
  const selected = useUIStore.getState().selectedId
  const root = rootLuminous(system)
  const bodies: Body[] = []
  let body: Body

  switch (kind) {
    case 'star': {
      if (!root) {
        body = createBody('star', { name: system.name || 'Étoile' })
      } else {
        const a = Math.max(30, outermostChildA(system, root.id) * 1.6)
        body = createBody('star', {
          name: `${root.name} B`,
          parentId: root.id,
          orbit: defaultOrbit(a, { e: 0.2, i: rand(-8, 8), m0: rand(0, 360) }),
          props: starPreset('M', 4, 'V'),
        })
      }
      break
    }
    case 'blackhole': {
      const props = starPreset('BH')
      const rotation = { period: 0, tilt: rand(10, 25), azimuth: rand(0, 360) }
      const color = props.diskColorOuter
      if (!root) body = createBody('star', { name: system.name || 'Trou noir', props, rotation, color })
      else {
        const a = Math.max(30, outermostChildA(system, root.id) * 1.6)
        body = createBody('star', {
          name: `${root.name} X-1`,
          parentId: root.id,
          orbit: defaultOrbit(a, { e: 0.15, i: rand(-8, 8), m0: rand(0, 360) }),
          props,
          rotation,
          color,
        })
      }
      break
    }
    case 'barycenter': {
      body = createBody('barycenter', { name: 'Barycentre', parentId: opts.parentId ?? null })
      break
    }
    case 'planet': {
      const host = (opts.parentId && system.bodies[opts.parentId]) || nearestHost(system, selected, ['star', 'barycenter']) || root
      if (!host) {
        toast({ kind: 'warning', title: "Ajoutez d'abord une étoile" })
        return null
      }
      const last = outermostChildA(system, host.id, ['planet', 'belt'])
      const a = last > 0 ? last * rand(1.45, 1.85) : 0.4 * Math.sqrt(Math.max(0.05, totalLuminosity(system.bodies, host)))
      const lum = totalLuminosity(system.bodies, host)
      const t = equilibriumTemperature(lum, a, 0.3)
      const type = planetTypeForTemperature(t, a, frostLine(lum))
      const n = Object.values(system.bodies).filter((b) => b.parentId === host.id && b.kind === 'planet').length
      body = createBody('planet', {
        name: `${host.name} ${String.fromCharCode(98 + n)}`,
        parentId: host.id,
        orbit: defaultOrbit(Number(a.toFixed(3)), { e: Number(rand(0, 0.06).toFixed(3)), i: Number(rand(0, 3).toFixed(2)), node: rand(0, 360), m0: rand(0, 360) }),
        rotation: { period: type === 'gas' || type === 'icegiant' ? rand(9, 17) : rand(18, 40), tilt: rand(0, 30) },
        props: planetPreset(type),
      })
      break
    }
    case 'moon': {
      const host = (opts.parentId && system.bodies[opts.parentId]) || nearestHost(system, selected, ['planet', 'moon'])
      const planet =
        host ??
        Object.values(system.bodies)
          .filter((b) => b.kind === 'planet')
          .sort((a, b) => (b.kind === 'planet' && a.kind === 'planet' ? b.props.radius - a.props.radius : 0))[0]
      if (!planet || (planet.kind !== 'planet' && planet.kind !== 'moon')) {
        toast({ kind: 'warning', title: 'Sélectionnez une planète', message: 'Une lune doit orbiter autour d’une planète.' })
        return null
      }
      const rKm = planet.props.radius * 6371
      const last = outermostChildA(system, planet.id)
      const minA = rKm * (planet.props.rings.enabled ? planet.props.rings.outer * 1.3 : 3) * AU_PER_KM
      const a = Math.max(minA, last * rand(1.35, 1.7))
      const n = Object.values(system.bodies).filter((b) => b.parentId === planet.id && b.kind === 'moon').length
      const icy = (illumination(system, planet.id).distanceAU ?? 1) > 3
      body = createBody('moon', {
        name: `${planet.name} ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] ?? n + 1}`,
        parentId: planet.id,
        orbit: defaultOrbit(Number(a.toPrecision(4)), { e: rand(0, 0.04), i: rand(0, 4), node: rand(0, 360), m0: rand(0, 360) }),
        props: moonPreset(icy && Math.random() < 0.5 ? 'ice' : 'barren'),
      })
      break
    }
    case 'belt': {
      const host = (opts.parentId && system.bodies[opts.parentId]) || nearestHost(system, selected, ['star', 'barycenter', 'planet']) || root
      if (!host) return null
      if (host.kind === 'planet') {
        const rKm = host.props.radius * 6371
        body = createBody('belt', {
          name: `Débris de ${host.name}`,
          parentId: host.id,
          props: { beltType: 'debris', inner: rKm * 3 * AU_PER_KM, outer: rKm * 4.5 * AU_PER_KM, count: 1200, thickness: 0.03, dust: 0.3 },
        })
      } else {
        const fl = frostLine(totalLuminosity(system.bodies, host))
        const last = outermostChildA(system, host.id, ['planet', 'belt'])
        const inner = Math.max(fl * 0.8, last * 1.25)
        body = createBody('belt', {
          name: last > fl * 3 ? 'Ceinture de Kuiper' : 'Ceinture principale',
          parentId: host.id,
          props: last > fl * 3 ? { beltType: 'kuiper', inner, outer: inner * 1.6, colorA: '#9aa7b8', colorB: '#5c6678', dustColor: '#8fb2d8', thickness: 0.12 } : { inner, outer: inner * 1.4 },
        })
      }
      break
    }
    case 'comet': {
      const host = (opts.parentId && system.bodies[opts.parentId]) || nearestHost(system, selected, ['star', 'barycenter']) || root
      if (!host) return null
      const a = Math.max(5, outermostChildA(system, host.id) * rand(0.6, 1.1))
      body = createBody('comet', {
        name: `C/${new Date().getFullYear()} ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(rand(1, 9))}`,
        parentId: host.id,
        orbit: defaultOrbit(Number(a.toFixed(2)), { e: rand(0.75, 0.95), i: rand(5, 60), node: rand(0, 360), peri: rand(0, 360), m0: rand(330, 360) }),
      })
      break
    }
    case 'station':
    case 'ship': {
      const host = (opts.parentId && system.bodies[opts.parentId]) || nearestHost(system, selected, ['planet', 'moon', 'star', 'barycenter']) || root
      if (!host) return null
      const local = host.kind === 'planet' || host.kind === 'moon'
      const rKm = local ? host.props.radius * 6371 : 0
      const a = local ? (rKm * rand(1.15, 1.6)) * AU_PER_KM : Math.max(0.5, outermostChildA(system, host.id) * rand(0.2, 0.8))
      body = createBody(kind, {
        name: kind === 'station' ? `Station ${host.name}` : 'Nouveau vaisseau',
        parentId: host.id,
        orbit: defaultOrbit(Number(a.toPrecision(4)), { i: rand(0, 25), node: rand(0, 360), m0: rand(0, 360) }),
      })
      break
    }
    case 'gate':
    case 'marker':
    case 'nebula': {
      const host = kind === 'nebula' ? null : (opts.parentId && system.bodies[opts.parentId]) || nearestHost(system, selected, ['planet', 'moon', 'star', 'barycenter']) || root
      const local = host && (host.kind === 'planet' || host.kind === 'moon')
      const edge = root ? outermostChildA(system, root.id) : 10
      const a = kind === 'nebula' ? Math.max(30, edge * 1.6) : local ? host.props.radius * 6371 * 6 * AU_PER_KM : Math.max(3, edge * rand(0.4, 1.1))
      body = createBody(kind, {
        name: kind === 'gate' ? 'Portail de saut' : kind === 'marker' ? "Point d'intérêt" : 'Nébuleuse',
        parentId: host?.id ?? null,
        orbit: defaultOrbit(Number(a.toPrecision(4)), { fixed: true, show: false, m0: rand(0, 360), i: rand(-10, 10) }),
      })
      break
    }
  }
  if (opts.at) placeAt(system, body, opts.at)
  bodies.push(body)
  useProjectStore.getState().addBodies(bodies)
  if (opts.select !== false) {
    useUIStore.getState().select(body.id)
    useUIStore.getState().setInspectorTab('general')
  }
  return body.id
}

function placeAt(system: StarSystem, body: Body, at: Placement) {
  const world = new THREE.Vector3(...at.world)
  const host = body.parentId ? system.bodies[body.parentId] ?? null : null
  if (body.kind === 'belt') {
    const d = world.distanceTo(parentWorld(body.parentId))
    const r = unmapOrbitDistance(d, parentScaleInfo(host, system.display), system.display)
    body.props.inner = Number((r * 0.85).toPrecision(4))
    body.props.outer = Number((r * 1.18).toPrecision(4))
    body.props.inclination = at.i
    body.props.node = at.node
    return
  }
  if (!body.orbit) return
  body.orbit.i = at.i
  body.orbit.node = at.node
  if (body.kind !== 'comet') {
    body.orbit.e = 0
    body.orbit.peri = 0
  }
  const sol = solveOrbitAt(system, body as Body & { orbit: Orbit }, parentWorld(body.parentId), world, simClock.time)
  if (sol) {
    body.orbit.a = Number(sol.a.toPrecision(6))
    body.orbit.m0 = Number(sol.m0.toFixed(3))
  }
}

export function makeBinary(starId: Id) {
  const system = getActiveSystem()
  const star = system?.bodies[starId]
  if (!system || !star || star.kind !== 'star') return
  const bary = createBody('barycenter', { name: `${star.name} AB`, parentId: star.parentId, orbit: star.orbit ? structuredClone(star.orbit) : null })
  const sep = 0.25
  const companion = createBody('star', {
    name: `${star.name} B`,
    parentId: bary.id,
    orbit: defaultOrbit(sep * 0.6, { m0: 180 }),
    props: starPreset('M', 2, 'V'),
  })
  useProjectStore.getState().updateSystem((s) => {
    s.bodies[bary.id] = bary
    s.bodies[companion.id] = companion
    const st = s.bodies[starId]
    st.parentId = bary.id
    st.orbit = defaultOrbit(sep * 0.4, { m0: 0 })
    if (!st.name.endsWith(' A')) st.name = `${st.name} A`
    for (const b of Object.values(s.bodies)) {
      if (b.parentId === starId && (b.kind === 'planet' || b.kind === 'belt' || b.kind === 'comet')) {
        if (!b.orbit || b.orbit.a > sep * 3 || b.kind === 'belt') b.parentId = bary.id
      }
    }
  })
  useUIStore.getState().select(companion.id)
}

export function placeAtLagrange(id: Id, refId: Id, point: 'L4' | 'L5') {
  const system = getActiveSystem()
  const ref = system?.bodies[refId]
  if (!ref?.orbit) return
  useProjectStore.getState().updateBody(id, (b) => {
    b.parentId = ref.parentId
    b.orbit = { ...structuredClone(ref.orbit!), m0: (ref.orbit!.m0 + (point === 'L4' ? 60 : -60) + 360) % 360, fixed: false, show: false, period: null }
  })
  toast({ kind: 'success', title: `Placé au point ${point}`, message: ref.name })
}

export function deleteBodies(ids: Id[]) {
  const system = getActiveSystem()
  if (!system || !ids.length) return
  const all = new Set(ids)
  for (const id of ids) for (const d of descendantIds(system.bodies, id)) all.add(d)
  useProjectStore.getState().removeBodies(ids)
  const ui = useUIStore.getState()
  if (ui.selectedId && all.has(ui.selectedId)) ui.select(null)
  if (ui.followId && all.has(ui.followId)) ui.follow(null)
  const extra = all.size - ids.length
  toast({
    kind: 'info',
    title: ids.length === 1 ? `« ${system.bodies[ids[0]]?.name} » supprimé` : `${ids.length} objets supprimés`,
    message: extra > 0 ? `Ainsi que ${extra} satellite${extra > 1 ? 's' : ''}. Ctrl+Z pour annuler.` : 'Ctrl+Z pour annuler.',
  })
}

export function deleteSelected() {
  const ui = useUIStore.getState()
  if (ui.selectedId) deleteBodies([ui.selectedId])
  else if (ui.selectedRouteId) {
    useProjectStore.getState().removeRoute(ui.selectedRouteId)
    ui.selectRoute(null)
  }
}

export function duplicateSelected() {
  const id = useUIStore.getState().selectedId
  if (!id) return
  const copy = useProjectStore.getState().duplicateBody(id)
  if (copy) useUIStore.getState().select(copy)
}

export function addRoute(from: Id, to: Id) {
  const r = createRoute(from, to)
  const sys = getActiveSystem()
  if (sys) r.name = `${sys.bodies[from]?.name ?? '?'} → ${sys.bodies[to]?.name ?? '?'}`
  useProjectStore.getState().addRoute(r)
  useUIStore.getState().selectRoute(r.id)
  return r.id
}

export function focusBody(id: Id | null = useUIStore.getState().selectedId, follow = true) {
  if (id) useUIStore.getState().requestCamera({ type: 'focus', id, follow })
}

export function frameAll() {
  const ui = useUIStore.getState()
  ui.setMoveTool(false)
  ui.setPlacing(null)
  ui.follow(null)
  ui.requestCamera({ type: 'frame' })
}

export function cameraPreset(preset: 'top' | 'side' | 'iso') {
  useUIStore.getState().requestCamera({ type: 'preset', preset })
}

export function undo() {
  useProjectStore.getState().undo()
}

export function redo() {
  useProjectStore.getState().redo()
}

export function childrenMap() {
  const sys = getActiveSystem()
  return sys ? buildChildrenMap(sys.bodies) : new Map()
}

export { wrapSystem }
