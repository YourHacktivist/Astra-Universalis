import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { lightUniforms, runtime, timeUniforms } from '../runtime'
import { BodyAnchor, SpinGroup } from '../scene/anchors'
import { LIGHTS_GLSL, NOISE_GLSL } from '../shaders/common'
import { ROCK_DETAIL_GLSL, ROCK_LIGHT_GLSL } from '../small/glsl'
import { gaussian, mulberry } from '../small/noise'
import { rockGeometry } from '../small/rockGeometry'
import { QUALITY_SCALE, type BodyRendererProps } from './types'

const nucleusVert = `
attribute float aAO;
varying vec3 vNormalW;
varying vec3 vWorldPos;
varying float vAO;
varying vec3 vLocal;
varying vec3 vRel;
varying float vSize;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vAO = aAO;
  vLocal = position * 3.0;
  vRel = wp.xyz - cameraPosition;
  vSize = length(modelMatrix[0].xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`
const nucleusFrag = `
${LIGHTS_GLSL}
${ROCK_LIGHT_GLSL}
${NOISE_GLSL}
${ROCK_DETAIL_GLSL}
uniform vec3 uColor;
uniform float uActivity;
varying vec3 vNormalW;
varying vec3 vWorldPos;
varying float vAO;
varying vec3 vLocal;
varying vec3 vRel;
varying float vSize;
void main() {
  vec3 n = normalize(vNormalW);
  vec3 v = normalize(cameraPosition - vWorldPos);
  vec2 det = rockDetail(vLocal, vRel, vSize);
  n = bumpRock(n, vRel, det.x);
  float ice = smoothstep(0.62, 0.8, snoise(vLocal * 1.7 + 4.0) * 0.5 + 0.5);
  vec3 albedo = mix(uColor * (1.0 + det.y), vec3(0.78, 0.82, 0.86), ice * 0.6);
  vec3 col = albedo * vAO * rockLight(n, vWorldPos, v);
  if (uStarCount > 0) {
    vec3 l = normalize(uStarPos[0] - vWorldPos);
    col += vec3(0.8, 0.9, 1.0) * pow(max(dot(n, l), 0.0), 6.0) * 0.4 * uActivity;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

const comaVert = `
uniform float uSize;
varying vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
}
`
const comaFrag = `
uniform vec3 uColor;
uniform float uIntensity;
varying vec2 vUv;
void main() {
  float r = length(vUv);
  float core = exp(-r * r * 60.0) * 2.2;
  float coma = exp(-r * r * 7.0) * 0.55 + exp(-r * 3.2) * 0.25;
  float a = (core + coma) * uIntensity * smoothstep(1.0, 0.75, r);
  if (a < 0.002) discard;
  gl_FragColor = vec4(uColor * a, a);
}
`

const tailVert = `
attribute vec4 aSeed;
uniform vec3 uNucleus;
uniform vec3 uAnti;
uniform vec3 uLag;
uniform float uLength;
uniform float uWidth;
uniform float uCurve;
uniform float uTime;
uniform float uSpeed;
uniform float uFocal;
uniform float uPixelRatio;
uniform float uGrain;
varying float vT;
varying float vAlpha;
void main() {
  float t = fract(aSeed.x + uTime * uSpeed * (0.6 + aSeed.w * 0.8));
  vT = t;
  vec3 axis = normalize(uAnti + uLag * uCurve * 0.35);
  vec3 side1 = normalize(cross(axis, abs(axis.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 side2 = cross(axis, side1);
  float L = uLength;
  vec3 p = uNucleus + uAnti * t * L + uLag * (t * t) * L * uCurve;
  float spread = uWidth * (0.15 + t * 1.6) * (1.0 + uCurve * 0.9);
  vec2 lat = aSeed.yz;
  if (uCurve < 0.01) {
    float strand = floor(aSeed.w * 5.0);
    float ang = strand * 1.2566 + sin(t * 9.0 + strand + uTime * 0.6) * 0.35;
    lat = mix(lat, vec2(cos(ang), sin(ang)) * 0.8, 0.55);
  }
  p += (side1 * lat.x + side2 * lat.y) * spread;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float depth = max(-mv.z, 1e-4);
  float worldSize = uGrain * (0.6 + t * 2.2);
  gl_PointSize = clamp(worldSize / depth * uFocal, 1.0, 48.0) * uPixelRatio;
  float head = smoothstep(0.0, 0.04, t);
  vAlpha = head * pow(max(1.0 - t, 0.0), uCurve > 0.0 ? 1.3 : 1.8);
  gl_Position = projectionMatrix * mv;
}
`
const tailFrag = `
uniform vec3 uColor;
uniform vec3 uHeadColor;
uniform float uOpacity;
varying float vT;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  float a = exp(-r2 * 3.0) * vAlpha * uOpacity;
  if (a < 0.002) discard;
  vec3 col = mix(uHeadColor, uColor, smoothstep(0.0, 0.35, vT));
  gl_FragColor = vec4(col, a);
}
`

const tmpSize = new THREE.Vector2()
const toStar = new THREE.Vector3()
const lag = new THREE.Vector3()

function makeTail(count: number, seed: number) {
  const rand = mulberry(seed)
  const g = new THREE.BufferGeometry()
  const s = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) s.set([rand(), gaussian(rand) * 0.5, gaussian(rand) * 0.5, rand()], i * 4)
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
  g.setAttribute('aSeed', new THREE.BufferAttribute(s, 4))
  return g
}

export const CometRenderer = memo(function CometRenderer({ body, parent, display, quality }: BodyRendererProps<'comet'>) {
  const p = body.props
  const qs = QUALITY_SCALE[quality]
  const radius = 0.035 * display.bodyScale
  const comaRef = useRef<THREE.Mesh>(null!)

  const geo = useMemo(() => rockGeometry(body.seed % 997, 4, 0.45), [body.seed])

  const mats = useMemo(() => {
    const nucleus = new THREE.ShaderMaterial({
      uniforms: { ...lightUniforms, uColor: { value: new THREE.Color('#3e3a36') }, uActivity: { value: p.activity } },
      vertexShader: nucleusVert,
      fragmentShader: nucleusFrag,
    })
    const coma = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(p.comaColor) }, uIntensity: { value: 1 }, uSize: { value: 1 } },
      vertexShader: comaVert,
      fragmentShader: comaFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const tailUniforms = () => ({
      uNucleus: { value: new THREE.Vector3() },
      uAnti: { value: new THREE.Vector3(1, 0, 0) },
      uLag: { value: new THREE.Vector3(0, 0, 1) },
      uLength: { value: 1 },
      uWidth: { value: 0.1 },
      uTime: timeUniforms.uTime,
      uFocal: { value: 800 },
      uPixelRatio: { value: 1 },
      uOpacity: { value: 1 },
      uHeadColor: { value: new THREE.Color(p.comaColor) },
    })
    const ion = new THREE.ShaderMaterial({
      uniforms: { ...tailUniforms(), uCurve: { value: 0 }, uSpeed: { value: 0.22 }, uColor: { value: new THREE.Color(p.ionColor) }, uGrain: { value: 0.012 } },
      vertexShader: tailVert,
      fragmentShader: tailFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const dust = new THREE.ShaderMaterial({
      uniforms: { ...tailUniforms(), uCurve: { value: 0.55 }, uSpeed: { value: 0.07 }, uColor: { value: new THREE.Color(p.dustColor) }, uGrain: { value: 0.02 } },
      vertexShader: tailVert,
      fragmentShader: tailFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { nucleus, coma, ion, dust }
  }, [p.activity, p.comaColor, p.ionColor, p.dustColor])

  const tails = useMemo(() => {
    const ionPts = new THREE.Points(makeTail(Math.round(1400 * qs), body.seed + 1), mats.ion)
    const dustPts = new THREE.Points(makeTail(Math.round(2200 * qs), body.seed + 2), mats.dust)
    for (const t of [ionPts, dustPts]) {
      t.frustumCulled = false
      t.renderOrder = 5
    }
    const setFocal = (renderer: THREE.WebGLRenderer, camera: THREE.Camera) => {
      const cam = camera as THREE.PerspectiveCamera
      const f = renderer.getSize(tmpSize).y / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov ?? 45) / 2))
      const pr = renderer.getPixelRatio()
      for (const m of [mats.ion, mats.dust]) {
        m.uniforms.uFocal.value = f
        m.uniforms.uPixelRatio.value = pr
      }
    }
    ionPts.onBeforeRender = (r, _s, c) => setFocal(r, c)
    return { ionPts, dustPts }
  }, [mats, qs, body.seed])

  useEffect(
    () => () => {
      tails.ionPts.geometry.dispose()
      tails.dustPts.geometry.dispose()
    },
    [tails],
  )
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])

  useFrame(() => {
    const rt = runtime.bodies.get(body.id)
    if (!rt) return
    const prt = parent ? runtime.bodies.get(parent.id) : undefined
    if (prt && (parent!.kind === 'star' || parent!.kind === 'barycenter')) toStar.copy(prt.pos)
    else if (lightUniforms.uStarCount.value > 0) toStar.copy(lightUniforms.uStarPos.value[0])
    else toStar.set(0, 0, 0)
    toStar.sub(rt.pos)
    const dist = toStar.length() || 1
    toStar.divideScalar(-dist)
    lag.copy(rt.vel).multiplyScalar(-1)
    lag.addScaledVector(toStar, -lag.dot(toStar)).normalize()

    const r = Math.max(0.05, rt.distanceAU || 1)
    const heat = Math.min(3, 1 / (r * r))
    const fadeFar = THREE.MathUtils.smoothstep(r, 6, 2.2)
    const act = p.activity * fadeFar
    const length = (0.6 + 4.2 * Math.sqrt(heat)) * p.tailLength * Math.max(0.15, act) * display.bodyScale
    const width = 0.06 * display.bodyScale * (0.5 + Math.sqrt(heat))

    for (const [m, k] of [
      [mats.ion, 1.0],
      [mats.dust, 0.75],
    ] as const) {
      m.uniforms.uNucleus.value.copy(rt.pos)
      m.uniforms.uAnti.value.copy(toStar)
      m.uniforms.uLag.value.copy(lag)
      m.uniforms.uLength.value = length * k
      m.uniforms.uWidth.value = width
      m.uniforms.uOpacity.value = 0.55 * Math.min(1.2, act) * (m === mats.ion ? 1 : 0.8)
    }
    tails.ionPts.visible = rt.visible && act > 0.01
    tails.dustPts.visible = rt.visible && act > 0.01

    const coma = comaRef.current
    if (coma) {
      mats.coma.uniforms.uSize.value = radius * (6 + 22 * Math.sqrt(heat) * Math.min(1.5, act + 0.2))
      mats.coma.uniforms.uIntensity.value = 0.35 + Math.min(1.4, act * Math.sqrt(heat))
    }
  })

  return (
    <>
      <BodyAnchor id={body.id}>
        <SpinGroup id={body.id}>
          <mesh geometry={geo} material={mats.nucleus} scale={radius} />
        </SpinGroup>
        <mesh ref={comaRef} material={mats.coma} renderOrder={6} frustumCulled={false}>
          <planeGeometry args={[2, 2]} />
        </mesh>
      </BodyAnchor>
      <primitive object={tails.dustPts} />
      <primitive object={tails.ionPts} />
    </>
  )
})
