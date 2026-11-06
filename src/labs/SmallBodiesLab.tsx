import { useMemo, useState } from 'react'
import { createBody, createRoute, createSystem, defaultOrbit } from '@/core/defaults'
import { planetPreset } from '@/core/planetPresets'
import { starPreset } from '@/core/starPresets'
import type { BeltType, Body, GateType, MarkerType, NebulaType, ShipType, StarSystem, StationType } from '@/core/types'
import { useSimStore } from '@/store/simStore'
import { useUIStore } from '@/store/uiStore'
import { LabShell } from './LabShell'

const STATIONS: StationType[] = ['ring', 'modular', 'spindle', 'outpost', 'shipyard', 'refinery', 'derelict']
const SHIPS: ShipType[] = ['freighter', 'corvette', 'hauler', 'shuttle', 'miner', 'cruiser', 'derelict']
const GATES: GateType[] = ['ring', 'anomaly', 'beacon']
const MARKERS: MarkerType[] = ['poi', 'distress', 'derelict', 'anomaly', 'danger', 'outpost', 'cache', 'combat', 'unknown']
const NEBULAE: [NebulaType, string[]][] = [
  ['emission', ['#ff4f8b', '#5a7dff', '#ffd08a']],
  ['reflection', ['#7fb2ff', '#3a5bd8', '#e8f0ff']],
  ['dark', ['#ff8a5a', '#402a20', '#ffffff']],
  ['planetary', ['#ff5a5a', '#3ae0d0', '#ffe08a']],
  ['remnant', ['#ff6a3a', '#5ab0ff', '#fff0c0']],
  ['cloud', ['#9a7aff', '#ff9ac0', '#fff0ff']],
]
const BELTS: [BeltType, number, number][] = [
  ['asteroid', 2.1, 3.2],
  ['ice', 6.5, 7.4],
  ['dust', 11, 13],
  ['kuiper', 30, 48],
]

function makeSystem() {
  const sys = createSystem('Banc d’essai')
  const add = (b: Body) => ((sys.bodies[b.id] = b), b)
  const star = add(createBody('star', { name: 'Lux', props: starPreset('G', 2, 'V') }))

  BELTS.forEach(([type, inner, outer], i) =>
    add(
      createBody('belt', {
        name: `Ceinture ${type}`,
        parentId: star.id,
        order: 10 + i,
        seed: 100 + i,
        props:
          type === 'kuiper'
            ? { beltType: type, inner, outer, count: 3000, thickness: 0.14, colorA: '#a7b4c6', colorB: '#6a7488', dustColor: '#8fb2d8', clumping: 0 }
            : type === 'ice'
              ? { beltType: type, inner, outer, count: 2500, thickness: 0.03, colorA: '#dfeefa', colorB: '#9ab8d0', dustColor: '#bfe0ff', dust: 0.7 }
              : type === 'dust'
                ? { beltType: type, inner, outer, count: 1500, thickness: 0.08, colorA: '#b89a7a', colorB: '#7a6a5a', dustColor: '#e0b890', dust: 0.9 }
                : { beltType: type, inner, outer, count: 3500, clumping: 0.25 },
      }),
    ),
  )

  const giant = add(
    createBody('planet', {
      name: 'Géante',
      parentId: star.id,
      orbit: defaultOrbit(4.5, { m0: 300 }),
      props: planetPreset('gas'),
    }),
  )
  add(
    createBody('belt', {
      name: 'Débris de Géante',
      parentId: giant.id,
      seed: 77,
      props: { beltType: 'debris', inner: (11.2 * 6371 * 3) / 149597870.7, outer: (11.2 * 6371 * 5) / 149597870.7, count: 1500, thickness: 0.02, dust: 0.5 },
    }),
  )

  NEBULAE.forEach(([type, colors], i) =>
    add(
      createBody('nebula', {
        name: `Nébuleuse ${type}`,
        parentId: null,
        seed: 300 + i,
        orbit: defaultOrbit(70, { fixed: true, show: false, m0: i * 60, i: 8 }),
        props: { nebulaType: type, colors: colors as [string, string, string], size: type === 'planetary' ? 18 : 32 },
      }),
    ),
  )

  add(createBody('comet', { name: 'Comète proche', parentId: star.id, seed: 401, orbit: defaultOrbit(6, { e: 0.9, i: 15, peri: 40, m0: 359 }) }))
  add(createBody('comet', { name: 'Comète lointaine', parentId: star.id, seed: 402, orbit: defaultOrbit(10, { e: 0.8, i: 30, peri: 200, m0: 30 }) }))

  STATIONS.forEach((t, i) =>
    add(
      createBody('station', {
        name: `Station ${t}`,
        parentId: star.id,
        seed: 500 + i,
        orbit: defaultOrbit(1, { fixed: true, show: false, m0: i * 0.9 }),
        props: { stationType: t, size: 1.6, damaged: t === 'derelict' },
      }),
    ),
  )
  SHIPS.forEach((t, i) =>
    add(
      createBody('ship', {
        name: `Vaisseau ${t}`,
        parentId: star.id,
        seed: 600 + i,
        orbit: defaultOrbit(1.02, { fixed: true, show: false, m0: i * 0.9, i: 0.4 }),
        props: { shipType: t, size: 1.8, damaged: t === 'derelict', thrusting: t !== 'derelict' },
      }),
    ),
  )
  GATES.forEach((t, i) =>
    add(
      createBody('gate', {
        name: `Portail ${t}`,
        parentId: star.id,
        seed: 700 + i,
        orbit: defaultOrbit(1, { fixed: true, show: false, m0: 8 + i * 1.2 }),
        props: { gateType: t, size: 1.2, color: ['#A792FF', '#ff6ad0', '#7EE2A8'][i] },
      }),
    ),
  )
  MARKERS.forEach((t, i) =>
    add(
      createBody('marker', {
        name: `Marqueur ${t}`,
        parentId: star.id,
        seed: 800 + i,
        orbit: defaultOrbit(1.15, { fixed: true, show: false, m0: i * 0.8, i: 1.5 }),
        props: { markerType: t, code: t === 'distress' ? 'SOS' : t === 'cache' ? 'X-7' : '' },
      }),
    ),
  )

  const ids = Object.values(sys.bodies)
  const st = ids.find((b) => b.name === 'Station ring')!
  const ref = ids.find((b) => b.name === 'Station refinery')!
  const gate = ids.find((b) => b.name === 'Portail ring')!
  const r1 = createRoute(st.id, giant.id, { name: 'Ligne Géante', traffic: 3, style: 'dashed', color: '#8AB0FF' })
  const r2 = createRoute(ref.id, gate.id, { name: 'Contrebande', traffic: 2, style: 'dotted', color: '#FF7B6B', kind: 'smuggling', arc: 0.5 })
  const r3 = createRoute(st.id, ref.id, { name: 'Navette', traffic: 1, style: 'solid', color: '#E9B96E', arc: 0.1 })
  sys.routes[r1.id] = r1
  sys.routes[r2.id] = r2
  sys.routes[r3.id] = r3
  return sys as StarSystem
}

export default function SmallBodiesLab() {
  const system = useMemo(makeSystem, [])
  const [, force] = useState(0)
  const focus = (name: string) => {
    const b = Object.values(system.bodies).find((x) => x.name === name)
    if (b) useUIStore.getState().requestCamera({ type: 'focus', id: b.id, follow: true })
    force((n) => n + 1)
  }
  const [open, setOpen] = useState(false)
  const btn = 'rounded-md border border-line bg-white/5 px-1.5 py-0.5 text-[10px] text-ink-2 hover:text-ink'
  ;(window as unknown as { labFocus: (n: string) => void }).labFocus = focus
  return (
    <LabShell system={system} time={0}>
      <button className={btn} onClick={() => setOpen((o) => !o)}>
        {open ? 'Masquer' : 'Contrôles'}
      </button>
      <div className={open ? 'mt-2 space-y-2 text-[12px]' : 'hidden'}>
        <div className="eyebrow">Caméra</div>
        <div className="flex flex-wrap gap-1">
          <button className={btn} onClick={() => useUIStore.getState().requestCamera({ type: 'frame' })}>
            Tout
          </button>
          {[...STATIONS.map((t) => `Station ${t}`), ...SHIPS.map((t) => `Vaisseau ${t}`), ...GATES.map((t) => `Portail ${t}`), ...MARKERS.map((t) => `Marqueur ${t}`)].map((n) => (
            <button key={n} className={btn} onClick={() => focus(n)}>
              {n.split(' ')[1]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {[...NEBULAE.map(([t]) => `Nébuleuse ${t}`), ...BELTS.map(([t]) => `Ceinture ${t}`), 'Débris de Géante', 'Comète proche', 'Comète lointaine', 'Géante', 'Lux'].map((n) => (
            <button key={n} className={btn} onClick={() => focus(n)}>
              {n}
            </button>
          ))}
        </div>
        <div className="eyebrow">Temps</div>
        <div className="flex flex-wrap gap-1">
          {[0, 1, 7, 30, 365].map((s) => (
            <button key={s} className={btn} onClick={() => useSimStore.getState().setSpeed(s)}>
              {s} j/s
            </button>
          ))}
        </div>
      </div>
    </LabShell>
  )
}
