import * as THREE from 'three'
import { armAngle, armStartRadius, irregularClumps, sampleGalaxy, type GalaxyPointKind } from '@/core/galaxyGen'
import type { Galaxy } from '@/core/types'
import { Rng } from '@/lib/random'
import { GALAXY_SCALE } from './galaxyStore'

type Weights = Partial<Record<GalaxyPointKind, number>>

function weightsFor(g: Galaxy): Weights {
  switch (g.shape) {
    case 'elliptical':
      return { bulge: 0.92, halo: 0.08 }
    case 'ring':
      return { bulge: 0.16 + g.bulge * 0.08, ring: 0.52, disk: 0.24, halo: 0.04 }
    case 'irregular':
      return { clump: 0.72, disk: 0.23, halo: 0.05 }
    case 'barred':
      return { bulge: 0.1 + g.bulge * 0.1, bar: 0.11, arm: 0.55, disk: 0.15, halo: 0.03 }
    case 'spiral':
    default:
      return { bulge: 0.12 + g.bulge * 0.14, arm: 0.58, disk: 0.15, halo: 0.03 }
  }
}

const BRIGHT: Record<GalaxyPointKind, number> = { bulge: 0.3, bar: 0.3, arm: 0.27, disk: 0.13, halo: 0.07, ring: 0.28, clump: 0.27 }

export interface GalaxyGeometries {
  stars: THREE.BufferGeometry
  dust: THREE.BufferGeometry
}

export function buildGalaxyGeometries(g: Galaxy, count: number): GalaxyGeometries {
  const rng = new Rng(`${g.seed}:particles:${g.shape}`)
  const R = g.radius
  const S = GALAXY_SCALE
  const sizeScale = (R / 50000) * 1.0
  const weights = weightsFor(g)
  const total = Object.values(weights).reduce((a, b) => a + (b ?? 0), 0)
  const clumps = g.shape === 'irregular' ? irregularClumps(g, g.seed) : undefined

  const core = new THREE.Color(g.coreColor)
  const arm = new THREE.Color(g.armColor)
  const outer = new THREE.Color(g.outerColor)
  const young = new THREE.Color('#cfe0ff')
  const knot = new THREE.Color('#ff6fa8')
  const c = new THREE.Color()

  const knotCount = g.shape === 'elliptical' ? 0 : Math.round(count * 0.006)
  const n = count + knotCount
  const pos = new Float32Array(n * 3)
  const col = new Float32Array(n * 3)
  const size = new Float32Array(n)
  const seed = new Float32Array(n)
  let i = 0

  const colourAt = (r: number, kind: GalaxyPointKind) => {
    const t = Math.min(1, r / R)
    if (kind === 'bulge' || kind === 'bar') c.copy(core).lerp(arm, Math.min(1, t * 1.2) * 0.35)
    else if (t < 0.32) c.copy(core).lerp(arm, t / 0.32)
    else c.copy(arm).lerp(outer, Math.min(1, (t - 0.32) / 0.68))
    return c
  }

  for (const [k, w] of Object.entries(weights) as [GalaxyPointKind, number][]) {
    const nk = Math.round((count * w) / total)
    for (let j = 0; j < nk && i < count; j++, i++) {
      const s = sampleGalaxy(rng, g, k, clumps)
      pos[i * 3] = s.x * S
      pos[i * 3 + 1] = s.y * S
      pos[i * 3 + 2] = s.z * S
      colourAt(s.r, k)
      let b = BRIGHT[k] * (0.55 + rng.float() * 0.9)
      let sz = (1.3 + Math.pow(rng.float(), 3) * 2.6) * sizeScale
      if (k === 'arm' && Math.abs(s.armOffset) < 0.09 && rng.bool(0.14)) {
        c.lerp(young, 0.6)
        b *= 1.9
        sz *= 1.5
      }
      if (k === 'bulge') sz *= 1.15
      if (rng.bool(0.004)) {
        b *= 4
        sz *= 1.8
      }
      col[i * 3] = c.r * b
      col[i * 3 + 1] = c.g * b
      col[i * 3 + 2] = c.b * b
      size[i] = sz
      seed[i] = rng.float()
    }
  }

  let left = knotCount
  while (left > 0 && i < n) {
    const centre = sampleGalaxy(rng, g, g.shape === 'ring' ? 'ring' : g.shape === 'irregular' ? 'clump' : 'arm', clumps)
    if (centre.r < armStartRadius(g) * 1.2) continue
    const m = Math.min(left, 6 + rng.int(0, 10))
    for (let j = 0; j < m && i < n; j++, i++, left--) {
      const spread = R * 0.004
      pos[i * 3] = (centre.x + rng.gaussian(0, spread)) * S
      pos[i * 3 + 1] = (centre.y * 0.5 + rng.gaussian(0, spread * 0.4)) * S
      pos[i * 3 + 2] = (centre.z + rng.gaussian(0, spread)) * S
      c.copy(knot).lerp(young, rng.float() * 0.35)
      const b = 0.9 + rng.float() * 0.9
      col[i * 3] = c.r * b
      col[i * 3 + 1] = c.g * b
      col[i * 3 + 2] = c.b * b
      size[i] = (2.2 + rng.float() * 3.2) * sizeScale
      seed[i] = rng.float()
    }
  }

  const stars = new THREE.BufferGeometry()
  stars.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, i * 3), 3))
  stars.setAttribute('aColor', new THREE.BufferAttribute(col.subarray(0, i * 3), 3))
  stars.setAttribute('aSize', new THREE.BufferAttribute(size.subarray(0, i), 1))
  stars.setAttribute('aSeed', new THREE.BufferAttribute(seed.subarray(0, i), 1))
  stars.computeBoundingSphere()

  const dustN = g.shape === 'elliptical' ? Math.round(count * 0.01 * g.dust) : Math.round(count * 0.07 * g.dust)
  const dpos = new Float32Array(dustN * 3)
  const dsize = new Float32Array(dustN)
  const dalpha = new Float32Array(dustN)
  const arms = Math.max(1, Math.round(g.arms))
  const r0 = armStartRadius(g)
  const H = R * g.thickness
  for (let d = 0; d < dustN; d++) {
    let x: number, y: number, z: number
    let alphaK = 1
    if (g.shape === 'spiral' || g.shape === 'barred') {
      if (rng.bool(0.05)) {
        const r = R * rng.range(0.08, 0.2)
        const t = armAngle(g, r) + (Math.floor(rng.float() * arms) / arms) * Math.PI * 2 - 0.3 + rng.gaussian(0, 0.08)
        x = Math.cos(t) * r
        z = Math.sin(t) * r
        y = rng.gaussian(0, H * 0.08)
        alphaK = 0.6
      } else {
        const r = Math.min(R, r0 * 1.1 + -Math.log(1 - rng.float() * 0.93) * (R - r0) * 0.34)
        const a = Math.floor(rng.float() * arms)
        const t = armAngle(g, r) + (a / arms) * Math.PI * 2 - (0.06 + 0.07 * (r / R)) + rng.gaussian(0, 0.025 + 0.04 * (r / R))
        x = Math.cos(t) * r
        z = Math.sin(t) * r
        y = rng.gaussian(0, H * 0.12)
        alphaK = 1 - 0.5 * Math.min(1, r / R)
      }
    } else {
      const s = sampleGalaxy(rng, g, g.shape === 'ring' ? 'ring' : g.shape === 'irregular' ? 'clump' : 'bulge', clumps)
      x = s.x
      y = s.y * 0.3
      z = s.z
    }
    dpos[d * 3] = x * S
    dpos[d * 3 + 1] = y * S
    dpos[d * 3 + 2] = z * S
    dsize[d] = (5 + rng.float() * 12) * sizeScale
    dalpha[d] = (0.1 + rng.float() * 0.22) * alphaK
  }
  const dust = new THREE.BufferGeometry()
  dust.setAttribute('position', new THREE.BufferAttribute(dpos, 3))
  dust.setAttribute('aSize', new THREE.BufferAttribute(dsize, 1))
  dust.setAttribute('aAlpha', new THREE.BufferAttribute(dalpha, 1))
  dust.computeBoundingSphere()
  return { stars, dust }
}

export function buildBackground(seed: string, n = 3500): THREE.BufferGeometry {
  const rng = new Rng(`${seed}:bg`)
  const pos = new Float32Array(n * 3)
  const col = new Float32Array(n * 3)
  const size = new Float32Array(n)
  const sd = new Float32Array(n)
  const c = new THREE.Color()
  for (let i = 0; i < n; i++) {
    const u = rng.range(-1, 1)
    const t = rng.range(0, Math.PI * 2)
    const k = Math.sqrt(1 - u * u)
    const r = 18000
    pos.set([k * Math.cos(t) * r, u * r, k * Math.sin(t) * r], i * 3)
    c.setHSL(rng.range(0.55, 0.65), 0.4, 0.7)
    const b = 0.05 + Math.pow(rng.float(), 6) * 0.5
    col.set([c.r * b, c.g * b, c.b * b], i * 3)
    size[i] = 30 + rng.float() * 30
    sd[i] = rng.float()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
  g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1))
  return g
}
