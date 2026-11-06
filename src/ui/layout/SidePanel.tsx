import type { ReactNode } from 'react'
import clsx from 'clsx'
import { useUIStore } from '@/store/uiStore'
import { useResizeDrag } from '../hooks'

const LIMITS = { hierarchy: [220, 460], inspector: [300, 520] } as const

export function SidePanel({
  side,
  width,
  children,
}: {
  side: 'hierarchy' | 'inspector'
  width: number
  children: ReactNode
}) {
  const left = side === 'hierarchy'
  const drag = useResizeDrag((dx) => {
    const ui = useUIStore.getState()
    const cur = side === 'hierarchy' ? ui.hierarchyWidth : ui.inspectorWidth
    const [min, max] = LIMITS[side]
    ui.setPanelWidth(side, Math.round(Math.min(max, Math.max(min, cur + (left ? dx : -dx)))))
  })

  return (
    <aside
      aria-label={left ? 'Hiérarchie du système' : 'Inspecteur'}
      className={clsx('relative flex h-full shrink-0 flex-col bg-abyss', left ? 'border-r border-line' : 'border-l border-line')}
      style={{ width }}
      onContextMenu={(e) => e.stopPropagation()}
    >
      {children}
      <div
        {...drag}
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionner le panneau"
        className={clsx('group/resize absolute inset-y-0 z-10 w-[7px] cursor-col-resize', left ? '-right-[4px]' : '-left-[4px]')}
      >
        <div className="mx-auto h-full w-px bg-transparent transition-colors group-hover/resize:bg-aurum/60" />
      </div>
    </aside>
  )
}
