import type { ReactNode } from 'react'
import clsx from 'clsx'
import { ContextMenu as RContext, Dialog as RDialog, DropdownMenu as RMenu, Tabs as RTabs } from 'radix-ui'
import { Check, ChevronRight, X } from 'lucide-react'
import { Kbd } from './primitives'

export interface TabDef<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
}

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  className,
  fill,
}: {
  value: T
  onChange(v: T): void
  tabs: TabDef<T>[]
  className?: string
  fill?: boolean
}) {
  return (
    <RTabs.Root value={value} onValueChange={(v) => onChange(v as T)}>
      <RTabs.List className={clsx('flex gap-0.5 border-b border-line px-2', className)}>
        {tabs.map((t) => (
          <RTabs.Trigger
            key={t.value}
            value={t.value}
            className={clsx(
              'group relative flex h-9 items-center justify-center gap-1.5 px-2 text-[11.5px] font-medium text-ink-3 outline-none transition-colors hover:text-ink-2 data-[state=active]:text-ink [&_svg]:size-3.5',
              fill && 'flex-1 px-1',
            )}
          >
            {t.icon}
            {t.label}
            <span className="absolute inset-x-1 -bottom-px h-[2px] scale-x-0 bg-aurum transition-transform duration-200 group-data-[state=active]:scale-x-100" />
          </RTabs.Trigger>
        ))}
      </RTabs.List>
    </RTabs.Root>
  )
}

const MENU_CONTENT = 'glass-pop z-[140] min-w-[220px] animate-scale-in rounded-xl p-1 text-[12px]'
const MENU_ITEM =
  'relative flex h-8 cursor-default select-none items-center gap-2.5 rounded-lg px-2 text-ink-2 outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-white/[0.07] data-[highlighted]:text-ink data-[disabled]:opacity-40 [&_svg]:size-[15px] [&_svg]:stroke-[1.6] [&_svg]:text-ink-3 data-[highlighted]:[&_svg]:text-ink-2'

export const Menu = RMenu.Root
export const MenuTrigger = RMenu.Trigger

export function MenuContent({
  children,
  align = 'start',
  side = 'bottom',
  className,
}: {
  children: ReactNode
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}) {
  return (
    <RMenu.Portal>
      <RMenu.Content align={align} side={side} sideOffset={6} collisionPadding={10} className={clsx(MENU_CONTENT, className)}>
        {children}
      </RMenu.Content>
    </RMenu.Portal>
  )
}

export function MenuItem({
  icon,
  shortcut,
  children,
  onSelect,
  disabled,
  tone,
}: {
  icon?: ReactNode
  shortcut?: string
  children: ReactNode
  onSelect?(): void
  disabled?: boolean
  tone?: 'danger'
}) {
  return (
    <RMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={clsx(MENU_ITEM, tone === 'danger' && 'data-[highlighted]:bg-nova/10 data-[highlighted]:text-nova')}
    >
      {icon}
      <span className="flex-1 truncate">{children}</span>
      {shortcut && <Kbd className="ml-4">{shortcut}</Kbd>}
    </RMenu.Item>
  )
}

export function MenuCheckItem({
  checked,
  onChange,
  children,
  shortcut,
}: {
  checked: boolean
  onChange(v: boolean): void
  children: ReactNode
  shortcut?: string
}) {
  return (
    <RMenu.CheckboxItem
      checked={checked}
      onCheckedChange={onChange}
      onSelect={(e) => e.preventDefault()}
      className={MENU_ITEM}
    >
      <span className="flex size-[15px] items-center justify-center">
        {checked && <Check className="!text-aurum" />}
      </span>
      <span className="flex-1 truncate">{children}</span>
      {shortcut && <Kbd className="ml-4">{shortcut}</Kbd>}
    </RMenu.CheckboxItem>
  )
}

export function MenuSeparator() {
  return <RMenu.Separator className="mx-2 my-1 h-px bg-line" />
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <RMenu.Label className="eyebrow px-2 pb-1 pt-2">{children}</RMenu.Label>
}

export function MenuSub({ label, icon, children }: { label: ReactNode; icon?: ReactNode; children: ReactNode }) {
  return (
    <RMenu.Sub>
      <RMenu.SubTrigger className={clsx(MENU_ITEM, 'data-[state=open]:bg-white/[0.07]')}>
        {icon}
        <span className="flex-1">{label}</span>
        <ChevronRight className="size-3.5" />
      </RMenu.SubTrigger>
      <RMenu.Portal>
        <RMenu.SubContent sideOffset={6} collisionPadding={10} className={MENU_CONTENT}>
          {children}
        </RMenu.SubContent>
      </RMenu.Portal>
    </RMenu.Sub>
  )
}

export const ContextMenu = RContext.Root
export const ContextMenuTrigger = RContext.Trigger

export function ContextMenuContent({ children }: { children: ReactNode }) {
  return (
    <RContext.Portal>
      <RContext.Content collisionPadding={10} className={MENU_CONTENT}>
        {children}
      </RContext.Content>
    </RContext.Portal>
  )
}

export function ContextMenuItem({
  icon,
  shortcut,
  children,
  onSelect,
  disabled,
  tone,
}: {
  icon?: ReactNode
  shortcut?: string
  children: ReactNode
  onSelect?(): void
  disabled?: boolean
  tone?: 'danger'
}) {
  return (
    <RContext.Item
      disabled={disabled}
      onSelect={onSelect}
      className={clsx(MENU_ITEM, tone === 'danger' && 'data-[highlighted]:bg-nova/10 data-[highlighted]:text-nova')}
    >
      {icon}
      <span className="flex-1 truncate">{children}</span>
      {shortcut && <Kbd className="ml-4">{shortcut}</Kbd>}
    </RContext.Item>
  )
}

export function ContextMenuSeparator() {
  return <RContext.Separator className="mx-2 my-1 h-px bg-line" />
}

export function ContextMenuLabel({ children }: { children: ReactNode }) {
  return <RContext.Label className="eyebrow px-2 pb-1 pt-2">{children}</RContext.Label>
}

export function ContextMenuSub({ label, icon, children, disabled }: { label: ReactNode; icon?: ReactNode; children: ReactNode; disabled?: boolean }) {
  return (
    <RContext.Sub>
      <RContext.SubTrigger disabled={disabled} className={clsx(MENU_ITEM, 'data-[state=open]:bg-white/[0.07]')}>
        {icon}
        <span className="flex-1">{label}</span>
        <ChevronRight className="size-3.5" />
      </RContext.SubTrigger>
      <RContext.Portal>
        <RContext.SubContent sideOffset={6} collisionPadding={10} className={clsx(MENU_CONTENT, 'max-h-[60vh] overflow-y-auto')}>
          {children}
        </RContext.SubContent>
      </RContext.Portal>
    </RContext.Sub>
  )
}

export function Dialog({
  open,
  onOpenChange,
  title,
  subtitle,
  icon,
  children,
  footer,
  width = 520,
  className,
}: {
  open: boolean
  onOpenChange(v: boolean): void
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: number
  className?: string
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-[150] animate-fade-in bg-[#020308]/60" />
        <RDialog.Content
          onKeyDown={(e) => e.stopPropagation()}
          className={clsx(
            'glass-pop fixed left-1/2 top-1/2 z-[151] flex max-h-[86vh] -translate-x-1/2 -translate-y-1/2 animate-scale-in flex-col overflow-hidden rounded-2xl outline-none',
            className,
          )}
          style={{ width: `min(${width}px, calc(100vw - 48px))` }}
        >
          <div className="flex items-start gap-3 border-b border-line px-5 pb-4 pt-5">
            {icon && (
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-aurum/25 bg-aurum/10 text-aurum [&_svg]:size-[18px]">
                {icon}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <RDialog.Title className="font-display text-[22px] font-semibold leading-tight tracking-wide text-ink">{title}</RDialog.Title>
              {subtitle && <RDialog.Description className="mt-0.5 text-[12px] text-ink-2">{subtitle}</RDialog.Description>}
            </div>
            <RDialog.Close className="-mr-1 -mt-1 flex size-7 items-center justify-center rounded-lg text-ink-3 hover:bg-white/[0.07] hover:text-ink">
              <X className="size-4" />
            </RDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}
