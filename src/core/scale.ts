import type { Body, BodyKind, DisplaySettings, StarProps } from './types'

export const AU_KM = 149_597_870.7
export const EARTH_RADIUS_KM = 6371
export const SUN_RADIUS_KM = 695_700

export const LINEAR_UNITS_PER_AU = 20

export function starVisualRadius(p: StarProps, bodyScale: number): number {
  const s = Math.pow(bodyScale, 0.6)
  switch (p.starClass) {
    case 'BH':
      return 0.45 * Math.cbrt(Math.max(0.5, p.mass) / 10) * s
    case 'NS':
    case 'PSR':
      return 0.16 * s
    case 'WD':
      return 0.3 * s
    default:
      return Math.max(0.25, 1.2 * Math.pow(Math.max(0.01, p.radius), 0.38)) * s
  }
}

export function planetVisualRadius(radiusEarth: number, bodyScale: number): number {
  return Math.max(0.02, 0.18 * Math.pow(Math.max(0.001, radiusEarth), 0.55)) * bodyScale
}

export function bodyVisualRadius(body: Body, display: DisplaySettings): number {
  const bs = display.bodyScale
  switch (body.kind) {
    case 'star':
      return starVisualRadius(body.props, bs)
    case 'planet':
    case 'moon':
      return planetVisualRadius(body.props.radius, bs)
    case 'station':
      return 0.055 * body.props.size * bs
    case 'ship':
      return 0.035 * body.props.size * bs
    case 'gate':
      return 0.15 * body.props.size * bs
    case 'marker':
      return 0.08 * body.props.size * bs
    case 'comet':
      return 0.035 * bs
    default:
      return 0
  }
}

export function bodyClearanceRadius(body: Body, display: DisplaySettings): number {
  const r = bodyVisualRadius(body, display)
  if (body.kind === 'star') {
    if (body.props.starClass === 'BH') return r * body.props.diskOuter * 1.08
    return r * 1.15
  }
  if (body.kind === 'planet' || body.kind === 'moon') {
    return r * (body.props.rings.enabled ? Math.max(1.05, body.props.rings.outer * 1.02) : 1.05)
  }
  return r
}

export function bodyPhysicalRadiusKm(body: Body): number {
  switch (body.kind) {
    case 'star':
      return body.props.radius * SUN_RADIUS_KM
    case 'planet':
    case 'moon':
      return body.props.radius * EARTH_RADIUS_KM
    case 'station':
    case 'ship':
      return Math.max(0.01, body.props.lengthM / 2000)
    case 'comet':
      return body.props.nucleusKm
    case 'gate':
      return 1
    default:
      return 0
  }
}

export function usesStellarMapping(parentKind: BodyKind | null): boolean {
  return parentKind === null || parentKind === 'star' || parentKind === 'barycenter' || parentKind === 'belt' || parentKind === 'nebula'
}

export interface ParentScaleInfo {
  kind: BodyKind | null
  clearance: number
  visualRadius: number
  physicalRadiusKm: number
}

export const ROOT_PARENT: ParentScaleInfo = { kind: null, clearance: 0, visualRadius: 0, physicalRadiusKm: 0 }

export function parentScaleInfo(parent: Body | null | undefined, display: DisplaySettings): ParentScaleInfo {
  if (!parent) return ROOT_PARENT
  return {
    kind: parent.kind,
    clearance: bodyClearanceRadius(parent, display),
    visualRadius: bodyVisualRadius(parent, display),
    physicalRadiusKm: bodyPhysicalRadiusKm(parent),
  }
}

export function mapOrbitDistance(rAU: number, parent: ParentScaleInfo, display: DisplaySettings): number {
  if (rAU <= 0) return 0
  if (usesStellarMapping(parent.kind)) {
    const ds = display.distanceScale
    const off = parent.clearance
    switch (display.scaleMode) {
      case 'linear':
        return off + LINEAR_UNITS_PER_AU * ds * rAU
      case 'log':
        return off + 30 * ds * Math.log10(1 + rAU / 0.05)
      case 'compressed':
      default:
        return off + 22 * ds * Math.sqrt(rAU)
    }
  }
  const pr = Math.max(1e-6, parent.physicalRadiusKm)
  let n = (rAU * AU_KM) / pr
  const natural = parent.kind === 'planet' || parent.kind === 'moon'
  if (!natural) n = Math.min(n, 400)
  const base = Math.max(parent.visualRadius, parent.clearance * 0.98)
  const extra = 0.62 * (Math.sqrt(Math.max(1, n)) - 1) * display.moonDistanceScale
  return parent.visualRadius * (1.2 + extra) + (base - parent.visualRadius)
}

export function unmapOrbitDistance(d: number, parent: ParentScaleInfo, display: DisplaySettings): number {
  const tiny = 1e-6
  if (usesStellarMapping(parent.kind)) {
    const ds = display.distanceScale
    const x = d - parent.clearance
    if (x <= 0) return tiny
    switch (display.scaleMode) {
      case 'linear':
        return x / (LINEAR_UNITS_PER_AU * ds)
      case 'log':
        return Math.max(tiny, 0.05 * (Math.pow(10, x / (30 * ds)) - 1))
      case 'compressed':
      default:
        return Math.pow(x / (22 * ds), 2)
    }
  }
  const vis = Math.max(1e-9, parent.visualRadius)
  const base = Math.max(parent.visualRadius, parent.clearance * 0.98)
  const extra = (d - (base - vis)) / vis - 1.2
  const sq = Math.max(0, extra) / (0.62 * Math.max(1e-6, display.moonDistanceScale)) + 1
  let n = sq * sq
  const natural = parent.kind === 'planet' || parent.kind === 'moon'
  if (!natural) n = Math.min(n, 400)
  return Math.max(tiny, (n * Math.max(1e-6, parent.physicalRadiusKm)) / AU_KM)
}

export function mapStellarDistance(rAU: number, offset: number, display: DisplaySettings): number {
  return mapOrbitDistance(rAU, { kind: 'star', clearance: offset, visualRadius: 0, physicalRadiusKm: 0 }, display)
}
