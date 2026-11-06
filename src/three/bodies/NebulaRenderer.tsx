import { memo, useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { DEG } from '@/core/orbits'
import type { NebulaProps, NebulaType } from '@/core/types'
import { timeUniforms } from '../runtime'
import { BodyAnchor } from '../scene/anchors'
import { fbm3, gaussian, mulberry } from '../small/noise'
import { ATLAS_CELLS, getSmokeAtlas } from '../small/smokeAtlas'
import { QUALITY_SCALE, type BodyRendererProps } from './types'

const spriteVert = `
attribute vec3 aOffset;
attribute vec4 aParams;
attribute vec4 aColor;
attribute vec4 aMotion;
uniform float uTime;
uniform float uDrift;
varying vec2 vUv;
varying vec4 vColor;
varying float vChannel;
varying float vFade;
void main() {
  float t = uTime * (0.04 + 0.25 * uDrift);
  vec3 off = aOffset + aMotion.xyz * sin(t + aMotion.w * 6.2831) * aParams.x * 0.18;
  vec4 mv = modelViewMatrix * vec4(off, 1.0);
  float rot = aParams.y + t * 0.35 * (fract(aMotion.w * 7.0) - 0.5);
  float c = cos(rot), s = sin(rot);
  vec2 corner = mat2(c, -s, s, c) * position.xy;
  float breathe = 1.0 + 0.06 * sin(t * 1.7 + aMotion.w * 20.0);
  mv.xy += corner * aParams.x * breathe;
  float depth = -mv.z;
  vFade = smoothstep(aParams.x * 0.05, aParams.x * 0.85, depth);
  float cell = aParams.z;
  vec2 cid = vec2(mod(cell, ${ATLAS_CELLS}.0), floor(cell / ${ATLAS_CELLS}.0));
  vUv = (cid + uv) / ${ATLAS_CELLS}.0;
  vColor = aColor;
  vChannel = aParams.w;
  gl_Position = projectionMatrix * mv;
}
`

const spriteFrag = `
uniform sampler2D uAtlas;
uniform float uDensity;
uniform float uGlow;
uniform float uDark;
uniform float uOpacity;
varying vec2 vUv;
varying vec4 vColor;
varying float vChannel;
varying float vFade;
void main() {
  vec4 t = texture2D(uAtlas, vUv);
  float d = vChannel < 0.5 ? t.r : (vChannel < 1.5 ? t.g : t.b);
  float a = d * vColor.a * uDensity * vFade * uOpacity;
  if (a < 0.0015) discard;
  if (uDark > 0.5) {
    gl_FragColor = vec4(vColor.rgb, min(a, 0.92));
  } else {
    gl_FragColor = vec4(vColor.rgb * uGlow, a);
  }
}
`

const starVert = `
attribute vec3 aColor;
attribute float aSize;
attribute float aSeed;
uniform float uTime;
uniform float uFocal;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float depth = max(-mv.z, 1e-4);
  float px = aSize / depth * uFocal;
  gl_PointSize = clamp(px * 6.0 + 3.0, 3.0, 40.0) * uPixelRatio;
  vAlpha = 0.75 + 0.25 * sin(uTime * (1.3 + aSeed * 2.0) + aSeed * 50.0);
  vColor = aColor;
  gl_Position = projectionMatrix * mv;
}
`

const starFrag = `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r = length(c);
  float core = exp(-r * r * 40.0) * 2.5;
  float halo = exp(-r * r * 6.0) * 0.45;
  float spikes = (exp(-abs(c.x) * 28.0) + exp(-abs(c.y) * 28.0)) * exp(-r * 3.0) * 0.35;
  float a = (core + halo + spikes) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor * a, a);
}
`

interface Sprite {
  x: number
  y: number
  z: number
  scale: number
  cell: number
  channel: 0 | 1 | 2
  r: number
  g: number
  b: number
  a: number
}

interface Layout {
  glow: Sprite[]
  dark: Sprite[]
  stars: { x: number; y: number; z: number; r: number; g: number; b: number; size: number }[]
  darkColor: THREE.Color
}

const lin = (hex: string) => new THREE.Color(hex)

function randomInSphere(rand: () => number) {
  for (;;) {
    const x = rand() * 2 - 1
    const y = rand() * 2 - 1
    const z = rand() * 2 - 1
    if (x * x + y * y + z * z <= 1) return [x, y, z] as const
  }
}

function randomDirection(rand: () => number) {
  const z = rand() * 2 - 1
  const t = rand() * Math.PI * 2
  const s = Math.sqrt(1 - z * z)
  return [Math.cos(t) * s, z, Math.sin(t) * s] as const
}

function buildLayout(p: NebulaProps, type: NebulaType, seed: number, qs: number): Layout {
  const rand = mulberry(seed * 2654435761 + 7)
  const [sx, sy, sz] = p.shape
  const R = Math.max(0.5, p.size)
  const c0 = lin(p.colors[0])
  const c1 = lin(p.colors[1])
  const c2 = lin(p.colors[2])
  const tmp = new THREE.Color()
  const glow: Sprite[] = []
  const dark: Sprite[] = []
  const stars: Layout['stars'] = []
  const turb = THREE.MathUtils.clamp(p.turbulence, 0, 1)
  const n = Math.max(8, Math.round(Math.min(600, p.puffs) * qs))
  const cell = () => Math.floor(rand() * ATLAS_CELLS * ATLAS_CELLS)

  const push = (
    arr: Sprite[],
    x: number,
    y: number,
    z: number,
    scale: number,
    channel: 0 | 1 | 2,
    col: THREE.Color,
    a: number,
  ) => arr.push({ x: x * R * sx, y: y * R * sy, z: z * R * sz, scale: scale * R, cell: cell(), channel, r: col.r, g: col.g, b: col.b, a })

  const colorAt = (x: number, y: number, z: number, out: THREE.Color) => {
    const f = fbm3(x * 1.3 + seed * 0.01, y * 1.3, z * 1.3, 3, seed) * 0.5 + 0.5
    out.copy(c0).lerp(c1, THREE.MathUtils.smoothstep(f, 0.25, 0.75))
    return out
  }

  const clumpCount = 2 + Math.round(turb * 6 + rand() * 2)
  const clumps = Array.from({ length: clumpCount }, () => {
    const [x, y, z] = randomInSphere(rand)
    return { x: x * 0.55, y: y * 0.55, z: z * 0.55, s: 0.18 + rand() * 0.25 + turb * 0.1 }
  })

  const cloudPuffs = (count: number, alpha: number, scaleMin: number, scaleMax: number, channel: 0 | 1, target: Sprite[] = glow, colorFn = colorAt) => {
    for (let i = 0; i < count; i++) {
      const c = clumps[Math.floor(rand() * clumps.length)]
      let x = c.x + gaussian(rand) * c.s
      let y = c.y + gaussian(rand) * c.s
      let z = c.z + gaussian(rand) * c.s
      const l = Math.hypot(x, y, z)
      if (l > 1.05) {
        x /= l
        y /= l
        z /= l
      }
      const centrality = 1 - Math.min(1, Math.hypot(x, y, z))
      const s = (scaleMin + (scaleMax - scaleMin) * rand()) * (0.75 + centrality * 0.5)
      push(target, x, y, z, s, channel, colorFn(x, y, z, tmp), alpha * (0.6 + rand() * 0.8))
    }
  }

  const lanes = (count: number, alpha: number, scale: number) => {
    const laneN = 2 + Math.floor(rand() * 3)
    for (let k = 0; k < laneN; k++) {
      const [ax, ay, az] = randomDirection(rand)
      const [bx, by, bz] = randomDirection(rand)
      const bend = (rand() - 0.5) * 0.8
      const per = Math.ceil(count / laneN)
      for (let i = 0; i < per; i++) {
        const t = rand() * 2 - 1
        const x = ax * t * 0.75 + bx * bend * (1 - t * t) + gaussian(rand) * 0.09
        const y = ay * t * 0.35 + by * bend * (1 - t * t) + gaussian(rand) * 0.06
        const z = az * t * 0.75 + bz * bend * (1 - t * t) + gaussian(rand) * 0.09
        push(dark, x, y, z, scale * (0.6 + rand() * 0.7), rand() < 0.5 ? 1 : 0, tmp.setRGB(0, 0, 0), alpha * (0.5 + rand() * 0.6))
      }
    }
  }

  const shell = (count: number, radius: number, thickness: number, alpha: number, scaleMin: number, scaleMax: number, channel: 0 | 1 | 2, col: (x: number, y: number, z: number) => THREE.Color, lobes = 0) => {
    for (let i = 0; i < count; i++) {
      const [dx, dy, dz] = randomDirection(rand)
      const lobe = 1 + lobes * Math.pow(Math.abs(dy), 3)
      const rr = radius * lobe + gaussian(rand) * thickness
      const x = dx * rr
      const y = dy * rr
      const z = dz * rr
      push(glow, x, y, z, scaleMin + (scaleMax - scaleMin) * rand(), channel, col(x, y, z), alpha * (0.6 + rand() * 0.7))
    }
  }

  const addStars = (count: number, spread: number, palette: THREE.Color[]) => {
    for (let i = 0; i < count; i++) {
      const c = clumps[Math.floor(rand() * clumps.length)]
      const x = (c.x + gaussian(rand) * c.s * spread) * R * sx
      const y = (c.y + gaussian(rand) * c.s * spread) * R * sy
      const z = (c.z + gaussian(rand) * c.s * spread) * R * sz
      const col = palette[Math.floor(rand() * palette.length)]
      stars.push({ x, y, z, r: col.r, g: col.g, b: col.b, size: R * (0.004 + rand() * 0.01) })
    }
  }

  const youngStars = [lin('#cfe0ff'), lin('#a8c8ff'), lin('#ffffff'), lin('#fff1d8')]
  const darkColor = new THREE.Color(0.006, 0.006, 0.01).lerp(c0, 0.012)

  switch (type) {
    case 'emission': {
      cloudPuffs(n, 0.16, 0.28, 0.6, 0)
      cloudPuffs(Math.round(n * 0.3), 0.14, 0.4, 0.8, 1)
      for (let i = 0; i < Math.round(n * 0.12); i++) {
        const c = clumps[Math.floor(rand() * clumps.length)]
        push(glow, c.x + gaussian(rand) * 0.1, c.y + gaussian(rand) * 0.1, c.z + gaussian(rand) * 0.1, 0.1 + rand() * 0.15, 2, c2, 0.5)
      }
      for (const c of clumps) push(glow, c.x, c.y, c.z, 0.9 + rand() * 0.4, 2, colorAt(c.x, c.y, c.z, tmp), 0.08)
      lanes(Math.round(n * 0.7 * p.darkLanes), 0.5, 0.22)
      addStars(p.stars, 1.2, youngStars)
      break
    }
    case 'reflection': {
      const blue = (x: number, y: number, z: number, out: THREE.Color) => colorAt(x, y, z, out).lerp(lin('#7fa8ff'), 0.35)
      cloudPuffs(n, 0.13, 0.3, 0.65, 0, glow, blue)
      cloudPuffs(Math.round(n * 0.4), 0.12, 0.35, 0.7, 1, glow, blue)
      for (const c of clumps) push(glow, c.x, c.y, c.z, 0.7, 2, c2, 0.12)
      lanes(Math.round(n * 0.9 * Math.max(0.3, p.darkLanes)), 0.45, 0.24)
      for (let i = 0; i < Math.max(1, Math.round(p.stars * 0.3)); i++) {
        const c = clumps[i % clumps.length]
        stars.push({ x: c.x * R * sx, y: c.y * R * sy, z: c.z * R * sz, r: 0.85, g: 0.92, b: 1, size: R * 0.03 })
      }
      addStars(Math.round(p.stars * 0.7), 1.4, youngStars)
      break
    }
    case 'dark': {
      cloudPuffs(n, 0.55, 0.3, 0.65, 0, dark, (_x, _y, _z, out) => out.setRGB(0, 0, 0))
      lanes(Math.round(n * 0.5), 0.6, 0.3)
      shell(Math.round(n * 0.35), 0.62, 0.12, 0.05, 0.25, 0.5, 0, (x, y, z) => colorAt(x, y, z, tmp))
      addStars(Math.round(p.stars * 0.3), 2.2, [lin('#ffd9b0'), lin('#ffb27a')])
      break
    }
    case 'planetary': {
      const outer = (x: number, y: number, z: number) => tmp.copy(c0).lerp(c2, Math.max(0, fbm3(x * 3, y * 3, z * 3, 2, seed)) * 0.6)
      shell(Math.round(n * 0.9), 0.62, 0.05, 0.2, 0.12, 0.26, 0, outer, 0.55)
      shell(Math.round(n * 0.6), 0.42, 0.05, 0.22, 0.12, 0.22, 0, () => tmp.copy(c1), 0.3)
      shell(Math.round(n * 0.35), 0.75, 0.08, 0.1, 0.18, 0.35, 1, outer, 0.9)
      push(glow, 0, 0, 0, 0.55, 2, tmp.copy(c1).lerp(lin('#ffffff'), 0.3), 0.35)
      stars.push({ x: 0, y: 0, z: 0, r: 0.8, g: 0.9, b: 1, size: R * 0.035 })
      break
    }
    case 'remnant': {
      const col = (x: number, y: number, z: number) => {
        const f = fbm3(x * 2.5, y * 2.5, z * 2.5, 3, seed + 3) * 0.5 + 0.5
        return tmp.copy(c0).lerp(c1, f).lerp(c2, Math.max(0, f - 0.7) * 2.5)
      }
      shell(Math.round(n * 1.3), 0.72, 0.09, 0.2, 0.2, 0.42, 1, col)
      shell(Math.round(n * 0.4), 0.7, 0.12, 0.08, 0.3, 0.55, 0, col)
      push(glow, 0, 0, 0, 1.1, 2, c1, 0.05)
      stars.push({ x: 0, y: 0, z: 0, r: 0.7, g: 0.85, b: 1, size: R * 0.02 })
      addStars(Math.round(p.stars * 0.2), 2.5, youngStars)
      break
    }
    case 'cloud':
    default: {
      cloudPuffs(n, 0.12, 0.35, 0.75, 0)
      cloudPuffs(Math.round(n * 0.2), 0.08, 0.45, 0.8, 1)
      lanes(Math.round(n * 0.5 * p.darkLanes), 0.35, 0.3)
      addStars(Math.round(p.stars * 0.5), 1.5, youngStars)
      break
    }
  }
  return { glow, dark, stars, darkColor }
}

function spriteGeometry(sprites: Sprite[], darkColor?: THREE.Color): THREE.InstancedBufferGeometry {
  const quad = new THREE.PlaneGeometry(1, 1)
  const g = new THREE.InstancedBufferGeometry()
  g.index = quad.index
  g.setAttribute('position', quad.getAttribute('position'))
  g.setAttribute('uv', quad.getAttribute('uv'))
  const n = sprites.length
  const off = new Float32Array(n * 3)
  const par = new Float32Array(n * 4)
  const col = new Float32Array(n * 4)
  const mot = new Float32Array(n * 4)
  const rand = mulberry(n * 977 + 3)
  sprites.forEach((s, i) => {
    off.set([s.x, s.y, s.z], i * 3)
    par.set([s.scale, rand() * Math.PI * 2, s.cell, s.channel], i * 4)
    if (darkColor) col.set([darkColor.r, darkColor.g, darkColor.b, s.a], i * 4)
    else col.set([s.r, s.g, s.b, s.a], i * 4)
    const [x, y, z] = randomDirection(rand)
    mot.set([x, y, z, rand()], i * 4)
  })
  g.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 3))
  g.setAttribute('aParams', new THREE.InstancedBufferAttribute(par, 4))
  g.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 4))
  g.setAttribute('aMotion', new THREE.InstancedBufferAttribute(mot, 4))
  g.instanceCount = n
  return g
}

const tmpSize = new THREE.Vector2()

export const NebulaRenderer = memo(function NebulaRenderer({ body, quality }: BodyRendererProps<'nebula'>) {
  const p = body.props
  const gl = useThree((s) => s.gl)
  const qs = QUALITY_SCALE[quality]
  const atlas = useMemo(() => getSmokeAtlas(gl), [gl])

  const layout = useMemo(() => buildLayout(p, p.nebulaType, body.seed, qs), [p, body.seed, qs])

  const objects = useMemo(() => {
    const glowGeo = spriteGeometry(layout.glow)
    const darkGeo = spriteGeometry(layout.dark, layout.darkColor)
    const common = {
      uAtlas: { value: atlas },
      uTime: timeUniforms.uTime,
      uDrift: { value: p.drift },
      uDensity: { value: 0.25 + p.density * 1.2 },
    }
    const glowMat = new THREE.ShaderMaterial({
      uniforms: { ...common, uGlow: { value: 0.35 + p.glow * 0.9 }, uDark: { value: 0 }, uOpacity: { value: 1 } },
      vertexShader: spriteVert,
      fragmentShader: spriteFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const darkMat = new THREE.ShaderMaterial({
      uniforms: { ...common, uGlow: { value: 1 }, uDark: { value: 1 }, uOpacity: { value: p.nebulaType === 'dark' ? 1 : 0.85 } },
      vertexShader: spriteVert,
      fragmentShader: spriteFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    })
    const glowMesh = new THREE.Mesh(glowGeo, glowMat)
    const darkMesh = new THREE.Mesh(darkGeo, darkMat)
    glowMesh.frustumCulled = false
    darkMesh.frustumCulled = false
    glowMesh.renderOrder = 2
    darkMesh.renderOrder = 3

    const n = layout.stars.length
    const sg = new THREE.BufferGeometry()
    const pos = new Float32Array(Math.max(1, n) * 3)
    const col = new Float32Array(Math.max(1, n) * 3)
    const size = new Float32Array(Math.max(1, n))
    const seed = new Float32Array(Math.max(1, n))
    layout.stars.forEach((s, i) => {
      pos.set([s.x, s.y, s.z], i * 3)
      col.set([s.r, s.g, s.b], i * 3)
      size[i] = s.size
      seed[i] = (i * 0.618) % 1
    })
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    sg.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    sg.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    sg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    sg.setDrawRange(0, n)
    const starMat = new THREE.ShaderMaterial({
      uniforms: { uTime: timeUniforms.uTime, uFocal: { value: 800 }, uPixelRatio: { value: 1 } },
      vertexShader: starVert,
      fragmentShader: starFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const starPoints = new THREE.Points(sg, starMat)
    starPoints.frustumCulled = false
    starPoints.renderOrder = 4
    starPoints.onBeforeRender = (renderer, _s, camera) => {
      const cam = camera as THREE.PerspectiveCamera
      starMat.uniforms.uFocal.value = renderer.getSize(tmpSize).y / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov ?? 45) / 2))
      starMat.uniforms.uPixelRatio.value = renderer.getPixelRatio()
    }
    return { glowMesh, darkMesh, starPoints }
  }, [layout, atlas, p.drift, p.density, p.glow, p.nebulaType])

  useEffect(
    () => () => {
      for (const o of [objects.glowMesh, objects.darkMesh, objects.starPoints]) {
        o.geometry.dispose()
        ;(o.material as THREE.Material).dispose()
      }
    },
    [objects],
  )

  const rotation = useMemo(
    () => new THREE.Euler(p.rotation[0] * DEG, p.rotation[1] * DEG, p.rotation[2] * DEG),
    [p.rotation],
  )

  return (
    <BodyAnchor id={body.id}>
      <group rotation={rotation}>
        <primitive object={objects.glowMesh} />
        {layout.dark.length > 0 && <primitive object={objects.darkMesh} />}
        {layout.stars.length > 0 && <primitive object={objects.starPoints} />}
      </group>
    </BodyAnchor>
  )
})
