import type { Orbit } from './types'

export const DEG = Math.PI / 180
export const TAU = Math.PI * 2
export const EARTH_PER_SOLAR_MASS = 332_946

export function keplerPeriodDays(aAU: number, massSolar: number): number {
  if (aAU <= 0 || massSolar <= 0) return Infinity
  return 365.256 * Math.sqrt((aAU * aAU * aAU) / massSolar)
}

export function keplerSemiMajorAxis(periodDays: number, massSolar: number): number {
  const years = periodDays / 365.256
  return Math.cbrt(years * years * massSolar)
}

export function solveKepler(M: number, e: number): number {
  M = ((M % TAU) + TAU) % TAU
  if (e < 1e-6) return M
  let E = e < 0.8 ? M : Math.PI
  for (let k = 0; k < 30; k++) {
    const f = E - e * Math.sin(E) - M
    const d = 1 - e * Math.cos(E)
    const dE = f / d
    E -= dE
    if (Math.abs(dE) < 1e-10) break
  }
  return E
}

export interface OrbitState {
  x: number
  y: number
  z: number
  r: number
  nu: number
  phase: number
  vx: number
  vy: number
  vz: number
}

export function createOrbitState(): OrbitState {
  return { x: 0, y: 0, z: 0, r: 0, nu: 0, phase: 0, vx: 0, vy: 0, vz: 0 }
}

function toWorld(
  px: number,
  py: number,
  cosO: number,
  sinO: number,
  cosI: number,
  sinI: number,
  cosW: number,
  sinW: number,
  out: { x: number; y: number; z: number },
) {
  const xw = px * cosW - py * sinW
  const yw = px * sinW + py * cosW
  const X = xw * cosO - yw * cosI * sinO
  const Y = xw * sinO + yw * cosI * cosO
  const Z = yw * sinI
  out.x = X
  out.y = Z
  out.z = -Y
}

const tmp = { x: 0, y: 0, z: 0 }

export function orbitStateAt(orbit: Orbit, periodDays: number, t: number, out: OrbitState): OrbitState {
  const e = Math.min(0.99, Math.max(0, orbit.e))
  const a = orbit.a
  let M = orbit.m0 * DEG
  if (!orbit.fixed && Number.isFinite(periodDays) && periodDays > 0) {
    const n = TAU / periodDays
    M += (orbit.retrograde ? -n : n) * t
  }
  const E = solveKepler(M, e)
  const cosE = Math.cos(E)
  const sinE = Math.sin(E)
  const b = Math.sqrt(1 - e * e)
  const px = a * (cosE - e)
  const py = a * b * sinE
  const cosO = Math.cos(orbit.node * DEG)
  const sinO = Math.sin(orbit.node * DEG)
  const cosI = Math.cos(orbit.i * DEG)
  const sinI = Math.sin(orbit.i * DEG)
  const cosW = Math.cos(orbit.peri * DEG)
  const sinW = Math.sin(orbit.peri * DEG)

  toWorld(px, py, cosO, sinO, cosI, sinI, cosW, sinW, out)
  out.r = a * (1 - e * cosE)
  out.nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2))
  out.phase = (((M % TAU) + TAU) % TAU) / TAU

  const sign = orbit.retrograde ? -1 : 1
  toWorld(-a * sinE * sign, a * b * cosE * sign, cosO, sinO, cosI, sinI, cosW, sinW, tmp)
  const len = Math.hypot(tmp.x, tmp.y, tmp.z) || 1
  out.vx = tmp.x / len
  out.vy = tmp.y / len
  out.vz = tmp.z / len
  return out
}

export function sampleOrbit(orbit: Orbit, segments: number): { points: Float64Array; phases: Float32Array } {
  const e = Math.min(0.99, Math.max(0, orbit.e))
  const a = orbit.a
  const b = Math.sqrt(1 - e * e)
  const cosO = Math.cos(orbit.node * DEG)
  const sinO = Math.sin(orbit.node * DEG)
  const cosI = Math.cos(orbit.i * DEG)
  const sinI = Math.sin(orbit.i * DEG)
  const cosW = Math.cos(orbit.peri * DEG)
  const sinW = Math.sin(orbit.peri * DEG)
  const points = new Float64Array(segments * 3)
  const phases = new Float32Array(segments)
  const p = { x: 0, y: 0, z: 0 }
  for (let k = 0; k < segments; k++) {
    const E = (k / segments) * TAU
    const px = a * (Math.cos(E) - e)
    const py = a * b * Math.sin(E)
    toWorld(px, py, cosO, sinO, cosI, sinI, cosW, sinW, p)
    points[k * 3] = p.x
    points[k * 3 + 1] = p.y
    points[k * 3 + 2] = p.z
    const M = E - e * Math.sin(E)
    phases[k] = (((M % TAU) + TAU) % TAU) / TAU
  }
  return { points, phases }
}

export function orbitNormal(orbit: Pick<Orbit, 'i' | 'node'>): [number, number, number] {
  const p = { x: 0, y: 0, z: 0 }
  const cosO = Math.cos(orbit.node * DEG)
  const sinO = Math.sin(orbit.node * DEG)
  const cosI = Math.cos(orbit.i * DEG)
  const sinI = Math.sin(orbit.i * DEG)
  toWorld(1, 0, cosO, sinO, cosI, sinI, 1, 0, p)
  const ax = p.x, ay = p.y, az = p.z
  toWorld(0, 1, cosO, sinO, cosI, sinI, 1, 0, p)
  const bx = p.x, by = p.y, bz = p.z
  const nx = ay * bz - az * by
  const ny = az * bx - ax * bz
  const nz = ax * by - ay * bx
  const l = Math.hypot(nx, ny, nz) || 1
  return [nx / l, ny / l, nz / l]
}

export function periapsis(orbit: Pick<Orbit, 'a' | 'e'>) {
  return orbit.a * (1 - orbit.e)
}

export function apoapsis(orbit: Pick<Orbit, 'a' | 'e'>) {
  return orbit.a * (1 + orbit.e)
}
