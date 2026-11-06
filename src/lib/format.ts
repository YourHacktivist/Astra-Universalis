const nf = (digits: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: 0 })

const cache = new Map<number, Intl.NumberFormat>()
function fmt(digits: number) {
  let f = cache.get(digits)
  if (!f) {
    f = nf(digits)
    cache.set(digits, f)
  }
  return f
}

export function num(v: number, digits?: number): string {
  if (!Number.isFinite(v)) return '–'
  if (digits === undefined) {
    const a = Math.abs(v)
    digits = a >= 1000 ? 0 : a >= 100 ? 1 : a >= 10 ? 2 : a >= 1 ? 2 : a >= 0.01 ? 3 : 4
  }
  return fmt(digits).format(v)
}

export function sci(v: number, sig = 3): string {
  if (!Number.isFinite(v)) return '–'
  if (v === 0) return '0'
  const a = Math.abs(v)
  if (a >= 1e-3 && a < 1e6) return num(v)
  const exp = Math.floor(Math.log10(a))
  const mant = v / Math.pow(10, exp)
  const sup = String(exp).replace(/-/g, '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d])
  return `${fmt(sig - 1).format(mant)}×10${sup}`
}

export const AU_KM = 149_597_870.7
export const LIGHT_SECOND_KM = 299_792.458

export function formatDistanceAU(au: number): string {
  if (au < 0.01) return `${num(au * AU_KM, 0)} km`
  return `${num(au)} UA`
}

export function formatKm(km: number): string {
  if (km >= 1e9) return `${num(km / AU_KM)} UA`
  if (km >= 1e6) return `${num(km / 1e6, 2)} M km`
  return `${num(km, 0)} km`
}

export function formatDays(days: number): string {
  const a = Math.abs(days)
  if (!Number.isFinite(a)) return '–'
  if (a < 1 / 24) return `${num(days * 1440, 1)} min`
  if (a < 2) return `${num(days * 24, 1)} h`
  if (a < 730) return `${num(days, 1)} j`
  return `${num(days / 365.25, 2)} ans`
}

export function formatHours(hours: number): string {
  const a = Math.abs(hours)
  if (a < 1) return `${num(hours * 60, 0)} min`
  if (a < 72) return `${num(hours, 1)} h`
  return `${num(hours / 24, 1)} j`
}

export function formatLightTime(km: number): string {
  const s = km / LIGHT_SECOND_KM
  if (s < 60) return `${num(s, 1)} s`
  if (s < 3600) return `${num(s / 60, 1)} min`
  if (s < 86400) return `${num(s / 3600, 1)} h`
  return `${num(s / 86400, 1)} j`
}

export function formatTemp(k: number): string {
  return `${num(k, 0)} K (${num(k - 273.15, 0)} °C)`
}

export function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export function simDate(epochYear: number, days: number) {
  const base = Date.UTC(2000, 0, 1)
  const d = new Date(base + days * 86_400_000)
  const year = d.getUTCFullYear() - 2000 + epochYear
  return {
    year,
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  }
}

export function formatSimDate(epochYear: number, days: number, withTime = true): string {
  const d = simDate(epochYear, days)
  const date = `${d.year}-${pad2(d.month)}-${pad2(d.day)}`
  return withTime ? `${date} · ${pad2(d.hour)}:${pad2(d.minute)}` : date
}

export function formatSpeed(daysPerSecond: number): string {
  const a = Math.abs(daysPerSecond)
  const sign = daysPerSecond < 0 ? '−' : ''
  if (a === 0) return 'Pause'
  if (a < 1 / 24) return `${sign}${num(a * 1440, 0)} min/s`
  if (a < 1) return `${sign}${num(a * 24, 0)} h/s`
  if (a < 7) return `${sign}${num(a, 0)} j/s`
  if (a < 30) return `${sign}${num(a / 7, 0)} sem/s`
  if (a < 365) return `${sign}${num(a / 30.44, 0)} mois/s`
  return `${sign}${num(a / 365.25, 0)} an${a >= 730 ? 's' : ''}/s`
}

export function romanNumeral(n: number): string {
  const table: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ]
  let out = ''
  for (const [v, s] of table) while (n >= v) {
    out += s
    n -= v
  }
  return out
}
