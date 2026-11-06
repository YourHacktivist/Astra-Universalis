import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { ChevronsLeft, ChevronsRight, Film, Minimize2, Orbit, Pause, Play, RectangleHorizontal, Tag } from 'lucide-react'
import { KIND_LABEL, PLANET_TYPE_LABEL } from '@/core/labels'
import { derivedStats } from '@/core/physics'
import { spectralLabel } from '@/core/starPresets'
import type { Body, StarSystem } from '@/core/types'
import { formatDays, formatDistanceAU, formatSimDate, formatSpeed, num } from '@/lib/format'
import { bridge } from '@/lib/platform'
import { useSimStore, useSimTime } from '@/store/simStore'
import { useUIStore } from '@/store/uiStore'
import { Kbd, Tooltip } from '../kit'

const IDLE_MS = 2600
const LETTERBOX_RATIO = 2.39

export function useImmersiveFullscreen() {
  const immersive = useUIStore((s) => s.immersive)
  const entered = useRef(false)
  const electronFs = useRef(false)

  useEffect(() => bridge?.window.onFullscreen((v) => (electronFs.current = v)), [])

  useEffect(() => {
    if (immersive) {
      if (bridge) {
        if (!electronFs.current) {
          bridge.window.toggleFullscreen()
          entered.current = true
        }
      } else if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().then(
          () => (entered.current = true),
          () => undefined,
        )
      }
    } else if (entered.current) {
      entered.current = false
      if (bridge) {
        if (electronFs.current) bridge.window.toggleFullscreen()
      } else if (document.fullscreenElement) void document.exitFullscreen?.()
    }
  }, [immersive])

  useEffect(() => {
    if (bridge) return
    const on = () => {
      if (!document.fullscreenElement && entered.current) {
        entered.current = false
        useUIStore.getState().setImmersive(false)
      }
    }
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])
}

function useIdle(ms: number) {
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const wake = () => {
      setIdle(false)
      clearTimeout(t)
      t = setTimeout(() => setIdle(true), ms)
    }
    wake()
    window.addEventListener('pointermove', wake)
    window.addEventListener('pointerdown', wake)
    window.addEventListener('keydown', wake)
    window.addEventListener('wheel', wake, { passive: true })
    return () => {
      clearTimeout(t)
      window.removeEventListener('pointermove', wake)
      window.removeEventListener('pointerdown', wake)
      window.removeEventListener('keydown', wake)
      window.removeEventListener('wheel', wake)
    }
  }, [ms])
  return idle
}

function subtitle(b: Body, system: StarSystem) {
  const parent = b.parentId ? system.bodies[b.parentId] : null
  let type: string = KIND_LABEL[b.kind]
  if (b.kind === 'star') type = spectralLabel(b.props)
  if (b.kind === 'planet' || b.kind === 'moon') type = PLANET_TYPE_LABEL[b.props.planetType]
  return parent ? `${type} · ${parent.name}` : type
}

function LowerThird({ body, system }: { body: Body; system: StarSystem }) {
  const stats = derivedStats(system, body)
  const items: [string, string][] = []
  if (stats.distanceAU !== null && body.parentId) items.push(['Distance', formatDistanceAU(stats.distanceAU)])
  if (Number.isFinite(stats.periodDays)) items.push(['Révolution', formatDays(stats.periodDays)])
  if (stats.surfaceK !== null) items.push(['Température', `${num(stats.surfaceK - 273.15, 0)} °C`])
  if (stats.gravityG !== null) items.push(['Gravité', `${num(stats.gravityG, 2)} g`])
  if (body.kind === 'star') items.push(['Température', `${num(body.props.temperature, 0)} K`], ['Luminosité', `${num(body.props.luminosity)} L☉`])
  const pop = body.notes.population

  return (
    <div key={body.id} className="animate-rise-in">
      <div className="flex items-center gap-3">
        <span className="h-10 w-[3px] rounded-full" style={{ background: body.color, boxShadow: `0 0 14px ${body.color}` }} />
        <div>
          <div className="font-display text-[34px] font-semibold leading-none tracking-[0.03em] text-ink [text-shadow:0_2px_18px_rgb(0_0_0/0.9)]">
            {body.name}
          </div>
          <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-2 [text-shadow:0_1px_8px_rgb(0_0_0/0.9)]">
            {subtitle(body, system)}
          </div>
        </div>
      </div>
      {(items.length > 0 || pop) && (
        <div className="ml-[15px] mt-3 flex flex-wrap gap-x-6 gap-y-1">
          {items.slice(0, 4).map(([k, v]) => (
            <div key={k}>
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-3">{k}</div>
              <div className="font-mono text-[12px] text-ink [text-shadow:0_1px_8px_rgb(0_0_0/0.9)]">{v}</div>
            </div>
          ))}
          {pop && (
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-3">Population</div>
              <div className="font-mono text-[12px] text-ink">{pop}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ImmersiveHud({ system }: { system: StarSystem }) {
  const idle = useIdle(IDLE_MS)
  const t = useSimTime(4)
  const playing = useSimStore((s) => s.playing)
  const speed = useSimStore((s) => s.speed)
  const drift = useUIStore((s) => s.cinematicDrift)
  const letterbox = useUIStore((s) => s.letterbox)
  const labels = useUIStore((s) => s.view.labels)
  const orbits = useUIStore((s) => s.view.orbits)
  const focusId = useUIStore((s) => s.followId ?? s.selectedId)
  const playerMode = useUIStore((s) => s.playerMode)
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])

  const ui = useUIStore.getState()
  const sim = useSimStore.getState()
  const body = focusId ? system.bodies[focusId] : null
  const shownBody = body && (!playerMode || body.playerVisible) ? body : null
  const bar = letterbox ? Math.max(0, (size.h - size.w / LETTERBOX_RATIO) / 2) : 0
  const era = system.calendar.era ? ` ${system.calendar.era}` : ''

  useEffect(() => {
    document.body.style.cursor = idle ? 'none' : ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [idle])

  const pill = 'inline-flex size-8 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-white/[0.08] hover:text-ink [&_svg]:size-4 [&_svg]:stroke-[1.6]'

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="absolute inset-x-0 top-0 bg-black transition-[height] duration-700 ease-out" style={{ height: bar }} />
      <div className="absolute inset-x-0 bottom-0 bg-black transition-[height] duration-700 ease-out" style={{ height: bar }} />

      <div
        className={clsx('absolute left-10 transition-opacity duration-700', idle ? 'opacity-0' : 'opacity-100')}
        style={{ top: bar + 32 }}
      >
        <div className="flex items-center gap-4">
          <img src="./brand/logo-night-128.png" alt="" className="size-12 opacity-90" draggable={false} />
          <div>
            <div className="font-display text-[30px] font-semibold leading-none tracking-[0.05em] text-ink [text-shadow:0_2px_20px_rgb(0_0_0/0.9)]">{system.name}</div>
            <div className="mt-1.5 h-px w-40 bg-gradient-to-r from-aurum/80 to-transparent" />
            <div className="mt-1.5 font-mono text-[10.5px] tracking-[0.12em] text-ion-hi/90">
              {system.designation ? `${system.designation} · ` : ''}
              {formatSimDate(system.calendar.epochYear, t)}
              {era}
            </div>
          </div>
        </div>
      </div>

      {shownBody && (
        <div className="absolute left-10 transition-all duration-500" style={{ bottom: bar + (idle ? 36 : 92) }}>
          <LowerThird body={shownBody} system={system} />
        </div>
      )}

      <div
        className={clsx(
          'absolute left-1/2 -translate-x-1/2 transition-all duration-500',
          idle ? 'pointer-events-none translate-y-3 opacity-0' : 'pointer-events-auto opacity-100',
        )}
        style={{ bottom: bar + 24 }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/45 px-2 py-1.5 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.9)]">
          <Tooltip content="Ralentir" shortcut="−">
            <button className={pill} onClick={() => sim.stepSpeed(-1)}>
              <ChevronsLeft />
            </button>
          </Tooltip>
          <Tooltip content={playing ? 'Pause' : 'Lecture'} shortcut="Espace">
            <button className={clsx(pill, '!size-9 bg-white/[0.07] text-ink')} onClick={() => sim.togglePlaying()}>
              {playing ? <Pause /> : <Play />}
            </button>
          </Tooltip>
          <Tooltip content="Accélérer" shortcut="+">
            <button className={pill} onClick={() => sim.stepSpeed(1)}>
              <ChevronsRight />
            </button>
          </Tooltip>
          <span className="w-[72px] text-center font-mono text-[11px] text-ink-2 tabular">{playing ? formatSpeed(speed) : 'Pause'}</span>
          <span className="mx-1 h-5 w-px bg-white/10" />
          <Tooltip content={drift ? 'Arrêter la dérive cinématique' : 'Dérive cinématique de la caméra'}>
            <button className={clsx(pill, drift && '!text-aurum-hi bg-aurum/15')} onClick={() => ui.setCinematicDrift(!drift)}>
              <Film />
            </button>
          </Tooltip>
          <Tooltip content={letterbox ? 'Retirer les bandes cinéma' : 'Bandes cinéma (2,39:1)'}>
            <button className={clsx(pill, letterbox && '!text-aurum-hi bg-aurum/15')} onClick={() => ui.setLetterbox(!letterbox)}>
              <RectangleHorizontal />
            </button>
          </Tooltip>
          <Tooltip content="Étiquettes" shortcut="L">
            <button className={clsx(pill, labels && '!text-ion-hi')} onClick={() => ui.toggleView('labels')}>
              <Tag />
            </button>
          </Tooltip>
          <Tooltip content="Orbites" shortcut="O">
            <button className={clsx(pill, orbits && '!text-ion-hi')} onClick={() => ui.toggleView('orbits')}>
              <Orbit />
            </button>
          </Tooltip>
          <span className="mx-1 h-5 w-px bg-white/10" />
          <Tooltip content="Quitter le mode immersif" shortcut="Échap">
            <button className={clsx(pill, 'gap-1.5 !w-auto px-3 text-[11.5px]')} onClick={() => ui.setImmersive(false)}>
              <Minimize2 />
              Quitter
            </button>
          </Tooltip>
        </div>
        <div className="mt-2 flex justify-center gap-3 text-[10px] text-ink-3">
          <span className="flex items-center gap-1">
            <Kbd>I</Kbd> mode immersif
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Double-clic</Kbd> voler vers un astre
          </span>
        </div>
      </div>
    </div>
  )
}
