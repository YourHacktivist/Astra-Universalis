import { illumination, resolvedPeriod } from './hierarchy'
import { orbitNormal } from './orbits'
import { AU_KM } from './scale'
import type { Body, PlanetProps, StarSystem } from './types'

export const G0 = 9.80665
export const C_KMS = 299_792.458

export function surfaceGravity(p: Pick<PlanetProps, 'mass' | 'radius'>): number {
  return p.radius > 0 ? p.mass / (p.radius * p.radius) : 0
}

export function escapeVelocityKms(p: Pick<PlanetProps, 'mass' | 'radius'>): number {
  return p.radius > 0 ? 11.186 * Math.sqrt(p.mass / p.radius) : 0
}

export function densityGcm3(p: Pick<PlanetProps, 'mass' | 'radius'>): number {
  return p.radius > 0 ? (5.514 * p.mass) / (p.radius * p.radius * p.radius) : 0
}

export function equilibriumTemperature(luminosity: number, distanceAU: number, albedo: number): number {
  if (luminosity <= 0 || distanceAU <= 0) return 3
  return 278.6 * Math.pow(luminosity, 0.25) * Math.pow(Math.max(0, 1 - albedo), 0.25) / Math.sqrt(distanceAU)
}

export function habitableZone(luminosity: number): { inner: number; outer: number } {
  return { inner: Math.sqrt(luminosity / 1.1), outer: Math.sqrt(luminosity / 0.53) }
}

export function frostLine(luminosity: number): number {
  return 2.7 * Math.sqrt(luminosity)
}

export function solarDayHours(siderealHours: number, orbitalDays: number): number {
  if (!siderealHours) return Infinity
  if (!Number.isFinite(orbitalDays) || orbitalDays <= 0) return Math.abs(siderealHours)
  const rot = 1 / siderealHours
  const orb = 1 / (orbitalDays * 24)
  const d = rot - orb
  return d === 0 ? Infinity : Math.abs(1 / d)
}

export function hillSphereAU(aAU: number, e: number, mass: number, parentMass: number) {
  return aAU * (1 - e) * Math.cbrt(mass / (3 * parentMass))
}

export interface TravelEstimate {
  seconds: number
  peakKms: number
  lightSeconds: number
}

export function brachistochrone(distanceKm: number, accelG: number): TravelEstimate {
  const d = distanceKm * 1000
  const a = Math.max(1e-6, accelG) * G0
  const seconds = 2 * Math.sqrt(d / a)
  const peak = Math.sqrt(d * a) / 1000
  return { seconds, peakKms: peak, lightSeconds: distanceKm / C_KMS }
}

export interface DerivedStats {
  periodDays: number
  distanceAU: number | null
  luminosity: number
  equilibriumK: number | null
  surfaceK: number | null
  gravityG: number | null
  escapeKms: number | null
  densityGcm3: number | null
  solarDayHours: number | null
  inHabitableZone: boolean | null
  obliquityDeg: number | null
}

export function spinAxis(tiltDeg: number, azimuthDeg: number): [number, number, number] {
  const t = (tiltDeg * Math.PI) / 180
  const a = (azimuthDeg * Math.PI) / 180
  return [Math.sin(a) * Math.sin(t), Math.cos(t), Math.cos(a) * Math.sin(t)]
}

export function derivedStats(system: StarSystem, body: Body): DerivedStats {
  const periodDays = resolvedPeriod(system.bodies, body)
  const ill = illumination(system, body.id)
  const out: DerivedStats = {
    periodDays,
    distanceAU: body.orbit ? body.orbit.a : null,
    luminosity: ill.luminosity,
    equilibriumK: null,
    surfaceK: null,
    gravityG: null,
    escapeKms: null,
    densityGcm3: null,
    solarDayHours: null,
    inHabitableZone: null,
    obliquityDeg: null,
  }
  if (body.orbit && !body.orbit.fixed) {
    const [sx, sy, sz] = spinAxis(body.rotation.tilt, body.rotation.azimuth)
    const [nx, ny, nz] = orbitNormal(body.orbit)
    const dot = Math.max(-1, Math.min(1, sx * nx + sy * ny + sz * nz))
    out.obliquityDeg = (Math.acos(dot) * 180) / Math.PI
  }
  if (body.kind === 'planet' || body.kind === 'moon') {
    const p = body.props
    const teq = equilibriumTemperature(ill.luminosity, ill.distanceAU, p.albedo)
    out.equilibriumK = teq
    out.surfaceK = teq + p.greenhouse
    out.gravityG = surfaceGravity(p)
    out.escapeKms = escapeVelocityKms(p)
    out.densityGcm3 = densityGcm3(p)
    let rotH = body.rotation.locked ? periodDays * 24 : body.rotation.period
    if (!body.rotation.locked && body.rotation.tilt > 90 && rotH > 0) rotH = -rotH
    let yearDays = periodDays
    if (body.kind === 'moon') {
      const parent = body.parentId ? system.bodies[body.parentId] : null
      yearDays = parent ? resolvedPeriod(system.bodies, parent) : Infinity
      if (body.rotation.locked) rotH = periodDays * 24
    }
    out.solarDayHours = solarDayHours(rotH, yearDays)
    if (ill.luminosity > 0) {
      const hz = habitableZone(ill.luminosity)
      out.inHabitableZone = ill.distanceAU >= hz.inner && ill.distanceAU <= hz.outer
    }
  }
  return out
}

export function auToKm(au: number) {
  return au * AU_KM
}
