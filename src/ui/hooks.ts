import { useEffect, useRef, useState } from 'react'
import { AU_KM } from '@/core/scale'
import type { Id } from '@/core/types'
import { runtime } from '@/three/runtime'

export function usePoll<T>(fn: () => T, ms = 250, deps: unknown[] = []): T {
  const fnRef = useRef(fn)
  fnRef.current = fn
  const [value, setValue] = useState<T>(() => fn())
  useEffect(() => {
    setValue(fnRef.current())
    const id = setInterval(() => setValue(fnRef.current()), ms)
    return () => clearInterval(id)
  }, [ms, ...deps])
  return value
}

export function useLiveDistanceKm(a: Id | null, b: Id | null): number | null {
  return usePoll(
    () => {
      if (!a || !b) return null
      const ra = runtime.bodies.get(a)
      const rb = runtime.bodies.get(b)
      if (!ra || !rb) return null
      return ra.posAU.distanceTo(rb.posAU) * AU_KM
    },
    250,
    [a, b],
  )
}

export function useResizeDrag(onDelta: (dx: number) => void, onEnd?: () => void) {
  const last = useRef<number | null>(null)
  return {
    onPointerDown(e: React.PointerEvent) {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      last.current = e.clientX
      document.body.style.cursor = 'col-resize'
    },
    onPointerMove(e: React.PointerEvent) {
      if (last.current === null) return
      const dx = e.clientX - last.current
      last.current = e.clientX
      if (dx) onDelta(dx)
    },
    onPointerUp(e: React.PointerEvent) {
      ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
      last.current = null
      document.body.style.cursor = ''
      onEnd?.()
    },
  }
}
