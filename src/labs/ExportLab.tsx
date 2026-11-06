import { useMemo, useState } from 'react'
import { createDemoSystem } from '@/core/demo'
import { getActiveSystem } from '@/store/projectStore'
import { renderExport } from '@/three/export/capture'
import { ExportDialog } from '@/ui/dialogs/ExportDialog'
import { Toasts } from '@/ui/Toasts'
import { LabShell } from './LabShell'

export default function ExportLab() {
  const system = useMemo(() => createDemoSystem(), [])
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<{ url: string; w: number; h: number; ms: number } | null>(null)

  const test = async (scale: number, aspect: '16:9' | 'viewport' | 'a4-portrait') => {
    const sys = getActiveSystem()
    if (!sys) return
    const t0 = performance.now()
    const c = await renderExport(sys, {
      scale,
      aspect,
      format: 'png',
      labels: true,
      moonLabels: true,
      zoneLabels: true,
      cartouche: true,
      title: sys.name,
      subtitle: 'HD 40307 · K2 V · 5 planètes',
      showDate: true,
      watermark: true,
      starfield: true,
    })
    setResult({ url: c.toDataURL('image/jpeg', 0.85), w: c.width, h: c.height, ms: Math.round(performance.now() - t0) })
  }

  return (
    <LabShell system={system} time={120}>
      <div className="flex flex-wrap gap-2">
        <button className="rounded-lg border border-line px-3 py-1.5 text-[12px]" onClick={() => setOpen(true)}>
          Ouvrir l'export
        </button>
        <button id="t1" className="rounded-lg border border-line px-3 py-1.5 text-[12px]" onClick={() => test(1, 'viewport')}>
          Test ×1
        </button>
        <button id="t2" className="rounded-lg border border-line px-3 py-1.5 text-[12px]" onClick={() => test(2, '16:9')}>
          Test ×2 16:9
        </button>
        <button id="t3" className="rounded-lg border border-line px-3 py-1.5 text-[12px]" onClick={() => test(2, 'a4-portrait')}>
          Test A4 portrait
        </button>
      </div>
      {result && (
        <div className="mt-3 space-y-1">
          <div id="result-info" className="font-mono text-[11px] text-ink-2">
            {result.w} × {result.h} px · {result.ms} ms
          </div>
          <img id="result-img" src={result.url} className="w-full rounded-lg border border-line" />
        </div>
      )}
      <ExportDialog open={open} onClose={() => setOpen(false)} />
      <Toasts />
    </LabShell>
  )
}
