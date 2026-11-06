import { Cloud, Dices, Flame, Layers, Palette, Sparkles, Sun, Wind, Zap } from 'lucide-react'
import { hasSurface } from '@/core/planetPresets'
import type { Body } from '@/core/types'
import { blackbodyHex } from '@/lib/color'
import { Button, ColorField, Field, NumberField, Section, Tooltip } from '../kit'
import { editBody, setField, setPropIndex } from './edit'
import { Hint, PColor, PNumber, PSlider, PToggle, ToggleRow, deg, int, pct, times } from './fields'
import { BANDED_TYPES, PALETTE_LABELS } from './options'

function SeedRow({ body }: { body: Body }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="flex-1 font-mono text-[10.5px] text-ink-3">Graine #{body.seed}</span>
      <Button
        size="xs"
        variant="outline"
        icon={<Dices className="size-3" />}
        onClick={() => setField(body, 'seed', Math.floor(Math.random() * 2147483647))}
      >
        Nouvelle graine
      </Button>
    </div>
  )
}

export function AppearanceTab({ body }: { body: Body }) {
  switch (body.kind) {
    case 'planet':
    case 'moon':
      return <PlanetLook body={body} />
    case 'star':
      return <StarLook body={body} />
    case 'belt':
      return (
        <Section title="Ceinture" icon={<Sparkles />}>
          <PNumber body={body} k="count" label="Rochers" hint="Réduit automatiquement selon la qualité" log min={50} max={40000} precision={0} />
          <PSlider body={body} k="rockSize" label="Taille des rochers" min={0.2} max={4} step={0.05} format={times} />
          <PSlider body={body} k="dust" label="Poussière" min={0} max={1} format={pct} />
          <PSlider body={body} k="clumping" label="Regroupement" hint="Amas troyens / irrégularités" min={0} max={1} format={pct} />
          <PColor body={body} k="colorA" label="Roche claire" />
          <PColor body={body} k="colorB" label="Roche sombre" />
          <PColor body={body} k="dustColor" label="Poussière" />
          <SeedRow body={body} />
        </Section>
      )
    case 'nebula':
      return <NebulaLook body={body} />
    case 'comet':
      return (
        <Section title="Comète" icon={<Sparkles />}>
          <PSlider body={body} k="tailLength" label="Longueur des queues" min={0.2} max={4} step={0.05} format={times} />
          <PSlider body={body} k="activity" label="Activité" hint="Dégazage : plus fort près de l'étoile" min={0} max={2} step={0.05} format={times} />
          <PColor body={body} k="comaColor" label="Chevelure" />
          <PColor body={body} k="ionColor" label="Queue ionique" />
          <PColor body={body} k="dustColor" label="Queue de poussière" />
          <SeedRow body={body} />
        </Section>
      )
    case 'station':
      return (
        <Section title="Station" icon={<Layers />}>
          <PSlider body={body} k="size" label="Taille affichée" min={0.2} max={5} step={0.05} format={times} />
          <PColor body={body} k="hullColor" label="Coque" />
          <PColor body={body} k="accentColor" label="Accents" />
          <PColor body={body} k="lightsColor" label="Éclairage" />
          <PSlider body={body} k="spin" label="Rotation de l'habitat" min={0} max={2} step={0.05} format={times} />
          <PToggle body={body} k="damaged" label="Endommagée" hint="Lumières vacillantes, structure brisée" />
          <SeedRow body={body} />
        </Section>
      )
    case 'ship':
      return (
        <Section title="Vaisseau" icon={<Zap />}>
          <PSlider body={body} k="size" label="Taille affichée" min={0.2} max={5} step={0.05} format={times} />
          <PColor body={body} k="hullColor" label="Coque" />
          <PColor body={body} k="engineColor" label="Réacteurs" />
          <PToggle body={body} k="thrusting" label="Propulsion active" />
          <PToggle body={body} k="trail" label="Traînée" />
          <PToggle body={body} k="damaged" label="Endommagé" />
          <SeedRow body={body} />
        </Section>
      )
    case 'gate':
      return (
        <Section title="Portail" icon={<Sparkles />}>
          <PSlider body={body} k="size" label="Taille affichée" min={0.2} max={6} step={0.05} format={times} />
          <PColor body={body} k="color" label="Énergie" />
          <PToggle body={body} k="active" label="Actif" />
        </Section>
      )
    case 'marker':
      return (
        <Section title="Marqueur" icon={<Sparkles />}>
          <PSlider body={body} k="size" label="Taille" min={0.3} max={4} step={0.05} format={times} />
          <PToggle body={body} k="pulse" label="Pulsation" />
          <Hint>La couleur du marqueur est celle du repère (onglet Général).</Hint>
        </Section>
      )
    case 'barycenter':
      return (
        <Section title="Repère" icon={<Sparkles />}>
          <PToggle body={body} k="showMarker" label="Afficher la croix" />
        </Section>
      )
  }
}

function PlanetLook({ body }: { body: Extract<Body, { kind: 'planet' | 'moon' }> }) {
  const p = body.props
  const labels = PALETTE_LABELS[p.planetType]
  const banded = BANDED_TYPES.includes(p.planetType)
  const surface = hasSurface(p.planetType)
  const lava = p.planetType === 'lava' || p.planetType === 'chthonian' || p.planetType === 'hotjupiter' || p.planetType === 'exotic'
  return (
    <>
      <Section title="Palette" icon={<Palette />}>
        <div className="grid grid-cols-5 gap-1.5">
          {p.palette.map((c, i) => (
            <Tooltip key={i} content={labels[i]}>
              <div className="flex flex-col items-center gap-1">
                <ColorField compact value={c} onChange={(v) => setPropIndex(body, 'palette', i, v)} className="!h-9 !w-full" />
                <span className="w-full truncate text-center text-[9.5px] text-ink-3">{labels[i]}</span>
              </div>
            </Tooltip>
          ))}
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full" style={{ background: `linear-gradient(90deg, ${p.palette.join(', ')})` }} />
        <SeedRow body={body} />
      </Section>

      <Section title={banded ? 'Atmosphère visible' : 'Surface'} icon={<Wind />}>
        {surface && !banded && (
          <>
            <PSlider body={body} k="seaLevel" label="Niveau des mers" min={0} max={1} format={pct} tone="ion" />
            <PSlider body={body} k="terrainScale" label="Échelle du relief" min={0.3} max={4} step={0.05} format={times} />
            <PSlider body={body} k="relief" label="Relief" min={0} max={1} format={pct} />
            <PSlider body={body} k="craters" label="Cratères" min={0} max={1} format={pct} />
            <PSlider body={body} k="iceCaps" label="Calottes polaires" min={0} max={1} format={pct} tone="ion" />
          </>
        )}
        {banded && <PSlider body={body} k="bands" label="Bandes" min={2} max={30} step={1} format={int} />}
        <PSlider body={body} k="turbulence" label="Turbulence" min={0} max={1} format={pct} />
        {(banded || p.planetType === 'ocean' || p.planetType === 'terran') && (
          <PSlider body={body} k="storms" label="Tempêtes" min={0} max={1} format={pct} />
        )}
      </Section>

      <Section title={lava ? 'Incandescence' : 'Lumières nocturnes'} icon={<Flame />}>
        <PSlider body={body} k="emissive" label="Intensité" hint={lava ? 'Lave, fissures ou tempêtes brûlantes' : 'Villes visibles sur la face nocturne'} min={0} max={1} format={pct} />
        <PColor body={body} k="emissiveColor" label="Couleur" />
      </Section>

      <Section title="Nuages" icon={<Cloud />} defaultOpen={p.clouds.enabled}>
        <PToggle body={body} group="clouds" k="enabled" label="Couche nuageuse" />
        {p.clouds.enabled && (
          <>
            <PSlider body={body} group="clouds" k="coverage" label="Couverture" min={0} max={1} format={pct} />
            <PSlider body={body} group="clouds" k="opacity" label="Opacité" min={0} max={1} format={pct} />
            <PSlider body={body} group="clouds" k="scale" label="Échelle" min={0.3} max={3} step={0.05} format={times} />
            <PSlider body={body} group="clouds" k="speed" label="Dérive" hint="Vitesse relative à la surface" min={-1} max={1} step={0.01} format={times} tone="ion" />
            <PColor body={body} group="clouds" k="color" label="Couleur" />
          </>
        )}
      </Section>

      <Section title="Atmosphère" icon={<Sun />} defaultOpen={p.atmosphere.enabled}>
        <PToggle body={body} group="atmosphere" k="enabled" label="Halo atmosphérique" />
        {p.atmosphere.enabled && (
          <>
            <PSlider body={body} group="atmosphere" k="density" label="Densité" min={0} max={1} format={pct} />
            <PSlider body={body} group="atmosphere" k="height" label="Épaisseur" min={0.01} max={0.2} step={0.005} format={pct} />
            <PColor body={body} group="atmosphere" k="color" label="Couleur" />
            <PColor body={body} group="atmosphere" k="sunsetColor" label="Crépuscule" hint="Teinte au terminateur (lever / coucher)" />
          </>
        )}
      </Section>

      <Section title="Anneaux" icon={<Layers />} defaultOpen={p.rings.enabled}>
        <PToggle body={body} group="rings" k="enabled" label="Système d'anneaux" />
        {p.rings.enabled && (
          <>
            <Field label="Rayon intérieur" hint="En rayons planétaires">
              <NumberField
                value={p.rings.inner}
                onChange={(v) =>
                  editBody(body.id, 'props.rings.inner', (b) => {
                    if (b.kind === 'planet' || b.kind === 'moon') b.props.rings.inner = Math.max(1.02, Math.min(v, b.props.rings.outer - 0.05))
                  })
                }
                step={0.01}
                precision={2}
                unit="R"
              />
            </Field>
            <Field label="Rayon extérieur" hint="En rayons planétaires">
              <NumberField
                value={p.rings.outer}
                onChange={(v) =>
                  editBody(body.id, 'props.rings.outer', (b) => {
                    if (b.kind === 'planet' || b.kind === 'moon') b.props.rings.outer = Math.max(b.props.rings.inner + 0.05, Math.min(v, 8))
                  })
                }
                step={0.01}
                precision={2}
                unit="R"
              />
            </Field>
            <PSlider body={body} group="rings" k="opacity" label="Opacité" min={0} max={1} format={pct} />
            <PSlider body={body} group="rings" k="bands" label="Divisions" hint="Lacunes et annelets" min={0} max={1} format={pct} />
            <PSlider body={body} group="rings" k="tilt" label="Inclinaison propre" min={-45} max={45} step={0.5} format={deg} tone="ion" />
            <PColor body={body} group="rings" k="colorA" label="Couleur claire" />
            <PColor body={body} group="rings" k="colorB" label="Couleur sombre" />
          </>
        )}
      </Section>
    </>
  )
}

function StarLook({ body }: { body: Extract<Body, { kind: 'star' }> }) {
  const p = body.props
  const bh = p.starClass === 'BH'
  const pulsar = p.starClass === 'PSR' || p.starClass === 'NS'
  const auto = blackbodyHex(p.temperature)
  return (
    <>
      <Section title="Rayonnement" icon={<Sun />}>
        {!bh && (
          <>
            <ToggleRow
              label="Couleur automatique"
              hint="Déduite de la température (corps noir)"
              checked={p.colorOverride === null}
              onChange={(v) =>
                editBody(body.id, 'colorOverride', (b) => {
                  if (b.kind !== 'star') return
                  b.props.colorOverride = v ? null : blackbodyHex(b.props.temperature)
                  b.color = b.props.colorOverride ?? blackbodyHex(b.props.temperature)
                }, false)
              }
            />
            {p.colorOverride !== null && (
              <Field label="Couleur">
                <ColorField
                  value={p.colorOverride}
                  onChange={(v) =>
                    editBody(body.id, 'props.colorOverride', (b) => {
                      if (b.kind !== 'star') return
                      b.props.colorOverride = v
                      b.color = v
                    })
                  }
                  swatches={[auto, '#9bb8ff', '#cfdcff', '#fff4e8', '#ffe08a', '#ffb062', '#ff7a4a', '#ff4a3a', '#c070ff', '#40e0d0', '#7EE2A8', '#ffffff']}
                />
              </Field>
            )}
          </>
        )}
        <PSlider body={body} k="corona" label="Couronne" hint="Intensité du halo" min={0} max={2} step={0.01} format={times} />
        <PSlider body={body} k="rays" label="Rayons" min={0} max={1} format={pct} />
        <PToggle body={body} k="flare" label="Traînée anamorphique" hint="Reflet horizontal façon objectif de cinéma" />
      </Section>

      {!bh && (
        <Section title="Surface" icon={<Flame />}>
          <PSlider body={body} k="granulation" label="Granulation" hint="Taille des cellules de convection (géantes : très grandes)" min={0.2} max={3} step={0.05} format={times} />
          <PSlider body={body} k="spots" label="Taches" min={0} max={1} format={pct} />
          <PSlider body={body} k="activity" label="Activité" hint="Turbulence et vitesse d'animation" min={0} max={1} format={pct} />
          <SeedRow body={body} />
        </Section>
      )}

      {bh && (
        <Section title="Disque d'accrétion" icon={<Layers />}>
          <PSlider body={body} k="diskInner" label="Bord intérieur" hint="En rayons de l'horizon" min={1.5} max={10} step={0.1} format={times} />
          <PSlider body={body} k="diskOuter" label="Bord extérieur" min={3} max={30} step={0.1} format={times} />
          <PSlider body={body} k="diskBrightness" label="Luminosité" min={0} max={3} step={0.05} format={times} />
          <PColor body={body} k="diskColorInner" label="Couleur intérieure" />
          <PColor body={body} k="diskColorOuter" label="Couleur extérieure" />
          <PSlider body={body} k="activity" label="Turbulence" min={0} max={1} format={pct} />
          <Hint>L'inclinaison du disque suit l'axe de rotation (onglet Physique).</Hint>
        </Section>
      )}

      {pulsar && (
        <Section title="Faisceaux" icon={<Zap />}>
          <PSlider body={body} k="beamAngle" label="Angle magnétique" hint="Écart entre l'axe magnétique et l'axe de rotation" min={0} max={90} step={0.5} format={deg} />
          <PSlider body={body} k="beamLength" label="Longueur" min={2} max={40} step={0.5} format={times} />
          <PSlider body={body} k="pulseRate" label="Pulsations / s" min={0.1} max={10} step={0.05} format={(v) => v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} />
        </Section>
      )}
    </>
  )
}

function NebulaLook({ body }: { body: Extract<Body, { kind: 'nebula' }> }) {
  const p = body.props
  const axes = ['X', 'Y', 'Z']
  return (
    <>
      <Section title="Forme" icon={<Cloud />}>
        <PNumber body={body} k="size" label="Taille" hint="Rayon en unités de scène" log min={1} max={2000} precision={1} />
        <Field label="Proportions">
          <div className="grid grid-cols-3 gap-1">
            {p.shape.map((v, i) => (
              <NumberField key={i} value={v} onChange={(nv) => setPropIndex(body, 'shape', i, Math.max(0.05, Math.min(3, nv)))} step={0.02} precision={2} prefix={axes[i]} />
            ))}
          </div>
        </Field>
        <Field label="Orientation">
          <div className="grid grid-cols-3 gap-1">
            {p.rotation.map((v, i) => (
              <NumberField key={i} value={v} onChange={(nv) => setPropIndex(body, 'rotation', i, nv)} step={1} precision={0} prefix={axes[i]} unit="°" />
            ))}
          </div>
        </Field>
        <PSlider body={body} k="turbulence" label="Turbulence" min={0} max={1} format={pct} />
      </Section>
      <Section title="Lumière" icon={<Sparkles />}>
        <Field label="Couleurs">
          <div className="flex gap-1.5">
            {p.colors.map((c, i) => (
              <ColorField key={i} compact value={c} onChange={(v) => setPropIndex(body, 'colors', i, v)} />
            ))}
            <div className="ml-1 h-7 flex-1 rounded-md" style={{ background: `linear-gradient(90deg, ${p.colors.join(', ')})` }} />
          </div>
        </Field>
        <PSlider body={body} k="density" label="Densité" min={0} max={1} format={pct} />
        <PSlider body={body} k="glow" label="Émission" min={0} max={2} step={0.01} format={times} />
        <PSlider body={body} k="darkLanes" label="Bandes sombres" hint="Poussière opaque en filaments" min={0} max={1} format={pct} />
        <PNumber body={body} k="puffs" label="Volutes" hint="Nombre de nuages (performances)" min={10} max={400} step={1} precision={0} />
        <PNumber body={body} k="stars" label="Étoiles enfouies" min={0} max={60} step={1} precision={0} />
        <PSlider body={body} k="drift" label="Animation" min={0} max={1} format={pct} tone="ion" />
        <SeedRow body={body} />
      </Section>
    </>
  )
}
