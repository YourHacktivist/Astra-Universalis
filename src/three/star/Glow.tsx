import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Id } from '@/core/types'
import { useUIStore } from '@/store/uiStore'
import { runtime, timeUniforms } from '../runtime'
import { focalPx } from './common'
import { BILLBOARD_VERT, CORONA_FRAG, STREAK_FRAG } from './shaders'

const quad = new THREE.PlaneGeometry(1, 1)
const tmp = new THREE.Vector3()

export interface GlowParams {
  id: Id
  radius: number
  color: THREE.Color
  intensity: number
  corona: number
  rays: number
  pointPx: number
  seed: number
  boost?: { current: number }
  alwaysMask?: boolean
  reach?: number
}

function measure(camera: THREE.PerspectiveCamera, heightPx: number, pos: THREE.Vector3, radius: number) {
  const dist = Math.max(1e-5, camera.position.distanceTo(pos))
  const lift = Math.min(radius * 1.02, dist * 0.9)
  const f = focalPx(camera, heightPx)
  return { dist, lift, f, diskPx: (radius / dist) * f, pxPerWorldLift: f / Math.max(1e-5, dist - lift) }
}

export function Corona({ id, radius, color, intensity, corona, rays, pointPx, seed, boost, alwaysMask, reach = 1 }: GlowParams) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const mesh = useRef<THREE.Mesh>(null!)

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uHalfSize: { value: new THREE.Vector2(1, 1) },
          uLift: { value: 0 },
          uColor: { value: new THREE.Color() },
          uIntensity: { value: 1 },
          uSizePx: { value: 10 },
          uDiskPx: { value: 1 },
          uCorona: { value: 1 },
          uRays: { value: 0.5 },
          uTime: timeUniforms.uTime,
          uSeed: { value: 0 },
          uResolved: { value: 0 },
        },
        vertexShader: BILLBOARD_VERT,
        fragmentShader: CORONA_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])

  useEffect(() => {
    const u = material.uniforms
    u.uColor.value.copy(color)
    u.uCorona.value = corona
    u.uRays.value = rays
    u.uSeed.value = seed
  }, [material, color, corona, rays, seed])

  useFrame(() => {
    const rt = runtime.bodies.get(id)
    if (!rt || !mesh.current) return
    const m = measure(camera, size.height, rt.pos, radius)
    const resolved = alwaysMask ? 1 : THREE.MathUtils.smoothstep(m.diskPx, 2.5, 9)
    const resolvedPx = m.diskPx * (1.5 + corona * 0.9) * reach + 28
    const sizePx = Math.min(Math.max(resolvedPx, pointPx), size.height * 4)
    const halfWorld = sizePx / m.pxPerWorldLift
    const u = material.uniforms
    u.uHalfSize.value.set(halfWorld, halfWorld)
    u.uLift.value = m.lift
    u.uSizePx.value = sizePx
    u.uDiskPx.value = m.diskPx
    u.uResolved.value = resolved
    const close = 1 / (1 + m.diskPx / 90)
    u.uIntensity.value = intensity * close * (1 + (boost?.current ?? 0))
  })

  return <mesh ref={mesh} geometry={quad} material={material} frustumCulled={false} renderOrder={5} />
}

export function LensStreak({ id, radius, color, intensity }: { id: Id; radius: number; color: THREE.Color; intensity: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const enabled = useUIStore((s) => s.view.lensFlares)
  const mesh = useRef<THREE.Mesh>(null!)

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uHalfSize: { value: new THREE.Vector2(1, 1) },
          uLift: { value: 0 },
          uColor: { value: new THREE.Color() },
          uIntensity: { value: 1 },
        },
        vertexShader: BILLBOARD_VERT,
        fragmentShader: STREAK_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => {
    material.uniforms.uColor.value.copy(color).lerp(tmpBlue, 0.6)
  }, [material, color])

  useFrame(() => {
    const rt = runtime.bodies.get(id)
    const me = mesh.current
    if (!rt || !me) return
    tmp.copy(rt.pos).project(camera)
    const onScreen = tmp.z < 1 && Math.abs(tmp.x) < 1.3 && Math.abs(tmp.y) < 1.3
    me.visible = enabled && onScreen
    if (!me.visible) return
    const m = measure(camera, size.height, rt.pos, radius)
    const halfW = Math.min(Math.max(m.diskPx * 14, 150), size.width * 0.9)
    const halfH = Math.max(m.diskPx * 0.32, 4.5)
    const u = material.uniforms
    u.uHalfSize.value.set(halfW / m.pxPerWorldLift, halfH / m.pxPerWorldLift)
    u.uLift.value = m.lift * 1.01
    u.uIntensity.value = intensity * (1 - THREE.MathUtils.smoothstep(m.diskPx, 12, 130))
  })

  return <mesh ref={mesh} geometry={quad} material={material} frustumCulled={false} renderOrder={6} />
}

const tmpBlue = new THREE.Color(0.35, 0.55, 1.0)
