import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, ImageDown, Loader2, Printer } from 'lucide-react'
import { platform } from '@/lib/platform'
import { useActiveSystem, useProjectStore } from '@/store/projectStore'
import { useSimStore, useSimTime } from '@/store/simStore'
import { toast, useUIStore } from '@/store/uiStore'
import { Button, Segmented, Select, Tooltip } from '../kit'
import { THEMES, type SheetThemeId } from './sheetData'
import { loadSheetFonts, printSheet, sheetToPngBase64 } from './exportSheet'
import { SheetSvg } from './SheetSvg'

const THEME_KEY = 'astra.sheet.theme'

function loadTheme(): SheetThemeId {
  try {
    const t = localStorage.getItem(THEME_KEY)
    return t === 'print' ? 'print' : 'atlas'
  } catch {
    return 'atlas'
  }
}

function safeName(s: string) {
  return s.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim() || 'fiche'
}

export function SystemSheet() {
  const system = useActiveSystem()
  const systems = useProjectStore((s) => s.project.systems)
  const order = useProjectStore((s) => s.project.systemOrder)
  const playerMode = useUIStore((s) => s.playerMode)
  const time = useSimTime(1)
  const [theme, setTheme] = useState<SheetThemeId>(loadTheme)
  const [fit, setFit] = useState<'fit' | 'full'>('fit')
  const [fontsReady, setFontsReady] = useState(0)
  const [busy, setBusy] = useState<null | 'png' | 'print'>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    let alive = true
    void loadSheetFonts().then(() => alive && setFontsReady((n) => n + 1))
    return () => {
      alive = false
    }
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
    }
  }, [theme])

  if (!system) return <div className="flex h-full items-center justify-center text-ink-3">Aucun système actif.</div>

  const exportPng = async () => {
    if (!svgRef.current || busy) return
    setBusy('png')
    try {
      const { base64, width, height } = await sheetToPngBase64(svgRef.current, 2)
      const res = await platform.exportBinary(base64, safeName(`Fiche ${system.name}`), 'png', 'image/png')
      if (res) toast({ kind: 'success', title: 'Fiche exportée', message: res.path ?? `${width} × ${height} px` })
    } catch (e) {
      toast({ kind: 'error', title: "Échec de l'export", message: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  const print = async () => {
    if (!svgRef.current || busy) return
    setBusy('print')
    try {
      await printSheet(svgRef.current)
    } catch (e) {
      toast({ kind: 'error', title: "Impression impossible", message: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  const T = THEMES[theme]

  return (
    <div className="absolute inset-0 flex flex-col bg-void">
      <div className="z-10 flex shrink-0 items-center gap-3 border-b border-line bg-abyss/70 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="eyebrow">Fiche</span>
          <Select
            value={system.id}
            onChange={(id) => {
              const s = useProjectStore.getState().project.systems[id]
              if (!s) return
              useProjectStore.getState().setActiveSystem(id)
              useSimStore.getState().setTime(s.view.time)
            }}
            options={order.filter((id) => systems[id]).map((id) => ({ value: id, label: systems[id].name }))}
            className="w-[220px]"
          />
        </div>
        <span className="h-5 w-px bg-line" />
        <Segmented<SheetThemeId>
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'atlas', label: 'Atlas' },
            { value: 'print', label: 'Impression' },
          ]}
          className="w-[190px]"
        />
        <Segmented<'fit' | 'full'>
          value={fit}
          onChange={setFit}
          options={[
            { value: 'fit', label: 'Ajusté' },
            { value: 'full', label: '100 %' },
          ]}
          className="w-[150px]"
        />
        <Tooltip content="Masque les corps et notes secrets">
          <Button
            size="sm"
            variant={playerMode ? 'secondary' : 'ghost'}
            active={playerMode}
            icon={playerMode ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            onClick={() => useUIStore.getState().setPlayerMode(!playerMode)}
          >
            {playerMode ? 'Version joueurs' : 'Version MJ'}
          </Button>
        </Tooltip>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" icon={busy === 'print' ? <Loader2 className="size-3.5 animate-spin" /> : <Printer className="size-3.5" />} onClick={print} disabled={!!busy}>
          Imprimer
        </Button>
        <Button size="sm" variant="primary" icon={busy === 'png' ? <Loader2 className="size-3.5 animate-spin" /> : <ImageDown className="size-3.5" />} onClick={exportPng} disabled={!!busy}>
          Exporter en PNG
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className={fit === 'fit' ? 'mx-auto w-full max-w-[1600px] p-6 [&_svg]:h-auto [&_svg]:w-full' : 'w-max p-6'}>
          <div className="overflow-hidden border border-line" style={{ borderRadius: T.id === 'atlas' ? 4 : 0 }}>
            <SheetSvg key={`${fontsReady}-${theme}`} ref={svgRef} system={system} theme={T} playerMode={playerMode} time={time} logoHref={T.logo} />
          </div>
        </div>
      </div>
    </div>
  )
}
