import {
  BELT_TYPE_LABEL,
  GATE_TYPE_LABEL,
  LUM_CLASS_LABEL,
  MARKER_TYPE_LABEL,
  NEBULA_TYPE_LABEL,
  PLANET_TYPE_LABEL,
  ROUTE_KIND_LABEL,
  SCALE_MODE_LABEL,
  SHIP_TYPE_LABEL,
  STAR_CLASS_LABEL,
  STATION_TYPE_LABEL,
} from '@/core/labels'
import type { PlanetType } from '@/core/types'
import type { SelectOption } from '../kit'

function opts<T extends string>(labels: Record<T, string>, groups?: Partial<Record<T, string>>): SelectOption<T>[] {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value], group: groups?.[value] }))
}

export const STAR_CLASS_OPTIONS = opts(STAR_CLASS_LABEL, {
  O: 'Séquence principale & géantes',
  B: 'Séquence principale & géantes',
  A: 'Séquence principale & géantes',
  F: 'Séquence principale & géantes',
  G: 'Séquence principale & géantes',
  K: 'Séquence principale & géantes',
  M: 'Séquence principale & géantes',
  BD: 'Objets compacts & exotiques',
  WD: 'Objets compacts & exotiques',
  NS: 'Objets compacts & exotiques',
  PSR: 'Objets compacts & exotiques',
  BH: 'Objets compacts & exotiques',
})
export const LUM_CLASS_OPTIONS = opts(LUM_CLASS_LABEL)
export const PLANET_TYPE_OPTIONS = opts(PLANET_TYPE_LABEL, {
  terran: 'Telluriques',
  ocean: 'Telluriques',
  jungle: 'Telluriques',
  desert: 'Telluriques',
  arid: 'Telluriques',
  ice: 'Telluriques',
  lava: 'Telluriques',
  barren: 'Telluriques',
  toxic: 'Telluriques',
  gas: 'Géantes',
  icegiant: 'Géantes',
  hotjupiter: 'Géantes',
  chthonian: 'Exotiques',
  city: 'Exotiques',
  exotic: 'Exotiques',
})
export const BELT_TYPE_OPTIONS = opts(BELT_TYPE_LABEL)
export const NEBULA_TYPE_OPTIONS = opts(NEBULA_TYPE_LABEL)
export const STATION_TYPE_OPTIONS = opts(STATION_TYPE_LABEL)
export const SHIP_TYPE_OPTIONS = opts(SHIP_TYPE_LABEL)
export const GATE_TYPE_OPTIONS = opts(GATE_TYPE_LABEL)
export const MARKER_TYPE_OPTIONS = opts(MARKER_TYPE_LABEL)
export const ROUTE_KIND_OPTIONS = opts(ROUTE_KIND_LABEL)
export const SCALE_MODE_OPTIONS = opts(SCALE_MODE_LABEL)

export const PALETTE_LABELS: Record<PlanetType, [string, string, string, string, string]> = {
  terran: ['Océan profond', 'Hauts-fonds', 'Basses terres', 'Reliefs', 'Neiges'],
  ocean: ['Abysses', 'Hauts-fonds', 'Îles', 'Plages', 'Sommets'],
  jungle: ['Eaux profondes', 'Eaux claires', 'Jungle dense', 'Canopée', 'Hauts plateaux'],
  desert: ['Dunes sombres', 'Sable', 'Sable clair', 'Roche', 'Salines'],
  arid: ['Basalte', 'Rouille', 'Ocre', 'Hautes terres', 'Givre polaire'],
  ice: ['Failles', 'Glace bleue', 'Glace blanche', 'Givre', 'Neige fraîche'],
  lava: ['Croûte sombre', 'Croûte', 'Cendres', 'Magma', 'Incandescence'],
  barren: ['Mers sombres', 'Gris moyen', 'Hautes terres', 'Bords de cratères', 'Éjectas'],
  toxic: ['Brume basse', 'Nuages moyens', 'Nuages hauts', 'Bandes', 'Brume claire'],
  gas: ['Bande 1', 'Bande 2', 'Bande 3', 'Bande 4', 'Tempêtes'],
  icegiant: ['Bande 1', 'Bande 2', 'Bande 3', 'Bande 4', 'Tempêtes'],
  hotjupiter: ['Bande 1', 'Bande 2', 'Bande 3', 'Bande 4', 'Tempêtes ardentes'],
  chthonian: ['Roche sombre', 'Roche', 'Brûlures', 'Fissures', 'Points chauds'],
  city: ['Sol sombre', 'Sol', 'Structures', 'Artères', 'Lumières'],
  exotic: ['Base', 'Veines', 'Cristaux', 'Lueur', 'Reflets'],
}

export const BANDED_TYPES: PlanetType[] = ['gas', 'icegiant', 'hotjupiter', 'toxic']
