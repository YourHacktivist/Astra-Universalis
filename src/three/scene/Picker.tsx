import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { BodyKind, Id } from '@/core/types'
import { getActiveSystem } from '@/store/projectStore'
import { runtime } from '../runtime'

const PRIORITY: Record<BodyKind, number> = {
  star: 6,
  planet: 5,
  station: 4,
  gate: 4,
  ship: 3,
  moon: 3,
  comet: 3,
  marker: 3,
  barycenter: 1,
  belt: 0,
  nebula: 0,
}

export const pickerApi: {
  pick(clientX: number, clientY: number): Id | null
  project(p: THREE.Vector3): { x: number; y: number; depth: number } | null
  pixelWorldSize(distance: number): number
} = {
  pick: () => null,
  project: () => null,
  pixelWorldSize: () => 0,
}

const v = new THREE.Vector3()

export function Picker() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)

  useEffect(() => {
    const focal = () => size.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))

    pickerApi.project = (p) => {
      v.copy(p).applyMatrix4(camera.matrixWorldInverse)
      if (v.z > -camera.near) return null
      const depth = -v.z
      v.copy(p).project(camera)
      return { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height, depth }
    }

    pickerApi.pixelWorldSize = (distance) => distance / focal()

    pickerApi.pick = (clientX, clientY) => {
      const rect = gl.domElement.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      const system = getActiveSystem()
      if (!system) return null
      const f = focal()
      let best: { id: Id; score: number } | null = null
      for (const rt of runtime.bodies.values()) {
        if (!rt.visible) continue
        const body = system.bodies[rt.id]
        if (!body) continue
        let worldR = rt.radius
        if (body.kind === 'nebula') worldR = body.props.size * 0.5
        if (body.kind === 'belt') continue
        const s = pickerApi.project(rt.pos)
        if (!s) continue
        const rpx = (worldR / s.depth) * f
        const d = Math.hypot(s.x - x, s.y - y)
        const inside = d <= rpx
        const tolerance = body.kind === 'nebula' ? 0 : 10
        if (!inside && d > tolerance) continue
        const score = (inside ? 0 : 1000 + d * 10) + (inside ? s.depth * 0.001 : 0) - PRIORITY[body.kind] * 5 + (body.kind === 'nebula' ? 500 : 0)
        if (!best || score < best.score) best = { id: rt.id, score }
      }
      return best?.id ?? null
    }
    if (import.meta.env.DEV) Object.assign(globalThis, { __astraPicker: pickerApi })
  }, [camera, gl, size])

  return null
}
