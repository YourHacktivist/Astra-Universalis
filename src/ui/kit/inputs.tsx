import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { Popover, Select as RSelect, Slider as RSlider, Switch } from 'radix-ui'
import { HexColorPicker } from 'react-colorful'
import { Check, ChevronDown } from 'lucide-react'

const FIELD_BASE =
  'h-7 w-full rounded-md border border-line bg-white/[0.035] text-[12px] text-ink transition-colors duration-150 hover:border-line-strong focus-within:border-aurum/50 focus-within:bg-white/[0.05]'

export interface NumberFieldProps {
  value: number
  onChange(v: number): void
  min?: number
  max?: number
  step?: number
  precision?: number
  unit?: string
  log?: boolean
  disabled?: boolean
  className?: string
  prefix?: ReactNode
  displayFactor?: number
  grouping?: boolean
}

function clamp(v: number, min?: number, max?: number) {
  if (min !== undefined && v < min) v = min
  if (max !== undefined && v > max) v = max
  return v
}

function formatNum(v: number, precision: number, grouping = true) {
  if (!Number.isFinite(v)) return '–'
  const abs = Math.abs(v)
  if (abs !== 0 && (abs >= 1e7 || abs < Math.pow(10, -precision))) return v.toExponential(2).replace('.', ',')
  return v.toLocaleString('fr-FR', { maximumFractionDigits: precision, minimumFractionDigits: 0, useGrouping: grouping })
}

export function NumberField({
  value,
  onChange,
  min,
  max,
  step = 1,
  precision = 2,
  unit,
  log,
  disabled,
  className,
  prefix,
  displayFactor = 1,
  grouping = true,
}: NumberFieldProps) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const drag = useRef<{ x: number; start: number; moved: boolean } | null>(null)

  const shown = value * displayFactor

  const commitText = () => {
    const parsed = parseFloat(text.replace(/\s/g, '').replace(',', '.'))
    if (Number.isFinite(parsed)) onChange(clamp(parsed / displayFactor, min, max))
    setEditing(false)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || editing || e.button !== 0) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, start: value, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    if (!d.moved && Math.abs(dx) < 3) return
    d.moved = true
    const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1
    let next: number
    if (log) {
      const base = d.start === 0 ? step : d.start
      next = base * Math.exp(dx * 0.006 * mult)
    } else {
      next = d.start + Math.round((dx * mult) / 2) * step
    }
    onChange(clamp(Number(next.toFixed(Math.max(precision + 2, 6))), min, max))
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
    if (d && !d.moved) {
      setText(String(Number(shown.toFixed(Math.max(precision, 4)))).replace('.', ','))
      setEditing(true)
    }
  }

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  return (
    <div
      className={clsx(FIELD_BASE, 'relative flex items-center overflow-hidden', disabled && 'pointer-events-none opacity-45', !editing && 'cursor-ew-resize', className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={(e) => {
        if (document.activeElement !== inputRef.current) return
        e.preventDefault()
      }}
    >
      {prefix && <span className="pl-2 text-[10.5px] text-ink-3 [&_svg]:size-3">{prefix}</span>}
      {editing ? (
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitText()
            if (e.key === 'Escape') setEditing(false)
            e.stopPropagation()
          }}
          className="h-full w-full min-w-0 bg-transparent px-2 font-mono text-[11.5px] text-ink outline-none tabular"
        />
      ) : (
        <span className="flex-1 truncate px-2 font-mono text-[11.5px] tabular">{formatNum(shown, precision, grouping)}</span>
      )}
      {unit && !editing && <span className="pointer-events-none pr-2 text-[10.5px] text-ink-3">{unit}</span>}
    </div>
  )
}

export interface SliderProps {
  value: number
  onChange(v: number): void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  format?(v: number): string
  showValue?: boolean
  className?: string
  tone?: 'aurum' | 'ion' | 'viridis' | 'nebula'
}

const TONE_FILL = {
  aurum: 'from-aurum to-aurum',
  ion: 'from-ion to-ion',
  viridis: 'from-viridis to-viridis',
  nebula: 'from-nebula to-nebula',
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  disabled,
  format,
  showValue = true,
  className,
  tone = 'aurum',
}: SliderProps) {
  return (
    <div className={clsx('flex h-7 items-center gap-2.5', disabled && 'pointer-events-none opacity-45', className)}>
      <RSlider.Root
        className="relative flex h-5 flex-1 touch-none select-none items-center"
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
      >
        <RSlider.Track className="relative h-[3px] grow overflow-hidden rounded-full bg-white/[0.09]">
          <RSlider.Range className={clsx('absolute h-full rounded-full bg-gradient-to-r', TONE_FILL[tone])} />
        </RSlider.Track>
        <RSlider.Thumb
          className="block h-3.5 w-2 rounded-[1px] border border-black/60 bg-ink transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurum/60"
          aria-label="Valeur"
        />
      </RSlider.Root>
      {showValue && (
        <span className="w-10 shrink-0 text-right font-mono text-[10.5px] text-ink-2 tabular">
          {format ? format(value) : value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
        </span>
      )}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange(v: boolean): void
  disabled?: boolean
  label?: ReactNode
}) {
  return (
    <label className={clsx('inline-flex h-7 items-center gap-2', disabled && 'pointer-events-none opacity-45')}>
      <Switch.Root
        checked={checked}
        onCheckedChange={onChange}
        className="relative h-[18px] w-[30px] shrink-0 rounded-full border border-line-strong bg-white/[0.07] transition-colors duration-150 data-[state=checked]:border-aurum/60 data-[state=checked]:bg-aurum/80"
      >
        <Switch.Thumb className="block size-3 translate-x-[2px] rounded-full bg-ink-2 shadow transition-transform duration-150 data-[state=checked]:translate-x-[14px] data-[state=checked]:bg-white" />
      </Switch.Root>
      {label && <span className="text-[12px] text-ink-2">{label}</span>}
    </label>
  )
}

export interface SegmentOption<T extends string> {
  value: T
  label?: ReactNode
  icon?: ReactNode
  title?: string
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'sm',
}: {
  value: T
  onChange(v: T): void
  options: SegmentOption<T>[]
  className?: string
  size?: 'xs' | 'sm'
}) {
  return (
    <div className={clsx('flex rounded-lg border border-line bg-white/[0.03] p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={clsx(
            'flex flex-1 items-center justify-center gap-1.5 rounded-md font-medium transition-colors duration-150 [&_svg]:size-3.5',
            size === 'xs' ? 'h-5 px-1.5 text-[10.5px]' : 'h-6 px-2 text-[11.5px]',
            o.value === value ? 'bg-white/[0.1] text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]' : 'text-ink-3 hover:text-ink-2',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export interface SelectOption<T extends string = string> {
  value: T
  label: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  group?: string
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder,
  className,
  disabled,
}: {
  value: T
  onChange(v: T): void
  options: SelectOption<T>[]
  placeholder?: string
  className?: string
  disabled?: boolean
}) {
  const groups: { name: string | undefined; items: SelectOption<T>[] }[] = []
  for (const o of options) {
    const g = groups.find((x) => x.name === o.group)
    if (g) g.items.push(o)
    else groups.push({ name: o.group, items: [o] })
  }
  const current = options.find((o) => o.value === value)
  return (
    <RSelect.Root value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
      <RSelect.Trigger
        className={clsx(
          FIELD_BASE,
          'flex items-center justify-between gap-2 px-2 text-left outline-none data-[state=open]:border-aurum/50 disabled:opacity-45',
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5 truncate [&_svg]:size-3.5">
          {current?.icon}
          <RSelect.Value placeholder={placeholder}>{current?.label}</RSelect.Value>
        </span>
        <RSelect.Icon>
          <ChevronDown className="size-3.5 text-ink-3" />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={4}
          collisionPadding={10}
          className="glass-pop z-[120] max-h-[min(420px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] animate-scale-in overflow-hidden rounded-xl p-1"
        >
          <RSelect.Viewport className="p-0">
            {groups.map((g, gi) => (
              <RSelect.Group key={g.name ?? gi}>
                {g.name && <RSelect.Label className="eyebrow px-2 pb-1 pt-2">{g.name}</RSelect.Label>}
                {g.items.map((o) => (
                  <RSelect.Item
                    key={o.value}
                    value={o.value}
                    className="relative flex h-8 cursor-default select-none items-center gap-2 rounded-lg pl-2 pr-7 text-[12px] text-ink-2 outline-none data-[highlighted]:bg-white/[0.07] data-[state=checked]:text-ink data-[highlighted]:text-ink [&_svg]:size-3.5"
                  >
                    {o.icon}
                    <span className="flex min-w-0 flex-col">
                      <RSelect.ItemText>{o.label}</RSelect.ItemText>
                      {o.hint && <span className="truncate text-[10.5px] text-ink-3">{o.hint}</span>}
                    </span>
                    <RSelect.ItemIndicator className="absolute right-2">
                      <Check className="size-3.5 text-aurum" />
                    </RSelect.ItemIndicator>
                  </RSelect.Item>
                ))}
              </RSelect.Group>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  )
}

const PRESET_SWATCHES = [
  '#E9B96E', '#8AB0FF', '#7EE2A8', '#FF7B6B', '#A792FF', '#F2F4F8',
  '#FFD27A', '#FF8A3A', '#5AB4FF', '#40E0D0', '#C070FF', '#8A8F98',
]

export function ColorField({
  value,
  onChange,
  swatches = PRESET_SWATCHES,
  className,
  compact,
}: {
  value: string
  onChange(v: string): void
  swatches?: string[]
  className?: string
  compact?: boolean
}) {
  const [hex, setHex] = useState(value)
  useEffect(() => setHex(value), [value])
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={clsx(
            compact ? 'h-7 w-7 justify-center' : clsx(FIELD_BASE, 'gap-2 px-1.5'),
            'flex items-center rounded-md border border-line outline-none hover:border-line-strong data-[state=open]:border-aurum/50',
            className,
          )}
        >
          <span
            className="size-4 shrink-0 rounded-[5px] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.15)]"
            style={{ background: value }}
          />
          {!compact && <span className="font-mono text-[11px] uppercase text-ink-2">{value}</span>}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="left"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="glass-pop z-[130] w-[220px] animate-scale-in rounded-xl p-3"
        >
          <div className="astra-colorful">
            <HexColorPicker color={value} onChange={onChange} />
          </div>
          <div className="mt-3 grid grid-cols-6 gap-1.5">
            {swatches.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChange(s)}
                className={clsx(
                  'aspect-square rounded-md shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)] transition-transform hover:scale-110',
                  s.toLowerCase() === value.toLowerCase() && 'ring-1 ring-aurum ring-offset-1 ring-offset-[#151826]',
                )}
                style={{ background: s }}
              />
            ))}
          </div>
          <input
            value={hex}
            onChange={(e) => {
              setHex(e.target.value)
              if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value)
            }}
            onKeyDown={(e) => e.stopPropagation()}
            className="mt-3 h-7 w-full rounded-md border border-line bg-white/[0.04] px-2 font-mono text-[11.5px] uppercase text-ink outline-none focus:border-aurum/50"
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export const TextField = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function TextField(
  { className, onKeyDown, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      onKeyDown={(e) => {
        e.stopPropagation()
        onKeyDown?.(e)
      }}
      className={clsx(FIELD_BASE, 'px-2 outline-none placeholder:text-ink-3', className)}
      {...rest}
    />
  )
})

export const TextArea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(
  { className, onKeyDown, rows = 3, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      onKeyDown={(e) => {
        e.stopPropagation()
        onKeyDown?.(e)
      }}
      className={clsx(
        'w-full resize-y rounded-md border border-line bg-white/[0.035] px-2 py-1.5 text-[12px] leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-3 hover:border-line-strong focus:border-aurum/50 focus:bg-white/[0.05]',
        className,
      )}
      {...rest}
    />
  )
})
