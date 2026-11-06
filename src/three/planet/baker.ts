import * as THREE from 'three'
import type { PlanetProps } from '@/core/types'
import type { Quality } from '@/store/uiStore'
import { bakeFragment, bakeVertex, PASS_ALBEDO, PASS_CLOUDS, PASS_HEIGHT, PASS_NORMAL, PLANET_TYPE_ID } from './bakeShader'

export type BakeKind = 'surface' | 'clouds'

const PREVIEW_W = 256
const TILE_W = 512
const TILE_MIN = 8_192
const TILE_MAX = 131_072
let tileBudget = 65_536
let lastDrew = false
const FULL_DELAY_MS = 350
const DISPOSE_AFTER_FRAMES = 900
const STALE_FRAMES = 20
const PREVIEW_RETIRE_FRAMES = 90
let frame = 0

const HEIGHT_SD = 0.15
const CLOUD_SD = 0.075

export function probit(p: number): number {
  p = Math.min(0.9999, Math.max(0.0001, p))
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239]
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572]
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416]
  const pl = 0.02425
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  if (p > 1 - pl) {
    const q = Math.sqrt(-2 * Math.log(1 - p))
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  const q = p - 0.5
  const r = q * q
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
}

function seedVec(seed: number): [number, number, number] {
  let s = (seed ^ 0x5bd1e995) >>> 0
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return [next() * 200 - 100, next() * 200 - 100, next() * 200 - 100]
}

export function isGiantType(t: PlanetProps['planetType']) {
  return t === 'gas' || t === 'icegiant' || t === 'hotjupiter'
}

export interface SurfaceParams {
  type: PlanetProps['planetType']
  palette: string[]
  seaLevel: number
  terrainScale: number
  relief: number
  craters: number
  iceCaps: number
  bands: number
  turbulence: number
  storms: number
  seed: number
}

export interface CloudParams {
  type: PlanetProps['planetType']
  coverage: number
  scale: number
  turbulence: number
  seed: number
}

const r3 = (v: number) => Math.round(v * 1000) / 1000

export function surfaceParams(p: PlanetProps, seed: number): SurfaceParams {
  return {
    type: p.planetType,
    palette: p.palette.map((c) => c.toLowerCase()),
    seaLevel: r3(p.seaLevel),
    terrainScale: r3(p.terrainScale),
    relief: r3(p.relief),
    craters: r3(p.craters),
    iceCaps: r3(p.iceCaps),
    bands: r3(p.bands),
    turbulence: r3(p.turbulence),
    storms: r3(p.storms),
    seed,
  }
}

export function cloudParams(p: PlanetProps, seed: number): CloudParams {
  return { type: p.planetType, coverage: r3(p.clouds.coverage), scale: r3(p.clouds.scale), turbulence: r3(p.turbulence), seed }
}

const quadGeometry = new THREE.PlaneGeometry(2, 2)
const bakeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
const bakeQuad = new THREE.Mesh(quadGeometry)
bakeQuad.frustumCulled = false
const bakeScene = new THREE.Scene()
bakeScene.add(bakeQuad)

const programs = new Map<string, { material: THREE.ShaderMaterial; ready: boolean; started: boolean }>()
let compileTarget: THREE.WebGLRenderTarget | null = null

function bakeUniforms() {
  return {
    uSeed: { value: new THREE.Vector3() },
    uPal: { value: Array.from({ length: 5 }, () => new THREE.Color()) },
    uSea: { value: 0 },
    uSeaLevel: { value: 0 },
    uTerrainScale: { value: 1 },
    uRelief: { value: 0.5 },
    uCraters: { value: 0 },
    uIceCaps: { value: 0 },
    uBands: { value: 0 },
    uTurbulence: { value: 0 },
    uStorms: { value: 0 },
    uCloudThr: { value: 0.5 },
    uCloudScale: { value: 1 },
    uDetail: { value: 0 },
    uLoopZero: { value: 0 },
    uHeightTex: { value: null as THREE.Texture | null },
  }
}

const T_TERRAN = PLANET_TYPE_ID.terran
const T_GAS = PLANET_TYPE_ID.gas
const T_TOXIC = PLANET_TYPE_ID.toxic
const T_HOTJUPITER = PLANET_TYPE_ID.hotjupiter
const FLAT_TYPES: number[] = [PLANET_TYPE_ID.gas, PLANET_TYPE_ID.icegiant, PLANET_TYPE_ID.toxic]

function programType(type: number, pass: number): number {
  if (pass === PASS_CLOUDS) return type === T_TOXIC ? T_TOXIC : T_TERRAN
  if (pass === PASS_NORMAL) return FLAT_TYPES.includes(type) || type === T_HOTJUPITER ? T_GAS : T_TERRAN
  if (pass === PASS_HEIGHT && FLAT_TYPES.includes(type)) return T_GAS
  return type
}

function programEntry(rawType: number, pass: number) {
  const type = programType(rawType, pass)
  const key = `${type}:${pass}`
  let e = programs.get(key)
  if (!e) {
    e = {
      material: new THREE.ShaderMaterial({
        defines: { TYPE: type, PASS: pass },
        uniforms: bakeUniforms(),
        vertexShader: bakeVertex,
        fragmentShader: bakeFragment,
        depthTest: false,
        depthWrite: false,
      }),
      ready: false,
      started: false,
    }
    programs.set(key, e)
  }
  return e
}

export function compileOffscreen(
  gl: THREE.WebGLRenderer,
  scene: THREE.Object3D,
  camera: THREE.Camera,
  targetScene: THREE.Scene | null = null,
): Promise<unknown> {
  compileTarget ??= new THREE.WebGLRenderTarget(4, 4, { depthBuffer: false })
  const target = compileTarget
  return withRendererState(gl, () => {
    gl.setRenderTarget(target)
    return gl.compileAsync ? gl.compileAsync(scene, camera, targetScene) : Promise.resolve(gl.compile(scene, camera, targetScene))
  })
}

const firstUsed = new Set<string>()
let gateFrame = -1
export function firstUseGate(key: string): boolean {
  if (firstUsed.has(key)) return true
  if (gateFrame === frame) return false
  gateFrame = frame
  firstUsed.add(key)
  return true
}

function programReady(gl: THREE.WebGLRenderer, type: number, pass: number) {
  const e = programEntry(type, pass)
  if (e.ready) return true
  if (!e.started) {
    e.started = true
    const scene = new THREE.Scene()
    const q = new THREE.Mesh(quadGeometry, e.material)
    q.frustumCulled = false
    scene.add(q)
    compileOffscreen(gl, scene, bakeCamera).then(
      () => (e!.ready = true),
      () => (e!.ready = true),
    )
  }
  return false
}

function applySurfaceUniforms(m: THREE.ShaderMaterial, p: SurfaceParams, width: number) {
  const u = m.uniforms
  u.uSeed.value.set(...seedVec(p.seed))
  p.palette.forEach((hex, i) => (u.uPal.value[i] as THREE.Color).set(hex))
  u.uSeaLevel.value = p.seaLevel
  u.uSea.value = p.seaLevel > 0.01 ? HEIGHT_SD * probit(p.seaLevel) : -10
  u.uTerrainScale.value = Math.max(0.2, p.terrainScale)
  u.uRelief.value = p.relief
  u.uCraters.value = p.craters
  u.uIceCaps.value = p.iceCaps
  u.uBands.value = p.bands
  u.uTurbulence.value = p.turbulence
  u.uStorms.value = p.storms
  u.uDetail.value = width >= 2048 ? 1 : 0
}

function applyCloudUniforms(m: THREE.ShaderMaterial, p: CloudParams, width: number) {
  const u = m.uniforms
  u.uSeed.value.set(...seedVec(p.seed + 977))
  u.uTurbulence.value = p.turbulence
  u.uCloudScale.value = Math.max(0.2, p.scale)
  u.uCloudThr.value = 0.5 + CLOUD_SD * probit(1 - Math.min(0.995, Math.max(0.005, p.coverage))) - 0.045
  u.uDetail.value = width >= 1024 ? 1 : 0
}

function makeTarget(w: number, h: number, srgb: boolean, gl: THREE.WebGLRenderer) {
  const rt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false, stencilBuffer: false })
  const t = rt.texture
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.generateMipmaps = false
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.ClampToEdgeWrapping
  t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
  return rt
}

const scratch = new Map<string, THREE.WebGLRenderTarget>()
function scratchTarget(gl: THREE.WebGLRenderer, w: number, h: number) {
  const key = `${w}x${h}`
  let rt = scratch.get(key)
  if (!rt) {
    const float = gl.extensions.has('EXT_color_buffer_float')
    rt = new THREE.WebGLRenderTarget(w, h, {
      type: float ? THREE.FloatType : THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    })
    rt.texture.colorSpace = THREE.NoColorSpace
    scratch.set(key, rt)
  }
  return rt
}

function releaseLargeScratch() {
  for (const [key, rt] of scratch) {
    if (rt.width < 2048) continue
    const needed = [...cache.values()].some((s) => !s.disposed && s.kind === 'surface' && !s.fullDone && s.width === rt.width)
    if (!needed) {
      rt.dispose()
      scratch.delete(key)
    }
  }
}

interface PassDef {
  pass: number
  target: 'albedo' | 'normal' | 'clouds' | 'scratch'
}

interface Targets {
  albedo?: THREE.WebGLRenderTarget
  normal?: THREE.WebGLRenderTarget
  clouds?: THREE.WebGLRenderTarget
}

interface Progress {
  pass: number
  x: number
  y: number
  rowH: number
  done: boolean
}

const newProgress = (): Progress => ({ pass: 0, x: 0, y: 0, rowH: 0, done: false })

export class BakedSet {
  readonly key: string
  readonly kind: BakeKind
  readonly width: number
  readonly params: SurfaceParams | CloudParams
  readonly passes: PassDef[]
  readonly typeId: number
  readonly createdAt = performance.now()
  lastUsed = frame
  preview: Targets | null = null
  full: Targets | null = null
  previewProgress = newProgress()
  fullProgress = newProgress()
  previewRetireFrame = 0
  disposed = false

  constructor(key: string, kind: BakeKind, params: SurfaceParams | CloudParams, width: number) {
    this.key = key
    this.kind = kind
    this.params = params
    this.width = width
    this.typeId = PLANET_TYPE_ID[params.type]
    this.passes =
      kind === 'surface'
        ? [
            { pass: PASS_HEIGHT, target: 'scratch' },
            { pass: PASS_ALBEDO, target: 'albedo' },
            { pass: PASS_NORMAL, target: 'normal' },
          ]
        : [{ pass: PASS_CLOUDS, target: 'clouds' }]
  }

  get fullDone() {
    return this.fullProgress.done
  }

  get textures(): Targets | null {
    if (this.fullProgress.done && this.full) return this.full
    if (this.previewProgress.done && this.preview) return this.preview
    return null
  }

  touch() {
    this.lastUsed = frame
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    for (const t of [this.preview, this.full]) {
      if (!t) continue
      t.albedo?.dispose()
      t.normal?.dispose()
      t.clouds?.dispose()
    }
    this.preview = null
    this.full = null
  }
}

const cache = new Map<string, BakedSet>()
let lastPumpToken = -1
let activePreview: BakedSet | null = null
let activeFull: BakedSet | null = null

export function getBakedSet(kind: BakeKind, params: SurfaceParams | CloudParams, width: number): BakedSet {
  const key = `${kind}|${width}|${JSON.stringify(params)}`
  let set = cache.get(key)
  if (!set || set.disposed) {
    set = new BakedSet(key, kind, params, width)
    cache.set(key, set)
  }
  set.touch()
  return set
}

function ensureTargets(gl: THREE.WebGLRenderer, set: BakedSet, preview: boolean): Targets {
  const w = preview ? Math.min(PREVIEW_W, set.width) : set.width
  const t: Targets = {}
  if (set.kind === 'surface') {
    t.albedo = makeTarget(w, w / 2, true, gl)
    const simple = isGiantType(set.params.type) || set.params.type === 'toxic'
    const nw = simple ? Math.max(64, w / 4) : w
    t.normal = makeTarget(nw, nw / 2, false, gl)
  } else {
    t.clouds = makeTarget(w, w / 2, false, gl)
  }
  return t
}

function targetFor(gl: THREE.WebGLRenderer, t: Targets, def: PassDef): THREE.WebGLRenderTarget {
  if (def.target === 'scratch') return scratchTarget(gl, t.albedo!.width, t.albedo!.height)
  return t[def.target]!
}

function runTile(gl: THREE.WebGLRenderer, set: BakedSet, preview: boolean): boolean {
  const prog = preview ? set.previewProgress : set.fullProgress
  const def = set.passes[prog.pass]
  if (!programReady(gl, set.typeId, def.pass)) return false
  if (!firstUseGate(`bake:${programType(set.typeId, def.pass)}:${def.pass}`)) return false
  let t = preview ? set.preview : set.full
  if (!t) {
    t = ensureTargets(gl, set, preview)
    if (preview) set.preview = t
    else set.full = t
  }
  const m = programEntry(set.typeId, def.pass).material
  const target = targetFor(gl, t, def)
  if (set.kind === 'surface') {
    applySurfaceUniforms(m, set.params as SurfaceParams, t.albedo!.width)
    m.uniforms.uHeightTex.value = def.pass === PASS_HEIGHT ? null : scratchTarget(gl, t.albedo!.width, t.albedo!.height).texture
  } else applyCloudUniforms(m, set.params as CloudParams, target.width)

  const W = target.width
  const H = target.height
  const tw = Math.min(TILE_W, W - prog.x)
  if (prog.x === 0) prog.rowH = Math.max(8, Math.min(H - prog.y, Math.floor(tileBudget / Math.min(TILE_W, W) / 8) * 8))
  const th = Math.min(prog.rowH, H - prog.y)
  const last = prog.x + tw >= W && prog.y + th >= H
  if (def.target !== 'scratch') target.texture.generateMipmaps = last
  target.scissor.set(prog.x, prog.y, tw, th)
  target.scissorTest = tw < W || th < H
  bakeQuad.material = m
  try {
    gl.setRenderTarget(target)
    gl.render(bakeScene, bakeCamera)
  } finally {
    target.scissorTest = false
    target.scissor.set(0, 0, W, H)
  }

  prog.x += tw
  if (prog.x >= W) {
    prog.x = 0
    prog.y += th
    if (prog.y >= H) {
      prog.y = 0
      prog.pass++
      if (prog.pass >= set.passes.length) prog.done = true
    }
  }
  return true
}

const _vp = new THREE.Vector4()
const _sc = new THREE.Vector4()
const _cc = new THREE.Color()

export function withRendererState<T>(gl: THREE.WebGLRenderer, fn: () => T): T {
  const prevTarget = gl.getRenderTarget()
  const prevActiveCube = gl.getActiveCubeFace()
  const prevActiveMip = gl.getActiveMipmapLevel()
  gl.getViewport(_vp)
  gl.getScissor(_sc)
  const vp = _vp.clone()
  const sc = _sc.clone()
  const scTest = gl.getScissorTest()
  gl.getClearColor(_cc)
  const cc = _cc.clone()
  const ca = gl.getClearAlpha()
  const autoClear = gl.autoClear
  const xr = gl.xr.enabled
  gl.autoClear = false
  gl.xr.enabled = false
  try {
    return fn()
  } finally {
    gl.setRenderTarget(null)
    gl.setViewport(vp)
    gl.setScissor(sc)
    gl.setScissorTest(scTest)
    gl.setClearColor(cc, ca)
    gl.autoClear = autoClear
    gl.xr.enabled = xr
    gl.setRenderTarget(prevTarget, prevActiveCube, prevActiveMip)
  }
}

function restart(set: BakedSet, preview: boolean) {
  if (preview) set.previewProgress = newProgress()
  else set.fullProgress = newProgress()
}

export function pumpBakes(gl: THREE.WebGLRenderer, token: number, delta = 1 / 60) {
  if (token === lastPumpToken) return
  lastPumpToken = token
  frame++
  if (lastDrew) {
    if (delta > 0.03) tileBudget = Math.max(TILE_MIN, tileBudget * 0.6)
    else if (delta < 0.019) tileBudget = Math.min(TILE_MAX, tileBudget * 1.15)
  }
  lastDrew = false
  const now = performance.now()
  if (import.meta.env.DEV) (window as unknown as { __planetBaker: unknown }).__planetBaker = { gl, sets: cache }
  const stale = (s: BakedSet) => frame - s.lastUsed > STALE_FRAMES

  for (const [key, set] of cache) {
    if (set.previewRetireFrame && frame >= set.previewRetireFrame) {
      const p = set.preview
      if (p && p !== set.full) {
        p.albedo?.dispose()
        p.normal?.dispose()
        p.clouds?.dispose()
      }
      set.preview = null
      set.previewRetireFrame = 0
    }
    if (frame - set.lastUsed > DISPOSE_AFTER_FRAMES) {
      if (activeFull === set) activeFull = null
      if (activePreview === set) activePreview = null
      set.dispose()
      cache.delete(key)
    }
  }

  if (activePreview && (activePreview.disposed || activePreview.previewProgress.done || stale(activePreview))) {
    if (!activePreview.previewProgress.done) restart(activePreview, true)
    activePreview = null
  }
  if (activeFull && (activeFull.disposed || activeFull.fullProgress.done || stale(activeFull))) {
    if (!activeFull.fullProgress.done) restart(activeFull, false)
    activeFull = null
  }

  if (!activePreview) {
    for (const set of cache.values()) {
      if (!set.disposed && !set.previewProgress.done && !stale(set)) {
        activePreview = set
        break
      }
    }
  }
  for (const set of cache.values()) {
    if (set.disposed || set.fullProgress.done || stale(set)) continue
    for (const def of set.passes) programReady(gl, set.typeId, def.pass)
  }

  let job: { set: BakedSet; preview: boolean } | null = activePreview ? { set: activePreview, preview: true } : null
  if (!job) {
    if (!activeFull) {
      for (const set of cache.values()) {
        if (set.disposed || set.fullProgress.done || !set.previewProgress.done) continue
        if (stale(set) || now - set.createdAt < FULL_DELAY_MS) continue
        if (set.width <= PREVIEW_W) {
          set.full = set.preview
          set.fullProgress.done = true
          continue
        }
        activeFull = set
        break
      }
    }
    if (activeFull) job = { set: activeFull, preview: false }
  }
  if (!job) return

  const j = job
  lastDrew = withRendererState(gl, () => runTile(gl, j.set, j.preview))

  const set = job.set
  if (job.preview && set.previewProgress.done) activePreview = null
  if (!job.preview && set.fullProgress.done) {
    activeFull = null
    releaseLargeScratch()
    if (set.preview && set.preview !== set.full) set.previewRetireFrame = frame + PREVIEW_RETIRE_FRAMES
    else set.preview = null
  }
}

export function ensurePreview(gl: THREE.WebGLRenderer, set: BakedSet) {
  if (set.textures) return
  if (activePreview === set) activePreview = null
  restart(set, true)
  withRendererState(gl, () => {
    for (const def of set.passes) {
      programEntry(set.typeId, def.pass).ready = true
      firstUsed.add(`bake:${programType(set.typeId, def.pass)}:${def.pass}`)
    }
    let guard = 0
    while (!set.previewProgress.done && guard++ < 64) runTile(gl, set, true)
  })
}

export function surfaceWidth(quality: Quality, moon: boolean): number {
  const base = quality === 'low' ? 512 : quality === 'medium' ? 768 : quality === 'high' ? 1024 : 2048
  return Math.max(256, moon ? base / 2 : base)
}

export function cloudWidth(quality: Quality, moon: boolean): number {
  return Math.max(256, surfaceWidth(quality, moon) / 2)
}

export function debugSets() {
  return [...cache.values()]
}

export function bakeStats() {
  let bytes = 0
  let pending = 0
  for (const s of cache.values()) {
    if (!s.fullDone) pending++
    for (const t of [s.preview, s.full]) {
      if (!t) continue
      for (const rt of [t.albedo, t.normal, t.clouds]) if (rt) bytes += rt.width * rt.height * 4 * 1.33
    }
  }
  for (const rt of scratch.values()) bytes += rt.width * rt.height * 16
  return { sets: cache.size, pending, megabytes: Math.round(bytes / 1e6) }
}
