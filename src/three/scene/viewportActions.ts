import * as THREE from 'three'
import { addBody } from '@/app/actions'
import type { AddKind, Id } from '@/core/types'
import { getActiveSystem } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import { exportBridge } from '../export/ExportBridge'
import { glApi } from '../SystemCanvas'
import { cameraApi } from './CameraRig'
import { pointerRay, rayOnPlane, resolvePlacement } from './dragMove'

const UP = new THREE.Vector3(0, 1, 0)
const target = new THREE.Vector3()

function context() {
  const camera = exportBridge.getState?.().camera
  const el = glApi.gl?.domElement
  const controls = cameraApi.controls
  if (!camera || !el || !controls) return null
  return { camera, rect: el.getBoundingClientRect(), controls }
}

export function addBodyAt(kind: AddKind, clientX: number, clientY: number): Id | null {
  const ctx = context()
  const system = getActiveSystem()
  if (!ctx || !system) return addBody(kind)
  const at = resolvePlacement(system, kind === 'blackhole' ? 'star' : kind, ctx.camera, ctx.rect, clientX, clientY, ctx.controls.distance)
  return addBody(kind, at ? { at } : {})
}

export function flyToPoint(clientX: number, clientY: number) {
  const ctx = context()
  if (!ctx) return
  const { camera, rect, controls } = ctx
  useUIStore.getState().follow(null)
  controls.getTarget(target)
  const ray = pointerRay(camera, rect, clientX, clientY)
  const p = rayOnPlane(ray, target, UP, controls.distance)
  const max = controls.distance * 3
  if (p.distanceTo(ray.origin) > max) ray.at(max, p)
  void controls.moveTo(p.x, p.y, p.z, true)
  void controls.dollyTo(Math.max(controls.minDistance, controls.distance * 0.55), true)
}
