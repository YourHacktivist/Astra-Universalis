import { create } from 'zustand'
import * as THREE from 'three'

export type GalaxySelType = 'system' | 'route' | 'region'
export interface GalaxySelection {
  type: GalaxySelType
  id: string
}
export type GalaxyTool = 'select' | 'system' | 'route' | 'region'

export type GalaxyCameraRequest =
  | { type: 'focus'; local: [number, number, number]; distance?: number; instant?: boolean }
  | { type: 'frame'; instant?: boolean }
  | { type: 'restore'; position: [number, number, number]; target: [number, number, number] }

interface GalaxyUIState {
  selection: GalaxySelection | null
  hovered: GalaxySelection | null
  tool: GalaxyTool
  routeStart: string | null
  rotate: boolean
  labels: boolean
  routes: boolean
  regions: boolean
  request: GalaxyCameraRequest | null
  select(s: GalaxySelection | null): void
  hover(s: GalaxySelection | null): void
  setTool(t: GalaxyTool): void
  setRouteStart(id: string | null): void
  toggle(key: 'rotate' | 'labels' | 'routes' | 'regions'): void
  requestCamera(r: GalaxyCameraRequest): void
  consumeRequest(): GalaxyCameraRequest | null
}

export const useGalaxyUI = create<GalaxyUIState>()((set, get) => ({
  selection: null,
  hovered: null,
  tool: 'select',
  routeStart: null,
  rotate: false,
  labels: true,
  routes: true,
  regions: true,
  request: null,
  select: (selection) => set({ selection }),
  hover: (hovered) => {
    const h = get().hovered
    if (h?.id !== hovered?.id || h?.type !== hovered?.type) set({ hovered })
  },
  setTool: (tool) => set({ tool, routeStart: null }),
  setRouteStart: (routeStart) => set({ routeStart }),
  toggle: (key) => set({ [key]: !get()[key] } as Partial<GalaxyUIState>),
  requestCamera: (request) => set({ request }),
  consumeRequest() {
    const r = get().request
    if (r) set({ request: null })
    return r
  },
}))

export const GALAXY_SCALE = 0.01

export const galaxyRuntime: {
  group: THREE.Group | null
  camera: THREE.PerspectiveCamera | null
  size: { width: number; height: number }
  angle: number
} = { group: null, camera: null, size: { width: 1, height: 1 }, angle: 0 }

const tmp = new THREE.Vector3()

export function projectLocal(x: number, y: number, z: number): { x: number; y: number; depth: number } | null {
  const cam = galaxyRuntime.camera
  if (!cam) return null
  tmp.set(x, y, z)
  if (galaxyRuntime.group) tmp.applyMatrix4(galaxyRuntime.group.matrixWorld)
  const world = tmp.clone()
  tmp.applyMatrix4(cam.matrixWorldInverse)
  if (tmp.z > -cam.near) return null
  const depth = -tmp.z
  world.project(cam)
  const { width, height } = galaxyRuntime.size
  return { x: ((world.x + 1) / 2) * width, y: ((1 - world.y) / 2) * height, depth }
}
