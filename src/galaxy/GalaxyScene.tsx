import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CameraControls, CameraControlsImpl } from '@react-three/drei'
import * as THREE from 'three'
import type { Galaxy, GalaxyRouteKind } from '@/core/types'
import { useProjectStore } from '@/store/projectStore'
import { useUIStore, type Quality } from '@/store/uiStore'
import { PostFX } from '@/three/effects/PostFX'
import { GALAXY_SCALE, galaxyRuntime, useGalaxyUI } from './galaxyStore'
import { GalaxyLabelUpdater } from './GalaxyLabels'
import { buildBackground, buildGalaxyGeometries } from './particles'

const S = GALAXY_SCALE
const QUALITY_COUNT: Record<Quality, number> = { low: 0.4, medium: 0.7, high: 1, ultra: 1.5 }

const starVert = `
attribute vec3 aColor;
attribute float aSize;
attribute float aSeed;
uniform float uFocal;
uniform float uPixelRatio;
uniform float uTime;
uniform float uBright;
uniform float uMaxPx;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float depth = max(-mv.z, 1e-3);
  float px = aSize / depth * uFocal;
  float tw = 0.86 + 0.14 * sin(uTime * (0.4 + aSeed * 1.8) + aSeed * 61.0);
  gl_PointSize = clamp(px, 1.0, uMaxPx) * uPixelRatio;
  vAlpha = clamp(px, 0.12, 1.0) * tw * smoothstep(0.5, 6.0, depth);
  vColor = aColor * uBright;
  gl_Position = projectionMatrix * mv;
}
`
const starFrag = `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  float a = (exp(-r2 * 5.0) + exp(-r2 * 40.0) * 0.8) * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor, a);
}
`

const dustVert = `
attribute float aSize;
attribute float aAlpha;
uniform float uFocal;
uniform float uPixelRatio;
uniform float uDust;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float depth = max(-mv.z, 1e-3);
  float px = aSize / depth * uFocal;
  gl_PointSize = clamp(px, 1.0, 140.0) * uPixelRatio;
  vAlpha = aAlpha * uDust * clamp(px / 3.0, 0.0, 1.0) * smoothstep(2.0, 20.0, depth);
  gl_Position = projectionMatrix * mv;
}
`
const dustFrag = `
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float a = exp(-dot(c, c) * 3.0) * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(0.0, 0.0, 0.0, a);
}
`

const glowVert = `
uniform float uSize;
varying vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
}
`
const glowFrag = `
uniform vec3 uColor;
uniform float uIntensity;
varying vec2 vUv;
void main() {
  float r = length(vUv);
  float a = (exp(-r * r * 14.0) * 1.6 + exp(-r * 4.5) * 0.35) * smoothstep(1.0, 0.7, r) * uIntensity;
  if (a < 0.002) discard;
  gl_FragColor = vec4(uColor * a, a);
}
`

const markerVert = `
attribute vec3 aColor;
attribute float aSize;
attribute float aState;
attribute float aLinked;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vState;
varying float vLinked;
varying float vSize;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float s = aSize * (aState > 1.5 ? 2.6 : aState > 0.5 ? 1.9 : 1.6);
  gl_PointSize = s * uPixelRatio;
  vColor = aColor;
  vState = aState;
  vLinked = aLinked;
  vSize = s;
  gl_Position = projectionMatrix * mv;
}
`
const markerFrag = `
uniform float uTime;
varying vec3 vColor;
varying float vState;
varying float vLinked;
varying float vSize;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r = length(c);
  float k = vState > 1.5 ? 2.6 : vState > 0.5 ? 1.9 : 1.6;
  float rc = r * k;
  float core = exp(-rc * rc * 18.0) * 2.6;
  float halo = exp(-rc * rc * 3.2) * 0.55;
  float spikes = (exp(-abs(c.x) * k * 16.0) + exp(-abs(c.y) * k * 16.0)) * exp(-rc * 2.2) * 0.4;
  vec3 col = vColor * (core + halo + spikes) + vec3(core * 0.6);
  float a = core + halo + spikes;
  if (vLinked > 0.5) {
    float ring = smoothstep(0.08, 0.0, abs(rc - 0.62)) * 0.9;
    col += vec3(0.91, 0.72, 0.43) * ring;
    a += ring;
  }
  if (vState > 1.5) {
    float ang = atan(c.y, c.x) + uTime * 0.6;
    float dash = step(0.45, fract(ang * 3.0 / 6.2831853 * 4.0));
    float ring = smoothstep(0.05, 0.0, abs(r - 0.86)) * dash;
    col += vec3(0.91, 0.72, 0.43) * ring * 1.4;
    a += ring;
  } else if (vState > 0.5) {
    float ring = smoothstep(0.05, 0.0, abs(r - 0.8)) * 0.7;
    col += vec3(0.54, 0.69, 1.0) * ring;
    a += ring;
  }
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, min(1.0, a));
}
`

const flowVert = `
attribute vec3 aFrom;
attribute vec3 aTo;
attribute float aOffset;
attribute vec3 aColor;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float t = fract(aOffset + uTime * 0.035);
  vec3 p = mix(aFrom, aTo, t);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = 4.0 * uPixelRatio;
  vColor = aColor;
  vAlpha = smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.92, t);
  gl_Position = projectionMatrix * mv;
}
`
const flowFrag = `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float a = exp(-dot(c, c) * 4.0) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor * 1.6, a);
}
`

const regionVert = `
varying vec2 vPos;
void main() {
  vPos = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const regionFrag = `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uSelected;
varying vec2 vPos;
void main() {
  float r = length(vPos);
  float fill = mix(0.006, 0.04, smoothstep(0.5, 1.0, r));
  float rim = smoothstep(0.01, 0.0, abs(r - 1.0));
  float ang = atan(vPos.y, vPos.x);
  float dash = 0.4 + 0.6 * step(0.5, fract(ang * 64.0 / 6.2831853));
  float a = (fill * (1.0 + uSelected) + rim * (0.32 + uSelected * 0.5) * dash) * uOpacity;
  if (a < 0.002) discard;
  gl_FragColor = vec4(uColor, a);
}
`

export const ROUTE_COLORS: Record<GalaxyRouteKind, string> = {
  jump: '#8AB0FF',
  trade: '#E9B96E',
  danger: '#FF7B6B',
  unknown: '#9AA0B2',
}

function focal(camera: THREE.PerspectiveCamera, height: number) {
  return height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

function GalaxyCloud({ galaxy }: { galaxy: Galaxy }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)
  const quality = useUIStore((s) => s.quality)

  const shapeKey = JSON.stringify([
    galaxy.seed, galaxy.shape, galaxy.arms, galaxy.twist, galaxy.radius, galaxy.thickness, galaxy.bulge, galaxy.bar,
    galaxy.coreColor, galaxy.armColor, galaxy.outerColor, galaxy.dust, galaxy.starCount, quality,
  ])
  const key = useDebounced(shapeKey, 140)
  const geo = useMemo(() => {
    const count = Math.min(420000, Math.round(galaxy.starCount * QUALITY_COUNT[quality]))
    return buildGalaxyGeometries(galaxy, count)
  }, [key])
  useEffect(
    () => () => {
      geo.stars.dispose()
      geo.dust.dispose()
    },
    [geo],
  )

  const mats = useMemo(() => {
    const stars = new THREE.ShaderMaterial({
      uniforms: { uFocal: { value: 1000 }, uPixelRatio: { value: 1 }, uTime: { value: 0 }, uBright: { value: 1 }, uMaxPx: { value: 18 } },
      vertexShader: starVert,
      fragmentShader: starFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const dust = new THREE.ShaderMaterial({
      uniforms: { uFocal: { value: 1000 }, uPixelRatio: { value: 1 }, uDust: { value: 1 } },
      vertexShader: dustVert,
      fragmentShader: dustFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.ZeroFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    })
    const glow = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color() }, uIntensity: { value: 1 }, uSize: { value: 100 } },
      vertexShader: glowVert,
      fragmentShader: glowFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { stars, dust, glow }
  }, [])
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])

  useEffect(() => {
    mats.glow.uniforms.uColor.value.set(galaxy.coreColor).multiplyScalar(galaxy.shape === 'irregular' ? 0.5 : 1.2)
    mats.glow.uniforms.uSize.value = galaxy.radius * S * (galaxy.shape === 'elliptical' ? 0.9 : 0.32 + galaxy.bulge * 0.35)
    mats.glow.uniforms.uIntensity.value = galaxy.shape === 'irregular' ? 0.3 : 0.7
    mats.dust.uniforms.uDust.value = 0.4 + galaxy.dust * 0.5
  }, [mats, galaxy.coreColor, galaxy.radius, galaxy.bulge, galaxy.shape, galaxy.dust])

  useFrame((state) => {
    const f = focal(camera, size.height)
    mats.stars.uniforms.uFocal.value = f
    mats.stars.uniforms.uPixelRatio.value = dpr
    mats.stars.uniforms.uTime.value = state.clock.elapsedTime
    mats.dust.uniforms.uFocal.value = f
    mats.dust.uniforms.uPixelRatio.value = dpr
  })

  return (
    <>
      <points geometry={geo.stars} material={mats.stars} frustumCulled={false} renderOrder={1} />
      <points geometry={geo.dust} material={mats.dust} frustumCulled={false} renderOrder={2} />
      <mesh material={mats.glow} renderOrder={3} frustumCulled={false}>
        <planeGeometry args={[2, 2]} />
      </mesh>
    </>
  )
}

function Background({ seed }: { seed: string }) {
  const dpr = useThree((s) => s.viewport.dpr)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const geo = useMemo(() => buildBackground(seed), [seed])
  useEffect(() => () => geo.dispose(), [geo])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uFocal: { value: 1000 }, uPixelRatio: { value: 1 }, uTime: { value: 0 }, uBright: { value: 1 }, uMaxPx: { value: 3 } },
        vertexShader: starVert,
        fragmentShader: starFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )
  const ref = useRef<THREE.Points>(null!)
  useFrame((state) => {
    mat.uniforms.uFocal.value = focal(camera, size.height)
    mat.uniforms.uPixelRatio.value = dpr
    mat.uniforms.uTime.value = state.clock.elapsedTime
    if (ref.current) ref.current.position.copy(camera.position)
  })
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} renderOrder={0} />
}

function Markers({ galaxy, playerMode }: { galaxy: Galaxy; playerMode: boolean }) {
  const dpr = useThree((s) => s.viewport.dpr)
  const selection = useGalaxyUI((s) => s.selection)
  const hovered = useGalaxyUI((s) => s.hovered)
  const routeStart = useGalaxyUI((s) => s.routeStart)
  const list = useMemo(() => Object.values(galaxy.systems).filter((m) => !playerMode || m.playerVisible), [galaxy.systems, playerMode])

  const geo = useMemo(() => {
    const n = Math.max(1, list.length)
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(n * 3)
    const col = new Float32Array(n * 3)
    const size = new Float32Array(n)
    const linked = new Float32Array(n)
    const c = new THREE.Color()
    list.forEach((m, i) => {
      pos.set([m.position[0] * S, m.position[1] * S, m.position[2] * S], i * 3)
      c.set(m.color)
      col.set([c.r, c.g, c.b], i * 3)
      size[i] = 9 + m.importance * 4
      linked[i] = m.systemId ? 1 : 0
    })
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    g.setAttribute('aLinked', new THREE.BufferAttribute(linked, 1))
    g.setAttribute('aState', new THREE.BufferAttribute(new Float32Array(n), 1))
    g.setDrawRange(0, list.length)
    return g
  }, [list])
  useEffect(() => () => geo.dispose(), [geo])

  useEffect(() => {
    const st = geo.getAttribute('aState') as THREE.BufferAttribute
    list.forEach((m, i) => {
      let v = 0
      if (hovered?.type === 'system' && hovered.id === m.id) v = 1
      if (routeStart === m.id) v = 2
      if (selection?.type === 'system' && selection.id === m.id) v = 2
      st.setX(i, v)
    })
    st.needsUpdate = true
  }, [geo, list, selection, hovered, routeStart])

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uPixelRatio: { value: 1 }, uTime: { value: 0 } },
        vertexShader: markerVert,
        fragmentShader: markerFrag,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )
  useEffect(() => () => mat.dispose(), [mat])
  useFrame((state) => {
    mat.uniforms.uPixelRatio.value = dpr
    mat.uniforms.uTime.value = state.clock.elapsedTime
  })
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={20} />
}

function Routes({ galaxy, playerMode }: { galaxy: Galaxy; playerMode: boolean }) {
  const dpr = useThree((s) => s.viewport.dpr)
  const selection = useGalaxyUI((s) => s.selection)
  const hovered = useGalaxyUI((s) => s.hovered)
  const routes = useMemo(
    () =>
      Object.values(galaxy.routes).filter(
        (r) => galaxy.systems[r.from] && galaxy.systems[r.to] && (!playerMode || (r.playerVisible && galaxy.systems[r.from].playerVisible && galaxy.systems[r.to].playerVisible)),
      ),
    [galaxy.routes, galaxy.systems, playerMode],
  )

  const lines = useMemo(() => {
    const objs: THREE.Object3D[] = []
    const byKind = new Map<GalaxyRouteKind, number[]>()
    const highlight: number[] = []
    const selId = selection?.type === 'route' ? selection.id : null
    const hovId = hovered?.type === 'route' ? hovered.id : null
    for (const r of routes) {
      const a = galaxy.systems[r.from].position
      const b = galaxy.systems[r.to].position
      const seg = [a[0] * S, a[1] * S, a[2] * S, b[0] * S, b[1] * S, b[2] * S]
      if (r.id === selId || r.id === hovId) highlight.push(...seg)
      const arr = byKind.get(r.kind) ?? []
      arr.push(...seg)
      byKind.set(r.kind, arr)
    }
    for (const [kind, verts] of byKind) {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
      const dashed = kind === 'unknown' || kind === 'danger'
      const m = dashed
        ? new THREE.LineDashedMaterial({ color: ROUTE_COLORS[kind], dashSize: 1.4, gapSize: 1.1, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })
        : new THREE.LineBasicMaterial({ color: ROUTE_COLORS[kind], transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })
      const l = new THREE.LineSegments(g, m)
      if (dashed) l.computeLineDistances()
      l.renderOrder = 15
      l.frustumCulled = false
      objs.push(l)
    }
    if (highlight.length) {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(highlight, 3))
      const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#F6D59C', transparent: true, opacity: 1, depthWrite: false, depthTest: false }))
      l.renderOrder = 16
      objs.push(l)
    }
    return objs
  }, [routes, galaxy.systems, selection, hovered])
  useEffect(
    () => () => {
      for (const o of lines) {
        const l = o as THREE.LineSegments
        l.geometry.dispose()
        ;(l.material as THREE.Material).dispose()
      }
    },
    [lines],
  )

  const flow = useMemo(() => {
    const travel = routes.filter((r) => r.kind === 'jump' || r.kind === 'trade')
    const per = 3
    const n = Math.max(1, travel.length * per)
    const from = new Float32Array(n * 3)
    const to = new Float32Array(n * 3)
    const off = new Float32Array(n)
    const col = new Float32Array(n * 3)
    const c = new THREE.Color()
    let i = 0
    for (const r of travel) {
      const a = galaxy.systems[r.from].position
      const b = galaxy.systems[r.to].position
      c.set(ROUTE_COLORS[r.kind])
      for (let k = 0; k < per; k++, i++) {
        const rev = k % 2 === 1
        const p0 = rev ? b : a
        const p1 = rev ? a : b
        from.set([p0[0] * S, p0[1] * S, p0[2] * S], i * 3)
        to.set([p1[0] * S, p1[1] * S, p1[2] * S], i * 3)
        off[i] = (k / per + (r.id.charCodeAt(r.id.length - 1) % 10) * 0.071) % 1
        col.set([c.r, c.g, c.b], i * 3)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    g.setAttribute('aFrom', new THREE.BufferAttribute(from, 3))
    g.setAttribute('aTo', new THREE.BufferAttribute(to, 3))
    g.setAttribute('aOffset', new THREE.BufferAttribute(off, 1))
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    g.setDrawRange(0, i)
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
      vertexShader: flowVert,
      fragmentShader: flowFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const p = new THREE.Points(g, m)
    p.frustumCulled = false
    p.renderOrder = 17
    return p
  }, [routes, galaxy.systems])
  useEffect(
    () => () => {
      flow.geometry.dispose()
      ;(flow.material as THREE.Material).dispose()
    },
    [flow],
  )
  useFrame((state) => {
    const m = flow.material as THREE.ShaderMaterial
    m.uniforms.uTime.value = state.clock.elapsedTime
    m.uniforms.uPixelRatio.value = dpr
  })

  return (
    <>
      {lines.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
      <primitive object={flow} />
    </>
  )
}

function Regions({ galaxy, playerMode }: { galaxy: Galaxy; playerMode: boolean }) {
  const selection = useGalaxyUI((s) => s.selection)
  const regions = useMemo(() => Object.values(galaxy.regions).filter((r) => !playerMode || r.playerVisible), [galaxy.regions, playerMode])
  return (
    <>
      {regions.map((r) => (
        <RegionDisc key={r.id} center={r.center} radius={r.radius} color={r.color} selected={selection?.type === 'region' && selection.id === r.id} />
      ))}
    </>
  )
}

function RegionDisc({ center, radius, color, selected }: { center: [number, number, number]; radius: number; color: string; selected: boolean }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color() }, uOpacity: { value: 1 }, uSelected: { value: 0 } },
        vertexShader: regionVert,
        fragmentShader: regionFrag,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )
  useEffect(() => () => mat.dispose(), [mat])
  useEffect(() => {
    mat.uniforms.uColor.value.set(color)
    mat.uniforms.uSelected.value = selected ? 1 : 0
    mat.uniforms.uOpacity.value = 1
  }, [mat, color, selected])
  return (
    <mesh position={[center[0] * S, 0, center[2] * S]} rotation={[-Math.PI / 2, 0, 0]} scale={radius * S} material={mat} renderOrder={5}>
      <circleGeometry args={[1.02, 160]} />
    </mesh>
  )
}

const ACTION = CameraControlsImpl.ACTION
const tA = new THREE.Vector3()
const tB = new THREE.Vector3()

export const galaxyCameraApi: { controls: CameraControlsImpl | null } = { controls: null }

function GalaxyCamera({ galaxy }: { galaxy: Galaxy }) {
  const ref = useRef<CameraControlsImpl>(null)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const R = galaxy.radius * S

  useEffect(() => {
    const c = ref.current
    if (!c) return
    galaxyCameraApi.controls = c
    c.mouseButtons.left = ACTION.ROTATE
    c.mouseButtons.right = ACTION.TRUCK
    c.mouseButtons.middle = ACTION.DOLLY
    c.mouseButtons.wheel = ACTION.DOLLY
    const cam = useProjectStore.getState().project.galaxy?.view.camera
    if (cam) c.setLookAt(...cam.position, ...cam.target, false)
    else useGalaxyUI.getState().requestCamera({ type: 'frame', instant: true })
    return () => {
      const p = c.getPosition(new THREE.Vector3())
      const t = c.getTarget(new THREE.Vector3())
      useProjectStore.getState().updateGalaxy(
        (g) => {
          g.view.camera = { position: [p.x, p.y, p.z], target: [t.x, t.y, t.z] }
        },
        { viewState: true },
      )
      if (galaxyCameraApi.controls === c) galaxyCameraApi.controls = null
    }
  }, [])

  useFrame(() => {
    const c = ref.current
    if (!c) return
    const req = useGalaxyUI.getState().consumeRequest()
    if (req) {
      if (req.type === 'frame') {
        const d = R * 2.35
        c.setLookAt(0, d * 0.78, d * 0.68, 0, 0, 0, !req.instant)
      } else if (req.type === 'focus') {
        tA.set(...req.local)
        if (galaxyRuntime.group) tA.applyMatrix4(galaxyRuntime.group.matrixWorld)
        c.getPosition(tB)
        const dir = tB.sub(c.getTarget(new THREE.Vector3())).normalize()
        const d = req.distance ?? R * 0.45
        c.setLookAt(tA.x + dir.x * d, tA.y + dir.y * d, tA.z + dir.z * d, tA.x, tA.y, tA.z, !req.instant)
      } else if (req.type === 'restore') {
        c.setLookAt(...req.position, ...req.target, true)
      }
    }
    const d = Math.max(0.01, c.distance)
    const near = THREE.MathUtils.clamp(d * 0.002, 0.01, 5)
    if (Math.abs(camera.near - near) / near > 0.1) {
      camera.near = near
      camera.far = 60000
      camera.updateProjectionMatrix()
    }
  })

  return <CameraControls ref={ref} makeDefault minDistance={0.5} maxDistance={R * 8} smoothTime={0.35} draggingSmoothTime={0.12} dollyToCursor dollySpeed={0.6} />
}

export function GalaxyScene({ galaxy }: { galaxy: Galaxy }) {
  const playerMode = useUIStore((s) => s.playerMode)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const showRoutes = useGalaxyUI((s) => s.routes)
  const showRegions = useGalaxyUI((s) => s.regions)
  const group = useRef<THREE.Group>(null!)

  useEffect(() => {
    galaxyRuntime.camera = camera
    galaxyRuntime.group = group.current
    return () => {
      if (galaxyRuntime.group === group.current) galaxyRuntime.group = null
    }
  }, [camera])
  useEffect(() => {
    galaxyRuntime.size = { width: size.width, height: size.height }
  }, [size])

  useFrame((_, delta) => {
    if (useGalaxyUI.getState().rotate) galaxyRuntime.angle += delta * 0.01
    if (group.current) {
      group.current.rotation.y = galaxyRuntime.angle
      group.current.updateMatrixWorld()
    }
  })

  return (
    <>
      <Background seed={galaxy.seed} />
      <group ref={group}>
        <GalaxyCloud galaxy={galaxy} />
        {showRegions && <Regions galaxy={galaxy} playerMode={playerMode} />}
        {showRoutes && <Routes galaxy={galaxy} playerMode={playerMode} />}
        <Markers galaxy={galaxy} playerMode={playerMode} />
      </group>
      <GalaxyCamera galaxy={galaxy} />
      <GalaxyLabelUpdater />
      <PostFX />
    </>
  )
}
