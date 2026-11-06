import { memo, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { DEG, EARTH_PER_SOLAR_MASS, keplerPeriodDays, TAU } from '@/core/orbits'
import { mapOrbitDistance, parentScaleInfo } from '@/core/scale'
import type { BeltProps, BeltType, Body } from '@/core/types'
import { lightUniforms, timeUniforms } from '../runtime'
import { ParentAnchor } from '../scene/anchors'
import { LIGHTS_GLSL, NOISE_GLSL } from '../shaders/common'
import { ROCK_DETAIL_GLSL, ROCK_LIGHT_GLSL, ROTATE_GLSL } from '../small/glsl'
import { gaussian, mulberry } from '../small/noise'
import { rockGeometry } from '../small/rockGeometry'
import { QUALITY_SCALE, type BodyRendererProps } from './types'

const ROCK_VARIANTS = 4

interface BeltStyle {
  rocks: number
  dust: number
  haze: number
  size: number
  sizeSkew: number
  ice: number
  roughness: number
}

const STYLES: Record<BeltType, BeltStyle> = {
  asteroid: { rocks: 1, dust: 1.4, haze: 1, size: 0.034, sizeSkew: 3.2, ice: 0, roughness: 0.42 },
  kuiper: { rocks: 0.7, dust: 1.1, haze: 0.55, size: 0.05, sizeSkew: 2.6, ice: 0.55, roughness: 0.3 },
  debris: { rocks: 0.9, dust: 2.2, haze: 1.3, size: 0.022, sizeSkew: 3.6, ice: 0, roughness: 0.5 },
  ice: { rocks: 0.6, dust: 2.6, haze: 1.6, size: 0.026, sizeSkew: 3, ice: 1, roughness: 0.25 },
  dust: { rocks: 0.12, dust: 4, haze: 2.4, size: 0.02, sizeSkew: 4, ice: 0, roughness: 0.4 },
}

function parentMassSolar(parent: Body | null): number {
  if (!parent) return 1
  if (parent.kind === 'star') return Math.max(1e-6, parent.props.mass)
  if (parent.kind === 'planet' || parent.kind === 'moon') return Math.max(1e-12, parent.props.mass / EARTH_PER_SOLAR_MASS)
  return 1
}

const ORBIT_GLSL = `
attribute vec4 aOrbit;
attribute vec4 aShape;
uniform float uSimTime;
vec3 orbitCentre(out float theta) {
  theta = aOrbit.y + aOrbit.z * uSimTime;
  float r = aOrbit.x * (1.0 + aShape.w * cos(theta - aOrbit.y * 3.7));
  return vec3(cos(theta) * r, aOrbit.w, -sin(theta) * r);
}
`

const rockVert = `
${ROTATE_GLSL}
${ORBIT_GLSL}
attribute vec4 aSpin;
attribute vec3 aColor;
attribute float aAO;
uniform float uTime;
varying vec3 vNormalW;
varying vec3 vWorldPos;
varying vec3 vColor;
varying float vAO;
varying vec3 vLocal;
varying vec3 vRel;
varying float vSize;
void main() {
  float theta;
  vec3 centre = orbitCentre(theta);
  mat3 R = rotAxis(aSpin.xyz, aSpin.w * uTime + aOrbit.y * 5.0);
  vec3 p = R * (position * aShape.xyz);
  vec3 n = normalize(R * (normal / aShape.xyz));
  vec4 wp = modelMatrix * vec4(centre + p, 1.0);
  vWorldPos = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * n);
  vColor = aColor;
  vAO = aAO;
  vLocal = position * 3.0 + aOrbit.y * 11.0;
  vRel = wp.xyz - cameraPosition;
  vSize = length(aShape.xyz) * 0.577 * length(modelMatrix[0].xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const rockFrag = `
${LIGHTS_GLSL}
${ROCK_LIGHT_GLSL}
${NOISE_GLSL}
${ROCK_DETAIL_GLSL}
uniform float uIce;
varying vec3 vNormalW;
varying vec3 vWorldPos;
varying vec3 vColor;
varying float vAO;
varying vec3 vLocal;
varying vec3 vRel;
varying float vSize;
void main() {
  vec3 n = normalize(vNormalW);
  vec3 v = normalize(cameraPosition - vWorldPos);
  vec2 det = rockDetail(vLocal, vRel, vSize);
  n = bumpRock(n, vRel, det.x);
  vec3 light = rockLight(n, vWorldPos, v);
  vec3 albedo = vColor * vAO * (1.0 + det.y);
  vec3 col = albedo * light;
  if (uIce > 0.0 && uStarCount > 0) {
    vec3 l = normalize(uStarPos[0] - vWorldPos);
    vec3 h = normalize(l + v);
    col += uStarColor[0] * pow(max(dot(n, h), 0.0), 24.0) * 0.6 * uIce;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

const dustVert = `
${ORBIT_GLSL}
attribute float aSize;
attribute float aTwinkle;
uniform float uTime;
uniform float uFocal;
uniform float uPixelRatio;
varying float vAlpha;
varying float vLit;
${LIGHTS_GLSL}
void main() {
  float theta;
  vec3 centre = orbitCentre(theta);
  vec4 wp = modelMatrix * vec4(centre, 1.0);
  vec4 mv = viewMatrix * wp;
  float depth = max(-mv.z, 1e-4);
  float px = aSize / depth * uFocal;
  gl_PointSize = clamp(px, 1.0, 6.0) * uPixelRatio;
  vAlpha = clamp(px, 0.08, 1.0) * (0.75 + 0.25 * sin(uTime * (0.6 + aTwinkle * 2.0) + aTwinkle * 40.0));
  vLit = 1.0;
  if (uStarCount > 0) {
    vec3 toStar = normalize(uStarPos[0] - wp.xyz);
    vec3 toCam = normalize(cameraPosition - wp.xyz);
    vLit = 0.65 + 1.2 * pow(max(dot(-toCam, toStar), 0.0), 8.0);
  }
  gl_Position = projectionMatrix * mv;
}
`

const dustFrag = `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
varying float vLit;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  float a = exp(-r2 * 3.5) * vAlpha * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor * vLit, a);
}
`

const hazeVert = `
varying vec2 vPos;
varying vec3 vWorldPos;
varying vec3 vPlaneN;
void main() {
  vPos = position.xy;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vPlaneN = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const hazeFrag = `
${NOISE_GLSL}
uniform vec3 uColor;
uniform float uInner;
uniform float uOuter;
uniform float uOpacity;
uniform float uSeed;
uniform float uTime;
varying vec2 vPos;
varying vec3 vWorldPos;
varying vec3 vPlaneN;
void main() {
  float r = length(vPos);
  float t = (r - uInner) / (uOuter - uInner);
  if (t < 0.0 || t > 1.0) discard;
  float profile = smoothstep(0.0, 0.35, t) * smoothstep(1.0, 0.55, t);
  float ang = atan(vPos.y, vPos.x);
  vec2 q = vec2(cos(ang), sin(ang)) * (2.0 + t * 1.5);
  float n = fbm(vec3(q * 1.6, t * 6.0 + uSeed), 4) * 0.5 + 0.5;
  float streak = fbm(vec3(t * 28.0, uSeed * 0.3, ang * 0.2), 3) * 0.5 + 0.5;
  float a = profile * mix(0.45, 1.0, n) * mix(0.7, 1.15, streak) * uOpacity;
  vec3 v = normalize(cameraPosition - vWorldPos);
  float edge = abs(dot(v, normalize(vPlaneN)));
  a *= mix(0.35, 1.0, smoothstep(0.0, 0.25, edge));
  if (a < 0.002) discard;
  gl_FragColor = vec4(uColor, a);
}
`

interface BeltData {
  rocks: THREE.InstancedBufferGeometry[]
  dust: THREE.BufferGeometry
  innerR: number
  outerR: number
}

function buildBelt(p: BeltProps, seed: number, parent: Body | null, display: BodyRendererProps['display'], qualityScale: number): BeltData {
  const style = STYLES[p.beltType] ?? STYLES.asteroid
  const rand = mulberry(seed * 7919 + 13)
  const info = parentScaleInfo(parent, display)
  const mass = parentMassSolar(parent)
  const inner = Math.max(1e-6, Math.min(p.inner, p.outer))
  const outer = Math.max(inner * 1.001, Math.max(p.inner, p.outer))
  const innerR = mapOrbitDistance(inner, info, display)
  const outerR = mapOrbitDistance(outer, info, display)

  const clumps = Array.from({ length: 2 + Math.floor(rand() * 4) }, () => ({
    theta: rand() * TAU,
    spread: 0.15 + rand() * 0.35,
    a: inner + (outer - inner) * (0.25 + rand() * 0.5),
  }))

  const sample = (out: { r: number; theta: number; omega: number; y: number; wobble: number }) => {
    const u = THREE.MathUtils.clamp(0.5 + gaussian(rand) * 0.22, 0, 1)
    let a = inner + (outer - inner) * u
    let theta = rand() * TAU
    let omegaA = a
    if (p.clumping > 0 && rand() < p.clumping) {
      const c = clumps[Math.floor(rand() * clumps.length)]
      theta = c.theta + gaussian(rand) * c.spread
      a = THREE.MathUtils.clamp(c.a + gaussian(rand) * (outer - inner) * 0.12, inner, outer)
      omegaA = c.a
    }
    const r = mapOrbitDistance(a, info, display)
    const period = keplerPeriodDays(omegaA, mass)
    out.r = r
    out.theta = theta
    out.omega = Number.isFinite(period) && period > 0 ? TAU / period : 0
    out.y = gaussian(rand) * p.thickness * 0.5 * r
    out.wobble = rand() * p.eccentricity
  }

  const tmp = { r: 0, theta: 0, omega: 0, y: 0, wobble: 0 }
  const colA = new THREE.Color(p.colorA)
  const colB = new THREE.Color(p.colorB)
  const c = new THREE.Color()

  const rockCount = Math.max(0, Math.round(p.count * style.rocks * qualityScale))
  const perVariant = Math.ceil(rockCount / ROCK_VARIANTS)
  const rocks: THREE.InstancedBufferGeometry[] = []
  for (let vI = 0; vI < ROCK_VARIANTS; vI++) {
    const n = Math.max(0, Math.min(perVariant, rockCount - vI * perVariant))
    if (n <= 0) break
    const base = rockGeometry(seed + vI * 31, 2, style.roughness)
    const g = new THREE.InstancedBufferGeometry()
    g.setIndex(base.getIndex())
    g.setAttribute('position', base.getAttribute('position'))
    g.setAttribute('normal', base.getAttribute('normal'))
    g.setAttribute('aAO', base.getAttribute('aAO'))
    const orbit = new Float32Array(n * 4)
    const shape = new Float32Array(n * 4)
    const spin = new Float32Array(n * 4)
    const color = new Float32Array(n * 3)
    const axis = new THREE.Vector3()
    for (let i = 0; i < n; i++) {
      sample(tmp)
      orbit.set([tmp.r, tmp.theta, tmp.omega, tmp.y], i * 4)
      const s = style.size * p.rockSize * display.bodyScale * (0.35 + 2.4 * Math.pow(rand(), style.sizeSkew))
      shape.set([s * (0.8 + rand() * 0.5), s * (0.65 + rand() * 0.45), s * (0.8 + rand() * 0.5), tmp.wobble], i * 4)
      axis.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize()
      spin.set([axis.x, axis.y, axis.z, (rand() - 0.5) * 0.9], i * 4)
      c.copy(colA).lerp(colB, rand())
      const k = 0.75 + rand() * 0.45
      color.set([c.r * k, c.g * k, c.b * k], i * 3)
    }
    g.setAttribute('aOrbit', new THREE.InstancedBufferAttribute(orbit, 4))
    g.setAttribute('aShape', new THREE.InstancedBufferAttribute(shape, 4))
    g.setAttribute('aSpin', new THREE.InstancedBufferAttribute(spin, 4))
    g.setAttribute('aColor', new THREE.InstancedBufferAttribute(color, 3))
    g.instanceCount = n
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), outerR * 1.2)
    rocks.push(g)
  }

  const dustCount = Math.round(Math.max(400, p.count) * style.dust * p.dust * qualityScale)
  const dOrbit = new Float32Array(dustCount * 4)
  const dShape = new Float32Array(dustCount * 4)
  const dSize = new Float32Array(dustCount)
  const dTw = new Float32Array(dustCount)
  for (let i = 0; i < dustCount; i++) {
    sample(tmp)
    dOrbit.set([tmp.r, tmp.theta, tmp.omega, tmp.y * 1.3], i * 4)
    dShape.set([1, 1, 1, tmp.wobble], i * 4)
    dSize[i] = style.size * p.rockSize * display.bodyScale * (0.25 + rand() * 0.6)
    dTw[i] = rand()
  }
  const dust = new THREE.BufferGeometry()
  dust.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dustCount * 3), 3))
  dust.setAttribute('aOrbit', new THREE.BufferAttribute(dOrbit, 4))
  dust.setAttribute('aShape', new THREE.BufferAttribute(dShape, 4))
  dust.setAttribute('aSize', new THREE.BufferAttribute(dSize, 1))
  dust.setAttribute('aTwinkle', new THREE.BufferAttribute(dTw, 1))
  dust.boundingSphere = new THREE.Sphere(new THREE.Vector3(), outerR * 1.2)

  return { rocks, dust, innerR, outerR }
}

export const BeltRenderer = memo(function BeltRenderer({ body, parent, display, quality }: BodyRendererProps<'belt'>) {
  const p = body.props
  const style = STYLES[p.beltType] ?? STYLES.asteroid
  const qs = QUALITY_SCALE[quality]

  const data = useMemo(
    () => buildBelt(p, body.seed, parent, display, qs),
    [p, body.seed, parent, display, qs],
  )

  const materials = useMemo(() => {
    const rock = new THREE.ShaderMaterial({
      uniforms: {
        ...lightUniforms,
        uSimTime: timeUniforms.uSimTime,
        uTime: timeUniforms.uTime,
        uIce: { value: style.ice },
      },
      vertexShader: rockVert,
      fragmentShader: rockFrag,
    })
    const dust = new THREE.ShaderMaterial({
      uniforms: {
        ...lightUniforms,
        uSimTime: timeUniforms.uSimTime,
        uTime: timeUniforms.uTime,
        uColor: { value: new THREE.Color(p.dustColor) },
        uOpacity: { value: 0.55 },
        uFocal: { value: 800 },
        uPixelRatio: { value: 1 },
      },
      vertexShader: dustVert,
      fragmentShader: dustFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const haze = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(p.dustColor) },
        uInner: { value: data.innerR },
        uOuter: { value: data.outerR },
        uOpacity: { value: 0.05 * style.haze * (0.3 + p.dust) },
        uSeed: { value: (body.seed % 1000) * 0.013 },
        uTime: timeUniforms.uTime,
      },
      vertexShader: hazeVert,
      fragmentShader: hazeFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
    return { rock, dust, haze }
  }, [style, p.dustColor, p.dust, data.innerR, data.outerR, body.seed])

  const objects = useMemo(() => {
    const rocks = data.rocks.map((g) => {
      const m = new THREE.Mesh(g, materials.rock)
      m.frustumCulled = false
      return m
    })
    const dust = new THREE.Points(data.dust, materials.dust)
    dust.frustumCulled = false
    dust.onBeforeRender = (renderer, _scene, camera) => {
      const cam = camera as THREE.PerspectiveCamera
      const h = renderer.getSize(tmpSize).y
      materials.dust.uniforms.uFocal.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov ?? 45) / 2))
      materials.dust.uniforms.uPixelRatio.value = renderer.getPixelRatio()
    }
    const hazeGeo = new THREE.RingGeometry(data.innerR, data.outerR, 256, 1)
    const haze = new THREE.Mesh(hazeGeo, materials.haze)
    haze.rotation.x = -Math.PI / 2
    haze.renderOrder = -1
    return { rocks, dust, haze, hazeGeo }
  }, [data, materials])

  useEffect(
    () => () => {
      data.rocks.forEach((g) => g.dispose())
      data.dust.dispose()
    },
    [data],
  )
  useEffect(
    () => () => {
      materials.rock.dispose()
      materials.dust.dispose()
      materials.haze.dispose()
    },
    [materials],
  )
  useEffect(() => () => objects.hazeGeo.dispose(), [objects])

  const quaternion = useMemo(() => {
    const qn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.node * DEG)
    const qi = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), p.inclination * DEG)
    return qn.multiply(qi)
  }, [p.node, p.inclination])

  if (!body.visible) return null

  return (
    <ParentAnchor id={body.parentId}>
      <group quaternion={quaternion}>
        {objects.rocks.map((m, i) => (
          <primitive key={i} object={m} />
        ))}
        <primitive object={objects.dust} />
        {p.dust > 0 && <primitive object={objects.haze} />}
      </group>
    </ParentAnchor>
  )
})

const tmpSize = new THREE.Vector2()
