import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { CalendarDays, ChevronsLeft, ChevronsRight, History, Pause, Play, Repeat2 } from 'lucide-react'
import type { StarSystem } from '@/core/types'
import { formatSimDate, formatSpeed, pad2, simDate } from '@/lib/format'
import { simClock, SPEED_STEPS, useSimStore, useSimTime } from '@/store/simStore'
import { Button, NumberField, PopoverContent, PopoverRoot, PopoverTrigger, Tooltip } from '../kit'

export function daysForDate(epochYear: number, year: number, month: number, day: number, hour = 0, minute = 0) {
  return (Date.UTC(year - epochYear + 2000, month - 1, day, hour, minute) - Date.UTC(2000, 0, 1)) / 86_400_000
}

const BTN =
  'inline-flex size-7 items-center justify-center rounded-sm text-ink-2 transition-colors hover:bg-white/[0.06] hover:text-ink disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-[15px] [&_svg]:stroke-[1.6]'

export function TimeBar({ system, compact }: { system: StarSystem; compact?: boolean }) {
  const playing = useSimStore((s) => s.playing)
  const speed = useSimStore((s) => s.speed)
  const t = useSimTime(15)
  const sim = useSimStore.getState()
  const epoch = system.calendar.epochYear
  const [d, time] = formatSimDate(epoch, t, true).split(' · ')
  const reversed = speed < 0

  return (
    <div
      role="group"
      aria-label="Contrôle du temps"
      className="flex h-10 shrink-0 items-center gap-0.5 border-t border-line bg-abyss px-1.5"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Tooltip content="Ralentir" shortcut="−">
        <button aria-label="Ralentir" className={BTN} onClick={() => sim.stepSpeed(-1)} disabled={Math.abs(speed) <= SPEED_STEPS[0] * 1.001}>
          <ChevronsLeft />
        </button>
      </Tooltip>
      <Tooltip content={playing ? 'Pause' : 'Lecture'} shortcut="Espace">
        <button
          aria-label={playing ? 'Pause' : 'Lecture'}
          onClick={() => sim.togglePlaying()}
          className={clsx(BTN, '!size-8', !playing && '!bg-aurum !text-[#15100a] hover:!bg-aurum-hi')}
        >
          {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" className="ml-0.5" />}
        </button>
      </Tooltip>
      <Tooltip content="Accélérer" shortcut="+">
        <button aria-label="Accélérer" className={BTN} onClick={() => sim.stepSpeed(1)} disabled={Math.abs(speed) >= SPEED_STEPS[SPEED_STEPS.length - 1] * 0.999}>
          <ChevronsRight />
        </button>
      </Tooltip>
      <SpeedPicker speed={speed} />
      <Tooltip content={reversed ? 'Rétablir le sens du temps' : 'Inverser le temps'} shortcut="R">
        <button aria-label="Inverser le temps" aria-pressed={reversed} className={clsx(BTN, reversed && '!text-aurum-hi bg-aurum/[0.1]')} onClick={() => sim.reverse()}>
          <Repeat2 />
        </button>
      </Tooltip>

      <span aria-hidden className="mx-2 h-5 w-px bg-line" />

      <PopoverRoot>
        <PopoverTrigger asChild>
          <button aria-label="Aller à une date" className="group flex h-8 shrink-0 items-baseline gap-2 rounded-sm px-2 text-left transition-colors hover:bg-white/[0.05] data-[state=open]:bg-white/[0.06]">
            <CalendarDays className="size-3.5 self-center text-ink-3 group-hover:text-ion" />
            <span className="font-mono text-[13px] text-ink tabular">{d}</span>
            {!compact && <span className="font-mono text-[12px] text-ink-2 tabular">{time}</span>}
            {!compact && (
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3 tabular">
                {system.calendar.era ? `${system.calendar.era} · ` : ''}J{t >= 0 ? '+' : ''}
                {Math.floor(t).toLocaleString('fr-FR')}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" sideOffset={8} className="w-[300px] p-3.5">
          <DateJumper system={system} />
        </PopoverContent>
      </PopoverRoot>

      <span aria-hidden className="mx-2 h-5 w-px bg-line" />
      <Timeline epoch={epoch} t={t} />
    </div>
  )
}

const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

interface Tick {
  x: number
  major: boolean
  label?: string
}

function buildTicks(epoch: number, t: number, w: number, daysPerPx: number): Tick[] {
  const start = t - (w / 2) * daysPerPx
  const end = t + (w / 2) * daysPerPx
  const ticks: Tick[] = []
  const x = (days: number) => (days - t) / daysPerPx + w / 2
  const s = simDate(epoch, start)
  if (daysPerPx < 0.15) {
    let day = Math.floor(start)
    while (day <= end && ticks.length < 400) {
      const dd = simDate(epoch, day)
      ticks.push({ x: x(day), major: dd.day === 1, label: daysPerPx < 0.05 || dd.day % 7 === 1 ? String(dd.day) : undefined })
      day += 1
    }
  } else if (daysPerPx < 4) {
    let y = s.year
    let m = s.month
    for (let i = 0; i < 400; i++) {
      const day = daysForDate(epoch, y, m, 1)
      if (day > end) break
      if (day >= start) ticks.push({ x: x(day), major: m === 1, label: m === 1 ? String(y) : daysPerPx < 1.2 ? MONTH_INITIALS[m - 1] : undefined })
      m++
      if (m > 12) {
        m = 1
        y++
      }
    }
  } else {
    const step = daysPerPx < 25 ? 1 : daysPerPx < 120 ? 5 : 10
    let y = Math.floor(s.year / step) * step
    for (let i = 0; i < 400; i++) {
      const day = daysForDate(epoch, y, 1, 1)
      if (day > end) break
      if (day >= start) ticks.push({ x: x(day), major: y % (step * 5) === 0, label: y % (step * (daysPerPx < 25 ? 5 : 2)) === 0 ? String(y) : undefined })
      y += step
    }
  }
  return ticks
}

function Timeline({ epoch, t }: { epoch: number; t: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(300)
  const [scale, setScale] = useState(1.4)
  const drag = useRef<{ x: number; t: number; wasPlaying: boolean } | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const on = (e: WheelEvent) => {
      e.preventDefault()
      setScale((s) => Math.min(400, Math.max(0.01, s * Math.exp(e.deltaY * 0.0015))))
    }
    el.addEventListener('wheel', on, { passive: false })
    return () => el.removeEventListener('wheel', on)
  }, [])

  const sim = useSimStore.getState
  const ticks = buildTicks(epoch, t, w, scale)

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 30 : 1
    let dt = 0
    if (e.key === 'ArrowLeft') dt = -step
    else if (e.key === 'ArrowRight') dt = step
    else if (e.key === 'PageDown') dt = -365.25
    else if (e.key === 'PageUp') dt = 365.25
    else if (e.key === 'Home') {
      e.preventDefault()
      e.stopPropagation()
      sim().setTime(0)
      return
    } else return
    e.preventDefault()
    e.stopPropagation()
    sim().setTime(simClock.time + dt)
  }

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Frise temporelle : glisser pour parcourir le temps, molette pour zoomer"
      aria-valuetext={formatSimDate(epoch, t, false)}
      aria-valuenow={Math.round(t)}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        const s = sim()
        drag.current = { x: e.clientX, t: simClock.time, wasPlaying: s.playing }
        s.setPlaying(false)
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d) return
        sim().setTime(d.t - (e.clientX - d.x) * scale)
      }}
      onPointerUp={() => {
        const d = drag.current
        drag.current = null
        if (d?.wasPlaying) sim().setPlaying(true)
      }}
      className="relative h-full min-w-[120px] flex-1 cursor-ew-resize touch-none overflow-hidden"
    >
      {ticks.map((k, i) => (
        <span key={i} className="pointer-events-none absolute bottom-0" style={{ left: k.x }}>
          <span className={clsx('absolute bottom-0 w-px', k.major ? 'h-3 bg-ink-3' : 'h-1.5 bg-white/20')} />
          {k.label && (
            <span className={clsx('absolute bottom-3.5 -translate-x-1/2 font-mono text-[9.5px] tabular', k.major ? 'text-ink-2' : 'text-ink-3')}>{k.label}</span>
          )}
        </span>
      ))}
      <span className="pointer-events-none absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-aurum" />
      <span className="pointer-events-none absolute left-1/2 top-1 size-0 -translate-x-1/2 border-x-[4px] border-t-[5px] border-x-transparent border-t-aurum" />
      <span className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-abyss to-transparent" />
      <span className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-abyss to-transparent" />
    </div>
  )
}

function SpeedPicker({ speed }: { speed: number }) {
  const sim = useSimStore.getState()
  const a = Math.abs(speed)
  return (
    <PopoverRoot>
      <Tooltip content="Vitesse de simulation">
        <PopoverTrigger asChild>
          <button aria-label="Vitesse de simulation" className="flex h-7 min-w-[70px] items-center justify-center rounded-sm px-2 font-mono text-[11.5px] text-ion-hi transition-colors hover:bg-white/[0.05] data-[state=open]:bg-white/[0.06] tabular">
            {formatSpeed(speed)}
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent side="top" sideOffset={8} className="w-[220px] p-1.5">
        <div className="eyebrow px-2 pb-1.5 pt-1">Temps simulé / seconde</div>
        <div className="grid grid-cols-2 gap-px">
          {SPEED_STEPS.map((s) => (
            <button
              key={s}
              onClick={() => {
                sim.setSpeed(speed < 0 ? -s : s)
                sim.setPlaying(true)
              }}
              className={clsx(
                'h-7 rounded-sm font-mono text-[11px] transition-colors',
                Math.abs(a - s) / s < 0.01 ? 'bg-ion/15 text-ion-hi' : 'text-ink-2 hover:bg-white/[0.06] hover:text-ink',
              )}
            >
              {formatSpeed(s)}
            </button>
          ))}
        </div>
      </PopoverContent>
    </PopoverRoot>
  )
}

function DateJumper({ system }: { system: StarSystem }) {
  const epoch = system.calendar.epochYear
  const [form, setForm] = useState(() => simDate(epoch, simClock.time))
  useEffect(() => setForm(simDate(epoch, simClock.time)), [epoch])
  const setTime = useSimStore.getState().setTime
  const shift = (days: number) => {
    setTime(simClock.time + days)
    setForm(simDate(epoch, simClock.time))
  }
  const go = () => setTime(daysForDate(epoch, form.year, form.month, form.day, form.hour, form.minute))
  return (
    <div className="space-y-3">
      <div>
        <div className="font-display text-[17px] font-semibold tracking-wide">Aller à une date</div>
        <p className="text-[11px] text-ink-3">Les positions de tous les astres sont recalculées instantanément.</p>
      </div>
      <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-1.5">
        <Labeled label="Année">
          <NumberField value={form.year} onChange={(v) => setForm({ ...form, year: Math.round(v) })} precision={0} step={1} grouping={false} />
        </Labeled>
        <Labeled label="Mois">
          <NumberField value={form.month} onChange={(v) => setForm({ ...form, month: Math.round(v) })} min={1} max={12} precision={0} step={1} />
        </Labeled>
        <Labeled label="Jour">
          <NumberField value={form.day} onChange={(v) => setForm({ ...form, day: Math.round(v) })} min={1} max={31} precision={0} step={1} />
        </Labeled>
      </div>
      <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-1.5">
        <Labeled label="Heure">
          <NumberField value={form.hour} onChange={(v) => setForm({ ...form, hour: Math.round(v) })} min={0} max={23} precision={0} step={1} />
        </Labeled>
        <Labeled label="Minute">
          <NumberField value={form.minute} onChange={(v) => setForm({ ...form, minute: Math.round(v) })} min={0} max={59} precision={0} step={1} />
        </Labeled>
        <div className="flex items-end">
          <Button variant="primary" size="sm" className="w-full" onClick={go}>
            Aller
          </Button>
        </div>
      </div>
      <div className="font-mono text-[10.5px] text-ink-3">
        → {form.year}-{pad2(form.month)}-{pad2(form.day)} {pad2(form.hour)}:{pad2(form.minute)}
      </div>
      <div className="hairline" />
      <div className="grid grid-cols-4 gap-1">
        {(
          [
            ['−1 an', -365.25],
            ['−1 mois', -30.44],
            ['+1 mois', 30.44],
            ['+1 an', 365.25],
            ['−1 j', -1],
            ['−1 h', -1 / 24],
            ['+1 h', 1 / 24],
            ['+1 j', 1],
          ] as const
        ).map(([l, dd]) => (
          <button key={l} onClick={() => shift(dd)} className="h-7 rounded-sm border border-line font-mono text-[10.5px] text-ink-2 hover:border-line-strong hover:text-ink">
            {l}
          </button>
        ))}
      </div>
      <Button
        size="sm"
        variant="ghost"
        icon={<History className="size-3.5" />}
        className="w-full"
        onClick={() => {
          setTime(0)
          setForm(simDate(epoch, 0))
        }}
      >
        Revenir à l'origine (1ᵉʳ janvier {epoch})
      </Button>
    </div>
  )
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] text-ink-3">{label}</span>
      {children}
    </label>
  )
}
