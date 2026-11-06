import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { formatDays, formatDistanceAU } from '@/lib/format'
import { splashDone, splashStep } from '@/lib/splash'
import { getActiveSystem, useActiveSystem, useProjectStore } from '@/store/projectStore'
import { simClock, useSimStore } from '@/store/simStore'
import { useUIStore, type Quality } from '@/store/uiStore'
import { exportBridge } from './export/ExportBridge'
import { runtime } from './runtime'
import { SystemScene } from './SystemScene'
import { cameraApi } from './scene/CameraRig'
import { isDraggable, pointerOnOrbitPlane, solveOrbitForPoint } from './scene/dragMove'
import { LabelLayer } from './scene/LabelLayer'
import { pickerApi } from './scene/Picker'
import { addBodyAt, flyToPoint } from './scene/viewportActions'

export const QUALITY_DPR: Record<Quality, [number, number]> = {
  low: [0.75, 1],
  medium: [1, 1.25],
  high: [1, 1.75],
  ultra: [1, 2],
}

export const glApi: { gl: THREE.WebGLRenderer | null } = { gl: null }

const DIRECT_DRAG_MAX_PX = 48

export function RenderOnResize() {
  const get = useThree((s) => s.get)
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)
  const dpr = useThree((s) => s.viewport.dpr)
  useLayoutEffect(() => {
    get().advance(performance.now(), true)
  }, [get, width, height, dpr])
  return null
}

function SceneWarmup({ systemId, onReady }: { systemId: string | undefined; onReady(): void }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  useLayoutEffect(() => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      onReady()
    }
    const timer = setTimeout(finish, 3500)
    const raf = requestAnimationFrame(() => {
      gl.compileAsync(scene, camera).then(finish, finish)
    })
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(raf)
    }
  }, [gl, scene, camera, systemId, onReady])
  return null
}

interface DragState {
  id: string
  x: number
  y: number
  started: boolean
  wasPlaying: boolean
}

function screenRadiusPx(id: string) {
  const rt = runtime.bodies.get(id)
  if (!rt) return Infinity
  const s = pickerApi.project(rt.pos)
  if (!s) return Infinity
  return rt.radius / Math.max(1e-9, pickerApi.pixelWorldSize(s.depth))
}

export function SystemCanvas() {
  const system = useActiveSystem()
  const quality = useUIStore((s) => s.quality)
  const down = useRef<{ x: number; y: number; t: number; button: number } | null>(null)
  const drag = useRef<DragState | null>(null)
  const hoverRaf = useRef(0)
  const [tip, setTip] = useState<{ x: number; y: number; title: string; text: string } | null>(null)
  const [ready, setReady] = useState(false)
  const onReady = useCallback(() => {
    setReady(true)
    splashDone()
  }, [])

  const onPointerDownCapture = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    const ui = useUIStore.getState()
    if (ui.placing) return
    const id = pickerApi.pick(e.clientX, e.clientY)
    const body = id ? getActiveSystem()?.bodies[id] : null
    if (!id || !isDraggable(body)) return
    const intent = e.shiftKey || ui.moveTool || (ui.selectedId === id && screenRadiusPx(id) < DIRECT_DRAG_MAX_PX)
    if (!intent) return
    e.stopPropagation()
    if (cameraApi.controls) cameraApi.controls.enabled = false
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { id, x: e.clientX, y: e.clientY, started: false, wasPlaying: useSimStore.getState().playing }
    ui.select(id)
    ui.openContextMenu(null)
  }, [])

  const moveDrag = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return false
    if ((e.buttons & 1) === 0) {
      endDrag(e)
      return false
    }
    if (!d.started) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 3) return true
      d.started = true
      useSimStore.getState().setPlaying(false)
      if (useUIStore.getState().followId === d.id) useUIStore.getState().follow(null)
    }
    const system = getActiveSystem()
    const body = system?.bodies[d.id]
    const camera = exportBridge.getState?.().camera
    if (!system || !isDraggable(body) || !camera) return true
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const world = pointerOnOrbitPlane(body, camera, rect, e.clientX, e.clientY)
    if (!world) return true
    const sol = solveOrbitForPoint(system, body, world, simClock.time)
    if (!sol) return true
    useProjectStore.getState().updateBody(
      d.id,
      (b) => {
        if (!b.orbit) return
        b.orbit.a = Number(sol.a.toPrecision(6))
        b.orbit.m0 = Number(sol.m0.toFixed(3))
      },
      { coalesce: `drag:${d.id}` },
    )
    setTip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      title: body.name,
      text: `a = ${formatDistanceAU(sol.a)}${Number.isFinite(sol.periodDays) ? ` · P = ${formatDays(sol.periodDays)}` : ''}`,
    })
    return true
  }

  const endDrag = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return false
    drag.current = null
    ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
    if (cameraApi.controls) cameraApi.controls.enabled = true
    if (d.started && d.wasPlaying) useSimStore.getState().setPlaying(true)
    useProjectStore.getState().endCoalesce()
    setTip(null)
    return true
  }

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY, t: performance.now(), button: e.button }
    useUIStore.getState().openContextMenu(null)
  }, [])

  const onPointerUp = (e: React.PointerEvent) => {
    if (endDrag(e)) return
    useProjectStore.getState().endCoalesce()
    const d = down.current
    down.current = null
    if (!d) return
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y)
    if (moved > 5) return
    const ui = useUIStore.getState()
    if (d.button === 0 && ui.placing) {
      const kind = ui.placing
      ui.setPlacing(null)
      addBodyAt(kind, e.clientX, e.clientY)
      return
    }
    const id = pickerApi.pick(e.clientX, e.clientY)
    if (d.button === 0) {
      ui.select(id)
    } else if (d.button === 2) {
      if (id) ui.select(id)
      ui.openContextMenu({ x: e.clientX, y: e.clientY, bodyId: id })
    }
  }

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    if (useUIStore.getState().placing) return
    const id = pickerApi.pick(e.clientX, e.clientY)
    if (id) useUIStore.getState().requestCamera({ type: 'focus', id })
    else flyToPoint(e.clientX, e.clientY)
  }, [])

  const onPointerMove = (e: React.PointerEvent) => {
    if (moveDrag(e)) {
      ;(e.currentTarget as HTMLElement).style.cursor = 'grabbing'
      return
    }
    if (down.current) return
    const { clientX, clientY, shiftKey } = e
    const target = e.currentTarget as HTMLElement
    cancelAnimationFrame(hoverRaf.current)
    hoverRaf.current = requestAnimationFrame(() => {
      const id = pickerApi.pick(clientX, clientY)
      const ui = useUIStore.getState()
      ui.hover(id)
      const body = id ? getActiveSystem()?.bodies[id] : null
      const grabbable = !!id && isDraggable(body) && (shiftKey || ui.moveTool || (ui.selectedId === id && screenRadiusPx(id) < DIRECT_DRAG_MAX_PX))
      target.style.cursor = ui.placing ? 'crosshair' : grabbable ? 'grab' : id ? 'pointer' : ''
    })
  }

  const dpr = QUALITY_DPR[quality]

  return (
    <div
      className="absolute inset-0 select-none"
      onPointerDownCapture={onPointerDownCapture}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={endDrag}
      onPointerMove={onPointerMove}
      onPointerLeave={() => useUIStore.getState().hover(null)}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas
        flat
        dpr={dpr}
        className="transition-opacity duration-500 ease-out"
        style={{ opacity: ready ? 1 : 0 }}
        gl={{
          antialias: false,
          alpha: false,
          stencil: false,
          depth: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false,
        }}
        camera={{ fov: 42, near: 0.01, far: 60000, position: [0, 70, 140] }}
        onCreated={({ gl }) => {
          gl.setClearColor('#000000', 1)
          if (import.meta.env.PROD) gl.debug.checkShaderErrors = false
          glApi.gl = gl
          splashStep('Compilation des shaders', 0.7)
        }}
      >
        {system && <SystemScene system={system} />}
        <SceneWarmup systemId={system?.id} onReady={onReady} />
        <RenderOnResize />
      </Canvas>
      {!ready && (
        <div role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="animate-pulse-soft font-mono text-[10.5px] uppercase tracking-[0.24em] text-ink-3">Préparation de la vue…</span>
        </div>
      )}
      {system && <LabelLayer system={system} />}
      <div id="astra-zone-labels" className="pointer-events-none absolute inset-0 overflow-hidden" />
      {tip && (
        <div
          role="status"
          className="pointer-events-none absolute z-20 border border-line-strong bg-deep px-2 py-1"
          style={{ left: tip.x + 16, top: tip.y + 14 }}
        >
          <div className="font-display text-[14px] font-semibold leading-tight text-ink">{tip.title}</div>
          <div className="font-mono text-[10.5px] text-ion-hi tabular">{tip.text}</div>
        </div>
      )}
    </div>
  )
}
