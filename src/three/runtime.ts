import * as THREE from 'three'
import type { BodyKind, Id } from '@/core/types'

export interface BodyRuntime {
  id: Id
  kind: BodyKind
  pos: THREE.Vector3
  vel: THREE.Vector3
  posAU: THREE.Vector3
  parentPos: THREE.Vector3
  radius: number
  clearance: number
  spin: number
  phase: number
  distanceAU: number
  periodDays: number
  tilt: THREE.Quaternion
  visible: boolean
}

export function createRuntime(id: Id, kind: BodyKind): BodyRuntime {
  return {
    id,
    kind,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(1, 0, 0),
    posAU: new THREE.Vector3(),
    parentPos: new THREE.Vector3(),
    radius: 0,
    clearance: 0,
    spin: 0,
    phase: 0,
    distanceAU: 0,
    periodDays: Infinity,
    tilt: new THREE.Quaternion(),
    visible: true,
  }
}

export const runtime = {
  bodies: new Map<Id, BodyRuntime>(),
  time: 0,
  elapsed: 0,
  order: [] as Id[],
  version: 0,
}

export function getRuntime(id: Id | null | undefined): BodyRuntime | undefined {
  return id ? runtime.bodies.get(id) : undefined
}

export const MAX_STAR_LIGHTS = 4

export const lightUniforms = {
  uStarPos: { value: Array.from({ length: MAX_STAR_LIGHTS }, () => new THREE.Vector3()) },
  uStarColor: { value: Array.from({ length: MAX_STAR_LIGHTS }, () => new THREE.Vector3()) },
  uStarRadius: { value: new Array<number>(MAX_STAR_LIGHTS).fill(0) },
  uStarCount: { value: 0 },
  uAmbient: { value: 0.04 },
}

export const timeUniforms = {
  uTime: { value: 0 },
  uSimTime: { value: 0 },
}

export const lightSources: Id[] = []
