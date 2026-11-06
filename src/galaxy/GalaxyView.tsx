import { useCallback, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { useGalaxy } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import { QUALITY_DPR } from '@/three/SystemCanvas'
import { ErrorBoundary } from '@/ui/ErrorBoundary'
import { GalaxyInspector } from '@/ui/galaxy/GalaxyInspector'
import { GalaxyEmpty, GalaxyLegend, GalaxyOutline, GalaxyToolbar } from '@/ui/galaxy/GalaxyPanels'
import { addMarkerAt, addRegionAt, addRouteBetween, deleteGalaxySelection, focusMarker } from './actions'
import { GalaxyLabels } from './GalaxyLabels'
import { GalaxyScene } from './GalaxyScene'
import { useGalaxyUI } from './galaxyStore'
import { pickGalaxy, planeHitLy } from './picking'

function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

export function GalaxyView() {
  const galaxy = useGalaxy()
  const quality = useUIStore((s) => s.quality)
  const panels = useUIStore((s) => s.panels)
  const down = useRef<{ x: number; y: number; button: number } | null>(null)
  const raf = useRef(0)

  useEffect(() => {
    useUIStore.getState().select(null)
    useUIStore.getState().follow(null)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || useUIStore.getState().dialog || useUIStore.getState().commandOpen) return
      const g = useGalaxyUI.getState()
      if (e.key === 'Escape') {
        if (g.tool !== 'select') g.setTool('select')
        else g.select(null)
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && g.selection) {
        e.preventDefault()
        deleteGalaxySelection()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const opts = () => {
    const g = useGalaxyUI.getState()
    return { playerMode: useUIStore.getState().playerMode, routes: g.routes, regions: g.regions }
  }

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY, button: e.button }
  }, [])

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = down.current
      down.current = null
      if (!d || !galaxy || d.button !== 0) return
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const ui = useGalaxyUI.getState()
      if (ui.tool === 'system' || ui.tool === 'region') {
        const p = planeHitLy(e.clientX, e.clientY, rect)
        if (!p) return
        if (ui.tool === 'system') addMarkerAt(p[0], p[1])
        else addRegionAt(p[0], p[1])
        ui.setTool('select')
        return
      }
      const hit = pickGalaxy(galaxy, e.clientX, e.clientY, rect, { ...opts(), regions: ui.tool === 'select' && opts().regions })
      if (ui.tool === 'route') {
        if (hit?.type !== 'system') return
        if (!ui.routeStart) ui.setRouteStart(hit.id)
        else if (hit.id !== ui.routeStart) {
          addRouteBetween(ui.routeStart, hit.id)
          ui.setTool('select')
        }
        return
      }
      ui.select(hit)
    },
    [galaxy],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (down.current || !galaxy) return
      const { clientX, clientY } = e
      const target = e.currentTarget as HTMLElement
      cancelAnimationFrame(raf.current)
      raf.current = requestAnimationFrame(() => {
        const rect = target.getBoundingClientRect()
        const tool = useGalaxyUI.getState().tool
        const hit = pickGalaxy(galaxy, clientX, clientY, rect, { ...opts(), regions: false })
        useGalaxyUI.getState().hover(hit)
        target.style.cursor = tool === 'system' || tool === 'region' ? 'crosshair' : hit ? 'pointer' : ''
      })
    },
    [galaxy],
  )

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!galaxy) return
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const hit = pickGalaxy(galaxy, e.clientX, e.clientY, rect, { ...opts(), regions: false })
      if (hit?.type === 'system') focusMarker(hit.id)
    },
    [galaxy],
  )

  if (!galaxy) return <GalaxyEmpty />

  return (
    <div className="absolute inset-0 bg-void">
      <div
        className="absolute inset-0 select-none"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerMove={onPointerMove}
        onPointerLeave={() => useGalaxyUI.getState().hover(null)}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        <ErrorBoundary label="La carte galactique a rencontré un problème">
          <Canvas
            flat
            dpr={QUALITY_DPR[quality]}
            gl={{ antialias: false, alpha: false, stencil: false, depth: true, powerPreference: 'high-performance' }}
            camera={{ fov: 42, near: 0.5, far: 60000, position: [0, 900, 800] }}
            onCreated={({ gl }) => gl.setClearColor('#000000', 1)}
          >
            <GalaxyScene galaxy={galaxy} />
          </Canvas>
        </ErrorBoundary>
        <GalaxyLabels galaxy={galaxy} />
      </div>

      <GalaxyToolbar />

      {panels.hierarchy && (
        <aside className="glass absolute bottom-3 left-3 top-3 z-10 flex w-[270px] animate-fade-in flex-col overflow-hidden rounded-2xl">
          <div className="border-b border-line px-4 pb-2 pt-3">
            <div className="eyebrow">Carte galactique</div>
            <div className="truncate font-display text-[19px] font-semibold tracking-wide">{galaxy.name}</div>
          </div>
          <GalaxyOutline galaxy={galaxy} />
        </aside>
      )}

      {panels.inspector && (
        <aside className="glass absolute bottom-3 right-3 top-3 z-10 flex w-[330px] animate-fade-in flex-col overflow-hidden rounded-2xl">
          <GalaxyInspector galaxy={galaxy} />
        </aside>
      )}

      <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
        <GalaxyLegend galaxy={galaxy} />
      </div>
    </div>
  )
}
