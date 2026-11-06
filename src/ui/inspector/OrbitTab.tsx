import { useMemo, useState } from 'react'
import { CircleDot, Orbit as OrbitIcon, Spline, Triangle } from 'lucide-react'
import { placeAtLagrange } from '@/app/actions'
import { defaultOrbit } from '@/core/defaults'
import { descendantIds, depthOf, resolvedPeriod } from '@/core/hierarchy'
import { KIND_LABEL } from '@/core/labels'
import { apoapsis, periapsis } from '@/core/orbits'
import { AU_KM, usesStellarMapping } from '@/core/scale'
import type { Body, Id, StarSystem } from '@/core/types'
import { formatDays, num } from '@/lib/format'
import { useProjectStore } from '@/store/projectStore'
import { BodyIcon } from '../icons'
import { Button, Field, NumberField, Section, Select, Stat, type SelectOption } from '../kit'
import { editBody, setOrbit, setProp } from './edit'
import { Hint, NumberRow, PNumber, PSlider, SliderRow, ToggleRow, deg, pct } from './fields'

export function useParentOptions(system: StarSystem, body: Body): SelectOption<string>[] {
  return useMemo(() => {
    const banned = new Set([body.id, ...descendantIds(system.bodies, body.id)])
    const list = Object.values(system.bodies)
      .filter((b) => !banned.has(b.id) && b.kind !== 'nebula' && b.kind !== 'belt' && b.kind !== 'marker')
      .sort((a, b) => depthOf(system.bodies, a.id) - depthOf(system.bodies, b.id) || (a.orbit?.a ?? 0) - (b.orbit?.a ?? 0))
    return [
      { value: '__root', label: 'Aucun (centre du système)' },
      ...list.map((b) => ({
        value: b.id,
        label: b.name,
        hint: KIND_LABEL[b.kind],
        icon: <BodyIcon body={b} size={13} />,
      })),
    ]
  }, [system.bodies, body.id])
}

function ParentSection({ body, system }: { body: Body; system: StarSystem }) {
  const options = useParentOptions(system, body)
  return (
    <Field label="Orbite autour de">
      <Select
        value={body.parentId ?? '__root'}
        options={options}
        onChange={(v) => useProjectStore.getState().reparentBody(body.id, v === '__root' ? null : v)}
      />
    </Field>
  )
}

export function OrbitTab({ body, system }: { body: Body; system: StarSystem }) {
  const parent = body.parentId ? system.bodies[body.parentId] ?? null : null
  if (body.kind === 'belt') return <BeltOrbit body={body} system={system} parent={parent} />
  const o = body.orbit
  const local = !usesStellarMapping(parent?.kind ?? null)

  if (!o) {
    return (
      <>
        <Section title="Position" icon={<CircleDot />}>
          <ParentSection body={body} system={system} />
          <Hint>
            {parent ? "Cet objet est placé exactement sur son parent." : 'Objet central : il reste au centre du système.'}
          </Hint>
          <Button
            size="sm"
            variant="secondary"
            icon={<OrbitIcon className="size-3.5" />}
            onClick={() => editBody(body.id, 'orbit', (b) => void (b.orbit = defaultOrbit(local ? 0.002 : 1)), false)}
          >
            Ajouter une orbite
          </Button>
        </Section>
      </>
    )
  }
  return <OrbitEditor body={body} system={system} parent={parent} local={local} />
}

function OrbitEditor({ body, system, parent, local }: { body: Body; system: StarSystem; parent: Body | null; local: boolean }) {
  const o = body.orbit!
  const period = resolvedPeriod(system.bodies, body)
  const unitFactor = local ? AU_KM : 1
  const unit = local ? 'km' : 'UA'
  const fmtDist = (au: number) => (local ? `${num(au * AU_KM, 0)} km` : `${num(au, 3)} UA`)

  return (
    <>
      <Section title="Parent" icon={<CircleDot />}>
        <ParentSection body={body} system={system} />
      </Section>

      <Section title="Éléments orbitaux" icon={<OrbitIcon />}>
        <NumberRow
          label="Demi-grand axe"
          hint={local ? 'Distance moyenne au parent (km)' : 'Distance moyenne au parent (unités astronomiques)'}
          value={o.a}
          onChange={(v) => setOrbit(body, 'a', Math.max(1e-9, v))}
          displayFactor={unitFactor}
          unit={unit}
          log
          min={1e-9}
          precision={local ? 0 : 3}
          step={local ? 100 / AU_KM : 0.01}
        />
        <SliderRow label="Excentricité" hint="0 = cercle, proche de 1 = ellipse très allongée" value={o.e} min={0} max={0.98} step={0.001} onChange={(v) => setOrbit(body, 'e', v)} format={(v) => num(v, 3)} />
        <NumberRow label="Inclinaison" hint="Angle entre l'orbite et le plan de référence" value={o.i} onChange={(v) => setOrbit(body, 'i', v)} min={-180} max={180} step={0.5} precision={1} unit="°" />
        <NumberRow label="Nœud ascendant Ω" value={o.node} onChange={(v) => setOrbit(body, 'node', ((v % 360) + 360) % 360)} step={1} precision={1} unit="°" />
        <NumberRow label="Arg. du périastre ω" value={o.peri} onChange={(v) => setOrbit(body, 'peri', ((v % 360) + 360) % 360)} step={1} precision={1} unit="°" />
        <SliderRow label="Anomalie initiale M₀" hint="Position sur l'orbite à t = 0" value={o.m0} min={0} max={360} step={1} onChange={(v) => setOrbit(body, 'm0', v)} format={deg} tone="ion" />
      </Section>

      <Section title="Mouvement" icon={<Spline />}>
        <ToggleRow
          label="Période automatique"
          hint="Calculée par la 3ᵉ loi de Kepler à partir des masses"
          checked={o.period === null}
          onChange={(auto) => setOrbit(body, 'period', auto ? null : Number.isFinite(period) ? Number(period.toFixed(3)) : 365)}
        />
        {o.period === null ? (
          <Field label="Période">
            <div className="flex h-7 items-center justify-end px-1 font-mono text-[11.5px] text-ink-2 tabular">{formatDays(period)}</div>
          </Field>
        ) : (
          <NumberRow label="Période" value={o.period} onChange={(v) => setOrbit(body, 'period', Math.max(1e-4, v))} unit="j" log min={1e-4} precision={2} step={1} />
        )}
        <ToggleRow label="Rétrograde" hint="Tourne dans le sens inverse des autres corps" checked={o.retrograde} onChange={(v) => setOrbit(body, 'retrograde', v)} />
        <ToggleRow label="Position fixe" hint="Immobile sur son orbite (balises, nébuleuses…)" checked={o.fixed} onChange={(v) => setOrbit(body, 'fixed', v)} />
        <ToggleRow label="Afficher l'orbite" checked={o.show} onChange={(v) => setOrbit(body, 'show', v)} />
        <div className="grid grid-cols-3 gap-1.5 pt-1.5">
          <Stat label="Périastre" value={fmtDist(periapsis(o))} />
          <Stat label="Apoastre" value={fmtDist(apoapsis(o))} />
          <Stat label="Période" value={o.fixed ? 'Fixe' : formatDays(period)} />
        </div>
      </Section>

      {parent && <LagrangeSection body={body} system={system} />}
    </>
  )
}

function LagrangeSection({ body, system }: { body: Body; system: StarSystem }) {
  const refs = useMemo(
    () =>
      Object.values(system.bodies).filter(
        (b) => b.id !== body.id && b.parentId === body.parentId && b.orbit && !b.orbit.fixed && (b.kind === 'planet' || b.kind === 'moon' || b.kind === 'star'),
      ),
    [system.bodies, body.id, body.parentId],
  )
  const [refId, setRefId] = useState<Id | null>(null)
  const current = refId && refs.some((r) => r.id === refId) ? refId : refs[0]?.id ?? null
  if (!refs.length) return null
  return (
    <Section title="Points de Lagrange" icon={<Triangle />} defaultOpen={false}>
      <Hint>Place l'objet sur l'orbite d'un corps voisin, 60° devant (L4) ou derrière (L5), idéal pour les stations et astéroïdes troyens.</Hint>
      <Field label="Corps de référence">
        <Select
          value={current ?? ''}
          options={refs.map((r) => ({ value: r.id, label: r.name, icon: <BodyIcon body={r} size={13} /> }))}
          onChange={setRefId}
        />
      </Field>
      <div className="grid grid-cols-2 gap-1.5">
        <Button size="sm" disabled={!current} onClick={() => current && placeAtLagrange(body.id, current, 'L4')}>
          L4 · en avant
        </Button>
        <Button size="sm" disabled={!current} onClick={() => current && placeAtLagrange(body.id, current, 'L5')}>
          L5 · en arrière
        </Button>
      </div>
    </Section>
  )
}

function BeltOrbit({ body, system, parent }: { body: Extract<Body, { kind: 'belt' }>; system: StarSystem; parent: Body | null }) {
  const local = !usesStellarMapping(parent?.kind ?? null)
  const factor = local ? AU_KM : 1
  const unit = local ? 'km' : 'UA'
  const p = body.props
  return (
    <>
      <Section title="Parent" icon={<CircleDot />}>
        <ParentSection body={body} system={system} />
      </Section>
      <Section title="Étendue" icon={<OrbitIcon />}>
        <Field label="Bord intérieur">
          <NumberField value={p.inner} onChange={(v) => setProp(body, 'inner', Math.max(1e-9, Math.min(v, p.outer * 0.99)))} displayFactor={factor} unit={unit} log precision={local ? 0 : 2} />
        </Field>
        <Field label="Bord extérieur">
          <NumberField value={p.outer} onChange={(v) => setProp(body, 'outer', Math.max(v, p.inner * 1.01))} displayFactor={factor} unit={unit} log precision={local ? 0 : 2} />
        </Field>
        <PSlider body={body} k="thickness" label="Épaisseur" hint="Dispersion verticale relative au rayon" min={0} max={0.3} step={0.005} format={pct} />
        <PSlider body={body} k="eccentricity" label="Dispersion" hint="Excentricité aléatoire des orbites" min={0} max={0.3} step={0.005} format={pct} />
      </Section>
      <Section title="Plan" icon={<Spline />}>
        <PNumber body={body} k="inclination" label="Inclinaison" min={-90} max={90} step={0.5} precision={1} unit="°" />
        <PNumber body={body} k="node" label="Nœud ascendant" step={1} precision={1} unit="°" />
        <Field label="Largeur">
          <div className="flex h-7 items-center justify-end font-mono text-[11.5px] text-ink-2">
            {local ? `${num((p.outer - p.inner) * AU_KM, 0)} km` : `${num(p.outer - p.inner, 2)} UA`}
          </div>
        </Field>
      </Section>
    </>
  )
}
