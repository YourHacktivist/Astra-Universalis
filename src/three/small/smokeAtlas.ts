import * as THREE from 'three'
import { NOISE_GLSL } from '../shaders/common'

export const ATLAS_CELLS = 4

const cache = new WeakMap<THREE.WebGLRenderer, THREE.Texture>()

const frag = `
${NOISE_GLSL}
varying vec2 vUv;
void main() {
  vec2 cellUv = fract(vUv * ${ATLAS_CELLS}.0);
  vec2 cellId = floor(vUv * ${ATLAS_CELLS}.0);
  float seed = cellId.x * 7.31 + cellId.y * 19.17;
  vec2 p = cellUv * 2.0 - 1.0;
  float r = length(p);

  vec3 q = vec3(p * 1.6, seed);
  vec3 w = vec3(fbm(q + vec3(0.0, 0.0, 3.1), 4), fbm(q + vec3(5.2, 1.3, 0.7), 4), 0.0);
  float n = fbm(q + w * 1.3, 6) * 0.5 + 0.5;
  float edge = r + (n - 0.5) * 0.55;
  float mask = smoothstep(1.0, 0.25, edge);
  float puff = pow(clamp(n * 1.25, 0.0, 1.0), 1.6) * mask;

  float ang = seed * 2.399;
  mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  vec2 fp = rot * p;
  float rid = ridged(vec3(fp.x * 1.2, fp.y * 4.5, seed + 9.0) + w * 0.6, 5);
  float fil = pow(rid, 3.0) * smoothstep(1.0, 0.35, r + (n - 0.5) * 0.3);

  float core = exp(-r * r * 5.0) * (0.6 + 0.4 * n);

  float border = smoothstep(0.0, 0.04, cellUv.x) * smoothstep(1.0, 0.96, cellUv.x)
               * smoothstep(0.0, 0.04, cellUv.y) * smoothstep(1.0, 0.96, cellUv.y);
  gl_FragColor = vec4(puff * border, fil * border, core * border, 1.0);
}
`

export function getSmokeAtlas(gl: THREE.WebGLRenderer, size = 1024): THREE.Texture {
  const hit = cache.get(gl)
  if (hit) return hit
  const rt = new THREE.WebGLRenderTarget(size, size, {
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
  })
  const material = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: frag,
    depthTest: false,
    depthWrite: false,
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  quad.frustumCulled = false
  const scene = new THREE.Scene()
  scene.add(quad)
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const prevTarget = gl.getRenderTarget()
  const prevAutoClear = gl.autoClear
  const prevXr = gl.xr.enabled
  gl.xr.enabled = false
  gl.autoClear = true
  gl.setRenderTarget(rt)
  gl.render(scene, camera)
  gl.setRenderTarget(prevTarget)
  gl.autoClear = prevAutoClear
  gl.xr.enabled = prevXr
  quad.geometry.dispose()
  material.dispose()
  rt.texture.colorSpace = THREE.NoColorSpace
  cache.set(gl, rt.texture)
  return rt.texture
}
