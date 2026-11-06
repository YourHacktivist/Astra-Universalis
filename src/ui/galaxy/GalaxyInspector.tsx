import { useMemo } from 'react'
import { ExternalLink, Eye, Link2, Orbit, Route, Shuffle, Sparkles, Spline, Trash, Users, WandSparkles } from 'lucide-react'
import { markerDistance, starClassColor } from '@/core/galaxyGen'
import { GALAXY_ROUTE_LABEL, GALAXY_SHAPE_LABEL, STAR_CLASS_LABEL } from '@/core/labels'
import type { Galaxy, GalaxyRouteKind, GalaxyShape, StarClass } from '@/core/types'
import { num } from '@/lib/format'
import { useProjectStore } from '@/store/projectStore'
import {
  deleteGalaxySelection,
  focusMarker,
  generateForMarker,
  openMarkerSystem,
  regenerateShape,
  repopulate,
} from '@/galaxy/actions'
import { useGalaxyUI } from '@/galaxy/galaxyStore'
import { Badge, Button, ColorField, Field, NumberField, Section, Segmented, Select, Slider, Stat, TextArea, TextField, Toggle } from '../kit'

const upd = (recipe: (g: Galaxy) => void, coalesce?: string) =>
  useProjectStore.getState().updateGalaxy(recipe, coalesce ? { coalesce } : undefined)

const SHAPES = (Object.keys(GALAXY_SHAPE_LABEL) as GalaxyShape[]).map((v) => ({ value: v, label: GALAXY_SHAPE_LABEL[v] }))
const CLASSES = (Object.keys(STAR_CLASS_LABEL) as StarClass[]).map((v) => ({ value: v, label: STAR_CLASS_LABEL[v] }))
const ROUTE_KINDS = (Object.keys(GALAXY_ROUTE_LABEL) as GalaxyRouteKind[]).map((v) => ({ value: v, label: GALAXY_ROUTE_LABEL[v] }))
const STAR_COUNTS = ['80000', '160000', '250000', '400000'] as const

export function GalaxyInspector({ galaxy }: { galaxy: Galaxy }) {
  const selection = useGalaxyUI((s) => s.selection)
  const sel = selection
  let body: React.ReactNode
  if (sel?.type === 'system' && galaxy.systems[sel.id]) body = <MarkerInspector galaxy={galaxy} id={sel.id} />
  else if (sel?.type === 'route' && galaxy.routes[sel.id]) body = <RouteInspector galaxy={galaxy} id={sel.id} />
  else if (sel?.type === 'region' && galaxy.regions[sel.id]) body = <RegionInspector galaxy={galaxy} id={sel.id} />
  else body = <GalaxySettings galaxy={galaxy} />
  return <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{body}</div>
}

function Header({ eyebrow, title, color, onRename, extra }: { eyebrow: string; title: string; color?: string; onRename?(v: string): void; extra?: React.ReactNode }) {
  return (
    <div className="border-b border-line px-4 pb-3 pt-4">
      <div className="eyebrow flex items-center gap-1.5">
        {color && <span className="size-2 rounded-full" style={{ background: color }} />}
        {eyebrow}
      </div>
      {onRename ? (
        <input
          value={title}
          onChange={(e) => onRename(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          className="mt-1 w-full rounded-md bg-transparent font-display text-[24px] font-semibold leading-tight tracking-wide text-ink outline-none hover:bg-white/[0.03] focus:bg-white/[0.05]"
        />
      ) : (
        <div className="mt-1 font-display text-[24px] font-semibold leading-tight tracking-wide">{title}</div>
      )}
      {extra}
    </div>
  )
}

function GalaxySettings({ galaxy: g }: { galaxy: Galaxy }) {
  const counts = { systems: Object.keys(g.systems).length, routes: Object.keys(g.routes).length, regions: Object.keys(g.regions).length }
  return (
    <>
      <Header
        eyebrow="Galaxie"
        title={g.name}
        onRename={(v) => upd((d) => void (d.name = v), 'gal:name')}
        extra={
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="aurum">{GALAXY_SHAPE_LABEL[g.shape]}</Badge>
            <Badge>Ø {num(g.radius * 2, 0)} al</Badge>
            <Badge tone="ion">{counts.systems} systèmes</Badge>
          </div>
        }
      />
      <Section title="Forme" icon={<Orbit />}>
        <Field label="Type">
          <Select value={g.shape} onChange={(v) => upd((d) => void (d.shape = v))} options={SHAPES} />
        </Field>
        {(g.shape === 'spiral' || g.shape === 'barred') && (
          <>
            <Field label="Bras">
              <NumberField value={g.arms} min={1} max={8} step={1} precision={0} onChange={(v) => upd((d) => void (d.arms = Math.round(v)), 'gal:arms')} />
            </Field>
            <Field label="Enroulement">
              <Slider value={g.twist} min={0.2} max={3} step={0.01} onChange={(v) => upd((d) => void (d.twist = v), 'gal:twist')} />
            </Field>
          </>
        )}
        {g.shape === 'barred' && (
          <Field label="Barre">
            <Slider value={g.bar} min={0} max={1} onChange={(v) => upd((d) => void (d.bar = v), 'gal:bar')} />
          </Field>
        )}
        <Field label="Bulbe">
          <Slider value={g.bulge} min={0} max={1} onChange={(v) => upd((d) => void (d.bulge = v), 'gal:bulge')} />
        </Field>
        <Field label="Épaisseur">
          <Slider value={g.thickness} min={0.01} max={0.2} step={0.005} onChange={(v) => upd((d) => void (d.thickness = v), 'gal:thick')} />
        </Field>
        <Field label="Poussière">
          <Slider value={g.dust} min={0} max={1} onChange={(v) => upd((d) => void (d.dust = v), 'gal:dust')} />
        </Field>
        <Field label="Rayon" hint="En années-lumière">
          <NumberField value={g.radius} min={5000} max={250000} step={500} precision={0} unit="al" onChange={(v) => upd((d) => void (d.radius = Math.round(v)), 'gal:radius')} />
        </Field>
        <Field label="Étoiles" hint="Nombre de particules (selon la qualité)">
          <Select
            value={String(STAR_COUNTS.reduce((best, c) => (Math.abs(+c - g.starCount) < Math.abs(+best - g.starCount) ? c : best), STAR_COUNTS[1]))}
            onChange={(v) => upd((d) => void (d.starCount = +v))}
            options={STAR_COUNTS.map((c) => ({ value: c, label: `${num(+c / 1000, 0)} k` }))}
          />
        </Field>
        <div className="flex gap-1.5 pt-1">
          <Button size="sm" icon={<Shuffle className="size-3.5" />} onClick={regenerateShape} className="flex-1">
            Nouvelle forme
          </Button>
          <Button size="sm" icon={<Sparkles className="size-3.5" />} onClick={() => void repopulate()} className="flex-1">
            Repeupler
          </Button>
        </div>
      </Section>
      <Section title="Couleurs" icon={<Sparkles />}>
        <Field label="Noyau">
          <ColorField value={g.coreColor} onChange={(v) => upd((d) => void (d.coreColor = v), 'gal:core')} />
        </Field>
        <Field label="Bras">
          <ColorField value={g.armColor} onChange={(v) => upd((d) => void (d.armColor = v), 'gal:arm')} />
        </Field>
        <Field label="Périphérie">
          <ColorField value={g.outerColor} onChange={(v) => upd((d) => void (d.outerColor = v), 'gal:outer')} />
        </Field>
      </Section>
      <Section title="Contenu" icon={<Users />}>
        <div className="grid grid-cols-3 gap-1.5">
          <Stat label="Systèmes" value={counts.systems} />
          <Stat label="Routes" value={counts.routes} />
          <Stat label="Régions" value={counts.regions} />
        </div>
        <p className="pt-1 text-[11.5px] leading-relaxed text-ink-3">
          Utilisez les outils en haut pour placer des systèmes, tracer des routes de saut ou délimiter des régions. Double-cliquez sur un
          système pour vous en approcher.
        </p>
      </Section>
    </>
  )
}

function MarkerInspector({ galaxy: g, id }: { galaxy: Galaxy; id: string }) {
  const m = g.systems[id]
  const systems = useProjectStore((s) => s.project.systems)
  const order = useProjectStore((s) => s.project.systemOrder)
  const linked = m.systemId ? systems[m.systemId] : null
  const set = (recipe: (x: typeof m) => void, key?: string) =>
    upd((d) => {
      const x = d.systems[id]
      if (x) recipe(x)
    }, key ? `gm:${id}:${key}` : undefined)

  const neighbours = useMemo(
    () =>
      Object.values(g.routes)
        .filter((r) => r.from === id || r.to === id)
        .map((r) => {
          const other = g.systems[r.from === id ? r.to : r.from]
          return other ? { r, other, d: markerDistance(m, other) } : null
        })
        .filter((x): x is NonNullable<typeof x> => !!x),
    [g.routes, g.systems, id, m],
  )

  const linkOptions = [{ value: '__none', label: 'Aucun (non détaillé)' }, ...order.filter((sid) => systems[sid]).map((sid) => ({ value: sid, label: systems[sid].name }))]

  return (
    <>
      <Header
        eyebrow="Système stellaire"
        title={m.name}
        color={m.color}
        onRename={(v) => set((x) => void (x.name = v), 'name')}
        extra={
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge>{STAR_CLASS_LABEL[m.starClass].split(' · ')[0]}</Badge>
            {m.faction && <Badge tone="nebula">{m.faction}</Badge>}
            {linked && <Badge tone="aurum">Détaillé</Badge>}
            {!m.playerVisible && <Badge tone="nova">Secret</Badge>}
          </div>
        }
      />
      <div className="space-y-2 border-b border-line px-4 py-3">
        {linked ? (
          <Button variant="primary" className="w-full" icon={<ExternalLink className="size-4" />} onClick={() => openMarkerSystem(id)}>
            Ouvrir {linked.name}
          </Button>
        ) : (
          <Button variant="primary" className="w-full" icon={<WandSparkles className="size-4" />} onClick={() => generateForMarker(id)}>
            Générer ce système
          </Button>
        )}
        <div className="flex gap-1.5">
          <Button size="sm" className="flex-1" icon={<Eye className="size-3.5" />} onClick={() => focusMarker(id)}>
            Centrer
          </Button>
          <Button
            size="sm"
            className="flex-1"
            icon={<Spline className="size-3.5" />}
            onClick={() => {
              useGalaxyUI.getState().setTool('route')
              useGalaxyUI.getState().setRouteStart(id)
            }}
          >
            Tracer une route
          </Button>
        </div>
      </div>
      <Section title="Identité" icon={<Sparkles />}>
        <Field label="Classe">
          <Select
            value={m.starClass}
            onChange={(v) =>
              set((x) => {
                x.starClass = v
                x.color = starClassColor(v)
              })
            }
            options={CLASSES}
          />
        </Field>
        <Field label="Couleur">
          <ColorField value={m.color} onChange={(v) => set((x) => void (x.color = v), 'color')} />
        </Field>
        <Field label="Importance">
          <Segmented
            value={String(m.importance) as '0' | '1' | '2'}
            onChange={(v) => set((x) => void (x.importance = +v))}
            options={[
              { value: '0', label: 'Mineur' },
              { value: '1', label: 'Notable' },
              { value: '2', label: 'Majeur' },
            ]}
          />
        </Field>
        <Field label="Faction">
          <TextField value={m.faction} placeholder="Indépendant" onChange={(e) => set((x) => void (x.faction = e.target.value), 'faction')} />
        </Field>
        <Field label="Aux joueurs" hint="Masqué en mode joueurs si désactivé">
          <Toggle checked={m.playerVisible} onChange={(v) => set((x) => void (x.playerVisible = v))} label={m.playerVisible ? 'Visible' : 'Secret'} />
        </Field>
        <Field label="Système lié" hint="Système détaillé du projet associé à ce marqueur">
          <Select
            value={m.systemId && systems[m.systemId] ? m.systemId : '__none'}
            onChange={(v) => set((x) => void (x.systemId = v === '__none' ? null : v))}
            options={linkOptions}
          />
        </Field>
      </Section>
      <Section title="Position" icon={<Link2 />} defaultOpen={false}>
        <Field label="X">
          <NumberField value={m.position[0]} step={100} precision={0} unit="al" onChange={(v) => set((x) => void (x.position[0] = Math.round(v)), 'px')} />
        </Field>
        <Field label="Z">
          <NumberField value={m.position[2]} step={100} precision={0} unit="al" onChange={(v) => set((x) => void (x.position[2] = Math.round(v)), 'pz')} />
        </Field>
        <Field label="Hauteur">
          <NumberField value={m.position[1]} step={20} precision={0} unit="al" onChange={(v) => set((x) => void (x.position[1] = Math.round(v)), 'py')} />
        </Field>
      </Section>
      <Section title="Notes" icon={<Users />}>
        <TextArea rows={4} value={m.notes} placeholder="Description, rumeurs, enjeux…" onChange={(e) => set((x) => void (x.notes = e.target.value), 'notes')} />
      </Section>
      {neighbours.length > 0 && (
        <Section title="Routes" icon={<Route />}>
          <div className="space-y-1">
            {neighbours.map(({ r, other, d }) => (
              <button
                key={r.id}
                onClick={() => useGalaxyUI.getState().select({ type: 'route', id: r.id })}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-ink-2 hover:bg-white/[0.05] hover:text-ink"
              >
                <span className="size-1.5 rounded-full" style={{ background: other.color }} />
                <span className="flex-1 truncate">{other.name}</span>
                <span className="font-mono text-[10.5px] text-ink-3">{num(d, 0)} al</span>
                <Badge tone="ion">J-{r.jump}</Badge>
              </button>
            ))}
          </div>
        </Section>
      )}
      <DeleteRow label="Supprimer le système" />
    </>
  )
}

function RouteInspector({ galaxy: g, id }: { galaxy: Galaxy; id: string }) {
  const r = g.routes[id]
  const a = g.systems[r.from]
  const b = g.systems[r.to]
  const set = (recipe: (x: typeof r) => void, key?: string) =>
    upd((d) => {
      const x = d.routes[id]
      if (x) recipe(x)
    }, key ? `gr:${id}:${key}` : undefined)
  const d = a && b ? markerDistance(a, b) : 0
  return (
    <>
      <Header eyebrow={GALAXY_ROUTE_LABEL[r.kind]} title={r.label || `${a?.name ?? '?'}–${b?.name ?? '?'}`} />
      <div className="grid grid-cols-2 gap-1.5 border-b border-line px-4 py-3">
        <Stat label="Distance" value={num(d, 0)} unit="al" tone="ion" />
        <Stat label="Cote de saut" value={r.jump ? `J-${r.jump}` : '–'} tone="aurum" />
      </div>
      <Section title="Route" icon={<Route />}>
        <Field label="De">
          <button onClick={() => useGalaxyUI.getState().select({ type: 'system', id: r.from })} className="truncate text-left text-[12px] text-ion-hi hover:underline">
            {a?.name}
          </button>
        </Field>
        <Field label="Vers">
          <button onClick={() => useGalaxyUI.getState().select({ type: 'system', id: r.to })} className="truncate text-left text-[12px] text-ion-hi hover:underline">
            {b?.name}
          </button>
        </Field>
        <Field label="Type">
          <Select value={r.kind} onChange={(v) => set((x) => void (x.kind = v))} options={ROUTE_KINDS} />
        </Field>
        <Field label="Cote de saut" hint="Classe de propulseur requise (J-1 à J-9), 0 = aucune">
          <NumberField value={r.jump} min={0} max={9} step={1} precision={0} onChange={(v) => set((x) => void (x.jump = Math.round(v)), 'jump')} />
        </Field>
        <Field label="Libellé">
          <TextField value={r.label} placeholder="Ex. : Route du Linceul" onChange={(e) => set((x) => void (x.label = e.target.value), 'label')} />
        </Field>
        <Field label="Aux joueurs">
          <Toggle checked={r.playerVisible} onChange={(v) => set((x) => void (x.playerVisible = v))} label={r.playerVisible ? 'Visible' : 'Secrète'} />
        </Field>
      </Section>
      <DeleteRow label="Supprimer la route" />
    </>
  )
}

function RegionInspector({ galaxy: g, id }: { galaxy: Galaxy; id: string }) {
  const r = g.regions[id]
  const set = (recipe: (x: typeof r) => void, key?: string) =>
    upd((d) => {
      const x = d.regions[id]
      if (x) recipe(x)
    }, key ? `gg:${id}:${key}` : undefined)
  const inside = Object.values(g.systems).filter((m) => Math.hypot(m.position[0] - r.center[0], m.position[2] - r.center[2]) <= r.radius)
  return (
    <>
      <Header eyebrow="Région" title={r.name} color={r.color} onRename={(v) => set((x) => void (x.name = v), 'name')} />
      <Section title="Région" icon={<Orbit />}>
        <Field label="Couleur">
          <ColorField value={r.color} onChange={(v) => set((x) => void (x.color = v), 'color')} />
        </Field>
        <Field label="Rayon">
          <NumberField value={r.radius} min={500} step={250} precision={0} unit="al" onChange={(v) => set((x) => void (x.radius = Math.round(v)), 'radius')} />
        </Field>
        <Field label="Centre X">
          <NumberField value={r.center[0]} step={250} precision={0} unit="al" onChange={(v) => set((x) => void (x.center[0] = Math.round(v)), 'cx')} />
        </Field>
        <Field label="Centre Z">
          <NumberField value={r.center[2]} step={250} precision={0} unit="al" onChange={(v) => set((x) => void (x.center[2] = Math.round(v)), 'cz')} />
        </Field>
        <Field label="Aux joueurs">
          <Toggle checked={r.playerVisible} onChange={(v) => set((x) => void (x.playerVisible = v))} label={r.playerVisible ? 'Visible' : 'Secrète'} />
        </Field>
      </Section>
      <Section title="Notes" icon={<Users />}>
        <TextArea rows={4} value={r.notes} placeholder="Faction dominante, dangers, histoire…" onChange={(e) => set((x) => void (x.notes = e.target.value), 'notes')} />
      </Section>
      {inside.length > 0 && (
        <Section title={`Systèmes (${inside.length})`} icon={<Sparkles />}>
          <div className="flex flex-wrap gap-1">
            {inside.map((m) => (
              <button
                key={m.id}
                onClick={() => useGalaxyUI.getState().select({ type: 'system', id: m.id })}
                className="rounded-full border border-line bg-white/[0.03] px-2 py-0.5 text-[11px] text-ink-2 hover:border-line-strong hover:text-ink"
              >
                {m.name}
              </button>
            ))}
          </div>
        </Section>
      )}
      <DeleteRow label="Supprimer la région" />
    </>
  )
}

function DeleteRow({ label }: { label: string }) {
  return (
    <div className="px-4 py-3">
      <Button variant="danger" size="sm" className="w-full" icon={<Trash className="size-3.5" />} onClick={deleteGalaxySelection}>
        {label}
      </Button>
    </div>
  )
}
