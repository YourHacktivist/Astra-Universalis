import { useMemo } from 'react'
import { Atom, Gauge, RefreshCw, RotateCw, Sun, Thermometer } from 'lucide-react'
import { stars as starList } from '@/core/hierarchy'
import { derivedStats, frostLine, habitableZone } from '@/core/physics'
import { luminosityFrom, schwarzschildKm, spectralLabel } from '@/core/starPresets'
import type { Body, StarSystem } from '@/core/types'
import { blackbodyHex } from '@/lib/color'
import { formatDays, formatHours, num, sci } from '@/lib/format'
import { Button, Field, NumberField, Section, Stat } from '../kit'
import { editBody, setProp, setRotation } from './edit'
import { Hint, NumberRow, PNumber, PSlider, SliderRow, ToggleRow, deg, pct } from './fields'

export function hasPhysicsTab(body: Body) {
  return ['star', 'planet', 'moon', 'comet', 'station', 'ship'].includes(body.kind)
}

export function PhysicsTab({ body, system }: { body: Body; system: StarSystem }) {
  return (
    <>
      {body.kind === 'star' && <StarPhysics body={body} system={system} />}
      {(body.kind === 'planet' || body.kind === 'moon') && <PlanetPhysics body={body} system={system} />}
      {body.kind === 'comet' && (
        <Section title="Noyau" icon={<Atom />}>
          <PNumber body={body} k="nucleusKm" label="Rayon du noyau" unit="km" log min={0.05} precision={2} />
          <Hint>Valeur indicative : la taille affichée est exagérée pour rester visible.</Hint>
        </Section>
      )}
      {(body.kind === 'station' || body.kind === 'ship') && (
        <Section title="Dimensions" icon={<Atom />}>
          <PNumber body={body} k="lengthM" label="Longueur réelle" unit="m" log min={1} precision={0} />
          <Hint>Indicatif. La taille à l'écran se règle dans l'onglet Apparence.</Hint>
        </Section>
      )}
      <RotationSection body={body} />
    </>
  )
}

function RotationSection({ body }: { body: Body }) {
  const r = body.rotation
  const canLock = !!body.orbit && body.kind !== 'star'
  return (
    <Section title="Rotation" icon={<RotateCw />}>
      {canLock && (
        <ToggleRow label="Rotation synchrone" hint="Verrouillage par effet de marée : montre toujours la même face" checked={r.locked} onChange={(v) => setRotation(body, 'locked', v)} />
      )}
      <NumberRow
        label="Période sidérale"
        hint="Négatif = rotation rétrograde · 0 = pas de rotation"
        value={r.period}
        onChange={(v) => setRotation(body, 'period', v)}
        unit="h"
        precision={2}
        step={0.1}
        disabled={r.locked && canLock}
      />
      <SliderRow label="Inclinaison de l'axe" hint="Obliquité (Terre : 23,4°)" value={r.tilt} min={0} max={180} step={0.1} onChange={(v) => setRotation(body, 'tilt', v)} format={deg} />
      <SliderRow label="Direction de l'axe" value={r.azimuth} min={0} max={360} step={1} onChange={(v) => setRotation(body, 'azimuth', v)} format={deg} tone="ion" />
      <SliderRow label="Phase initiale" value={r.phase} min={0} max={360} step={1} onChange={(v) => setRotation(body, 'phase', v)} format={deg} tone="ion" />
    </Section>
  )
}

function PlanetPhysics({ body, system }: { body: Extract<Body, { kind: 'planet' | 'moon' }>; system: StarSystem }) {
  const s = useMemo(() => derivedStats(system, body), [system, body])
  const k2c = (k: number | null) => (k === null ? '–' : `${num(k - 273.15, 0)} °C`)
  return (
    <>
      <Section title="Dimensions" icon={<Gauge />}>
        <PNumber body={body} k="radius" label="Rayon" hint="En rayons terrestres (6 371 km)" unit="R⊕" log min={0.005} precision={3} />
        <PNumber body={body} k="mass" label="Masse" hint="En masses terrestres" unit="M⊕" log min={1e-6} precision={4} />
        <Field label="Rayon réel">
          <div className="flex h-7 items-center justify-end font-mono text-[11.5px] text-ink-3 tabular">{num(body.props.radius * 6371, 0)} km</div>
        </Field>
      </Section>
      <Section title="Climat" icon={<Thermometer />}>
        <PSlider body={body} k="albedo" label="Albédo" hint="Fraction de lumière réfléchie" min={0} max={1} step={0.01} format={pct} />
        <PNumber body={body} k="greenhouse" label="Effet de serre" hint="Réchauffement ajouté à la température d'équilibre" unit="K" step={1} precision={0} />
      </Section>
      <Section title="Valeurs dérivées" icon={<Atom />}>
        <div className="grid grid-cols-2 gap-1.5">
          <Stat label="Gravité de surface" value={num(s.gravityG ?? 0, 2)} unit="g" />
          <Stat label="Vitesse de libération" value={num(s.escapeKms ?? 0, 2)} unit="km/s" />
          <Stat label="Densité" value={num(s.densityGcm3 ?? 0, 2)} unit="g/cm³" />
          <Stat label="Lumière reçue" value={s.distanceAU ? num(s.luminosity / Math.max(1e-9, illumDist(system, body) ** 2), 3) : '–'} unit="× Terre" />
          <Stat label="T. d'équilibre" value={k2c(s.equilibriumK)} />
          <Stat
            label="T. de surface"
            value={k2c(s.surfaceK)}
            tone={s.surfaceK && s.surfaceK > 373 ? 'nova' : s.surfaceK && s.surfaceK < 200 ? 'ion' : 'aurum'}
          />
          <Stat label={body.kind === 'moon' ? 'Révolution' : 'Année'} value={formatDays(s.periodDays)} />
          <Stat
            label="Jour solaire"
            value={s.solarDayHours && Number.isFinite(s.solarDayHours) ? formatHours(s.solarDayHours) : 'Synchrone'}
          />
          {s.obliquityDeg !== null && <Stat label="Obliquité (orbite)" value={num(s.obliquityDeg, 1)} unit="°" />}
        </div>
        {s.inHabitableZone !== null && (
          <div
            className={
              'mt-2 flex items-center gap-2 border-t border-line pt-2 font-mono text-[10.5px] uppercase tracking-[0.12em] ' +
              (s.inHabitableZone ? 'text-viridis' : 'text-ink-3')
            }
          >
            <span className={'size-1.5 ' + (s.inHabitableZone ? 'bg-viridis' : 'bg-ink-3')} />
            {s.inHabitableZone ? 'Dans la zone habitable' : 'Hors de la zone habitable'}
          </div>
        )}
      </Section>
    </>
  )
}

function illumDist(system: StarSystem, body: Body) {
  let cur: Body | undefined = body
  let d = body.orbit?.a ?? 1
  let guard = 0
  while (cur && guard++ < 16) {
    const parent: Body | undefined = cur.parentId ? system.bodies[cur.parentId] : undefined
    if (cur.orbit) d = cur.orbit.a
    if (!parent || parent.kind === 'star' || parent.kind === 'barycenter') break
    cur = parent
  }
  return d
}

function StarPhysics({ body, system }: { body: Extract<Body, { kind: 'star' }>; system: StarSystem }) {
  const p = body.props
  const bh = p.starClass === 'BH'
  const hz = habitableZone(p.luminosity)
  const multiple = starList(system).length > 1
  return (
    <>
      <Section title="Paramètres stellaires" icon={<Sun />}>
        <Field label="Désignation">
          <div className="flex h-7 items-center justify-end font-mono text-[11.5px] text-aurum-hi">{spectralLabel(p)}</div>
        </Field>
        {!bh && (
          <Field label="Température" hint="Température effective : détermine la couleur">
            <div className="flex items-center gap-2">
              <span className="size-4 shrink-0 rounded-full" style={{ background: blackbodyHex(p.temperature), color: blackbodyHex(p.temperature) }} />
              <div className="flex-1">
                <PNumberInline body={body} k="temperature" unit="K" min={500} max={600000} />
              </div>
            </div>
          </Field>
        )}
        {bh ? (
          <Field label="Horizon">
            <div className="flex h-7 items-center justify-end font-mono text-[11.5px] text-ink-2">{num(schwarzschildKm(p.mass), 1)} km</div>
          </Field>
        ) : (
          <PNumber body={body} k="radius" label="Rayon" unit="R☉" log min={1e-6} precision={3} />
        )}
        <PNumber body={body} k="mass" label="Masse" unit="M☉" log min={0.01} precision={3} />
        <PNumber body={body} k="luminosity" label="Luminosité" unit="L☉" log min={1e-7} precision={4} />
        {!bh && (
          <Button
            size="xs"
            variant="ghost"
            icon={<RefreshCw className="size-3" />}
            onClick={() => setProp(body, 'luminosity', Number(luminosityFrom(p.radius, p.temperature).toPrecision(4)))}
          >
            Recalculer la luminosité (R, T)
          </Button>
        )}
      </Section>
      <Section title="Zones" icon={<Thermometer />}>
        <div className="grid grid-cols-3 gap-1.5">
          <Stat label="ZH intérieure" value={num(hz.inner, 2)} unit="UA" tone="viridis" />
          <Stat label="ZH extérieure" value={num(hz.outer, 2)} unit="UA" tone="viridis" />
          <Stat label="Ligne des glaces" value={num(frostLine(p.luminosity), 2)} unit="UA" tone="ion" />
        </div>
        <Hint>
          Zone habitable et ligne des glaces {multiple ? 'de cette étoile seule' : 'du système'} (luminosité {sci(p.luminosity)} L☉). Affichez-les dans les options de vue.
        </Hint>
      </Section>
    </>
  )
}

function PNumberInline({ body, k, unit, min, max }: { body: Body; k: string; unit: string; min?: number; max?: number }) {
  const v = Number((body.props as unknown as Record<string, unknown>)[k] ?? 0)
  return (
    <NumberRowLess
      value={v}
      unit={unit}
      min={min}
      max={max}
      onChange={(nv) =>
        editBody(body.id, `props.${k}`, (b) => {
          ;(b.props as unknown as Record<string, unknown>)[k] = Math.round(nv)
          if (b.kind === 'star' && k === 'temperature' && !b.props.colorOverride) b.color = blackbodyHex(Math.round(nv))
        })
      }
    />
  )
}

function NumberRowLess(props: { value: number; unit: string; min?: number; max?: number; onChange(v: number): void }) {
  return <NumberField {...props} step={50} precision={0} />
}
