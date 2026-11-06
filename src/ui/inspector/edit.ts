import { isGiant } from '@/core/planetPresets'
import type { Body, Id, Notes, Orbit, Rotation, Route, StarSystem } from '@/core/types'
import { adjustHex, blackbodyHex, hexToRgb, hslHex, rgbToHsl } from '@/lib/color'
import { useProjectStore } from '@/store/projectStore'

export function mainColor(b: Body): string {
  switch (b.kind) {
    case 'star':
      if (b.props.starClass === 'BH') return b.props.diskColorOuter
      return b.props.colorOverride ?? blackbodyHex(b.props.temperature)
    case 'planet':
    case 'moon':
      return b.props.palette[isGiant(b.props.planetType) ? 0 : 2]
    case 'nebula':
      return b.props.colors[0]
    case 'belt':
      return b.props.colorA
    case 'comet':
      return b.props.comaColor
    case 'station':
    case 'ship':
      return b.props.hullColor
    case 'gate':
      return b.props.color
    default:
      return b.color
  }
}

function retint(hex: string, from: string, to: string) {
  const [h0, s0] = rgbToHsl(hexToRgb(from))
  const [h1, s1] = rgbToHsl(hexToRgb(to))
  const [h, s, l] = rgbToHsl(hexToRgb(hex))
  const ds = s0 > 0.02 ? s1 / s0 : 1
  return hslHex(h + (h1 - h0), Math.min(1, s0 > 0.02 ? s * ds : s1 * 0.8), l)
}

export function applyMainColor(body: Body, hex: string) {
  const before = mainColor(body)
  editBody(body.id, 'mainColor', (b) => {
    b.color = hex
    switch (b.kind) {
      case 'star':
        if (b.props.starClass === 'BH') {
          b.props.diskColorOuter = hex
          b.props.diskColorInner = adjustHex(hex, 0, -0.55, 0.42)
        } else b.props.colorOverride = hex
        break
      case 'planet':
      case 'moon': {
        const idx = isGiant(b.props.planetType) ? 0 : 2
        b.props.palette = b.props.palette.map((c, i) => (i === idx ? hex : retint(c, before, hex))) as typeof b.props.palette
        break
      }
      case 'nebula':
        b.props.colors = [hex, retint(b.props.colors[1], before, hex), b.props.colors[2]]
        break
      case 'belt':
        b.props.colorA = hex
        b.props.colorB = adjustHex(hex, 0, -0.05, -0.12)
        b.props.dustColor = adjustHex(hex, 0, -0.1, 0.12)
        break
      case 'comet':
        b.props.comaColor = hex
        break
      case 'station':
      case 'ship':
        b.props.hullColor = hex
        break
      case 'gate':
        b.props.color = hex
        break
    }
  })
}

type Rec = Record<string, unknown>

export function editBody(id: Id, key: string, recipe: (b: Body) => void, coalesce = true) {
  useProjectStore.getState().updateBody(id, recipe, coalesce ? { coalesce: `${id}:${key}` } : undefined)
}

export function setField<K extends keyof Body>(body: Body, key: K, value: Body[K]) {
  editBody(body.id, String(key), (b) => {
    ;(b as unknown as Rec)[key as string] = value
  })
}

export function setProp(body: Body, key: string, value: unknown) {
  editBody(body.id, `props.${key}`, (b) => {
    ;(b.props as unknown as Rec)[key] = value
  })
}

export function setPropGroup(body: Body, group: string, key: string, value: unknown) {
  editBody(body.id, `props.${group}.${key}`, (b) => {
    const g = (b.props as unknown as Rec)[group] as Rec | undefined
    if (g) g[key] = value
  })
}

export function setPropIndex(body: Body, key: string, index: number, value: unknown) {
  editBody(body.id, `props.${key}.${index}`, (b) => {
    const arr = (b.props as unknown as Rec)[key] as unknown[] | undefined
    if (arr) arr[index] = value
  })
}

export function setOrbit<K extends keyof Orbit>(body: Body, key: K, value: Orbit[K]) {
  editBody(body.id, `orbit.${key}`, (b) => {
    if (b.orbit) b.orbit[key] = value
  })
}

export function setRotation<K extends keyof Rotation>(body: Body, key: K, value: Rotation[K]) {
  editBody(body.id, `rotation.${key}`, (b) => {
    b.rotation[key] = value
  })
}

export function setNote(body: Body, key: keyof Notes, value: string) {
  editBody(body.id, `notes.${key}`, (b) => {
    b.notes[key] = value
  })
}

export function editSystem(key: string, recipe: (s: StarSystem) => void) {
  useProjectStore.getState().updateSystem(recipe, { coalesce: `system:${key}` })
}

export function editRoute(id: Id, key: string, recipe: (r: Route) => void) {
  useProjectStore.getState().updateRoute(id, recipe, { coalesce: `route:${id}:${key}` })
}
