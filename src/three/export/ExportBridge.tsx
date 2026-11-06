import { useEffect } from 'react'
import { useFrame, useThree, type RootState } from '@react-three/fiber'

type CaptureCallback = (state: RootState) => void

export const exportBridge: {
  getState: (() => RootState) | null
  wait: number
  pending: CaptureCallback | null
  afterFrames(frames: number, cb: CaptureCallback): void
} = {
  getState: null,
  wait: 0,
  pending: null,
  afterFrames(frames, cb) {
    this.wait = Math.max(1, frames)
    this.pending = cb
  },
}

export function ExportBridge() {
  const get = useThree((s) => s.get)
  useEffect(() => {
    exportBridge.getState = get
    return () => {
      if (exportBridge.getState === get) exportBridge.getState = null
    }
  }, [get])

  useFrame((state) => {
    if (!exportBridge.pending) return
    if (--exportBridge.wait > 0) return
    const cb = exportBridge.pending
    exportBridge.pending = null
    cb(state)
  }, 10)

  return null
}
