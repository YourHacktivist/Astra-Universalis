import { useMemo, useState } from 'react'
import { DEFAULT_GENERATOR_OPTIONS, generateSystem, summarizeSystem, type GeneratorStyle } from '@/core/generator'
import { createSolSystem } from '@/core/templates/sol'
import { createBinaryTemplate, createBlackHoleTemplate } from '@/core/templates/showcase'
import { createProject } from '@/core/defaults'
import { useProjectStore } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import { TooltipProvider } from '@/ui/kit'
import { ConfirmDialog } from '@/ui/dialogs/ConfirmDialog'
import { GeneratorDialog } from '@/ui/dialogs/GeneratorDialog'
import { sheetToPngBase64 } from '@/ui/sheet/exportSheet'
import { SystemSheet } from '@/ui/sheet/SystemSheet'
import { LabShell } from './LabShell'

export default function GeneratorLab() {
  const params = new URLSearchParams(location.search)
  const [seed, setSeed] = useState(params.get('seed') ?? 'KX-4471')
  const style = (params.get('style') as GeneratorStyle) ?? 'varied'
  const view = params.get('view') ?? '3d'
  const tpl = params.get('tpl')
  const system = useMemo(() => {
    if (tpl === 'sol') return createSolSystem()
    if (tpl === 'binary') return createBinaryTemplate()
    if (tpl === 'bh') return createBlackHoleTemplate()
    return generateSystem({ ...DEFAULT_GENERATOR_OPTIONS, seed, style, nebula: true })
  }, [seed, style, tpl])
  const summary = summarizeSystem(system)

  if (view === 'sheet' || view === 'print') {
    ;(window as unknown as Record<string, unknown>).__astraSheetPng = async () => {
      const svg = document.querySelector('svg[data-astra-sheet]') as SVGSVGElement
      const r = await sheetToPngBase64(svg, 1)
      const img = document.createElement('img')
      img.src = `data:image/png;base64,${r.base64}`
      img.style.cssText = 'position:fixed;inset:0;width:100%;z-index:9999;background:#000'
      document.body.appendChild(img)
      return { width: r.width, height: r.height, base64: r.base64 }
    }
    useMemo(() => {
      useProjectStore.getState().load(createProject('Lab', system), null)
      useUIStore.getState().setPlayerMode(params.get('player') === '1')
      try {
        localStorage.setItem('astra.sheet.theme', view === 'print' ? 'print' : 'atlas')
      } catch {
      }
    }, [system])
    return (
      <TooltipProvider>
        <div className="fixed inset-0 bg-void">
          <SystemSheet />
        </div>
      </TooltipProvider>
    )
  }
  if (view === 'dialog') {
    return (
      <TooltipProvider>
        <div className="fixed inset-0 bg-void" />
        <GeneratorDialog open onClose={() => undefined} />
        <ConfirmDialog />
      </TooltipProvider>
    )
  }
  return (
    <LabShell system={system}>
      <div className="space-y-2 text-[12px]">
        <div className="eyebrow">Générateur</div>
        <input value={seed} onChange={(e) => setSeed(e.target.value)} className="w-full rounded-md border border-line bg-white/5 px-2 py-1 font-mono" />
        <div className="font-display text-xl">{system.name}</div>
        <div className="text-ink-3">{system.designation}</div>
        <div>{summary.stars.join(' · ')}</div>
        <div className="text-ink-2">{Object.entries(summary.counts).map(([k, v]) => `${k}: ${v}`).join(' · ')}</div>
        <p className="text-ink-2">{system.description}</p>
      </div>
    </LabShell>
  )
}
