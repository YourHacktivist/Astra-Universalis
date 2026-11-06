import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { runtime } from '../runtime'
import { labelRegistry, labelState, type LabelEntry } from './labels'
import { pickerApi } from './Picker'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const BELT_ANGLE = THREE.MathUtils.degToRad(-38)
const tmp = new THREE.Vector3()
let sorted: LabelEntry[] = []
let sortedVersion = -1
const placed: Rect[] = []

function overlaps(r: Rect) {
  for (const p of placed) {
    if (r.x < p.x + p.w && r.x + r.w > p.x && r.y < p.y + p.h && r.y + r.h > p.y) return true
  }
  return false
}

export function LabelUpdater() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)

  useFrame(() => {
    if (sortedVersion !== labelState.version) {
      sorted = [...labelRegistry.values()].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.priority - a.priority)
      sortedVersion = labelState.version
    }
    placed.length = 0
    const focal = size.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))

    for (const e of sorted) {
      let alpha = 1
      let offsetPx = 6
      let visible = true
      if (e.bodyId) {
        const rt = runtime.bodies.get(e.bodyId)
        if (!rt || !rt.visible) visible = false
        else if (e.ringRadius) {
          const prt = e.parentId ? runtime.bodies.get(e.parentId) : null
          tmp.set(Math.cos(BELT_ANGLE) * e.ringRadius, 0, Math.sin(BELT_ANGLE) * e.ringRadius)
          if (prt) tmp.add(prt.pos)
        } else tmp.copy(rt.pos)
        if (visible && rt) {
          const s = pickerApi.project(tmp)
          if (!s) visible = false
          else {
            const rpx = e.ringRadius ? 0 : (rt.radius / s.depth) * focal
            offsetPx = Math.max(rpx, 2.5) + 7
            if (e.parentId && !e.ringRadius && !e.pinned) {
              const prt = runtime.bodies.get(e.parentId)
              if (prt) {
                const ps = pickerApi.project(prt.pos)
                if (ps) {
                  const prpx = (prt.radius / ps.depth) * focal
                  const sep = Math.hypot(s.x - ps.x, s.y - ps.y) - prpx
                  alpha = THREE.MathUtils.smoothstep(sep, 14, 36)
                }
              }
            }
            place(e, s.x + offsetPx, s.y, alpha)
            continue
          }
        }
      } else if (e.point) {
        tmp.copy(e.point)
        if (e.anchorId) {
          const art = runtime.bodies.get(e.anchorId)
          if (art) tmp.add(art.pos)
        }
        const s = pickerApi.project(tmp)
        if (s) {
          place(e, s.x + 4, s.y, 1)
          continue
        }
        visible = false
      }
      if (!visible) hide(e)
    }
  })

  return null
}

function hide(e: LabelEntry) {
  if (e.el.style.opacity !== '0') {
    e.el.style.opacity = '0'
    e.el.style.visibility = 'hidden'
  }
}

function place(e: LabelEntry, x: number, y: number, alpha: number) {
  if (alpha <= 0.02) return hide(e)
  const r: Rect = { x: x - 2, y: y - e.height / 2 - 1, w: e.width + 4, h: e.height + 2 }
  if (!e.pinned && overlaps(r)) return hide(e)
  placed.push(r)
  e.el.style.transform = `translate3d(${x.toFixed(1)}px, ${(y - e.height / 2).toFixed(1)}px, 0)`
  e.el.style.opacity = alpha.toFixed(3)
  e.el.style.visibility = 'visible'
}
