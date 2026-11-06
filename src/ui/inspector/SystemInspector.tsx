import { useMemo } from 'react'
import { CalendarDays, Dices, Hash, Ruler, Sparkles, Telescope } from 'lucide-react'
import { KIND_LABEL_PLURAL } from '@/core/labels'
import type { BodyKind, ScaleMode, StarSystem } from '@/core/types'
import { BodyIcon } from '../icons'
import { Button, Field, NumberField, Section, Segmented, TextArea, TextField } from '../kit'
import { editSystem } from './edit'
import { ColorRow, Hint, SliderRow, deg, pct, times } from './fields'

const KIND_ORDER: BodyKind[] = ['star', 'planet', 'moon', 'belt', 'comet', 'nebula', 'station', 'ship', 'gate', 'marker']

export function SystemInspector({ system }: { system: StarSystem }) {
  const d = system.display
  const env = system.environment
  const counts = useMemo(() => {
    const c = new Map<BodyKind, number>()
    for (const b of Object.values(system.bodies)) c.set(b.kind, (c.get(b.kind) ?? 0) + 1)
    return c
  }, [system.bodies])
  const sample = useMemo(() => {
    const m = new Map<BodyKind, (typeof system.bodies)[string]>()
    for (const b of Object.values(system.bodies)) if (!m.has(b.kind)) m.set(b.kind, b)
    return m
  }, [system.bodies])

  return (
    <>
      <Section title="Identité" icon={<Telescope />}>
        <Field label="Nom">
          <TextField value={system.name} onChange={(e) => editSystem('name', (s) => void (s.name = e.target.value))} />
        </Field>
        <Field label="Désignation" hint="Code de catalogue">
          <TextField value={system.designation} placeholder="HD 40307, KX-4471…" onChange={(e) => editSystem('designation', (s) => void (s.designation = e.target.value))} />
        </Field>
        <Field label="Description" stacked>
          <TextArea rows={3} value={system.description} placeholder="Ambiance, histoire, enjeux du système…" onChange={(e) => editSystem('description', (s) => void (s.description = e.target.value))} />
        </Field>
      </Section>

      <Section title="Inventaire" icon={<Hash />}>
        <div className="grid grid-cols-2 gap-x-4">
          {KIND_ORDER.filter((k) => counts.get(k)).map((k) => (
            <div key={k} className="flex items-center gap-2 border-b border-line py-1.5">
              {sample.get(k) && <BodyIcon body={sample.get(k)!} size={13} />}
              <span className="flex-1 truncate text-[11.5px] text-ink-2">{KIND_LABEL_PLURAL[k]}</span>
              <span className="font-mono text-[11.5px] text-ink tabular">{counts.get(k)}</span>
            </div>
          ))}
          {!counts.size && <Hint>Système vide. Ajoutez une étoile avec le bouton « Ajouter ».</Hint>}
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="font-mono text-[10.5px] text-ink-3">Graine · {system.seed}</span>
          <span className="font-mono text-[10.5px] text-ink-3">{Object.keys(system.routes).length} route(s)</span>
        </div>
      </Section>

      <Section title="Calendrier" icon={<CalendarDays />}>
        <Field label="Année d'origine" hint="t = 0 correspond au 1er janvier de cette année">
          <NumberField value={system.calendar.epochYear} onChange={(v) => editSystem('epochYear', (s) => void (s.calendar.epochYear = Math.round(v)))} step={1} precision={0} grouping={false} />
        </Field>
        <Field label="Ère" hint="Suffixe affiché après l'année">
          <TextField value={system.calendar.era} placeholder="ap. J.-C., ère corporatiste…" onChange={(e) => editSystem('era', (s) => void (s.calendar.era = e.target.value))} />
        </Field>
      </Section>

      <Section title="Échelle d'affichage" icon={<Ruler />}>
        <Field label="Distances">
          <Segmented<ScaleMode>
            size="xs"
            value={d.scaleMode}
            onChange={(v) => editSystem('scaleMode', (s) => void (s.display.scaleMode = v))}
            options={[
              { value: 'linear', label: 'Réaliste' },
              { value: 'compressed', label: 'Compressée' },
              { value: 'log', label: 'Log' },
            ]}
          />
        </Field>
        <SliderRow label="Facteur de distance" value={d.distanceScale} min={0.25} max={4} step={0.05} format={times} onChange={(v) => editSystem('distanceScale', (s) => void (s.display.distanceScale = v))} />
        <SliderRow label="Taille des astres" value={d.bodyScale} min={0.25} max={4} step={0.05} format={times} onChange={(v) => editSystem('bodyScale', (s) => void (s.display.bodyScale = v))} />
        <SliderRow label="Écart des lunes" value={d.moonDistanceScale} min={0.5} max={3} step={0.05} format={times} onChange={(v) => editSystem('moonDistanceScale', (s) => void (s.display.moonDistanceScale = v))} />
        <Hint>Les valeurs physiques (UA, km, jours) restent exactes : seule la représentation change.</Hint>
      </Section>

      <Section title="Environnement" icon={<Sparkles />}>
        <SliderRow label="Densité d'étoiles" value={env.starDensity} min={0} max={1} format={pct} onChange={(v) => editSystem('starDensity', (s) => void (s.environment.starDensity = v))} />
        <SliderRow label="Voie lactée" value={env.milkyWay} min={0} max={1} format={pct} onChange={(v) => editSystem('milkyWay', (s) => void (s.environment.milkyWay = v))} />
        <SliderRow label="Orientation" value={env.milkyWayTilt} min={-90} max={90} step={1} format={deg} tone="ion" onChange={(v) => editSystem('milkyWayTilt', (s) => void (s.environment.milkyWayTilt = v))} />
        <SliderRow label="Nébuleuses de fond" value={env.nebulaIntensity} min={0} max={1} format={pct} tone="nebula" onChange={(v) => editSystem('nebulaIntensity', (s) => void (s.environment.nebulaIntensity = v))} />
        <ColorRow label="Teinte 1" value={env.nebulaColor} onChange={(v) => editSystem('nebulaColor', (s) => void (s.environment.nebulaColor = v))} />
        <ColorRow label="Teinte 2" value={env.nebulaColor2} onChange={(v) => editSystem('nebulaColor2', (s) => void (s.environment.nebulaColor2 = v))} />
        <SliderRow label="Lumière ambiante" hint="Éclaire légèrement les faces nocturnes" value={env.ambient} min={0} max={0.3} step={0.005} format={pct} onChange={(v) => editSystem('ambient', (s) => void (s.environment.ambient = v))} />
        <div className="flex justify-end pt-1">
          <Button
            size="xs"
            variant="outline"
            icon={<Dices className="size-3" />}
            onClick={() => editSystem('envSeed', (s) => void (s.environment.seed = Math.floor(Math.random() * 1e6)))}
          >
            Nouveau ciel
          </Button>
        </div>
      </Section>
    </>
  )
}
