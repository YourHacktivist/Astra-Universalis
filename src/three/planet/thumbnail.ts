import * as THREE from 'three'
import type { PlanetLike } from '@/core/types'
import { glApi } from '../SystemCanvas'
import { ensurePreview, getBakedSet, surfaceParams, withRendererState } from './baker'
import { RING_GLSL } from './glsl'
import { unitSphere } from './materials'

const cache = new Map<string, string>()
const LIGHT = new THREE.Vector3(-0.75, 0.45, 0.55).normalize()

const surfaceFrag = `
uniform sampler2D uAlbedo;
uniform sampler2D uNormal;
uniform vec3 uLight;
uniform vec3 uAtmo;
uniform float uAtmoDensity;
uniform vec3 uEmissiveColor;
uniform float uEmissive;
uniform float uRingShadow;
uniform float uRingInner;
uniform float uRingOuter;
uniform float uRingOpacity;
${RING_GLSL}
varying vec2 vUv;
varying vec3 vN;
varying vec3 vObjN;
varying vec3 vView;
void main() {
  vec4 a = texture2D(uAlbedo, vUv);
  vec3 n = normalize(texture2D(uNormal, vUv).xyz * 2.0 - 1.0);
  vec3 ng = normalize(vObjN);
  float ndl = max(dot(n, uLight), 0.0) * smoothstep(-0.05, 0.2, dot(ng, uLight));
  float sh = 1.0;
  if (uRingShadow > 0.5 && abs(uLight.y) > 1e-3) {
    float t = -ng.y / uLight.y;
    if (t > 0.0) {
      float r = length((ng + uLight * t).xz);
      sh = 1.0 - ringDensity((r - uRingInner) / (uRingOuter - uRingInner)) * uRingOpacity * 0.9;
    }
  }
  vec3 h = normalize(uLight + vView);
  float spec = pow(max(dot(ng, h), 0.0), 120.0) * a.a * 1.5;
  float rim = pow(clamp(1.0 - dot(ng, vView), 0.0, 1.0), 3.0);
  vec3 col = a.rgb * (ndl * sh + 0.02) + spec * sh;
  col += uAtmo * rim * uAtmoDensity * smoothstep(-0.3, 0.5, dot(ng, uLight)) * 1.2;
  col += uEmissiveColor * texture2D(uNormal, vUv).a * uEmissive * (1.0 - smoothstep(-0.1, 0.2, dot(ng, uLight)));
  col = 1.0 - exp(-col * 1.25);
  gl_FragColor = vec4(pow(max(col, vec3(0.0)), vec3(1.0 / 2.2)), 1.0);
}
`

const surfaceVert = `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vObjN;
varying vec3 vView;
void main() {
  vUv = uv;
  vObjN = normal;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const ringFrag = `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uInner;
uniform float uOuter;
uniform float uOpacity;
uniform vec3 uLight;
${RING_GLSL}
varying vec2 vLocal;
varying vec3 vPos;
void main() {
  float r = length(vLocal);
  float x = (r - uInner) / (uOuter - uInner);
  float d = ringDensity(x);
  if (d < 0.01) discard;
  float t = dot(-vPos, uLight);
  float sh = 1.0;
  if (t > 0.0) sh = smoothstep(0.97, 1.03, length(-vPos - uLight * t));
  vec3 col = mix(uColorA, uColorB, ringTint(x)) * (0.25 + 0.75 * abs(uLight.y)) * sh;
  col = 1.0 - exp(-col * 1.25);
  gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)), clamp(d * 1.3, 0.0, 1.0) * uOpacity);
}
`

const ringVert = `
varying vec2 vLocal;
varying vec3 vPos;
void main() {
  vLocal = position.xy;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

export async function renderPlanetThumbnail(body: PlanetLike, size = 96): Promise<string> {
  const gl = glApi.gl
  if (!gl) throw new Error('Rendu indisponible')
  const p = body.props
  const sp = surfaceParams(p, body.seed)
  const key = JSON.stringify([sp, p.rings, p.atmosphere.color, p.atmosphere.density, p.atmosphere.enabled, p.emissive, p.emissiveColor, body.rotation.tilt, size])
  const hit = cache.get(key)
  if (hit) return hit

  const set = getBakedSet('surface', sp, 512)
  ensurePreview(gl, set)
  const tex = set.textures!

  const scene = new THREE.Scene()
  const tilt = new THREE.Group()
  tilt.rotation.z = THREE.MathUtils.degToRad(Math.min(35, body.rotation.tilt))
  tilt.rotation.x = 0.35
  scene.add(tilt)
  const light = LIGHT.clone()
  tilt.updateMatrixWorld()
  const toLocal = new THREE.Matrix4().copy(tilt.matrixWorld).invert()
  const lightLocal = light.clone().transformDirection(toLocal)

  const ringUniforms = { uRingSeed: { value: (body.seed % 9973) / 97.3 }, uRingBands: { value: p.rings.bands } }
  const surf = new THREE.ShaderMaterial({
    uniforms: {
      ...ringUniforms,
      uAlbedo: { value: tex.albedo!.texture },
      uNormal: { value: tex.normal!.texture },
      uLight: { value: lightLocal },
      uAtmo: { value: new THREE.Color(p.atmosphere.color) },
      uAtmoDensity: { value: p.atmosphere.enabled ? p.atmosphere.density : 0 },
      uEmissiveColor: { value: new THREE.Color(p.emissiveColor) },
      uEmissive: { value: p.emissive },
      uRingShadow: { value: p.rings.enabled ? 1 : 0 },
      uRingInner: { value: p.rings.inner },
      uRingOuter: { value: p.rings.outer },
      uRingOpacity: { value: p.rings.opacity },
    },
    vertexShader: surfaceVert,
    fragmentShader: surfaceFrag,
  })
  const sphere = new THREE.Mesh(unitSphere(true), surf)
  tilt.add(sphere)
  let ringGeo: THREE.RingGeometry | null = null
  let ringMat: THREE.ShaderMaterial | null = null
  if (p.rings.enabled) {
    ringGeo = new THREE.RingGeometry(p.rings.inner, p.rings.outer, 128, 1)
    ringMat = new THREE.ShaderMaterial({
      uniforms: {
        ...ringUniforms,
        uColorA: { value: new THREE.Color(p.rings.colorA) },
        uColorB: { value: new THREE.Color(p.rings.colorB) },
        uInner: { value: p.rings.inner },
        uOuter: { value: p.rings.outer },
        uOpacity: { value: p.rings.opacity },
        uLight: { value: lightLocal },
      },
      vertexShader: ringVert,
      fragmentShader: ringFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = -Math.PI / 2
    tilt.add(ring)
  }

  const extent = p.rings.enabled ? p.rings.outer * 1.02 : 1.08
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100)
  camera.position.set(0, 0, extent / Math.tan(THREE.MathUtils.degToRad(14)))
  camera.lookAt(0, 0, 0)

  const px = size * 2
  const rt = new THREE.WebGLRenderTarget(px, px, { samples: 4, depthBuffer: true })
  const buf = new Uint8Array(px * px * 4)
  try {
    withRendererState(gl, () => {
      gl.autoClear = true
      gl.setClearColor(0x000000, 0)
      gl.setRenderTarget(rt)
      gl.render(scene, camera)
      gl.readRenderTargetPixels(rt, 0, 0, px, px, buf)
    })
  } finally {
    rt.dispose()
    surf.dispose()
    ringGeo?.dispose()
    ringMat?.dispose()
  }

  const full = document.createElement('canvas')
  full.width = px
  full.height = px
  const ctx = full.getContext('2d')!
  const img = ctx.createImageData(px, px)
  for (let y = 0; y < px; y++) img.data.set(buf.subarray((px - 1 - y) * px * 4, (px - y) * px * 4), y * px * 4)
  ctx.putImageData(img, 0, 0)
  const out = document.createElement('canvas')
  out.width = size
  out.height = size
  const octx = out.getContext('2d')!
  octx.imageSmoothingQuality = 'high'
  octx.drawImage(full, 0, 0, size, size)
  const url = out.toDataURL('image/png')
  cache.set(key, url)
  return url
}
