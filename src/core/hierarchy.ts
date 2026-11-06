import { EARTH_PER_SOLAR_MASS, keplerPeriodDays } from './orbits'
import type { Body, Id, StarSystem } from './types'

export type ChildrenMap = Map<Id | null, Body[]>

export function buildChildrenMap(bodies: Record<Id, Body>): ChildrenMap {
  const map: ChildrenMap = new Map()
  for (const b of Object.values(bodies)) {
    const pid = b.parentId && bodies[b.parentId] ? b.parentId : null
    let arr = map.get(pid)
    if (!arr) {
      arr = []
      map.set(pid, arr)
    }
    arr.push(b)
  }
  for (const arr of map.values()) arr.sort(compareSiblings)
  return map
}

export function compareSiblings(a: Body, b: Body) {
  if (a.order !== b.order) return a.order - b.order
  const da = a.orbit?.a ?? 0
  const db = b.orbit?.a ?? 0
  if (da !== db) return da - db
  return a.name.localeCompare(b.name)
}

export function topoOrder(bodies: Record<Id, Body>): Body[] {
  const children = buildChildrenMap(bodies)
  const out: Body[] = []
  const visit = (pid: Id | null, depth: number) => {
    if (depth > 64) return
    for (const c of children.get(pid) ?? []) {
      out.push(c)
      visit(c.id, depth + 1)
    }
  }
  visit(null, 0)
  return out
}

export function ancestors(bodies: Record<Id, Body>, id: Id): Body[] {
  const out: Body[] = []
  let cur = bodies[id]?.parentId
  let guard = 0
  while (cur && bodies[cur] && guard++ < 64) {
    out.push(bodies[cur])
    cur = bodies[cur].parentId
  }
  return out
}

export function descendantIds(bodies: Record<Id, Body>, id: Id): Id[] {
  const children = buildChildrenMap(bodies)
  const out: Id[] = []
  const stack = [id]
  while (stack.length) {
    const cur = stack.pop()!
    for (const c of children.get(cur) ?? []) {
      out.push(c.id)
      stack.push(c.id)
    }
  }
  return out
}

export function isSelfOrDescendant(bodies: Record<Id, Body>, id: Id, candidate: Id): boolean {
  if (id === candidate) return true
  return descendantIds(bodies, id).includes(candidate)
}

export function depthOf(bodies: Record<Id, Body>, id: Id) {
  return ancestors(bodies, id).length
}

export function massSolar(bodies: Record<Id, Body>, body: Body, children?: ChildrenMap): number {
  switch (body.kind) {
    case 'star':
      return body.props.mass
    case 'planet':
    case 'moon':
      return body.props.mass / EARTH_PER_SOLAR_MASS
    case 'barycenter': {
      const ch = children ?? buildChildrenMap(bodies)
      let m = 0
      for (const c of ch.get(body.id) ?? []) if (c.kind === 'star' || c.kind === 'barycenter') m += massSolar(bodies, c, ch)
      return m || 1
    }
    default:
      return 1e-18
  }
}

export function resolvedPeriod(bodies: Record<Id, Body>, body: Body, children?: ChildrenMap): number {
  const o = body.orbit
  if (!o || o.fixed) return Infinity
  if (o.period && o.period > 0) return o.period
  const parent = body.parentId ? bodies[body.parentId] : null
  if (!parent) return keplerPeriodDays(o.a, 1)
  const ch = children ?? buildChildrenMap(bodies)
  if (parent.kind === 'barycenter' && (body.kind === 'star' || body.kind === 'barycenter')) {
    let sep = 0
    for (const s of ch.get(parent.id) ?? []) if ((s.kind === 'star' || s.kind === 'barycenter') && s.orbit) sep += s.orbit.a
    return keplerPeriodDays(Math.max(sep, o.a), massSolar(bodies, parent, ch))
  }
  return keplerPeriodDays(o.a, massSolar(bodies, parent, ch) + massSolar(bodies, body, ch))
}

export function illumination(system: StarSystem, id: Id): { luminosity: number; distanceAU: number; source: Body | null } {
  const { bodies } = system
  const chain = [bodies[id], ...ancestors(bodies, id)].filter(Boolean)
  let dist = 0
  for (let k = 0; k < chain.length; k++) {
    const b = chain[k]
    const parent = b.parentId ? bodies[b.parentId] : null
    if (b.orbit) dist = b.orbit.a
    if (parent && (parent.kind === 'star' || parent.kind === 'barycenter')) {
      return { luminosity: totalLuminosity(bodies, parent), distanceAU: dist, source: parent }
    }
  }
  return { luminosity: 0, distanceAU: dist, source: null }
}

export function totalLuminosity(bodies: Record<Id, Body>, body: Body): number {
  if (body.kind === 'star') return body.props.luminosity
  if (body.kind === 'barycenter') {
    let l = 0
    for (const b of Object.values(bodies)) if (b.parentId === body.id) l += totalLuminosity(bodies, b)
    return l
  }
  return 0
}

export function stars(system: StarSystem) {
  return Object.values(system.bodies).filter((b): b is Extract<Body, { kind: 'star' }> => b.kind === 'star')
}
