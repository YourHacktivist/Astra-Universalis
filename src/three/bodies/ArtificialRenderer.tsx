import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { bodyVisualRadius } from '@/core/scale'
import type { GateBody, ShipBody, StationBody } from '@/core/types'
import { runtime, timeUniforms } from '../runtime'
import { BodyAnchor, TiltFrame } from '../scene/anchors'
import { NOISE_GLSL } from '../shaders/common'
import { buildGate, buildShip, buildStation, PART_KINDS, type ModelData, type PartKind } from '../small/artificial'
import { createHullMaterial, spaceEnvironment, type HullMaterial } from '../small/hullMaterial'
import { rockGeometry } from '../small/rockGeometry'
import type { BodyRendererProps } from './types'

interface MaterialSet {
  parts: Record<PartKind, THREE.Material>
  window: THREE.MeshBasicMaterial
  windowBase: THREE.Color
  hulls: HullMaterial[]
  dispose(): void
}

function createMaterials(hull: string, accent: string, lights: string, damaged: boolean, seed: number, envMap: THREE.Texture | null): MaterialSet {
  const dim = damaged ? 0.55 : 1
  const hullM = createHullMaterial({ color: new THREE.Color(hull).multiplyScalar(dim), kind: 'hull', damaged, seed, envMap })
  const accentM = createHullMaterial({ color: new THREE.Color(accent).multiplyScalar(dim), kind: 'accent', damaged, seed: seed + 1, envMap })
  const darkM = createHullMaterial({ color: new THREE.Color('#34373e').multiplyScalar(dim), kind: 'dark', damaged, seed: seed + 2, envMap })
  const panelM = createHullMaterial({
    color: '#14244a',
    kind: 'panel',
    damaged,
    seed: seed + 3,
    envMap,
    emissive: '#0b1838',
    emissiveIntensity: damaged ? 0.05 : 0.25,
  })
  const windowBase = new THREE.Color(lights).multiplyScalar(damaged ? 0.6 : 2.6)
  const windowM = new THREE.MeshBasicMaterial({ color: windowBase.clone(), toneMapped: false })
  const glassM = new THREE.MeshStandardMaterial({
    color: '#9cc4ff',
    metalness: 0.1,
    roughness: 0.08,
    transparent: true,
    opacity: 0.55,
    envMap,
    envMapIntensity: 1.2,
    emissive: new THREE.Color(lights),
    emissiveIntensity: damaged ? 0.05 : 0.55,
    depthWrite: false,
  })
  const rockM = new THREE.MeshStandardMaterial({ color: '#5f5a54', metalness: 0.05, roughness: 0.95, envMap, envMapIntensity: 0.3 })
  const parts: Record<PartKind, THREE.Material> = {
    hull: hullM,
    accent: accentM,
    dark: darkM,
    panel: panelM,
    window: windowM,
    glass: glassM,
    rock: rockM,
  }
  return {
    parts,
    window: windowM,
    windowBase,
    hulls: [hullM, accentM, darkM, panelM],
    dispose() {
      for (const m of Object.values(parts)) m.dispose()
    },
  }
}

function setHullScale(mats: MaterialSet, scale: number) {
  for (const m of mats.hulls) m.userData.uScale.value = scale
}

const navVert = `
attribute float aType;
attribute float aSize;
attribute float aPhase;
uniform float uTime;
uniform float uFocal;
uniform float uPixelRatio;
uniform float uScale;
uniform float uDamaged;
uniform vec3 uEngine;
uniform float uThrust;
varying vec3 vColor;
varying float vAlpha;
float h11(float p) { return fract(sin(p * 127.1) * 43758.5453); }
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float depth = max(-mv.z, 1e-4);
  float px = 0.06 * uScale * aSize / depth * uFocal;
  gl_PointSize = clamp(px * 3.0, 2.2 * aSize, 30.0 * aSize) * uPixelRatio;
  float t = uTime + aPhase * 10.0;
  vec3 c = vec3(1.0);
  float a = 1.0;
  if (aType < 0.5) { c = vec3(1.0, 0.16, 0.1); a = 0.55 + 0.45 * step(0.5, fract(t * 0.5)); }
  else if (aType < 1.5) { c = vec3(0.15, 1.0, 0.35); a = 0.55 + 0.45 * step(0.5, fract(t * 0.5 + 0.5)); }
  else if (aType < 2.5) { c = vec3(1.0); a = 0.15 + 1.4 * step(0.9, fract(t * 0.7)); }
  else if (aType < 3.5) { c = vec3(1.0, 0.72, 0.35); a = 0.75 + 0.25 * sin(t * 2.0); }
  else if (aType < 4.5) { c = vec3(1.0, 0.5, 0.15); a = 0.7 + 0.3 * h11(floor(t * 14.0)); }
  else if (aType < 5.5) { c = vec3(0.9, 0.95, 1.0); a = 0.3 + 0.9 * step(0.6, h11(floor(t * 6.0) + aPhase * 91.0)); }
  else { c = uEngine; a = uThrust * (0.85 + 0.15 * sin(t * 37.0)); }
  if (uDamaged > 0.5 && aType < 5.5) a *= step(0.72, h11(floor(t * 3.0) + aPhase * 17.0));
  vColor = c;
  vAlpha = a;
  gl_Position = projectionMatrix * mv;
}
`

const navFrag = `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  float core = exp(-r2 * 26.0) * 2.4;
  float halo = exp(-r2 * 4.0) * 0.5;
  float a = (core + halo) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor * a, a);
}
`

const tmpSize = new THREE.Vector2()

function createNavPoints(model: ModelData, engineColor: string, damaged: boolean) {
  const lights = [...model.lights]
  for (const e of model.engines) lights.push({ x: e.x, y: e.y, z: e.z, type: 6, size: 1.2 + e.r * 8, phase: Math.random() })
  const n = Math.max(1, lights.length)
  const pos = new Float32Array(n * 3)
  const type = new Float32Array(n)
  const size = new Float32Array(n)
  const phase = new Float32Array(n)
  lights.forEach((l, i) => {
    pos.set([l.x, l.y, l.z], i * 3)
    type[i] = l.type
    size[i] = l.size
    phase[i] = l.phase
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('aType', new THREE.BufferAttribute(type, 1))
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
  g.setDrawRange(0, lights.length)
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uTime: timeUniforms.uTime,
      uFocal: { value: 800 },
      uPixelRatio: { value: 1 },
      uScale: { value: 1 },
      uDamaged: { value: damaged ? 1 : 0 },
      uEngine: { value: new THREE.Color(engineColor).multiplyScalar(1.6) },
      uThrust: { value: 1 },
    },
    vertexShader: navVert,
    fragmentShader: navFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const pts = new THREE.Points(g, m)
  pts.frustumCulled = false
  pts.renderOrder = 8
  pts.onBeforeRender = (renderer, _s, camera) => {
    const cam = camera as THREE.PerspectiveCamera
    m.uniforms.uFocal.value = renderer.getSize(tmpSize).y / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov ?? 45) / 2))
    m.uniforms.uPixelRatio.value = renderer.getPixelRatio()
  }
  return pts
}

const plumeVert = `
attribute float aT;
varying float vT;
varying vec3 vN;
varying vec3 vV;
void main() {
  vT = aT;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`
const plumeFrag = `
uniform vec3 uColor;
uniform float uTime;
uniform float uThrust;
varying float vT;
varying vec3 vN;
varying vec3 vV;
void main() {
  float facing = abs(dot(normalize(vN), normalize(vV)));
  float body = pow(facing, 1.5);
  float flick = 0.85 + 0.15 * sin(uTime * 41.0 + vT * 23.0);
  float diamonds = 0.75 + 0.25 * cos(vT * 34.0 - uTime * 6.0);
  float a = pow(max(1.0 - vT, 0.0), 1.7) * body * flick * diamonds * uThrust;
  vec3 col = mix(vec3(1.0, 0.98, 0.95), uColor, smoothstep(0.0, 0.25, vT));
  gl_FragColor = vec4(col * 1.6, a * 0.9);
}
`

const trailVert = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const trailFrag = `
${NOISE_GLSL}
uniform vec3 uColor;
uniform float uTime;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float along = vUv.y;
  float across = abs(vUv.x - 0.5) * 2.0;
  float n = snoise(vec3(along * 6.0 - uTime * 1.5, vUv.x * 3.0, uTime * 0.2)) * 0.5 + 0.5;
  float a = pow(max(1.0 - along, 0.0), 2.2) * smoothstep(1.0, 0.0, across) * (0.55 + 0.45 * n) * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
}
`

function createPlumes(model: ModelData, color: string) {
  if (!model.engines.length) return null
  const geos: THREE.BufferGeometry[] = []
  for (const e of model.engines) {
    const g = new THREE.CylinderGeometry(e.r * 0.25, e.r * 0.95, e.len, 14, 6, true).toNonIndexed()
    const pos = g.getAttribute('position') as THREE.BufferAttribute
    const t = new Float32Array(pos.count)
    for (let i = 0; i < pos.count; i++) t[i] = 0.5 + pos.getY(i) / e.len
    g.setAttribute('aT', new THREE.BufferAttribute(t, 1))
    g.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
    g.translate(e.x, e.y, e.z - e.len / 2)
    g.deleteAttribute('uv')
    geos.push(g)
  }
  const merged = geos.length === 1 ? geos[0] : mergeAll(geos)
  const m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: timeUniforms.uTime, uThrust: { value: 1 } },
    vertexShader: plumeVert,
    fragmentShader: plumeFrag,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  })
  const mesh = new THREE.Mesh(merged, m)
  mesh.renderOrder = 7
  return mesh
}

function mergeAll(geos: THREE.BufferGeometry[]) {
  let count = 0
  for (const g of geos) count += g.getAttribute('position').count
  const pos = new Float32Array(count * 3)
  const nor = new Float32Array(count * 3)
  const t = new Float32Array(count)
  let o = 0
  for (const g of geos) {
    const n = g.getAttribute('position').count
    pos.set(g.getAttribute('position').array as Float32Array, o * 3)
    nor.set(g.getAttribute('normal').array as Float32Array, o * 3)
    t.set(g.getAttribute('aT').array as Float32Array, o)
    o += n
    g.dispose()
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  out.setAttribute('aT', new THREE.BufferAttribute(t, 1))
  return out
}

function createTrail(model: ModelData, color: string) {
  const back = model.engines.length ? Math.min(...model.engines.map((e) => e.z)) : -1
  const width = model.engines.length ? Math.max(0.12, ...model.engines.map((e) => Math.abs(e.x) * 2 + e.r * 3)) : 0.2
  const len = 7
  const a = new THREE.PlaneGeometry(width, len, 1, 1)
  a.rotateX(-Math.PI / 2)
  a.translate(0, 0, back - len / 2)
  const b = a.clone()
  b.rotateZ(Math.PI / 2)
  b.translate(0, 0, 0)
  for (const g of [a, b]) {
    const uv = g.getAttribute('uv') as THREE.BufferAttribute
    const p = g.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setY(i, (back - p.getZ(i)) / len)
  }
  const merged = new THREE.BufferGeometry()
  const ai = a.toNonIndexed()
  const bi = b.toNonIndexed()
  const pos = new Float32Array([...(ai.getAttribute('position').array as Float32Array), ...(bi.getAttribute('position').array as Float32Array)])
  const uv = new Float32Array([...(ai.getAttribute('uv').array as Float32Array), ...(bi.getAttribute('uv').array as Float32Array)])
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  for (const g of [a, b, ai, bi]) g.dispose()
  const m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: timeUniforms.uTime, uOpacity: { value: 0.35 } },
    vertexShader: trailVert,
    fragmentShader: trailFrag,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  })
  const mesh = new THREE.Mesh(merged, m)
  mesh.renderOrder = 6
  return mesh
}

const surfaceVert = `
uniform float uBillboard;
varying vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  if (uBillboard > 0.5) {
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float s = length(modelMatrix[0].xyz);
    mv.xy += position.xy * s;
    gl_Position = projectionMatrix * mv;
  } else {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
}
`

const surfaceFrag = `
${NOISE_GLSL}
uniform vec3 uColor;
uniform float uTime;
uniform float uMode;
uniform float uActive;
varying vec2 vUv;
void main() {
  float r = length(vUv);
  float ang = atan(vUv.y, vUv.x);
  vec3 col;
  float a;
  if (uMode < 0.5) {
    float swirl = snoise(vec3(cos(ang) * r * 2.2, sin(ang) * r * 2.2, uTime * 0.25 + r * 2.5 - ang * 0.4)) * 0.5 + 0.5;
    float rip = sin(r * 34.0 - uTime * 4.0) * 0.5 + 0.5;
    float edge = smoothstep(1.0, 0.86, r);
    float rim = smoothstep(0.8, 1.0, r) * edge;
    float core = exp(-r * r * 5.0);
    col = uColor * (0.5 + 0.9 * swirl) + vec3(1.0) * core * 0.6 + uColor * rim * 1.5;
    a = edge * (0.18 + 0.22 * swirl + 0.12 * rip + 0.35 * core + 0.5 * rim) * uActive;
  } else if (uMode < 1.5) {
    float arms = pow(0.5 + 0.5 * cos(3.0 * (ang + 3.5 * log(max(r, 0.02)) - uTime * 0.8)), 3.0);
    float n = snoise(vec3(vUv * 3.0, uTime * 0.3)) * 0.5 + 0.5;
    float fall = exp(-r * 2.6) * smoothstep(1.0, 0.6, r);
    float hole = smoothstep(0.06, 0.18, r);
    float rg = (r - 0.16) * 18.0;
    float ringGlow = exp(-rg * rg) * 1.6;
    col = mix(uColor, vec3(1.0), ringGlow * 0.5) * (arms * 0.9 + n * 0.4 + ringGlow);
    a = (fall * (arms * 0.8 + n * 0.25) * hole + ringGlow * 0.6) * uActive;
  } else {
    float t = fract(uTime * 0.45);
    float d1 = (r - t * 0.95) * 22.0;
    float ring = exp(-d1 * d1) * (1.0 - t);
    float t2 = fract(uTime * 0.45 + 0.5);
    float d2 = (r - t2 * 0.95) * 22.0;
    ring += exp(-d2 * d2) * (1.0 - t2);
    col = uColor;
    a = ring * 0.8 * uActive * smoothstep(1.0, 0.9, r);
  }
  if (a < 0.003) discard;
  gl_FragColor = vec4(col, a);
}
`

function createSurface(mode: 0 | 1 | 2, radius: number, color: string) {
  const g = mode === 0 ? new THREE.CircleGeometry(radius, 96) : new THREE.PlaneGeometry(radius * 2, radius * 2)
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uTime: timeUniforms.uTime,
      uMode: { value: mode },
      uActive: { value: 1 },
      uBillboard: { value: mode === 0 ? 0 : 1 },
    },
    vertexShader: surfaceVert,
    fragmentShader: surfaceFrag,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  })
  const mesh = new THREE.Mesh(g, m)
  mesh.renderOrder = 7
  if (mode !== 0) mesh.frustumCulled = false
  return mesh
}

function useSpaceEnv() {
  const gl = useThree((st) => st.gl)
  return useMemo(() => spaceEnvironment(gl), [gl])
}

function useModelObjects(model: ModelData, mats: MaterialSet) {
  return useMemo(() => {
    const make = (parts: ModelData['parts']) =>
      PART_KINDS.filter((k) => parts[k]).map((k) => {
        const mesh = new THREE.Mesh(parts[k], mats.parts[k])
        if (k === 'glass') mesh.renderOrder = 4
        return mesh
      })
    return { staticMeshes: make(model.parts), spinMeshes: make(model.spin) }
  }, [model, mats])
}

function disposeModel(model: ModelData) {
  for (const g of Object.values(model.parts)) g?.dispose()
  for (const g of Object.values(model.spin)) g?.dispose()
}

function useWindowFlicker(mats: MaterialSet, damaged: boolean, seed: number) {
  useFrame((state) => {
    if (!damaged) return
    const t = state.clock.elapsedTime
    const h = Math.sin(Math.floor(t * 7 + seed) * 12.9898) * 43758.5453
    const f = h - Math.floor(h)
    mats.window.color.copy(mats.windowBase).multiplyScalar(f > 0.82 ? 1.8 : 0.18 + f * 0.25)
  })
}

const StationModel = memo(function StationModel({ body, radius }: { body: StationBody; radius: number }) {
  const p = body.props
  const model = useMemo(() => buildStation(p.stationType, body.seed), [p.stationType, body.seed])
  const damaged = p.damaged || p.stationType === 'derelict'
  const env = useSpaceEnv()
  const mats = useMemo(() => createMaterials(p.hullColor, p.accentColor, p.lightsColor, damaged, body.seed, env), [p.hullColor, p.accentColor, p.lightsColor, damaged, body.seed, env])
  const objs = useModelObjects(model, mats)
  const nav = useMemo(() => createNavPoints(model, p.lightsColor, damaged), [model, p.lightsColor, damaged])
  const rock = useMemo(() => (p.stationType === 'outpost' ? rockGeometry(body.seed % 991, 4, 0.32) : null), [p.stationType, body.seed])
  const spinRef = useRef<THREE.Group>(null!)
  const tumbleRef = useRef<THREE.Group>(null!)

  useEffect(() => () => disposeModel(model), [model])
  useEffect(() => () => mats.dispose(), [mats])
  useEffect(
    () => () => {
      nav.geometry.dispose()
      ;(nav.material as THREE.Material).dispose()
    },
    [nav],
  )
  useWindowFlicker(mats, damaged, body.seed)

  useFrame((_s, dt) => {
    ;(nav.material as THREE.ShaderMaterial).uniforms.uScale.value = radius
    setHullScale(mats, radius)
    const rate = p.stationType === 'spindle' ? 0.35 : 0.22
    if (spinRef.current && !damaged) spinRef.current.rotation.y += dt * rate * p.spin
    if (tumbleRef.current && damaged) {
      tumbleRef.current.rotation.x += dt * 0.021
      tumbleRef.current.rotation.z += dt * 0.013
    }
  })

  return (
    <group ref={tumbleRef} scale={radius} rotation={damaged ? [0.5, 0.2, 0.35] : [0, 0, 0]}>
      {rock && <mesh geometry={rock} material={mats.parts.rock} scale={[0.78, 0.48, 0.78]} />}
      {objs.staticMeshes.map((m, i) => (
        <primitive key={`s${i}`} object={m} />
      ))}
      <group ref={spinRef}>
        {objs.spinMeshes.map((m, i) => (
          <primitive key={`r${i}`} object={m} />
        ))}
      </group>
      <primitive object={nav} />
    </group>
  )
})

const up = new THREE.Vector3(0, 1, 0)
const zero = new THREE.Vector3()
const mtx = new THREE.Matrix4()

const ShipModel = memo(function ShipModel({ body, radius }: { body: ShipBody; radius: number }) {
  const p = body.props
  const model = useMemo(() => buildShip(p.shipType, body.seed), [p.shipType, body.seed])
  const damaged = p.damaged || p.shipType === 'derelict'
  const env = useSpaceEnv()
  const mats = useMemo(() => createMaterials(p.hullColor, '#c9a24e', '#ffd9a0', damaged, body.seed, env), [p.hullColor, damaged, body.seed, env])
  const objs = useModelObjects(model, mats)
  const nav = useMemo(() => createNavPoints(model, p.engineColor, damaged), [model, p.engineColor, damaged])
  const plumes = useMemo(() => createPlumes(model, p.engineColor), [model, p.engineColor])
  const trail = useMemo(() => createTrail(model, p.engineColor), [model, p.engineColor])
  const orient = useRef<THREE.Group>(null!)

  useEffect(() => () => disposeModel(model), [model])
  useEffect(() => () => mats.dispose(), [mats])
  useEffect(
    () => () => {
      for (const o of [nav, plumes, trail]) {
        if (!o) continue
        o.geometry.dispose()
        ;(o.material as THREE.Material).dispose()
      }
    },
    [nav, plumes, trail],
  )
  useWindowFlicker(mats, damaged, body.seed)

  const thrusting = p.thrusting && !damaged
  useFrame((state) => {
    const rt = runtime.bodies.get(body.id)
    const g = orient.current
    if (!rt || !g) return
    const navMat = nav.material as THREE.ShaderMaterial
    navMat.uniforms.uScale.value = radius
    setHullScale(mats, radius)
    navMat.uniforms.uThrust.value = thrusting ? 1 : 0
    if (damaged) {
      const t = state.clock.elapsedTime
      g.rotation.set(t * 0.031 + body.seed, t * 0.017, t * 0.023)
    } else {
      mtx.lookAt(rt.vel, zero, up)
      g.quaternion.setFromRotationMatrix(mtx)
    }
  })

  return (
    <group ref={orient}>
      <group scale={radius}>
        {objs.staticMeshes.map((m, i) => (
          <primitive key={`s${i}`} object={m} />
        ))}
        {thrusting && plumes && <primitive object={plumes} />}
        {thrusting && p.trail && trail && <primitive object={trail} />}
        <primitive object={nav} />
      </group>
    </group>
  )
})

const GateModel = memo(function GateModel({ body, radius }: { body: GateBody; radius: number }) {
  const p = body.props
  const model = useMemo(() => buildGate(p.gateType, body.seed), [p.gateType, body.seed])
  const env = useSpaceEnv()
  const mats = useMemo(() => createMaterials('#7d828c', p.color, p.color, !p.active, body.seed, env), [p.color, p.active, body.seed, env])
  const objs = useModelObjects(model, mats)
  const nav = useMemo(() => createNavPoints(model, p.color, false), [model, p.color])
  const surface = useMemo(() => {
    const mode = p.gateType === 'ring' ? 0 : p.gateType === 'anomaly' ? 1 : 2
    const r = mode === 2 ? 1.6 : model.surface || 1
    return createSurface(mode, r, p.color)
  }, [p.gateType, p.color, model.surface])
  const face = useRef<THREE.Group>(null!)
  const target = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => () => disposeModel(model), [model])
  useEffect(() => () => mats.dispose(), [mats])
  useEffect(
    () => () => {
      for (const o of [nav, surface]) {
        o.geometry.dispose()
        ;(o.material as THREE.Material).dispose()
      }
    },
    [nav, surface],
  )

  useFrame(() => {
    const rt = runtime.bodies.get(body.id)
    const g = face.current
    if (!rt || !g) return
    ;(nav.material as THREE.ShaderMaterial).uniforms.uScale.value = radius
    setHullScale(mats, radius)
    ;(surface.material as THREE.ShaderMaterial).uniforms.uActive.value = p.active ? 1 : p.gateType === 'anomaly' ? 0.25 : 0
    target.copy(rt.parentPos)
    if (target.distanceToSquared(rt.pos) < 1e-8) target.set(rt.pos.x + 1, rt.pos.y, rt.pos.z)
    g.lookAt(target)
  })

  return (
    <group ref={face}>
      <group scale={radius}>
        {objs.staticMeshes.map((m, i) => (
          <primitive key={`s${i}`} object={m} />
        ))}
        <primitive object={surface} />
        <primitive object={nav} />
      </group>
    </group>
  )
})

export const ArtificialRenderer = memo(function ArtificialRenderer({ body, display }: BodyRendererProps<'station' | 'ship' | 'gate'>) {
  const radius = bodyVisualRadius(body, display)
  return (
    <BodyAnchor id={body.id}>
      {body.kind === 'station' ? (
        <TiltFrame id={body.id}>
          <StationModel body={body} radius={radius} />
        </TiltFrame>
      ) : body.kind === 'ship' ? (
        <ShipModel body={body} radius={radius} />
      ) : (
        <GateModel body={body} radius={radius} />
      )}
    </BodyAnchor>
  )
})
