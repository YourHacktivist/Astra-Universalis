import { addSystemToProject, switchSystem } from '@/app/actions'
import { DEFAULT_GENERATOR_OPTIONS, generateSystem } from '@/core/generator'
import { generateGalaxy, markerDistance, populateGalaxy, starClassColor } from '@/core/galaxyGen'
import { NameGen } from '@/core/names'
import type { Galaxy, GalaxyRegion, GalaxyRoute, GalaxySystemMarker, StarClass } from '@/core/types'
import { uid } from '@/lib/id'
import { randomSeedString, Rng } from '@/lib/random'
import { useProjectStore } from '@/store/projectStore'
import { toast, useUIStore } from '@/store/uiStore'
import { useGalaxyUI, GALAXY_SCALE as S } from './galaxyStore'

const galaxy = () => useProjectStore.getState().project.galaxy
const update = (recipe: (g: Galaxy) => void, coalesce?: string) => useProjectStore.getState().updateGalaxy(recipe, coalesce ? { coalesce } : undefined)

export function createNewGalaxy(populated = true) {
  const seed = randomSeedString()
  const names = new NameGen(new Rng(seed))
  const g = generateGalaxy(seed, `Galaxie ${names.systemName()}`, { markers: populated ? 28 : 0, routes: populated, regions: populated })
  useProjectStore.getState().setGalaxy(g)
  useGalaxyUI.getState().select(null)
  useGalaxyUI.getState().requestCamera({ type: 'frame', instant: true })
}

export function regenerateShape() {
  const g = galaxy()
  if (!g) return
  const seed = randomSeedString()
  const fresh = generateGalaxy(seed, g.name, { markers: 0, routes: false, regions: false })
  update((d) => {
    d.seed = seed
    d.shape = fresh.shape
    d.arms = fresh.arms
    d.twist = fresh.twist
    d.thickness = fresh.thickness
    d.bulge = fresh.bulge
    d.bar = fresh.bar
    d.coreColor = fresh.coreColor
    d.armColor = fresh.armColor
    d.outerColor = fresh.outerColor
    d.dust = fresh.dust
  })
}

export async function repopulate(markers = 28) {
  const g = galaxy()
  if (!g) return
  const existing = Object.keys(g.systems).length
  if (existing > 0) {
    const choice = await useUIStore.getState().askConfirm({
      title: 'Repeupler la galaxie ?',
      message: 'Les systèmes non liés, les routes et les régions actuels seront remplacés. Les systèmes détaillés sont conservés.',
      actions: [
        { id: 'ok', label: 'Repeupler', tone: 'primary' },
        { id: 'cancel', label: 'Annuler', tone: 'secondary' },
      ],
      cancelId: 'cancel',
    })
    if (choice !== 'ok') return
  }
  const pop = populateGalaxy(g, `${g.seed}:${randomSeedString()}`, { markers })
  update((d) => {
    const kept = Object.values(d.systems).filter((m) => m.systemId)
    d.systems = pop.systems
    for (const m of kept) d.systems[m.id] = m
    d.routes = pop.routes
    d.regions = pop.regions
  })
  useGalaxyUI.getState().select(null)
}

export function addMarkerAt(xLy: number, zLy: number) {
  const g = galaxy()
  if (!g) return
  const rng = new Rng(`${g.seed}:${Date.now()}`)
  const names = new NameGen(rng)
  const cls = rng.weighted([['G', 3], ['K', 3], ['M', 3], ['F', 2], ['A', 1]] as [StarClass, number][])
  const m: GalaxySystemMarker = {
    id: uid('gsy'),
    name: names.systemName(),
    position: [Math.round(xLy), 0, Math.round(zLy)],
    systemId: null,
    starClass: cls,
    color: starClassColor(cls),
    faction: '',
    notes: '',
    playerVisible: true,
    importance: 1,
  }
  update((d) => {
    d.systems[m.id] = m
  })
  useGalaxyUI.getState().select({ type: 'system', id: m.id })
}

export function addRouteBetween(from: string, to: string) {
  const g = galaxy()
  if (!g || from === to || !g.systems[from] || !g.systems[to]) return
  const exists = Object.values(g.routes).find((r) => (r.from === from && r.to === to) || (r.from === to && r.to === from))
  if (exists) {
    useGalaxyUI.getState().select({ type: 'route', id: exists.id })
    return
  }
  const d = markerDistance(g.systems[from], g.systems[to])
  const r: GalaxyRoute = {
    id: uid('grt'),
    from,
    to,
    kind: 'jump',
    label: '',
    jump: Math.min(9, Math.max(1, Math.ceil(d / (g.radius * 0.035)))),
    playerVisible: true,
  }
  update((gg) => {
    gg.routes[r.id] = r
  })
  useGalaxyUI.getState().select({ type: 'route', id: r.id })
}

export function addRegionAt(xLy: number, zLy: number) {
  const g = galaxy()
  if (!g) return
  const names = new NameGen(new Rng(`${g.seed}:region:${Date.now()}`))
  const colors = ['#E9B96E', '#8AB0FF', '#7EE2A8', '#FF7B6B', '#A792FF', '#5AD0D8']
  const reg: GalaxyRegion = {
    id: uid('grg'),
    name: names.region(),
    center: [Math.round(xLy), 0, Math.round(zLy)],
    radius: Math.round(g.radius * 0.12),
    color: colors[Object.keys(g.regions).length % colors.length],
    notes: '',
    playerVisible: true,
  }
  update((d) => {
    d.regions[reg.id] = reg
  })
  useGalaxyUI.getState().select({ type: 'region', id: reg.id })
}

export function deleteGalaxySelection() {
  const sel = useGalaxyUI.getState().selection
  if (!sel) return
  update((g) => {
    if (sel.type === 'system') {
      delete g.systems[sel.id]
      for (const r of Object.values(g.routes)) if (r.from === sel.id || r.to === sel.id) delete g.routes[r.id]
    } else if (sel.type === 'route') delete g.routes[sel.id]
    else delete g.regions[sel.id]
  })
  useGalaxyUI.getState().select(null)
  toast({ kind: 'info', title: 'Élément supprimé', message: 'Ctrl+Z pour annuler.' })
}

export function generateForMarker(markerId: string) {
  const g = galaxy()
  const m = g?.systems[markerId]
  if (!g || !m) return
  const sys = generateSystem({ ...DEFAULT_GENERATOR_OPTIONS, seed: `${g.seed}:${m.id}`, name: m.name, starClass: m.starClass })
  if (m.notes && !sys.description.includes(m.notes)) sys.description = `${sys.description} ${m.notes}`.trim()
  update((d) => {
    const mm = d.systems[markerId]
    if (mm) mm.systemId = sys.id
  })
  addSystemToProject(sys)
  toast({ kind: 'success', title: `Système ${m.name} généré`, message: 'Il est maintenant lié à la carte galactique.' })
}

export function openMarkerSystem(markerId: string) {
  const g = galaxy()
  const m = g?.systems[markerId]
  if (!m?.systemId) return
  if (!useProjectStore.getState().project.systems[m.systemId]) {
    toast({ kind: 'warning', title: 'Système introuvable', message: 'Le système lié a été supprimé.' })
    return
  }
  switchSystem(m.systemId)
}

export function focusMarker(markerId: string) {
  const m = galaxy()?.systems[markerId]
  if (m) useGalaxyUI.getState().requestCamera({ type: 'focus', local: [m.position[0] * S, m.position[1] * S, m.position[2] * S] })
}

export function focusRegion(regionId: string) {
  const r = galaxy()?.regions[regionId]
  if (r) useGalaxyUI.getState().requestCamera({ type: 'focus', local: [r.center[0] * S, 0, r.center[2] * S], distance: r.radius * S * 3 })
}

export function focusRoute(routeId: string) {
  const g = galaxy()
  const r = g?.routes[routeId]
  const a = r && g?.systems[r.from]
  const b = r && g?.systems[r.to]
  if (!a || !b) return
  const mid: [number, number, number] = [((a.position[0] + b.position[0]) / 2) * S, ((a.position[1] + b.position[1]) / 2) * S, ((a.position[2] + b.position[2]) / 2) * S]
  useGalaxyUI.getState().requestCamera({ type: 'focus', local: mid, distance: Math.max(30, markerDistance(a, b) * S * 1.6) })
}
