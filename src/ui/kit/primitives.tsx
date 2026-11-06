import { forwardRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import clsx from 'clsx'
import { Tooltip as RTooltip } from 'radix-ui'
import { ChevronRight } from 'lucide-react'

export { clsx as cn }

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <RTooltip.Provider delayDuration={350} skipDelayDuration={150}>
      {children}
    </RTooltip.Provider>
  )
}

export function Tooltip({
  content,
  shortcut,
  side = 'top',
  children,
  disabled,
}: {
  content: ReactNode
  shortcut?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  children: ReactNode
  disabled?: boolean
}) {
  if (disabled || !content) return <>{children}</>
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          sideOffset={7}
          collisionPadding={8}
          className="glass-pop z-[100] flex animate-fade-in items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11.5px] text-ink"
        >
          <span>{content}</span>
          {shortcut && <Kbd>{shortcut}</Kbd>}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  )
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={clsx(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-line-strong bg-white/[0.04] px-1 font-mono text-[9.5px] font-medium text-ink-2',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  iconRight?: ReactNode
  active?: boolean
}

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary:
    'text-[#15100a] bg-aurum hover:bg-aurum-hi active:bg-aurum',
  secondary:
    'text-ink bg-raised border border-line-strong hover:border-white/25 active:bg-deep',
  outline: 'text-ink-2 border border-line-strong hover:text-ink hover:border-white/25 hover:bg-white/[0.03]',
  ghost: 'text-ink-2 hover:text-ink hover:bg-white/[0.06] active:bg-white/[0.08]',
  danger: 'text-nova bg-nova/10 border border-nova/25 hover:bg-nova/15 hover:border-nova/40',
}

const BTN_SIZE: Record<ButtonSize, string> = {
  xs: 'h-6 px-2 text-[11px] gap-1 rounded-md',
  sm: 'h-7 px-2.5 text-[12px] gap-1.5 rounded-lg',
  md: 'h-8 px-3.5 text-[12.5px] gap-2 rounded-lg',
  lg: 'h-10 px-5 text-[13.5px] gap-2.5 rounded-xl',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconRight, active, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={clsx(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-[background,border,color,filter,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-40',
        BTN_VARIANT[variant],
        BTN_SIZE[size],
        active && variant !== 'primary' && 'border-aurum/40 bg-aurum/10 text-aurum-hi',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  )
})

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  shortcut?: string
  active?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg'
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right'
  tone?: 'default' | 'danger'
}

const ICON_SIZE = { xs: 'h-6 w-6 rounded-md', sm: 'h-7 w-7 rounded-lg', md: 'h-8 w-8 rounded-lg', lg: 'h-10 w-10 rounded-xl' }

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, shortcut, active, size = 'md', tooltipSide = 'top', tone = 'default', className, children, ...rest },
  ref,
) {
  return (
    <Tooltip content={label} shortcut={shortcut} side={tooltipSide}>
      <button
        ref={ref}
        aria-label={label}
        aria-pressed={active}
        className={clsx(
          'inline-flex shrink-0 items-center justify-center transition-[background,color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-[16px] [&_svg]:stroke-[1.6]',
          ICON_SIZE[size],
          active
            ? 'bg-aurum/[0.12] text-aurum-hi'
            : tone === 'danger'
              ? 'text-ink-2 hover:bg-nova/10 hover:text-nova'
              : 'text-ink-2 hover:bg-white/[0.07] hover:text-ink',
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    </Tooltip>
  )
})

export function Panel({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('glass rounded-[var(--radius-panel)]', className)} {...rest}>
      {children}
    </div>
  )
}

export function Section({
  title,
  icon,
  actions,
  defaultOpen = true,
  children,
  className,
}: {
  title: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className={clsx('border-b border-line last:border-b-0', className)}>
      <div className="flex h-8 items-center gap-1.5 px-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="group flex flex-1 items-center gap-1.5 text-left"
        >
          <ChevronRight
            className={clsx('size-3 text-ink-3 transition-transform duration-150 group-hover:text-ink-2', open && 'rotate-90')}
          />
          {icon && <span className="text-ink-3 [&_svg]:size-3.5">{icon}</span>}
          <span className="eyebrow group-hover:text-ink-2">{title}</span>
        </button>
        {actions}
      </div>
      {open && <div className="animate-fade-in space-y-1.5 px-3 pb-3">{children}</div>}
    </section>
  )
}

export function Field({
  label,
  hint,
  children,
  className,
  stacked,
}: {
  label: ReactNode
  hint?: string
  children: ReactNode
  className?: string
  stacked?: boolean
}) {
  return (
    <div className={clsx(stacked ? 'space-y-1' : 'grid min-h-7 grid-cols-[minmax(84px,38%)_1fr] items-center gap-2', className)}>
      <Tooltip content={hint} side="left" disabled={!hint}>
        <label className="truncate text-[11.5px] text-ink-2">{label}</label>
      </Tooltip>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function Separator({ className }: { className?: string }) {
  return <div className={clsx('h-px bg-line', className)} />
}

export function Badge({
  children,
  tone = 'default',
  className,
}: {
  children: ReactNode
  tone?: 'default' | 'aurum' | 'ion' | 'viridis' | 'nova' | 'nebula'
  className?: string
}) {
  const tones = {
    default: 'bg-white/[0.06] text-ink-2 border-line',
    aurum: 'bg-aurum/10 text-aurum-hi border-aurum/25',
    ion: 'bg-ion/10 text-ion-hi border-ion/25',
    viridis: 'bg-viridis/10 text-viridis border-viridis/25',
    nova: 'bg-nova/10 text-nova border-nova/25',
    nebula: 'bg-nebula/10 text-nebula border-nebula/25',
  }
  return (
    <span
      className={clsx(
        'inline-flex h-[18px] items-center gap-1 rounded-sm border px-1.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.1em]',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Stat({ label, value, unit, tone }: { label: ReactNode; value: ReactNode; unit?: string; tone?: 'aurum' | 'viridis' | 'nova' | 'ion' }) {
  const color = tone === 'aurum' ? 'text-aurum-hi' : tone === 'viridis' ? 'text-viridis' : tone === 'nova' ? 'text-nova' : tone === 'ion' ? 'text-ion-hi' : 'text-ink'
  return (
    <div className="border-l border-line-strong py-0.5 pl-2.5">
      <div className="eyebrow !text-[9px] !tracking-[0.14em]">{label}</div>
      <div className={clsx('mt-0.5 truncate font-mono text-[12.5px] tabular', color)} title={typeof value === 'string' ? value : undefined}>
        {value}
        {unit && <span className="ml-1 text-[10px] text-ink-3">{unit}</span>}
      </div>
    </div>
  )
}
