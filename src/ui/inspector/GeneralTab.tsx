import { useMemo, useState } from 'react'
import { Eye, Lock, Ruler, Tag, Users } from 'lucide-react'
import { MARKER_COLORS } from '@/core/defaults'
import { derivedStats } from '@/core/physics'
import { planetPreset } from '@/core/planetPresets'
import { starPreset } from '@/core/starPresets'
import type { Body, BodyKind, LuminosityClass, PlanetType, StarClass, StarSystem } from '@/core/types'
import { blackbodyHex } from '@/lib/color'
import { formatDays, formatHours, formatTemp, num } from '@/lib/format'
import { Button, Field, Section, Select, Stat, TextField } from '../kit'
import { applyMainColor, editBody, mainColor, setField, setProp } from './edit'
import { ColorRow, Hint, PSelect, ToggleRow } from './fields'
import {
  BELT_TYPE_OPTIONS,
  GATE_TYPE_OPTIONS,
  LUM_CLASS_OPTIONS,
  MARKER_TYPE_OPTIONS,
  NEBULA_TYPE_OPTIONS,
  PLANET_TYPE_OPTIONS,
  SHIP_TYPE_OPTIONS,
  STAR_CLASS_OPTIONS,
  STATION_TYPE_OPTIONS,
} from './options'

const SPECIAL_STARS: StarClass[] = ['BD', 'WD', 'NS', 'PSR', 'BH']

export function applyStarClass(body: Extract<Body, { kind: 'star' }>, cls: StarClass, sub: number, lum: LuminosityClass) {
  const preset = starPreset(cls, sub, lum)
  const wasSpecial = SPECIAL_STARS.includes(body.props.starClass)
  const isSpecial = SPECIAL_STARS.includes(cls)
  const familyChange = wasSpecial || isSpecial
  const oldAuto = body.props.colorOverride ?? blackbodyHex(body.props.temperature)
  const followColor = body.color.toLowerCase() === oldAuto.toLowerCase()
  editBody(body.id, 'starClass', (b) => {
    if (b.kind !== 'star') return
    const keep = familyChange ? {} : {
      corona: b.props.corona,
      rays: b.props.rays,
      flare: b.props.flare,
      spots: b.props.spots,
      activity: b.props.activity,
      colorOverride: b.props.colorOverride,
    }
    b.props = { ...b.props, ...preset, ...keep }
    if (followColor) b.color = b.props.colorOverride ?? blackbodyHex(b.props.temperature)
  }, false)
}

export function applyPlanetType(body: Extract<Body, { kind: 'planet' | 'moon' }>, type: PlanetType) {
  const preset = planetPreset(type)
  const followColor = body.color.toLowerCase() === body.props.palette[2].toLowerCase()
  editBody(body.id, 'planetType', (b) => {
    if (b.kind !== 'planet' && b.kind !== 'moon') return
    const { radius, mass, rings } = b.props
    b.props = { ...preset, radius, mass, rings }
    if (followColor) b.color = preset.palette[2]
  }, false)
}

const ROMAN_SUB = Array.from({ length: 10 }, (_, i) => ({ value: String(i), label: String(i) }))

export function GeneralTab({ body, system }: { body: Body; system: StarSystem }) {
  return (
    <>
      <Section title="Identité" icon={<Tag />}>
        <Field label="Nom">
          <TextField value={body.name} onChange={(e) => setField(body, 'name', e.target.value)} />
        </Field>
        <TypeFields body={body} system={system} />
      </Section>

      <QuickStats body={body} system={system} />

      <Section title="Repère" icon={<Eye />}>
        <ColorRow label="Couleur principale" hint="Recolore l'objet lui-même (palette, coque, étoile…) ainsi que son orbite et son étiquette" value={mainColor(body)} onChange={(v) => applyMainColor(body, v)} />
        <ColorRow label="Couleur du repère" hint="Teinte de l'orbite, de l'étiquette et de l'icône uniquement" value={body.color} onChange={(v) => setField(body, 'color', v)} />
        <ToggleRow label="Étiquette" checked={body.showLabel} onChange={(v) => setField(body, 'showLabel', v)} />
        <Field label="Mots-clés" hint="Séparés par des virgules">
          <TextField
            value={body.tags.join(', ')}
            placeholder="colonie, corpo, danger…"
            onChange={(e) =>
              setField(
                body,
                'tags',
                e.target.value.split(',').map((t) => t.trimStart()).filter((t, i, a) => t || i === a.length - 1),
              )
            }
          />
        </Field>
      </Section>

      <Section title="Visibilité" icon={<Users />}>
        <ToggleRow label="Visible (éditeur)" checked={body.visible} onChange={(v) => setField(body, 'visible', v)} />
        <ToggleRow
          label="Visible aux joueurs"
          hint="Masqué en mode joueurs, parfait pour les secrets"
          checked={body.playerVisible}
          onChange={(v) => setField(body, 'playerVisible', v)}
        />
        <ToggleRow label="Verrouillé" hint="Empêche les modifications accidentelles" checked={body.locked} onChange={(v) => setField(body, 'locked', v)} />
        {!body.playerVisible && (
          <Hint>
            <Lock className="mr-1 inline size-3 text-aurum" />
            Cet objet n'apparaît pas aux joueurs (ni ses satellites).
          </Hint>
        )}
      </Section>
    </>
  )
}

function TypeFields({ body, system }: { body: Body; system: StarSystem }) {
  switch (body.kind) {
    case 'star':
      return <StarTypeFields body={body} />
    case 'planet':
    case 'moon':
      return <PlanetTypeFields body={body} />
    case 'belt':
      return <PSelect body={body} k="beltType" label="Type" options={BELT_TYPE_OPTIONS} />
    case 'nebula':
      return <PSelect body={body} k="nebulaType" label="Type" options={NEBULA_TYPE_OPTIONS} />
    case 'station':
      return <PSelect body={body} k="stationType" label="Type" options={STATION_TYPE_OPTIONS} />
    case 'ship':
      return (
        <>
          <PSelect body={body} k="shipType" label="Type" options={SHIP_TYPE_OPTIONS} />
          <Field label="Transpondeur">
            <TextField value={body.props.transponder} placeholder="ISV-0451" onChange={(e) => setProp(body, 'transponder', e.target.value)} />
          </Field>
        </>
      )
    case 'gate':
      return (
        <>
          <PSelect body={body} k="gateType" label="Type" options={GATE_TYPE_OPTIONS} />
          <GateDestination body={body} system={system} />
        </>
      )
    case 'marker':
      return (
        <>
          <Field label="Type">
            <Select
              value={body.props.markerType}
              options={MARKER_TYPE_OPTIONS}
              onChange={(v) =>
                editBody(body.id, 'markerType', (b) => {
                  if (b.kind !== 'marker') return
                  if (b.color.toLowerCase() === MARKER_COLORS[b.props.markerType].toLowerCase()) b.color = MARKER_COLORS[v]
                  b.props.markerType = v
                }, false)
              }
            />
          </Field>
          <Field label="Code" hint="Court texte affiché dans l'hologramme (SOS, X-7…)">
            <TextField value={body.props.code} maxLength={8} placeholder="SOS" onChange={(e) => setProp(body, 'code', e.target.value.toUpperCase())} />
          </Field>
        </>
      )
    case 'barycenter':
      return <Hint>Point invisible autour duquel orbitent les composantes d'un système multiple.</Hint>
    default:
      return null
  }
}

function StarTypeFields({ body }: { body: Extract<Body, { kind: 'star' }> }) {
  const p = body.props
  const special = SPECIAL_STARS.includes(p.starClass)
  const hasSub = !['NS', 'PSR', 'BH'].includes(p.starClass)
  return (
    <>
      <Field label="Classe">
        <Select value={p.starClass} options={STAR_CLASS_OPTIONS} onChange={(v) => applyStarClass(body, v, p.subclass, special ? 'V' : p.lumClass)} />
      </Field>
      {hasSub && (
        <Field label="Sous-classe" hint="0 = plus chaude, 9 = plus froide">
          <Select value={String(p.subclass)} options={ROMAN_SUB} onChange={(v) => applyStarClass(body, p.starClass, Number(v), p.lumClass)} />
        </Field>
      )}
      {!special && (
        <Field label="Luminosité">
          <Select value={p.lumClass} options={LUM_CLASS_OPTIONS} onChange={(v) => applyStarClass(body, p.starClass, p.subclass, v)} />
        </Field>
      )}
      <Hint>Changer de classe met à jour température, rayon, masse et luminosité.</Hint>
    </>
  )
}

function PlanetTypeFields({ body }: { body: Extract<Body, { kind: 'planet' | 'moon' }> }) {
  const [justChanged, setJustChanged] = useState<PlanetType | null>(null)
  return (
    <>
      <Field label="Type">
        <Select
          value={body.props.planetType}
          options={PLANET_TYPE_OPTIONS}
          onChange={(v) => {
            applyPlanetType(body, v)
            setJustChanged(v)
          }}
        />
      </Field>
      {justChanged === body.props.planetType && (
        <div className="flex animate-fade-in items-center gap-2 rounded-lg border border-aurum/20 bg-aurum/[0.06] px-2.5 py-2">
          <Ruler className="size-3.5 shrink-0 text-aurum" />
          <span className="flex-1 text-[11px] text-ink-2">Apparence appliquée. Taille et masse conservées.</span>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => {
              const pr = planetPreset(justChanged)
              editBody(body.id, 'size-preset', (b) => {
                if (b.kind !== 'planet' && b.kind !== 'moon') return
                b.props.radius = b.kind === 'moon' ? Math.min(pr.radius, 0.6) : pr.radius
                b.props.mass = b.kind === 'moon' ? Math.min(pr.mass, 0.05) : pr.mass
                b.props.albedo = pr.albedo
                b.props.greenhouse = pr.greenhouse
              }, false)
              setJustChanged(null)
            }}
          >
            Taille typique
          </Button>
        </div>
      )}
    </>
  )
}

function GateDestination({ body, system }: { body: Extract<Body, { kind: 'gate' }>; system: StarSystem }) {
  void system
  return (
    <Field label="Destination" hint="Système relié (texte libre)">
      <TextField value={body.props.destination} placeholder="Système Kharon" onChange={(e) => setProp(body, 'destination', e.target.value)} />
    </Field>
  )
}

const STAT_KINDS: BodyKind[] = ['planet', 'moon']

function QuickStats({ body, system }: { body: Body; system: StarSystem }) {
  const stats = useMemo(() => (STAT_KINDS.includes(body.kind) ? derivedStats(system, body) : null), [body, system])
  if (!stats) return null
  return (
    <div className="grid grid-cols-2 gap-1.5 border-b border-line px-3 py-3">
      <Stat label="Gravité" value={num(stats.gravityG ?? 0, 2)} unit="g" />
      <Stat
        label="Température"
        value={stats.surfaceK ? `${num(stats.surfaceK - 273.15, 0)} °C` : '–'}
        tone={stats.surfaceK && stats.surfaceK > 373 ? 'nova' : stats.surfaceK && stats.surfaceK < 200 ? 'ion' : undefined}
      />
      <Stat label={body.kind === 'moon' ? 'Révolution' : 'Année'} value={formatDays(stats.periodDays)} />
      <Stat
        label="Jour solaire"
        value={stats.solarDayHours && Number.isFinite(stats.solarDayHours) ? formatHours(stats.solarDayHours) : 'Synchrone'}
        tone={stats.inHabitableZone ? 'viridis' : undefined}
      />
      {stats.inHabitableZone && (
        <div className="col-span-2 flex items-center gap-2 rounded-lg border border-viridis/25 bg-viridis/[0.07] px-2.5 py-1.5 text-[11px] text-viridis">
          <span className="size-1.5 rounded-full bg-viridis" />
          Dans la zone habitable · {formatTemp(stats.equilibriumK ?? 0).split(' (')[0]} d'équilibre
        </div>
      )}
    </div>
  )
}
