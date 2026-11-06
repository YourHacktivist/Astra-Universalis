import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createOrbitState, DEG, orbitStateAt, TAU } from '@/core/orbits'
import { buildChildrenMap, resolvedPeriod, topoOrder } from '@/core/hierarchy'
import {
  bodyClearanceRadius,
  bodyVisualRadius,
  mapOrbitDistance,
  parentScaleInfo,
  type ParentScaleInfo,
} from '@/core/scale'
import type { Body, Id, StarSystem } from '@/core/types'
import { blackbodyRgb, hexToRgb } from '@/lib/color'
import { simClock, tickSim } from '@/store/simStore'
import { useUIStore } from '@/store/uiStore'
import {
  createRuntime,
  lightSources,
  lightUniforms,
  MAX_STAR_LIGHTS,
  runtime,
  timeUniforms,
  type BodyRuntime,
} from './runtime'

interface PreparedBody {
  body: Body
  rt: BodyRuntime
  parent: BodyRuntime | null
  parentInfo: ParentScaleInfo
  period: number
  visible: boolean
}

interface PreparedLight {
  rt: BodyRuntime
  color: THREE.Vector3
}

interface Prepared {
  items: PreparedBody[]
  lights: PreparedLight[]
  system: StarSystem
}

const qx = new THREE.Quaternion()
const qy = new THREE.Quaternion()
const AX = new THREE.Vector3(1, 0, 0)
const AY = new THREE.Vector3(0, 1, 0)

export function starLightIntensity(luminosity: number) {
  return THREE.MathUtils.clamp(1 + 0.18 * Math.log10(Math.max(luminosity, 1e-4)), 0.35, 1.8)
}

function prepare(system: StarSystem, playerMode: boolean): Prepared {
  const { bodies, display } = system
  const order = topoOrder(bodies)
  const children = buildChildrenMap(bodies)
  const seen = new Set<Id>()
  const items: PreparedBody[] = []
  const visibleById = new Map<Id, boolean>()

  for (const body of order) {
    seen.add(body.id)
    let rt = runtime.bodies.get(body.id)
    if (!rt || rt.kind !== body.kind) {
      rt = createRuntime(body.id, body.kind)
      runtime.bodies.set(body.id, rt)
    }
    const parentBody = body.parentId ? bodies[body.parentId] : undefined
    const parent = parentBody ? runtime.bodies.get(parentBody.id) ?? null : null
    const parentInfo: ParentScaleInfo = parentScaleInfo(parentBody, display)
    rt.radius = bodyVisualRadius(body, display)
    rt.clearance = bodyClearanceRadius(body, display)
    rt.periodDays = resolvedPeriod(bodies, body, children)
    qx.setFromAxisAngle(AX, body.rotation.tilt * DEG)
    qy.setFromAxisAngle(AY, body.rotation.azimuth * DEG)
    rt.tilt.copy(qy).multiply(qx)
    const parentVisible = parentBody ? visibleById.get(parentBody.id) ?? true : true
    const visible = parentVisible && body.visible && (!playerMode || body.playerVisible)
    visibleById.set(body.id, visible)
    items.push({ body, rt, parent, parentInfo, period: rt.periodDays, visible })
  }
  for (const id of [...runtime.bodies.keys()]) if (!seen.has(id)) runtime.bodies.delete(id)
  runtime.order = order.map((b) => b.id)
  runtime.version++

  const lights: PreparedLight[] = items
    .filter((it) => it.body.kind === 'star' && it.visible)
    .map((it) => {
      const s = it.body as Extract<Body, { kind: 'star' }>
      const p = s.props
      const rgb =
        p.starClass === 'BH'
          ? hexToRgb(p.diskColorInner)
          : p.colorOverride
            ? hexToRgb(p.colorOverride)
            : blackbodyRgb(p.temperature)
      const c = new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace)
      const white = new THREE.Color(1, 1, 1)
      c.lerp(white, 0.35)
      const k = p.starClass === 'BH' ? 0.8 * p.diskBrightness : starLightIntensity(p.luminosity)
      return { rt: it.rt, color: new THREE.Vector3(c.r * k, c.g * k, c.b * k), lum: p.luminosity }
    })
    .sort((a, b) => b.lum - a.lum)
    .slice(0, MAX_STAR_LIGHTS)

  return { items, lights, system }
}

const os = createOrbitState()

function step(prep: Prepared, t: number) {
  const display = prep.system.display
  for (const it of prep.items) {
    const { body, rt, parent } = it
    rt.visible = it.visible
    if (parent) rt.parentPos.copy(parent.pos)
    else rt.parentPos.set(0, 0, 0)
    const o = body.orbit
    if (o) {
      orbitStateAt(o, it.period, t, os)
      const d = mapOrbitDistance(os.r, it.parentInfo, display)
      const k = os.r > 0 ? d / os.r : 0
      rt.pos.set(rt.parentPos.x + os.x * k, rt.parentPos.y + os.y * k, rt.parentPos.z + os.z * k)
      if (parent) rt.posAU.set(parent.posAU.x + os.x, parent.posAU.y + os.y, parent.posAU.z + os.z)
      else rt.posAU.set(os.x, os.y, os.z)
      rt.vel.set(os.vx, os.vy, os.vz)
      rt.phase = os.phase
      rt.distanceAU = os.r
    } else {
      rt.pos.copy(rt.parentPos)
      if (parent) rt.posAU.copy(parent.posAU)
      else rt.posAU.set(0, 0, 0)
      rt.distanceAU = 0
    }

    const rot = body.rotation
    if (rot.locked && o && parent) {
      const dx = rt.parentPos.x - rt.pos.x
      const dz = rt.parentPos.z - rt.pos.z
      rt.spin = Math.atan2(-dz, dx) + rot.phase * DEG
    } else if (rot.period) {
      const turns = (t * 24) / rot.period
      rt.spin = ((turns % 1) * TAU + rot.phase * DEG) % TAU
    } else {
      rt.spin = rot.phase * DEG
    }
  }

  const lu = lightUniforms
  let n = 0
  lightSources.length = 0
  for (const l of prep.lights) {
    if (n >= MAX_STAR_LIGHTS) break
    lu.uStarPos.value[n].copy(l.rt.pos)
    lu.uStarColor.value[n].copy(l.color)
    lu.uStarRadius.value[n] = l.rt.radius
    lightSources.push(l.rt.id)
    n++
  }
  lu.uStarCount.value = n
  lu.uAmbient.value = prep.system.environment.ambient
}

export function SimulationDriver({ system }: { system: StarSystem }) {
  const playerMode = useUIStore((s) => s.playerMode)
  const prep = useMemo(() => prepare(system, playerMode), [system, playerMode])
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(globalThis, { __astraRuntime: runtime, __astraLights: lightUniforms })
  }, [])

  useFrame((state, delta) => {
    tickSim(delta)
    runtime.time = simClock.time
    runtime.elapsed = state.clock.elapsedTime
    timeUniforms.uTime.value = state.clock.elapsedTime
    timeUniforms.uSimTime.value = simClock.time
    step(prep, simClock.time)
  }, -100)

  return null
}

export function stepNow(system: StarSystem, t: number, playerMode = false) {
  step(prepare(system, playerMode), t)
}
