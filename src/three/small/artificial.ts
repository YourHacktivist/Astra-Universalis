import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { GateType, ShipType, StationType } from '@/core/types'
import { mulberry } from './noise'

export type PartKind = 'hull' | 'accent' | 'dark' | 'panel' | 'window' | 'glass' | 'rock'
export const PART_KINDS: PartKind[] = ['hull', 'accent', 'dark', 'panel', 'window', 'glass', 'rock']

export interface NavLight {
  x: number
  y: number
  z: number
  type: number
  size: number
  phase: number
}

export interface Engine {
  x: number
  y: number
  z: number
  r: number
  len: number
}

export interface ModelData {
  parts: Partial<Record<PartKind, THREE.BufferGeometry>>
  spin: Partial<Record<PartKind, THREE.BufferGeometry>>
  lights: NavLight[]
  engines: Engine[]
  surface: number
}

const m4 = new THREE.Matrix4()
const q = new THREE.Quaternion()
const e = new THREE.Euler()
const v = new THREE.Vector3()
const s = new THREE.Vector3()

class Builder {
  private buckets = new Map<string, THREE.BufferGeometry[]>()
  lights: NavLight[] = []
  engines: Engine[] = []
  spinning = false

  add(kind: PartKind, g: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const geo = g.index ? g.toNonIndexed() : g
    if (geo !== g) g.dispose()
    for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') geo.deleteAttribute(name)
    if (!geo.getAttribute('uv')) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.getAttribute('position').count * 2), 2))
    m4.compose(v.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), s.set(sx, sy, sz))
    geo.applyMatrix4(m4)
    const key = (this.spinning ? 's:' : '') + kind
    let arr = this.buckets.get(key)
    if (!arr) this.buckets.set(key, (arr = []))
    arr.push(geo)
    return this
  }

  box(kind: PartKind, w: number, h: number, d: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    return this.add(kind, new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz)
  }

  cyl(kind: PartKind, rt: number, rb: number, h: number, seg: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, open = false, thetaLen = Math.PI * 2) {
    return this.add(kind, new THREE.CylinderGeometry(rt, rb, h, seg, 1, open, 0, thetaLen), x, y, z, rx, ry, rz)
  }

  strut(kind: PartKind, r: number, a: THREE.Vector3Like, b: THREE.Vector3Like, seg = 6) {
    const dir = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z)
    const len = dir.length()
    const g = new THREE.CylinderGeometry(r, r, len, seg, 1)
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
    const geo = g.toNonIndexed()
    g.dispose()
    geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2), quat, new THREE.Vector3(1, 1, 1)))
    return this.add(kind, geo)
  }

  torus(kind: PartKind, R: number, r: number, radial: number, tubular: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, arc = Math.PI * 2) {
    return this.add(kind, new THREE.TorusGeometry(R, r, radial, tubular, arc), x, y, z, rx, ry, rz)
  }

  sphere(kind: PartKind, r: number, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, seg = 16) {
    return this.add(kind, new THREE.SphereGeometry(r, seg, Math.max(6, seg / 2)), x, y, z, 0, 0, 0, sx, sy, sz)
  }

  dome(kind: PartKind, r: number, x = 0, y = 0, z = 0, rx = 0, rz = 0) {
    return this.add(kind, new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), x, y, z, rx, 0, rz)
  }

  cone(kind: PartKind, r: number, h: number, seg: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    return this.add(kind, new THREE.ConeGeometry(r, h, seg), x, y, z, rx, ry, rz)
  }

  light(x: number, y: number, z: number, type: number, size = 1, phase = Math.random()) {
    this.lights.push({ x, y, z, type, size, phase })
    return this
  }

  greebleBox(w: number, h: number, d: number, x: number, y: number, z: number, count: number, rand: () => number) {
    const size = Math.min(w, h, d)
    for (let i = 0; i < count; i++) {
      const axis = Math.floor(rand() * 3)
      const sign = rand() < 0.5 ? -1 : 1
      const a = size * (0.08 + rand() * 0.3)
      const b = size * (0.08 + rand() * 0.3)
      const t = size * (0.03 + rand() * 0.1)
      const kind: PartKind = rand() < 0.55 ? 'dark' : rand() < 0.85 ? 'hull' : 'accent'
      const u = (rand() - 0.5) * 0.86
      const v = (rand() - 0.5) * 0.86
      if (axis === 0) this.box(kind, t, a, b, x + sign * (w / 2 + t / 2), y + u * h, z + v * d)
      else if (axis === 1) this.box(kind, a, t, b, x + u * w, y + sign * (h / 2 + t / 2), z + v * d)
      else this.box(kind, a, b, t, x + u * w, y + v * h, z + sign * (d / 2 + t / 2))
    }
    return this
  }

  greebleCyl(r: number, len: number, x: number, y: number, z: number, axis: 'y' | 'z', count: number, rand: () => number) {
    for (let i = 0; i < count; i++) {
      const ang = rand() * Math.PI * 2
      const a = r * (0.15 + rand() * 0.45)
      const b = len * (0.03 + rand() * 0.12)
      const t = r * (0.05 + rand() * 0.12)
      const along = (rand() - 0.5) * len * 0.88
      const kind: PartKind = rand() < 0.55 ? 'dark' : rand() < 0.85 ? 'hull' : 'accent'
      const rr = r + t / 2
      if (axis === 'y') this.box(kind, a, b, t, x + Math.cos(ang) * rr, y + along, z + Math.sin(ang) * rr, 0, -ang + Math.PI / 2, 0)
      else this.box(kind, a, t, b, x + Math.cos(ang) * rr, y + Math.sin(ang) * rr, z + along, 0, 0, ang - Math.PI / 2)
    }
    return this
  }

  engine(x: number, y: number, z: number, r: number, len: number) {
    this.engines.push({ x, y, z, r, len })
    return this
  }

  build(surface = 0): ModelData {
    const parts: ModelData['parts'] = {}
    const spin: ModelData['spin'] = {}
    for (const [key, list] of this.buckets) {
      const merged = mergeGeometries(list, false)
      list.forEach((g) => g.dispose())
      if (!merged) continue
      merged.computeBoundingSphere()
      if (key.startsWith('s:')) spin[key.slice(2) as PartKind] = merged
      else parts[key as PartKind] = merged
    }
    return { parts, spin, lights: this.lights, engines: this.engines, surface }
  }
}

const P = Math.PI
const H = Math.PI / 2

function ringWindows(b: Builder, R: number, y: number, count: number, size: number, rand: () => number, gapChance = 0.25) {
  for (let i = 0; i < count; i++) {
    if (rand() < gapChance) continue
    const a = (i / count) * P * 2
    b.box('window', size * 1.6, size * 0.6, size * 0.5, Math.cos(a) * R, y, Math.sin(a) * R, 0, -a, 0)
  }
}

function wheel(b: Builder, rand: () => number, broken: boolean) {
  b.cyl('hull', 0.15, 0.15, 0.46, 20)
  b.greebleCyl(0.15, 0.4, 0, 0, 0, 'y', 22, rand)
  b.cyl('dark', 0.18, 0.18, 0.04, 20, 0, 0.23)
  b.cyl('dark', 0.18, 0.18, 0.04, 20, 0, -0.23)
  b.cyl('accent', 0.152, 0.152, 0.05, 20, 0, 0.12)
  if (!broken) {
    b.cyl('hull', 0.045, 0.06, 0.45, 10, 0, 0.47)
    b.torus('accent', 0.09, 0.018, 6, 20, 0, 0.7, 0, H)
    b.cyl('dark', 0.03, 0.03, 0.08, 8, 0, 0.76)
    b.light(0, 0.82, 0, 2, 1.2)
  } else {
    b.cyl('dark', 0.045, 0.06, 0.18, 10, 0, 0.32, 0, 0.3, 0, 0.2)
  }
  b.cyl('dark', 0.012, 0.012, 0.35, 6, 0, -0.4)
  b.dome('hull', 0.09, 0, -0.58, 0, P)
  b.box('panel', 0.02, 0.32, 0.22, 0.2, 0, 0)
  b.box('panel', 0.02, 0.32, 0.22, -0.2, 0, 0)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * P * 2
    b.box('window', 0.03, 0.025, 0.01, Math.cos(a) * 0.152, 0.05, Math.sin(a) * 0.152, 0, -a + H, 0)
  }

  b.spinning = true
  const R = 0.84
  if (!broken) {
    b.torus('hull', R, 0.075, 12, 96, 0, 0, 0, H)
    b.torus('accent', R, 0.078, 12, 96, 0, 0, 0, H, 0, 0, 0.18)
    b.torus('dark', R + 0.075, 0.012, 6, 96, 0, 0, 0, H)
    ringWindows(b, R + 0.072, 0.012, 72, 0.026, rand, 0.2)
    ringWindows(b, R + 0.072, -0.028, 72, 0.02, rand, 0.45)
    for (let i = 0; i < 40; i++) {
      const a = rand() * P * 2
      const top = rand() < 0.6
      const rr = top ? R + (rand() - 0.5) * 0.08 : R - 0.078
      b.box(rand() < 0.6 ? 'dark' : 'hull', 0.03 + rand() * 0.05, top ? 0.012 + rand() * 0.02 : 0.03, top ? 0.025 : 0.012 + rand() * 0.02, Math.cos(a) * rr, top ? 0.075 : (rand() - 0.5) * 0.08, Math.sin(a) * rr, 0, -a, 0)
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * P * 2
      b.strut('hull', 0.022, { x: Math.cos(a) * 0.16, y: 0, z: Math.sin(a) * 0.16 }, { x: Math.cos(a) * (R - 0.07), y: 0, z: Math.sin(a) * (R - 0.07) })
      b.box('accent', 0.06, 0.06, 0.06, Math.cos(a) * (R - 0.09), 0, Math.sin(a) * (R - 0.09), 0, -a, 0)
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * P * 2 + 0.4
      b.light(Math.cos(a) * (R + 0.09), 0, Math.sin(a) * (R + 0.09), i % 2, 0.9)
    }
  } else {
    b.torus('hull', R, 0.075, 12, 64, 0, 0, 0, H, 0, 0.2, P * 1.25)
    b.torus('hull', R, 0.075, 12, 16, 0.15, 0.12, -0.1, H + 0.25, 0, P * 1.5, P * 0.28)
    b.torus('hull', R * 0.96, 0.07, 12, 10, -0.1, -0.15, 0.12, H - 0.3, 0, P * 1.85, P * 0.18)
    for (const i of [0, 2, 3]) {
      const a = (i / 6) * P * 2 + 0.3
      b.strut('hull', 0.022, { x: Math.cos(a) * 0.16, y: 0, z: Math.sin(a) * 0.16 }, { x: Math.cos(a) * (R - 0.07), y: 0, z: Math.sin(a) * (R - 0.07) })
    }
    ringWindows(b, R + 0.072, 0.012, 40, 0.024, rand, 0.7)
    for (let i = 0; i < 9; i++) {
      b.box('dark', 0.03 + rand() * 0.06, 0.02 + rand() * 0.04, 0.03 + rand() * 0.07, (rand() - 0.5) * 1.6, (rand() - 0.5) * 0.5, (rand() - 0.5) * 1.6, rand() * 3, rand() * 3, rand() * 3)
    }
    b.light(R * 0.9, 0.05, 0.3, 3, 0.8)
  }
  b.spinning = false
}

function modular(b: Builder, rand: () => number) {
  b.box('dark', 1.9, 0.05, 0.05, 0, 0.03, 0.03)
  b.box('dark', 1.9, 0.05, 0.05, 0, -0.03, -0.03)
  for (let i = -9; i <= 9; i++) b.box('dark', 0.012, 0.09, 0.09, i * 0.1, 0, 0, P / 4)
  const modules: [number, number, number][] = [
    [0, 0.5, 0.11],
    [0.3, 0.38, 0.09],
    [-0.3, 0.42, 0.09],
  ]
  for (const [x, len, r] of modules) {
    b.cyl('hull', r, r, len, 18, x, -0.14, 0, H)
    b.greebleCyl(r, len, x, -0.14, 0, 'z', 9, rand)
    b.cyl('accent', r * 1.02, r * 1.02, 0.03, 18, x, -0.14, len * 0.3, H)
    for (let k = 0; k < 4; k++) b.box('window', 0.02, 0.012, 0.012, x + r * 0.95, -0.14, -len * 0.3 + k * 0.08)
  }
  b.cyl('hull', 0.1, 0.1, 0.5, 18, 0, -0.14, 0, 0, 0, H)
  b.sphere('accent', 0.12, 0, -0.14, 0.33)
  b.sphere('accent', 0.12, 0, -0.14, -0.33)
  b.dome('glass', 0.06, 0, -0.26, 0.33, P)
  b.light(0, -0.33, 0.33, 3, 0.7)
  for (const side of [-1, 1]) {
    const x = side * 0.95
    b.box('dark', 0.06, 0.06, 0.06, x, 0, 0)
    for (const zz of [-1, 1]) {
      b.box('panel', 0.16, 0.006, 0.62, x - side * 0.1, 0.02, zz * 0.37)
      b.box('panel', 0.16, 0.006, 0.62, x + side * 0.1, 0.02, zz * 0.37)
      b.box('dark', 0.012, 0.012, 0.66, x, 0.02, zz * 0.37)
    }
    b.light(x, 0.06, 0.7, side > 0 ? 1 : 0, 0.8)
    b.light(x, 0.06, -0.7, side > 0 ? 1 : 0, 0.8)
  }
  b.box('hull', 0.36, 0.005, 0.12, 0.35, 0.1, 0, 0, 0, 0.5)
  b.box('hull', 0.36, 0.005, 0.12, -0.35, 0.1, 0, 0, 0, -0.5)
  b.light(0, 0.1, 0, 2, 1)
}

function spindle(b: Builder, rand: () => number) {
  b.spinning = true
  const R = 0.2
  const L = 1.5
  b.cyl('hull', R, R, L, 36)
  b.greebleCyl(R, L * 0.95, 0, 0, 0, 'y', 30, rand)
  b.sphere('hull', R, 0, L / 2, 0, 1, 0.55, 1, 24)
  b.sphere('hull', R, 0, -L / 2, 0, 1, 0.55, 1, 24)
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * P * 2
    b.box('window', 0.1, L * 0.92, 0.012, Math.cos(a) * (R + 0.003), 0, Math.sin(a) * (R + 0.003), 0, -a + H, 0)
    const a2 = a + P / 3
    b.box('accent', 0.06, L * 0.9, 0.008, Math.cos(a2) * (R + 0.002), 0, Math.sin(a2) * (R + 0.002), 0, -a2 + H, 0)
    const hx = Math.cos(a) * (R + 0.02)
    const hz = Math.sin(a) * (R + 0.02)
    b.box('panel', 0.13, L * 0.95, 0.008, hx + Math.cos(a) * 0.17, L / 2 - L * 0.47, hz + Math.sin(a) * 0.17, 0, -a + H, 0)
  }
  b.torus('accent', 0.42, 0.04, 8, 48, 0, L / 2 + 0.06, 0, H)
  ringWindows(b, 0.42 + 0.038, L / 2 + 0.06, 48, 0.02, rand, 0.3)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * P * 2
    b.strut('dark', 0.01, { x: 0, y: L / 2 + 0.06, z: 0 }, { x: Math.cos(a) * 0.4, y: L / 2 + 0.06, z: Math.sin(a) * 0.4 })
  }
  b.spinning = false
  b.cyl('dark', 0.04, 0.04, 0.2, 10, 0, -L / 2 - 0.18)
  b.light(0, -L / 2 - 0.3, 0, 2, 1.1)
  b.light(0.46, L / 2 + 0.06, 0, 0, 0.8)
  b.light(-0.46, L / 2 + 0.06, 0, 1, 0.8)
}

function outpost(b: Builder, rand: () => number) {
  b.dome('glass', 0.22, 0.05, 0.46, 0.05)
  b.dome('glass', 0.13, -0.32, 0.38, 0.12, 0, 0.25)
  b.dome('glass', 0.1, 0.3, 0.38, -0.2, 0, -0.25)
  b.cyl('hull', 0.06, 0.06, 0.4, 12, -0.12, 0.47, -0.22, H, 0.6, 0)
  b.cyl('hull', 0.05, 0.05, 0.3, 12, 0.25, 0.44, 0.18, H, -0.4, 0)
  b.cyl('dark', 0.012, 0.012, 0.6, 6, -0.05, 0.75, -0.05)
  b.dome('hull', 0.1, -0.05, 1.02, -0.05, 2.6, 0.3)
  b.light(-0.05, 1.08, -0.05, 2, 1)
  b.cyl('dark', 0.24, 0.24, 0.02, 24, 0.52, 0.28, 0.35, 0, 0, -0.45)
  b.torus('accent', 0.22, 0.008, 4, 32, 0.52, 0.29, 0.35, H, 0, -0.45)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * P * 2
    b.light(0.52 + Math.cos(a) * 0.22, 0.32 - Math.cos(a) * 0.1, 0.35 + Math.sin(a) * 0.22, 3, 0.6)
  }
  for (let i = 0; i < 10; i++) b.box('window', 0.03, 0.012, 0.012, (rand() - 0.5) * 0.5, 0.42 + rand() * 0.06, (rand() - 0.5) * 0.5)
}

function shipyard(b: Builder, rand: () => number) {
  const W = 0.85
  const Hh = 0.32
  const D = 0.32
  const corners: [number, number, number][] = []
  for (const x of [-W, W]) for (const y of [-Hh, Hh]) for (const z of [-D, D]) corners.push([x, y, z])
  const edge = (a: [number, number, number], c: [number, number, number]) => b.strut('dark', 0.018, { x: a[0], y: a[1], z: a[2] }, { x: c[0], y: c[1], z: c[2] }, 4)
  for (let i = 0; i < corners.length; i++)
    for (let j = i + 1; j < corners.length; j++) {
      const a = corners[i]
      const c = corners[j]
      const diff = (a[0] !== c[0] ? 1 : 0) + (a[1] !== c[1] ? 1 : 0) + (a[2] !== c[2] ? 1 : 0)
      if (diff === 1) edge(a, c)
    }
  for (let k = -2; k <= 2; k++) {
    const x = (k / 3) * W
    b.strut('hull', 0.014, { x, y: Hh, z: -D }, { x, y: Hh, z: D }, 4)
    b.strut('hull', 0.014, { x, y: -Hh, z: -D }, { x, y: -Hh, z: D }, 4)
    b.strut('dark', 0.01, { x, y: -Hh, z: D }, { x: x + W / 3, y: Hh, z: D }, 4)
    b.light(x, Hh + 0.02, 0, 5, 0.8)
  }
  b.cyl('hull', 0.2, 0.2, 0.9, 24, -0.2, 0, 0, 0, 0, H, false, P)
  for (let k = 0; k < 7; k++) b.torus('dark', 0.2, 0.012, 4, 24, 0.3 + k * 0.07, 0, 0, 0, H)
  b.cone('hull', 0.2, 0.35, 24, -0.82, 0, 0, 0, 0, H)
  b.box('accent', 0.04, 0.04, 0.5, 0.1, Hh + 0.04, 0.0)
  b.box('accent', 0.03, 0.18, 0.03, 0.1, Hh - 0.05, 0.22)
  b.box('accent', 0.04, 0.04, 0.4, -0.45, Hh + 0.04, 0.05, 0, 0.6, 0)
  b.box('hull', 0.2, 0.16, 0.2, W + 0.12, 0, 0)
  b.greebleBox(0.2, 0.16, 0.2, W + 0.12, 0, 0, 10, rand)
  for (let i = 0; i < 5; i++) b.box('window', 0.012, 0.02, 0.03, W + 0.225, 0.02, -0.08 + i * 0.04)
  b.light(W + 0.12, 0.1, 0, 2, 1)
  for (let i = 0; i < 6; i++) b.light((rand() - 0.5) * 1.2, (rand() - 0.5) * 0.3, (rand() - 0.5) * 0.4, 5, 0.6)
}

function refinery(b: Builder, rand: () => number) {
  b.cyl('dark', 0.08, 0.08, 1.2, 14)
  b.cyl('hull', 0.12, 0.12, 0.12, 14, 0, 0.5)
  b.cyl('hull', 0.12, 0.12, 0.12, 14, 0, -0.5)
  const tanks = 6
  for (let i = 0; i < tanks; i++) {
    const a = (i / tanks) * P * 2
    const y = i % 2 ? 0.22 : -0.18
    const x = Math.cos(a) * 0.42
    const z = Math.sin(a) * 0.42
    b.sphere(i % 3 === 0 ? 'accent' : 'hull', 0.17, x, y, z, 1, 1, 1, 20)
    b.torus('dark', 0.172, 0.01, 4, 32, x, y, z, H)
    b.strut('accent', 0.02, { x: x * 0.55, y, z: z * 0.55 }, { x: 0, y, z: 0 })
    b.strut('dark', 0.012, { x, y: y + 0.17, z }, { x: 0, y: 0.5, z: 0 })
  }
  b.box('hull', 0.22, 0.3, 0.18, 0, -0.75, 0.0)
  b.greebleBox(0.22, 0.3, 0.18, 0, -0.75, 0, 12, rand)
  b.greebleCyl(0.08, 1.0, 0, 0, 0, 'y', 14, rand)
  for (let k = 0; k < 4; k++) b.box('window', 0.16, 0.012, 0.012, 0, -0.68 - k * 0.05, 0.095)
  b.cyl('dark', 0.025, 0.035, 0.7, 8, 0.18, 0.95, 0)
  b.light(0.18, 1.32, 0, 4, 2.2)
  b.box('panel', 0.5, 0.006, 0.18, 0, 0.62, 0.0)
  b.light(0, -0.95, 0, 2, 1)
}

export function buildStation(type: StationType, seed: number): ModelData {
  const b = new Builder()
  const rand = mulberry(seed)
  switch (type) {
    case 'ring':
      wheel(b, rand, false)
      break
    case 'derelict':
      wheel(b, rand, true)
      break
    case 'modular':
      modular(b, rand)
      break
    case 'spindle':
      spindle(b, rand)
      break
    case 'outpost':
      outpost(b, rand)
      break
    case 'shipyard':
      shipyard(b, rand)
      break
    case 'refinery':
      refinery(b, rand)
      break
  }
  return b.build()
}

function freighter(b: Builder, rand: () => number, broken: boolean) {
  b.box('dark', 0.07, 0.07, 1.5, 0, 0, 0)
  b.greebleBox(0.07, 0.07, 1.5, 0, 0, 0, 14, rand)
  const rows = 5
  for (let k = 0; k < rows; k++) {
    if (broken && (k === 2 || (k === 3 && rand() < 0.5))) continue
    const z = 0.45 - k * 0.24
    for (const [x, y] of [
      [0.08, 0.08],
      [-0.08, 0.08],
      [0.08, -0.08],
      [-0.08, -0.08],
    ]) {
      if (broken && rand() < 0.35) continue
      b.box(rand() < 0.5 ? 'accent' : 'hull', 0.14, 0.14, 0.21, x, y, z)
    }
  }
  b.box('hull', 0.24, 0.18, 0.22, 0, 0.02, 0.74)
  b.greebleBox(0.24, 0.18, 0.22, 0, 0.02, 0.74, 10, rand)
  b.sphere('hull', 0.12, 0, 0.04, 0.86, 1, 0.75, 0.9)
  for (let i = 0; i < 5; i++) b.box('window', 0.03, 0.015, 0.01, -0.06 + i * 0.03, 0.07, 0.96)
  b.box('window', 0.2, 0.01, 0.01, 0, 0.02, 0.855)
  b.cyl('dark', 0.01, 0.01, 0.22, 6, 0.06, 0.2, 0.7)
  b.box('hull', 0.32, 0.3, 0.26, 0, 0, -0.8)
  b.greebleBox(0.32, 0.3, 0.26, 0, 0, -0.8, 16, rand)
  b.box('panel', 0.005, 0.24, 0.32, 0.2, 0, -0.78)
  b.box('panel', 0.005, 0.24, 0.32, -0.2, 0, -0.78)
  if (!broken) {
    for (const x of [-0.09, 0, 0.09]) {
      b.cyl('dark', 0.045, 0.065, 0.08, 12, x, 0, -0.97, H)
      b.engine(x, 0, -1.01, 0.05, 0.6)
    }
  } else {
    b.cyl('dark', 0.045, 0.065, 0.08, 12, 0.05, 0, -0.97, H)
  }
  b.light(0.13, 0, 0.75, 1, 0.8)
  b.light(-0.13, 0, 0.75, 0, 0.8)
  b.light(0, 0.17, -0.8, 2, 1)
}

function corvette(b: Builder, rand: () => number) {
  b.box('hull', 0.22, 0.12, 0.9, 0, 0, -0.05)
  b.greebleBox(0.22, 0.12, 0.9, 0, 0, -0.05, 18, rand)
  b.cone('hull', 0.16, 0.5, 4, 0, 0, 0.65, H, P / 4, 0)
  b.box('accent', 0.23, 0.02, 0.6, 0, 0.07, -0.05)
  b.box('hull', 0.9, 0.025, 0.3, 0, -0.02, -0.25, 0, 0, 0)
  b.box('accent', 0.92, 0.028, 0.06, 0, -0.02, -0.37)
  b.box('dark', 0.05, 0.12, 0.25, 0.44, 0.05, -0.32)
  b.box('dark', 0.05, 0.12, 0.25, -0.44, 0.05, -0.32)
  b.box('hull', 0.12, 0.08, 0.2, 0, 0.1, 0.18)
  b.box('window', 0.1, 0.02, 0.01, 0, 0.12, 0.285)
  b.cyl('dark', 0.05, 0.05, 0.04, 10, 0, 0.08, -0.15)
  b.box('dark', 0.015, 0.015, 0.16, 0, 0.1, -0.05)
  for (const x of [-0.17, 0.17]) {
    b.cyl('dark', 0.065, 0.075, 0.42, 14, x, 0, -0.42, H)
    b.cyl('accent', 0.077, 0.077, 0.04, 14, x, 0, -0.3, H)
    b.engine(x, 0, -0.65, 0.06, 0.7)
  }
  b.light(0.45, 0, -0.25, 1, 0.8)
  b.light(-0.45, 0, -0.25, 0, 0.8)
  b.light(0, 0.15, 0.1, 2, 0.9)
}

function hauler(b: Builder, rand: () => number) {
  b.box('hull', 0.3, 0.24, 0.26, 0, 0.04, 0.32)
  b.greebleBox(0.3, 0.24, 0.26, 0, 0.04, 0.32, 10, rand)
  b.box('accent', 0.31, 0.04, 0.27, 0, 0.17, 0.32)
  for (let i = 0; i < 4; i++) b.box('window', 0.05, 0.03, 0.01, -0.09 + i * 0.06, 0.08, 0.455)
  b.cyl('hull', 0.22, 0.24, 0.5, 18, 0, 0, -0.1, H)
  b.greebleCyl(0.23, 0.45, 0, 0, -0.1, 'z', 14, rand)
  b.cyl('dark', 0.25, 0.25, 0.04, 18, 0, 0, 0.12, H)
  b.cyl('dark', 0.16, 0.22, 0.14, 18, 0, 0, -0.42, H)
  b.engine(0, 0, -0.5, 0.15, 1.0)
  for (const x of [-0.17, 0.17]) {
    b.box('dark', 0.035, 0.035, 0.55, x, -0.12, 0.6)
    b.box('accent', 0.08, 0.03, 0.035, x * 0.85, -0.12, 0.89)
  }
  b.box('panel', 0.6, 0.005, 0.14, 0, 0.0, -0.12)
  b.light(0.18, 0.16, 0.42, 1, 0.8)
  b.light(-0.18, 0.16, 0.42, 0, 0.8)
  b.light(0, 0.26, 0.3, 3, 0.9)
}

function shuttle(b: Builder, rand: () => number) {
  b.sphere('hull', 0.2, 0, 0, 0, 0.9, 0.7, 2.4, 20)
  b.box('window', 0.16, 0.035, 0.01, 0, 0.08, 0.38, -0.4, 0, 0)
  b.cone('hull', 0.42, 0.55, 3, 0, -0.04, -0.12, H, 0, 0)
  b.box('accent', 0.02, 0.22, 0.2, 0, 0.18, -0.3, -0.3, 0, 0)
  b.greebleBox(0.14, 0.1, 0.3, 0, -0.04, -0.12, 6, rand)
  for (const x of [-0.08, 0.08]) {
    b.cyl('dark', 0.04, 0.05, 0.08, 10, x, 0, -0.48, H)
    b.engine(x, 0, -0.52, 0.04, 0.4)
  }
  b.light(0.38, -0.04, -0.3, 1, 0.7)
  b.light(-0.38, -0.04, -0.3, 0, 0.7)
}

function miner(b: Builder, rand: () => number) {
  b.box('hull', 0.26, 0.2, 0.3, 0, 0.06, 0.1)
  b.greebleBox(0.26, 0.2, 0.3, 0, 0.06, 0.1, 10, rand)
  b.box('window', 0.2, 0.04, 0.01, 0, 0.1, 0.255)
  b.box('dark', 0.36, 0.22, 0.42, 0, -0.16, -0.25)
  b.greebleBox(0.36, 0.22, 0.42, 0, -0.16, -0.25, 12, rand)
  b.box('accent', 0.37, 0.04, 0.43, 0, -0.04, -0.25)
  b.box('accent', 0.05, 0.05, 0.5, 0.1, -0.05, 0.45, 0.2, 0, 0)
  b.cone('dark', 0.07, 0.22, 10, 0.1, -0.1, 0.78, H, 0, 0)
  b.box('accent', 0.04, 0.04, 0.35, -0.12, -0.08, 0.35, 0.35, 0, 0)
  b.box('dark', 0.1, 0.03, 0.03, -0.12, -0.18, 0.52)
  for (const x of [-0.12, 0.12]) {
    b.cyl('dark', 0.05, 0.06, 0.1, 12, x, 0.02, -0.5, H)
    b.engine(x, 0.02, -0.55, 0.05, 0.5)
  }
  b.light(0.1, 0.0, 0.62, 5, 1)
  b.light(-0.14, 0.18, 0.2, 3, 0.8)
}

function cruiser(b: Builder, rand: () => number) {
  b.box('hull', 0.34, 0.2, 1.4, 0, 0, 0)
  b.greebleBox(0.34, 0.2, 1.4, 0, 0, 0, 46, rand)
  b.box('hull', 0.26, 0.14, 0.4, 0, 0.0, 0.85)
  b.cone('hull', 0.16, 0.3, 4, 0, 0, 1.2, H, P / 4, 0)
  b.box('accent', 0.35, 0.03, 1.2, 0, 0.11, -0.05)
  b.box('hull', 0.16, 0.16, 0.4, 0, 0.18, -0.15)
  b.greebleBox(0.16, 0.16, 0.4, 0, 0.18, -0.15, 10, rand)
  b.box('hull', 0.1, 0.1, 0.14, 0, 0.3, -0.12)
  b.box('window', 0.08, 0.02, 0.01, 0, 0.31, -0.045)
  for (let k = 0; k < 8; k++) b.box('window', 0.01, 0.012, 0.06, 0.172, 0.02, 0.5 - k * 0.14)
  for (let k = 0; k < 8; k++) b.box('window', 0.01, 0.012, 0.06, -0.172, 0.02, 0.5 - k * 0.14)
  for (const z of [0.4, 0.15, -0.5]) {
    b.cyl('dark', 0.05, 0.05, 0.04, 10, 0, 0.12, z)
    b.box('dark', 0.012, 0.012, 0.18, 0.015, 0.14, z + 0.08)
    b.box('dark', 0.012, 0.012, 0.18, -0.015, 0.14, z + 0.08)
  }
  b.box('window', 0.2, 0.06, 0.01, 0, -0.04, 1.055)
  for (const [x, y] of [
    [-0.1, 0.05],
    [0.1, 0.05],
    [-0.1, -0.06],
    [0.1, -0.06],
  ]) {
    b.cyl('dark', 0.05, 0.065, 0.12, 12, x, y, -0.76, H)
    b.engine(x, y, -0.82, 0.055, 0.8)
  }
  b.box('panel', 0.7, 0.008, 0.2, 0, 0, -0.5)
  b.light(0.36, 0, -0.5, 1, 0.9)
  b.light(-0.36, 0, -0.5, 0, 0.9)
  b.light(0, 0.36, -0.12, 2, 1)
}

export function buildShip(type: ShipType, seed: number): ModelData {
  const b = new Builder()
  const rand = mulberry(seed)
  switch (type) {
    case 'freighter':
      freighter(b, rand, false)
      break
    case 'derelict':
      freighter(b, rand, true)
      break
    case 'corvette':
      corvette(b, rand)
      break
    case 'hauler':
      hauler(b, rand)
      break
    case 'shuttle':
      shuttle(b, rand)
      break
    case 'miner':
      miner(b, rand)
      break
    case 'cruiser':
      cruiser(b, rand)
      break
  }
  return b.build()
}

export function buildGate(type: GateType, seed: number): ModelData {
  const b = new Builder()
  const rand = mulberry(seed)
  switch (type) {
    case 'ring': {
      b.torus('dark', 1, 0.045, 10, 128)
      b.torus('hull', 1.06, 0.02, 6, 128)
      const n = 12
      for (let i = 0; i < n; i++) {
        const a = (i / n) * P * 2
        const x = Math.cos(a)
        const y = Math.sin(a)
        b.box('hull', 0.16, 0.2, 0.16, x, y, 0, 0, 0, a)
        b.box('accent', 0.17, 0.05, 0.17, x * 1.0, y * 1.0, 0, 0, 0, a)
        b.box('window', 0.02, 0.12, 0.172, x * 0.92, y * 0.92, 0, 0, 0, a)
        b.light(x * 1.1, y * 1.1, 0, i % 3 === 0 ? 2 : 3, 0.8, i / n)
      }
      b.strut('dark', 0.02, { x: 0, y: -1.06, z: 0 }, { x: 0, y: -1.45, z: 0 })
      b.box('hull', 0.22, 0.12, 0.22, 0, -1.5, 0)
      b.light(0, -1.58, 0, 2, 1)
      return b.build(0.93)
    }
    case 'anomaly': {
      for (let i = 0; i < 6; i++) b.light((rand() - 0.5) * 0.4, (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.4, 3, 0.4)
      return b.build(1.3)
    }
    case 'beacon':
    default: {
      b.sphere('hull', 0.18, 0, 0, 0, 1, 1.4, 1, 12)
      b.torus('accent', 0.24, 0.03, 6, 24, 0, 0, 0, H)
      b.cyl('dark', 0.012, 0.012, 0.8, 6, 0, 0.55, 0)
      b.cyl('dark', 0.012, 0.012, 0.4, 6, 0, -0.4, 0)
      b.box('panel', 0.5, 0.005, 0.14, 0, -0.15, 0, 0, 0, 0)
      b.light(0, 0.97, 0, 2, 2.4)
      b.light(0, 0, 0.26, 3, 0.7)
      return b.build(0)
    }
  }
}
