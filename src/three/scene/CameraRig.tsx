import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CameraControls, CameraControlsImpl } from '@react-three/drei'
import * as THREE from 'three'
import type { Id, StarSystem } from '@/core/types'
import { mapOrbitDistance, parentScaleInfo } from '@/core/scale'
import { prefersReducedMotion } from '@/lib/a11y'
import { getActiveSystem } from '@/store/projectStore'
import { useUIStore, type CameraRequest } from '@/store/uiStore'
import { runtime } from '../runtime'

const ACTION = CameraControlsImpl.ACTION

export const cameraApi: {
  controls: CameraControlsImpl | null
  getState(): { position: [number, number, number]; target: [number, number, number] } | null
} = {
  controls: null,
  getState() {
    const c = this.controls
    if (!c) return null
    const p = c.getPosition(new THREE.Vector3())
    const t = c.getTarget(new THREE.Vector3())
    return { position: [p.x, p.y, p.z], target: [t.x, t.y, t.z] }
  },
}

const tmpA = new THREE.Vector3()
const tmpB = new THREE.Vector3()
const tmpDir = new THREE.Vector3()

export function framingRadius(id: Id): number {
  const rt = runtime.bodies.get(id)
  if (!rt) return 5
  let extent = Math.max(rt.radius * 3.2, rt.clearance * 1.6, 0.05)
  const system = getActiveSystem()
  if (system) {
    for (const b of Object.values(system.bodies)) {
      if (b.parentId !== id) continue
      const c = runtime.bodies.get(b.id)
      if (!c || !c.visible) continue
      if (b.kind === 'belt') {
        extent = Math.max(extent, rt.clearance + 30)
        continue
      }
      extent = Math.max(extent, c.pos.distanceTo(rt.pos) * 1.15 + c.radius)
    }
    const body = system.bodies[id]
    if (body?.kind === 'nebula') extent = Math.max(extent, body.props.size * 1.2)
    if (body?.kind === 'belt') {
      const host = body.parentId ? system.bodies[body.parentId] : null
      extent = Math.max(extent, mapOrbitDistance(body.props.outer, parentScaleInfo(host, system.display), system.display) * 1.12)
    }
  }
  return extent
}

export function systemRadius(): number {
  let r = 2
  for (const rt of runtime.bodies.values()) {
    if (!rt.visible) continue
    r = Math.max(r, rt.pos.length() + rt.radius)
    if (rt.kind === 'star') r = Math.max(r, rt.radius * 9)
  }
  const system = getActiveSystem()
  if (system) {
    for (const b of Object.values(system.bodies)) {
      if (b.kind === 'belt') {
        const parent = b.parentId ? runtime.bodies.get(b.parentId) : null
        r = Math.max(r, (parent?.clearance ?? 0) + 22 * Math.sqrt(b.props.outer) * system.display.distanceScale)
      }
    }
  }
  return r
}

export function CameraRig({ system }: { system: StarSystem }) {
  const ref = useRef<CameraControlsImpl>(null)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const followSettled = useRef(false)
  const lostTick = useRef(0)
  const lastSystemId = useRef<string | null>(null)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    cameraApi.controls = c
    if (import.meta.env.DEV) Object.assign(globalThis, { __astraCamera: cameraApi })
    c.mouseButtons.left = ACTION.ROTATE
    c.mouseButtons.right = ACTION.TRUCK
    c.mouseButtons.middle = ACTION.DOLLY
    c.mouseButtons.wheel = ACTION.DOLLY
    c.minDistance = 0.02
    const onStart = () => {
      if (c.currentAction === ACTION.TRUCK && useUIStore.getState().followId) useUIStore.getState().follow(null)
    }
    c.addEventListener('controlstart', onStart)
    return () => {
      c.removeEventListener('controlstart', onStart)
      if (cameraApi.controls === c) cameraApi.controls = null
    }
  }, [])

  const gl = useThree((s) => s.gl)
  const autoFollow = useRef<string | null>(null)
  useEffect(() => {
    const el = gl.domElement
    const onWheel = () => {
      const ui = useUIStore.getState()
      if (!ui.selectedId || ui.followId === ui.selectedId || ui.placing) return
      const rt = runtime.bodies.get(ui.selectedId)
      if (!rt || !rt.visible) return
      autoFollow.current = ui.selectedId
      ui.follow(ui.selectedId)
    }
    el.addEventListener('wheel', onWheel, { capture: true, passive: true })
    const unsub = useUIStore.subscribe((s, prev) => {
      if (s.selectedId === prev.selectedId) return
      if (autoFollow.current && s.followId === autoFollow.current && s.selectedId !== autoFollow.current) s.follow(null)
      if (s.selectedId !== autoFollow.current) autoFollow.current = null
    })
    return () => {
      el.removeEventListener('wheel', onWheel, { capture: true })
      unsub()
    }
  }, [gl])

  const showHome = useUIStore((s) => s.showHome)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    if (showHome) useUIStore.getState().requestCamera({ type: 'frame' })
    else void c.setFocalOffset(0, 0, 0, true)
  }, [showHome])

  useEffect(() => {
    if (lastSystemId.current === system.id) return
    lastSystemId.current = system.id
    const cam = system.view.camera
    const id = requestAnimationFrame(() => {
      const home = useUIStore.getState().showHome
      if (cam && !home) useUIStore.getState().requestCamera({ type: 'restore', position: cam.position, target: cam.target, instant: true })
      else useUIStore.getState().requestCamera({ type: 'frame', instant: true })
    })
    return () => cancelAnimationFrame(id)
  }, [system.id, system.view.camera])

  useFrame((_, delta) => {
    const c = ref.current
    if (!c) return
    const ui = useUIStore.getState()

    if (ui.cameraRequest) handleRequest(c, ui.consumeCameraRequest()!, camera, followSettled)

    const wantCursor = !ui.selectedId && !ui.followId
    if (c.dollyToCursor !== wantCursor) c.dollyToCursor = wantCursor

    if (((ui.immersive && ui.cinematicDrift) || ui.showHome) && c.currentAction === ACTION.NONE && !ui.exporting && !prefersReducedMotion()) {
      c.rotate(Math.min(delta, 0.1) * 0.035, 0, false)
    }

    let minDist = 0.02
    if (ui.followId) {
      const rt = runtime.bodies.get(ui.followId)
      if (rt) {
        c.getTarget(tmpA)
        if (!followSettled.current && tmpA.distanceTo(rt.pos) < Math.max(rt.radius * 0.05, 0.002)) followSettled.current = true
        c.moveTo(rt.pos.x, rt.pos.y, rt.pos.z, !followSettled.current)
        minDist = Math.max(minDist, rt.radius * 1.12)
      }
    } else {
      followSettled.current = false
    }
    if (c.minDistance !== minDist) {
      c.minDistance = minDist
      if (c.distance < minDist) void c.dollyTo(minDist, true)
    }

    lostTick.current = (lostTick.current + 1) % 20
    if (lostTick.current === 0 && !ui.exporting) {
      const pos = camera.position
      let lost = false
      for (const rt of runtime.bodies.values()) {
        if (!rt.visible || rt.radius <= 0 || (rt.kind !== 'star' && rt.kind !== 'planet' && rt.kind !== 'moon')) continue
        if (pos.distanceTo(rt.pos) < rt.radius * 0.98) {
          lost = true
          break
        }
      }
      if (!lost) lost = c.distance > systemRadius() * 14
      ui.setViewLost(lost)
    }

    const d = Math.max(0.001, c.distance)
    const near = THREE.MathUtils.clamp(d * 0.002, 0.0004, 4)
    const far = Math.max(60000, d * 80)
    if (Math.abs(camera.near - near) / near > 0.1 || camera.far !== far) {
      camera.near = near
      camera.far = far
      camera.updateProjectionMatrix()
    }
  })

  return (
    <CameraControls
      ref={ref}
      makeDefault
      maxDistance={30000}
      smoothTime={0.32}
      draggingSmoothTime={0.12}
      dollyToCursor
      dollySpeed={0.6}
      truckSpeed={1.6}
    />
  )
}

function handleRequest(
  c: CameraControlsImpl,
  request: CameraRequest,
  camera: THREE.PerspectiveCamera,
  followSettled: { current: boolean },
) {
  const req = prefersReducedMotion() && request.type !== 'preset' ? { ...request, instant: true } : request
  const fovFactor = 1 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
  switch (req.type) {
    case 'focus': {
      const rt = runtime.bodies.get(req.id)
      if (!rt) return
      const radius = framingRadius(req.id)
      const dist = Math.max(radius * fovFactor * 1.05, 0.05)
      c.getPosition(tmpA)
      c.getTarget(tmpB)
      tmpDir.subVectors(tmpA, tmpB)
      if (tmpDir.lengthSq() < 1e-9) tmpDir.set(0, 0.5, 1)
      tmpDir.normalize()
      if (Math.abs(tmpDir.y) > 0.97) tmpDir.set(tmpDir.x, 0.9, tmpDir.z + 0.3).normalize()
      const p = rt.pos
      c.setLookAt(p.x + tmpDir.x * dist, p.y + tmpDir.y * dist, p.z + tmpDir.z * dist, p.x, p.y, p.z, !req.instant)
      followSettled.current = !!req.instant
      if (req.follow !== false) useUIStore.getState().follow(req.id)
      return
    }
    case 'frame': {
      const ui = useUIStore.getState()
      ui.follow(null)
      const r = systemRadius()
      let dist = r * fovFactor * 0.95
      let offset = 0
      if (ui.showHome) {
        const W = window.innerWidth
        const H = Math.max(1, window.innerHeight - 40)
        const col = Math.max(360, Math.min(470, W * 0.44))
        const free = Math.max(0.3, (W - col) / W)
        dist /= Math.min(1, (free * W) / H) * 0.92
        const worldPerPx = (2 * dist) / (fovFactor * H)
        offset = -(col / 2) * worldPerPx
      }
      const dir = tmpDir.set(0, 0.62, 1).normalize()
      c.setLookAt(dir.x * dist, dir.y * dist, dir.z * dist, 0, 0, 0, !req.instant)
      void c.setFocalOffset(offset, 0, 0, !req.instant)
      return
    }
    case 'preset': {
      const polar = req.preset === 'top' ? 0.0001 : req.preset === 'side' ? Math.PI / 2 - 0.0001 : 1.0
      c.rotatePolarTo(polar, true)
      return
    }
    case 'restore': {
      const [px, py, pz] = req.position
      const [tx, ty, tz] = req.target
      c.setLookAt(px, py, pz, tx, ty, tz, !req.instant)
      return
    }
  }
}
