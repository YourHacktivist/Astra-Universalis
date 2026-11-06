export const RING_GLSL = `
uniform float uRingSeed;
uniform float uRingBands;

float rHash(float n) { return fract(sin(n * 127.1 + uRingSeed * 31.7) * 43758.5453123); }
float rNoise(float x) {
  float i = floor(x);
  float f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(rHash(i), rHash(i + 1.0), u);
}

float ringDensity(float x) {
  if (x <= 0.0 || x >= 1.0) return 0.0;
  float n = rNoise(x * 7.0) * 0.42 + rNoise(x * 29.0 + 5.0) * 0.28 + rNoise(x * 91.0 + 11.0) * 0.18 + rNoise(x * 271.0 + 17.0) * 0.12;
  float ringlets = 0.5 + 0.5 * sin(x * 520.0 + rNoise(x * 40.0) * 6.0);
  float banded = clamp(n * 1.35 - 0.12 + ringlets * 0.12, 0.0, 1.0);
  float d = mix(0.8, banded, uRingBands);
  for (int k = 0; k < 3; k++) {
    float gx = 0.32 + 0.55 * rHash(float(k) * 3.7 + 1.0);
    float gw = (0.006 + 0.03 * rHash(float(k) * 5.1 + 2.0)) * uRingBands;
    d *= mix(0.08, 1.0, smoothstep(gw * 0.35, gw, abs(x - gx)));
  }
  d *= mix(0.32, 1.0, smoothstep(0.0, 0.28, x));
  d *= smoothstep(0.0, 0.03, x) * smoothstep(1.0, 0.965, x);
  return clamp(d, 0.0, 1.0);
}

float ringTint(float x) {
  return clamp(rNoise(x * 13.0 + 3.0) * 0.55 + x * 0.45, 0.0, 1.0);
}
`

export const SHADOW_GLSL = `
uniform float uRingShadow;
uniform vec3 uRingC;
uniform vec3 uRingN;
uniform float uRingInner;
uniform float uRingOuter;
uniform float uRingOpacity;
#define MAX_OCC 3
uniform vec3 uOccPos[MAX_OCC];
uniform float uOccRad[MAX_OCC];
uniform int uOccCount;

float shadowFor(vec3 P, vec3 L, vec3 starPos, float starRadius) {
  float s = 1.0;
  if (uRingShadow > 0.5) {
    float denom = dot(L, uRingN);
    if (abs(denom) > 1e-4) {
      float t = dot(uRingC - P, uRingN) / denom;
      if (t > 0.0) {
        float r = length(P + L * t - uRingC);
        float x = (r - uRingInner) / (uRingOuter - uRingInner);
        s *= 1.0 - ringDensity(x) * uRingOpacity * 0.92;
      }
    }
  }
  float distS = length(starPos - P);
  for (int j = 0; j < MAX_OCC; j++) {
    if (j >= uOccCount) break;
    vec3 oc = uOccPos[j] - P;
    float t = dot(oc, L);
    if (t <= 0.0 || t > distS) continue;
    float d = length(oc - L * t);
    float pen = max(starRadius * t / distS, uOccRad[j] * 0.04);
    s *= smoothstep(uOccRad[j] - pen, uOccRad[j] + pen, d);
  }
  return s;
}
`

export const DETAIL_GLSL = `
uniform float uDetailFreq;
uniform float uDetailStretch;
varying vec3 vObj;

const float PI_D = 3.14159265359;

vec2 dirToUv(vec3 d) {
  float phi = atan(d.z, -d.x);
  if (phi < 0.0) phi += 2.0 * PI_D;
  return vec2(phi / (2.0 * PI_D), 1.0 - acos(clamp(d.y, -1.0, 1.0)) / PI_D);
}

vec3 surfaceDetail(vec3 o, float lod, int maxOct, float gain) {
  float h = 0.0;
  float a = 0.0;
  float an = 0.0;
  float vis = 0.0;
  float f = uDetailFreq;
  float amp = 1.0;
  vec3 s = vec3(1.0, uDetailStretch, 1.0);
  for (int i = 0; i < 6; i++) {
    if (i >= maxOct) break;
    float v = 1.0 - smoothstep(0.25, 0.55, f * lod);
    if (v <= 0.0) break;
    float n = snoise(o * s * f + float(i) * 7.31);
    h += n * v / f;
    a += n * v * amp;
    an += amp;
    vis = max(vis, v);
    amp *= gain;
    f *= 2.17;
  }
  return vec3(h, an > 0.0 ? a / an : 0.0, vis);
}

vec2 craterDetail(vec3 o, float freq, float lod) {
  vec2 acc = vec2(0.0);
  float f = freq;
  for (int layer = 0; layer < 3; layer++) {
    float vis = 1.0 - smoothstep(0.05, 0.1, f * lod);
    if (vis <= 0.0) break;
    vec3 q = o * f + float(layer) * 17.7;
    vec3 id = floor(q);
    vec3 fr = fract(q);
    vec3 o0 = step(0.5, fr) - 1.0;
    for (int k = 0; k < 2; k++)
    for (int j = 0; j < 2; j++)
    for (int i = 0; i < 2; i++) {
      vec3 g = o0 + vec3(float(i), float(j), float(k));
      vec3 cell = id + g;
      vec3 rnd = hash33(cell + 0.37);
      if (rnd.z > 0.5) continue;
      vec3 c = 0.3 + 0.4 * hash33(cell * 1.31 + 7.7);
      float x = length(g + c - fr) / (0.1 + 0.16 * rnd.x);
      if (x > 1.7) continue;
      float rad = (0.1 + 0.16 * rnd.x) / f;
      float bowl = x < 1.0 ? (x * x - 1.0) * 0.5 : 0.0;
      float rx = (x - 1.0) / 0.18;
      float rim = exp(-rx * rx) * 0.22;
      acc.x += (bowl + rim) * rad * vis;
      float fresh = step(0.75, rnd.y);
      acc.y += (x < 1.0 ? -0.07 + fresh * 0.1 : (0.04 + fresh * 0.1) * exp(-(x - 1.0) * 4.0)) * vis;
    }
    f *= 2.6;
  }
  return acc;
}

vec3 bumpNormal(vec3 N, vec3 pos, float hgt) {
  vec3 dpdx = dFdx(pos);
  vec3 dpdy = dFdy(pos);
  float dhx = dFdx(hgt);
  float dhy = dFdy(hgt);
  vec3 r1 = cross(dpdy, N);
  vec3 r2 = cross(N, dpdx);
  float det = dot(dpdx, r1);
  if (abs(det) < 1e-12) return N;
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * N - grad);
}
`

export const ATMO_GLSL = `
float atmoDepth(vec3 o, vec3 d, float maxT, vec3 c, float rp, float ra) {
  vec3 oc = c - o;
  float tc = dot(oc, d);
  float b2 = dot(oc, oc) - tc * tc;
  float ra2 = ra * ra;
  if (b2 >= ra2) return 0.0;
  float half_ = sqrt(ra2 - b2);
  float t0 = max(tc - half_, 0.0);
  float t1 = min(tc + half_, maxT);
  if (t1 <= t0) return 0.0;
  float b = sqrt(b2);
  float h = clamp((max(b, rp) - rp) / (ra - rp), 0.0, 1.0);
  return (t1 - t0) / (ra - rp) * exp(-h * 3.2);
}
`
