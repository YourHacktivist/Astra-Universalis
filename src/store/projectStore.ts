import { create } from 'zustand'
import { produce } from 'immer'
import { createProject } from '@/core/defaults'
import { buildChildrenMap, descendantIds, isSelfOrDescendant } from '@/core/hierarchy'
import type { Body, Galaxy, Id, Project, Route, StarSystem } from '@/core/types'
import { uid } from '@/lib/id'

const HISTORY_LIMIT = 150
const COALESCE_MS = 800

export interface ApplyOptions {
  coalesce?: string
  history?: boolean
  viewState?: boolean
}

interface ProjectState {
  project: Project
  filePath: string | null
  dirty: boolean
  example: boolean
  revision: number
  past: Project[]
  future: Project[]
  coalesceKey: string | null
  coalesceAt: number

  apply(recipe: (draft: Project) => void, opts?: ApplyOptions): void
  updateSystem(recipe: (s: StarSystem) => void, opts?: ApplyOptions & { systemId?: Id }): void
  updateBody(id: Id, recipe: (b: Body) => void, opts?: ApplyOptions): void
  updateBodies(ids: Id[], recipe: (b: Body) => void, opts?: ApplyOptions): void
  addBodies(bodies: Body[]): void
  removeBodies(ids: Id[]): void
  duplicateBody(id: Id): Id | null
  reparentBody(id: Id, parentId: Id | null, order?: number): void
  addRoute(route: Route): void
  updateRoute(id: Id, recipe: (r: Route) => void, opts?: ApplyOptions): void
  removeRoute(id: Id): void
  setActiveSystem(id: Id): void
  addSystem(system: StarSystem, activate?: boolean): void
  removeSystem(id: Id): void
  setGalaxy(galaxy: Galaxy | null): void
  updateGalaxy(recipe: (g: Galaxy) => void, opts?: ApplyOptions): void
  undo(): void
  redo(): void
  endCoalesce(): void
  load(project: Project, filePath: string | null, opts?: { dirty?: boolean; example?: boolean }): void
  markSaved(filePath: string | null): void
  rename(name: string): void
}

function activeSystemDraft(p: Project, systemId?: Id): StarSystem | null {
  const id = systemId ?? p.activeSystemId
  return id ? p.systems[id] ?? null : null
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  project: createProject(),
  filePath: null,
  dirty: false,
  example: false,
  revision: 0,
  past: [],
  future: [],
  coalesceKey: null,
  coalesceAt: 0,

  apply(recipe, opts = {}) {
    const state = get()
    if (opts.viewState) {
      const next = produce(state.project, (d: Project) => void recipe(d))
      if (next !== state.project) set({ project: next })
      return
    }
    const next = produce(state.project, (d: Project) => {
      recipe(d)
      d.updatedAt = Date.now()
    })
    if (next === state.project) return
    const record = opts.history !== false
    const now = performance.now()
    const merging =
      record && !!opts.coalesce && state.coalesceKey === opts.coalesce && now - state.coalesceAt < COALESCE_MS
    let past = state.past
    if (record && !merging) {
      past = [...state.past, state.project]
      if (past.length > HISTORY_LIMIT) past = past.slice(past.length - HISTORY_LIMIT)
    }
    set({
      project: next,
      past,
      future: record ? [] : state.future,
      dirty: true,
      revision: state.revision + 1,
      coalesceKey: record ? opts.coalesce ?? null : state.coalesceKey,
      coalesceAt: record ? now : state.coalesceAt,
    })
  },

  updateSystem(recipe, opts = {}) {
    get().apply((p) => {
      const s = activeSystemDraft(p, opts.systemId)
      if (!s) return
      recipe(s)
      if (!opts.viewState) s.updatedAt = Date.now()
    }, opts)
  },

  updateBody(id, recipe, opts) {
    get().updateSystem((s) => {
      const b = s.bodies[id]
      if (b) recipe(b)
    }, opts)
  },

  updateBodies(ids, recipe, opts) {
    get().updateSystem((s) => {
      for (const id of ids) {
        const b = s.bodies[id]
        if (b) recipe(b)
      }
    }, opts)
  },

  addBodies(bodies) {
    get().updateSystem((s) => {
      const children = buildChildrenMap(s.bodies)
      for (const b of bodies) {
        if (b.order === 0) {
          const siblings = children.get(b.parentId) ?? []
          b.order = siblings.reduce((m, x) => Math.max(m, x.order), 0) + 1
          siblings.push(b)
          children.set(b.parentId, siblings)
        }
        s.bodies[b.id] = b
      }
    })
  },

  removeBodies(ids) {
    get().updateSystem((s) => {
      const all = new Set<Id>()
      for (const id of ids) {
        if (!s.bodies[id]) continue
        all.add(id)
        for (const d of descendantIds(s.bodies, id)) all.add(d)
      }
      for (const id of all) delete s.bodies[id]
      for (const r of Object.values(s.routes)) if (all.has(r.from) || all.has(r.to)) delete s.routes[r.id]
    })
  },

  duplicateBody(id) {
    const sys = getActiveSystem()
    const src = sys?.bodies[id]
    if (!sys || !src) return null
    const idMap = new Map<Id, Id>()
    const ids = [id, ...descendantIds(sys.bodies, id)]
    for (const old of ids) idMap.set(old, uid(sys.bodies[old].kind.slice(0, 3)))
    const copies: Body[] = ids.map((old) => {
      const b = structuredClone(sys.bodies[old]) as Body
      b.id = idMap.get(old)!
      if (old === id) {
        b.name = `${b.name} (copie)`
        if (b.orbit) b.orbit.m0 = (b.orbit.m0 + 47) % 360
        b.order = src.order + 0.5
      } else if (b.parentId) {
        b.parentId = idMap.get(b.parentId) ?? b.parentId
      }
      return b
    })
    get().updateSystem((s) => {
      for (const c of copies) s.bodies[c.id] = c
    })
    return idMap.get(id)!
  },

  reparentBody(id, parentId, order) {
    get().updateSystem((s) => {
      const b = s.bodies[id]
      if (!b) return
      if (parentId && (!s.bodies[parentId] || isSelfOrDescendant(s.bodies, id, parentId))) return
      b.parentId = parentId
      if (order !== undefined) b.order = order
    })
  },

  addRoute(route) {
    get().updateSystem((s) => {
      s.routes[route.id] = route
    })
  },

  updateRoute(id, recipe, opts) {
    get().updateSystem((s) => {
      const r = s.routes[id]
      if (r) recipe(r)
    }, opts)
  },

  removeRoute(id) {
    get().updateSystem((s) => {
      delete s.routes[id]
    })
  },

  setActiveSystem(id) {
    get().apply(
      (p) => {
        if (p.systems[id]) p.activeSystemId = id
      },
      { viewState: true },
    )
  },

  addSystem(system, activate = true) {
    get().apply((p) => {
      p.systems[system.id] = system
      if (!p.systemOrder.includes(system.id)) p.systemOrder.push(system.id)
      if (activate) p.activeSystemId = system.id
    })
  },

  removeSystem(id) {
    get().apply((p) => {
      delete p.systems[id]
      p.systemOrder = p.systemOrder.filter((x) => x !== id)
      if (p.activeSystemId === id) p.activeSystemId = p.systemOrder[0] ?? null
      if (p.galaxy) for (const m of Object.values(p.galaxy.systems)) if (m.systemId === id) m.systemId = null
    })
  },

  setGalaxy(galaxy) {
    get().apply((p) => {
      p.galaxy = galaxy
    })
  },

  updateGalaxy(recipe, opts) {
    get().apply((p) => {
      if (p.galaxy) recipe(p.galaxy)
    }, opts)
  },

  undo() {
    const { past, project, future, revision } = get()
    if (!past.length) return
    const prev = past[past.length - 1]
    set({
      project: prev,
      past: past.slice(0, -1),
      future: [project, ...future],
      dirty: true,
      revision: revision + 1,
      coalesceKey: null,
    })
  },

  redo() {
    const { past, project, future, revision } = get()
    if (!future.length) return
    const next = future[0]
    set({
      project: next,
      past: [...past, project],
      future: future.slice(1),
      dirty: true,
      revision: revision + 1,
      coalesceKey: null,
    })
  },

  endCoalesce() {
    if (get().coalesceKey) set({ coalesceKey: null })
  },

  load(project, filePath, opts = {}) {
    set({
      project,
      filePath,
      dirty: !!opts.dirty,
      example: !!opts.example,
      past: [],
      future: [],
      revision: get().revision + 1,
      coalesceKey: null,
    })
  },

  markSaved(filePath) {
    set({ filePath, dirty: false, example: false })
  },

  rename(name) {
    get().apply((p) => {
      p.name = name
    })
  },
}))

export function getProject() {
  return useProjectStore.getState().project
}

export function getActiveSystem(): StarSystem | null {
  const p = getProject()
  return p.activeSystemId ? p.systems[p.activeSystemId] ?? null : null
}

export function useActiveSystem(): StarSystem | null {
  return useProjectStore((s) => (s.project.activeSystemId ? s.project.systems[s.project.activeSystemId] ?? null : null))
}

export function useBody(id: Id | null | undefined): Body | null {
  return useProjectStore((s) => {
    const sid = s.project.activeSystemId
    if (!id || !sid) return null
    return s.project.systems[sid]?.bodies[id] ?? null
  })
}

export function useGalaxy(): Galaxy | null {
  return useProjectStore((s) => s.project.galaxy)
}

export const useCanUndo = () => useProjectStore((s) => s.past.length > 0)
export const useCanRedo = () => useProjectStore((s) => s.future.length > 0)
