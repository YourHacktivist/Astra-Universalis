import type { LuminosityClass, StarClass, StarProps } from './types'

const MS_ANCHORS: [number, number, number][] = [
  [2400, 0.08, 0.11],
  [3200, 0.25, 0.28],
  [3850, 0.6, 0.6],
  [5200, 0.87, 0.85],
  [5772, 1.0, 1.0],
  [6000, 1.1, 1.1],
  [7500, 1.6, 1.5],
  [10000, 2.9, 2.4],
  [30000, 17, 7],
  [50000, 60, 13],
]

const CLASS_T0: Record<'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M', [number, number]> = {
  O: [50000, 30000],
  B: [30000, 10000],
  A: [10000, 7500],
  F: [7500, 6000],
  G: [6000, 5200],
  K: [5200, 3850],
  M: [3850, 2400],
}

const LUM_RADIUS: Record<LuminosityClass, number> = { V: 1, IV: 2, III: 12, II: 40, Ib: 120, Ia: 300 }
const LUM_MASS: Record<LuminosityClass, number> = { V: 1, IV: 1.2, III: 1.6, II: 4, Ib: 8, Ia: 14 }

export const SOLAR_T = 5772

function interpLog(t: number) {
  const a = MS_ANCHORS
  if (t <= a[0][0]) return { mass: a[0][1], radius: a[0][2] }
  for (let i = 0; i < a.length - 1; i++) {
    const [t0, m0, r0] = a[i]
    const [t1, m1, r1] = a[i + 1]
    if (t <= t1) {
      const k = (Math.log(t) - Math.log(t0)) / (Math.log(t1) - Math.log(t0))
      return {
        mass: Math.exp(Math.log(m0) + (Math.log(m1) - Math.log(m0)) * k),
        radius: Math.exp(Math.log(r0) + (Math.log(r1) - Math.log(r0)) * k),
      }
    }
  }
  const last = a[a.length - 1]
  return { mass: last[1], radius: last[2] }
}

export function luminosityFrom(radius: number, temperature: number) {
  return radius * radius * Math.pow(temperature / SOLAR_T, 4)
}

export function schwarzschildKm(massSolar: number) {
  return 2.953 * massSolar
}

const BASE_VISUALS = {
  colorOverride: null,
  corona: 1,
  rays: 0.55,
  flare: true,
  spots: 0.15,
  granulation: 1,
  activity: 0.5,
  diskInner: 2.6,
  diskOuter: 9,
  diskColorInner: '#fff2dc',
  diskColorOuter: '#ff6a24',
  diskBrightness: 1.4,
  beamAngle: 28,
  beamLength: 16,
  pulseRate: 1.1,
} satisfies Partial<StarProps>

export function starPreset(starClass: StarClass, subclass = 2, lumClass: LuminosityClass = 'V'): StarProps {
  const sub = Math.min(9, Math.max(0, Math.round(subclass)))
  switch (starClass) {
    case 'BD':
      return {
        ...BASE_VISUALS,
        starClass,
        subclass: sub,
        lumClass: 'V',
        temperature: 1800 - sub * 120,
        radius: 0.1,
        mass: 0.05,
        luminosity: luminosityFrom(0.1, 1800 - sub * 120),
        corona: 0.35,
        rays: 0.1,
        flare: false,
        spots: 0.4,
        granulation: 1.6,
        activity: 0.35,
      }
    case 'WD':
      return {
        ...BASE_VISUALS,
        starClass,
        subclass: sub,
        lumClass: 'V',
        temperature: 25000 - sub * 1800,
        radius: 0.012,
        mass: 0.6,
        luminosity: luminosityFrom(0.012, 25000 - sub * 1800),
        corona: 1.3,
        rays: 0.7,
        spots: 0,
        granulation: 0.4,
        activity: 0.2,
      }
    case 'NS':
    case 'PSR':
      return {
        ...BASE_VISUALS,
        starClass,
        subclass: 0,
        lumClass: 'V',
        temperature: 600000,
        radius: 0.000015,
        mass: 1.4,
        luminosity: 0.2,
        corona: 1.6,
        rays: 0.9,
        spots: 0,
        granulation: 0.3,
        activity: 1,
      }
    case 'BH':
      return {
        ...BASE_VISUALS,
        starClass,
        subclass: 0,
        lumClass: 'V',
        temperature: 9000,
        radius: schwarzschildKm(10) / 695_700,
        mass: 10,
        luminosity: 0.05,
        corona: 0.6,
        rays: 0.2,
        flare: false,
        spots: 0,
        granulation: 1,
        activity: 0.6,
      }
    default: {
      const [ta, tb] = CLASS_T0[starClass]
      let temperature = ta + (tb - ta) * (sub / 10)
      const ms = interpLog(temperature)
      const giant = lumClass !== 'V' && lumClass !== 'IV'
      if (giant && (starClass === 'G' || starClass === 'K' || starClass === 'M')) temperature *= 0.88
      const radius = ms.radius * LUM_RADIUS[lumClass]
      const mass = ms.mass * LUM_MASS[lumClass]
      const hot = temperature > 9000
      return {
        ...BASE_VISUALS,
        starClass,
        subclass: sub,
        lumClass,
        temperature: Math.round(temperature),
        radius: round(radius),
        mass: round(mass),
        luminosity: round(luminosityFrom(radius, temperature)),
        corona: hot ? 1.25 : 1,
        rays: hot ? 0.7 : 0.55,
        spots: starClass === 'K' || starClass === 'M' ? 0.3 : hot ? 0.02 : 0.15,
        granulation: giant ? 2.6 : lumClass === 'IV' ? 1.4 : 1,
        activity: starClass === 'M' ? 0.7 : 0.5,
      }
    }
  }
}

function round(v: number) {
  if (v === 0) return 0
  const d = Math.max(0, 3 - Math.floor(Math.log10(Math.abs(v))))
  return Number(v.toFixed(Math.min(8, d)))
}

export function spectralLabel(p: Pick<StarProps, 'starClass' | 'subclass' | 'lumClass'>): string {
  switch (p.starClass) {
    case 'BD':
      return `L${p.subclass} (naine brune)`
    case 'WD':
      return `DA${p.subclass}`
    case 'NS':
      return 'Étoile à neutrons'
    case 'PSR':
      return 'Pulsar'
    case 'BH':
      return 'Trou noir'
    default:
      return `${p.starClass}${p.subclass} ${p.lumClass}`
  }
}
