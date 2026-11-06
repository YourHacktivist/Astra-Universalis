import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { EnvironmentSettings } from '@/core/types'
import { blackbodyRgb } from '@/lib/color'
import { Rng } from '@/lib/random'
import { useUIStore, type Quality } from '@/store/uiStore'
import { timeUniforms } from '../runtime'
import { BAKE_A_FRAG, BAKE_B_FRAG, BAKE_VERT, SKY_FRAG, SKY_VERT, STARS_FRAG, STARS_VERT } from './skyShaders'

const BAKE_SIZE: Record<Quality, number> = { low: 1024, medium: 2048, high: 2048, ultra: 4096 }
const STAR_COUNT: Record<Quality, number> = { low: 0.5, medium: 0.8, high: 1, ultra: 1.25 }

const tmpViewport = new THREE.Vector4()
const tmpScissor = new THREE.Vector4()
const tmpClear = new THREE.Color()

class SkyBake {
  readonly fields: THREE.WebGLRenderTarget
  readonly nebulae: THREE.WebGLRenderTarget
  done = false
  private jobs: { rt: THREE.WebGLRenderTarget; mat: THREE.ShaderMaterial; y: number; h: number }[] = []
  private quad: THREE.Mesh
  private scene = new THREE.Scene()
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private mats: THREE.ShaderMaterial[]

  constructor(seed: number, width: number) {
    const make = (w: number) =>
      new THREE.WebGLRenderTarget(w, w / 2, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        generateMipmaps: false,
        depthBuffer: false,
        wrapS: THREE.RepeatWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
      })
    this.fields = make(width)
    this.nebulae = make(width / 2)
    const mat = (fragmentShader: string) =>
      new THREE.ShaderMaterial({
        uniforms: { uSeed: { value: (seed % 9973) * 0.731 } },
        vertexShader: BAKE_VERT,
        fragmentShader,
        depthTest: false,
        depthWrite: false,
      })
    this.mats = [mat(BAKE_A_FRAG), mat(BAKE_B_FRAG)]
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mats[0])
    this.quad.frustumCulled = false
    this.scene.add(this.quad)
    const strips = 8
    for (const [rt, m] of [[this.fields, this.mats[0]], [this.nebulae, this.mats[1]]] as const) {
      const h = Math.ceil(rt.height / strips)
      for (let y = 0; y < rt.height; y += h) this.jobs.push({ rt, mat: m, y, h: Math.min(h, rt.height - y) })
    }
  }

  step(gl: THREE.WebGLRenderer, n = 2) {
    if (this.done) return
    const prevTarget = gl.getRenderTarget()
    const prevAutoClear = gl.autoClear
    const prevAlpha = gl.getClearAlpha()
    gl.getClearColor(tmpClear)
    gl.getViewport(tmpViewport)
    gl.getScissor(tmpScissor)
    const prevScissorTest = gl.getScissorTest()
    gl.autoClear = true
    gl.setClearColor(0x000000, 0)
    for (let i = 0; i < n && this.jobs.length; i++) {
      const job = this.jobs.shift()!
      this.quad.material = job.mat
      job.rt.scissor.set(0, job.y, job.rt.width, job.h)
      job.rt.scissorTest = true
      gl.setRenderTarget(job.rt)
      gl.render(this.scene, this.cam)
      job.rt.scissorTest = false
    }
    gl.setRenderTarget(prevTarget)
    gl.setViewport(tmpViewport)
    gl.setScissor(tmpScissor)
    gl.setScissorTest(prevScissorTest)
    gl.setClearColor(tmpClear, prevAlpha)
    gl.autoClear = prevAutoClear
    if (!this.jobs.length) {
      this.done = true
      this.quad.geometry.dispose()
      for (const m of this.mats) m.dispose()
    }
  }

  dispose() {
    this.fields.dispose()
    this.nebulae.dispose()
    if (!this.done) {
      this.quad.geometry.dispose()
      for (const m of this.mats) m.dispose()
    }
  }
}
function galacticMatrix(tiltDeg: number, seed: number) {
  const rng = new Rng(seed * 7 + 3)
  const yaw = rng.range(0, Math.PI * 2)
  const roll = rng.range(-0.25, 0.25)
  const m = new THREE.Matrix4()
    .makeRotationY(yaw)
    .multiply(new THREE.Matrix4().makeRotationX(THREE.MathUtils.degToRad(tiltDeg)))
    .multiply(new THREE.Matrix4().makeRotationZ(roll))
  return new THREE.Matrix3().setFromMatrix4(m)
}

const TEMPERATURES: [number, number, number][] = [
  [2600, 3700, 0.3],
  [3700, 5200, 0.3],
  [5200, 6400, 0.2],
  [6400, 9000, 0.13],
  [9000, 26000, 0.07],
]

function buildStars(seed: number, density: number, qualityScale: number) {
  const rng = new Rng(seed * 13 + 1)
  const count = Math.round((2500 + 16000 * THREE.MathUtils.clamp(density, 0, 1)) * qualityScale)
  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  const size = new Float32Array(count)
  const phase = new Float32Array(count)
  const c = new THREE.Color()
  const white = new THREE.Color(1, 1, 1)
  for (let i = 0; i < count; i++) {
    let x: number, y: number, z: number
    const kind = rng.float()
    if (kind < 0.42) {
      const lon = rng.range(-Math.PI, Math.PI)
      const lat = rng.gaussian(0, 0.11)
      x = Math.cos(lat) * Math.cos(lon)
      y = Math.sin(lat)
      z = Math.cos(lat) * Math.sin(lon)
    } else if (kind < 0.5) {
      const lon = rng.gaussian(0, 0.35)
      const lat = rng.gaussian(0, 0.16)
      x = Math.cos(lat) * Math.cos(lon)
      y = Math.sin(lat)
      z = Math.cos(lat) * Math.sin(lon)
    } else {
      const u = rng.range(-1, 1)
      const t = rng.range(0, Math.PI * 2)
      const s = Math.sqrt(1 - u * u)
      x = s * Math.cos(t)
      y = u
      z = s * Math.sin(t)
    }
    pos[i * 3] = x
    pos[i * 3 + 1] = y
    pos[i * 3 + 2] = z

    const [tmin, tmax] = rng.weighted(TEMPERATURES.map((t) => [[t[0], t[1]] as const, t[2]] as const))
    const T = rng.range(tmin, tmax)
    const [r, g, b] = blackbodyRgb(T)
    c.setRGB(r, g, b, THREE.SRGBColorSpace).lerp(white, 0.35)
    const m = rng.float()
    const bright = 0.16 + 0.7 * Math.pow(m, 5) + (m > 0.996 ? 1.4 : m > 0.985 ? 0.5 : 0)
    c.multiplyScalar(bright)
    col[i * 3] = c.r
    col[i * 3 + 1] = c.g
    col[i * 3 + 2] = c.b
    size[i] = 1.25 + 2.2 * Math.pow(m, 7) + (m > 0.996 ? 2.6 : m > 0.985 ? 0.9 : 0)
    phase[i] = rng.float()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
  return g
}

const skyGeometry = new THREE.SphereGeometry(1, 64, 32)

export const Starfield = memo(function Starfield({ environment }: { environment: EnvironmentSettings }) {
  const gl = useThree((s) => s.gl)
  const dpr = useThree((s) => s.viewport.dpr)
  const quality = useUIStore((s) => s.quality)
  const seed = environment.seed

  const bake = useMemo(() => new SkyBake(seed, BAKE_SIZE[quality]), [seed, quality])
  const shown = useRef<SkyBake | null>(null)
  useEffect(
    () => () => {
      if (shown.current !== bake) bake.dispose()
    },
    [bake],
  )
  useEffect(() => () => shown.current?.dispose(), [])

  const skyMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uFields: { value: null },
          uNebulae: { value: null },
          uReady: { value: 0 },
          uToGalactic: { value: new THREE.Matrix3() },
          uMilky: { value: 0.5 },
          uNeb1: { value: new THREE.Color() },
          uNeb2: { value: new THREE.Color() },
          uNebI: { value: 0.3 },
          uBright: { value: 1 },
        },
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )
  const starMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uFromGalactic: { value: new THREE.Matrix3() },
          uTime: timeUniforms.uTime,
          uPixelRatio: { value: 1 },
          uBright: { value: 1 },
        },
        vertexShader: STARS_VERT,
        fragmentShader: STARS_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  )
  useEffect(() => () => skyMaterial.dispose(), [skyMaterial])
  useEffect(() => () => starMaterial.dispose(), [starMaterial])

  const starGeometry = useMemo(
    () => buildStars(seed, environment.starDensity, STAR_COUNT[quality]),
    [seed, environment.starDensity, quality],
  )
  useEffect(() => () => starGeometry.dispose(), [starGeometry])

  useEffect(() => {
    const m = galacticMatrix(environment.milkyWayTilt, seed)
    const u = skyMaterial.uniforms
    u.uToGalactic.value.copy(m).transpose()
    u.uMilky.value = environment.milkyWay
    u.uNeb1.value.set(environment.nebulaColor)
    u.uNeb2.value.set(environment.nebulaColor2)
    u.uNebI.value = environment.nebulaIntensity
    starMaterial.uniforms.uFromGalactic.value.copy(m)
    starMaterial.uniforms.uBright.value = 0.55 + 0.45 * Math.min(1, environment.starDensity * 1.5)
  }, [skyMaterial, starMaterial, environment, seed])

  useFrame(() => {
    starMaterial.uniforms.uPixelRatio.value = dpr
    if (!bake.done) {
      bake.step(gl)
      if (bake.done) {
        const prev = shown.current
        shown.current = bake
        if (prev && prev !== bake) prev.dispose()
        const u = skyMaterial.uniforms
        u.uFields.value = bake.fields.texture
        u.uNebulae.value = bake.nebulae.texture
        u.uReady.value = 1
      }
    }
  })

  return (
    <>
      <mesh geometry={skyGeometry} material={skyMaterial} frustumCulled={false} renderOrder={-1000} />
      <points geometry={starGeometry} material={starMaterial} frustumCulled={false} renderOrder={-999} />
    </>
  )
})
