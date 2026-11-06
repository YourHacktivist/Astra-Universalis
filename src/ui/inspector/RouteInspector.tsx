import { useState } from 'react'
import { ArrowRightLeft, Gauge, Route as RouteIcon, Spline, StickyNote, Trash2 } from 'lucide-react'
import { brachistochrone } from '@/core/physics'
import { ROUTE_KIND_LABEL } from '@/core/labels'
import type { Route, StarSystem } from '@/core/types'
import { formatDays, formatKm, formatLightTime, num } from '@/lib/format'
import { useProjectStore } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import { BodyIcon } from '../icons'
import { useLiveDistanceKm } from '../hooks'
import { Button, Field, IconButton, Section, Select, Slider, Stat, TextArea } from '../kit'
import { editRoute } from './edit'
import { ColorRow, SegmentedRow, SliderRow, ToggleRow, pct } from './fields'
import { ROUTE_KIND_OPTIONS } from './options'

export function RouteInspector({ route, system }: { route: Route; system: StarSystem }) {
  const [accel, setAccel] = useState(1)
  const dist = useLiveDistanceKm(route.from, route.to)
  const travel = dist !== null ? brachistochrone(dist, accel) : null
  const bodyOptions = Object.values(system.bodies)
    .filter((b) => b.kind !== 'belt' && b.kind !== 'nebula')
    .map((b) => ({ value: b.id, label: b.name, icon: <BodyIcon body={b} size={13} /> }))
  const from = system.bodies[route.from]
  const to = system.bodies[route.to]

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-start gap-3 border-b border-line px-3.5 pb-3 pt-3.5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line-strong bg-white/[0.04]" style={{ color: route.color }}>
          <RouteIcon className="size-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <input
            value={route.name}
            onChange={(e) => editRoute(route.id, 'name', (r) => void (r.name = e.target.value))}
            onKeyDown={(e) => e.stopPropagation()}
            className="w-full truncate rounded bg-transparent font-display text-[21px] font-semibold leading-tight tracking-wide text-ink outline-none focus:bg-white/[0.04]"
          />
          <div className="mt-0.5 truncate text-[11px] text-ink-3">
            {ROUTE_KIND_LABEL[route.kind]} · {from?.name ?? '?'} → {to?.name ?? '?'}
          </div>
        </div>
        <IconButton
          label="Supprimer la route"
          tone="danger"
          size="sm"
          onClick={() => {
            useProjectStore.getState().removeRoute(route.id)
            useUIStore.getState().selectRoute(null)
          }}
        >
          <Trash2 />
        </IconButton>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section title="Trajet" icon={<Spline />}>
          <Field label="Départ">
            <Select value={route.from} options={bodyOptions} onChange={(v) => editRoute(route.id, 'from', (r) => void (r.from = v))} />
          </Field>
          <Field label="Arrivée">
            <Select value={route.to} options={bodyOptions} onChange={(v) => editRoute(route.id, 'to', (r) => void (r.to = v))} />
          </Field>
          <div className="flex justify-end">
            <Button
              size="xs"
              variant="ghost"
              icon={<ArrowRightLeft className="size-3" />}
              onClick={() =>
                editRoute(route.id, 'swap', (r) => {
                  const f = r.from
                  r.from = r.to
                  r.to = f
                })
              }
            >
              Inverser
            </Button>
          </div>
          <Field label="Type">
            <Select value={route.kind} options={ROUTE_KIND_OPTIONS} onChange={(v) => editRoute(route.id, 'kind', (r) => void (r.kind = v))} />
          </Field>
        </Section>
        <Section title="Style" icon={<RouteIcon />}>
          <ColorRow label="Couleur" value={route.color} onChange={(v) => editRoute(route.id, 'color', (r) => void (r.color = v))} />
          <SegmentedRow
            label="Trait"
            value={route.style}
            onChange={(v) => editRoute(route.id, 'style', (r) => void (r.style = v))}
            options={[
              { value: 'solid', label: 'Plein' },
              { value: 'dashed', label: 'Tirets' },
              { value: 'dotted', label: 'Points' },
            ]}
          />
          <SliderRow label="Courbure" value={route.arc} min={0} max={1} format={pct} onChange={(v) => editRoute(route.id, 'arc', (r) => void (r.arc = v))} />
          <SliderRow label="Trafic" hint="Vaisseaux circulant sur la route" value={route.traffic} min={0} max={6} step={1} format={(v) => String(v)} onChange={(v) => editRoute(route.id, 'traffic', (r) => void (r.traffic = v))} tone="ion" />
          <ToggleRow label="Flux animé" checked={route.animated} onChange={(v) => editRoute(route.id, 'animated', (r) => void (r.animated = v))} />
          <ToggleRow label="Visible" checked={route.visible} onChange={(v) => editRoute(route.id, 'visible', (r) => void (r.visible = v))} />
          <ToggleRow label="Visible aux joueurs" checked={route.playerVisible} onChange={(v) => editRoute(route.id, 'playerVisible', (r) => void (r.playerVisible = v))} />
        </Section>
        <Section title="Temps de trajet" icon={<Gauge />}>
          <Field label="Accélération">
            <Slider value={accel} onChange={setAccel} min={0.1} max={5} step={0.1} format={(v) => `${num(v, 1)} g`} tone="ion" />
          </Field>
          <div className="grid grid-cols-2 gap-1.5">
            <Stat label="Distance actuelle" value={dist !== null ? formatKm(dist) : '–'} />
            <Stat label="Durée" value={travel ? formatDays(travel.seconds / 86400) : '–'} tone="aurum" />
            <Stat label="Vitesse max" value={travel ? `${num(travel.peakKms, 0)} km/s` : '–'} />
            <Stat label="Délai radio" value={dist !== null ? formatLightTime(dist) : '–'} tone="ion" />
          </div>
        </Section>
        <Section title="Notes" icon={<StickyNote />}>
          <TextArea rows={3} value={route.notes} placeholder="Péages, patrouilles, dangers sur le trajet…" onChange={(e) => editRoute(route.id, 'notes', (r) => void (r.notes = e.target.value))} />
        </Section>
      </div>
    </div>
  )
}
