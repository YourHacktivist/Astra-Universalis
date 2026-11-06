import type {
  BeltType,
  BodyKind,
  GalaxyRouteKind,
  GalaxyShape,
  GateType,
  LuminosityClass,
  MarkerType,
  NebulaType,
  PlanetType,
  RouteKind,
  ScaleMode,
  ShipType,
  StarClass,
  StationType,
} from './types'

export const KIND_LABEL: Record<BodyKind, string> = {
  star: 'Étoile',
  barycenter: 'Barycentre',
  planet: 'Planète',
  moon: 'Lune',
  belt: 'Ceinture',
  nebula: 'Nébuleuse',
  comet: 'Comète',
  station: 'Station',
  ship: 'Vaisseau',
  gate: 'Portail',
  marker: 'Marqueur',
}

export const KIND_LABEL_PLURAL: Record<BodyKind, string> = {
  star: 'Étoiles',
  barycenter: 'Barycentres',
  planet: 'Planètes',
  moon: 'Lunes',
  belt: 'Ceintures',
  nebula: 'Nébuleuses',
  comet: 'Comètes',
  station: 'Stations',
  ship: 'Vaisseaux',
  gate: 'Portails',
  marker: 'Marqueurs',
}

export const STAR_CLASS_LABEL: Record<StarClass, string> = {
  O: 'O · bleue, très massive',
  B: 'B · bleu-blanc',
  A: 'A · blanche',
  F: 'F · blanc-jaune',
  G: 'G · jaune (type Soleil)',
  K: 'K · orange',
  M: 'M · rouge',
  BD: 'Naine brune',
  WD: 'Naine blanche',
  NS: 'Étoile à neutrons',
  PSR: 'Pulsar',
  BH: 'Trou noir',
}

export const LUM_CLASS_LABEL: Record<LuminosityClass, string> = {
  V: 'V · séquence principale',
  IV: 'IV · sous-géante',
  III: 'III · géante',
  II: 'II · géante lumineuse',
  Ib: 'Ib · supergéante',
  Ia: 'Ia · hypergéante',
}

export const PLANET_TYPE_LABEL: Record<PlanetType, string> = {
  terran: 'Tellurique tempérée',
  ocean: 'Monde océan',
  jungle: 'Monde jungle',
  desert: 'Désertique',
  arid: 'Aride (type Mars)',
  ice: 'Monde de glace',
  lava: 'Monde de lave',
  barren: 'Stérile (type Lune)',
  toxic: 'Toxique (type Vénus)',
  gas: 'Géante gazeuse',
  icegiant: 'Géante de glace',
  hotjupiter: 'Jupiter chaud',
  chthonian: 'Chthonienne',
  city: 'Œcuménopole',
  exotic: 'Exotique',
}

export const BELT_TYPE_LABEL: Record<BeltType, string> = {
  asteroid: "Ceinture d'astéroïdes",
  kuiper: 'Ceinture de Kuiper',
  debris: 'Disque de débris',
  ice: 'Anneau de glace',
  dust: 'Nuage de poussière',
}

export const NEBULA_TYPE_LABEL: Record<NebulaType, string> = {
  emission: "Nébuleuse d'émission",
  reflection: 'Nébuleuse par réflexion',
  dark: 'Nébuleuse obscure',
  planetary: 'Nébuleuse planétaire',
  remnant: 'Rémanent de supernova',
  cloud: 'Nuage de gaz',
}

export const STATION_TYPE_LABEL: Record<StationType, string> = {
  ring: 'Station en anneau',
  modular: 'Station modulaire',
  spindle: "Cylindre d'O'Neill",
  outpost: 'Avant-poste',
  shipyard: 'Chantier spatial',
  refinery: 'Raffinerie',
  derelict: 'Station abandonnée',
}

export const SHIP_TYPE_LABEL: Record<ShipType, string> = {
  freighter: 'Cargo',
  corvette: 'Corvette',
  hauler: 'Remorqueur',
  shuttle: 'Navette',
  miner: 'Vaisseau minier',
  cruiser: 'Croiseur',
  derelict: 'Épave',
}

export const GATE_TYPE_LABEL: Record<GateType, string> = {
  ring: 'Portail annulaire',
  anomaly: 'Anomalie de saut',
  beacon: 'Balise de saut',
}

export const MARKER_TYPE_LABEL: Record<MarkerType, string> = {
  poi: "Point d'intérêt",
  distress: 'Balise de détresse',
  derelict: 'Épave',
  anomaly: 'Anomalie',
  danger: 'Danger',
  outpost: 'Avant-poste',
  cache: 'Cache',
  combat: 'Zone de combat',
  unknown: 'Signal inconnu',
}

export const ROUTE_KIND_LABEL: Record<RouteKind, string> = {
  trade: 'Route commerciale',
  patrol: 'Patrouille',
  transfer: 'Transfert orbital',
  danger: 'Zone dangereuse',
  smuggling: 'Contrebande',
  custom: 'Personnalisée',
}

export const SCALE_MODE_LABEL: Record<ScaleMode, string> = {
  linear: 'Linéaire (réaliste)',
  compressed: 'Compressée',
  log: 'Logarithmique',
}

export const GALAXY_SHAPE_LABEL: Record<GalaxyShape, string> = {
  spiral: 'Spirale',
  barred: 'Spirale barrée',
  elliptical: 'Elliptique',
  ring: 'Annulaire',
  irregular: 'Irrégulière',
}

export const GALAXY_ROUTE_LABEL: Record<GalaxyRouteKind, string> = {
  jump: 'Route de saut',
  trade: 'Route commerciale',
  danger: 'Passage dangereux',
  unknown: 'Route non cartographiée',
}
