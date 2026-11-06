import type { ReactNode } from 'react'
import clsx from 'clsx'
import { Popover as RPopover } from 'radix-ui'

export const PopoverRoot = RPopover.Root
export const PopoverTrigger = RPopover.Trigger
export const PopoverClose = RPopover.Close
export const PopoverAnchor = RPopover.Anchor

export function PopoverContent({
  children,
  side = 'bottom',
  align = 'center',
  sideOffset = 8,
  className,
  onOpenAutoFocus,
}: {
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  className?: string
  onOpenAutoFocus?(e: Event): void
}) {
  return (
    <RPopover.Portal>
      <RPopover.Content
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={10}
        onOpenAutoFocus={onOpenAutoFocus}
        onKeyDown={(e) => e.stopPropagation()}
        className={clsx('glass-pop z-[140] animate-scale-in rounded-xl outline-none', className)}
      >
        {children}
      </RPopover.Content>
    </RPopover.Portal>
  )
}
