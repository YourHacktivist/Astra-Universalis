import { create } from 'zustand'
import type { AddKind, Id } from '@/core/types'
import { uid } from '@/lib/id'

export type AppMode = 'system' | 'galaxy' | 'sheet'
export type Quality = 'low' | 'medium' | 'high' | 'ultra'
export type RenderStyle = 'cinematic' | 'terminal' | 'blueprint'
export type InspectorTab = 'general' | 'orbit' | 'physics' | 'appearance' | 'notes'
export type DialogId =
  | 'export'
  | 'settings'
  | 'generator'
  | 'travel'
  | 'shortcuts'
  | 'about'
  | 'systemSettings'
  | 'confirmClose'

export interface ViewOptions {
  orbits: boolean
  orbitScope: 'all' | 'major' | 'selected'
  labels: boolean
  moonLabels: boolean
  glints: boolean
  axes: boolean
  equators: boolean
  grid: boolean
  habitableZone: boolean
  frostLine: boolean
  routes: boolean
  starfield: boolean
  bloom: boolean
  lensFlares: boolean
  grain: boolean
  vignette: boolean
}

export const DEFAULT_VIEW: ViewOptions = {
  orbits: true,
  orbitScope: 'all',
  labels: true,
  moonLabels: true,
  glints: true,
  axes: false,
  equators: false,
  grid: false,
  habitableZone: false,
  frostLine: false,
  routes: true,
  starfield: true,
  bloom: true,
  lensFlares: true,
  grain: true,
  vignette: true,
}

export type CameraRequest =
  | { type: 'focus'; id: Id; follow?: boolean; instant?: boolean }
  | { type: 'frame'; instant?: boolean }
  | { type: 'preset'; preset: 'top' | 'side' | 'iso' }
  | { type: 'restore'; position: [number, number, number]; target: [number, number, number]; instant?: boolean }

export interface Toast {
  id: string
  kind: 'info' | 'success' | 'warning' | 'error'
  title: string
  message?: string
  duration: number
}

export interface ContextMenuState {
  x: number
  y: number
  bodyId: Id | null
}

export type PlacingKind = AddKind | null

export interface ConfirmRequest {
  title: string
  message?: string
  actions: { id: string; label: string; tone?: 'primary' | 'danger' | 'secondary' }[]
  cancelId: string
}

interface PersistedPrefs {
  view: ViewOptions
  quality: Quality
  renderStyle: RenderStyle
  panels: { hierarchy: boolean; inspector: boolean }
  hierarchyWidth: number
  inspectorWidth: number
}

const PREFS_KEY = 'astra.prefs.v1'

function loadPrefs(): Partial<PersistedPrefs> {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')
  } catch {
    return {}
  }
}

interface UIState extends PersistedPrefs {
  mode: AppMode
  showHome: boolean
  selectedId: Id | null
  selectedRouteId: Id | null
  hoveredId: Id | null
  followId: Id | null
  playerMode: boolean
  inspectorTab: InspectorTab
  dialog: DialogId | null
  commandOpen: boolean
  contextMenu: ContextMenuState | null
  cameraRequest: CameraRequest | null
  toasts: Toast[]
  exporting: boolean
  confirm: (ConfirmRequest & { resolve(id: string): void }) | null
  immersive: boolean
  cinematicDrift: boolean
  letterbox: boolean
  renameRequest: { id: Id; n: number } | null
  moveTool: boolean
  viewLost: boolean
  placing: PlacingKind

  setMode(mode: AppMode): void
  setShowHome(v: boolean): void
  select(id: Id | null): void
  selectRoute(id: Id | null): void
  hover(id: Id | null): void
  follow(id: Id | null): void
  setPlayerMode(v: boolean): void
  setInspectorTab(tab: InspectorTab): void
  openDialog(d: DialogId | null): void
  setCommandOpen(v: boolean): void
  openContextMenu(m: ContextMenuState | null): void
  requestCamera(r: CameraRequest): void
  consumeCameraRequest(): CameraRequest | null
  setView(patch: Partial<ViewOptions>): void
  toggleView(key: keyof ViewOptions): void
  setQuality(q: Quality): void
  setRenderStyle(s: RenderStyle): void
  togglePanel(p: 'hierarchy' | 'inspector'): void
  setPanelWidth(p: 'hierarchy' | 'inspector', w: number): void
  toast(t: Omit<Toast, 'id' | 'duration'> & { duration?: number }): string
  dismissToast(id: string): void
  setExporting(v: boolean): void
  askConfirm(req: ConfirmRequest): Promise<string>
  resolveConfirm(id: string): void
  setImmersive(v: boolean): void
  setCinematicDrift(v: boolean): void
  setLetterbox(v: boolean): void
  requestRename(id: Id): void
  setMoveTool(v: boolean): void
  setViewLost(v: boolean): void
  setPlacing(kind: PlacingKind): void
}

const prefs = loadPrefs()

export const useUIStore = create<UIState>()((set, get) => ({
  view: { ...DEFAULT_VIEW, ...(prefs.view ?? {}) },
  quality: prefs.quality ?? 'high',
  renderStyle: prefs.renderStyle ?? 'cinematic',
  panels: { hierarchy: true, inspector: true, ...(prefs.panels ?? {}) },
  hierarchyWidth: prefs.hierarchyWidth ?? 280,
  inspectorWidth: prefs.inspectorWidth ?? 340,

  mode: 'system',
  showHome: true,
  selectedId: null,
  selectedRouteId: null,
  hoveredId: null,
  followId: null,
  playerMode: false,
  inspectorTab: 'general',
  dialog: null,
  commandOpen: false,
  contextMenu: null,
  cameraRequest: null,
  toasts: [],
  exporting: false,
  confirm: null,
  immersive: false,
  cinematicDrift: true,
  letterbox: false,
  renameRequest: null,
  moveTool: false,
  viewLost: false,
  placing: null,

  setMode: (mode) => set({ mode }),
  setShowHome: (showHome) => set({ showHome }),
  select: (selectedId) => set({ selectedId, selectedRouteId: null }),
  selectRoute: (selectedRouteId) => set({ selectedRouteId, selectedId: null }),
  hover: (hoveredId) => {
    if (get().hoveredId !== hoveredId) set({ hoveredId })
  },
  follow: (followId) => set({ followId }),
  setPlayerMode: (playerMode) => set({ playerMode }),
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  openDialog: (dialog) => set({ dialog }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  openContextMenu: (contextMenu) => set({ contextMenu }),
  requestCamera: (cameraRequest) => set({ cameraRequest }),
  consumeCameraRequest() {
    const r = get().cameraRequest
    if (r) set({ cameraRequest: null })
    return r
  },
  setView: (patch) => set({ view: { ...get().view, ...patch } }),
  toggleView: (key) => {
    const v = get().view
    const cur = v[key]
    if (typeof cur === 'boolean') set({ view: { ...v, [key]: !cur } })
  },
  setQuality: (quality) => set({ quality }),
  setRenderStyle: (renderStyle) => set({ renderStyle }),
  togglePanel: (p) => set({ panels: { ...get().panels, [p]: !get().panels[p] } }),
  setPanelWidth: (p, w) => set(p === 'hierarchy' ? { hierarchyWidth: w } : { inspectorWidth: w }),
  toast(t) {
    const id = uid('t')
    const toast: Toast = { duration: t.kind === 'error' ? 7000 : 3800, ...t, id }
    set({ toasts: [...get().toasts, toast].slice(-5) })
    if (toast.duration > 0) setTimeout(() => get().dismissToast(id), toast.duration)
    return id
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  setExporting: (exporting) => set({ exporting }),
  askConfirm(req) {
    const prev = get().confirm
    if (prev) prev.resolve(prev.cancelId)
    return new Promise<string>((resolve) => {
      set({ confirm: { ...req, resolve } })
    })
  },
  resolveConfirm(id) {
    const c = get().confirm
    if (!c) return
    set({ confirm: null })
    c.resolve(id)
  },
  setImmersive: (immersive) => set({ immersive, contextMenu: null, showHome: false }),
  setMoveTool: (moveTool) => set({ moveTool, placing: null }),
  setViewLost: (viewLost) => {
    if (get().viewLost !== viewLost) set({ viewLost })
  },
  setPlacing: (placing) => set({ placing, moveTool: false, contextMenu: null }),
  setCinematicDrift: (cinematicDrift) => set({ cinematicDrift }),
  setLetterbox: (letterbox) => set({ letterbox }),
  requestRename(id) {
    const prev = get().renameRequest
    set({
      selectedId: id,
      selectedRouteId: null,
      immersive: false,
      panels: { ...get().panels, inspector: true },
      inspectorTab: get().inspectorTab,
      renameRequest: { id, n: (prev?.n ?? 0) + 1 },
    })
  },
}))

let saveTimer: ReturnType<typeof setTimeout> | null = null
useUIStore.subscribe((s, prev) => {
  if (
    s.view === prev.view &&
    s.quality === prev.quality &&
    s.renderStyle === prev.renderStyle &&
    s.panels === prev.panels &&
    s.hierarchyWidth === prev.hierarchyWidth &&
    s.inspectorWidth === prev.inspectorWidth
  )
    return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const data: PersistedPrefs = {
      view: s.view,
      quality: s.quality,
      renderStyle: s.renderStyle,
      panels: s.panels,
      hierarchyWidth: s.hierarchyWidth,
      inspectorWidth: s.inspectorWidth,
    }
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(data))
    } catch {
    }
  }, 300)
})

export const toast = (t: Parameters<UIState['toast']>[0]) => useUIStore.getState().toast(t)
