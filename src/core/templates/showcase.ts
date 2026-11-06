import { createBody, createRoute, createSystem, defaultOrbit } from '../defaults'
import { moonPreset, planetPreset } from '../planetPresets'
import { schwarzschildKm, starPreset } from '../starPresets'
import type { Body, StarSystem } from '../types'

const AU_PER_KM = 1 / 149_597_870.7

function builder(system: StarSystem) {
  const order = new Map<string | null, number>()
  return <B extends Body>(b: B): B => {
    const n = (order.get(b.parentId) ?? 0) + 1
    order.set(b.parentId, n)
    b.order = n
    system.bodies[b.id] = b
    return b
  }
}

export function createBinaryTemplate(): StarSystem {
  const system = createSystem('Gémeaux Lacrymae', {
    designation: 'GJ 3021',
    description:
      'Deux soleils enlacés à 0,22 UA l’un de l’autre. Un monde tempéré y connaît des doubles couchers de soleil, et des saisons imprévisibles.',
  })
  system.calendar.epochYear = 2563
  system.environment = { ...system.environment, nebulaColor: '#4a2a5e', nebulaColor2: '#1a3a5c', nebulaIntensity: 0.4 }
  const add = builder(system)

  const bary = add(createBody('barycenter', { name: 'Lacrymae AB', props: { showMarker: true }, seed: 200 }))
  const pa = starPreset('K', 1, 'V')
  const pb = starPreset('M', 3, 'V')
  const sep = 0.22
  const aA = (sep * pb.mass) / (pa.mass + pb.mass)
  const aB = (sep * pa.mass) / (pa.mass + pb.mass)
  add(createBody('star', { name: 'Lacrymae A', parentId: bary.id, orbit: defaultOrbit(Number(aA.toFixed(4)), { e: 0.1, peri: 30 }), props: pa, seed: 201 }))
  add(createBody('star', { name: 'Lacrymae B', parentId: bary.id, orbit: defaultOrbit(Number(aB.toFixed(4)), { e: 0.1, peri: 210 }), props: pb, seed: 202 }))

  add(
    createBody('planet', {
      name: 'Cendre',
      parentId: bary.id,
      orbit: defaultOrbit(0.8, { e: 0.03, i: 0.8, m0: 40 }),
      rotation: { period: 31, tilt: 4 },
      props: { ...planetPreset('desert'), radius: 0.8, mass: 0.5 },
      seed: 203,
      notes: { hazards: 'Tempêtes de sable aux deux aubes', resources: 'Silicates, terres rares' },
    }),
  )
  const home = add(
    createBody('planet', {
      name: 'Lacrymae c',
      parentId: bary.id,
      orbit: defaultOrbit(0.86, { e: 0.02, i: 1.1, node: 70, m0: 210 }),
      rotation: { period: 27, tilt: 18, azimuth: 40 },
      props: planetPreset('ocean'),
      seed: 204,
      notes: {
        population: '≈ 210 000 colons',
        faction: 'Coopérative de Thulé',
        atmosphere: 'Humide, respirable',
        description: 'Monde océan aux deux soleils. Les marées doubles rythment la vie des archipels.',
        gm: 'Les marées ont mis au jour une structure engloutie qui émet à 1,42 GHz.',
      },
    }),
  )
  add(
    createBody('station', {
      name: 'Anneau de Thulé',
      parentId: home.id,
      orbit: defaultOrbit(Number((6371 * 1.3 * 1.4 * AU_PER_KM).toPrecision(4)), { i: 18, node: 40, m0: 10 }),
      props: { stationType: 'ring', size: 1.3 },
      seed: 205,
      notes: { population: '4 800', faction: 'Coopérative de Thulé' },
    }),
  )
  add(createBody('belt', { name: 'Ceinture des Pleurs', parentId: bary.id, props: { inner: 1.25, outer: 1.7, count: 2600 }, seed: 206 }))
  const giant = add(
    createBody('planet', {
      name: 'Opale',
      parentId: bary.id,
      orbit: defaultOrbit(2.4, { e: 0.04, i: 1.6, node: 200, m0: 120 }),
      rotation: { period: 11, tilt: 22, azimuth: 110 },
      props: {
        ...planetPreset('gas'),
        palette: ['#8a6ab0', '#c8b0e0', '#5a4080', '#e0d0f0', '#f0a0c0'],
        rings: { enabled: true, inner: 1.3, outer: 2.3, colorA: '#d8c8e8', colorB: '#6a5a80', opacity: 0.8, bands: 0.75, tilt: 0 },
      },
      seed: 207,
    }),
  )
  ;['Opale I', 'Opale II', 'Nacre'].forEach((name, k) =>
    add(
      createBody('moon', {
        name,
        parentId: giant.id,
        orbit: defaultOrbit(Number((71_000 * (2.7 + k * 1.3) * AU_PER_KM * 1.0).toPrecision(4)), { i: 22, node: 110, m0: k * 120 }),
        props: moonPreset(k === 2 ? 'ice' : 'barren'),
        seed: 208 + k,
      }),
    ),
  )
  add(
    createBody('planet', {
      name: 'Silence',
      parentId: bary.id,
      orbit: defaultOrbit(6.1, { e: 0.06, i: 2.2, node: 300, m0: 300 }),
      rotation: { period: 15, tilt: 41 },
      props: { ...planetPreset('icegiant'), palette: ['#4ab0a8', '#80d8d0', '#2a8a88', '#b0eae4', '#1a5a60'] },
      seed: 212,
    }),
  )
  add(
    createBody('marker', {
      name: 'Balise muette',
      parentId: bary.id,
      orbit: defaultOrbit(3.4, { fixed: true, show: false, m0: 80, i: 5 }),
      props: { markerType: 'distress', code: 'SOS' },
      playerVisible: false,
      seed: 213,
      notes: { gm: 'La balise répète les coordonnées de Lacrymae c… vues depuis l’avenir.' },
    }),
  )
  return system
}

export function createBlackHoleTemplate(): StarSystem {
  const system = createSystem('Charybde', {
    designation: 'XR-17b',
    description:
      'Trou noir de 14 masses solaires, vestige d’une supernova ancienne. Un observatoire corporatiste y étudie l’horizon. Les horloges y prennent du retard.',
  })
  system.calendar.epochYear = 2611
  system.environment = { ...system.environment, nebulaColor: '#5a1a3a', nebulaColor2: '#1a2a6a', nebulaIntensity: 0.55, milkyWay: 0.8 }
  const add = builder(system)

  const bh = starPreset('BH')
  bh.mass = 14
  bh.radius = schwarzschildKm(14) / 695_700
  bh.diskOuter = 10
  bh.diskBrightness = 1.8
  const hole = add(createBody('star', { name: 'Charybde', props: bh, rotation: { period: 0, tilt: 18, azimuth: 30 }, seed: 300 }))

  add(
    createBody('station', {
      name: 'Observatoire Horizon',
      parentId: hole.id,
      orbit: defaultOrbit(0.35, { i: 18, node: 30, m0: 60 }),
      props: { stationType: 'modular', size: 1.6 },
      seed: 301,
      notes: {
        population: '62 chercheurs',
        faction: 'Sankt-Ilse Pharma',
        description: 'Laboratoire d’étude de l’horizon des événements.',
        gm: 'L’équipage de relève est arrivé il y a 3 jours. Pour eux, ce sont 3 semaines.',
      },
    }),
  )
  const worlds: [string, 'ice' | 'barren' | 'chthonian' | 'icegiant', number][] = [
    ['Scylla', 'chthonian', 0.6],
    ['Givre', 'ice', 1.4],
    ['Morne', 'barren', 2.6],
    ['Léthé', 'icegiant', 5.2],
  ]
  worlds.forEach(([name, type, a], k) => {
    const p = add(
      createBody('planet', {
        name,
        parentId: hole.id,
        orbit: defaultOrbit(a, { e: 0.04 + k * 0.03, i: 1 + k, node: k * 70, m0: k * 95 }),
        rotation: { period: 18 + k * 9, tilt: 10 + k * 7 },
        props: planetPreset(type),
        seed: 302 + k,
        notes: { hazards: 'Radiations du disque d’accrétion, dilatation temporelle' },
      }),
    )
    if (type === 'icegiant') {
      add(createBody('moon', { name: 'Léthé I', parentId: p.id, orbit: defaultOrbit(0.0012, { i: 24 }), props: moonPreset('ice'), seed: 310 }))
    }
  })
  add(createBody('belt', { name: 'Débris du progéniteur', parentId: hole.id, props: { beltType: 'debris', inner: 3.4, outer: 4.4, count: 3200, dust: 0.7 }, seed: 311 }))
  add(
    createBody('nebula', {
      name: 'Rémanent de Charybde',
      parentId: null,
      orbit: defaultOrbit(60, { fixed: true, show: false, m0: 200, i: 15 }),
      props: { nebulaType: 'remnant', size: 70, colors: ['#ff4a7a', '#4a8aff', '#ffd08a'], density: 0.65 },
      seed: 312,
    }),
  )
  add(
    createBody('ship', {
      name: 'Épave du RSV Persistance',
      parentId: hole.id,
      orbit: defaultOrbit(1.9, { e: 0.4, i: 9, m0: 10 }),
      props: { shipType: 'derelict', damaged: true, thrusting: false, trail: false },
      playerVisible: false,
      seed: 313,
      notes: { gm: 'L’équipage est à bord, figé dans le temps, vivant. Il croit être arrivé hier.' },
    }),
  )
  add(
    createBody('marker', {
      name: 'Anomalie temporelle',
      parentId: hole.id,
      orbit: defaultOrbit(1.1, { fixed: true, show: false, m0: 250 }),
      props: { markerType: 'anomaly', code: 'Δt' },
      playerVisible: false,
      seed: 314,
      notes: { gm: 'Les horloges y reculent de 11 secondes par heure.' },
    }),
  )
  const gate = add(
    createBody('gate', {
      name: 'Arche Absolon',
      parentId: hole.id,
      orbit: defaultOrbit(8.5, { fixed: true, show: false, m0: 140, i: 6 }),
      props: { gateType: 'anomaly', size: 2.4, destination: 'Inconnue' },
      seed: 315,
    }),
  )
  const obs = Object.values(system.bodies).find((b) => b.name === 'Observatoire Horizon')!
  const r = createRoute(obs.id, gate.id, { name: 'Couloir Absolon', kind: 'danger', color: '#FF7B6B', traffic: 1 })
  system.routes[r.id] = r
  return system
}
