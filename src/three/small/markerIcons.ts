import * as THREE from 'three'
import type { MarkerType } from '@/core/types'

export const MARKER_ICON_INDEX: Record<MarkerType, number> = {
  poi: 0,
  distress: 1,
  derelict: 2,
  anomaly: 3,
  danger: 4,
  outpost: 5,
  cache: 6,
  combat: 7,
  unknown: 8,
}

const CELL = 128
let atlas: THREE.CanvasTexture | null = null

type Ctx = CanvasRenderingContext2D

function drawIcon(ctx: Ctx, type: MarkerType) {
  const c = CELL / 2
  ctx.save()
  ctx.translate(c, c)
  ctx.strokeStyle = '#fff'
  ctx.fillStyle = '#fff'
  ctx.lineWidth = 7
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const R = 34
  switch (type) {
    case 'poi': {
      ctx.beginPath()
      ctx.moveTo(0, -R)
      ctx.lineTo(R, 0)
      ctx.lineTo(0, R)
      ctx.lineTo(-R, 0)
      ctx.closePath()
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, 0, 9, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'distress': {
      for (const r of [18, 32]) {
        ctx.beginPath()
        ctx.arc(0, 4, r, -Math.PI * 0.8, -Math.PI * 0.2)
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.moveTo(0, 2)
      ctx.lineTo(0, 22)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, 34, 4.5, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'derelict': {
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2
        const x = Math.cos(a) * R
        const y = Math.sin(a) * R
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.stroke()
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(-8, -R)
      ctx.lineTo(4, -8)
      ctx.lineTo(-6, 6)
      ctx.lineTo(8, R)
      ctx.stroke()
      break
    }
    case 'anomaly': {
      ctx.lineWidth = 6
      ctx.beginPath()
      for (let t = 0; t < 1; t += 0.01) {
        const a = t * Math.PI * 5.2
        const r = 4 + t * R
        const x = Math.cos(a) * r
        const y = Math.sin(a) * r
        if (t === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      break
    }
    case 'danger': {
      ctx.beginPath()
      ctx.moveTo(0, -R)
      ctx.lineTo(R * 1.02, R * 0.78)
      ctx.lineTo(-R * 1.02, R * 0.78)
      ctx.closePath()
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, -12)
      ctx.lineTo(0, 8)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, 19, 4.5, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'outpost': {
      ctx.beginPath()
      ctx.arc(0, 12, 26, Math.PI, 0)
      ctx.lineTo(-26, 12)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(-R, 22)
      ctx.lineTo(R, 22)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, -14)
      ctx.lineTo(0, -R)
      ctx.stroke()
      break
    }
    case 'cache': {
      ctx.strokeRect(-28, -22, 56, 46)
      ctx.beginPath()
      ctx.moveTo(-28, -6)
      ctx.lineTo(28, -6)
      ctx.moveTo(0, -22)
      ctx.lineTo(0, 24)
      ctx.stroke()
      break
    }
    case 'combat': {
      ctx.beginPath()
      ctx.arc(0, 0, 24, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      for (const [x1, y1, x2, y2] of [
        [0, -R - 4, 0, -12],
        [0, R + 4, 0, 12],
        [-R - 4, 0, -12, 0],
        [R + 4, 0, 12, 0],
      ])
        ctx.moveTo(x1, y1), ctx.lineTo(x2, y2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, 0, 4, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'unknown':
    default: {
      ctx.font = '700 76px IBM Plex Sans Variable, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('?', 0, 4)
      ctx.beginPath()
      ctx.arc(0, 0, R + 4, 0, Math.PI * 2)
      ctx.lineWidth = 4
      ctx.setLineDash([8, 7])
      ctx.stroke()
      break
    }
  }
  ctx.restore()
}

export function getMarkerAtlas(): THREE.CanvasTexture {
  if (atlas) return atlas
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = CELL * 3
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  for (const [type, idx] of Object.entries(MARKER_ICON_INDEX) as [MarkerType, number][]) {
    ctx.save()
    ctx.translate((idx % 3) * CELL, Math.floor(idx / 3) * CELL)
    drawIcon(ctx, type)
    ctx.restore()
  }
  atlas = new THREE.CanvasTexture(canvas)
  atlas.colorSpace = THREE.NoColorSpace
  atlas.generateMipmaps = true
  atlas.minFilter = THREE.LinearMipmapLinearFilter
  return atlas
}

export function makeCodeTexture(code: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.font = '500 40px IBM Plex Mono, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(code.toUpperCase().slice(0, 8), 128, 34)
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.NoColorSpace
  return t
}
