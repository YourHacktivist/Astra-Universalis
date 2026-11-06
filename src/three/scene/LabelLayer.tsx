import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import clsx from 'clsx'
import { KIND_LABEL, PLANET_TYPE_LABEL } from '@/core/labels'
import { parentScaleInfo, mapOrbitDistance } from '@/core/scale'
import { spectralLabel } from '@/core/starPresets'
import type { Body, StarSystem } from '@/core/types'
import { useUIStore } from '@/store/uiStore'
import { LABEL_PRIORITY, registerLabel, unregisterLabel } from './labels'

function subtitle(b: Body): string {
  switch (b.kind) {
    case 'star':
      return spectralLabel(b.props)
    case 'planet':
    case 'moon':
      return PLANET_TYPE_LABEL[b.props.planetType]
    default:
      return KIND_LABEL[b.kind]
  }
}

export const LabelLayer = memo(function LabelLayer({ system }: { system: StarSystem }) {
  const view = useUIStore((s) => s.view)
  const playerMode = useUIStore((s) => s.playerMode)
  const selectedId = useUIStore((s) => s.selectedId)
  const hoveredId = useUIStore((s) => s.hoveredId)
  const exporting = useUIStore((s) => s.exporting)

  const bodies = useMemo(() => {
    if (!view.labels) return []
    return Object.values(system.bodies).filter((b) => {
      if (!b.visible || !b.showLabel) return false
      if (playerMode && !b.playerVisible) return false
      if (b.kind === 'barycenter') return false
      if (b.kind === 'moon' && !view.moonLabels) return false
      return true
    })
  }, [system.bodies, view.labels, view.moonLabels, playerMode])

  return (
    <div className={clsx('pointer-events-none absolute inset-0 overflow-hidden', exporting && 'invisible')}>
      {bodies.map((b) => (
        <BodyLabel
          key={b.id}
          body={b}
          parent={b.parentId ? system.bodies[b.parentId] ?? null : null}
          system={system}
          selected={b.id === selectedId}
          hovered={b.id === hoveredId}
        />
      ))}
    </div>
  )
})

const BodyLabel = memo(function BodyLabel({
  body,
  parent,
  system,
  selected,
  hovered,
}: {
  body: Body
  parent: Body | null
  system: StarSystem
  selected: boolean
  hovered: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const sub = subtitle(body)
  const ringRadius = useMemo(() => {
    if (body.kind !== 'belt') return undefined
    const info = parentScaleInfo(parent, system.display)
    return mapOrbitDistance(body.props.outer, info, system.display)
  }, [body, parent, system.display])
  const showSub = selected || hovered || body.kind === 'star'

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    registerLabel({
      id: body.id,
      el,
      bodyId: body.id,
      parentId: body.parentId,
      kind: body.kind,
      priority: LABEL_PRIORITY[body.kind] + (selected ? 1000 : 0),
      pinned: selected || hovered,
      ringRadius,
      width: el.offsetWidth,
      height: el.offsetHeight,
    })
    return () => unregisterLabel(body.id)
  }, [body.id, body.parentId, body.kind, body.name, ringRadius, selected, hovered, showSub])

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    useUIStore.getState().select(body.id)
  }
  const onDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    useUIStore.getState().requestCamera({ type: 'focus', id: body.id })
  }

  return (
    <div
      ref={ref}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onPointerEnter={() => useUIStore.getState().hover(body.id)}
      onPointerLeave={() => useUIStore.getState().hover(null)}
      className={clsx('astra-label', `astra-label--${body.kind}`, selected && 'is-selected', hovered && 'is-hovered')}
      style={{ '--label-color': body.color, opacity: 0, visibility: 'hidden' } as React.CSSProperties}
    >
      <span className="astra-label__name">{body.name}</span>
      {showSub && <span className="astra-label__sub">{sub}</span>}
    </div>
  )
})
