import * as THREE from 'three'
import type { Galaxy } from '@/core/types'
import { GALAXY_SCALE as S, galaxyRuntime, projectLocal, type GalaxySelection } from './galaxyStore'

const raycaster = new THREE.Raycaster()
const ndc = new THREE.Vector2()
const inv = new THREE.Matrix4()
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const hit = new THREE.Vector3()

export function planeHitLy(clientX: number, clientY: number, rect: DOMRect): [number, number] | null {
  const cam = galaxyRuntime.camera
  if (!cam) return null
  ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
  raycaster.setFromCamera(ndc, cam)
  const ray = raycaster.ray.clone()
  if (galaxyRuntime.group) {
    inv.copy(galaxyRuntime.group.matrixWorld).invert()
    ray.applyMatrix4(inv)
  }
  if (!ray.intersectPlane(plane, hit)) return null
  return [hit.x / S, hit.z / S]
}

function segDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy || 1
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

export function pickGalaxy(
  galaxy: Galaxy,
  clientX: number,
  clientY: number,
  rect: DOMRect,
  opts: { playerMode: boolean; routes: boolean; regions: boolean },
): GalaxySelection | null {
  const x = clientX - rect.left
  const y = clientY - rect.top

  let best: { id: string; d: number } | null = null
  for (const m of Object.values(galaxy.systems)) {
    if (opts.playerMode && !m.playerVisible) continue
    const s = projectLocal(m.position[0] * S, m.position[1] * S, m.position[2] * S)
    if (!s) continue
    const d = Math.hypot(s.x - x, s.y - y)
    const tol = 9 + m.importance * 3
    if (d <= tol && (!best || d < best.d)) best = { id: m.id, d }
  }
  if (best) return { type: 'system', id: best.id }

  if (opts.routes) {
    let bestR: { id: string; d: number } | null = null
    for (const r of Object.values(galaxy.routes)) {
      if (opts.playerMode && !r.playerVisible) continue
      const a = galaxy.systems[r.from]
      const b = galaxy.systems[r.to]
      if (!a || !b) continue
      const pa = projectLocal(a.position[0] * S, a.position[1] * S, a.position[2] * S)
      const pb = projectLocal(b.position[0] * S, b.position[1] * S, b.position[2] * S)
      if (!pa || !pb) continue
      const d = segDistance(x, y, pa.x, pa.y, pb.x, pb.y)
      if (d < 5 && (!bestR || d < bestR.d)) bestR = { id: r.id, d }
    }
    if (bestR) return { type: 'route', id: bestR.id }
  }

  if (opts.regions) {
    const p = planeHitLy(clientX, clientY, rect)
    if (p) {
      let bestG: { id: string; r: number } | null = null
      for (const g of Object.values(galaxy.regions)) {
        if (opts.playerMode && !g.playerVisible) continue
        const d = Math.hypot(p[0] - g.center[0], p[1] - g.center[2])
        if (d <= g.radius && (!bestG || g.radius < bestG.r)) bestG = { id: g.id, r: g.radius }
      }
      if (bestG) return { type: 'region', id: bestG.id }
    }
  }
  return null
}
