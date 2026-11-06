import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { fbm3, mulberry } from './noise'

const cache = new Map<string, THREE.BufferGeometry>()

interface Crater {
  c: THREE.Vector3
  r: number
  depth: number
}

function craterProfile(x: number): number {
  const rx = (x - 1) / 0.22
  const rim = Math.exp(-rx * rx) * 0.35
  if (x < 1) return (x * x - 1) * 0.9 + rim
  return rim + Math.exp(-(x - 1) * 2.5) * 0.04
}

export function rockGeometry(seed: number, detail = 2, roughness = 0.38): THREE.BufferGeometry {
  const key = `${seed}:${detail}:${roughness}`
  const hit = cache.get(key)
  if (hit) return hit

  const base = new THREE.IcosahedronGeometry(1, detail)
  base.deleteAttribute('uv')
  base.deleteAttribute('normal')
  const geo = mergeVertices(base)
  base.dispose()
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  const rand = mulberry(seed * 7919 + 17)
  const s = seed * 0.137
  const ex = 0.72 + rand() * 0.6
  const ey = 0.66 + rand() * 0.42

  const craters: Crater[] = []
  const nCraters = detail >= 4 ? 34 : detail >= 3 ? 18 : 7
  for (let i = 0; i < nCraters; i++) {
    const c = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize()
    const big = i < 3
    craters.push({ c, r: big ? 0.35 + rand() * 0.35 : 0.08 + rand() * 0.2, depth: (big ? 0.16 : 0.08) * (0.6 + rand() * 0.6) })
  }

  const v = new THREE.Vector3()
  const ao = new Float32Array(pos.count)
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize()
    const lumps = fbm3(v.x * 1.4 + s, v.y * 1.4 - s, v.z * 1.4 + s * 2, 3, seed)
    const grain = fbm3(v.x * 5.3 - s, v.y * 5.3 + s, v.z * 5.3, 3, seed + 3)
    let crater = 0
    for (const k of craters) {
      const ang = Math.acos(THREE.MathUtils.clamp(v.dot(k.c), -1, 1))
      const x = ang / k.r
      if (x < 2.2) crater += craterProfile(x) * k.depth
    }
    const d = 1 + lumps * roughness + grain * roughness * 0.18 + crater * (0.6 + roughness)
    v.multiplyScalar(d)
    v.x *= ex
    v.y *= ey
    pos.setXYZ(i, v.x, v.y, v.z)
    ao[i] = THREE.MathUtils.clamp(0.82 + lumps * 0.7 + crater * 2.2 + grain * 0.2, 0.35, 1.15)
  }
  geo.setAttribute('aAO', new THREE.BufferAttribute(ao, 1))
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  cache.set(key, geo)
  return geo
}
