import clsx from 'clsx'
import {
  Axis3d,
  CircleDashed,
  Grid3x3,
  Leaf,
  Orbit,
  Route,
  Snowflake,
  Sparkle,
  Sparkles,
  Sun,
  Tag,
  Tags,
  type LucideIcon,
} from 'lucide-react'
import { useUIStore, type Quality, type RenderStyle, type ViewOptions as View } from '@/store/uiStore'
import { Segmented, Toggle } from '../kit'

const OVERLAYS: { key: keyof View; label: string; icon: LucideIcon; shortcut?: string }[] = [
  { key: 'orbits', label: 'Orbites', icon: Orbit, shortcut: 'O' },
  { key: 'labels', label: 'Étiquettes', icon: Tag, shortcut: 'L' },
  { key: 'moonLabels', label: 'Noms des lunes', icon: Tags },
  { key: 'glints', label: 'Repères lointains', icon: Sparkle },
  { key: 'axes', label: 'Axes de rotation', icon: Axis3d, shortcut: 'A' },
  { key: 'equators', label: 'Équateurs', icon: CircleDashed },
  { key: 'grid', label: 'Grille écliptique', icon: Grid3x3, shortcut: 'G' },
  { key: 'habitableZone', label: 'Zone habitable', icon: Leaf },
  { key: 'frostLine', label: 'Ligne des glaces', icon: Snowflake },
  { key: 'routes', label: 'Routes', icon: Route },
]

const EFFECTS: { key: keyof View; label: string }[] = [
  { key: 'starfield', label: 'Ciel étoilé' },
  { key: 'bloom', label: 'Halo (bloom)' },
  { key: 'lensFlares', label: "Reflets d'objectif" },
  { key: 'grain', label: 'Grain film' },
  { key: 'vignette', label: 'Vignettage' },
]

export const RENDER_STYLES: { value: RenderStyle; label: string; hint: string; swatch: string }[] = [
  { value: 'cinematic', label: 'Cinématique', hint: 'Couleurs riches, halos', swatch: 'radial-gradient(circle at 35% 40%, #ffd9a0 0, #e9b96e 8%, #1a2350 40%, #04050a 75%)' },
  { value: 'terminal', label: 'Terminal', hint: 'Phosphore ambre, CRT', swatch: 'repeating-linear-gradient(0deg, #1a0e02 0 2px, #2a1804 2px 3px), radial-gradient(circle at 40% 45%, #ffb347 0, #8a5a12 20%, #120a02 70%)' },
  { value: 'blueprint', label: 'Plan', hint: 'Tracé technique', swatch: 'linear-gradient(#ffffff14 1px, transparent 1px) 0 0/8px 8px, linear-gradient(90deg, #ffffff14 1px, transparent 1px) 0 0/8px 8px, #0b2a5a' },
]

export const QUALITY_OPTIONS: { value: Quality; label: string }[] = [
  { value: 'low', label: 'Basse' },
  { value: 'medium', label: 'Moyenne' },
  { value: 'high', label: 'Haute' },
  { value: 'ultra', label: 'Ultra' },
]

export function ViewOptionsPanel() {
  const view = useUIStore((s) => s.view)
  const quality = useUIStore((s) => s.quality)
  const style = useUIStore((s) => s.renderStyle)
  const ui = useUIStore.getState()
  return (
    <div className="w-[360px] p-3">
      <div className="eyebrow mb-2 px-1">Repères</div>
      <div className="grid grid-cols-2 gap-1">
        {OVERLAYS.map((o) => {
          const on = !!view[o.key]
          const Icon = o.icon
          return (
            <button
              key={o.key}
              onClick={() => ui.toggleView(o.key)}
              className={clsx(
                'flex h-8 items-center gap-2 rounded-lg border px-2 text-left text-[11.5px] transition-colors [&_svg]:size-3.5',
                on ? 'border-ion/30 bg-ion/[0.09] text-ink' : 'border-line bg-white/[0.02] text-ink-3 hover:border-line-strong hover:text-ink-2',
              )}
            >
              <Icon className={on ? 'text-ion' : ''} />
              <span className="flex-1 truncate">{o.label}</span>
              {o.shortcut && <span className="font-mono text-[9px] text-ink-3">{o.shortcut}</span>}
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex items-center gap-2 px-1">
        <span className="flex-1 text-[11px] text-ink-3">Orbites affichées</span>
        <Segmented
          size="xs"
          value={view.orbitScope}
          onChange={(v) => ui.setView({ orbitScope: v })}
          options={[
            { value: 'all', label: 'Toutes' },
            { value: 'major', label: 'Principales' },
            { value: 'selected', label: 'Sélection' },
          ]}
        />
      </div>

      <div className="hairline my-3" />
      <div className="eyebrow mb-2 px-1">Style de rendu</div>
      <div className="grid grid-cols-3 gap-1.5">
        {RENDER_STYLES.map((s) => (
          <button
            key={s.value}
            onClick={() => ui.setRenderStyle(s.value)}
            className={clsx(
              'group overflow-hidden rounded-lg border text-left transition-colors',
              style === s.value ? 'border-aurum/50' : 'border-line hover:border-line-strong',
            )}
          >
            <div className="h-11" style={{ background: s.swatch }} />
            <div className="px-2 py-1.5">
              <div className={clsx('text-[11.5px] font-medium', style === s.value ? 'text-aurum-hi' : 'text-ink-2')}>{s.label}</div>
              <div className="truncate text-[9.5px] text-ink-3">{s.hint}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="hairline my-3" />
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 px-1">
        {EFFECTS.map((e) => (
          <div key={e.key} className="flex items-center justify-between">
            <span className="text-[11.5px] text-ink-2">{e.label}</span>
            <Toggle checked={!!view[e.key]} onChange={() => ui.toggleView(e.key)} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 px-1">
        <Sun className="size-3.5 text-ink-3" />
        <span className="flex-1 text-[11px] text-ink-3">Qualité</span>
        <Segmented size="xs" value={quality} onChange={(v) => ui.setQuality(v)} options={QUALITY_OPTIONS} />
      </div>
      <p className="mt-2 px-1 text-[10px] leading-relaxed text-ink-3">
        <Sparkles className="mr-1 inline size-3 text-aurum" />
        La qualité ajuste la résolution, l'anticrénelage, les textures et le nombre de particules.
      </p>
    </div>
  )
}
