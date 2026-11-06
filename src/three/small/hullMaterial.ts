import * as THREE from 'three'
import { NOISE_GLSL } from '../shaders/common'

export type HullKind = 'hull' | 'accent' | 'dark' | 'panel'

const KIND_ID: Record<HullKind, number> = { hull: 0, accent: 1, dark: 2, panel: 3 }

const LOOK: Record<HullKind, { metalness: number; roughness: number; env: number }> = {
  hull: { metalness: 0.32, roughness: 0.5, env: 0.55 },
  accent: { metalness: 0.12, roughness: 0.58, env: 0.4 },
  dark: { metalness: 0.6, roughness: 0.45, env: 0.7 },
  panel: { metalness: 0.55, roughness: 0.16, env: 1 },
}

const HULL_PARS = `
${NOISE_GLSL}
uniform float uPanel;
uniform float uKind;
uniform float uDamage;
uniform float uSeedH;
uniform float uScale;
varying vec3 vObjPos;
varying vec3 vObjN;

float hullHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeedH * 0.731) * 43758.5453); }

vec4 hullPanels(vec2 uv, float px) {
  vec2 bid = floor(uv / (uPanel * 4.0));
  float bh = hullHash(bid + 0.5);
  float size = bh < 0.18 ? uPanel * 0.5 : (bh < 0.6 ? uPanel * 1.2 : uPanel * 2.4);
  vec2 g = uv / size;
  if (bh > 0.88) g.y *= 0.4;
  if (fract(bh * 7.3) < 0.3) g.x += step(0.5, fract(floor(g.y) * 0.5)) * 0.5;
  vec2 id = floor(g);
  vec2 f = fract(g);
  float h = hullHash(id + bid * 7.13);
  vec2 e = min(f, 1.0 - f) * size;
  float d = min(e.x, e.y);
  float w0 = size * 0.022;
  float w = max(w0, px * 1.3);
  float vis = min(1.0, w0 / w * 1.6);
  float seam = (1.0 - smoothstep(w * 0.45, w, d)) * vis;
  float stripe = step(0.5, fract((g.x + g.y) * 2.5)) * step(h, 0.09);
  return vec4(h, seam, stripe, vis);
}

vec3 hullBump(vec3 N, vec3 pos, float hgt) {
  vec3 dpdx = dFdx(pos);
  vec3 dpdy = dFdy(pos);
  float dhx = dFdx(hgt);
  float dhy = dFdy(hgt);
  vec3 r1 = cross(dpdy, N);
  vec3 r2 = cross(N, dpdx);
  float det = dot(dpdx, r1);
  if (abs(det) < 1e-20) return N;
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * N - grad);
}
`

const HULL_COLOR = `
  float hullRough = 1.0;
  float hullH = 0.0;
  {
    float px = length(fwidth(vObjPos));
    vec3 an = abs(normalize(vObjN));
    vec2 uvP = (an.x > an.y && an.x > an.z) ? vObjPos.zy : ((an.y > an.z) ? vObjPos.xz : vObjPos.xy);
    vec4 P = hullPanels(uvP, px);
    vec3 col = diffuseColor.rgb;
    float stain = snoise(vObjPos * 3.1 + uSeedH) * 0.5 + 0.5;
    float streak = snoise(vec3(vObjPos.x * 11.0, vObjPos.y * 1.6, vObjPos.z * 11.0) + uSeedH * 1.7) * 0.5 + 0.5;
    float grime = smoothstep(0.5, 0.95, stain * 0.65 + streak * 0.45);
    if (uKind < 2.5) {
      col *= 0.9 + 0.16 * P.x + step(0.94, P.x) * 0.12 - step(P.x, 0.05) * 0.18;
      col *= 1.0 - P.y * 0.32;
      col *= 1.0 - grime * 0.28;
      if (uKind > 0.5 && uKind < 1.5) col = mix(col, vec3(0.05), P.z * 0.85);
      hullRough = (0.8 + 0.4 * P.x) * (1.0 + grime * 0.4) * (1.0 + P.y * 0.4);
      hullH = -P.y * uPanel * 0.02 * uScale;
    } else {
      vec2 c = fract(uvP / (uPanel * 0.3));
      float cl = min(min(c.x, 1.0 - c.x), min(c.y, 1.0 - c.y)) * uPanel * 0.3;
      float bw = max(uPanel * 0.012, px);
      float bus = (1.0 - smoothstep(bw * 0.5, bw, cl)) * min(1.0, uPanel * 0.012 / bw * 1.6);
      col = mix(col * (0.85 + 0.3 * P.x), vec3(0.55, 0.58, 0.62), bus * 0.5);
      col *= 1.0 - P.y * 0.6;
      hullRough = 0.8 + 0.6 * bus + grime * 0.5;
    }
    if (uDamage > 0.5) {
      float burn = smoothstep(0.52, 0.78, snoise(vObjPos * 2.3 + 3.0) * 0.5 + 0.5);
      col *= 1.0 - burn * 0.75;
      col = mix(col, col * vec3(1.15, 0.72, 0.45), smoothstep(0.45, 0.85, stain) * 0.45);
      hullRough *= 1.0 + burn * 0.5;
    }
    diffuseColor.rgb = col;
  }
`

let envTexture: THREE.Texture | null = null
export function spaceEnvironment(gl: THREE.WebGLRenderer): THREE.Texture {
  if (envTexture) return envTexture
  const scene = new THREE.Scene()
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = mix(vec3(0.014, 0.017, 0.026), vec3(0.07, 0.08, 0.11), d.y * 0.5 + 0.5);
        float band = exp(-pow((d.y + 0.15 * d.x) / 0.14, 2.0));
        col += vec3(0.16, 0.145, 0.13) * band;
        gl_FragColor = vec4(col, 1.0);
      }`,
  })
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), mat))
  const pmrem = new THREE.PMREMGenerator(gl)
  envTexture = pmrem.fromScene(scene, 0.02).texture
  pmrem.dispose()
  mat.dispose()
  return envTexture
}

export interface HullMaterial extends THREE.MeshStandardMaterial {
  userData: { uScale: { value: number } }
}

export function createHullMaterial(opts: {
  color: THREE.ColorRepresentation
  kind: HullKind
  damaged: boolean
  seed: number
  envMap: THREE.Texture | null
  emissive?: THREE.ColorRepresentation
  emissiveIntensity?: number
}): HullMaterial {
  const look = LOOK[opts.kind]
  const m = new THREE.MeshStandardMaterial({
    color: opts.color,
    metalness: look.metalness,
    roughness: look.roughness,
    envMap: opts.envMap,
    envMapIntensity: look.env,
    emissive: opts.emissive ?? '#000000',
    emissiveIntensity: opts.emissiveIntensity ?? 0,
  }) as HullMaterial
  const uniforms = {
    uPanel: { value: 0.05 },
    uKind: { value: KIND_ID[opts.kind] },
    uDamage: { value: opts.damaged ? 1 : 0 },
    uSeedH: { value: (opts.seed % 997) * 0.37 },
    uScale: { value: 1 },
  }
  m.userData.uScale = uniforms.uScale
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;\nvarying vec3 vObjN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;\nvObjN = normal;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${HULL_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${HULL_COLOR}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * hullRough, 0.04, 1.0);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = hullBump(normal, -vViewPosition, hullH);')
  }
  m.customProgramCacheKey = () => 'astra-hull'
  return m
}
