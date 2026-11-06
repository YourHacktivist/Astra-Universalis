import type { ReactNode } from 'react'
import type { Body } from '@/core/types'
import {
  ColorField,
  Field,
  NumberField,
  Segmented,
  Select,
  Slider,
  Toggle,
  type NumberFieldProps,
  type SegmentOption,
  type SelectOption,
  type SliderProps,
} from '../kit'
import { setProp, setPropGroup } from './edit'

type Rec = Record<string, unknown>

export const pct = (v: number) => `${Math.round(v * 100)} %`
export const deg = (v: number) => `${Math.round(v)}°`
export const times = (v: number) => `×${v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}`
export const int = (v: number) => Math.round(v).toLocaleString('fr-FR')

export function SliderRow({ label, hint, ...rest }: { label: ReactNode; hint?: string } & SliderProps) {
  return (
    <Field label={label} hint={hint}>
      <Slider {...rest} />
    </Field>
  )
}

export function NumberRow({ label, hint, ...rest }: { label: ReactNode; hint?: string } & NumberFieldProps) {
  return (
    <Field label={label} hint={hint}>
      <NumberField {...rest} />
    </Field>
  )
}

export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: ReactNode
  hint?: string
  checked: boolean
  onChange(v: boolean): void
  disabled?: boolean
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex justify-end">
        <Toggle checked={checked} onChange={onChange} disabled={disabled} />
      </div>
    </Field>
  )
}

export function ColorRow({ label, hint, value, onChange }: { label: ReactNode; hint?: string; value: string; onChange(v: string): void }) {
  return (
    <Field label={label} hint={hint}>
      <ColorField value={value} onChange={onChange} />
    </Field>
  )
}

export function SelectRow<T extends string>({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: ReactNode
  hint?: string
  value: T
  onChange(v: T): void
  options: SelectOption<T>[]
}) {
  return (
    <Field label={label} hint={hint}>
      <Select value={value} onChange={onChange} options={options} />
    </Field>
  )
}

export function SegmentedRow<T extends string>({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: ReactNode
  hint?: string
  value: T
  onChange(v: T): void
  options: SegmentOption<T>[]
}) {
  return (
    <Field label={label} hint={hint}>
      <Segmented value={value} onChange={onChange} options={options} size="xs" />
    </Field>
  )
}

interface BoundBase {
  body: Body
  k: string
  group?: string
  label: ReactNode
  hint?: string
}

function read(body: Body, k: string, group?: string): unknown {
  const props = body.props as unknown as Rec
  const src = group ? (props[group] as Rec | undefined) : props
  return src?.[k]
}

function write(body: Body, k: string, group: string | undefined, v: unknown) {
  if (group) setPropGroup(body, group, k, v)
  else setProp(body, k, v)
}

export function PSlider({ body, k, group, label, hint, ...rest }: BoundBase & Omit<SliderProps, 'value' | 'onChange'>) {
  return <SliderRow label={label} hint={hint} value={Number(read(body, k, group) ?? 0)} onChange={(v) => write(body, k, group, v)} {...rest} />
}

export function PNumber({ body, k, group, label, hint, ...rest }: BoundBase & Omit<NumberFieldProps, 'value' | 'onChange'>) {
  return <NumberRow label={label} hint={hint} value={Number(read(body, k, group) ?? 0)} onChange={(v) => write(body, k, group, v)} {...rest} />
}

export function PToggle({ body, k, group, label, hint, disabled }: BoundBase & { disabled?: boolean }) {
  return <ToggleRow label={label} hint={hint} checked={!!read(body, k, group)} onChange={(v) => write(body, k, group, v)} disabled={disabled} />
}

export function PColor({ body, k, group, label, hint }: BoundBase) {
  return <ColorRow label={label} hint={hint} value={String(read(body, k, group) ?? '#ffffff')} onChange={(v) => write(body, k, group, v)} />
}

export function PSelect<T extends string>({ body, k, group, label, hint, options }: BoundBase & { options: SelectOption<T>[] }) {
  return <SelectRow label={label} hint={hint} value={String(read(body, k, group)) as T} onChange={(v) => write(body, k, group, v)} options={options} />
}

export function SubHeading({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 pb-0.5 pt-2.5 first:pt-0">
      <span className="text-[10.5px] font-medium tracking-wide text-ink-2">{children}</span>
      <span className="h-px flex-1 bg-line" />
      {actions}
    </div>
  )
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-[11px] leading-relaxed text-ink-3">{children}</p>
}
