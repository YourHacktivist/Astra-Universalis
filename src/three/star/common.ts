import * as THREE from 'three'
import type { StarProps } from '@/core/types'
import { blackbodyRgb, hexToRgb, type RGB } from '@/lib/color'

const BD_TINT: RGB = [0.72, 0.22, 0.42]

function toLinear([r, g, b]: RGB, out = new THREE.Color()) {
  return out.setRGB(r, g, b, THREE.SRGBColorSpace)
}

function normalise(c: THREE.Color) {
  const m = Math.max(c.r, c.g, c.b, 1e-6)
  return c.multiplyScalar(1 / m)
}

function vivid(c: THREE.Color, k: number) {
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
  c.setRGB(Math.max(0, l + (c.r - l) * k), Math.max(0, l + (c.g - l) * k), Math.max(0, l + (c.b - l) * k))
  return normalise(c)
}

export interface StarPalette {
  base: THREE.Color
  limb: THREE.Color
  hot: THREE.Color
  glow: THREE.Color
}

export function starPalette(p: StarProps): StarPalette {
  if (p.colorOverride) {
    const base = normalise(toLinear(hexToRgb(p.colorOverride)))
    const limb = base.clone().multiply(new THREE.Color(1, 0.55, 0.35))
    const hot = base.clone().lerp(new THREE.Color(1, 1, 1), 0.45)
    const glow = base.clone().lerp(new THREE.Color(1, 1, 1), 0.2)
    return { base, limb, hot, glow }
  }
  const T = Math.min(40000, p.temperature)
  if (p.starClass === 'BD') {
    const bb = blackbodyRgb(Math.max(1200, T))
    const tint: RGB = [bb[0] * 0.45 + BD_TINT[0] * 0.55, bb[1] * 0.45 + BD_TINT[1] * 0.55, bb[2] * 0.45 + BD_TINT[2] * 0.55]
    const base = normalise(toLinear(tint))
    const limb = toLinear([0.32, 0.05, 0.14])
    const hot = normalise(toLinear([1, 0.45, 0.28]))
    const glow = base.clone().lerp(new THREE.Color(1, 0.35, 0.3), 0.3)
    return { base, limb, hot, glow }
  }
  const base = vivid(toLinear(blackbodyRgb(T)), 2.7)
  const limb = vivid(toLinear(blackbodyRgb(T * 0.6)), 1.8).multiplyScalar(0.9)
  const hot = vivid(toLinear(blackbodyRgb(Math.min(40000, T * 1.25))), 1.2)
  const glow = vivid(base.clone().lerp(limb, 0.3), 1.15)
  return { base, limb, hot, glow }
}

export function surfaceIntensity(p: StarProps): number {
  switch (p.starClass) {
    case 'BD':
      return 1.05
    case 'WD':
      return 4.5
    case 'NS':
    case 'PSR':
      return 7
    case 'BH':
      return 0
    default:
      return THREE.MathUtils.clamp(1.9 + 0.35 * Math.log10(Math.max(p.luminosity, 1e-4)), 1.3, 3.6)
  }
}

export function pointGlowPx(p: StarProps): number {
  const base =
    p.starClass === 'BD'
      ? 10
      : p.starClass === 'WD'
        ? 26
        : p.starClass === 'NS' || p.starClass === 'PSR'
          ? 34
          : p.starClass === 'BH'
            ? 24
            : 20 + 9 * Math.log10(Math.max(p.luminosity, 1e-3) + 1)
  return THREE.MathUtils.clamp(base * (0.65 + 0.35 * p.corona), 9, 90)
}

export function focalPx(camera: THREE.PerspectiveCamera, viewportHeight: number) {
  return viewportHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))
}

export const SURFACE_MODE = { normal: 0, brownDwarf: 1, remnant: 2 } as const

export function surfaceMode(p: StarProps): number {
  if (p.starClass === 'BD') return SURFACE_MODE.brownDwarf
  if (p.starClass === 'WD' || p.starClass === 'NS' || p.starClass === 'PSR') return SURFACE_MODE.remnant
  return SURFACE_MODE.normal
}

export function seedFloat(seed: number) {
  return ((seed % 100003) / 100003) * 100
}
