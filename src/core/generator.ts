import { adjustHex, hslHex, mixHex } from '@/lib/color'
import { num } from '@/lib/format'
import { Rng } from '@/lib/random'
import { createBody, createRoute, createSystem, defaultOrbit } from './defaults'
import { NameGen } from './names'
import { equilibriumTemperature, frostLine, habitableZone } from './physics'
import { isGiant, moonPreset, planetPreset } from './planetPresets'
import { luminosityFrom, schwarzschildKm, spectralLabel, starPreset } from './starPresets'
import type {
  Body,
  BodyKind,
  EnvironmentSettings,
  Hex,
  Id,
  LuminosityClass,
  MarkerType,
  NebulaType,
  Orbit,
  PlanetBody,
  PlanetProps,
  PlanetType,
  StarBody,
  StarClass,
  StarSystem,
  StationType,
} from './types'

export type GeneratorStyle = 'realistic' | 'varied' | 'exotic'

export interface GeneratorOptions {
  seed: string
  name?: string
  style: GeneratorStyle
  stars: 'auto' | 1 | 2 | 3
  planets: [number, number]
  moons: boolean
  belts: boolean
  comets: boolean
  stations: boolean
  derelicts: boolean
  gates: boolean
  nebula: boolean
  starClass?: StarClass
}

export const DEFAULT_GENERATOR_OPTIONS: Omit<GeneratorOptions, 'seed'> = {
  style: 'varied',
  stars: 'auto',
  planets: [3, 9],
  moons: true,
  belts: true,
  comets: true,
  stations: true,
  derelicts: true,
  gates: true,
  nebula: false,
}

const AU_PER_KM = 1 / 149_597_870.7
const EARTH_KM = 6371

const DESCRIPTIONS: Record<PlanetType, string[]> = {
  terran: [
    'Monde tempéré aux continents morcelés et aux océans sombres.',
    'Planète-jardin aux saisons interminables, sous un ciel cuivré.',
    'Plaines verdoyantes, chaînes de montagnes jeunes et mers intérieures.',
    'Une Terre imparfaite : trop de vent, trop de pluie, mais de l’air.',
  ],
  ocean: [
    'Océan planétaire ponctué de rares archipels volcaniques.',
    'Monde d’eau sans rivage, battu par des houles de trente mètres.',
    'Mers peu profondes et récifs bioluminescents à perte de vue.',
  ],
  jungle: [
    'Canopée continue de plusieurs centaines de mètres de haut.',
    'Jungle étouffante où rien ne reste longtemps immobile.',
    'Forêts-champignons et marécages tièdes sous une brume permanente.',
  ],
  desert: [
    'Erg infini, mers de dunes et canyons fossiles.',
    'Désert de sel blanc aveuglant, ponctué de cratères anciens.',
    'Plateaux rocheux balayés par des vents chargés de silice.',
  ],
  arid: [
    'Monde rouge et froid aux volcans éteints.',
    'Steppes de rouille, calottes de givre et lits de rivières asséchées.',
    'Plaines de basalte criblées de cratères, atmosphère moribonde.',
  ],
  ice: [
    'Croûte de glace fracturée au-dessus d’un océan noir.',
    'Banquises éternelles et geysers cryovolcaniques.',
    'Monde gelé, silencieux, d’un blanc bleuté inquiétant.',
  ],
  lava: [
    'Surface en fusion, fleuves de magma et ciel de cendres.',
    'Croûte noire craquelée laissant suinter la lave.',
    'Enfer volcanique écrasé par la proximité de son étoile.',
  ],
  barren: [
    'Rocher stérile criblé de cratères, sans atmosphère.',
    'Paysage lunaire gris, poussière fine et silence absolu.',
    'Monde mort aux falaises vertigineuses et aux mers de régolithe.',
  ],
  toxic: [
    'Nuages d’acide opaques et pression écrasante.',
    'Serre infernale : 460 °C au sol, pluie de soufre.',
    'Atmosphère jaune et brûlante, surface jamais observée à l’œil nu.',
  ],
  gas: [
    'Géante gazeuse striée de bandes et de tempêtes séculaires.',
    'Colosse d’hydrogène aux aurores permanentes.',
    'Géante aux nuages d’ammoniac et aux orages titanesques.',
  ],
  icegiant: [
    'Géante de glace aux vents supersoniques.',
    'Monde bleu pâle de méthane et de glaces profondes.',
    'Géante froide et lointaine, aux tempêtes sombres.',
  ],
  hotjupiter: [
    'Géante gazeuse brûlante, à peine à quelques millions de km de son étoile.',
    'Atmosphère arrachée par le vent stellaire, laissant une traîne de gaz.',
  ],
  chthonian: [
    'Noyau mis à nu d’une ancienne géante, ravagé par son étoile.',
    'Monde métallique dense et incandescent.',
  ],
  city: [
    'Œcuménopole : une ville unique recouvre toute la planète.',
    'Mégapole planétaire, ciel saturé de trafic et de néons.',
  ],
  exotic: [
    'Monde cristallin aux reflets impossibles, qu’aucune théorie n’explique.',
    'Surface vitrifiée, structures géométriques d’origine inconnue.',
  ],
}

const ATMOSPHERES: Record<PlanetType, string[]> = {
  terran: ['Azote-oxygène, respirable', 'Respirable, CO₂ élevé, masques en altitude', 'Azote-oxygène, spores en suspension'],
  ocean: ['Humide, respirable', 'Azote-oxygène saturé en vapeur'],
  jungle: ['Dense et humide, respirable avec filtres', 'Oxygène à 31 %, risque d’incendie'],
  desert: ['Ténue et sèche, respirateur conseillé', 'Azote-argon, poussières silicatées'],
  arid: ['Très ténue (CO₂), combinaison obligatoire', 'Quasi inexistante'],
  ice: ['Aucune', 'Traces d’azote et de méthane'],
  lava: ['Vapeurs soufrées toxiques', 'Dioxyde de soufre, sodium vaporisé'],
  barren: ['Aucune (vide)', 'Exosphère négligeable'],
  toxic: ['CO₂ écrasant, nuages d’acide sulfurique', 'Pression 90 bar, acide et brûlante'],
  gas: ['Hydrogène-hélium', 'H₂/He, ammoniac, hydrosulfure'],
  icegiant: ['H₂/He/méthane', 'Hydrogène, hélium, glaces de méthane'],
  hotjupiter: ['Hydrogène ionisé, vents supersoniques'],
  chthonian: ['Aucune : noyau mis à nu'],
  city: ['Recyclée et filtrée, odeur d’ozone permanente', 'Respirable sous dômes, smog toxique dehors'],
  exotic: ['Composition inconnue, capteurs saturés', 'Gaz nobles luminescents, effets psychotropes signalés'],
}

const HAZARDS: Record<PlanetType, string[]> = {
  terran: ['Faune agressive', 'Tempêtes saisonnières violentes', 'Pathogènes inconnus', 'Séismes fréquents'],
  ocean: ['Tempêtes perpétuelles', 'Abysses inexplorés', 'Mégafaune marine'],
  jungle: ['Flore carnivore', 'Spores hallucinogènes', 'Humidité corrosive pour l’équipement'],
  desert: ['Tempêtes de sable', 'Écarts thermiques extrêmes', 'Pénurie d’eau'],
  arid: ['Radiations de surface', 'Tempêtes de poussière globales', 'Basse pression'],
  ice: ['Froid extrême', 'Geysers cryogéniques', 'Glace instable, crevasses'],
  lava: ['Chaleur extrême', 'Éruptions et coulées', 'Séismes permanents'],
  barren: ['Radiations', 'Micrométéorites', 'Régolithe abrasif'],
  toxic: ['Pression écrasante', 'Pluies acides', 'Chaleur infernale'],
  gas: ['Vents de 600 km/h', 'Gravité écrasante', 'Ceintures de radiations'],
  icegiant: ['Vents supersoniques', 'Froid extrême', 'Pression'],
  hotjupiter: ['Rayonnement stellaire intense', 'Températures > 1 500 K'],
  chthonian: ['Chaleur extrême', 'Radiations stellaires'],
  city: ['Criminalité endémique', 'Effondrement des niveaux inférieurs', 'Surveillance corporatiste'],
  exotic: ['Anomalies électromagnétiques', 'Pertes de temps inexpliquées', 'Cristaux résonnants'],
}

const RESOURCES: Record<PlanetType, string[]> = {
  terran: ['Biomasse, eau, terres arables', 'Bois, minerais communs'],
  ocean: ['Eau, biomasse marine, deutérium'],
  jungle: ['Composés pharmaceutiques', 'Bois exotiques, alcaloïdes'],
  desert: ['Silicates, terres rares'],
  arid: ['Fer, perchlorates, glace polaire'],
  ice: ['Eau, deutérium', 'Glaces volatiles'],
  lava: ['Métaux lourds, soufre'],
  barren: ['Métaux rares, hélium-3', 'Fer, nickel, titane'],
  toxic: ['Acide sulfurique, composés carbonés'],
  gas: ['Hydrogène, hélium-3 (écopage)', 'Deutérium'],
  icegiant: ['Hydrogène, méthane, eau profonde'],
  hotjupiter: ['Aucune exploitable'],
  chthonian: ['Métaux exotiques à haute pression'],
  city: ['Main-d’œuvre, industrie lourde, données'],
  exotic: ['Cristaux à usage inconnu'],
}

const RUMORS = [
  'Les équipes de nuit refusent de descendre au niveau 9.',
  'Un cargo fantôme croise parfois près de la ceinture, feux éteints.',
  'Le dernier relevé géologique a été classé confidentiel par la compagnie.',
  'On dit que la colonie a déjà été évacuée une fois, il y a vingt ans.',
  'Des signaux réguliers proviendraient de sous la glace.',
  'Les primes de risque ont triplé ce trimestre, sans explication.',
  'Un prophète prêche dans les docks : « Le silence vient de l’étoile. »',
  'Quelqu’un achète tous les cryo-caissons disponibles à prix d’or.',
  'L’IA de la station corrige les rapports avant leur transmission.',
  'Des mineurs disparus seraient réapparus… sans se souvenir de rien.',
  'La compagnie paie pour qu’on ne pose pas de questions sur le secteur 4.',
  'Les relevés de radiations ne correspondent à aucun modèle connu.',
]

const SECRETS = [
  'La colonie sert de couverture à un laboratoire d’armes biologiques.',
  'Un organisme dormant a été extrait du forage profond. Il ne dort plus.',
  'Le directeur a falsifié les données de sécurité ; le réacteur est condamné.',
  'Les colons ont été « reconditionnés » : ils obéissent à un code vocal.',
  'Une épave extraterrestre est enfouie sous la surface. La compagnie le sait.',
  'Le signal de détresse est un appât tendu par des pilleurs.',
  'L’équipage précédent s’est entre-dévoré après trois mois d’isolement.',
  'Un androïde infiltré prépare le sabotage du dock principal.',
  'La station dérive lentement vers l’étoile ; personne ne l’a signalé.',
  'Les « tempêtes » sont des essaims de micro-organismes aériens.',
  'Le portail ne mène pas où l’on croit.',
  'Les cryo-caissons du cargo contiennent autre chose que des colons.',
]

const DERELICT_GM = [
  'Transpondeur en boucle : un message daté d’il y a quarante ans.',
  'L’équipage est à bord, assis à leurs postes. Morts depuis des années. Les lumières clignotent encore.',
  'La soute est vide, scellée de l’intérieur. Des traces de griffes sur les parois.',
  'L’IA de bord prétend que l’équipage dort. Elle ment.',
  'Le réacteur est instable : 6 h avant la fusion du cœur.',
  'Les journaux de bord ont été effacés, sauf une phrase répétée : « Ne pas ouvrir. »',
  'Un survivant en cryo-sommeil. Il n’apparaît sur aucun manifeste.',
  'La coque est percée de l’intérieur vers l’extérieur.',
]

const ANOMALY_GM = [
  'Les instruments de navigation s’affolent ; les horloges dérivent de 3 min/h.',
  'Une distorsion gravitationnelle sans masse apparente.',
  'Un écho radar d’un objet de 40 km, invisible à l’œil nu.',
  'Les équipages qui l’approchent font tous le même rêve.',
]

const STATION_DESC: Partial<Record<StationType, string[]>> = {
  ring: ['Anneau d’habitation en rotation, docks marchands et quartiers ouvriers.', 'Habitat corporatiste à gravité simulée.'],
  modular: ['Assemblage de modules soudés au fil des décennies.', 'Station scientifique modulaire, peu d’effectifs.'],
  spindle: ['Cylindre d’O’Neill : une ville entière sous un ciel artificiel.'],
  outpost: ['Avant-poste minier creusé dans la roche.', 'Poste de forage et de raffinage préliminaire.'],
  shipyard: ['Chantier spatial, cales sèches et grues orbitales.'],
  refinery: ['Raffinerie d’hélium-3 et de deutérium.', 'Plateforme de raffinage, torchères permanentes.'],
  derelict: ['Station abandonnée, coque éventrée, aucun signe de vie.'],
}

type StarPick = { cls: StarClass; sub: number; lum: LuminosityClass }

const CLASS_WEIGHTS: Record<GeneratorStyle, [StarClass, number][]> = {
  realistic: [['M', 40], ['K', 22], ['G', 14], ['F', 8], ['A', 4], ['B', 1.5], ['O', 0.3], ['WD', 6], ['BD', 3]],
  varied: [['M', 20], ['K', 22], ['G', 24], ['F', 12], ['A', 8], ['B', 4], ['O', 1], ['WD', 4], ['BD', 2], ['PSR', 0.6], ['BH', 0.6]],
  exotic: [['M', 10], ['K', 12], ['G', 12], ['F', 8], ['A', 8], ['B', 8], ['O', 4], ['WD', 9], ['BD', 5], ['NS', 5], ['PSR', 7], ['BH', 9]],
}

const GIANT_CHANCE: Record<GeneratorStyle, number> = { realistic: 0.02, varied: 0.07, exotic: 0.2 }

function pickStar(rng: Rng, style: GeneratorStyle, forced?: StarClass): StarPick {
  const cls = forced ?? rng.weighted(CLASS_WEIGHTS[style])
  let lum: LuminosityClass = 'V'
  if (['G', 'K', 'M', 'B', 'A', 'F', 'O'].includes(cls) && rng.bool(GIANT_CHANCE[style])) {
    lum = style === 'exotic' ? rng.weighted([['III', 5], ['II', 2], ['Ib', 2], ['Ia', 1]] as const) : rng.weighted([['III', 6], ['IV', 4]] as const)
  }
  return { cls, sub: rng.int(0, 9), lum }
}

function makeStarProps(rng: Rng, pick: StarPick) {
  const p = starPreset(pick.cls, pick.sub, pick.lum)
  if (pick.cls === 'BH') {
    p.mass = Number(rng.logRange(4, 40).toFixed(1))
    p.radius = schwarzschildKm(p.mass) / 695_700
    p.diskOuter = Number(rng.range(7, 12).toFixed(1))
    p.diskBrightness = Number(rng.range(1, 2).toFixed(2))
    p.diskColorOuter = rng.pick(['#ff6a24', '#ff4a3a', '#ffa040', '#c05aff'])
  } else if (pick.cls === 'PSR' || pick.cls === 'NS') {
    p.mass = Number(rng.range(1.2, 2.1).toFixed(2))
    p.pulseRate = Number(rng.range(0.6, 2.6).toFixed(2))
    p.beamAngle = Math.round(rng.range(12, 60))
  } else {
    p.temperature = Math.round(p.temperature * rng.range(0.97, 1.03))
    p.radius = Number((p.radius * rng.range(0.92, 1.08)).toPrecision(3))
    p.mass = Number((p.mass * rng.range(0.92, 1.08)).toPrecision(3))
    p.luminosity = Number(luminosityFrom(p.radius, p.temperature).toPrecision(3))
    p.spots = Math.min(1, Math.max(0, p.spots + rng.range(-0.08, 0.15)))
    p.activity = Math.min(1, Math.max(0, p.activity + rng.range(-0.15, 0.25)))
  }
  return p
}

function starRotation(rng: Rng, cls: StarClass) {
  switch (cls) {
    case 'O':
    case 'B':
    case 'A':
      return { period: rng.range(18, 90), tilt: rng.range(0, 30) }
    case 'WD':
      return { period: rng.range(1, 30), tilt: rng.range(0, 40) }
    case 'NS':
    case 'PSR':
      return { period: 0.0005, tilt: rng.range(0, 35) }
    case 'BH':
      return { period: 0, tilt: rng.range(5, 35), azimuth: rng.range(0, 360) }
    case 'M':
      return { period: rng.range(200, 2200), tilt: rng.range(0, 25) }
    default:
      return { period: rng.range(350, 900), tilt: rng.range(0, 15) }
  }
}

const GAS_PALETTES: Hex[][] = [
  ['#c9a27a', '#e8d6b8', '#a8724a', '#7a5a40', '#c8583a'],
  ['#d8c08a', '#ecdcb4', '#c2a06a', '#a8875a', '#e8c88a'],
  ['#6a8ad8', '#a8c0f0', '#4a62b0', '#c8d8f8', '#2a3a80'],
  ['#a8503a', '#e0a080', '#7a3020', '#d8b8a0', '#f0d0a0'],
  ['#5a9a8a', '#a8d8c8', '#3a6a5a', '#d0e8d8', '#2a4a40'],
  ['#8a6ab0', '#c8b0e0', '#5a4080', '#e0d0f0', '#f0a0c0'],
  ['#b89060', '#f0e0c0', '#8a6a48', '#d8c0a0', '#6a4a30'],
]

const ICE_GIANT_PALETTES: Hex[][] = [
  ['#9fd8e0', '#b5e5ea', '#8ccad6', '#c5eef0', '#7ab8c8'],
  ['#3a5fcf', '#5a82e0', '#2a46a8', '#7fa0f0', '#1a2a6a'],
  ['#4ab0a8', '#80d8d0', '#2a8a88', '#b0eae4', '#1a5a60'],
  ['#8a90d8', '#b0b8f0', '#6a70b8', '#d0d4f8', '#40448a'],
]

const ALIEN_FLORA: Hex[][] = [
  ['#3a1a3a', '#6a2a5a'],
  ['#5a1a10', '#8a3a1a'],
  ['#1a2a4a', '#2a4a6a'],
  ['#3a3a10', '#6a6a20'],
]

function varyPalette(base: readonly Hex[], rng: Rng, hue: number, sat = 0.06, lit = 0.05): PlanetProps['palette'] {
  const dh = rng.range(-hue, hue)
  const ds = rng.range(-sat, sat)
  const dl = rng.range(-lit, lit)
  return base.map((c) => adjustHex(c, dh + rng.range(-0.01, 0.01), ds, dl + rng.range(-0.015, 0.015))) as PlanetProps['palette']
}

function chooseType(rng: Rng, t: number, aAU: number, hz: { inner: number; outer: number }, frost: number, style: GeneratorStyle, index: number): PlanetType {
  if (style !== 'realistic' && rng.bool(style === 'exotic' ? 0.1 : 0.025)) return 'exotic'
  if (t > 1200) return rng.weighted([['lava', 45], ['hotjupiter', 25], ['barren', 15], ['chthonian', 15]] as const)
  if (t > 700) return rng.weighted([['barren', 35], ['lava', 25], ['toxic', 15], ['hotjupiter', index === 0 ? 15 : 4], ['desert', 10]] as const)
  if (aAU < hz.inner && t > 330) return rng.weighted([['toxic', 30], ['barren', 30], ['desert', 30], ['arid', 10]] as const)
  if (aAU >= hz.inner * 0.95 && aAU <= hz.outer * 1.05) {
    return rng.weighted([
      ['terran', 34], ['ocean', 18], ['jungle', 12], ['desert', 12], ['arid', 10], ['toxic', 6],
      ['city', style === 'realistic' ? 1 : 5],
    ] as const)
  }
  if (aAU < frost) return rng.weighted([['arid', 35], ['barren', 25], ['ice', 15], ['desert', 8], ['gas', 12], ['icegiant', 5]] as const)
  if (aAU < frost * 5) return rng.weighted([['gas', 45], ['icegiant', 28], ['ice', 15], ['barren', 12]] as const)
  return rng.weighted([['icegiant', 40], ['ice', 35], ['barren', 15], ['gas', 10]] as const)
}

const RADIUS_RANGE: Record<PlanetType, [number, number]> = {
  terran: [0.8, 1.4], ocean: [1.1, 2.2], jungle: [0.9, 1.5], desert: [0.6, 1.3], arid: [0.4, 0.9],
  ice: [0.3, 1.2], lava: [0.5, 1.6], barren: [0.25, 0.9], toxic: [0.8, 1.3], gas: [8, 14],
  icegiant: [3.2, 5.5], hotjupiter: [10, 16], chthonian: [1.2, 2.5], city: [0.9, 1.3], exotic: [0.7, 1.8],
}

function planetMass(rng: Rng, type: PlanetType, r: number) {
  if (type === 'gas') return rng.logRange(80, 1500)
  if (type === 'icegiant') return rng.range(9, 26)
  if (type === 'hotjupiter') return rng.logRange(150, 900)
  if (type === 'chthonian') return r * r * r * rng.range(1.4, 2.2)
  return r * r * r * rng.range(0.7, 1.15) * (r > 1.5 ? 1.25 : 1)
}

function makePlanetProps(rng: Rng, type: PlanetType, t: number, style: GeneratorStyle): PlanetProps {
  const p = planetPreset(type)
  const [r0, r1] = RADIUS_RANGE[type]
  p.radius = Number(rng.range(r0, r1).toFixed(2))
  p.mass = Number(planetMass(rng, type, p.radius).toPrecision(3))
  if (type === 'gas' || type === 'hotjupiter') {
    p.palette = varyPalette(type === 'gas' ? rng.pick(GAS_PALETTES) : p.palette, rng, 0.025)
    p.bands = rng.int(8, 22)
    p.storms = Number(rng.range(0.15, 0.8).toFixed(2))
    p.turbulence = Number(rng.range(0.35, 0.8).toFixed(2))
  } else if (type === 'icegiant') {
    p.palette = varyPalette(rng.pick(ICE_GIANT_PALETTES), rng, 0.02)
    p.bands = rng.int(4, 12)
    p.storms = Number(rng.range(0.05, 0.45).toFixed(2))
  } else {
    p.palette = varyPalette(p.palette, rng, type === 'exotic' ? 0.5 : 0.03)
    if ((type === 'terran' || type === 'jungle') && style !== 'realistic' && rng.bool(style === 'exotic' ? 0.5 : 0.15)) {
      const flora = rng.pick(ALIEN_FLORA)
      p.palette[2] = flora[0]
      p.palette[3] = mixHex(flora[1], p.palette[3], 0.5)
    }
    p.seaLevel = Math.min(0.95, Math.max(0, p.seaLevel + rng.range(-0.12, 0.12)))
    p.terrainScale = Number((p.terrainScale * rng.range(0.75, 1.35)).toFixed(2))
    p.relief = Math.min(1, Math.max(0.05, p.relief + rng.range(-0.15, 0.15)))
    p.craters = Math.min(1, Math.max(0, p.craters + rng.range(-0.15, 0.2)))
    if (['terran', 'ocean', 'jungle', 'arid', 'desert'].includes(type)) {
      p.iceCaps = Math.min(0.9, Math.max(0, (300 - t) / 160 + rng.range(-0.1, 0.1)))
    }
  }
  if (p.clouds.enabled) p.clouds.coverage = Math.min(0.97, Math.max(0.05, p.clouds.coverage + rng.range(-0.15, 0.15)))
  if (p.atmosphere.enabled) {
    p.atmosphere.density = Math.min(1, Math.max(0.05, p.atmosphere.density + rng.range(-0.12, 0.12)))
    p.atmosphere.color = adjustHex(p.atmosphere.color, rng.range(-0.03, 0.03))
  }
  p.albedo = Math.min(0.9, Math.max(0.03, p.albedo + rng.range(-0.06, 0.06)))
  return p
}

function equatorialOrbit(planet: Body, aAU: number, rng: Rng, extra: Partial<Orbit> = {}) {
  return defaultOrbit(Number(aAU.toPrecision(4)), {
    e: Number(rng.range(0, 0.04).toFixed(4)),
    i: Number((planet.rotation.tilt + rng.range(-1.5, 1.5)).toFixed(2)),
    node: Number((planet.rotation.azimuth + rng.range(-2, 2)).toFixed(1)),
    peri: rng.range(0, 360),
    m0: rng.range(0, 360),
    ...extra,
  })
}

class Builder {
  system: StarSystem
  private orderCounter = new Map<Id | null, number>()

  constructor(system: StarSystem) {
    this.system = system
  }

  add<B extends Body>(b: B): B {
    const n = (this.orderCounter.get(b.parentId) ?? 0) + 1
    this.orderCounter.set(b.parentId, n)
    b.order = n
    this.system.bodies[b.id] = b
    return b
  }
}

interface Host {
  body: Body
  name: string
  luminosity: number
  mass: number
  aMin: number
  aMax: number
}

function pickText(rng: Rng, list: string[] | undefined) {
  return list && list.length ? rng.pick(list) : ''
}

function populationText(rng: Rng, type: PlanetType): string {
  if (type === 'city') return `≈ ${num(rng.range(1.2, 9.5), 1)} milliards`
  const k = rng.float()
  if (k < 0.25) return `Avant-poste de ${rng.int(40, 600)} personnes`
  if (k < 0.7) return `≈ ${num(rng.int(2, 95) * 1000, 0)} colons`
  return `≈ ${num(rng.range(0.3, 12), 1)} millions`
}

export function generateSystem(opts: GeneratorOptions): StarSystem {
  const rng = new Rng(opts.seed)
  const names = new NameGen(rng.fork('names'))
  const style = opts.style
  const systemName = opts.name?.trim() || names.systemName()

  const system = createSystem(systemName, { seed: opts.seed, designation: names.designation() })
  system.calendar.epochYear = rng.int(2380, 2710)
  system.environment = environmentFromSeed(rng)
  const B = new Builder(system)

  const nStars =
    opts.stars === 'auto'
      ? rng.weighted(
          (style === 'exotic'
            ? [[1, 0.5], [2, 0.38], [3, 0.12]]
            : style === 'realistic'
              ? [[1, 0.6], [2, 0.32], [3, 0.08]]
              : [[1, 0.64], [2, 0.29], [3, 0.07]]) as [number, number][],
        )
      : opts.stars

  const primaryPick = pickStar(rng, style, opts.starClass)
  const primaryProps = makeStarProps(rng, primaryPick)

  const makeStar = (name: string, pick: StarPick, props: StarBody['props'], parentId: Id | null, orbit: Body['orbit']) =>
    B.add(
      createBody('star', {
        name,
        parentId,
        orbit,
        props,
        rotation: starRotation(rng, pick.cls),
        seed: rng.seed31(),
        notes: { description: starDescription(pick, props) },
      }),
    )

  const companionPick = (): { pick: StarPick; props: StarBody['props'] } => {
    for (let k = 0; k < 6; k++) {
      const pick = pickStar(rng, style === 'exotic' ? 'varied' : 'realistic')
      const props = makeStarProps(rng, pick)
      if (props.luminosity <= primaryProps.luminosity || k === 5) return { pick, props }
    }
    throw new Error('unreachable')
  }

  const hosts: Host[] = []
  const starList: StarBody[] = []
  const scaleOf = (lum: number) => Math.min(40, Math.max(0.25, Math.sqrt(lum)))

  if (nStars === 1) {
    const s = makeStar(systemName, primaryPick, primaryProps, null, null)
    starList.push(s)
    hosts.push({ body: s, name: systemName, luminosity: primaryProps.luminosity, mass: primaryProps.mass, aMin: 0, aMax: Infinity })
  } else {
    const close = nStars === 3 || rng.bool(0.55)
    if (close) {
      const comp = companionPick()
      const mA = primaryProps.mass
      const mB = comp.props.mass
      const sep = rng.range(0.14, 0.42) * Math.sqrt(mA + mB)
      const e = Number(rng.range(0, 0.25).toFixed(3))
      const peri = rng.range(0, 360)
      const i = rng.range(0, 6)
      const node = rng.range(0, 360)
      let outerBary: Body | null = null
      let wideA = 0
      if (nStars === 3) {
        outerBary = B.add(createBody('barycenter', { name: `${systemName} ABC`, seed: rng.seed31(), props: { showMarker: false } }))
      }
      const comp3 = nStars === 3 ? companionPick() : null
      let innerOrbit: Body['orbit'] = null
      if (comp3) {
        wideA = rng.range(40, 220) * Math.sqrt(mA + mB)
        const mC = comp3.props.mass
        innerOrbit = defaultOrbit(Number(((wideA * mC) / (mA + mB + mC)).toPrecision(4)), { e: 0.2, i: rng.range(0, 10), m0: 0, peri: 0 })
      }
      const bary = B.add(
        createBody('barycenter', {
          name: `${systemName} AB`,
          parentId: outerBary?.id ?? null,
          orbit: innerOrbit,
          seed: rng.seed31(),
          props: { showMarker: true },
        }),
      )
      const aA = (sep * mB) / (mA + mB)
      const aB = (sep * mA) / (mA + mB)
      const a = makeStar(`${systemName} A`, primaryPick, primaryProps, bary.id, defaultOrbit(Number(aA.toPrecision(4)), { e, peri, i, node, m0: 0 }))
      const b = makeStar(`${systemName} B`, comp.pick, comp.props, bary.id, defaultOrbit(Number(aB.toPrecision(4)), { e, peri: (peri + 180) % 360, i, node, m0: 0 }))
      starList.push(a, b)
      const lum = primaryProps.luminosity + comp.props.luminosity
      hosts.push({ body: bary, name: systemName, luminosity: lum, mass: mA + mB, aMin: sep * 3.5, aMax: comp3 ? wideA * 0.25 : Infinity })
      if (comp3 && outerBary) {
        const mC = comp3.props.mass
        const aC = (wideA * (mA + mB)) / (mA + mB + mC)
        const c = makeStar(`${systemName} C`, comp3.pick, comp3.props, outerBary.id, defaultOrbit(Number(aC.toPrecision(4)), { e: 0.2, i: rng.range(0, 10), m0: 0, peri: 180 }))
        starList.push(c)
        hosts.push({ body: c, name: `${systemName} C`, luminosity: comp3.props.luminosity, mass: mC, aMin: 0, aMax: wideA * 0.8 * 0.22 })
      }
    } else {
      const s = makeStar(`${systemName} A`, primaryPick, primaryProps, null, null)
      const comp = companionPick()
      const aB = Number((rng.range(45, 260) * Math.sqrt(primaryProps.mass + comp.props.mass)).toPrecision(3))
      const eB = Number(rng.range(0.1, 0.45).toFixed(2))
      const b = makeStar(`${systemName} B`, comp.pick, comp.props, s.id, defaultOrbit(aB, { e: eB, i: rng.range(0, 15), node: rng.range(0, 360), peri: rng.range(0, 360), m0: rng.range(0, 360) }))
      starList.push(s, b)
      hosts.push({ body: s, name: `${systemName}`, luminosity: primaryProps.luminosity, mass: primaryProps.mass, aMin: 0, aMax: aB * (1 - eB) * 0.3 })
      hosts.push({ body: b, name: `${systemName} B`, luminosity: comp.props.luminosity, mass: comp.props.mass, aMin: 0, aMax: aB * (1 - eB) * 0.22 })
    }
  }

  const [pMin, pMax] = opts.planets
  const totalPlanets = rng.int(Math.min(pMin, pMax), Math.max(pMin, pMax))
  const planets: PlanetBody[] = []
  const belts: { host: Host; body: Body; mid: number }[] = []
  const colonized: PlanetBody[] = []
  let outermost = 0

  hosts.forEach((host, hi) => {
    const count = hi === 0 ? Math.max(0, totalPlanets - (hosts.length > 1 ? rng.int(0, 2) : 0)) : rng.int(0, Math.min(3, Math.ceil(totalPlanets / 3)))
    const L = host.luminosity
    const scale = scaleOf(L)
    const hz = habitableZone(Math.max(L, 1e-4))
    const frost = frostLine(Math.max(L, 1e-4))
    let a = Math.max(host.aMin * 1.1, rng.range(0.03, 0.32) * scale, (host.body.kind === 'star' && host.body.props.starClass === 'BH' ? 0.4 : 0))
    let beltPlaced = !opts.belts
    let index = 0
    for (let k = 0; k < count; k++) {
      if (a > host.aMax || a > 140 * scale) break
      if (!beltPlaced && a > frost * 0.75 && k > 0 && rng.bool(0.55)) {
        beltPlaced = true
        const inner = a * 0.92
        const outer = a * rng.range(1.3, 1.6)
        const belt = B.add(
          createBody('belt', {
            name: rng.bool(0.5) ? 'Ceinture principale' : `Ceinture de ${names.systemName()}`,
            parentId: host.body.id,
            seed: rng.seed31(),
            props: {
              inner: Number(inner.toPrecision(3)),
              outer: Number(outer.toPrecision(3)),
              count: rng.int(2000, 4200),
              thickness: Number(rng.range(0.03, 0.09).toFixed(3)),
              dust: Number(rng.range(0.25, 0.65).toFixed(2)),
              clumping: rng.bool(0.25) ? 0.5 : 0,
              colorA: adjustHex('#8a7f72', rng.range(-0.04, 0.04), 0, rng.range(-0.05, 0.05)),
              inclination: Number(rng.range(0, 3).toFixed(1)),
              node: rng.range(0, 360),
            },
            notes: { resources: 'Métaux, glaces, silicates', hazards: 'Collisions, débris' },
          }),
        )
        belts.push({ host, body: belt, mid: (inner + outer) / 2 })
        a = outer * rng.range(1.25, 1.55)
        if (a > host.aMax) break
      }
      const t = equilibriumTemperature(Math.max(L, 1e-4), a, 0.3)
      const type = chooseType(rng, t, a, hz, frost, style, k)
      const props = makePlanetProps(rng, type, t, style)
      const giant = isGiant(type)
      const e = Number((rng.bool(0.15) ? rng.range(0.08, 0.28) : rng.range(0, 0.07)).toFixed(3))
      const locked = !giant && (a < 0.08 * scale || (t > 900 && rng.bool(0.6)))
      const tilt = rng.bool(0.05) ? rng.range(90, 180) : Math.min(80, Math.abs(rng.gaussian(0, 18)))
      if (props.rings.enabled === false && rng.bool(giant ? (type === 'icegiant' ? 0.5 : 0.38) : 0.03)) {
        const inner = rng.range(1.2, 1.6)
        props.rings = {
          enabled: true,
          inner: Number(inner.toFixed(2)),
          outer: Number((inner + rng.range(0.3, giant ? 1.2 : 0.5)).toFixed(2)),
          colorA: mixHex(props.palette[1], '#e8e0d0', 0.45),
          colorB: mixHex(props.palette[3], '#5a5048', 0.45),
          opacity: Number(rng.range(giant ? 0.45 : 0.25, type === 'icegiant' ? 0.55 : 0.92).toFixed(2)),
          bands: Number(rng.range(0.4, 0.95).toFixed(2)),
          tilt: 0,
        }
      }
      const name = names.planetName(host.name, index)
      const isHab = a >= hz.inner && a <= hz.outer
      const planet = B.add(
        createBody('planet', {
          name,
          parentId: host.body.id,
          orbit: defaultOrbit(Number(a.toPrecision(4)), {
            e,
            i: Number(rng.range(0, 3.5).toFixed(2)),
            node: Number(rng.range(0, 360).toFixed(1)),
            peri: Number(rng.range(0, 360).toFixed(1)),
            m0: Number(rng.range(0, 360).toFixed(1)),
          }),
          rotation: locked
            ? { period: 0, locked: true, tilt: rng.range(0, 3) }
            : { period: Number((giant ? rng.range(8, 18) : rng.range(14, 60)).toFixed(2)) * (rng.bool(0.06) ? -1 : 1), tilt: Number(tilt.toFixed(2)), azimuth: Number(rng.range(0, 360).toFixed(1)) },
          props,
          seed: rng.seed31(),
          notes: {
            description: pickText(rng, DESCRIPTIONS[type]) + (isHab && ['terran', 'ocean', 'jungle'].includes(type) ? ' Dans la zone habitable.' : ''),
            atmosphere: pickText(rng, ATMOSPHERES[type]),
            hazards: pickText(rng, HAZARDS[type]),
            resources: pickText(rng, RESOURCES[type]),
          },
        }),
      )
      planets.push(planet)
      index++
      outermost = Math.max(outermost, hi === 0 ? a * (1 + e) : 0)

      const habitable = ['terran', 'ocean', 'jungle', 'city'].includes(type) || (type === 'desert' && isHab)
      if (opts.stations && (type === 'city' || (habitable && rng.bool(0.72)) || (!habitable && !giant && rng.bool(0.12)))) {
        planet.notes.population = populationText(rng, type)
        planet.notes.faction = rng.bool(0.6) ? names.corporation() : names.faction()
        planet.notes.rumors = rng.pick(RUMORS)
        if (rng.bool(0.6)) planet.notes.gm = rng.pick(SECRETS)
        colonized.push(planet)
      }

      if (opts.moons) addMoons(B, rng, names, planet, host, a, t, hz, style)

      a *= rng.range(1.38, 2.05) * (k === 0 && rng.bool(0.3) ? 1.3 : 1)
    }

    if (opts.belts && hi === 0 && rng.bool(0.55)) {
      const inner = Math.max(a * 0.95, frost * 6)
      if (inner < host.aMax) {
        const outer = inner * rng.range(1.4, 1.9)
        const kuiper = B.add(
          createBody('belt', {
            name: rng.bool(0.5) ? 'Ceinture de Kuiper' : `Nuage de ${names.systemName()}`,
            parentId: host.body.id,
            seed: rng.seed31(),
            props: {
              beltType: 'kuiper',
              inner: Number(inner.toPrecision(3)),
              outer: Number(outer.toPrecision(3)),
              count: rng.int(2400, 4500),
              thickness: Number(rng.range(0.08, 0.16).toFixed(3)),
              dust: Number(rng.range(0.2, 0.5).toFixed(2)),
              colorA: '#9aa7b8',
              colorB: '#5c6678',
              dustColor: '#8fb2d8',
              inclination: Number(rng.range(0, 6).toFixed(1)),
              node: rng.range(0, 360),
            },
            notes: { resources: 'Glaces, composés volatils', description: 'Réservoir glacé de corps mineurs.' },
          }),
        )
        belts.push({ host, body: kuiper, mid: (inner + outer) / 2 })
        outermost = Math.max(outermost, outer)
      }
    }
  })

  const main = hosts[0]
  if (!outermost) outermost = Math.max(2, 4 * scaleOf(main.luminosity))
  const year = system.calendar.epochYear

  if (opts.comets) {
    const n = rng.weighted([[0, 0.3], [1, 0.4], [2, 0.2], [3, 0.1]] as [number, number][])
    for (let k = 0; k < n; k++) {
      const a = rng.range(outermost * 0.35, outermost * 1.1)
      const retro = rng.bool(0.2)
      B.add(
        createBody('comet', {
          name: names.comet(year - rng.int(0, 60)),
          parentId: main.body.id,
          seed: rng.seed31(),
          orbit: defaultOrbit(Number(a.toPrecision(3)), {
            e: Number(rng.range(0.72, 0.97).toFixed(3)),
            i: Number((retro ? rng.range(110, 170) : rng.range(3, 60)).toFixed(1)),
            node: rng.range(0, 360),
            peri: rng.range(0, 360),
            m0: rng.range(0, 360),
          }),
          props: {
            tailLength: Number(rng.range(0.7, 1.6).toFixed(2)),
            activity: Number(rng.range(0.7, 1.5).toFixed(2)),
            ionColor: rng.pick(['#5ab4ff', '#6ad0ff', '#7a9aff']),
          },
          notes: { description: 'Comète périodique, noyau sombre de glace et de poussière.', resources: 'Glace d’eau, composés organiques' },
        }),
      )
    }
  }

  const stations: Body[] = []
  if (opts.stations) {
    for (const planet of colonized) {
      if (!rng.bool(planet.props.planetType === 'city' ? 0.95 : 0.6)) continue
      const rKm = planet.props.radius * EARTH_KM
      const type = rng.weighted([['ring', 45], ['modular', 25], ['spindle', planet.props.planetType === 'city' ? 25 : 8], ['shipyard', 8]] as [StationType, number][])
      const minR = planet.props.rings.enabled ? planet.props.rings.outer * 1.15 : 1.15
      const st = B.add(
        createBody('station', {
          name: names.station(type === 'shipyard' ? 'Chantier' : type === 'ring' ? 'Anneau' : undefined),
          parentId: planet.id,
          seed: rng.seed31(),
          orbit: defaultOrbit(Number((rKm * rng.range(minR, minR + 0.6) * AU_PER_KM).toPrecision(4)), {
            i: rng.range(0, 30),
            node: rng.range(0, 360),
            m0: rng.range(0, 360),
          }),
          props: { stationType: type, size: Number(rng.range(0.9, 1.5).toFixed(2)), lengthM: rng.int(400, 4000) },
          notes: {
            description: pickText(rng, STATION_DESC[type]),
            population: `${num(rng.int(3, 90) * 100, 0)}`,
            faction: planet.notes.faction || names.corporation(),
          },
        }),
      )
      stations.push(st)
    }
    for (const belt of belts) {
      const n = rng.weighted([[0, 0.25], [1, 0.5], [2, 0.25]] as [number, number][])
      for (let k = 0; k < n; k++) {
        const type = rng.weighted([['outpost', 50], ['refinery', 35], ['modular', 15]] as [StationType, number][])
        const st = B.add(
          createBody('station', {
            name: names.station(type === 'outpost' ? rng.pick(['Forage', 'Avant-poste', 'Poste']) : type === 'refinery' ? 'Raffinerie' : undefined),
            parentId: belt.host.body.id,
            seed: rng.seed31(),
            orbit: defaultOrbit(Number((belt.mid * rng.range(0.92, 1.08)).toPrecision(4)), { i: rng.range(0, 3), node: rng.range(0, 360), m0: rng.range(0, 360) }),
            props: { stationType: type, size: Number(rng.range(1, 1.6).toFixed(2)), lengthM: rng.int(200, 1800) },
            notes: {
              description: pickText(rng, STATION_DESC[type]),
              population: `${num(rng.int(12, 600), 0)}`,
              faction: names.corporation(),
              hazards: 'Accidents de forage, radiations',
              rumors: rng.bool(0.6) ? rng.pick(RUMORS) : '',
              gm: rng.bool(0.4) ? rng.pick(SECRETS) : '',
            },
          }),
        )
        stations.push(st)
      }
    }
    for (const planet of planets) {
      if (!isGiant(planet.props.planetType) || !rng.bool(0.35)) continue
      const rKm = planet.props.radius * EARTH_KM
      const minR = planet.props.rings.enabled ? planet.props.rings.outer * 1.2 : 1.3
      stations.push(
        B.add(
          createBody('station', {
            name: names.station('Raffinerie'),
            parentId: planet.id,
            seed: rng.seed31(),
            orbit: defaultOrbit(Number((rKm * rng.range(minR, minR + 0.5) * AU_PER_KM).toPrecision(4)), { i: planet.rotation.tilt, node: planet.rotation.azimuth, m0: rng.range(0, 360) }),
            props: { stationType: 'refinery', size: 1.2, lengthM: rng.int(600, 2400) },
            notes: { description: 'Plateforme d’écopage d’hélium-3 et de deutérium.', faction: names.corporation(), population: `${num(rng.int(40, 400), 0)}` },
          }),
        ),
      )
    }
    const nShips = rng.int(0, Math.min(3, Math.max(1, planets.length - 1)))
    const mainPlanets = planets.filter((p) => p.parentId === main.body.id && p.orbit)
    for (let k = 0; k < nShips && mainPlanets.length >= 2; k++) {
      const i1 = rng.int(0, mainPlanets.length - 2)
      const p1 = mainPlanets[i1].orbit!.a
      const p2 = mainPlanets[Math.min(mainPlanets.length - 1, i1 + rng.int(1, 2))].orbit!.a
      const shipType = rng.weighted([['freighter', 40], ['hauler', 25], ['miner', 15], ['corvette', 10], ['shuttle', 10]] as const)
      B.add(
        createBody('ship', {
          name: names.ship(),
          parentId: main.body.id,
          seed: rng.seed31(),
          orbit: defaultOrbit(Number(((p1 + p2) / 2).toPrecision(4)), {
            e: Number((Math.abs(p2 - p1) / (p2 + p1)).toFixed(3)),
            i: rng.range(0, 3),
            node: rng.range(0, 360),
            peri: rng.range(0, 360),
            m0: rng.range(0, 360),
          }),
          props: { shipType, size: Number(rng.range(0.9, 1.4).toFixed(2)), transponder: `${rng.pick(['KX', 'HB', 'MR', 'VQ'])}-${rng.int(1000, 9999)}`, lengthM: rng.int(60, 420) },
          notes: {
            description: rng.pick(['Cargo en transit, minerai et pièces détachées.', 'Transport de colons sous cryo-sommeil.', 'Remorqueur de conteneurs.', 'Patrouille corporatiste.']),
            population: `Équipage : ${rng.int(3, 24)}`,
            faction: names.corporation(),
          },
        }),
      )
    }
    if (stations.length >= 2 && rng.bool(0.6)) {
      const [s1, s2] = rng.shuffle([...stations]).slice(0, 2)
      const route = createRoute(s1.id, s2.id, { name: `Ligne ${s1.name.split(' ').pop()}–${s2.name.split(' ').pop()}`, traffic: rng.int(1, 3) })
      system.routes[route.id] = route
    }
  }

  if (opts.derelicts) {
    const n = rng.weighted((style === 'exotic' ? [[0, 0.1], [1, 0.4], [2, 0.35], [3, 0.15]] : [[0, 0.3], [1, 0.45], [2, 0.25]]) as [number, number][])
    for (let k = 0; k < n; k++) {
      const kind = rng.weighted([['ship', 35], ['distress', 25], ['anomaly', style === 'realistic' ? 8 : 20], ['station', 12], ['derelict', 8]] as const)
      const anchor = planets.length && rng.bool(0.35) ? rng.pick(planets) : null
      const a = anchor
        ? anchor.props.radius * EARTH_KM * rng.range(2, 6) * AU_PER_KM
        : rng.range(Math.max(0.3, outermost * 0.15), outermost * 0.95)
      const parentId = anchor?.id ?? main.body.id
      const fixed = kind !== 'ship' && kind !== 'station'
      const orbit = defaultOrbit(Number(a.toPrecision(4)), { fixed, show: false, i: rng.range(-12, 12), node: rng.range(0, 360), m0: rng.range(0, 360), e: fixed ? 0 : rng.range(0, 0.2) })
      if (kind === 'ship') {
        B.add(
          createBody('ship', {
            name: `Épave du ${names.ship()}`,
            parentId,
            orbit,
            seed: rng.seed31(),
            playerVisible: false,
            props: { shipType: 'derelict', damaged: true, thrusting: false, trail: false, lengthM: rng.int(80, 600) },
            notes: { description: 'Épave dérivante, transpondeur muet.', gm: rng.pick(DERELICT_GM), hazards: 'Coque instable, vide, radiations' },
          }),
        )
      } else if (kind === 'station') {
        B.add(
          createBody('station', {
            name: `${names.station()} (abandonnée)`,
            parentId,
            orbit,
            seed: rng.seed31(),
            playerVisible: false,
            props: { stationType: 'derelict', damaged: true, lengthM: rng.int(400, 2000) },
            notes: { description: pickText(rng, STATION_DESC.derelict), gm: rng.pick(DERELICT_GM), hazards: 'Systèmes de survie hors service' },
          }),
        )
      } else {
        const markerType: MarkerType = kind === 'distress' ? 'distress' : kind === 'anomaly' ? 'anomaly' : 'derelict'
        B.add(
          createBody('marker', {
            name: markerType === 'distress' ? 'Signal de détresse' : markerType === 'anomaly' ? 'Anomalie' : 'Épave non identifiée',
            parentId,
            orbit,
            seed: rng.seed31(),
            playerVisible: markerType === 'distress' ? rng.bool(0.5) : false,
            props: { markerType, code: markerType === 'distress' ? 'SOS' : markerType === 'anomaly' ? `X-${rng.int(1, 99)}` : '' },
            notes: { gm: markerType === 'anomaly' ? rng.pick(ANOMALY_GM) : rng.pick(DERELICT_GM) },
          }),
        )
      }
    }
  }

  if (opts.gates && rng.bool(style === 'exotic' ? 0.8 : 0.6)) {
    const dest = names.systemName()
    B.add(
      createBody('gate', {
        name: names.gate(),
        parentId: main.body.id,
        seed: rng.seed31(),
        orbit: defaultOrbit(Number((outermost * rng.range(1.15, 1.45)).toPrecision(3)), { fixed: true, show: false, m0: rng.range(0, 360), i: rng.range(-8, 8) }),
        props: {
          gateType: rng.weighted([['ring', 70], ['anomaly', style === 'realistic' ? 5 : 20], ['beacon', 15]] as const),
          size: Number(rng.range(1.6, 2.6).toFixed(2)),
          destination: dest,
        },
        notes: { description: `Point de saut vers le système ${dest}.`, faction: rng.bool(0.5) ? 'Autorité Coloniale' : names.faction() },
      }),
    )
  }

  if (opts.nebula) {
    const env = system.environment
    const nebulaType = rng.weighted([['emission', 40], ['reflection', 20], ['cloud', 20], ['remnant', primaryPick.cls === 'NS' || primaryPick.cls === 'PSR' || primaryPick.cls === 'BH' ? 40 : 8], ['planetary', primaryPick.cls === 'WD' ? 40 : 4], ['dark', 8]] as [NebulaType, number][])
    B.add(
      createBody('nebula', {
        name: `${rng.pick(['Voile', 'Nuée', 'Brume', 'Linceul', 'Nuage'])} de ${names.systemName()}`,
        parentId: null,
        seed: rng.seed31(),
        orbit: defaultOrbit(Number(Math.max(30, outermost * rng.range(1.6, 2.6)).toPrecision(3)), { fixed: true, show: false, m0: rng.range(0, 360), i: rng.range(-25, 25) }),
        props: {
          nebulaType,
          size: Math.round(rng.range(35, 85)),
          colors: [adjustHex(env.nebulaColor, 0, 0.3, 0.32), adjustHex(env.nebulaColor2, 0, 0.3, 0.3), hslHex(rng.float(), 0.7, 0.75)],
          density: Number(rng.range(0.45, 0.8).toFixed(2)),
          puffs: rng.int(90, 180),
          turbulence: Number(rng.range(0.4, 0.8).toFixed(2)),
          shape: [1, Number(rng.range(0.4, 0.8).toFixed(2)), Number(rng.range(0.6, 1).toFixed(2))],
          rotation: [rng.range(0, 360), rng.range(0, 360), rng.range(0, 360)],
          stars: rng.int(4, 24),
        },
        notes: { hazards: 'Interférences capteurs, ionisation', description: 'Nuage de gaz et de poussière aux reflets changeants.' },
      }),
    )
  }

  const habCount = planets.filter((p) => ['terran', 'ocean', 'jungle', 'city'].includes(p.props.planetType)).length
  const starsLabel = starList.length === 1 ? spectralLabel(starList[0].props) : `${starList.length} étoiles (${starList.map((s) => spectralLabel(s.props)).join(', ')})`
  const flavour = rng.pick([
    'Peu de trafic, beaucoup de rumeurs.',
    'Les corporations s’y disputent chaque gramme de minerai.',
    'Un système oublié des cartes officielles.',
    'Dernière escale avant le grand vide.',
    'Les équipages évitent de s’y attarder.',
    'Les balises de navigation y sont étrangement silencieuses.',
  ])
  system.description = `${starsLabel}. ${planets.length} planète${planets.length > 1 ? 's' : ''}${habCount ? `, dont ${habCount} habitable${habCount > 1 ? 's' : ''}` : ''}. ${flavour}`
  return system
}

function addMoons(
  B: Builder,
  rng: Rng,
  names: NameGen,
  planet: PlanetBody,
  host: Host,
  aPlanet: number,
  t: number,
  hz: { inner: number; outer: number },
  style: GeneratorStyle,
) {
  const type = planet.props.planetType
  const giant = isGiant(type)
  let n = 0
  if (type === 'gas') n = rng.int(2, 7)
  else if (type === 'icegiant') n = rng.int(1, 5)
  else if (type === 'hotjupiter') n = rng.int(0, 1)
  else if (planet.props.radius > 0.7) n = rng.weighted([[0, 0.5], [1, 0.35], [2, 0.15]] as [number, number][])
  else n = rng.bool(0.25) ? rng.int(1, 2) : 0
  if (!n) return
  const rKm = planet.props.radius * EARTH_KM
  const hillAU = aPlanet * (1 - (planet.orbit?.e ?? 0)) * Math.cbrt(planet.props.mass / 332_946 / (3 * host.mass))
  let nr = planet.props.rings.enabled ? planet.props.rings.outer * rng.range(1.3, 1.6) : rng.range(2.6, 6)
  const inHz = aPlanet >= hz.inner && aPlanet <= hz.outer
  for (let k = 0; k < n; k++) {
    const aAU = nr * rKm * AU_PER_KM
    if (aAU > hillAU * 0.45) break
    let mtype: PlanetType = 'barren'
    const big = giant && rng.bool(0.4)
    if (giant && inHz && big && rng.bool(0.35)) mtype = rng.weighted([['terran', 55], ['ocean', 25], ['jungle', 20]] as const)
    else if (giant && k === 0 && rng.bool(0.15)) mtype = 'lava'
    else if (t < 160) mtype = rng.weighted([['ice', 50], ['barren', 40], ['toxic', big ? 15 : 0]] as const)
    else if (style === 'exotic' && rng.bool(0.08)) mtype = 'exotic'
    const props = moonPreset(mtype)
    props.radius = Number((giant ? (big ? rng.range(0.25, 0.48) : rng.logRange(0.02, 0.25)) : rng.range(0.08, 0.3) * planet.props.radius).toFixed(3))
    props.mass = Number((props.radius ** 3 * rng.range(0.35, 0.8)).toPrecision(3))
    props.palette = varyPalette(props.palette, rng, 0.04)
    if (mtype === 'toxic') {
      props.atmosphere.color = '#e8a050'
      props.clouds.color = '#d8a060'
    }
    const retro = giant && k >= 3 && rng.bool(0.25)
    const moon = B.add(
      createBody('moon', {
        name: names.moonName(planet.name, k),
        parentId: planet.id,
        seed: rng.seed31(),
        orbit: equatorialOrbit(planet, aAU, rng, retro ? { retrograde: true, i: rng.range(20, 60) } : {}),
        rotation: { period: 0, locked: !retro, tilt: rng.range(0, 3) },
        props,
        notes: {
          description: pickText(rng, DESCRIPTIONS[mtype]),
          atmosphere: pickText(rng, ATMOSPHERES[mtype]),
          hazards: pickText(rng, HAZARDS[mtype]),
          resources: pickText(rng, RESOURCES[mtype]),
        },
      }),
    )
    if (retro) moon.rotation.period = rng.range(10, 60)
    nr *= rng.range(1.45, 2.0)
  }
}

function starDescription(pick: StarPick, p: StarBody['props']): string {
  switch (pick.cls) {
    case 'BH':
      return `Trou noir de ${num(p.mass, 1)} masses solaires, ceinturé d’un disque d’accrétion incandescent.`
    case 'PSR':
      return 'Pulsar : cadavre stellaire tournant sur lui-même, balayant le système de ses faisceaux.'
    case 'NS':
      return 'Étoile à neutrons, minuscule et d’une densité inimaginable.'
    case 'WD':
      return 'Naine blanche, braise éteinte d’une ancienne étoile.'
    case 'BD':
      return 'Naine brune, étoile avortée à la lueur pourpre.'
    default:
      if (pick.lum === 'Ia' || pick.lum === 'Ib') return 'Supergéante instable, promise à une fin violente.'
      if (pick.lum === 'III' || pick.lum === 'II') return 'Géante en fin de vie, enflée et rougeoyante.'
      return `Étoile de type ${pick.cls}${pick.sub}, ${num(p.luminosity)} fois la luminosité du Soleil.`
  }
}

function environmentFromSeed(rng: Rng): EnvironmentSettings {
  const h = rng.float()
  return {
    starDensity: Number(rng.range(0.45, 0.85).toFixed(2)),
    milkyWay: Number(rng.range(0.3, 0.85).toFixed(2)),
    milkyWayTilt: Math.round(rng.range(-60, 60)),
    nebulaColor: hslHex(h, rng.range(0.35, 0.6), rng.range(0.2, 0.3)),
    nebulaColor2: hslHex(h + rng.range(0.2, 0.5), rng.range(0.35, 0.6), rng.range(0.16, 0.26)),
    nebulaIntensity: Number(rng.range(0.15, 0.55).toFixed(2)),
    ambient: 0.04,
    seed: rng.int(1, 999999),
  }
}

export interface SystemSummary {
  stars: string[]
  counts: Partial<Record<BodyKind, number>>
  habitable: number
  planetTypes: { type: PlanetType; color: Hex; radius: number }[]
}

export function summarizeSystem(system: StarSystem): SystemSummary {
  const counts: Partial<Record<BodyKind, number>> = {}
  const planetTypes: SystemSummary['planetTypes'] = []
  const stars: string[] = []
  let habitable = 0
  const bodies = Object.values(system.bodies).sort((a, b) => (a.orbit?.a ?? 0) - (b.orbit?.a ?? 0))
  for (const b of bodies) {
    counts[b.kind] = (counts[b.kind] ?? 0) + 1
    if (b.kind === 'star') stars.push(spectralLabel(b.props))
    if (b.kind === 'planet') {
      planetTypes.push({ type: b.props.planetType, color: b.props.palette[2], radius: b.props.radius })
      if (['terran', 'ocean', 'jungle', 'city'].includes(b.props.planetType)) habitable++
    }
  }
  return { stars, counts, habitable, planetTypes }
}
