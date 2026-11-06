import * as THREE from 'three'
import { resolvedPeriod } from '@/core/hierarchy'
import { DEG, orbitNormal, TAU } from '@/core/orbits'
import { parentScaleInfo, unmapOrbitDistance } from '@/core/scale'
import type { Body, BodyKind, Orbit, StarSystem, Vec3 } from '@/core/types'
import { runtime } from '../runtime'

const plane = new THREE.Plane()
const ray = new THREE.Ray()
const hit = new THREE.Vector3()
const n = new THREE.Vector3()
const ndc = new THREE.Vector2()

export interface DragSolution {
  a: number
  m0: number
  periodDays: number
  distanceAU: number
}

export function isDraggable(body: Body | undefined | null): body is Body & { orbit: Orbit } {
  return !!body && !!body.orbit && !body.locked
}

export function pointerRay(camera: THREE.Camera, rect: DOMRect, clientX: number, clientY: number, out = ray): THREE.Ray {
  ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
  out.origin.setFromMatrixPosition(camera.matrixWorld)
  out.direction.set(ndc.x, ndc.y, 0.5).unproject(camera).sub(out.origin).normalize()
  return out
}

export function rayOnPlane(r: THREE.Ray, point: THREE.Vector3, normal: THREE.Vector3, fallbackDistance: number, out = new THREE.Vector3()) {
  if (Math.abs(normal.dot(r.direction)) > 0.04) {
    plane.setFromNormalAndCoplanarPoint(normal, point)
    if (r.intersectPlane(plane, out)) return out
  }
  return r.at(fallbackDistance, out)
}

export function pointerOnOrbitPlane(
  body: Body & { orbit: Orbit },
  camera: THREE.Camera,
  rect: DOMRect,
  clientX: number,
  clientY: number,
): THREE.Vector3 | null {
  const rt = runtime.bodies.get(body.id)
  if (!rt) return null
  pointerRay(camera, rect, clientX, clientY)
  const [nx, ny, nz] = orbitNormal(body.orbit)
  n.set(nx, ny, nz)
  if (Math.abs(n.dot(ray.direction)) < 0.08) {
    n.copy(ray.direction).negate()
    plane.setFromNormalAndCoplanarPoint(n, rt.pos)
  } else {
    plane.setFromNormalAndCoplanarPoint(n, rt.parentPos)
  }
  return ray.intersectPlane(plane, hit)
}

export function solveOrbitAt(
  system: StarSystem,
  body: Body & { orbit: Orbit },
  parentWorld: THREE.Vector3,
  world: THREE.Vector3,
  t: number,
): DragSolution | null {
  const parent = body.parentId ? system.bodies[body.parentId] ?? null : null
  const rel = world.clone().sub(parentWorld)
  const d = rel.length()
  if (d < 1e-9) return null
  const rAU = unmapOrbitDistance(d, parentScaleInfo(parent, system.display), system.display)

  const o = body.orbit
  const X = rel.x
  const Y = -rel.z
  const Z = rel.y
  const cO = Math.cos(o.node * DEG)
  const sO = Math.sin(o.node * DEG)
  const x1 = X * cO + Y * sO
  const y1 = -X * sO + Y * cO
  const cI = Math.cos(o.i * DEG)
  const sI = Math.sin(o.i * DEG)
  const y2 = y1 * cI + Z * sI
  const u = Math.atan2(y2, x1)
  const e = Math.min(0.99, Math.max(0, o.e))
  const nu = u - o.peri * DEG
  const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2))
  const M = E - e * Math.sin(E)
  const a = Math.max(1e-6, rAU / Math.max(1e-6, 1 - e * Math.cos(E)))

  const trial = { ...body, orbit: { ...o, a } } as Body
  const period = resolvedPeriod(system.bodies, trial)
  let m0 = M
  if (!o.fixed && Number.isFinite(period) && period > 0) {
    const mean = (TAU / period) * t
    m0 = o.retrograde ? M + mean : M - mean
  }
  const deg = (((m0 / DEG) % 360) + 360) % 360
  return { a, m0: deg, periodDays: period, distanceAU: rAU }
}

export function solveOrbitForPoint(system: StarSystem, body: Body & { orbit: Orbit }, world: THREE.Vector3, t: number): DragSolution | null {
  const rt = runtime.bodies.get(body.id)
  return rt ? solveOrbitAt(system, body, rt.parentPos, world, t) : null
}

const LOCAL_KINDS: BodyKind[] = ['moon', 'station', 'ship', 'marker', 'gate']

function isLuminous(b: Body) {
  return b.kind === 'star' || b.kind === 'barycenter'
}

function localZone(system: StarSystem, id: string): number {
  const rt = runtime.bodies.get(id)
  if (!rt) return 0
  let r = Math.max(rt.radius * 14, rt.clearance * 3)
  for (const b of Object.values(system.bodies)) {
    if (b.parentId !== id) continue
    const c = runtime.bodies.get(b.id)
    if (c) r = Math.max(r, c.pos.distanceTo(rt.pos) * 1.35)
  }
  return r
}

export interface Placement {
  parentId: string | null
  world: Vec3
  i: number
  node: number
}

export function resolvePlacement(
  system: StarSystem,
  kind: BodyKind,
  camera: THREE.Camera,
  rect: DOMRect,
  clientX: number,
  clientY: number,
  targetDistance: number,
): Placement | null {
  const bodies = Object.values(system.bodies)
  const visible = (b: Body) => runtime.bodies.get(b.id)?.visible
  pointerRay(camera, rect, clientX, clientY)
  const up = new THREE.Vector3(0, 1, 0)

  const root = bodies.find((b) => b.parentId === null && isLuminous(b)) ?? bodies.find(isLuminous)
  const rootPos = root ? runtime.bodies.get(root.id)?.pos ?? new THREE.Vector3() : new THREE.Vector3()
  const p0 = rayOnPlane(ray, rootPos, up, targetDistance)

  if (LOCAL_KINDS.includes(kind)) {
    let best: { b: Body; d: number; zone: number } | null = null
    for (const b of bodies) {
      if ((b.kind !== 'planet' && b.kind !== 'moon') || !visible(b)) continue
      if (kind === 'moon' && b.kind === 'moon') continue
      const rt = runtime.bodies.get(b.id)!
      const zone = localZone(system, b.id)
      const d = ray.distanceToPoint(rt.pos)
      if ((d < zone || kind === 'moon') && (!best || d / Math.max(zone, 1e-6) < best.d / Math.max(best.zone, 1e-6))) best = { b, d, zone }
    }
    if (best) {
      const host = best.b
      const rt = runtime.bodies.get(host.id)!
      const i = host.rotation.tilt
      const node = host.rotation.azimuth
      const normal = new THREE.Vector3(...orbitNormal({ i, node }))
      const p = rayOnPlane(ray, rt.pos, normal, rt.pos.distanceTo(ray.origin))
      return { parentId: host.id, world: [p.x, p.y, p.z], i, node }
    }
  }

  let host: Body | null = null
  let hd = Infinity
  for (const b of bodies) {
    if (!isLuminous(b) || !visible(b)) continue
    const rt = runtime.bodies.get(b.id)!
    const d = rt.pos.distanceTo(p0) * (b.parentId ? 1.6 : 1)
    if (d < hd) {
      hd = d
      host = b
    }
  }
  if (host && host.parentId && system.bodies[host.parentId]?.kind === 'barycenter') {
    const bary = runtime.bodies.get(host.parentId)
    const rt = runtime.bodies.get(host.id)
    if (bary && rt && p0.distanceTo(bary.pos) > rt.pos.distanceTo(bary.pos) * 3) host = system.bodies[host.parentId]
  }
  const hp = host ? runtime.bodies.get(host.id)?.pos ?? rootPos : rootPos
  const p = rayOnPlane(ray, hp, up, targetDistance)
  return { parentId: kind === 'nebula' ? null : host?.id ?? null, world: [p.x, p.y, p.z], i: 0, node: 0 }
}

export function parentWorld(parentId: string | null): THREE.Vector3 {
  return parentId ? runtime.bodies.get(parentId)?.pos.clone() ?? new THREE.Vector3() : new THREE.Vector3()
}
