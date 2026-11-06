import * as THREE from 'three'
import type { BodyKind, Id } from '@/core/types'

export interface LabelEntry {
  id: string
  el: HTMLElement
  priority: number
  kind: BodyKind | 'grid' | 'route'
  bodyId?: Id
  parentId?: Id | null
  point?: THREE.Vector3
  anchorId?: Id | null
  ringRadius?: number
  pinned?: boolean
  width: number
  height: number
}

export const labelRegistry = new Map<string, LabelEntry>()
export const labelState = { version: 0 }

export function registerLabel(entry: LabelEntry) {
  labelRegistry.set(entry.id, entry)
  labelState.version++
}

export function unregisterLabel(id: string) {
  labelRegistry.delete(id)
  labelState.version++
}

export const LABEL_PRIORITY: Record<LabelEntry['kind'], number> = {
  star: 100,
  barycenter: 10,
  planet: 80,
  gate: 70,
  station: 65,
  nebula: 60,
  belt: 55,
  comet: 50,
  ship: 45,
  marker: 62,
  moon: 40,
  grid: 5,
  route: 30,
}
