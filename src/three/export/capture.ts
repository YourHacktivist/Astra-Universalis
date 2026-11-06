import * as THREE from 'three'
import { KIND_LABEL, PLANET_TYPE_LABEL } from '@/core/labels'
import { mapOrbitDistance, parentScaleInfo } from '@/core/scale'
import { spectralLabel } from '@/core/starPresets'
import type { Body, StarSystem } from '@/core/types'
import { formatSimDate } from '@/lib/format'
import { useSimStore, simClock } from '@/store/simStore'
import { useUIStore } from '@/store/uiStore'
import { runtime } from '../runtime'
import { LABEL_PRIORITY, labelRegistry } from '../scene/labels'
import { QUALITY_DPR } from '../SystemCanvas'
import { exportBridge } from './ExportBridge'

export type ExportAspect = 'viewport' | '16:9' | '4:3' | '3:2' | '1:1' | '21:9' | 'a4-landscape' | 'a4-portrait'
export type ExportFormat = 'png' | 'jpeg' | 'webp'

export const ASPECT_RATIO: Record<Exclude<ExportAspect, 'viewport'>, number> = {
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '3:2': 3 / 2,
  '1:1': 1,
  '21:9': 21 / 9,
  'a4-landscape': Math.SQRT2,
  'a4-portrait': 1 / Math.SQRT2,
}

export interface ExportOptions {
  scale: number
  aspect: ExportAspect
  format: ExportFormat
  labels: boolean
  moonLabels: boolean
  zoneLabels: boolean
  cartouche: boolean
  title: string
  subtitle: string
  showDate: boolean
  watermark: boolean
  starfield: boolean
}

export const MAX_EXPORT_SIDE = 8192

export function cropRect(viewW: number, viewH: number, aspect: ExportAspect) {
  if (aspect === 'viewport') return { x: 0, y: 0, w: viewW, h: viewH }
  const a = ASPECT_RATIO[aspect]
  let w = viewW
  let h = viewW / a
  if (h > viewH) {
    h = viewH
    w = viewH * a
  }
  return { x: (viewW - w) / 2, y: (viewH - h) / 2, w, h }
}

export function maxScale(viewW: number, viewH: number) {
  const gl = exportBridge.getState?.().gl
  const ctx = gl?.getContext()
  const maxRb = ctx ? Math.min(ctx.getParameter(ctx.MAX_RENDERBUFFER_SIZE) as number, ctx.getParameter(ctx.MAX_TEXTURE_SIZE) as number) : 8192
  const limit = Math.min(MAX_EXPORT_SIDE, maxRb)
  return Math.max(1, Math.floor((limit / Math.max(viewW, viewH)) * 10) / 10)
}

function settle(ms = 40) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

async function ensureFonts() {
  try {
    await Promise.all([
      document.fonts.load('600 32px "Cormorant Garamond"'),
      document.fonts.load('italic 500 32px "Cormorant Garamond"'),
      document.fonts.load('500 16px "IBM Plex Sans Variable"'),
      document.fonts.load('500 16px "IBM Plex Mono"'),
    ])
  } catch {
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

interface LabelJob {
  text: string
  sub?: string
  kind: Body['kind'] | 'grid'
  color: string
  x: number
  y: number
  offset: number
  priority: number
}

function subtitleOf(b: Body): string {
  switch (b.kind) {
    case 'star':
      return spectralLabel(b.props)
    case 'planet':
    case 'moon':
      return PLANET_TYPE_LABEL[b.props.planetType]
    default:
      return KIND_LABEL[b.kind]
  }
}

function collectLabels(system: StarSystem, camera: THREE.PerspectiveCamera, width: number, height: number, opts: ExportOptions): LabelJob[] {
  const jobs: LabelJob[] = []
  const v = new THREE.Vector3()
  const focal = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))
  const project = (p: THREE.Vector3) => {
    v.copy(p).applyMatrix4(camera.matrixWorldInverse)
    if (v.z > -camera.near) return null
    const depth = -v.z
    v.copy(p).project(camera)
    return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height, depth }
  }
  const ui = useUIStore.getState()
  if (opts.labels) {
    for (const b of Object.values(system.bodies)) {
      if (!b.visible || !b.showLabel || b.kind === 'barycenter') continue
      if (ui.playerMode && !b.playerVisible) continue
      if (b.kind === 'moon' && !opts.moonLabels) continue
      const rt = runtime.bodies.get(b.id)
      if (!rt || !rt.visible) continue
      const parent = b.parentId ? system.bodies[b.parentId] ?? null : null
      let pos = rt.pos
      let ring = false
      if (b.kind === 'belt') {
        const r = mapOrbitDistance(b.props.outer, parentScaleInfo(parent, system.display), system.display)
        const a = THREE.MathUtils.degToRad(-38)
        pos = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r).add(runtime.bodies.get(b.parentId ?? '')?.pos ?? new THREE.Vector3())
        ring = true
      }
      const s = project(pos)
      if (!s) continue
      const rpx = ring ? 0 : (rt.radius / s.depth) * focal
      if (parent && !ring) {
        const prt = runtime.bodies.get(parent.id)
        const ps = prt ? project(prt.pos) : null
        if (prt && ps) {
          const sep = Math.hypot(s.x - ps.x, s.y - ps.y) - (prt.radius / ps.depth) * focal
          if (sep < 18) continue
        }
      }
      jobs.push({
        text: b.name,
        sub: b.kind === 'star' ? subtitleOf(b) : undefined,
        kind: b.kind,
        color: b.color,
        x: s.x,
        y: s.y,
        offset: Math.max(rpx, 2.5) + 7,
        priority: LABEL_PRIORITY[b.kind],
      })
    }
  }
  if (opts.zoneLabels) {
    for (const e of labelRegistry.values()) {
      if (e.kind !== 'grid' || !e.point) continue
      const p = e.point.clone()
      if (e.anchorId) {
        const a = runtime.bodies.get(e.anchorId)
        if (a) p.add(a.pos)
      }
      const s = project(p)
      if (!s) continue
      jobs.push({
        text: (e.el.textContent ?? '').toUpperCase(),
        kind: 'grid',
        color: e.el.style.getPropertyValue('--label-color') || '#8ab0ff',
        x: s.x,
        y: s.y,
        offset: 4,
        priority: e.priority,
      })
    }
  }
  return jobs.sort((a, b) => b.priority - a.priority)
}

function labelFont(kind: LabelJob['kind'], s: number) {
  switch (kind) {
    case 'star':
      return { font: `600 ${16 * s}px "Cormorant Garamond", Georgia, serif`, color: 'rgba(246,230,200,0.95)', spacing: 0.06 }
    case 'belt':
    case 'nebula':
      return { font: `italic 500 ${13 * s}px "Cormorant Garamond", Georgia, serif`, color: 'rgba(220,214,200,0.72)', spacing: 0.04 }
    case 'moon':
    case 'ship':
    case 'marker':
      return { font: `500 ${10.5 * s}px "IBM Plex Sans Variable", sans-serif`, color: 'rgba(200,204,216,0.78)', spacing: 0.01 }
    case 'station':
    case 'gate':
      return { font: `500 ${11.5 * s}px "IBM Plex Sans Variable", sans-serif`, color: 'rgba(185,208,255,0.88)', spacing: 0.01 }
    case 'grid':
      return { font: `500 ${9 * s}px "IBM Plex Mono", monospace`, color: '', spacing: 0.14 }
    default:
      return { font: `500 ${11.5 * s}px "IBM Plex Sans Variable", sans-serif`, color: 'rgba(232,234,241,0.88)', spacing: 0.01 }
  }
}

function drawLabels(ctx: CanvasRenderingContext2D, jobs: LabelJob[], s: number, crop: { x: number; y: number; w: number; h: number }) {
  const placed: { x: number; y: number; w: number; h: number }[] = []
  const overlaps = (r: { x: number; y: number; w: number; h: number }) =>
    placed.some((p) => r.x < p.x + p.w && r.x + r.w > p.x && r.y < p.y + p.h && r.y + r.h > p.y)

  for (const j of jobs) {
    const st = labelFont(j.kind, s)
    ctx.font = st.font
    const sizePx = parseFloat(st.font.split(' ').find((t) => t.endsWith('px')) ?? '12')
    ctx.letterSpacing = `${(st.spacing * sizePx).toFixed(2)}px`
    const x = (j.x - crop.x) * s + j.offset * s
    const y = (j.y - crop.y) * s
    const w = ctx.measureText(j.text).width
    let subW = 0
    if (j.sub) {
      ctx.font = `500 ${9 * s}px "IBM Plex Mono", monospace`
      subW = ctx.measureText(j.sub.toUpperCase()).width + 6 * s
    }
    const h = sizePx * 1.25
    const rect = { x: x - 2 * s, y: y - h / 2, w: w + subW + 6 * s, h }
    if (rect.x > crop.w * s || rect.y > crop.h * s || rect.x + rect.w < 0 || rect.y + rect.h < 0) continue
    if (overlaps(rect)) continue
    placed.push(rect)

    if (j.kind !== 'grid') {
      ctx.save()
      ctx.shadowColor = j.color
      ctx.shadowBlur = 4 * s
      ctx.fillStyle = j.color
      ctx.globalAlpha = 0.85
      ctx.fillRect(x - 7 * s, y - 0.5 * s, 4 * s, Math.max(1, 1 * s))
      ctx.restore()
    }
    ctx.save()
    ctx.font = st.font
    ctx.letterSpacing = `${(st.spacing * sizePx).toFixed(2)}px`
    ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(0,0,0,0.95)'
    ctx.shadowBlur = 10 * s
    ctx.fillStyle = j.kind === 'grid' ? j.color : st.color
    if (j.kind === 'grid') ctx.globalAlpha = 0.7
    ctx.fillText(j.text, x, y)
    ctx.shadowBlur = 2 * s
    ctx.fillText(j.text, x, y)
    if (j.sub) {
      ctx.font = `500 ${9 * s}px "IBM Plex Mono", monospace`
      ctx.letterSpacing = `${(0.08 * 9 * s).toFixed(2)}px`
      ctx.fillStyle = 'rgba(150,156,176,0.9)'
      ctx.fillText(j.sub.toUpperCase(), x + w + 6 * s, y + 1 * s)
    }
    ctx.restore()
  }
}

async function drawCartouche(ctx: CanvasRenderingContext2D, W: number, H: number, opts: ExportOptions, system: StarSystem) {
  const u = Math.min(W, H) / 1080
  const pad = 56 * u
  const g = ctx.createLinearGradient(0, H, 0, H - 340 * u)
  g.addColorStop(0, 'rgba(4,5,10,0.82)')
  g.addColorStop(1, 'rgba(4,5,10,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, H - 340 * u, W, 340 * u)

  const logo = await loadImage(u > 1.2 ? './brand/logo-night.png' : './brand/logo-night-128.png')
  const logoSize = 92 * u
  let x = pad
  const baseY = H - pad
  if (logo) {
    ctx.drawImage(logo, x - 8 * u, baseY - logoSize + 6 * u, logoSize, logoSize)
    x += logoSize + 14 * u
  }

  ctx.save()
  ctx.textBaseline = 'alphabetic'
  ctx.font = `600 ${50 * u}px "Cormorant Garamond", Georgia, serif`
  ctx.letterSpacing = `${(0.04 * 50 * u).toFixed(2)}px`
  ctx.fillStyle = '#f3ead8'
  ctx.shadowColor = 'rgba(0,0,0,0.8)'
  ctx.shadowBlur = 18 * u
  const titleY = baseY - (opts.showDate ? 50 : 30) * u
  ctx.fillText(opts.title, x, titleY)
  const titleW = ctx.measureText(opts.title).width
  ctx.shadowBlur = 0

  const lineY = titleY + 14 * u
  const lg = ctx.createLinearGradient(x, 0, x + Math.max(titleW, 260 * u) * 1.15, 0)
  lg.addColorStop(0, 'rgba(233,185,110,0.9)')
  lg.addColorStop(1, 'rgba(233,185,110,0)')
  ctx.fillStyle = lg
  ctx.fillRect(x, lineY, Math.max(titleW, 260 * u) * 1.15, Math.max(1, 1.2 * u))

  if (opts.subtitle) {
    ctx.font = `500 ${13 * u}px "IBM Plex Sans Variable", sans-serif`
    ctx.letterSpacing = `${(0.16 * 13 * u).toFixed(2)}px`
    ctx.fillStyle = 'rgba(178,184,204,0.92)'
    ctx.fillText(opts.subtitle.toUpperCase(), x, lineY + 26 * u)
  }
  if (opts.showDate) {
    ctx.font = `500 ${12 * u}px "IBM Plex Mono", monospace`
    ctx.letterSpacing = `${(0.06 * 12 * u).toFixed(2)}px`
    ctx.fillStyle = 'rgba(138,176,255,0.95)'
    const era = system.calendar.era ? ` ${system.calendar.era}` : ''
    ctx.fillText(`${formatSimDate(system.calendar.epochYear, simClock.time)}${era}`, x, lineY + 48 * u)
  }
  ctx.restore()

  if (opts.watermark) drawWatermark(ctx, W, H)
}

function drawWatermark(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const u = Math.min(W, H) / 1080
  ctx.save()
  ctx.font = `500 ${10 * u}px "IBM Plex Mono", monospace`
  ctx.letterSpacing = `${(0.32 * 10 * u).toFixed(2)}px`
  ctx.fillStyle = 'rgba(154,160,178,0.55)'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('ASTRA UNIVERSALIS', W - 40 * u, H - 40 * u)
  ctx.restore()
}

export async function renderExport(system: StarSystem, opts: ExportOptions): Promise<HTMLCanvasElement> {
  const get = exportBridge.getState
  if (!get) throw new Error('Vue 3D indisponible')
  await ensureFonts()

  const ui = useUIStore.getState()
  const sim = useSimStore.getState()
  const wasPlaying = sim.playing
  const prevView = ui.view
  const quality = ui.quality
  sim.setPlaying(false)
  ui.setExporting(true)
  if (!opts.starfield && prevView.starfield) ui.setView({ starfield: false })

  const state = get()
  const { width, height } = state.size
  const scale = Math.min(opts.scale, maxScale(width, height))
  const baseDpr = state.viewport.dpr

  try {
    state.setDpr(scale)
    await settle()
    const st = get()
    for (let i = 0; i < 4; i++) {
      st.advance(performance.now(), true)
      await settle(10)
    }
    st.advance(performance.now(), true)
    const glCanvas = document.createElement('canvas')
    glCanvas.width = st.gl.domElement.width
    glCanvas.height = st.gl.domElement.height
    glCanvas.getContext('2d')!.drawImage(st.gl.domElement, 0, 0)
    const labels = collectLabels(system, st.camera as THREE.PerspectiveCamera, width, height, opts)

    const crop = cropRect(width, height, opts.aspect)
    const pxScale = glCanvas.width / width
    const out = document.createElement('canvas')
    out.width = Math.round(crop.w * pxScale)
    out.height = Math.round(crop.h * pxScale)
    const ctx = out.getContext('2d')!
    if (opts.format === 'jpeg') {
      ctx.fillStyle = '#04050a'
      ctx.fillRect(0, 0, out.width, out.height)
    }
    ctx.drawImage(glCanvas, crop.x * pxScale, crop.y * pxScale, out.width, out.height, 0, 0, out.width, out.height)
    if (labels.length) drawLabels(ctx, labels, pxScale, crop)
    if (opts.cartouche) await drawCartouche(ctx, out.width, out.height, opts, system)
    else if (opts.watermark) drawWatermark(ctx, out.width, out.height)
    return out
  } finally {
    state.setDpr(QUALITY_DPR[quality] ?? baseDpr)
    ui.setExporting(false)
    if (!opts.starfield && prevView.starfield) useUIStore.getState().setView({ starfield: true })
    useSimStore.getState().setPlaying(wasPlaying)
  }
}

const MIME: Record<ExportFormat, string> = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }

export async function canvasToBase64(canvas: HTMLCanvasElement, format: ExportFormat): Promise<string> {
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, MIME[format], format === 'png' ? undefined : 0.93))
  if (!blob) throw new Error("Encodage de l'image impossible")
  const buf = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < buf.length; i += CHUNK) bin += String.fromCharCode(...buf.subarray(i, i + CHUNK))
  return btoa(bin)
}

export { MIME as EXPORT_MIME }
