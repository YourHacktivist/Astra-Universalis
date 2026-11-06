import { useMemo, useState } from 'react'
import { Dices, Sparkles, WandSparkles } from 'lucide-react'
import { addSystemToProject, newProject } from '@/app/actions'
import { DEFAULT_GENERATOR_OPTIONS, generateSystem, summarizeSystem, type GeneratorOptions, type GeneratorStyle } from '@/core/generator'
import { STAR_CLASS_LABEL } from '@/core/labels'
import { stars } from '@/core/hierarchy'
import type { StarClass } from '@/core/types'
import { blackbodyHex } from '@/lib/color'
import { randomSeedString } from '@/lib/random'
import { getActiveSystem, getProject } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import { Badge, Button, Dialog, Field, IconButton, NumberField, Segmented, Select, TextField, Toggle } from '../kit'

const STYLE_HINT: Record<GeneratorStyle, string> = {
  realistic: 'Naines rouges fréquentes, peu de mondes habitables, exotisme rare.',
  varied: 'Le meilleur compromis pour une campagne : variété et lisibilité.',
  exotic: 'Trous noirs, pulsars, géantes, mondes étranges et anomalies.',
}

const TOGGLES: [keyof GeneratorOptions, string][] = [
  ['moons', 'Lunes'],
  ['belts', 'Ceintures'],
  ['comets', 'Comètes'],
  ['stations', 'Stations & colonies'],
  ['derelicts', 'Épaves & signaux'],
  ['gates', 'Portails de saut'],
  ['nebula', 'Nébuleuse'],
]

const CLASS_OPTIONS = [
  { value: 'auto', label: 'Aléatoire' },
  ...(Object.keys(STAR_CLASS_LABEL) as StarClass[]).map((c) => ({ value: c, label: STAR_CLASS_LABEL[c] })),
]

export function GeneratorDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const [opts, setOpts] = useState<GeneratorOptions>(() => ({ ...DEFAULT_GENERATOR_OPTIONS, seed: randomSeedString() }))
  const set = <K extends keyof GeneratorOptions>(k: K, v: GeneratorOptions[K]) => setOpts((o) => ({ ...o, [k]: v }))

  const preview = useMemo(() => {
    if (!open) return null
    try {
      return generateSystem(opts)
    } catch (e) {
      console.error(e)
      return null
    }
  }, [opts, open])
  const summary = preview ? summarizeSystem(preview) : null
  const starBodies = preview ? stars(preview) : []

  const generate = async () => {
    if (!preview) return
    const system = generateSystem(opts)
    onClose()
    const project = getProject()
    const active = getActiveSystem()
    const emptyish = project.systemOrder.length <= 1 && (!active || Object.keys(active.bodies).length <= 1)
    if (emptyish) {
      await newProject(system)
      return
    }
    const choice = await useUIStore.getState().askConfirm({
      title: `Système « ${system.name} » prêt`,
      message: 'Ajouter ce système au projet actuel, ou commencer un nouveau projet ?',
      actions: [
        { id: 'add', label: 'Ajouter au projet', tone: 'primary' },
        { id: 'new', label: 'Nouveau projet', tone: 'secondary' },
        { id: 'cancel', label: 'Annuler', tone: 'secondary' },
      ],
      cancelId: 'cancel',
    })
    if (choice === 'add') addSystemToProject(system)
    else if (choice === 'new') await newProject(system)
  }

  const maxR = summary ? Math.max(1, ...summary.planetTypes.map((p) => p.radius)) : 1

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Générer un système"
      subtitle="Un système complet et cohérent à partir d’une graine : étoiles, mondes, lunes, stations et secrets."
      icon={<WandSparkles />}
      width={640}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" icon={<Sparkles className="size-4" />} onClick={() => void generate()} disabled={!preview}>
            Générer
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_1fr] gap-x-6 gap-y-2">
        <div className="col-span-2 flex items-end gap-2">
          <Field label="Graine" stacked className="flex-1">
            <TextField value={opts.seed} onChange={(e) => set('seed', e.target.value)} className="font-mono tracking-wider" />
          </Field>
          <IconButton label="Graine aléatoire" onClick={() => set('seed', randomSeedString())}>
            <Dices />
          </IconButton>
          <Field label="Nom (facultatif)" stacked className="flex-1">
            <TextField value={opts.name ?? ''} placeholder={preview?.name} onChange={(e) => set('name', e.target.value || undefined)} />
          </Field>
        </div>

        <Field label="Style" stacked className="col-span-2">
          <Segmented<GeneratorStyle>
            value={opts.style}
            onChange={(v) => set('style', v)}
            options={[
              { value: 'realistic', label: 'Réaliste' },
              { value: 'varied', label: 'Varié' },
              { value: 'exotic', label: 'Exotique' },
            ]}
          />
          <p className="pt-1 text-[11px] text-ink-3">{STYLE_HINT[opts.style]}</p>
        </Field>

        <Field label="Étoiles" stacked>
          <Segmented<'auto' | '1' | '2' | '3'>
            value={String(opts.stars) as 'auto' | '1' | '2' | '3'}
            onChange={(v) => set('stars', v === 'auto' ? 'auto' : (Number(v) as 1 | 2 | 3))}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3' },
            ]}
          />
        </Field>
        <Field label="Étoile principale" stacked>
          <Select value={opts.starClass ?? 'auto'} onChange={(v) => set('starClass', v === 'auto' ? undefined : (v as StarClass))} options={CLASS_OPTIONS} />
        </Field>

        <Field label="Planètes (min – max)" stacked className="col-span-2">
          <div className="flex items-center gap-2">
            <NumberField value={opts.planets[0]} min={0} max={14} step={1} precision={0} onChange={(v) => set('planets', [Math.round(v), Math.max(Math.round(v), opts.planets[1])])} />
            <span className="text-ink-3">–</span>
            <NumberField value={opts.planets[1]} min={0} max={14} step={1} precision={0} onChange={(v) => set('planets', [Math.min(opts.planets[0], Math.round(v)), Math.round(v)])} />
          </div>
        </Field>

        <div className="col-span-2 mt-1 grid grid-cols-2 gap-x-6">
          {TOGGLES.map(([k, label]) => (
            <Toggle key={k} checked={!!opts[k]} onChange={(v) => set(k, v as never)} label={label} />
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-white/[0.025] p-4">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <div className="eyebrow">Aperçu</div>
            <div className="truncate font-display text-[24px] font-semibold tracking-wide">{preview?.name ?? '–'}</div>
            <div className="font-mono text-[11px] text-ink-3">{preview?.designation}</div>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            {summary?.stars.map((s, i) => (
              <Badge key={i} tone="aurum">
                {s}
              </Badge>
            ))}
          </div>
        </div>
        <div className="relative mt-4 flex h-20 items-center gap-3 overflow-hidden">
          {starBodies[0] && (
            <span
              className="-ml-10 size-20 shrink-0 rounded-full"
              style={{
                background: `radial-gradient(circle at 70% 50%, #fff, ${starBodies[0].props.starClass === 'BH' ? '#000' : blackbodyHex(starBodies[0].props.temperature)} 60%)`,
                boxShadow: `0 0 30px ${starBodies[0].props.starClass === 'BH' ? '#ff6a24' : blackbodyHex(starBodies[0].props.temperature)}55`,
              }}
            />
          )}
          <span className="absolute left-8 right-0 top-1/2 h-px bg-line" />
          {summary?.planetTypes.map((p, i) => {
            const d = 6 + 30 * Math.sqrt(p.radius / maxR)
            return (
              <span
                key={i}
                title={p.type}
                className="relative shrink-0 rounded-full"
                style={{ width: d, height: d, background: `radial-gradient(circle at 35% 35%, ${p.color}, #000 120%)` }}
              />
            )
          })}
        </div>
        {summary && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge>{summary.counts.planet ?? 0} planètes</Badge>
            <Badge>{summary.counts.moon ?? 0} lunes</Badge>
            {summary.habitable > 0 && <Badge tone="viridis">{summary.habitable} habitable{summary.habitable > 1 ? 's' : ''}</Badge>}
            {!!summary.counts.belt && <Badge>{summary.counts.belt} ceinture{summary.counts.belt > 1 ? 's' : ''}</Badge>}
            {!!summary.counts.station && <Badge tone="ion">{summary.counts.station} station{summary.counts.station > 1 ? 's' : ''}</Badge>}
            {!!summary.counts.ship && <Badge tone="ion">{summary.counts.ship} vaisseau{summary.counts.ship > 1 ? 'x' : ''}</Badge>}
            {!!summary.counts.marker && <Badge tone="nova">{summary.counts.marker} signal{summary.counts.marker > 1 ? 'aux' : ''}</Badge>}
            {!!summary.counts.gate && <Badge tone="nebula">Portail</Badge>}
            {!!summary.counts.comet && <Badge>{summary.counts.comet} comète{summary.counts.comet > 1 ? 's' : ''}</Badge>}
          </div>
        )}
        {preview?.description && <p className="mt-3 text-[12px] leading-relaxed text-ink-2">{preview.description}</p>}
      </div>
    </Dialog>
  )
}
