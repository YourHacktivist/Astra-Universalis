import { useEffect, useMemo, useState } from 'react'
import { advance } from '@react-three/fiber'
import { createBody, createSystem, defaultOrbit } from '@/core/defaults'
import { planetPreset } from '@/core/planetPresets'
import { spectralLabel, starPreset } from '@/core/starPresets'
import type { LuminosityClass, StarClass, StarSystem } from '@/core/types'
import { useActiveSystem, useProjectStore } from '@/store/projectStore'
import { useUIStore, type RenderStyle } from '@/store/uiStore'
import { cameraApi } from '@/three/scene/CameraRig'
import { Button, Field, Segmented, Slider, Toggle } from '@/ui/kit'
import { LabShell } from './LabShell'

const LINEUP: [StarClass, number, LuminosityClass][] = [
  ['O', 5, 'V'],
  ['B', 3, 'V'],
  ['A', 2, 'V'],
  ['F', 5, 'V'],
  ['G', 2, 'V'],
  ['K', 4, 'V'],
  ['M', 5, 'V'],
  ['K', 2, 'III'],
  ['M', 2, 'Ia'],
  ['BD', 3, 'V'],
  ['WD', 2, 'V'],
  ['NS', 0, 'V'],
  ['PSR', 0, 'V'],
  ['BH', 0, 'V'],
]

function makeSystem(): StarSystem {
  const system = createSystem('Banc stellaire')
  system.display.distanceScale = 1
  const bary = createBody('barycenter', { name: 'Centre', props: { showMarker: false }, showLabel: false })
  system.bodies[bary.id] = bary
  LINEUP.forEach(([cls, sub, lum], i) => {
    const props = starPreset(cls, sub, lum)
    const s = createBody('star', {
      name: spectralLabel(props),
      parentId: bary.id,
      order: i + 1,
      orbit: defaultOrbit(45, { fixed: true, show: false, m0: (i / LINEUP.length) * 360 }),
      rotation: { period: cls === 'BH' ? 0 : 200, tilt: cls === 'BH' ? 14 : cls === 'PSR' ? 20 : 7 },
      props,
      seed: 1000 + i * 17,
    })
    system.bodies[s.id] = s
    if (cls === 'G' && !new URLSearchParams(location.search).has('solo')) {
      const p = createBody('planet', {
        name: 'Témoin',
        parentId: s.id,
        orbit: defaultOrbit(0.6, { m0: 30 }),
        props: planetPreset('terran'),
      })
      system.bodies[p.id] = p
    }
  })
  return system
}

function useHeadlessDriver() {
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>
    const canvas = () => document.querySelector('canvas') as HTMLCanvasElement | null
    const grab = () => {
      advance(performance.now())
      const c = canvas()
      if (!c) return null
      const tmp = document.createElement('canvas')
      tmp.width = c.width
      tmp.height = c.height
      const ctx = tmp.getContext('2d')!
      ctx.drawImage(c, 0, 0)
      return { ctx, w: c.width, h: c.height }
    }
    w.__labShot = (frames = 3) => {
      for (let i = 0; i < frames - 1; i++) advance(performance.now() + i * 16)
      const g = grab()
      return g ? g.ctx.canvas.toDataURL('image/png') : null
    }
    w.__labStep = (n = 1) => {
      for (let i = 0; i < n; i++) advance(performance.now() + i * 16)
      return n
    }
    w.__labAscii = (cols = 100, rows = 40) => {
      const g = grab()
      if (!g) return 'no canvas'
      const ramp = ' .:-=+*#%@'
      const data = g.ctx.getImageData(0, 0, g.w, g.h).data
      const lines: string[] = []
      for (let r = 0; r < rows; r++) {
        let line = ''
        for (let c = 0; c < cols; c++) {
          const x = Math.floor(((c + 0.5) / cols) * g.w)
          const y = Math.floor(((r + 0.5) / rows) * g.h)
          const i = (y * g.w + x) * 4
          const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255
          line += ramp[Math.min(ramp.length - 1, Math.floor(Math.pow(l, 0.6) * ramp.length))]
        }
        lines.push(line)
      }
      return lines.join('\n')
    }
    w.__labPixel = (nx: number, ny: number) => {
      const g = grab()
      if (!g) return null
      const d = g.ctx.getImageData(Math.floor(nx * g.w), Math.floor(ny * g.h), 1, 1).data
      return [d[0], d[1], d[2]]
    }
    w.__lab = {
      focus(name: string) {
        const sys = useProjectStore.getState().project
        const s = Object.values(sys.systems)[0]
        const b = Object.values(s.bodies).find((x) => x.name === name)
        if (!b) return 'not found'
        useUIStore.getState().requestCamera({ type: 'focus', id: b.id, instant: true })
        return b.id
      },
      frame: () => useUIStore.getState().requestCamera({ type: 'frame', instant: true }),
      style: (s: RenderStyle) => useUIStore.getState().setRenderStyle(s),
      view: (v: Record<string, boolean>) => useUIStore.getState().setView(v),
      env: (patch: Record<string, number>) =>
        useProjectStore.getState().updateSystem((s) => void Object.assign(s.environment, patch), { history: false }),
      body: (name: string, patch: Record<string, unknown>) =>
        useProjectStore.getState().updateSystem(
          (s) => {
            const b = Object.values(s.bodies).find((x) => x.name === name)
            if (b) Object.assign(b.props, patch)
          },
          { history: false },
        ),
      orbit(polar: number, azimuth: number, dolly = 1) {
        const c = cameraApi.controls
        if (!c) return 'no controls'
        c.rotateTo(azimuth, polar, false)
        c.dollyTo(c.distance * dolly, false)
        return [c.distance, c.polarAngle]
      },
    }
    const id = setInterval(() => {
      if (document.visibilityState === 'hidden') advance(performance.now())
    }, 250)
    return () => clearInterval(id)
  }, [])
}

const params = new URLSearchParams(location.search)
if (params.has('nosky')) useUIStore.getState().setView({ starfield: false })
if (params.has('style')) useUIStore.getState().setRenderStyle(params.get('style') as RenderStyle)

export default function StarsLab() {
  const system = useMemo(makeSystem, [])
  useHeadlessDriver()
  const panel = !new URLSearchParams(location.search).has('nopanel')
  return <LabShell system={system}>{panel && <Controls />}</LabShell>
}

function Controls() {
  const sys = useActiveSystem()
  const ui = useUIStore()
  const [focus, setFocus] = useState<string | null>(null)
  if (!sys) return null
  const stars = Object.values(sys.bodies).filter((b) => b.kind === 'star').sort((a, b) => a.order - b.order)
  const sel = focus ? sys.bodies[focus] : null
  const env = sys.environment
  const upd = (fn: (s: StarSystem) => void) => useProjectStore.getState().updateSystem(fn, { history: false })

  return (
    <div className="space-y-3 text-[12px]">
      <div className="eyebrow">Étoiles</div>
      <div className="grid grid-cols-2 gap-1">
        {stars.map((s) => (
          <Button
            key={s.id}
            size="xs"
            active={focus === s.id}
            onClick={() => {
              setFocus(s.id)
              ui.select(s.id)
              ui.requestCamera({ type: 'focus', id: s.id })
            }}
          >
            {s.name}
          </Button>
        ))}
      </div>
      <Button size="xs" onClick={() => ui.requestCamera({ type: 'frame' })}>
        Tout cadrer
      </Button>

      <div className="eyebrow pt-2">Rendu</div>
      <Segmented<RenderStyle>
        value={ui.renderStyle}
        onChange={(v) => ui.setRenderStyle(v)}
        options={[
          { value: 'cinematic', label: 'Ciné' },
          { value: 'terminal', label: 'Terminal' },
          { value: 'blueprint', label: 'Plan' },
        ]}
      />
      <div className="grid grid-cols-2">
        <Toggle checked={ui.view.bloom} onChange={(v) => ui.setView({ bloom: v })} label="Bloom" />
        <Toggle checked={ui.view.lensFlares} onChange={(v) => ui.setView({ lensFlares: v })} label="Reflets" />
        <Toggle checked={ui.view.grain} onChange={(v) => ui.setView({ grain: v })} label="Grain" />
        <Toggle checked={ui.view.vignette} onChange={(v) => ui.setView({ vignette: v })} label="Vignette" />
        <Toggle checked={ui.view.labels} onChange={(v) => ui.setView({ labels: v })} label="Étiquettes" />
        <Toggle checked={ui.view.starfield} onChange={(v) => ui.setView({ starfield: v })} label="Ciel" />
      </div>
      <Segmented
        value={ui.quality}
        onChange={(v) => ui.setQuality(v)}
        options={[
          { value: 'low', label: 'Basse' },
          { value: 'medium', label: 'Moy.' },
          { value: 'high', label: 'Haute' },
          { value: 'ultra', label: 'Ultra' },
        ]}
      />

      {sel?.kind === 'star' && (
        <>
          <div className="eyebrow pt-2">{sel.name}</div>
          {(
            [
              ['corona', 0, 2],
              ['rays', 0, 1],
              ['spots', 0, 1],
              ['granulation', 0.2, 3],
              ['activity', 0, 1],
              ['diskBrightness', 0, 3],
              ['beamAngle', 0, 90],
              ['pulseRate', 0, 4],
            ] as const
          ).map(([k, min, max]) => (
            <Field key={k} label={k}>
              <Slider
                value={sel.props[k] as number}
                min={min}
                max={max}
                step={(max - min) / 100}
                onChange={(v) => useProjectStore.getState().updateBody(sel.id, (b) => void ((b.props as unknown as Record<string, unknown>)[k] = v), { history: false })}
              />
            </Field>
          ))}
          <Field label="temperature">
            <Slider
              value={sel.props.temperature}
              min={1500}
              max={40000}
              step={100}
              format={(v) => `${Math.round(v)}`}
              onChange={(v) => useProjectStore.getState().updateBody(sel.id, (b) => b.kind === 'star' && void (b.props.temperature = v), { history: false })}
            />
          </Field>
          <Toggle
            checked={sel.props.flare}
            onChange={(v) => useProjectStore.getState().updateBody(sel.id, (b) => b.kind === 'star' && void (b.props.flare = v), { history: false })}
            label="Traînée anamorphique"
          />
        </>
      )}

      <div className="eyebrow pt-2">Ciel</div>
      <Field label="Densité">
        <Slider value={env.starDensity} onChange={(v) => upd((s) => void (s.environment.starDensity = v))} />
      </Field>
      <Field label="Voie lactée">
        <Slider value={env.milkyWay} onChange={(v) => upd((s) => void (s.environment.milkyWay = v))} />
      </Field>
      <Field label="Inclinaison">
        <Slider value={env.milkyWayTilt} min={-90} max={90} step={1} onChange={(v) => upd((s) => void (s.environment.milkyWayTilt = v))} />
      </Field>
      <Field label="Nébuleuses">
        <Slider value={env.nebulaIntensity} onChange={(v) => upd((s) => void (s.environment.nebulaIntensity = v))} />
      </Field>
      <Button size="xs" onClick={() => upd((s) => void (s.environment.seed = Math.floor(Math.random() * 1e6)))}>
        Nouvelle graine
      </Button>
      <Field label="Taille corps">
        <Slider value={sys.display.bodyScale} min={0.25} max={4} onChange={(v) => upd((s) => void (s.display.bodyScale = v))} />
      </Field>
    </div>
  )
}
