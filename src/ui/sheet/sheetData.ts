import { ancestors, topoOrder } from '@/core/hierarchy'
import {
  BELT_TYPE_LABEL,
  GATE_TYPE_LABEL,
  KIND_LABEL,
  MARKER_TYPE_LABEL,
  NEBULA_TYPE_LABEL,
  PLANET_TYPE_LABEL,
  SHIP_TYPE_LABEL,
  STATION_TYPE_LABEL,
} from '@/core/labels'
import { derivedStats } from '@/core/physics'
import { spectralLabel } from '@/core/starPresets'
import type { Body, StarSystem } from '@/core/types'
import { blackbodyHex } from '@/lib/color'
import { formatDays, formatKm, num } from '@/lib/format'

export type SheetThemeId = 'atlas' | 'print'

export interface SheetTheme {
  id: SheetThemeId
  bg: string
  bgAccent: string
  panel: string
  ink: string
  ink2: string
  ink3: string
  accent: string
  accent2: string
  line: string
  lineStrong: string
  danger: string
  display: { family: string; weight: number; italic?: boolean; upper?: boolean; spacing: number }
  body: string
  mono: string
  logo: string
  planetOutline: string | null
  glow: boolean
}

export const FONT_DISPLAY = "'Cormorant Garamond'"
export const FONT_BODY = "'IBM Plex Sans Variable'"
export const FONT_MONO = "'IBM Plex Mono'"

export const THEMES: Record<SheetThemeId, SheetTheme> = {
  atlas: {
    id: 'atlas',
    bg: '#08090c',
    bgAccent: '#08090c',
    panel: '#0c0d11',
    ink: '#ecebe6',
    ink2: '#a9a8a1',
    ink3: '#85847d',
    accent: '#d9ad62',
    accent2: '#8eaee8',
    line: 'rgba(255,255,255,0.085)',
    lineStrong: 'rgba(255,255,255,0.16)',
    danger: '#f08470',
    display: { family: FONT_DISPLAY, weight: 600, spacing: 0.02 },
    body: FONT_BODY,
    mono: FONT_MONO,
    logo: './brand/logo-night.png',
    planetOutline: 'rgba(255,255,255,0.22)',
    glow: false,
  },
  print: {
    id: 'print',
    bg: '#f3f1ea',
    bgAccent: '#f3f1ea',
    panel: 'rgba(0,0,0,0.035)',
    ink: '#111111',
    ink2: '#3b3b3b',
    ink3: '#7a7a74',
    accent: '#111111',
    accent2: '#111111',
    line: 'rgba(0,0,0,0.16)',
    lineStrong: '#111111',
    danger: '#c0281a',
    display: { family: FONT_BODY, weight: 700, upper: true, spacing: 0.04 },
    body: FONT_BODY,
    mono: FONT_MONO,
    logo: './brand/logo-day.png',
    planetOutline: '#111111',
    glow: false,
  },
}

let ctx: CanvasRenderingContext2D | null = null
function c2d() {
  if (!ctx) ctx = document.createElement('canvas').getContext('2d')!
  return ctx
}

export function font(size: number, family: string, weight = 400, italic = false) {
  return `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`
}

export function measure(text: string, f: string, spacingPx = 0) {
  const c = c2d()
  c.font = f
  return c.measureText(text).width + spacingPx * text.length
}

export function ellipsize(text: string, f: string, maxW: number, spacingPx = 0) {
  if (measure(text, f, spacingPx) <= maxW) return text
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (measure(text.slice(0, mid) + '…', f, spacingPx) <= maxW) lo = mid
    else hi = mid - 1
  }
  return text.slice(0, lo).trimEnd() + '…'
}

function hardBreak(word: string, f: string, maxW: number, spacingPx: number): string[] {
  const out: string[] = []
  let cur = ''
  for (const ch of word) {
    if (cur && measure(cur + ch + '-', f, spacingPx) > maxW) {
      out.push(cur + '-')
      cur = ch
    } else cur += ch
  }
  if (cur) out.push(cur)
  return out
}

export function wrap(text: string, f: string, maxW: number, spacingPx = 0): string[] {
  const lines: string[] = []
  for (const para of String(text).split(/\n+/)) {
    const words = para.split(/\s+/).filter(Boolean)
    let cur = ''
    for (const w of words) {
      const pieces = measure(w, f, spacingPx) > maxW ? hardBreak(w, f, maxW, spacingPx) : [w]
      for (const piece of pieces) {
        const next = cur ? `${cur} ${piece}` : piece
        if (!cur || measure(next, f, spacingPx) <= maxW) cur = next
        else {
          lines.push(cur)
          cur = piece
        }
      }
    }
    if (cur) lines.push(cur)
  }
  return lines.length ? lines : ['']
}

export function typeLabel(b: Body): string {
  switch (b.kind) {
    case 'star':
      return spectralLabel(b.props)
    case 'planet':
    case 'moon':
      return PLANET_TYPE_LABEL[b.props.planetType]
    case 'belt':
      return BELT_TYPE_LABEL[b.props.beltType]
    case 'nebula':
      return NEBULA_TYPE_LABEL[b.props.nebulaType]
    case 'station':
      return STATION_TYPE_LABEL[b.props.stationType]
    case 'ship':
      return SHIP_TYPE_LABEL[b.props.shipType]
    case 'gate':
      return GATE_TYPE_LABEL[b.props.gateType]
    case 'marker':
      return MARKER_TYPE_LABEL[b.props.markerType]
    default:
      return KIND_LABEL[b.kind]
  }
}

export function bodyColor(b: Body): string {
  if (b.kind === 'star') return b.props.starClass === 'BH' ? b.props.diskColorOuter : b.props.colorOverride ?? blackbodyHex(b.props.temperature)
  if (b.kind === 'planet' || b.kind === 'moon') return b.props.palette[2]
  return b.color
}

export interface SheetRow {
  body: Body
  depth: number
  name: string
  type: string
  distance: string
  period: string
  radius: string
  gravity: string
  temp: string
  atmosphere: string
  people: string
  hazards: string
}

const LOCAL_PARENTS = new Set(['planet', 'moon', 'station', 'ship', 'comet', 'gate', 'marker'])

export function visibleBodies(system: StarSystem, playerMode: boolean): Body[] {
  const hidden = new Set<string>()
  for (const b of topoOrder(system.bodies)) {
    const parentHidden = b.parentId ? hidden.has(b.parentId) : false
    if (parentHidden || !b.visible || (playerMode && !b.playerVisible)) hidden.add(b.id)
  }
  return topoOrder(system.bodies).filter((b) => !hidden.has(b.id))
}

export function buildRows(system: StarSystem, playerMode: boolean): SheetRow[] {
  const rows: SheetRow[] = []
  for (const b of visibleBodies(system, playerMode)) {
    if (b.kind === 'barycenter') continue
    const stats = derivedStats(system, b)
    const parent = b.parentId ? system.bodies[b.parentId] : null
    const depth = ancestors(system.bodies, b.id).filter((a) => LOCAL_PARENTS.has(a.kind)).length
    let distance = '–'
    if (b.kind === 'belt') distance = `${num(b.props.inner)}–${num(b.props.outer)} UA`
    else if (b.orbit) distance = parent && LOCAL_PARENTS.has(parent.kind) ? formatKm(b.orbit.a * 149_597_870.7) : `${num(b.orbit.a)} UA`
    const period = b.orbit && !b.orbit.fixed && Number.isFinite(stats.periodDays) ? formatDays(stats.periodDays) : '–'
    let radius = '–'
    let gravity = '–'
    let temp = '–'
    if (b.kind === 'planet' || b.kind === 'moon') {
      radius = `${num(b.props.radius)} R⊕`
      gravity = stats.gravityG !== null ? `${num(stats.gravityG)} g` : '–'
      temp = stats.surfaceK !== null && stats.luminosity > 0 ? `${num(stats.surfaceK - 273.15, 0)} °C` : '–'
    } else if (b.kind === 'star') {
      radius = b.props.starClass === 'BH' ? `${num(b.props.mass, 1)} M☉` : `${num(b.props.radius)} R☉`
      temp = b.props.starClass === 'BH' ? '–' : `${num(b.props.temperature, 0)} K`
    }
    const people = [b.notes.population, b.notes.faction].filter(Boolean).join(' · ')
    rows.push({
      body: b,
      depth,
      name: b.name,
      type: typeLabel(b),
      distance,
      period,
      radius,
      gravity,
      temp,
      atmosphere: b.notes.atmosphere || '–',
      people: people || '–',
      hazards: b.notes.hazards || '–',
    })
  }
  return rows
}

export interface SchematicColumn {
  body: Body
  satellites: Body[]
}

export function schematic(system: StarSystem, playerMode: boolean) {
  const vis = visibleBodies(system, playerMode)
  const roots = vis.filter((b) => b.parentId === null && (b.kind === 'star' || b.kind === 'barycenter'))
  const root = roots[0] ?? null
  const rootStars: Body[] = root ? (root.kind === 'star' ? [root] : vis.filter((b) => b.parentId === root.id && b.kind === 'star')) : []
  const hosts = new Set<string>(root ? [root.id, ...rootStars.map((s) => s.id)] : [])
  const columns: SchematicColumn[] = []
  const distanceOf = (b: Body) => (b.kind === 'belt' ? b.props.inner : b.orbit?.a ?? 0)
  for (const b of vis) {
    if (!b.parentId || !hosts.has(b.parentId)) continue
    if (b.kind === 'star' && rootStars.includes(b)) continue
    if (!['planet', 'belt', 'star', 'station', 'gate', 'barycenter'].includes(b.kind)) continue
    const satellites = vis.filter((s) => s.parentId === b.id && ['moon', 'station', 'ship', 'planet'].includes(s.kind))
    columns.push({ body: b, satellites })
  }
  columns.sort((a, b) => distanceOf(a.body) - distanceOf(b.body))
  const others = vis.filter((b) => ['comet', 'marker', 'nebula', 'ship'].includes(b.kind) && b.parentId && hosts.has(b.parentId))
  return { root, rootStars, columns, others }
}

export function systemCounts(system: StarSystem, playerMode: boolean) {
  const counts: Record<string, number> = {}
  for (const b of visibleBodies(system, playerMode)) counts[b.kind] = (counts[b.kind] ?? 0) + 1
  return counts
}

export function habitableCount(system: StarSystem, playerMode: boolean) {
  return visibleBodies(system, playerMode).filter((b) => {
    if (b.kind !== 'planet' && b.kind !== 'moon') return false
    const s = derivedStats(system, b)
    return !!s.inHabitableZone && ['terran', 'ocean', 'jungle', 'city'].includes(b.props.planetType)
  }).length
}
