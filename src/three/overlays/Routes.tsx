import { memo, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Route, StarSystem } from '@/core/types'
import { useUIStore } from '@/store/uiStore'
import { runtime, timeUniforms } from '../runtime'

const SAMPLES = 128

const BEZIER_GLSL = `
uniform vec3 uP0;
uniform vec3 uP1;
uniform vec3 uP2;
uniform vec2 uResolution;
vec3 bez(float t) {
  float u = 1.0 - t;
  return u * u * uP0 + 2.0 * u * t * uP1 + t * t * uP2;
}
vec2 screenDir(float t, out vec4 clip) {
  mat4 vp = projectionMatrix * viewMatrix;
  clip = vp * vec4(bez(t), 1.0);
  vec4 a = vp * vec4(bez(max(t - 0.004, 0.0)), 1.0);
  vec4 b = vp * vec4(bez(min(t + 0.004, 1.0)), 1.0);
  vec2 d = (b.xy / max(b.w, 1e-5) - a.xy / max(a.w, 1e-5)) * uResolution;
  float l = length(d);
  return l > 1e-6 ? d / l : vec2(1.0, 0.0);
}
`

const ribbonVert = `
${BEZIER_GLSL}
attribute float aT;
attribute float aSide;
uniform float uWidth;
varying float vT;
varying float vSide;
void main() {
  vec4 clip;
  vec2 dir = screenDir(aT, clip);
  vec2 n = vec2(-dir.y, dir.x);
  clip.xy += n * aSide * 2.0 * uWidth / uResolution * clip.w;
  vT = aT;
  vSide = aSide;
  if (clip.w <= 0.0) clip = vec4(0.0, 0.0, -2.0, 1.0);
  gl_Position = clip;
}
`

const ribbonFrag = `
uniform vec3 uColor;
uniform float uStyle;
uniform float uAnimated;
uniform float uTime;
uniform float uDashes;
uniform float uOpacity;
uniform float uWidth;
varying float vT;
varying float vSide;
void main() {
  float px = abs(vSide) * uWidth;
  float edge = 1.0 - smoothstep(uWidth - 1.4, uWidth, px);
  float ends = smoothstep(0.0, 0.035, vT) * smoothstep(1.0, 0.965, vT);
  float flow = uAnimated * uTime * 0.9;
  float pattern = 1.0;
  float f = fract(vT * uDashes - flow);
  if (uStyle > 1.5) pattern = smoothstep(0.32, 0.18, abs(f - 0.5));
  else if (uStyle > 0.5) pattern = step(0.42, f);
  float pulse = 0.0;
  if (uAnimated > 0.5) {
    float pd = (fract(vT * 2.0 - uTime * 0.12) - 0.5) * 9.0;
    pulse = exp(-pd * pd) * 0.9;
  }
  float core = exp(-px * px / max(1.0, uWidth * uWidth * 0.18));
  float a = uOpacity * edge * ends * pattern * (0.65 + 0.35 * core + pulse * 0.6);
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor * (1.0 + pulse * 0.8 + core * 0.25), a);
}
`

const trafficVert = `
${BEZIER_GLSL}
attribute float aT0;
attribute float aDir;
uniform float uTime;
uniform float uSpeed;
uniform float uPixelRatio;
uniform float uSize;
varying float vAngle;
varying float vFade;
void main() {
  float t = fract(aT0 + uTime * uSpeed);
  if (aDir < 0.0) t = 1.0 - t;
  vec4 clip;
  vec2 dir = screenDir(t, clip);
  vAngle = atan(dir.y, dir.x) * (aDir < 0.0 ? 1.0 : 1.0) + (aDir < 0.0 ? 3.14159265 : 0.0);
  vFade = smoothstep(0.0, 0.06, t) * smoothstep(1.0, 0.94, t);
  gl_PointSize = uSize * uPixelRatio;
  if (clip.w <= 0.0) clip = vec4(0.0, 0.0, -2.0, 1.0);
  gl_Position = clip;
}
`

const trafficFrag = `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAngle;
varying float vFade;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  p.y = -p.y;
  float c = cos(-vAngle), s = sin(-vAngle);
  p = mat2(c, -s, s, c) * p;
  float d = abs(abs(p.y) * 0.9 - (0.55 - p.x * 0.9) * 0.6) ;
  float shape = smoothstep(0.16, 0.05, d) * step(-0.55, p.x) * step(p.x, 0.62) * step(abs(p.y), 0.62);
  float glow = exp(-dot(p, p) * 3.0) * 0.35;
  float a = (shape + glow) * vFade * uOpacity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor * (1.0 + shape * 0.8), a);
}
`

const bufferSize = new THREE.Vector2()
const ndcA = new THREE.Vector3()
const ndcB = new THREE.Vector3()
const mid = new THREE.Vector3()

const ribbonGeometry = (() => {
  const g = new THREE.BufferGeometry()
  const t = new Float32Array(SAMPLES * 2)
  const side = new Float32Array(SAMPLES * 2)
  for (let i = 0; i < SAMPLES; i++) {
    const v = i / (SAMPLES - 1)
    t[i * 2] = v
    t[i * 2 + 1] = v
    side[i * 2] = -1
    side[i * 2 + 1] = 1
  }
  const index: number[] = []
  for (let i = 0; i < SAMPLES - 1; i++) {
    const a = i * 2
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  g.setIndex(index)
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SAMPLES * 2 * 3), 3))
  g.setAttribute('aT', new THREE.BufferAttribute(t, 1))
  g.setAttribute('aSide', new THREE.BufferAttribute(side, 1))
  return g
})()

function trafficGeometry(count: number, seed: number) {
  const g = new THREE.BufferGeometry()
  const n = Math.max(1, count)
  const t0 = new Float32Array(n)
  const dir = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    t0[i] = (i / n + ((seed * 0.618) % 1) * 0.37) % 1
    dir[i] = i % 2 === 0 ? 1 : -1
  }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
  g.setAttribute('aT0', new THREE.BufferAttribute(t0, 1))
  g.setAttribute('aDir', new THREE.BufferAttribute(dir, 1))
  g.setDrawRange(0, count)
  return g
}

export const Routes = memo(function Routes({ system }: { system: StarSystem }) {
  const playerMode = useUIStore((s) => s.playerMode)
  const selectedRouteId = useUIStore((s) => s.selectedRouteId)
  const routes = useMemo(
    () =>
      Object.values(system.routes).filter((r) => {
        if (!r.visible || (playerMode && !r.playerVisible)) return false
        const a = system.bodies[r.from]
        const b = system.bodies[r.to]
        if (!a || !b) return false
        if (playerMode && (!a.playerVisible || !b.playerVisible)) return false
        return true
      }),
    [system.routes, system.bodies, playerMode],
  )
  return (
    <>
      {routes.map((r, i) => (
        <RouteArc key={r.id} route={r} selected={r.id === selectedRouteId} seed={i + 1} />
      ))}
    </>
  )
})

const RouteArc = memo(function RouteArc({ route, selected, seed }: { route: Route; selected: boolean; seed: number }) {
  const objects = useMemo(() => {
    const shared = {
      uP0: { value: new THREE.Vector3() },
      uP1: { value: new THREE.Vector3() },
      uP2: { value: new THREE.Vector3() },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTime: timeUniforms.uTime,
    }
    const color = new THREE.Color(route.color)
    const ribbonMat = new THREE.ShaderMaterial({
      uniforms: {
        ...shared,
        uColor: { value: color },
        uStyle: { value: route.style === 'solid' ? 0 : route.style === 'dashed' ? 1 : 2 },
        uAnimated: { value: route.animated ? 1 : 0 },
        uDashes: { value: 40 },
        uOpacity: { value: 0.75 },
        uWidth: { value: 2 },
      },
      vertexShader: ribbonVert,
      fragmentShader: ribbonFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    const ribbon = new THREE.Mesh(ribbonGeometry, ribbonMat)
    ribbon.frustumCulled = false
    ribbon.renderOrder = 9

    const tGeo = trafficGeometry(Math.round(Math.max(0, Math.min(6, route.traffic))), seed)
    const trafficMat = new THREE.ShaderMaterial({
      uniforms: {
        ...shared,
        uColor: { value: color.clone().lerp(new THREE.Color('#ffffff'), 0.35) },
        uSpeed: { value: 0.03 },
        uPixelRatio: { value: 1 },
        uSize: { value: 13 },
        uOpacity: { value: 1 },
      },
      vertexShader: trafficVert,
      fragmentShader: trafficFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const traffic = new THREE.Points(tGeo, trafficMat)
    traffic.frustumCulled = false
    traffic.renderOrder = 10
    return { ribbon, ribbonMat, traffic, trafficMat, tGeo, shared }
  }, [route.color, route.style, route.animated, route.traffic, seed])

  useEffect(
    () => () => {
      objects.ribbonMat.dispose()
      objects.trafficMat.dispose()
      objects.tGeo.dispose()
    },
    [objects],
  )

  useFrame((state) => {
    const a = runtime.bodies.get(route.from)
    const b = runtime.bodies.get(route.to)
    const { ribbon, traffic, shared, ribbonMat, trafficMat } = objects
    const vis = !!a && !!b && a.visible && b.visible
    ribbon.visible = vis
    traffic.visible = vis && route.traffic > 0
    if (!a || !b || !vis) return
    shared.uP0.value.copy(a.pos)
    shared.uP2.value.copy(b.pos)
    const dist = a.pos.distanceTo(b.pos)
    mid.addVectors(a.pos, b.pos).multiplyScalar(0.5)
    mid.y += route.arc * dist * 0.5
    shared.uP1.value.copy(mid)

    const gl = state.gl
    gl.getDrawingBufferSize(bufferSize)
    shared.uResolution.value.copy(bufferSize)
    const pr = gl.getPixelRatio()

    const cam = state.camera
    ndcA.copy(a.pos).project(cam)
    ndcB.copy(b.pos).project(cam)
    const screenLen = Math.hypot((ndcA.x - ndcB.x) * bufferSize.x, (ndcA.y - ndcB.y) * bufferSize.y) * 0.5 * (1 + route.arc * 0.6)
    ribbonMat.uniforms.uDashes.value = THREE.MathUtils.clamp(screenLen / (route.style === 'dotted' ? 9 * pr : 16 * pr), 6, 400)
    ribbonMat.uniforms.uWidth.value = (selected ? 2.4 : 1.5) * pr
    ribbonMat.uniforms.uOpacity.value = selected ? 1 : 0.72
    trafficMat.uniforms.uPixelRatio.value = pr
    trafficMat.uniforms.uSize.value = selected ? 15 : 12
    trafficMat.uniforms.uSpeed.value = 0.04
  })

  return (
    <>
      <primitive object={objects.ribbon} />
      <primitive object={objects.traffic} />
    </>
  )
})
