import { createBody, createRoute, createSystem, defaultOrbit } from './defaults'
import { moonPreset, planetPreset } from './planetPresets'
import { starPreset } from './starPresets'
import type { Body, StarSystem } from './types'

export const DEMO_DESIGNATION = 'HD 40307'

export function createDemoSystem(): StarSystem {
  const system = createSystem('Vesper', {
    designation: DEMO_DESIGNATION,
    description:
      "Naine orange calme aux confins du Bras d'Orion. Colonie minière sur Vesper c, raffinerie corporatiste dans la ceinture, et un signal de détresse qui ne s'arrête jamais.",
  })
  const add = (b: Body) => {
    system.bodies[b.id] = b
    return b
  }

  const star = add(createBody('star', { name: 'Vesper', props: starPreset('K', 2, 'V'), seed: 101 }))

  const b = add(
    createBody('planet', {
      name: 'Vesper b',
      parentId: star.id,
      order: 1,
      orbit: defaultOrbit(0.18, { e: 0.04, i: 2, m0: 40 }),
      rotation: { period: 0, locked: true, tilt: 1 },
      props: { ...planetPreset('lava'), radius: 0.8, mass: 0.6 },
      seed: 202,
      notes: { hazards: 'Températures extrêmes, éruptions permanentes', atmosphere: 'Vapeurs soufrées' },
    }),
  )
  void b

  const c = add(
    createBody('planet', {
      name: 'Vesper c',
      parentId: star.id,
      order: 2,
      orbit: defaultOrbit(0.62, { e: 0.03, i: 1.2, node: 30, m0: 200 }),
      rotation: { period: 26.4, tilt: 21 },
      props: planetPreset('terran'),
      seed: 303,
      notes: {
        population: '≈ 48 000 colons',
        faction: 'Consortium Halberd',
        atmosphere: 'Azote-oxygène, respirable',
        description: 'Monde tempéré aux océans sombres. Capitale : Port-Sélène.',
      },
    }),
  )
  add(
    createBody('moon', {
      name: 'Sélène',
      parentId: c.id,
      order: 1,
      orbit: defaultOrbit(0.0024, { e: 0.05, i: 5, m0: 120 }),
      props: moonPreset('barren'),
      seed: 304,
    }),
  )
  add(
    createBody('station', {
      name: 'Anneau de Port-Sélène',
      parentId: c.id,
      order: 2,
      orbit: defaultOrbit(0.00006, { i: 12, m0: 10 }),
      props: { stationType: 'ring', size: 1.2 },
      notes: { population: '3 200', faction: 'Consortium Halberd' },
    }),
  )

  const d = add(
    createBody('planet', {
      name: 'Vesper d',
      parentId: star.id,
      order: 3,
      orbit: defaultOrbit(1.05, { e: 0.08, i: 3, node: 110, m0: 300 }),
      rotation: { period: 31, tilt: 8 },
      props: planetPreset('arid'),
      seed: 404,
    }),
  )
  void d

  add(
    createBody('belt', {
      name: 'Ceinture de Kessler',
      parentId: star.id,
      order: 4,
      props: { inner: 1.6, outer: 2.3, count: 3000, thickness: 0.05 },
      seed: 505,
    }),
  )
  add(
    createBody('station', {
      name: 'Raffinerie Morrow-7',
      parentId: star.id,
      order: 5,
      orbit: defaultOrbit(1.9, { m0: 75, i: 1 }),
      props: { stationType: 'refinery', size: 1.4 },
      notes: { faction: 'Morrow Industries', hazards: 'Radiations résiduelles' },
    }),
  )

  const e = add(
    createBody('planet', {
      name: 'Tyrannos',
      parentId: star.id,
      order: 6,
      orbit: defaultOrbit(4.2, { e: 0.05, i: 1.5, node: 200, m0: 160 }),
      rotation: { period: 10.2, tilt: 26.7 },
      props: {
        ...planetPreset('gas'),
        rings: { enabled: true, inner: 1.35, outer: 2.4, colorA: '#e2d3b4', colorB: '#8a7560', opacity: 0.85, bands: 0.7, tilt: 0 },
      },
      seed: 606,
    }),
  )
  ;['Thalie', 'Érato', 'Clio'].forEach((name, i) =>
    add(
      createBody('moon', {
        name,
        parentId: e.id,
        order: i + 1,
        orbit: defaultOrbit(0.0028 + i * 0.0022, { i: 0.5 + i, m0: i * 110 }),
        props: moonPreset(i === 1 ? 'ice' : 'barren'),
        seed: 607 + i,
      }),
    ),
  )

  const f = add(
    createBody('planet', {
      name: 'Nérée',
      parentId: star.id,
      order: 7,
      orbit: defaultOrbit(9.6, { e: 0.04, i: 2.2, node: 15, m0: 20 }),
      rotation: { period: -17, tilt: 82 },
      props: { ...planetPreset('icegiant'), rings: { enabled: true, inner: 1.6, outer: 2.0, colorA: '#bfe6f0', colorB: '#5a7a88', opacity: 0.35, bands: 0.9, tilt: 0 } },
      seed: 707,
    }),
  )
  void f

  add(
    createBody('comet', {
      name: 'C/2489 Morrigan',
      parentId: star.id,
      order: 8,
      orbit: defaultOrbit(8, { e: 0.9, i: 24, node: 60, peri: 130, m0: 355 }),
      seed: 808,
    }),
  )

  add(
    createBody('gate', {
      name: 'Portail Ostia',
      parentId: star.id,
      order: 9,
      orbit: defaultOrbit(14, { fixed: true, show: false, m0: 250, i: 6 }),
      props: { gateType: 'ring', size: 2.2, destination: 'Système Kharon' },
    }),
  )

  add(
    createBody('marker', {
      name: 'Signal de détresse',
      parentId: star.id,
      order: 10,
      orbit: defaultOrbit(3.1, { fixed: true, show: false, m0: 30, i: 4 }),
      props: { markerType: 'distress', code: 'SOS' },
      playerVisible: false,
      notes: { gm: "Épave du cargo « Calypso ». Équipage disparu. L'IA de bord ment." },
    }),
  )

  add(
    createBody('nebula', {
      name: 'Voile de Morrigan',
      parentId: null,
      order: 11,
      orbit: defaultOrbit(40, { fixed: true, show: false, m0: 140, i: 12 }),
      props: { size: 60, colors: ['#ff5a8a', '#4a7aff', '#ffcf8a'] },
    }),
  )

  const ship = add(
    createBody('ship', {
      name: 'ISV Halcyon',
      parentId: star.id,
      order: 12,
      orbit: defaultOrbit(1.5, { e: 0.35, i: 3, m0: 90 }),
      props: { shipType: 'freighter', size: 1.2 },
    }),
  )
  void ship

  const r = createRoute(c.id, system.bodies[Object.keys(system.bodies).find((k) => system.bodies[k].name === 'Raffinerie Morrow-7')!].id, {
    name: 'Ligne Halberd–Morrow',
    traffic: 2,
  })
  system.routes[r.id] = r

  return system
}
