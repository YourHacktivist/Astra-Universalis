import { createBody, createSystem, defaultOrbit } from '../defaults'
import { moonPreset, planetPreset } from '../planetPresets'
import { starPreset } from '../starPresets'
import type { Body, Hex, Orbit, PlanetProps, PlanetType, StarSystem } from '../types'

const AU_PER_KM = 1 / 149_597_870.7

type Palette = PlanetProps['palette']
const pal = (c: Hex[]) => c as Palette

interface PlanetSpec {
  name: string
  type: PlanetType
  orbit: Partial<Orbit> & { a: number }
  radius: number
  mass: number
  albedo: number
  greenhouse?: number
  period: number
  tilt: number
  azimuth: number
  seed: number
  props?: Partial<PlanetProps>
  notes?: Partial<Body['notes']>
}

interface MoonSpec {
  name: string
  type: PlanetType
  aKm: number
  e: number
  iEq?: number
  ecliptic?: { i: number; node: number; peri: number }
  retrograde?: boolean
  radius: number
  mass: number
  albedo: number
  greenhouse?: number
  m0: number
  seed: number
  props?: Partial<PlanetProps>
  notes?: Partial<Body['notes']>
}

function equatorialPlane(parent: Body, iEq: number) {
  const r = parent.rotation
  if (r.period < 0) return { i: 180 - r.tilt + iEq, node: (r.azimuth + 180) % 360 }
  return { i: r.tilt + iEq, node: r.azimuth }
}

export function createSolSystem(): StarSystem {
  const system = createSystem('Sol', {
    designation: 'Système solaire',
    description:
      'Le berceau de l’humanité : une naine jaune G2 V, huit planètes, des planètes naines, deux ceintures de débris et des centaines de lunes. Données orbitales J2000.',
  })
  system.calendar = { epochYear: 2000, era: '' }
  system.environment = { ...system.environment, milkyWay: 0.7, milkyWayTilt: 60, nebulaIntensity: 0.2, starDensity: 0.65 }

  const order = new Map<string | null, number>()
  const add = <B extends Body>(b: B): B => {
    const n = (order.get(b.parentId) ?? 0) + 1
    order.set(b.parentId, n)
    b.order = n
    system.bodies[b.id] = b
    return b
  }

  const sunProps = starPreset('G', 2, 'V')
  Object.assign(sunProps, { temperature: 5772, radius: 1, mass: 1, luminosity: 1, spots: 0.18 })
  const sun = add(
    createBody('star', {
      name: 'Soleil',
      props: sunProps,
      rotation: { period: 609.12, tilt: 7.25, azimuth: 75.77 },
      seed: 1,
      notes: {
        description: 'Naine jaune G2 V de 4,6 milliards d’années ; 99,86 % de la masse du système. Rotation de 25,4 jours à l’équateur.',
      },
    }),
  )

  const planet = (s: PlanetSpec) => {
    const props = {
      ...planetPreset(s.type),
      radius: s.radius,
      mass: s.mass,
      albedo: s.albedo,
      greenhouse: s.greenhouse ?? 0,
      ...s.props,
    } as PlanetProps
    return add(
      createBody('planet', {
        name: s.name,
        parentId: sun.id,
        orbit: defaultOrbit(s.orbit.a, s.orbit),
        rotation: { period: s.period, tilt: s.tilt, azimuth: s.azimuth },
        props,
        seed: s.seed,
        notes: s.notes,
      }),
    )
  }

  const moon = (parent: Body, s: MoonSpec) => {
    const props = { ...moonPreset(s.type), radius: s.radius, mass: s.mass, albedo: s.albedo, greenhouse: s.greenhouse ?? 0, ...s.props } as PlanetProps
    const plane = s.ecliptic ?? equatorialPlane(parent, s.iEq ?? 0)
    return add(
      createBody('moon', {
        name: s.name,
        parentId: parent.id,
        orbit: defaultOrbit(Number((s.aKm * AU_PER_KM).toPrecision(6)), {
          e: s.e,
          i: Number(plane.i.toFixed(3)),
          node: Number(plane.node.toFixed(3)),
          peri: s.ecliptic?.peri ?? 0,
          m0: s.m0,
          retrograde: !!s.retrograde,
        }),
        rotation: { period: 0, locked: true, tilt: 0 },
        props,
        seed: s.seed,
        notes: s.notes,
      }),
    )
  }

  planet({
    name: 'Mercure', type: 'barren', seed: 11,
    orbit: { a: 0.38709927, e: 0.20563593, i: 7.005, node: 48.331, peri: 29.127, m0: 174.793 },
    radius: 0.383, mass: 0.0553, albedo: 0.088, period: 1407.6, tilt: 7.04, azimuth: 48.24,
    props: { palette: pal(['#3e3a36', '#6a645e', '#8e8a84', '#aaa49c', '#d0cac0']), craters: 0.95 },
    notes: {
      description: 'Plus petite planète. Journée solaire de 176 jours terrestres ; résonance 3:2 entre rotation et révolution.',
      atmosphere: 'Exosphère négligeable (sodium, potassium, hélium)',
      hazards: '430 °C le jour, −180 °C la nuit ; vent solaire intense',
      resources: 'Fer, métaux, glace d’eau dans les cratères polaires',
    },
  })
  planet({
    name: 'Vénus', type: 'toxic', seed: 12,
    orbit: { a: 0.72333566, e: 0.00677672, i: 3.395, node: 76.68, peri: 54.923, m0: 50.377 },
    radius: 0.9499, mass: 0.815, albedo: 0.76, greenhouse: 508, period: -5832.5, tilt: 1.24, azimuth: 120.19,
    notes: {
      description: 'Rotation rétrograde : le Soleil s’y lève à l’ouest, une journée solaire dure 117 jours terrestres. Effet de serre emballé.',
      atmosphere: 'CO₂ (96,5 %), 92 bar, nuages d’acide sulfurique',
      hazards: '465 °C au sol, pression écrasante, pluies acides',
      resources: 'Composés soufrés et carbonés',
    },
  })
  const earth = planet({
    name: 'Terre', type: 'terran', seed: 13,
    orbit: { a: 1.00000261, e: 0.01671123, i: 0, node: 0, peri: 102.938, m0: 357.527 },
    radius: 1, mass: 1, albedo: 0.306, greenhouse: 33, period: 23.9345, tilt: 23.44, azimuth: 180,
    notes: {
      description: 'Seule planète connue abritant la vie. Océans sur 71 % de la surface, 15 °C en moyenne.',
      population: '≈ 6,1 milliards (an 2000)',
      atmosphere: 'Azote (78 %), oxygène (21 %), 1 bar, respirable',
      resources: 'Eau, biosphère, toutes ressources',
    },
  })
  const mars = planet({
    name: 'Mars', type: 'arid', seed: 14,
    orbit: { a: 1.52371034, e: 0.0933941, i: 1.85, node: 49.56, peri: 286.502, m0: 19.39 },
    radius: 0.532, mass: 0.107, albedo: 0.25, period: 24.6229, tilt: 25.4, azimuth: 84.84,
    notes: {
      description: 'Olympus Mons (22 km d’altitude) et le canyon Valles Marineris. Calottes polaires d’eau et de CO₂.',
      atmosphere: 'CO₂ (95 %), 6 mbar, irrespirable',
      hazards: '−63 °C en moyenne, tempêtes de poussière globales, radiations',
      resources: 'Glace d’eau, fer, perchlorates',
    },
  })
  const jupiter = planet({
    name: 'Jupiter', type: 'gas', seed: 15,
    orbit: { a: 5.202887, e: 0.04838624, i: 1.304, node: 100.474, peri: 274.255, m0: 19.668 },
    radius: 10.97, mass: 317.8, albedo: 0.343, greenhouse: 55, period: 9.925, tilt: 2.22, azimuth: 337.82,
    props: { bands: 16, storms: 0.7, turbulence: 0.6 },
    notes: {
      description: 'Plus grande planète. La Grande Tache rouge est une tempête plus large que la Terre. 95 lunes connues.',
      atmosphere: 'Hydrogène (90 %), hélium, ammoniac',
      hazards: 'Ceintures de radiations mortelles, vents de 600 km/h',
      resources: 'Hydrogène, hélium-3 (écopage)',
    },
  })
  const saturn = planet({
    name: 'Saturne', type: 'gas', seed: 16,
    orbit: { a: 9.53667594, e: 0.05386179, i: 2.486, node: 113.662, peri: 338.936, m0: 317.355 },
    radius: 9.14, mass: 95.16, albedo: 0.342, greenhouse: 53, period: 10.656, tilt: 28.05, azimuth: 169.53,
    props: {
      palette: pal(['#d8c08a', '#ecdcb4', '#c2a06a', '#a8875a', '#e8c88a']),
      bands: 12, storms: 0.2, turbulence: 0.35,
      rings: { enabled: true, inner: 1.24, outer: 2.27, colorA: '#e2d3b4', colorB: '#9c8a6c', opacity: 0.92, bands: 0.85, tilt: 0 },
    },
    notes: {
      description: 'Anneaux de glace de 270 000 km d’envergure pour quelques dizaines de mètres d’épaisseur. Densité inférieure à celle de l’eau. 146 lunes connues.',
      atmosphere: 'Hydrogène (96 %), hélium',
      hazards: 'Vents de 1 800 km/h, tempêtes hexagonales au pôle nord',
      resources: 'Hydrogène, hélium-3, glace des anneaux',
    },
  })
  const uranus = planet({
    name: 'Uranus', type: 'icegiant', seed: 17,
    orbit: { a: 19.18916464, e: 0.04725744, i: 0.773, node: 74.017, peri: 96.937, m0: 142.284 },
    radius: 3.98, mass: 14.54, albedo: 0.3, greenhouse: 18, period: -17.24, tilt: 82.28, azimuth: 347.65,
    props: {
      palette: pal(['#9fd8e0', '#b5e5ea', '#8ccad6', '#c5eef0', '#7ab8c8']), bands: 5, storms: 0.04, turbulence: 0.12,
      rings: { enabled: true, inner: 1.64, outer: 2.0, colorA: '#6a7a80', colorB: '#3a4448', opacity: 0.3, bands: 0.95, tilt: 0 },
    },
    notes: {
      description: 'Axe couché (obliquité 97,8°) et rotation rétrograde : chaque pôle connaît 42 ans de jour puis 42 ans de nuit. 28 lunes connues.',
      atmosphere: 'Hydrogène, hélium, méthane (2,3 %)',
      hazards: '−224 °C : atmosphère la plus froide du système',
      resources: 'Hydrogène, méthane, glaces',
    },
  })
  const neptune = planet({
    name: 'Neptune', type: 'icegiant', seed: 18,
    orbit: { a: 30.06992276, e: 0.00859048, i: 1.77, node: 131.784, peri: 273.18, m0: 259.915 },
    radius: 3.86, mass: 17.15, albedo: 0.29, greenhouse: 25, period: 16.11, tilt: 28.03, azimuth: 49.24,
    props: {
      palette: pal(['#3a5fcf', '#5a82e0', '#2a46a8', '#7fa0f0', '#1a2a6a']), bands: 7, storms: 0.4,
      rings: { enabled: true, inner: 1.69, outer: 2.54, colorA: '#7a8090', colorB: '#3a3e48', opacity: 0.12, bands: 0.95, tilt: 0 },
    },
    notes: {
      description: 'Vents les plus rapides du système (2 100 km/h). Découverte par le calcul en 1846. 16 lunes connues.',
      atmosphere: 'Hydrogène, hélium, méthane',
      hazards: '−214 °C, vents supersoniques',
      resources: 'Hydrogène, méthane, glaces',
    },
  })
  const pluto = planet({
    name: 'Pluton', type: 'ice', seed: 19,
    orbit: { a: 39.48211675, e: 0.2488273, i: 17.14, node: 110.304, peri: 113.765, m0: 14.86 },
    radius: 0.1865, mass: 0.00218, albedo: 0.58, greenhouse: 5, period: 153.29, tilt: 112.82, azimuth: 227.35,
    props: { palette: pal(['#6a4a38', '#b8987a', '#e8dcc8', '#f0e8dc', '#ffffff']), craters: 0.25 },
    notes: {
      description: 'Planète naine. Glacier d’azote Spoutnik Planitia en forme de cœur ; obliquité 122,5° par rapport à son orbite. Année de 248 ans.',
      atmosphere: 'Azote ténu (~10 µbar), brumes bleutées',
      hazards: '−230 °C',
      resources: 'Glaces d’azote, de méthane et d’eau',
    },
  })

  moon(earth, {
    name: 'Lune', type: 'barren', aKm: 384_400, e: 0.0549, ecliptic: { i: 5.145, node: 125.04, peri: 318.31 }, m0: 134.96,
    radius: 0.2727, mass: 0.0123, albedo: 0.11, seed: 31,
    notes: {
      description: 'Rotation synchrone : toujours la même face vers la Terre. Douze humains y ont marché (1969–1972).',
      atmosphere: 'Aucune',
      hazards: '−170 °C à 120 °C, radiations, régolithe abrasif',
      resources: 'Hélium-3, titane, glace d’eau polaire',
    },
  })
  moon(mars, {
    name: 'Phobos', type: 'barren', aKm: 9376, e: 0.0151, iEq: 1.08, radius: 0.00177, mass: 1.78e-9, albedo: 0.07, m0: 91, seed: 41,
    notes: { description: 'Lune irrégulière (27 km) qui spirale vers Mars ; elle se disloquera en anneau d’ici ~50 millions d’années.' },
  })
  moon(mars, {
    name: 'Déimos', type: 'barren', aKm: 23_463, e: 0.00033, iEq: 1.79, radius: 0.00097, mass: 2.47e-10, albedo: 0.07, m0: 296, seed: 42,
    notes: { description: 'Petite lune lisse (15 km), probablement un astéroïde capturé.' },
  })
  moon(jupiter, {
    name: 'Io', type: 'lava', aKm: 421_700, e: 0.0041, iEq: 0.05, radius: 0.286, mass: 0.015, albedo: 0.63, greenhouse: 15, m0: 342, seed: 51,
    props: { palette: pal(['#3a2a10', '#8a7a30', '#d8c860', '#e86a20', '#fff0a0']), emissive: 0.35 },
    notes: {
      description: 'Monde le plus volcanique du système : plus de 400 volcans actifs, chauffés par les marées de Jupiter.',
      atmosphere: 'Dioxyde de soufre très ténu',
      hazards: 'Radiations extrêmes (3 600 rem/jour), éruptions',
    },
  })
  moon(jupiter, {
    name: 'Europe', type: 'ice', aKm: 671_034, e: 0.009, iEq: 0.47, radius: 0.245, mass: 0.008, albedo: 0.68, m0: 171, seed: 52,
    props: { palette: pal(['#7a5a40', '#c8b8a0', '#e8e0d4', '#f2ece4', '#ffffff']) },
    notes: { description: 'Océan d’eau salée sous 15 à 25 km de glace : l’un des meilleurs candidats à la vie.', hazards: 'Radiations, −160 °C', resources: 'Eau' },
  })
  moon(jupiter, {
    name: 'Ganymède', type: 'barren', aKm: 1_070_412, e: 0.0013, iEq: 0.2, radius: 0.4135, mass: 0.0248, albedo: 0.43, m0: 317, seed: 53,
    props: { palette: pal(['#4a4038', '#7a6e60', '#a89a88', '#c8bca8', '#e0d8cc']) },
    notes: { description: 'Plus grande lune du système, plus grande que Mercure ; seule lune dotée d’un champ magnétique propre.', resources: 'Glace d’eau, océan souterrain' },
  })
  moon(jupiter, {
    name: 'Callisto', type: 'barren', aKm: 1_882_709, e: 0.0074, iEq: 0.19, radius: 0.3783, mass: 0.018, albedo: 0.13, m0: 181, seed: 54,
    props: { palette: pal(['#2a2622', '#4a443c', '#6a6258', '#8a8070', '#c8c0b0']), craters: 1 },
    notes: { description: 'Surface la plus cratérisée du système ; hors des ceintures de radiations les plus intenses.' },
  })
  moon(saturn, {
    name: 'Encelade', type: 'ice', aKm: 237_948, e: 0.0047, iEq: 0.02, radius: 0.0396, mass: 1.81e-5, albedo: 0.81, m0: 200, seed: 61,
    props: { palette: pal(['#9ab8d0', '#d8e8f2', '#f0f6fa', '#f8fbfd', '#ffffff']) },
    notes: { description: 'Geysers d’eau au pôle sud qui alimentent l’anneau E ; océan global sous la glace.', resources: 'Eau, composés organiques' },
  })
  moon(saturn, {
    name: 'Rhéa', type: 'ice', aKm: 527_108, e: 0.0013, iEq: 0.35, radius: 0.1199, mass: 0.000386, albedo: 0.57, m0: 31, seed: 62,
    notes: { description: 'Deuxième plus grande lune de Saturne, mélange de glace et de roche.' },
  })
  moon(saturn, {
    name: 'Titan', type: 'toxic', aKm: 1_221_870, e: 0.0288, iEq: 0.35, radius: 0.4041, mass: 0.0225, albedo: 0.27, greenhouse: 11, m0: 163, seed: 63,
    props: {
      palette: pal(['#5a3a1a', '#8a5a2a', '#c08040', '#a87038', '#e0b070']),
      atmosphere: { enabled: true, color: '#e8a050', density: 0.85, height: 0.08, sunsetColor: '#ffcf80' },
      clouds: { enabled: true, coverage: 0.95, color: '#d89850', opacity: 0.95, speed: 0.2, scale: 0.7 },
    },
    notes: {
      description: 'Seule lune dotée d’une atmosphère épaisse. Lacs et mers de méthane et d’éthane liquides.',
      atmosphere: 'Azote (95 %) et méthane, 1,5 bar',
      hazards: '−179 °C',
      resources: 'Hydrocarbures liquides',
    },
  })
  moon(saturn, {
    name: 'Japet', type: 'barren', aKm: 3_560_820, e: 0.0286, iEq: 15.47, radius: 0.1153, mass: 0.000302, albedo: 0.2, m0: 271, seed: 64,
    props: { palette: pal(['#2a1e16', '#3a2a20', '#c8c0b0', '#e0d8cc', '#f0ece4']) },
    notes: { description: 'Hémisphère avant sombre et arrière brillant ; crête équatoriale de 20 km de haut.' },
  })
  moon(uranus, {
    name: 'Titania', type: 'barren', aKm: 435_910, e: 0.0011, iEq: 0.34, radius: 0.1238, mass: 0.00057, albedo: 0.17, m0: 24, seed: 71,
    notes: { description: 'Plus grande lune d’Uranus ; canyons de plus de 1 500 km.' },
  })
  moon(uranus, {
    name: 'Obéron', type: 'barren', aKm: 583_520, e: 0.0014, iEq: 0.06, radius: 0.1195, mass: 0.000515, albedo: 0.14, m0: 284, seed: 72,
    notes: { description: 'Lune majeure la plus éloignée d’Uranus, sombre et cratérisée.' },
  })
  moon(neptune, {
    name: 'Triton', type: 'ice', aKm: 354_759, e: 0.000016, iEq: 23.1, retrograde: true, radius: 0.2124, mass: 0.00359, albedo: 0.76, m0: 264, seed: 81,
    props: { palette: pal(['#8a6a6a', '#c8a8a0', '#e8d8d0', '#f0e8e4', '#ffffff']) },
    notes: {
      description: 'Lune capturée sur orbite rétrograde (156,9°), qui spirale lentement vers Neptune. Geysers d’azote.',
      atmosphere: 'Azote ténu (14 µbar)',
      hazards: '−235 °C',
    },
  })
  moon(pluto, {
    name: 'Charon', type: 'barren', aKm: 19_591, e: 0.0002, iEq: 0, radius: 0.0951, mass: 0.000266, albedo: 0.25, m0: 180, seed: 91,
    notes: { description: 'Moitié de la taille de Pluton : les deux corps sont mutuellement en rotation synchrone.' },
  })

  add(
    createBody('belt', {
      name: 'Ceinture principale',
      parentId: sun.id,
      seed: 101,
      props: { beltType: 'asteroid', inner: 2.1, outer: 3.3, count: 4200, thickness: 0.07, dust: 0.4 },
      notes: {
        resources: 'Fer, nickel, platinoïdes, glaces',
        description: 'Plus d’un million d’astéroïdes de plus d’un kilomètre ; Cérès, Vesta, Pallas et Hygie en forment près de la moitié de la masse.',
      },
    }),
  )
  add(
    createBody('belt', {
      name: 'Ceinture de Kuiper',
      parentId: sun.id,
      seed: 102,
      props: { beltType: 'kuiper', inner: 30, outer: 50, count: 4500, thickness: 0.14, dust: 0.3, colorA: '#9aa7b8', colorB: '#5c6678', dustColor: '#8fb2d8' },
      notes: { resources: 'Glaces volatiles', description: 'Réservoir de comètes à courte période et de planètes naines (Pluton, Éris, Makémaké, Haumea).' },
    }),
  )
  add(
    createBody('comet', {
      name: '1P/Halley',
      parentId: sun.id,
      seed: 103,
      orbit: defaultOrbit(17.834, { e: 0.96714, i: 162.26, node: 58.42, peri: 111.33, m0: 66.4 }),
      props: { nucleusKm: 5.5, tailLength: 1.3 },
      notes: { description: 'Comète périodique (75–76 ans) sur orbite rétrograde ; périhélie en 1986, prochain passage en 2061.' },
    }),
  )
  const iss = equatorialPlane(earth, 51.64)
  add(
    createBody('station', {
      name: 'Station spatiale internationale',
      parentId: earth.id,
      seed: 104,
      orbit: defaultOrbit(Number((6798 * AU_PER_KM).toPrecision(6)), { i: iss.i, node: iss.node, m0: 40 }),
      props: { stationType: 'modular', size: 1, lengthM: 109 },
      notes: {
        description: 'Orbite à ~420 km d’altitude, inclinée de 51,6° sur l’équateur : un tour en 93 minutes.',
        population: 'Équipage permanent (3 à 7) depuis novembre 2000',
        faction: 'NASA, Roscosmos, ESA, JAXA, ASC',
      },
    }),
  )
  return system
}
