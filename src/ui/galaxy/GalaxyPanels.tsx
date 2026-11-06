import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { CircleDashed, Map as MapIcon, MousePointer2, RotateCw, Scan, Search, Sparkles, Spline, Star, Tag, Waypoints, Circle } from 'lucide-react'
import { GALAXY_ROUTE_LABEL } from '@/core/labels'
import type { Galaxy, GalaxyRouteKind } from '@/core/types'
import { num } from '@/lib/format'
import { useUIStore } from '@/store/uiStore'
import { createNewGalaxy, focusMarker, focusRegion, focusRoute } from '@/galaxy/actions'
import { useGalaxyUI, type GalaxyTool } from '@/galaxy/galaxyStore'
import { ROUTE_COLORS } from '@/galaxy/GalaxyScene'
import { Badge, Button, IconButton, Tabs } from '../kit'

const TOOLS: { value: GalaxyTool; label: string; icon: React.ReactNode; hint: string }[] = [
  { value: 'select', label: 'Sélection', icon: <MousePointer2 />, hint: '' },
  { value: 'system', label: 'Système', icon: <Star />, hint: 'Cliquez sur le plan galactique pour placer un système.' },
  { value: 'route', label: 'Route', icon: <Spline />, hint: 'Cliquez sur deux systèmes pour tracer une route de saut.' },
  { value: 'region', label: 'Région', icon: <CircleDashed />, hint: 'Cliquez sur le plan galactique pour délimiter une région.' },
]

export function GalaxyToolbar() {
  const tool = useGalaxyUI((s) => s.tool)
  const routeStart = useGalaxyUI((s) => s.routeStart)
  const rotate = useGalaxyUI((s) => s.rotate)
  const labels = useGalaxyUI((s) => s.labels)
  const routes = useGalaxyUI((s) => s.routes)
  const regions = useGalaxyUI((s) => s.regions)
  const ui = useGalaxyUI.getState()
  const hint = TOOLS.find((t) => t.value === tool)?.hint
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-20 flex -translate-x-1/2 flex-col items-center gap-2">
      <div className="glass pointer-events-auto flex items-center gap-1 rounded-2xl p-1.5">
        {TOOLS.map((t) => (
          <IconButton key={t.value} label={t.label} active={tool === t.value} onClick={() => ui.setTool(t.value)} tooltipSide="bottom">
            {t.icon}
          </IconButton>
        ))}
        <span className="mx-1 h-5 w-px bg-line" />
        <IconButton label="Cadrer la galaxie" onClick={() => ui.requestCamera({ type: 'frame' })} tooltipSide="bottom">
          <Scan />
        </IconButton>
        <IconButton label="Rotation lente" active={rotate} onClick={() => ui.toggle('rotate')} tooltipSide="bottom">
          <RotateCw />
        </IconButton>
        <IconButton label="Étiquettes" active={labels} onClick={() => ui.toggle('labels')} tooltipSide="bottom">
          <Tag />
        </IconButton>
        <IconButton label="Routes" active={routes} onClick={() => ui.toggle('routes')} tooltipSide="bottom">
          <Waypoints />
        </IconButton>
        <IconButton label="Régions" active={regions} onClick={() => ui.toggle('regions')} tooltipSide="bottom">
          <Circle />
        </IconButton>
      </div>
      {hint && (
        <div className="glass-pop pointer-events-auto animate-rise-in rounded-full px-3.5 py-1.5 text-[11.5px] text-ink-2">
          {tool === 'route' && routeStart ? 'Choisissez le système d’arrivée…' : hint}
          <span className="ml-2 text-ink-3">Échap pour annuler</span>
        </div>
      )}
    </div>
  )
}

type OutlineTab = 'systems' | 'regions' | 'routes'

export function GalaxyOutline({ galaxy }: { galaxy: Galaxy }) {
  const [tab, setTab] = useState<OutlineTab>('systems')
  const [q, setQ] = useState('')
  const selection = useGalaxyUI((s) => s.selection)
  const playerMode = useUIStore((s) => s.playerMode)
  const query = q.trim().toLowerCase()

  const systems = useMemo(
    () =>
      Object.values(galaxy.systems)
        .filter((m) => (!playerMode || m.playerVisible) && (!query || m.name.toLowerCase().includes(query) || m.faction.toLowerCase().includes(query)))
        .sort((a, b) => b.importance - a.importance || a.name.localeCompare(b.name)),
    [galaxy.systems, playerMode, query],
  )
  const regions = useMemo(
    () => Object.values(galaxy.regions).filter((r) => (!playerMode || r.playerVisible) && (!query || r.name.toLowerCase().includes(query))),
    [galaxy.regions, playerMode, query],
  )
  const routes = useMemo(
    () =>
      Object.values(galaxy.routes)
        .filter((r) => galaxy.systems[r.from] && galaxy.systems[r.to] && (!playerMode || r.playerVisible))
        .map((r) => ({ r, name: r.label || `${galaxy.systems[r.from].name}–${galaxy.systems[r.to].name}` }))
        .filter((x) => !query || x.name.toLowerCase().includes(query)),
    [galaxy.routes, galaxy.systems, playerMode, query],
  )

  const row = (active: boolean) =>
    clsx(
      'group flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[12px] transition-colors',
      active ? 'bg-aurum/[0.12] text-aurum-hi' : 'text-ink-2 hover:bg-white/[0.05] hover:text-ink',
    )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Tabs<OutlineTab>
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'systems', label: `Systèmes · ${Object.keys(galaxy.systems).length}` },
          { value: 'regions', label: 'Régions' },
          { value: 'routes', label: 'Routes' },
        ]}
      />
      <div className="px-2 pt-2">
        <label className="flex h-7 items-center gap-2 rounded-md border border-line bg-white/[0.03] px-2 focus-within:border-aurum/50">
          <Search className="size-3.5 text-ink-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Rechercher…"
            className="w-full bg-transparent text-[12px] text-ink outline-none placeholder:text-ink-3"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
        {tab === 'systems' &&
          systems.map((m) => (
            <button
              key={m.id}
              className={row(selection?.type === 'system' && selection.id === m.id)}
              onClick={() => useGalaxyUI.getState().select({ type: 'system', id: m.id })}
              onDoubleClick={() => focusMarker(m.id)}
            >
              <span className="size-2 shrink-0 rounded-full" style={{ background: m.color }} />
              <span className={clsx('flex-1 truncate', m.importance >= 2 && 'font-medium')}>{m.name}</span>
              {m.systemId && <span className="font-mono text-[9px] uppercase tracking-wider text-aurum/80">détaillé</span>}
              {!m.playerVisible && <span className="font-mono text-[9px] uppercase tracking-wider text-nova/80">secret</span>}
            </button>
          ))}
        {tab === 'regions' &&
          regions.map((r) => (
            <button
              key={r.id}
              className={row(selection?.type === 'region' && selection.id === r.id)}
              onClick={() => useGalaxyUI.getState().select({ type: 'region', id: r.id })}
              onDoubleClick={() => focusRegion(r.id)}
            >
              <span className="size-2 shrink-0 rounded-full border" style={{ borderColor: r.color }} />
              <span className="flex-1 truncate">{r.name}</span>
            </button>
          ))}
        {tab === 'routes' &&
          routes.map(({ r, name }) => (
            <button
              key={r.id}
              className={row(selection?.type === 'route' && selection.id === r.id)}
              onClick={() => useGalaxyUI.getState().select({ type: 'route', id: r.id })}
              onDoubleClick={() => focusRoute(r.id)}
            >
              <span className="h-px w-3 shrink-0" style={{ background: ROUTE_COLORS[r.kind] }} />
              <span className="flex-1 truncate">{name}</span>
              {r.jump > 0 && <span className="font-mono text-[10px] text-ink-3">J-{r.jump}</span>}
            </button>
          ))}
        {((tab === 'systems' && !systems.length) || (tab === 'regions' && !regions.length) || (tab === 'routes' && !routes.length)) && (
          <p className="px-2 py-6 text-center text-[11.5px] text-ink-3">Rien à afficher.</p>
        )}
      </div>
    </div>
  )
}

export function GalaxyLegend({ galaxy }: { galaxy: Galaxy }) {
  const kinds = Object.keys(GALAXY_ROUTE_LABEL) as GalaxyRouteKind[]
  return (
    <div className="glass pointer-events-auto flex items-center gap-4 rounded-xl px-3.5 py-2 text-[10.5px] text-ink-3">
      <span className="font-mono tabular">Ø {num(galaxy.radius * 2, 0)} al</span>
      <span className="h-3 w-px bg-line" />
      {kinds.map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className={clsx('h-px w-4', (k === 'unknown' || k === 'danger') && 'opacity-80')} style={{ background: ROUTE_COLORS[k] }} />
          {GALAXY_ROUTE_LABEL[k]}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full ring-1 ring-aurum" />
        Système détaillé
      </span>
    </div>
  )
}

export function GalaxyEmpty() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-void">
      <div className="glass max-w-[440px] animate-rise-in rounded-3xl px-8 py-9 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-nebula/30 bg-nebula/10 text-nebula">
          <MapIcon className="size-7 stroke-[1.4]" />
        </div>
        <h2 className="font-display text-[30px] font-semibold leading-tight tracking-wide">Aucune galaxie</h2>
        <p className="mx-auto mt-2 max-w-[340px] text-[12.5px] leading-relaxed text-ink-2">
          Cartographiez votre campagne à l’échelle galactique : bras spiraux, systèmes, routes de saut et territoires des factions.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button variant="primary" size="lg" icon={<Sparkles className="size-4" />} onClick={() => createNewGalaxy(true)}>
            Générer une galaxie
          </Button>
          <Button variant="ghost" onClick={() => createNewGalaxy(false)}>
            Galaxie vierge
          </Button>
        </div>
        <div className="mt-5 flex justify-center gap-1.5">
          <Badge>Spirale</Badge>
          <Badge>Barrée</Badge>
          <Badge>Elliptique</Badge>
          <Badge>Annulaire</Badge>
          <Badge>Irrégulière</Badge>
        </div>
      </div>
    </div>
  )
}
