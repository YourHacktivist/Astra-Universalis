import * as THREE from 'three'
import { lightUniforms } from '../runtime'
import { LIGHTS_GLSL, NOISE_GLSL } from '../shaders/common'
import { ATMO_GLSL, DETAIL_GLSL, RING_GLSL, SHADOW_GLSL } from './glsl'

export const MAX_OCC = 3

export function createShadowUniforms() {
  return {
    uRingSeed: { value: 0 },
    uRingBands: { value: 0.6 },
    uRingShadow: { value: 0 },
    uRingC: { value: new THREE.Vector3() },
    uRingN: { value: new THREE.Vector3(0, 1, 0) },
    uRingInner: { value: 1 },
    uRingOuter: { value: 2 },
    uRingOpacity: { value: 0.8 },
    uOccPos: { value: Array.from({ length: MAX_OCC }, () => new THREE.Vector3()) },
    uOccRad: { value: new Array<number>(MAX_OCC).fill(0) },
    uOccCount: { value: 0 },
  }
}

export type ShadowUniforms = ReturnType<typeof createShadowUniforms>

export function createAtmoUniforms() {
  return {
    uCenter: { value: new THREE.Vector3() },
    uRp: { value: 1 },
    uRa: { value: 1.05 },
    uAtmoColor: { value: new THREE.Color('#6fa8ff') },
    uSunset: { value: new THREE.Color('#ff9a5a') },
    uAtmoDensity: { value: 0.6 },
  }
}

export type AtmoUniforms = ReturnType<typeof createAtmoUniforms>

const sphereVert = `
varying vec2 vUv;
varying vec3 vPosW;
varying vec3 vNormalW;
varying vec3 vObj;
void main() {
  vUv = uv;
  vObj = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPosW = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const surfaceFrag = `
${LIGHTS_GLSL}
${RING_GLSL}
${SHADOW_GLSL}
${ATMO_GLSL}
${NOISE_GLSL}
${DETAIL_GLSL}
uniform float uDetailBump;
uniform float uDetailAlbedo;
uniform float uDetailCraters;
uniform float uRegolith;
uniform float uCloudAlt;
uniform sampler2D uAlbedo;
uniform sampler2D uNormal;
uniform sampler2D uClouds;
uniform float uCloudShadow;
uniform float uCloudOffset;
uniform mat3 uModelRot;
uniform vec3 uEmissiveColor;
uniform float uEmissive;
uniform float uNightOnly;
uniform vec3 uCenter;
uniform float uRp;
uniform float uRa;
uniform vec3 uAtmoColor;
uniform vec3 uSunset;
uniform float uAtmoDensity;
uniform float uSpecular;
uniform float uRoughness;
uniform sampler2D uAlbedoPrev;
uniform sampler2D uNormalPrev;
uniform float uHasPrev;
uniform float uMix;
uniform vec3 uFlatColor;
varying vec2 vUv;
varying vec3 vPosW;
varying vec3 vNormalW;

void main() {
  vec4 alb = texture2D(uAlbedo, vUv);
  vec4 nm = texture2D(uNormal, vUv);
  vec3 Ng = normalize(vNormalW);
  vec3 No = nm.xyz * 2.0 - 1.0;
  if (uMix < 0.999) {
    vec4 albP = vec4(uFlatColor, 0.0);
    vec3 NoP = normalize(vObj);
    float emP = 0.0;
    if (uHasPrev > 0.5) {
      albP = texture2D(uAlbedoPrev, vUv);
      vec4 nmP = texture2D(uNormalPrev, vUv);
      NoP = nmP.xyz * 2.0 - 1.0;
      emP = nmP.a;
    }
    alb = mix(albP, alb, uMix);
    No = mix(NoP, No, uMix);
    nm.a = mix(emP, nm.a, uMix);
  }
  No = normalize(No);
  float water = alb.a;
  float land = 1.0 - smoothstep(0.5, 0.9, water);

  float lod = length(fwidth(vObj));
  vec3 det = surfaceDetail(vObj, lod, 6, 0.62);
  vec2 cr = uDetailCraters > 0.0 ? craterDetail(vObj, uDetailFreq * 0.15, lod) * uDetailCraters : vec2(0.0);
  vec3 NoL = bumpNormal(No, vObj, (det.x * uDetailBump + cr.x) * land);
  vec3 NoW = bumpNormal(normalize(vObj), vObj, det.x * 0.0025);
  alb.rgb *= (1.0 + det.y * uDetailAlbedo * land * det.z) * (1.0 + cr.y * land);
  vec3 N = normalize(uModelRot * NoL);
  N = normalize(mix(Ng, N, step(0.0, dot(N, Ng))));
  vec3 Nw = normalize(uModelRot * NoW);

  vec3 V = normalize(cameraPosition - vPosW);
  float cloudSh = 1.0;
  if (uCloudShadow > 0.0) {
    vec3 L0 = normalize(uStarPos[0] - vPosW);
    vec3 Lo = normalize(transpose(uModelRot) * L0);
    vec3 P = normalize(vObj);
    vec3 S = normalize(P + Lo * (uCloudAlt / max(dot(P, Lo), 0.12)));
    vec2 uvS = dirToUv(S);
    uvS.x -= uCloudOffset;
    float c = textureGrad(uClouds, uvS, dFdx(vUv), dFdy(vUv)).r;
    cloudSh = 1.0 - c * uCloudShadow;
  }
  vec3 diffuse = vec3(0.0);
  vec3 spec = vec3(0.0);
  vec3 sky = vec3(0.0);
  vec3 sunset = vec3(0.0);
  float day = 0.0;
  float ndv = max(dot(Ng, V), 0.0);
  float fres = 0.02 + 0.98 * pow(max(1.0 - ndv, 0.0), 5.0);
  float aW = mix(0.05, 0.32, uRoughness);
  float a2 = aW * aW;
  for (int i = 0; i < MAX_STAR_LIGHTS; i++) {
    if (i >= uStarCount) break;
    vec3 L = normalize(uStarPos[i] - vPosW);
    float ndlG = dot(Ng, L);
    float term = smoothstep(-0.06, 0.2, ndlG);
    float sh = shadowFor(vPosW, L, uStarPos[i], uStarRadius[i]);
    float ndl = max(dot(N, L), 0.0);
    float lam = mix(ndl, smoothstep(-0.1, 1.0, ndlG), 0.12);
    float ls = 2.0 * ndl / (ndl + max(dot(N, V), 0.0) + 1e-3);
    lam = mix(lam, ls, uRegolith) * term;
    diffuse += uStarColor[i] * lam * sh * cloudSh;
    vec3 H = normalize(L + V);
    float nh = max(dot(Nw, H), 0.0);
    float dd = nh * nh * (a2 - 1.0) + 1.0;
    float D = min(a2 / (3.14159 * dd * dd), 400.0);
    float F = 0.02 + 0.98 * pow(clamp(1.0 - dot(V, H), 0.0, 1.0), 5.0);
    float ndlW = max(dot(Nw, L), 0.0);
    spec += uStarColor[i] * D * F * ndlW / (4.0 * max(dot(Nw, V), 0.08)) * water * uSpecular * term * sh * cloudSh;
    sky += uStarColor[i] * smoothstep(-0.1, 0.55, ndlG) * sh;
    float sx = (ndlG - 0.04) / 0.075;
    sunset += uStarColor[i] * exp(-sx * sx) * sh;
    day = max(day, term * sh);
  }
  spec += uAtmoColor * sky * fres * 0.35 * water * uAtmoDensity;
  vec3 albedo = alb.rgb;
  vec3 col = albedo * (diffuse + vec3(uAmbient)) + spec;
  float night = 1.0 - smoothstep(0.0, 0.3, day);
  float emA = nm.a;
  if (uEmissive > 0.0) {
    vec3 detE = surfaceDetail(vObj, lod * 4.0, 3, 0.5);
    emA = mix(nm.a, smoothstep(0.08, 0.7, nm.a + detE.y * 0.2) * min(1.0, nm.a * 3.0), detE.z);
  }
  float em = emA * uEmissive * mix(mix(0.45, 1.0, night), night, uNightOnly);
  col += uEmissiveColor * em * mix(1.1, 2.2, uNightOnly);
  if (uAtmoDensity > 0.0) {
    vec3 D = -V;
    float depth = atmoDepth(cameraPosition, D, length(vPosW - cameraPosition), uCenter, uRp, uRa);
    float k = uAtmoDensity * 0.22;
    float ext = exp(-pow(max(depth, 0.0), 1.35) * k);
    float limb = smoothstep(1.5, 5.0, depth);
    vec3 inscatter = uAtmoColor * sky * 0.7 + uSunset * sunset * limb * 0.8;
    col = col * mix(1.0, ext, 0.6) + inscatter * (1.0 - ext);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export function createSurfaceMaterial(shadow: ShadowUniforms, atmo: AtmoUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...lightUniforms,
      ...shadow,
      ...atmo,
      uAlbedo: { value: null as THREE.Texture | null },
      uNormal: { value: null as THREE.Texture | null },
      uClouds: { value: null as THREE.Texture | null },
      uCloudShadow: { value: 0 },
      uCloudOffset: { value: 0 },
      uModelRot: { value: new THREE.Matrix3() },
      uEmissiveColor: { value: new THREE.Color('#ffc677') },
      uEmissive: { value: 0 },
      uNightOnly: { value: 1 },
      uSpecular: { value: 1 },
      uRoughness: { value: 0.35 },
      uAlbedoPrev: { value: null as THREE.Texture | null },
      uNormalPrev: { value: null as THREE.Texture | null },
      uHasPrev: { value: 0 },
      uMix: { value: 1 },
      uFlatColor: { value: new THREE.Color('#888888') },
      uDetailFreq: { value: 170 },
      uDetailStretch: { value: 1 },
      uDetailBump: { value: 0.03 },
      uDetailAlbedo: { value: 0.18 },
      uDetailCraters: { value: 0 },
      uRegolith: { value: 0 },
      uCloudAlt: { value: 0.008 },
    },
    vertexShader: sphereVert,
    fragmentShader: surfaceFrag,
  })
}

const cloudFrag = `
${LIGHTS_GLSL}
${RING_GLSL}
${SHADOW_GLSL}
${NOISE_GLSL}
${DETAIL_GLSL}
uniform sampler2D uClouds;
uniform vec3 uColor;
uniform vec3 uSunsetCloud;
uniform float uOpacity;
uniform sampler2D uCloudsPrev;
uniform float uHasPrev;
uniform float uMix;
uniform mat3 uModelRot;
varying vec2 vUv;
varying vec3 vPosW;
varying vec3 vNormalW;

float densityAt(vec3 dir, vec2 gx, vec2 gy) {
  return textureGrad(uClouds, dirToUv(dir), gx, gy).r;
}

void main() {
  vec2 c = texture2D(uClouds, vUv).rg;
  if (uMix < 0.999) {
    vec2 cp = uHasPrev > 0.5 ? texture2D(uCloudsPrev, vUv).rg : vec2(0.0, c.g);
    c = mix(cp, c, uMix);
  }
  float d = c.r;
  vec3 det = surfaceDetail(vObj, length(fwidth(vObj)) * 6.0, 2, 0.5);
  d = clamp(d * (1.0 + det.y * 0.5 * det.z * (1.0 - d)), 0.0, 1.0);
  if (d < 0.004) discard;
  vec3 Ng = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPosW);
  float rim = 1.0 - max(dot(Ng, V), 0.0);
  float a = clamp(d * uOpacity * (1.0 + rim * rim * 0.5), 0.0, 1.0);
  vec3 P = normalize(vObj);
  vec2 gx = dFdx(vUv);
  vec2 gy = dFdy(vUv);
  vec3 light = vec3(0.0);
  vec3 dusk = vec3(0.0);
  for (int i = 0; i < MAX_STAR_LIGHTS; i++) {
    if (i >= uStarCount) break;
    vec3 L = normalize(uStarPos[i] - vPosW);
    float ndl = dot(Ng, L);
    float sh = shadowFor(vPosW, L, uStarPos[i], uStarRadius[i]);
    float lit = max(ndl, 0.0) * 0.85 + smoothstep(-0.06, 0.3, ndl) * 0.15;
    vec3 Lo = normalize(transpose(uModelRot) * L);
    vec3 Lt = Lo - P * dot(P, Lo);
    float occ = 0.0;
    if (i == 0) occ = (densityAt(normalize(P + Lt * 0.008), gx, gy) + densityAt(normalize(P + Lt * 0.02), gx, gy)) * 0.5;
    float selfSh = mix(1.0, 0.5, smoothstep(0.1, 0.9, occ) * (1.0 - smoothstep(0.2, 0.9, ndl)) * smoothstep(0.2, 0.8, d));
    float fwd = pow(max(dot(-V, L), 0.0), 8.0) * (1.0 - d) * 0.8;
    light += uStarColor[i] * (lit * selfSh + fwd * smoothstep(-0.1, 0.1, ndl)) * sh;
    float dx = (ndl - 0.04) / 0.12;
    dusk += uStarColor[i] * exp(-dx * dx) * sh;
  }
  float thick = mix(1.0, 0.8, smoothstep(0.6, 1.0, d) * (1.0 - c.g));
  vec3 col = uColor * (light * thick + uAmbient * 0.25) + uSunsetCloud * dusk * 0.35;
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export function createCloudMaterial(shadow: ShadowUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...lightUniforms,
      ...shadow,
      uClouds: { value: null as THREE.Texture | null },
      uColor: { value: new THREE.Color('#ffffff') },
      uSunsetCloud: { value: new THREE.Color('#ff9a5a') },
      uOpacity: { value: 0.9 },
      uCloudsPrev: { value: null as THREE.Texture | null },
      uHasPrev: { value: 0 },
      uMix: { value: 1 },
      uModelRot: { value: new THREE.Matrix3() },
      uDetailFreq: { value: 120 },
      uDetailStretch: { value: 1.6 },
    },
    vertexShader: sphereVert,
    fragmentShader: cloudFrag,
    transparent: true,
    depthWrite: false,
  })
}

const atmoFrag = `
${LIGHTS_GLSL}
uniform vec3 uCenter;
uniform float uRp;
uniform float uRa;
uniform vec3 uAtmoColor;
uniform vec3 uSunset;
uniform float uAtmoDensity;
varying vec3 vPosW;
void main() {
  vec3 O = cameraPosition;
  vec3 D = normalize(vPosW - O);
  vec3 oc = uCenter - O;
  float tc = dot(oc, D);
  float b2 = dot(oc, oc) - tc * tc;
  float ra2 = uRa * uRa;
  if (b2 >= ra2) discard;
  float b = sqrt(b2);
  float halfC = sqrt(ra2 - b2);
  float hitsPlanet = step(b, uRp);
  float len = hitsPlanet > 0.5 ? max(halfC - sqrt(max(uRp * uRp - b2, 0.0)), 0.0) : 2.0 * halfC;
  float h = clamp((b - uRp) / (uRa - uRp), 0.0, 1.0);
  float depth = len / (uRa - uRp) * exp(-h * 3.6);
  vec3 S = O + D * (hitsPlanet > 0.5 ? (tc - halfC) : max(tc, 0.0));
  vec3 Ns = normalize(S - uCenter);
  vec3 col = vec3(0.0);
  for (int i = 0; i < MAX_STAR_LIGHTS; i++) {
    if (i >= uStarCount) break;
    vec3 L = normalize(uStarPos[i] - S);
    float mu = dot(Ns, L);
    float lit = smoothstep(-0.32, 0.4, mu);
    float mx = (mu + 0.02) / 0.16;
    float dusk = exp(-mx * mx);
    float phase = 1.0 + 2.2 * pow(max(dot(D, L), 0.0), 6.0);
    vec3 c = mix(uAtmoColor, uSunset, clamp(dusk * 0.9, 0.0, 1.0));
    col += c * uStarColor[i] * (lit + dusk * 0.4) * phase;
  }
  float a = 1.0 - exp(-depth * uAtmoDensity * 0.3);
  a *= smoothstep(1.0, 0.82, h);
  gl_FragColor = vec4(col * a * 1.15, 1.0);
}
`

export function createAtmosphereMaterial(atmo: AtmoUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: { ...lightUniforms, ...atmo },
    vertexShader: sphereVert,
    fragmentShader: atmoFrag,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

const ringVert = `
varying vec3 vPosW;
varying vec2 vLocal;
void main() {
  vLocal = position.xy;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPosW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const ringFrag = `
${LIGHTS_GLSL}
${RING_GLSL}
uniform float uInner;
uniform float uOuter;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uOpacity;
uniform vec3 uPlanetC;
uniform float uPlanetR;
uniform vec3 uRingNormal;
varying vec3 vPosW;
varying vec2 vLocal;
void main() {
  float r = length(vLocal);
  float x = (r - uInner) / (uOuter - uInner);
  float dens = ringDensity(x);
  if (dens < 0.004) discard;
  float grain = 0.88 + 0.24 * rNoise(x * 1400.0);
  vec3 base = mix(uColorA, uColorB, ringTint(x)) * grain;
  vec3 V = normalize(cameraPosition - vPosW);
  vec3 n = normalize(uRingNormal);
  float ndv = dot(n, V);
  vec3 light = vec3(0.0);
  for (int i = 0; i < MAX_STAR_LIGHTS; i++) {
    if (i >= uStarCount) break;
    vec3 L = normalize(uStarPos[i] - vPosW);
    vec3 toC = uPlanetC - vPosW;
    float t = dot(toC, L);
    float sh = 1.0;
    if (t > 0.0) {
      float d = length(toC - L * t);
      sh = smoothstep(uPlanetR * 0.97, uPlanetR * 1.03, d);
    }
    float ndl = dot(n, L);
    float sameSide = step(0.0, ndl * ndv);
    float lit = mix((0.1 + 0.55 * abs(ndl)) * (1.0 - dens * 0.75), 0.2 + 0.8 * abs(ndl), sameSide);
    float fwd = pow(max(dot(-V, L), 0.0), 7.0) * 1.6 * (1.0 - dens * 0.55);
    light += uStarColor[i] * (lit + fwd) * sh;
  }
  vec3 col = base * (light + uAmbient * 0.8);
  float a = clamp(dens * 1.3, 0.0, 1.0) * uOpacity;
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export function createRingMaterial(shadow: ShadowUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...lightUniforms,
      uRingSeed: shadow.uRingSeed,
      uRingBands: shadow.uRingBands,
      uInner: { value: 1.3 },
      uOuter: { value: 2.3 },
      uColorA: { value: new THREE.Color('#d9c7a4') },
      uColorB: { value: new THREE.Color('#8f7c62') },
      uOpacity: { value: 0.8 },
      uPlanetC: shadow.uRingC,
      uPlanetR: { value: 1 },
      uRingNormal: shadow.uRingN,
    },
    vertexShader: ringVert,
    fragmentShader: ringFrag,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

let sphere: THREE.SphereGeometry | null = null
let sphereLow: THREE.SphereGeometry | null = null
export function unitSphere(low = false) {
  if (low) return (sphereLow ??= new THREE.SphereGeometry(1, 64, 32))
  return (sphere ??= new THREE.SphereGeometry(1, 144, 72))
}
