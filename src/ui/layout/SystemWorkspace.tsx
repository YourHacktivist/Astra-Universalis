import { useEffect, useState } from 'react'
import { Maximize2 } from 'lucide-react'
import { frameAll } from '@/app/actions'
import { SCALE_MODE_LABEL } from '@/core/labels'
import { useActiveSystem } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import { SystemCanvas } from '@/three/SystemCanvas'
import { ErrorBoundary } from '../ErrorBoundary'
import { Hierarchy } from '../hierarchy/Hierarchy'
import { Inspector } from '../inspector/Inspector'
import { ImmersiveHud } from './ImmersiveHud'
import { SidePanel } from './SidePanel'
import { TimeBar } from './TimeBar'
import { Toolbar } from './Toolbar'

function useViewportWidth() {
  const [w, setW] = useState(() => window.innerWidth)
  useEffect(() => {
    const on = () => setW(window.innerWidth)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return w
}

export function SystemWorkspace() {
  const system = useActiveSystem()
  const panels = useUIStore((s) => s.panels)
  const hw = useUIStore((s) => s.hierarchyWidth)
  const iw = useUIStore((s) => s.inspectorWidth)
  const exporting = useUIStore((s) => s.exporting)
  const immersive = useUIStore((s) => s.immersive)
  const home = useUIStore((s) => s.showHome)
  const vw = useViewportWidth()

  const chrome = !!system && !immersive && !home
  const budget = Math.max(0, vw - 420)
  const wantH = panels.hierarchy ? hw : 0
  const wantI = panels.inspector ? iw : 0
  const k = wantH + wantI > budget && wantH + wantI > 0 ? budget / (wantH + wantI) : 1
  const H = Math.max(200, Math.round(wantH * k))
  const I = Math.max(260, Math.round(wantI * k))
  const centre = vw - (panels.hierarchy ? H : 0) - (panels.inspector ? I : 0)

  return (
    <div className="absolute inset-0 flex bg-void">
      {chrome && panels.hierarchy && (
        <SidePanel side="hierarchy" width={H}>
          <Hierarchy />
        </SidePanel>
      )}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {chrome && <Toolbar compact={centre < 760} />}
        <div className="relative min-h-0 flex-1">
          <ErrorBoundary>
            <SystemCanvas />
          </ErrorBoundary>
          {chrome && !exporting && system && <ScaleNote mode={system.display.scaleMode} factor={system.display.distanceScale} />}
          {chrome && !exporting && <LostViewHint />}
          {system && immersive && !exporting && <ImmersiveHud system={system} />}
        </div>
        {chrome && system && <TimeBar system={system} compact={centre < 620} />}
      </div>
      {chrome && panels.inspector && (
        <SidePanel side="inspector" width={I}>
          <Inspector />
        </SidePanel>
      )}
    </div>
  )
}

function LostViewHint() {
  const lost = useUIStore((s) => s.viewLost)
  if (!lost) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
      <button
        onClick={frameAll}
        className="scrim pointer-events-auto flex animate-fade-in items-center gap-3 rounded-sm px-4 py-2 text-[12.5px] text-ink transition-colors hover:border-aurum/50"
      >
        <Maximize2 className="size-4 text-aurum-hi" strokeWidth={1.6} />
        <span>Vue perdue ? Revenir à la vue d'ensemble</span>
        <kbd className="rounded-sm border border-line-strong px-1.5 font-mono text-[10.5px] text-ink-2">H</kbd>
      </button>
    </div>
  )
}

function ScaleNote({ mode, factor }: { mode: keyof typeof SCALE_MODE_LABEL; factor: number }) {
  if (mode === 'linear' && factor === 1) return null
  return (
    <div
      className="pointer-events-none absolute bottom-2 left-3 font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-3 [text-shadow:0_1px_6px_#000]"
      title="Les distances sont représentées de façon non linéaire pour rester lisibles"
    >
      Échelle {SCALE_MODE_LABEL[mode].toLowerCase()}
      {factor !== 1 && ` ×${factor.toLocaleString('fr-FR')}`}
    </div>
  )
}
