import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Copy, Download, ImageDown, Loader2, X } from 'lucide-react'
import { stars } from '@/core/hierarchy'
import { spectralLabel } from '@/core/starPresets'
import { platform } from '@/lib/platform'
import { useActiveSystem } from '@/store/projectStore'
import { toast, useUIStore } from '@/store/uiStore'
import {
  canvasToBase64,
  cropRect,
  EXPORT_MIME,
  maxScale,
  renderExport,
  type ExportAspect,
  type ExportFormat,
  type ExportOptions,
} from '@/three/export/capture'
import { glApi } from '@/three/SystemCanvas'
import { Button, Field, Segmented, Select, TextField, Toggle } from '../kit'

const PREFS_KEY = 'astra.export.v1'

type StoredPrefs = Omit<ExportOptions, 'title' | 'subtitle'>

const DEFAULTS: StoredPrefs = {
  scale: 2,
  aspect: 'viewport',
  format: 'png',
  labels: true,
  moonLabels: true,
  zoneLabels: true,
  cartouche: true,
  showDate: true,
  watermark: true,
  starfield: true,
}

function loadPrefs(): StoredPrefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }
  } catch {
    return DEFAULTS
  }
}

const ASPECTS: { value: ExportAspect; label: string }[] = [
  { value: 'viewport', label: 'Fenêtre' },
  { value: '16:9', label: '16:9' },
  { value: '21:9', label: '21:9' },
  { value: '3:2', label: '3:2' },
  { value: '4:3', label: '4:3' },
  { value: '1:1', label: 'Carré' },
  { value: 'a4-landscape', label: 'A4 paysage' },
  { value: 'a4-portrait', label: 'A4 portrait' },
]

function useCanvasRect(active: boolean) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  useEffect(() => {
    if (!active) return
    const el = glApi.gl?.domElement
    if (!el) return
    const update = () => setRect(el.getBoundingClientRect())
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [active])
  return rect
}

function safeName(s: string) {
  return s.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim() || 'export'
}

export function ExportDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const system = useActiveSystem()
  const mode = useUIStore((s) => s.mode)
  const [prefs, setPrefs] = useState<StoredPrefs>(loadPrefs)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [busy, setBusy] = useState<null | 'save' | 'copy'>(null)
  const rect = useCanvasRect(open && mode === 'system')

  const defaultSubtitle = useMemo(() => {
    if (!system) return ''
    const st = stars(system)
    const planets = Object.values(system.bodies).filter((b) => b.kind === 'planet').length
    const parts = [system.designation, st[0] ? spectralLabel(st[0].props) : '', planets ? `${planets} planète${planets > 1 ? 's' : ''}` : '']
    return parts.filter(Boolean).join(' · ')
  }, [system])

  useEffect(() => {
    if (open && system) {
      setTitle(system.name)
      setSubtitle(defaultSubtitle)
    }
  }, [open, system?.id])

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    } catch {
    }
  }, [prefs])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open) return null

  if (mode !== 'system') {
    return createPortal(
      <div className="glass-pop fixed right-4 top-14 z-[160] w-[320px] animate-rise-in rounded-2xl p-4 text-[12px] text-ink-2">
        L'export d'image concerne la vue Système. La fiche et la galaxie ont leurs propres exports.
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>,
      document.body,
    )
  }

  const set = <K extends keyof StoredPrefs>(k: K, v: StoredPrefs[K]) => setPrefs((p) => ({ ...p, [k]: v }))
  const vw = rect?.width ?? 1600
  const vh = rect?.height ?? 900
  const limit = maxScale(vw, vh)
  const scale = Math.min(prefs.scale, limit)
  const crop = cropRect(vw, vh, prefs.aspect)
  const outW = Math.round(crop.w * scale)
  const outH = Math.round(crop.h * scale)

  const run = async (target: 'save' | 'copy') => {
    if (!system || busy) return
    setBusy(target)
    try {
      const canvas = await renderExport(system, { ...prefs, scale, title, subtitle, format: target === 'copy' ? 'png' : prefs.format })
      const fmt: ExportFormat = target === 'copy' ? 'png' : prefs.format
      const b64 = await canvasToBase64(canvas, fmt)
      if (target === 'copy') {
        await platform.copyImage(b64)
        toast({ kind: 'success', title: 'Image copiée', message: `${canvas.width} × ${canvas.height} px` })
      } else {
        const ext = fmt === 'jpeg' ? 'jpg' : fmt
        const res = await platform.exportBinary(b64, safeName(title || system.name), ext, EXPORT_MIME[fmt])
        if (res) toast({ kind: 'success', title: 'Image exportée', message: res.path ?? `${canvas.width} × ${canvas.height} px` })
      }
    } catch (e) {
      toast({ kind: 'error', title: "Échec de l'export", message: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  return createPortal(
    <>
      {rect && <CropOverlay rect={rect} crop={crop} label={`${outW.toLocaleString('fr-FR')} × ${outH.toLocaleString('fr-FR')} px`} />}
      <aside className="glass-pop fixed right-4 top-14 z-[160] flex max-h-[calc(100vh-72px)] w-[340px] animate-rise-in flex-col overflow-hidden rounded-2xl">
        <header className="flex items-start gap-3 border-b border-line px-4 pb-3 pt-4">
          <div className="mt-0.5 flex size-8 items-center justify-center rounded-xl border border-aurum/25 bg-aurum/10 text-aurum">
            <ImageDown className="size-4" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-[20px] font-semibold leading-tight tracking-wide">Exporter l'image</h2>
            <p className="text-[11.5px] text-ink-3">Cadrez la vue directement dans la scène.</p>
          </div>
          <button onClick={onClose} disabled={!!busy} className="-mr-1 rounded-lg p-1 text-ink-3 hover:bg-white/[0.07] hover:text-ink">
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="space-y-2">
            <div className="eyebrow">Cadrage</div>
            <div className="grid grid-cols-4 gap-1">
              {ASPECTS.map((a) => (
                <button
                  key={a.value}
                  onClick={() => set('aspect', a.value)}
                  className={
                    'h-7 rounded-md border text-[11px] transition-colors ' +
                    (prefs.aspect === a.value
                      ? 'border-aurum/40 bg-aurum/10 text-aurum-hi'
                      : 'border-line bg-white/[0.03] text-ink-2 hover:border-line-strong hover:text-ink')
                  }
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">Résolution</span>
              <span className="font-mono text-[11px] text-ion-hi tabular">
                {outW.toLocaleString('fr-FR')} × {outH.toLocaleString('fr-FR')} px
              </span>
            </div>
            <Segmented
              value={String(prefs.scale)}
              onChange={(v) => set('scale', Number(v))}
              options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: `×${n}`, title: n > limit ? 'Limité par la carte graphique' : undefined }))}
            />
            {prefs.scale > limit && <p className="text-[11px] text-aurum">Limité à ×{limit} par la carte graphique.</p>}
          </div>

          <Field label="Format">
            <Select
              value={prefs.format}
              onChange={(v) => set('format', v)}
              options={[
                { value: 'png', label: 'PNG', hint: 'Sans perte, idéal pour impression' },
                { value: 'jpeg', label: 'JPEG', hint: 'Fichier léger' },
                { value: 'webp', label: 'WebP', hint: 'Léger et net' },
              ]}
            />
          </Field>

          <div className="flex flex-col">
            <div className="eyebrow mb-1">Contenu</div>
            <Toggle checked={prefs.labels} onChange={(v) => set('labels', v)} label="Étiquettes des astres" />
            <Toggle checked={prefs.moonLabels} onChange={(v) => set('moonLabels', v)} label="Étiquettes des lunes" disabled={!prefs.labels} />
            <Toggle checked={prefs.zoneLabels} onChange={(v) => set('zoneLabels', v)} label="Repères (grille, zones)" />
            <Toggle checked={prefs.starfield} onChange={(v) => set('starfield', v)} label="Ciel étoilé" />
            <Toggle checked={prefs.watermark} onChange={(v) => set('watermark', v)} label="Signature Astra Universalis" />
          </div>

          <div className="flex flex-col gap-1">
            <Toggle checked={prefs.cartouche} onChange={(v) => set('cartouche', v)} label="Cartouche titre" />
            {prefs.cartouche && (
              <div className="space-y-1.5 rounded-xl border border-line bg-white/[0.02] p-2.5">
                <Field label="Titre">
                  <TextField value={title} onChange={(e) => setTitle(e.target.value)} />
                </Field>
                <Field label="Sous-titre">
                  <TextField value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
                </Field>
                <Toggle checked={prefs.showDate} onChange={(v) => set('showDate', v)} label="Date du calendrier" />
              </div>
            )}
          </div>
        </div>

        <footer className="flex items-center gap-2 border-t border-line px-4 py-3">
          <Button
            variant="ghost"
            size="md"
            icon={busy === 'copy' ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
            onClick={() => run('copy')}
            disabled={!!busy}
          >
            Copier
          </Button>
          <div className="flex-1" />
          <Button
            variant="primary"
            size="md"
            icon={busy === 'save' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            onClick={() => run('save')}
            disabled={!!busy}
          >
            {busy === 'save' ? 'Rendu…' : 'Exporter…'}
          </Button>
        </footer>
      </aside>
    </>,
    document.body,
  )
}

function CropOverlay({ rect, crop, label }: { rect: DOMRect; crop: { x: number; y: number; w: number; h: number }; label: string }) {
  const shade = 'absolute bg-[#02030a]/60'
  return (
    <div className="pointer-events-none fixed z-[155]" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}>
      <div className={shade} style={{ left: 0, top: 0, width: rect.width, height: crop.y }} />
      <div className={shade} style={{ left: 0, top: crop.y + crop.h, width: rect.width, height: rect.height - crop.y - crop.h }} />
      <div className={shade} style={{ left: 0, top: crop.y, width: crop.x, height: crop.h }} />
      <div className={shade} style={{ left: crop.x + crop.w, top: crop.y, width: rect.width - crop.x - crop.w, height: crop.h }} />
      <div className="absolute border border-aurum/50" style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}>
        <div className="absolute inset-y-0 left-1/3 w-px bg-white/[0.07]" />
        <div className="absolute inset-y-0 left-2/3 w-px bg-white/[0.07]" />
        <div className="absolute inset-x-0 top-1/3 h-px bg-white/[0.07]" />
        <div className="absolute inset-x-0 top-2/3 h-px bg-white/[0.07]" />
        {(['left-0 top-0 border-l border-t', 'right-0 top-0 border-r border-t', 'left-0 bottom-0 border-l border-b', 'right-0 bottom-0 border-r border-b'] as const).map((c) => (
          <div key={c} className={`absolute size-4 border-aurum ${c}`} />
        ))}
        <div className="absolute left-2 top-2 rounded-md bg-black/50 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-aurum-hi">{label}</div>
      </div>
    </div>
  )
}
