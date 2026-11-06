import { useEffect, useState } from 'react'
import { create } from 'zustand'

export const simClock = { time: 0 }

export const SPEED_STEPS = [
  1 / 1440,
  1 / 144,
  1 / 24,
  1 / 4,
  1,
  3,
  7,
  30.44,
  91.31,
  365.25,
  1826.25,
  3652.5,
]

interface SimState {
  playing: boolean
  speed: number
  setPlaying(v: boolean): void
  togglePlaying(): void
  setSpeed(v: number): void
  stepSpeed(dir: 1 | -1): void
  reverse(): void
  setTime(t: number): void
  timeVersion: number
}

export const useSimStore = create<SimState>()((set, get) => ({
  playing: true,
  speed: 1,
  timeVersion: 0,
  setPlaying: (playing) => set({ playing }),
  togglePlaying: () => set({ playing: !get().playing }),
  setSpeed: (speed) => set({ speed }),
  stepSpeed(dir) {
    const { speed } = get()
    const sign = speed < 0 ? -1 : 1
    const a = Math.abs(speed)
    let idx = SPEED_STEPS.findIndex((s) => s >= a * 0.999)
    if (idx < 0) idx = SPEED_STEPS.length - 1
    const next = Math.min(SPEED_STEPS.length - 1, Math.max(0, idx + dir))
    set({ speed: sign * SPEED_STEPS[next], playing: true })
  },
  reverse: () => set({ speed: -get().speed }),
  setTime(t) {
    simClock.time = t
    set({ timeVersion: get().timeVersion + 1 })
  },
}))

export function tickSim(deltaSeconds: number) {
  const { playing, speed } = useSimStore.getState()
  if (playing) simClock.time += speed * Math.min(deltaSeconds, 0.25)
}

export function useSimTime(fps = 12): number {
  const [t, setT] = useState(simClock.time)
  const version = useSimStore((s) => s.timeVersion)
  useEffect(() => {
    setT(simClock.time)
    let raf = 0
    let last = 0
    const loop = (now: number) => {
      if (now - last > 1000 / fps) {
        last = now
        setT(simClock.time)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [fps, version])
  return t
}
