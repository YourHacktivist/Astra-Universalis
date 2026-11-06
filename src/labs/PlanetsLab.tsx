import { useEffect, useMemo, useState } from 'react'
import { createBody, createSystem, defaultOrbit } from '@/core/defaults'
import { PLANET_TYPE_LABEL } from '@/core/labels'
import { moonPreset, planetPreset } from '@/core/planetPresets'
import { starPreset } from '@/core/starPresets'
import type { Body, PlanetType, StarSystem } from '@/core/types'
import { getActiveSystem, useActiveSystem, useProjectStore } from '@/store/projectStore'
import { useSimStore } from '@/store/simStore'
import { useUIStore, type Quality } from '@/store/uiStore'
import { advance } from '@react-three/fiber'
import * as THREE from 'three'
import { glApi } from '@/three/SystemCanvas'
import { bakeStats, debugSets } from '@/three/planet/baker'
import { runtime } from '@/three/runtime'
import { cameraApi } from '@/three/scene/CameraRig'
import { Button, Field, Select, Slider, Toggle } from '@/ui/kit'
import { LabShell } from './LabShell'

const TYPES = Object.keys(PLANET_TYPE_LABEL) as PlanetType[]

function makeSystem(): StarSystem {
  const sys = createSystem('Planet lab')
  const star = createBody('star', { name: 'Lux', props: starPreset('G', 2, 'V'), seed: 7 })
  sys.bodies[star.id] = star
  TYPES.forEach((t, i) => {
    const p = planetPreset(t)
    if (t === 'gas') p.rings = { enabled: true, inner: 1.3, outer: 2.35, colorA: '#e2d3b4', colorB: '#8a7560', opacity: 0.9, bands: 0.8, tilt: 0 }
    const b = createBody('planet', {
      name: PLANET_TYPE_LABEL[t],
      parentId: star.id,
      order: i + 1,
      orbit: defaultOrbit(0.35 + i * 0.32, { fixed: true, m0: (i * 47) % 360 }),
      rotation: { period: 30 + i * 3, tilt: 18 + (i % 4) * 5 },
      props: p,
      seed: 1000 + i * 17,
    })
    sys.bodies[b.id] = b
    if (t === 'gas') {
      ;(['barren', 'ice', 'lava'] as PlanetType[]).forEach((mt, k) => {
        const m = createBody('moon', {
          name: `Lune ${k + 1}`,
          parentId: b.id,
          order: k + 1,
          orbit: defaultOrbit(0.0022 + k * 0.0016, { m0: k * 120, i: 1 }),
          props: moonPreset(mt),
          seed: 2000 + k,
        })
        sys.bodies[m.id] = m
      })
    }
  })
  return sys
}

function Controls() {
  const system = useActiveSystem()
  const selectedId = useUIStore((s) => s.selectedId)
  const quality = useUIStore((s) => s.quality)
  const playing = useSimStore((s) => s.playing)
  const [, force] = useState(0)
  const [collapsed, setCollapsed] = useState(false)
  if (!system) return null
  if (collapsed)
    return (
      <Button size="xs" onClick={() => setCollapsed(false)}>
        Contrôles
      </Button>
    )
  const planets = Object.values(system.bodies).filter((b): b is Extract<Body, { kind: 'planet' | 'moon' }> => b.kind === 'planet' || b.kind === 'moon')
  const sel = planets.find((b) => b.id === selectedId)
  const update = (fn: (b: Extract<Body, { kind: 'planet' | 'moon' }>) => void) =>
    sel && useProjectStore.getState().updateBody(sel.id, (b) => fn(b as Extract<Body, { kind: 'planet' | 'moon' }>), { coalesce: 'lab' })
  const stats = bakeStats()

  return (
    <div className="space-y-2 text-[12px]">
      <div className="flex items-center justify-between">
        <div className="eyebrow">Planètes</div>
        <Button size="xs" variant="ghost" onClick={() => setCollapsed(true)}>
          Réduire
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {planets.map((b) => (
          <Button
            key={b.id}
            size="xs"
            active={b.id === selectedId}
            onClick={() => {
              useUIStore.getState().select(b.id)
              useUIStore.getState().requestCamera({ type: 'focus', id: b.id })
            }}
          >
            {b.name}
          </Button>
        ))}
      </div>
      <Field label="Qualité">
        <Select
          value={quality}
          onChange={(q) => useUIStore.getState().setQuality(q as Quality)}
          options={(['low', 'medium', 'high', 'ultra'] as const).map((q) => ({ value: q, label: q }))}
        />
      </Field>
      <Toggle checked={playing} onChange={(v) => useSimStore.getState().setPlaying(v)} label="Animation" />
      <Button size="xs" onClick={() => useUIStore.getState().requestCamera({ type: 'frame' })}>
        Cadrer tout
      </Button>
      {sel && (
        <div className="space-y-1.5 border-t border-line pt-2">
          <div className="eyebrow">{sel.name}</div>
          <Field label="Type">
            <Select
              value={sel.props.planetType}
              onChange={(t) =>
                update((b) => {
                  const keep = b.props.rings
                  b.props = { ...planetPreset(t as PlanetType), rings: keep }
                })
              }
              options={TYPES.map((t) => ({ value: t, label: PLANET_TYPE_LABEL[t] }))}
            />
          </Field>
          {(
            [
              ['seaLevel', 'Mers', 0, 1],
              ['terrainScale', 'Échelle', 0.3, 4],
              ['relief', 'Relief', 0, 1],
              ['craters', 'Cratères', 0, 1],
              ['iceCaps', 'Calottes', 0, 1],
              ['bands', 'Bandes', 2, 30],
              ['turbulence', 'Turbulence', 0, 1],
              ['storms', 'Tempêtes', 0, 1],
              ['emissive', 'Émissif', 0, 1],
            ] as const
          ).map(([k, label, min, max]) => (
            <Field key={k} label={label}>
              <Slider value={sel.props[k]} min={min} max={max} step={(max - min) / 200} onChange={(v) => update((b) => void (b.props[k] = v))} />
            </Field>
          ))}
          <Field label="Nuages">
            <Slider value={sel.props.clouds.coverage} onChange={(v) => update((b) => void (b.props.clouds.coverage = v))} />
          </Field>
          <Field label="Atmosphère">
            <Slider value={sel.props.atmosphere.density} onChange={(v) => update((b) => void (b.props.atmosphere.density = v))} />
          </Field>
          <Toggle checked={sel.props.rings.enabled} onChange={(v) => update((b) => void (b.props.rings.enabled = v))} label="Anneaux" />
          <Button size="xs" onClick={() => update((b) => void (b.seed = Math.floor(Math.random() * 1e6)))}>
            Nouvelle graine
          </Button>
        </div>
      )}
      <div className="font-mono text-[10px] text-ink-3" onClick={() => force((x) => x + 1)}>
        bake: {stats.sets} sets · {stats.megabytes} Mo
      </div>
    </div>
  )
}

export default function PlanetsLab() {
  const system = useMemo(makeSystem, [])
  useEffect(() => {
    ;(window as unknown as { __lab: unknown }).__lab = {
      focus(name: string, select = false) {
        const sys = getActiveSystem()
        const b = sys && Object.values(sys.bodies).find((x) => x.name === name)
        if (!b) return false
        if (select) useUIStore.getState().select(b.id)
        useUIStore.getState().requestCamera({ type: 'focus', id: b.id, follow: true })
        return true
      },
      update(name: string, fn: (b: Body) => void) {
        const sys = getActiveSystem()
        const b = sys && Object.values(sys.bodies).find((x) => x.name === name)
        if (b) useProjectStore.getState().updateBody(b.id, fn)
      },
      stats: bakeStats,
      async dump(type: string, which: 'albedo' | 'normal' | 'clouds', name: string) {
        const live = (window as unknown as { __planetBaker?: { gl: THREE.WebGLRenderer; sets: Map<string, ReturnType<typeof debugSets>[number]> } }).__planetBaker
        const set = [...(live?.sets.values() ?? debugSets())].find((s) => s.params.type === type && s.fullDone && s.full?.[which])
        const rt = set?.full?.[which]
        const gl = live?.gl ?? glApi.gl
        if (!rt || !gl) return 'none'
        const w = rt.width
        const h = rt.height
        const buf = new Uint8Array(w * h * 4)
        gl.readRenderTargetPixels(rt, 0, 0, w, h, buf)
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const img = c.getContext('2d')!.createImageData(w, h)
        for (let y = 0; y < h; y++) img.data.set(buf.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4)
        for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255
        c.getContext('2d')!.putImageData(img, 0, 0)
        const s = document.createElement('canvas')
        s.width = Math.min(w, 1400)
        s.height = s.width / 2
        s.getContext('2d')!.drawImage(c, 0, 0, s.width, s.height)
        await fetch(`http://127.0.0.1:5199/save?name=${encodeURIComponent(name)}`, { method: 'POST', body: s.toDataURL('image/png') })
        return `${w}x${h}`
      },
      async capture(name: string, frames = 10, maxW = 1400, gapMs = 40) {
        for (let i = 0; i < frames; i++) {
          advance(performance.now())
          if (gapMs) await new Promise((r) => setTimeout(r, gapMs))
        }
        advance(performance.now())
        const canvas = document.querySelector('canvas')!
        const s = Math.min(1, maxW / canvas.width)
        const c2 = document.createElement('canvas')
        c2.width = Math.round(canvas.width * s)
        c2.height = Math.round(canvas.height * s)
        c2.getContext('2d')!.drawImage(canvas, 0, 0, c2.width, c2.height)
        await fetch(`http://127.0.0.1:5199/save?name=${encodeURIComponent(name)}`, { method: 'POST', body: c2.toDataURL('image/png') })
        return `${c2.width}x${c2.height}`
      },
      viewEq(name: string, azDeg = 30, elevDeg = 3, distFactor = 5) {
        const sys = getActiveSystem()
        const b = sys && Object.values(sys.bodies).find((x) => x.name === name)
        const rt = b && runtime.bodies.get(b.id)
        const c = cameraApi.controls
        if (!b || !rt || !c) return false
        useUIStore.getState().follow(b.id)
        const az = THREE.MathUtils.degToRad(azDeg)
        const el = THREE.MathUtils.degToRad(elevDeg)
        const local = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az))
        local.applyQuaternion(rt.tilt).multiplyScalar(rt.radius * distFactor)
        c.setLookAt(rt.pos.x + local.x, rt.pos.y + local.y, rt.pos.z + local.z, rt.pos.x, rt.pos.y, rt.pos.z, false)
        return true
      },
      view(name: string, angleDeg = 60, distFactor = 3.2, elevDeg = 15) {
        const sys = getActiveSystem()
        const b = sys && Object.values(sys.bodies).find((x) => x.name === name)
        const rt = b && runtime.bodies.get(b.id)
        const star = sys && Object.values(sys.bodies).find((x) => x.kind === 'star')
        const srt = star && runtime.bodies.get(star.id)
        const c = cameraApi.controls
        if (!b || !rt || !srt || !c) return false
        useUIStore.getState().follow(b.id)
        const dir = srt.pos.clone().sub(rt.pos).setY(0).normalize()
        dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(angleDeg))
        dir.y = Math.tan(THREE.MathUtils.degToRad(elevDeg))
        dir.normalize().multiplyScalar(rt.radius * distFactor)
        c.setLookAt(rt.pos.x + dir.x, rt.pos.y + dir.y, rt.pos.z + dir.z, rt.pos.x, rt.pos.y, rt.pos.z, false)
        return true
      },
    }
  }, [])
  return (
    <LabShell system={system}>
      <Controls />
    </LabShell>
  )
}
