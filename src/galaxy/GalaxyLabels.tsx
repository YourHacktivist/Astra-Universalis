import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import clsx from 'clsx'
import type { Galaxy } from '@/core/types'
import { useUIStore } from '@/store/uiStore'
import { GALAXY_SCALE as S, projectLocal, useGalaxyUI } from './galaxyStore'

interface Entry {
  id: string
  el: HTMLElement
  kind: 'marker' | 'region' | 'route'
  local: [number, number, number]
  ends?: [[number, number, number], [number, number, number]]
  priority: number
  pinned: boolean
  width: number
  height: number
  center: boolean
}

const registry = new Map<string, Entry>()
let version = 0
let sorted: Entry[] = []
let sortedVersion = -1
const placed: { x: number; y: number; w: number; h: number }[] = []

function register(e: Entry) {
  registry.set(e.id, e)
  version++
}
function unregister(id: string) {
  registry.delete(id)
  version++
}

export function GalaxyLabelUpdater() {
  useFrame(() => {
    if (sortedVersion !== version) {
      sorted = [...registry.values()].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.priority - a.priority)
      sortedVersion = version
    }
    placed.length = 0
    for (const e of sorted) {
      const s = projectLocal(e.local[0], e.local[1], e.local[2])
      if (!s) {
        hide(e)
        continue
      }
      if (e.ends) {
        const a = projectLocal(...e.ends[0])
        const b = projectLocal(...e.ends[1])
        if (!a || !b || Math.hypot(a.x - b.x, a.y - b.y) < 90) {
          hide(e)
          continue
        }
      }
      const x = e.center ? s.x - e.width / 2 : s.x + 9
      const y = s.y - e.height / 2
      const r = { x: x - 2, y: y - 1, w: e.width + 4, h: e.height + 2 }
      if (!e.pinned && placed.some((p) => r.x < p.x + p.w && r.x + r.w > p.x && r.y < p.y + p.h && r.y + r.h > p.y)) {
        hide(e)
        continue
      }
      placed.push(r)
      e.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      e.el.style.opacity = '1'
      e.el.style.visibility = 'visible'
    }
  })
  return null
}

function hide(e: Entry) {
  if (e.el.style.visibility !== 'hidden') {
    e.el.style.opacity = '0'
    e.el.style.visibility = 'hidden'
  }
}

function useRegister(
  ref: React.RefObject<HTMLElement | null>,
  e: Omit<Entry, 'el' | 'width' | 'height'>,
  deps: unknown[],
) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    register({ ...e, el, width: el.offsetWidth, height: el.offsetHeight })
    return () => unregister(e.id)
  }, deps)
}

export const GalaxyLabels = memo(function GalaxyLabels({ galaxy }: { galaxy: Galaxy }) {
  const playerMode = useUIStore((s) => s.playerMode)
  const show = useGalaxyUI((s) => s.labels)
  const showRoutes = useGalaxyUI((s) => s.routes)
  const showRegions = useGalaxyUI((s) => s.regions)
  const selection = useGalaxyUI((s) => s.selection)
  const hovered = useGalaxyUI((s) => s.hovered)

  const markers = useMemo(() => Object.values(galaxy.systems).filter((m) => !playerMode || m.playerVisible), [galaxy.systems, playerMode])
  const regions = useMemo(() => Object.values(galaxy.regions).filter((r) => !playerMode || r.playerVisible), [galaxy.regions, playerMode])
  const routes = useMemo(
    () =>
      Object.values(galaxy.routes).filter(
        (r) => r.jump > 0 && galaxy.systems[r.from] && galaxy.systems[r.to] && (!playerMode || r.playerVisible),
      ),
    [galaxy.routes, galaxy.systems, playerMode],
  )
  if (!show) return null
  const isSel = (type: string, id: string) => selection?.type === type && selection.id === id
  const isHov = (type: string, id: string) => hovered?.type === type && hovered.id === id

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {showRegions &&
        regions.map((r) => (
          <RegionLabel key={r.id} id={r.id} name={r.name} color={r.color} local={[r.center[0] * S, 0, (r.center[2] - r.radius * 0.92) * S]} selected={isSel('region', r.id)} />
        ))}
      {showRoutes &&
        routes.map((r) => {
          const a = galaxy.systems[r.from].position
          const b = galaxy.systems[r.to].position
          return (
            <RouteLabel
              key={r.id}
              id={r.id}
              text={r.label ? `${r.label} · J-${r.jump}` : `J-${r.jump}`}
              ends={[
                [a[0] * S, a[1] * S, a[2] * S],
                [b[0] * S, b[1] * S, b[2] * S],
              ]}
              selected={isSel('route', r.id)}
            />
          )
        })}
      {markers.map((m) => (
        <MarkerLabel
          key={m.id}
          id={m.id}
          name={m.name}
          color={m.color}
          importance={m.importance}
          linked={!!m.systemId}
          local={[m.position[0] * S, m.position[1] * S, m.position[2] * S]}
          selected={isSel('system', m.id)}
          hovered={isHov('system', m.id)}
        />
      ))}
    </div>
  )
})

function MarkerLabel(p: {
  id: string
  name: string
  color: string
  importance: number
  linked: boolean
  local: [number, number, number]
  selected: boolean
  hovered: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useRegister(ref, { id: `m-${p.id}`, kind: 'marker', local: p.local, priority: 50 + p.importance * 20 + (p.selected ? 1000 : 0), pinned: p.selected || p.hovered, center: false }, [
    p.id, p.name, p.local[0], p.local[1], p.local[2], p.importance, p.selected, p.hovered, p.linked,
  ])
  const cls = p.importance >= 2 ? 'astra-label--star' : p.importance === 1 ? 'astra-label--planet' : 'astra-label--moon'
  return (
    <div
      ref={ref}
      className={clsx('astra-label', cls, p.selected && 'is-selected', p.hovered && 'is-hovered')}
      style={{ '--label-color': p.color, opacity: 0, visibility: 'hidden' } as React.CSSProperties}
      onClick={(e) => {
        e.stopPropagation()
        useGalaxyUI.getState().select({ type: 'system', id: p.id })
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        useGalaxyUI.getState().requestCamera({ type: 'focus', local: p.local })
      }}
      onPointerEnter={() => useGalaxyUI.getState().hover({ type: 'system', id: p.id })}
      onPointerLeave={() => useGalaxyUI.getState().hover(null)}
    >
      <span className="astra-label__name">{p.name}</span>
      {p.linked && <span className="astra-label__sub">détaillé</span>}
    </div>
  )
}

function RegionLabel(p: { id: string; name: string; color: string; local: [number, number, number]; selected: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useRegister(ref, { id: `r-${p.id}`, kind: 'region', local: p.local, priority: 30 + (p.selected ? 1000 : 0), pinned: p.selected, center: true }, [
    p.id, p.name, p.local[0], p.local[2], p.selected,
  ])
  return (
    <div
      ref={ref}
      className="pointer-events-auto absolute left-0 top-0 cursor-pointer whitespace-nowrap font-display text-[15px] font-medium uppercase italic tracking-[0.28em] will-change-transform"
      style={{ color: p.color, opacity: 0, visibility: 'hidden', textShadow: '0 0 12px rgb(0 0 0 / 0.95)' }}
      onClick={(e) => {
        e.stopPropagation()
        useGalaxyUI.getState().select({ type: 'region', id: p.id })
      }}
    >
      {p.name}
    </div>
  )
}

function RouteLabel(p: { id: string; text: string; ends: [[number, number, number], [number, number, number]]; selected: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const mid: [number, number, number] = [(p.ends[0][0] + p.ends[1][0]) / 2, (p.ends[0][1] + p.ends[1][1]) / 2, (p.ends[0][2] + p.ends[1][2]) / 2]
  useRegister(ref, { id: `t-${p.id}`, kind: 'route', local: mid, ends: p.ends, priority: 10 + (p.selected ? 1000 : 0), pinned: p.selected, center: true }, [
    p.id, p.text, mid[0], mid[1], mid[2], p.selected,
  ])
  return (
    <div ref={ref} className="astra-zone-label" style={{ '--label-color': p.selected ? '#F6D59C' : '#8AB0FF', opacity: 0, visibility: 'hidden' } as React.CSSProperties}>
      {p.text}
    </div>
  )
}
