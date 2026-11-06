import { NOISE_GLSL } from '../shaders/common'

export const PLANET_TYPE_ID = {
  terran: 0,
  ocean: 1,
  jungle: 2,
  desert: 3,
  arid: 4,
  ice: 5,
  lava: 6,
  barren: 7,
  toxic: 8,
  gas: 9,
  icegiant: 10,
  hotjupiter: 11,
  chthonian: 12,
  city: 13,
  exotic: 14,
} as const

export const PASS_ALBEDO = 0
export const PASS_HEIGHT = 1
export const PASS_NORMAL = 2
export const PASS_CLOUDS = 3

export const bakeVertex = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export const bakeFragment = `
precision highp float;
precision highp int;

uniform vec3 uSeed;
uniform vec3 uPal[5];
uniform float uSea;
uniform float uSeaLevel;
uniform float uTerrainScale;
uniform float uRelief;
uniform float uCraters;
uniform float uIceCaps;
uniform float uBands;
uniform float uTurbulence;
uniform float uStorms;
uniform float uCloudThr;
uniform float uCloudScale;
uniform float uDetail;
uniform int uLoopZero;
uniform sampler2D uHeightTex;

varying vec2 vUv;

${NOISE_GLSL}

#define T_TERRAN 0
#define T_OCEAN 1
#define T_JUNGLE 2
#define T_DESERT 3
#define T_ARID 4
#define T_ICE 5
#define T_LAVA 6
#define T_BARREN 7
#define T_TOXIC 8
#define T_GAS 9
#define T_ICEGIANT 10
#define T_HOTJUPITER 11
#define T_CHTHONIAN 12
#define T_CITY 13
#define T_EXOTIC 14

#define GIANT (TYPE == T_GAS || TYPE == T_ICEGIANT || TYPE == T_HOTJUPITER)
#define HABITABLE (TYPE == T_TERRAN || TYPE == T_OCEAN || TYPE == T_JUNGLE)
#define SEAS (TYPE == T_TERRAN || TYPE == T_OCEAN || TYPE == T_JUNGLE || TYPE == T_DESERT || TYPE == T_CITY || TYPE == T_EXOTIC || TYPE == T_LAVA || TYPE == T_CHTHONIAN)

const float PI = 3.14159265359;

vec3 dirFromUv(vec2 uv) {
  float phi = uv.x * 2.0 * PI;
  float theta = (1.0 - uv.y) * PI;
  return vec3(-cos(phi) * sin(theta), cos(theta), sin(phi) * sin(theta));
}

vec3 grad4(float t) {
  t = clamp(t, 0.0, 1.0) * 3.0;
  if (t < 1.0) return mix(uPal[0], uPal[1], t);
  if (t < 2.0) return mix(uPal[1], uPal[2], t - 1.0);
  return mix(uPal[2], uPal[3], t - 2.0);
}

vec3 grad5(float t) {
  t = clamp(t, 0.0, 1.0) * 4.0;
  if (t < 1.0) return mix(uPal[0], uPal[1], t);
  if (t < 2.0) return mix(uPal[1], uPal[2], t - 1.0);
  if (t < 3.0) return mix(uPal[2], uPal[3], t - 2.0);
  return mix(uPal[3], uPal[4], t - 3.0);
}

vec3 rotateAround(vec3 p, vec3 axis, float ang) {
  float c = cos(ang), s = sin(ang);
  return p * c + cross(axis, p) * s + axis * dot(axis, p) * (1.0 - c);
}

int oct(int base) { return base + int(uDetail); }

float fbmL(vec3 p, int octaves) {
  float sum = 0.0, amp = 0.5, freq = 1.0, norm = 0.0;
  for (int i = 0; i < octaves + uLoopZero; i++) {
    sum += amp * snoise(p * freq);
    norm += amp;
    freq *= 2.0;
    amp *= 0.5;
  }
  return sum / max(norm, 1e-4);
}

float ridgedL(vec3 p, int octaves) {
  float sum = 0.0, amp = 0.5, freq = 1.0, norm = 0.0, prev = 1.0;
  for (int i = 0; i < octaves + uLoopZero; i++) {
    float n = 1.0 - abs(snoise(p * freq));
    n *= n;
    sum += n * amp * prev;
    prev = n;
    norm += amp;
    freq *= 2.0;
    amp *= 0.5;
  }
  return sum / max(norm, 1e-4);
}

float lineNoise(vec3 q, float width) {
  float n = snoise(q);
  float w = max(width, fwidth(n) * 1.25);
  return (1.0 - smoothstep(0.0, w, abs(n))) * (width / w);
}

float hashv(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}

vec4 noised(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec3 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  float a = hashv(i);
  float b = hashv(i + vec3(1.0, 0.0, 0.0));
  float c = hashv(i + vec3(0.0, 1.0, 0.0));
  float d = hashv(i + vec3(1.0, 1.0, 0.0));
  float e = hashv(i + vec3(0.0, 0.0, 1.0));
  float f1 = hashv(i + vec3(1.0, 0.0, 1.0));
  float g = hashv(i + vec3(0.0, 1.0, 1.0));
  float h = hashv(i + vec3(1.0, 1.0, 1.0));
  float k1 = b - a;
  float k2 = c - a;
  float k3 = e - a;
  float k4 = a - b - c + d;
  float k5 = a - c - e + g;
  float k6 = a - b - e + f1;
  float k7 = -a + b + c - d + e - f1 - g + h;
  float v = a + k1 * u.x + k2 * u.y + k3 * u.z + k4 * u.x * u.y + k5 * u.y * u.z + k6 * u.z * u.x + k7 * u.x * u.y * u.z;
  vec3 grad = du * vec3(
    k1 + k4 * u.y + k6 * u.z + k7 * u.y * u.z,
    k2 + k5 * u.z + k4 * u.x + k7 * u.z * u.x,
    k3 + k6 * u.x + k5 * u.y + k7 * u.x * u.y);
  return vec4(v * 2.0 - 1.0, grad * 2.0);
}

const mat3 OCT_ROT = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);

float erodedFbm(vec3 p, int octaves) {
  float sum = 0.0, amp = 0.5, norm = 0.0;
  vec3 d = vec3(0.0);
  for (int i = 0; i < octaves + uLoopZero; i++) {
    vec4 n = noised(p);
    d += n.yzw;
    sum += amp * n.x / (1.0 + dot(d, d) * 0.4);
    norm += amp;
    amp *= 0.5;
    p = OCT_ROT * p * 2.03;
  }
  return sum / max(norm, 1e-4);
}

vec2 cellsL(vec3 p) {
  vec3 id = floor(p);
  vec3 f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int k = 0; k < 3 + uLoopZero; k++)
  for (int j = 0; j < 3 + uLoopZero; j++)
  for (int i = 0; i < 3 + uLoopZero; i++) {
    vec3 g = vec3(float(i - 1), float(j - 1), float(k - 1));
    vec3 r = g + hash33(id + g + uSeed * 0.01) - f;
    float d = dot(r, r);
    if (d < d1) {
      d2 = d1;
      d1 = d;
    } else if (d < d2) d2 = d;
  }
  return sqrt(vec2(d1, d2));
}

float crackNet(vec3 q, float width) {
  vec2 c = cellsL(q);
  float e = c.y - c.x;
  float w = max(width, fwidth(e) * 1.25);
  return (1.0 - smoothstep(0.0, w, e)) * (width / w);
}

vec3 swirlStorms(vec3 p, float count, float strength, out float core) {
  core = 0.0;
  for (int k = 0; k < int(count) + uLoopZero; k++) {
    vec3 r = hash33(uSeed + float(k) * 13.37 + 2.0);
    float lat = (r.x * 2.0 - 1.0) * (k == 0 ? 0.42 : 0.7);
    float lon = r.y * 2.0 * PI;
    vec3 c = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
    float radius = k == 0 ? 0.14 + 0.08 * r.z : 0.035 + 0.06 * r.z;
    vec3 d = p - c;
    float dist = length(vec2(length(d - vec3(0.0, d.y, 0.0)) * 0.62, d.y));
    if (dist < radius) {
      float t = 1.0 - dist / radius;
      float dir = (lat > 0.0 ? 1.0 : -1.0) * (mod(float(k), 2.0) < 1.0 ? 1.0 : -1.0);
      p = rotateAround(p, c, dir * strength * t * t * 5.0);
      core = max(core, smoothstep(0.35, 0.95, t) * (k == 0 ? 1.0 : 0.6));
    }
  }
  return normalize(p);
}

#if PASS == 1 || PASS == 0
vec2 craterLayer(vec3 p, float freq, float salt, float density) {
  vec3 q = p * freq + uSeed * 0.37 + salt;
  vec3 id = floor(q);
  vec3 f = fract(q);
  vec3 o0 = step(0.5, f) - 1.0;
  float h = 0.0;
  float fresh = 0.0;
  for (int k = 0; k < 2 + uLoopZero; k++)
  for (int j = 0; j < 2 + uLoopZero; j++)
  for (int i = 0; i < 2 + uLoopZero; i++) {
    vec3 g = o0 + vec3(float(i), float(j), float(k));
    vec3 cell = id + g;
    vec3 rnd = hash33(cell + salt);
    if (rnd.z > density) continue;
    vec3 o = 0.3 + 0.4 * hash33(cell * 1.31 + 7.7 + salt);
    float d = length(g + o - f);
    float rad = 0.1 + 0.16 * rnd.x;
    float x = d / rad;
    if (x > 2.0) continue;
    float bowl = x < 1.0 ? (x * x - 1.0) * (0.8 + 0.2 * smoothstep(0.0, 0.45, x)) : 0.0;
    float rx = (x - 1.0) / 0.2;
    float rim = exp(-rx * rx) * 0.42;
    float ejecta = x > 1.0 ? exp(-(x - 1.0) * 3.0) * 0.12 * (1.0 - smoothstep(1.6, 2.0, x)) : 0.0;
    float peak = rad > 0.2 ? exp(-x * x * 40.0) * 0.35 : 0.0;
    h += (bowl + rim + ejecta + peak) * rad;
    float young = step(0.8, rnd.y);
    fresh = max(fresh, young * exp(-max(x - 0.9, 0.0) * 2.2) * (1.0 - smoothstep(1.6, 2.0, x)));
  }
  return vec2(h, fresh);
}

vec2 craterField(vec3 p) {
  if (uCraters < 0.01) return vec2(0.0);
  float dens = clamp(uCraters, 0.0, 1.0);
  vec2 c = craterLayer(p, 2.6, 1.0, dens * 0.6) * vec2(0.6, 1.0);
  c += craterLayer(p, 6.5, 2.0, dens * 0.75) * vec2(0.3, 1.0);
  c += craterLayer(p, 15.0, 3.0, dens * 0.9) * vec2(0.14, 0.8);
  if (uDetail > 0.5) c += craterLayer(p, 34.0, 4.0, dens) * vec2(0.065, 0.6);
  return vec2(c.x, clamp(c.y, 0.0, 1.0));
}
#endif

#if PASS == 1
float continents(vec3 p) {
  vec3 q = p * (1.5 * uTerrainScale) + uSeed;
  vec3 w = vec3(snoise(q * 0.7 + vec3(1.7, 9.2, 3.1)), snoise(q * 0.7 + vec3(8.3, 2.8, 5.5)), snoise(q * 0.7 + vec3(4.4, 6.1, 7.9)));
  q += w * (0.1 + 0.22 * uTurbulence);
  return fbmL(q, oct(6));
}

float mountainBelts(vec3 p) {
  float b = 1.0 - abs(snoise(p * (0.85 * uTerrainScale) + uSeed * 0.61 + 3.3));
  float b2 = 1.0 - abs(snoise(p * (1.9 * uTerrainScale) + uSeed * 0.43 + 8.1));
  float belt = max(smoothstep(0.62, 1.0, b), smoothstep(0.75, 1.0, b2) * 0.55);
  return belt * (0.55 + 0.45 * smoothstep(-0.3, 0.4, snoise(p * 2.3 + uSeed * 0.9)));
}

float shieldVolcanoes(vec3 p) {
  float s = 0.0;
  for (int k = 0; k < 3 + uLoopZero; k++) {
    vec3 r = hash33(uSeed * 0.37 + float(k) * 7.13 + 1.0);
    vec3 c = normalize(r * 2.0 - 1.0 + vec3(0.0, 0.0, 0.001));
    float rad = 0.07 + 0.09 * hash13(r * 9.1 + 2.0);
    float d = acos(clamp(dot(p, c), -1.0, 1.0)) / rad;
    s += (exp(-d * d * 1.4) - exp(-d * d * 70.0) * 0.45) * rad * 1.6;
  }
  return s;
}

float cityLights(vec3 p, float landH, float elev) {
  float pop = smoothstep(0.44, 0.66, fbmL(p * 4.2 + uSeed * 3.1, 3) * 0.5 + 0.5 + smoothstep(0.05, 0.0, landH) * 0.1);
  float towns = smoothstep(0.35, 0.8, snoise(p * 48.0 + uSeed * 5.0));
  float sprawl = smoothstep(0.55, 0.9, snoise(p * 170.0 + uSeed * 7.0)) * 0.6;
  float speck = step(0.985, hash13(floor(p * 700.0 + uSeed)));
  return clamp(pop * (towns + sprawl + speck * 0.8) * (1.0 - smoothstep(0.35, 0.7, elev)), 0.0, 1.0);
}

vec4 structure(vec3 p) {
#if GIANT || TYPE == T_TOXIC
  float emis = 0.0;
#if TYPE == T_HOTJUPITER
  float y = p.y + fbmL(p * vec3(1.6, 6.5, 1.6) + uSeed, 3) * (0.05 + 0.12 * uTurbulence);
  float band = snoise(vec3(y * max(2.0, uBands) * 0.45, uSeed.y, uSeed.z * 0.1)) * 0.5 + 0.5;
  emis = clamp(smoothstep(0.45, 0.95, band) * 0.8 + smoothstep(0.55, 0.9, fbmL(p * vec3(6.0, 30.0, 6.0) + uSeed, 3) * 0.5 + 0.5) * 0.5, 0.0, 1.0);
#endif
  return vec4(0.0, emis, 0.0, 0.0);
#else
  float base = continents(p);
  float landRef = uSeaLevel > 0.01 ? max(uSea, -0.05) : -0.05;
  float inland = smoothstep(landRef - 0.01, landRef + 0.14, base);
  vec3 qm = p * (3.4 * uTerrainScale) + uSeed * 1.7 + 11.0;
  float h = base;
  float aux = 0.0;
  float emis = 0.0;
#if TYPE == T_ICE
  float l1 = lineNoise(p * 2.3 * uTerrainScale + uSeed + 3.1, 0.035);
  float l2 = lineNoise(p * 5.1 * uTerrainScale + uSeed * 1.3 + 8.4, 0.025);
  h = base * 0.35 + l1 * 0.05 + l2 * 0.025 + erodedFbm(qm * 1.5, oct(4)) * 0.008;
#elif TYPE == T_BARREN || TYPE == T_CHTHONIAN
  h = base * 0.3 + erodedFbm(qm, oct(5)) * 0.022;
#elif TYPE == T_CITY
  h = base * 0.6 + ridgedL(qm, 3) * inland * 0.05;
#else
  float ero = clamp(erodedFbm(qm, oct(7)) * 0.5 + 0.5, 0.0, 1.0);
  float ranges = mountainBelts(p) * pow(ero, 1.6) * (0.08 + 0.2 * uRelief);
  float hills = (ero - 0.45) * (0.025 + 0.03 * uRelief);
#if TYPE == T_ARID
  float canyon = lineNoise(p * 1.8 * uTerrainScale + uSeed * 2.1, 0.05) * smoothstep(0.35, 0.7, snoise(p * 0.9 + uSeed * 0.3) * 0.5 + 0.5);
  h = base + inland * (hills + ranges * 0.55) - canyon * 0.08 * smoothstep(-0.1, 0.1, base) + shieldVolcanoes(p) * (0.6 + 0.8 * uRelief);
#elif TYPE == T_DESERT
  h = base + inland * (hills + ranges * 0.8);
#else
  h = base + inland * (hills + ranges);
#endif
#endif
  vec2 crater = craterField(p);
  h += crater.x;
  aux = crater.x;
  float landH = h - uSea;
  float elev = clamp((h - landRef) / 0.3, 0.0, 1.0);

#if TYPE == T_LAVA || TYPE == T_CHTHONIAN
  float n1 = fbmL(p * 3.6 + uSeed * 1.9, 3);
  vec3 q = p * (5.0 * uTerrainScale) + uSeed;
  vec3 qw = q + vec3(snoise(q * 0.5), snoise(q * 0.5 + 4.0), snoise(q * 0.5 + 8.0)) * 0.35;
  float activity = smoothstep(-0.3, 0.25, n1);
#if TYPE == T_CHTHONIAN
  activity *= 0.4;
#endif
  float big = crackNet(qw, 0.045 + 0.05 * uTurbulence);
  float small = crackNet(qw * 3.1 + 7.0, 0.035);
  float cracks = max(big, small * 0.55 * smoothstep(0.2, 0.8, activity)) * activity;
  h -= cracks * 0.02;
  float lake = (uSeaLevel > 0.01 && landH < 0.0) ? smoothstep(0.0, 0.015, -landH) : 0.0;
  float plates = crackNet(q * 2.4 + 3.0, 0.1);
  float lakeGlow = lake * (0.18 + 0.82 * plates) * (0.8 + 0.2 * smoothstep(0.03, 0.0, -landH));
  aux = cracks;
  emis = clamp(max(cracks * 0.95, lakeGlow) * (0.72 + 0.28 * snoise(p * 9.0 + uSeed)), 0.0, 1.0);
#elif TYPE == T_EXOTIC
  vec3 q = p * 3.0 * uTerrainScale + uSeed;
  float veins = max(lineNoise(q, 0.045), lineNoise(q * 3.1 + 9.0, 0.035) * 0.55);
  aux = veins;
  emis = veins * smoothstep(-0.2, 0.3, fbmL(p * 3.6 + uSeed * 1.9, 3) + 0.2);
  h += veins * 0.01;
#elif TYPE == T_CITY
  float artery = lineNoise(p * 3.2 + uSeed, 0.03);
  float g = 0.0;
  for (int i = 0; i < 2 + uLoopZero; i++) {
    float f = i == 0 ? 36.0 : 150.0;
    vec3 c = abs(fract(p * f + uSeed) - 0.5);
    g = max(g, smoothstep(0.42, 0.5, max(c.x, max(c.y, c.z))) * (i == 0 ? 1.0 : 0.6));
  }
  float block = hash13(floor(p * 150.0 + uSeed));
  float dens = hash13(floor(p * 3.2 + uSeed) + 0.5);
  aux = artery;
  bool sea = uSeaLevel > 0.01 && landH < 0.0;
  float pop = 0.25 + 0.75 * smoothstep(0.35, 0.75, fbmL(p * 2.4 + uSeed * 2.0, 3) * 0.5 + 0.5);
  emis = sea ? 0.0 : clamp((artery * 0.8 + g * 0.16 * dens + step(0.4, block) * (0.2 + 0.8 * dens) * 0.4) * pop, 0.0, 1.0);
#elif HABITABLE || TYPE == T_DESERT
  emis = cityLights(p, max(landH, 0.0), elev) * (TYPE == T_DESERT ? 0.7 : 1.0);
  if (uSeaLevel > 0.01 && landH < 0.0) emis = 0.0;
#endif
  return vec4(h, emis, crater.y, aux);
#endif
}
#endif

#if PASS == 0
vec4 gasAlbedo(vec3 p) {
  float core;
  vec3 q = swirlStorms(p, floor(uStorms * 7.0 + 0.5), 0.6 + uTurbulence, core);
  float bandsF = max(2.0, uBands);
  float ice = TYPE == T_ICEGIANT ? 1.0 : 0.0;
  vec3 wq = q * vec3(1.6, 6.5, 1.6) + uSeed;
  float warp = fbmL(wq, oct(4)) * (0.03 + 0.13 * uTurbulence) * (1.0 - 0.6 * ice);
  float eddy = fbmL(q * vec3(5.0, 16.0, 5.0) + uSeed * 1.7 + warp * 8.0, oct(3)) * (0.015 + 0.05 * uTurbulence);
  float y = q.y + warp + eddy;
  float zones = sin(y * bandsF * PI * 0.5 + snoise(vec3(y * 3.0, uSeed.x, 1.0)) * 1.2);
  float prof = snoise(vec3(y * bandsF * 0.45, uSeed.y, uSeed.z * 0.1)) * 0.65 + snoise(vec3(y * bandsF * 1.6, uSeed.z, 4.0)) * 0.3;
  float t = 0.5 + 0.5 * clamp(prof * 0.75 + zones * 0.45, -1.0, 1.0);
  float streak = fbmL(q * vec3(7.0, 46.0, 7.0) + uSeed * 2.3 + warp * 14.0, oct(3)) * (0.06 + 0.14 * uTurbulence);
  t = clamp(t + streak, 0.0, 1.0);
  if (ice > 0.5) t = 0.5 + (t - 0.5) * 0.55;
  vec3 col = grad4(t);
  col *= 0.92 + 0.16 * (fbmL(q * 3.0 + uSeed, 3) * 0.5 + 0.5);
  float polar = smoothstep(0.62, 0.97, abs(p.y));
  col = mix(col, mix(uPal[0], uPal[3], 0.5) * 0.82, polar * 0.55);
  col = mix(col, uPal[4], core * (0.55 + 0.35 * (1.0 - ice)));
  vec3 oq = q * vec3(9.0, 22.0, 9.0) + uSeed * 3.0;
  float oval = smoothstep(0.62, 0.8, snoise(oq)) * step(0.7, hash13(floor(oq * 0.5))) * uStorms;
  vec3 ovalCol = TYPE == T_HOTJUPITER ? uPal[4] : mix(uPal[1], vec3(1.0), 0.5);
  col = mix(col, ovalCol, oval * (TYPE == T_HOTJUPITER ? 0.3 : 0.55));
  return vec4(col, 0.03);
}

vec4 toxicAlbedo(vec3 p) {
  vec3 q = p * vec3(1.4, 4.2, 1.4) + uSeed;
  vec3 w = vec3(fbmL(q + 3.1, 3), fbmL(q + 7.3, 3), fbmL(q + 1.9, 3));
  float n = fbmL(q + w * (0.8 + uTurbulence), oct(4)) * 0.5 + 0.5;
  float chev = sin((p.y * 3.0 + abs(atan(p.z, p.x)) * 0.25) * max(2.0, uBands) + n * 3.0) * 0.5 + 0.5;
  return vec4(grad5(n * 0.75 + chev * 0.25), 0.02);
}

vec2 terrainShape(ivec2 c, ivec2 hs, float h) {
  float hl = texelFetch(uHeightTex, ivec2((c.x - 2 + hs.x) % hs.x, c.y), 0).r;
  float hr = texelFetch(uHeightTex, ivec2((c.x + 2) % hs.x, c.y), 0).r;
  float hd = texelFetch(uHeightTex, ivec2(c.x, max(c.y - 2, 0)), 0).r;
  float hu = texelFetch(uHeightTex, ivec2(c.x, min(c.y + 2, hs.y - 1)), 0).r;
  float texA = PI / float(hs.y);
  float sinT = max(sin((1.0 - (float(c.y) + 0.5) / float(hs.y)) * PI), 0.05);
  float gx = (hr - hl) / (4.0 * texA * sinT);
  float gy = (hu - hd) / (4.0 * texA);
  float lap = (hl + hr + hd + hu - 4.0 * h) / (4.0 * texA * texA);
  return vec2(length(vec2(gx, gy)), -lap * 0.0006);
}

vec4 rockyAlbedo(vec3 p, vec4 S, vec2 shape) {
  float h = S.r;
  float fresh = S.b;
  float aux = S.a;
  float lat = abs(p.y);
  float landH = h - uSea;
  float landRef = uSeaLevel > 0.01 ? max(uSea, -0.05) : -0.05;
  float elev = clamp((h - landRef) / 0.3, 0.0, 1.0);
  float n1 = fbmL(p * 3.6 + uSeed * 1.9, 3);
  float n2 = fbmL(p * 11.0 + uSeed * 2.7, 3);
  float detail = 0.9 + 0.2 * fbmL(p * 38.0 + uSeed, 2);
  bool seas = uSeaLevel > 0.01;
  vec3 col = uPal[2];
  float spec = 0.02;

#if HABITABLE
  float latA = asin(min(lat, 1.0)) / (PI * 0.5);
  float rocky = smoothstep(2.5, 9.0, shape.x);
  if (seas && landH < 0.0) {
    float depth = -landH;
    col = mix(uPal[1], uPal[0], smoothstep(0.0, 0.045, depth + n2 * 0.006));
    col *= mix(1.0, 0.7, smoothstep(0.05, 0.32, depth));
    col *= 0.97 + 0.06 * n2;
    spec = 1.0;
  } else {
    float temp = 1.0 - latA * 1.05 - elev * 0.85 + n1 * 0.07 - (uIceCaps - 0.3) * 0.25;
    float e0 = latA / 0.16;
    float e1 = (latA - 0.3) / 0.1;
    float e2 = (latA - 0.6) / 0.14;
    float wet = 0.52 + 0.36 * exp(-e0 * e0) - 0.42 * exp(-e1 * e1) + 0.16 * exp(-e2 * e2);
    wet += fbmL(p * 2.4 + uSeed * 1.3, oct(4)) * 0.38 + (1.0 - smoothstep(0.0, 0.09, landH)) * 0.1 - elev * 0.12;
#if TYPE == T_JUNGLE
    wet += 0.38;
    temp += 0.08;
#endif
    wet = clamp(wet, 0.0, 1.0);
    vec3 forest = uPal[2] * vec3(0.6, 0.72, 0.6);
    vec3 grass = mix(uPal[2], uPal[3], 0.22) * 1.02;
    vec3 steppe = mix(uPal[2], uPal[3], 0.7) * 1.04;
    vec3 sand = clamp(uPal[3] * vec3(1.42, 1.25, 1.02) + 0.05, 0.0, 1.0);
    vec3 tundra = mix(uPal[3], vec3(0.42, 0.4, 0.36), 0.45);
    vec3 rock = mix(uPal[3] * 0.7, vec3(0.34, 0.32, 0.3), 0.45);
    vec3 warm = mix(sand, steppe, smoothstep(0.16, 0.4, wet));
    warm = mix(warm, grass, smoothstep(0.4, 0.6, wet));
    warm = mix(warm, forest, smoothstep(0.6, 0.86, wet));
    col = mix(tundra, warm, smoothstep(0.1, 0.36, temp));
    col *= 0.86 + 0.28 * (fbmL(p * 9.0 + uSeed * 2.1, oct(3)) * 0.5 + 0.5);
    col = mix(col, rock, rocky * 0.85);
    col *= 1.0 + clamp(shape.y, -0.22, 0.22);
    float snow = smoothstep(0.0, 0.08, -temp + n2 * 0.05 + 0.05 * (1.0 - rocky));
    col = mix(col, uPal[4], snow);
    if (seas) col = mix(sand * 0.95, col, smoothstep(0.0, 0.005, landH));
    float river = lineNoise(p * 2.6 * uTerrainScale + uSeed * 4.0 + fbmL(p * 7.0 + uSeed, 2) * 0.4, 0.022);
    float rv = river * (1.0 - smoothstep(0.0, 0.35, elev)) * smoothstep(0.3, 0.7, wet) * (TYPE == T_JUNGLE ? 0.8 : 0.5);
    col = mix(col, uPal[1] * 0.75, rv);
    spec = mix(mix(0.04, 0.3, snow), 0.6, rv);
    col *= detail;
  }
  float capStart = 1.0 - uIceCaps * 0.25;
  float cap = smoothstep(capStart - 0.015, capStart + 0.02, lat + n1 * 0.05 + fbmL(p * 14.0 + uSeed, oct(3)) * 0.025 + elev * 0.05);
  col = mix(col, uPal[4] * (0.94 + 0.06 * n2), cap);
  spec = mix(spec, 0.35, cap);
#elif TYPE == T_DESERT
  float dunes = 1.0 - abs(snoise(p * vec3(150.0, 45.0, 150.0) * uTerrainScale + fbmL(p * 6.0 + uSeed, 2) * 2.5));
  float t = n1 * 0.5 + 0.5;
  vec3 sandCol = mix(uPal[1], uPal[2], smoothstep(0.25, 0.8, t + n2 * 0.15));
  float erg = smoothstep(0.62, 0.3, elev + (fbmL(p * 1.7 + uSeed * 0.7, 3) * 0.3) + smoothstep(2.0, 6.0, shape.x) * 0.3);
  vec3 rockCol = mix(uPal[0], uPal[3], smoothstep(0.2, 0.8, n2 * 0.5 + 0.5));
  float strata = sin(h * 150.0 + n1 * 2.5) * 0.5 + 0.5;
  rockCol = mix(rockCol, rockCol * vec3(1.2, 1.08, 0.94), strata * smoothstep(1.5, 5.0, shape.x));
  col = mix(rockCol, sandCol, erg);
  col *= 1.0 + (dunes - 0.5) * 0.18 * erg;
  col *= 1.0 + clamp(shape.y, -0.2, 0.2) * (1.0 - erg * 0.6);
  col = mix(col, uPal[3], smoothstep(0.55, 0.9, elev + n2 * 0.1) * 0.6);
  float basin = smoothstep(uSea + 0.06, uSea - 0.02, h) * smoothstep(0.2, 0.6, n2 * 0.5 + 0.5);
  col = mix(col, uPal[4], basin * 0.85);
  if (seas && landH < 0.0) {
    col = mix(vec3(0.12, 0.3, 0.36), vec3(0.05, 0.12, 0.2), smoothstep(0.0, 0.06, -landH));
    spec = 1.0;
  }
  float cap = smoothstep(1.0 - uIceCaps * 0.35, 1.03 - uIceCaps * 0.35, lat + n1 * 0.04);
  col = mix(col, uPal[4], cap);
  col *= detail;
#elif TYPE == T_ARID
  float warpA = fbmL(p * 2.2 + uSeed * 0.3, 3);
  float darkReg = smoothstep(0.46, 0.74, fbmL(p * 1.5 + uSeed * 0.5 + warpA * 0.5, oct(5)) * 0.5 + 0.5);
  float lowland = smoothstep(-0.04, -0.16, h - aux * 0.5);
  col = mix(uPal[1], uPal[2], smoothstep(-0.35, 0.45, n1 + n2 * 0.2));
  col = mix(col, uPal[0], max(darkReg * 0.75, lowland * 0.45));
  col = mix(col, uPal[3], smoothstep(0.55, 0.95, elev) * 0.65);
  col = mix(col, uPal[2] * 1.15, fresh * 0.45);
  col *= 1.0 + clamp(shape.y, -0.22, 0.22);
  col *= 0.9 + 0.2 * (fbmL(p * 16.0 + uSeed, oct(3)) * 0.5 + 0.5);
  float capEdge = fbmL(p * 12.0 + uSeed * 1.7, 3) * 0.03;
  float cap = smoothstep(1.0 - uIceCaps * 0.32, 1.02 - uIceCaps * 0.32, lat + n1 * 0.05 + capEdge);
  col = mix(col, uPal[4], cap);
  spec = mix(0.02, 0.25, cap);
  col *= detail;
#elif TYPE == T_ICE
  float t = smoothstep(-0.3, 0.35, fbmL(p * 2.0 * uTerrainScale + uSeed, oct(5)));
  col = mix(uPal[1], uPal[2], t);
  float chaos = smoothstep(0.58, 0.78, fbmL(p * 3.1 + uSeed * 2.3, oct(4)) * 0.5 + 0.5);
  col = mix(col, mix(uPal[0], uPal[2], 0.55) * (0.9 + 0.2 * n2), chaos * 0.55);
  float l1 = lineNoise(p * 2.3 * uTerrainScale + uSeed + 3.1, 0.022);
  float l2 = lineNoise(p * 5.1 * uTerrainScale + uSeed * 1.3 + 8.4, 0.018);
  float l3 = lineNoise(p * 11.0 * uTerrainScale + uSeed * 0.7 + 2.2, 0.014);
  float l4 = lineNoise(p * 23.0 * uTerrainScale + uSeed * 0.3 + 5.7, 0.012);
  float lines = max(max(l1, l2 * 0.85), max(l3 * 0.6, l4 * 0.4));
  float halo = max(1.0 - smoothstep(0.0, 0.09, abs(snoise(p * 2.3 * uTerrainScale + uSeed + 3.1))), 0.0) * 0.35;
  col = mix(col, uPal[0], clamp(lines * 0.7 + halo * 0.4, 0.0, 1.0));
  col = mix(col, mix(uPal[0], uPal[1], 0.6), smoothstep(0.55, 0.8, fbmL(p * 4.0 + uSeed * 3.0, 3) * 0.5 + 0.5) * 0.25);
  col = mix(col, uPal[3], smoothstep(0.2, 0.6, elev));
  float cap = smoothstep(0.75, 0.95, lat + n1 * 0.08);
  col = mix(col, uPal[4], max(cap, fresh * 0.7));
  spec = 0.12;
  col *= 0.96 + 0.08 * n2;
#elif TYPE == T_LAVA || TYPE == T_CHTHONIAN
  float cracks = aux;
  float glow = S.g;
  col = mix(uPal[0], uPal[1], smoothstep(-0.35, 0.45, n1 + n2 * 0.3));
  col = mix(col, uPal[0] * 0.6, smoothstep(0.1, 0.6, glow) * 0.5);
  col = mix(col, uPal[2], smoothstep(0.35, 0.8, elev + n2 * 0.1) * 0.7);
  col *= 1.0 + clamp(shape.y * 1.5, -0.25, 0.25);
  col = mix(col, uPal[3], clamp(glow * 1.2, 0.0, 1.0) * 0.85);
#if TYPE == T_CHTHONIAN
  col = mix(col, uPal[2], fresh * 0.3);
#endif
  spec = (seas && landH < 0.0) ? 0.25 : 0.04;
  col *= detail;
#elif TYPE == T_BARREN
  float maria = smoothstep(0.04, -0.12, fbmL(p * 0.9 * uTerrainScale + uSeed + 2.0, oct(5)));
  col = mix(uPal[1], uPal[2], smoothstep(-0.3, 0.45, n1));
  col = mix(col, uPal[0], maria * 0.8);
  col = mix(col, uPal[3], clamp(aux * 18.0, 0.0, 1.0) * 0.45);
  col = mix(col, uPal[4], fresh * 0.65);
  col *= 1.0 + clamp(shape.y * 0.8, -0.18, 0.18);
  col *= 0.88 + 0.24 * (n2 * 0.5 + 0.5);
  col *= detail;
#elif TYPE == T_CITY
  float dens = hash13(floor(p * 3.2 + uSeed) + 0.5);
  col = mix(uPal[0], uPal[1], smoothstep(-0.3, 0.3, n1));
  float g = 0.0;
  for (int i = 0; i < 2 + uLoopZero; i++) {
    float f = i == 0 ? 36.0 : 150.0;
    vec3 c = abs(fract(p * f + uSeed) - 0.5);
    g = max(g, smoothstep(0.42, 0.5, max(c.x, max(c.y, c.z))) * (i == 0 ? 1.0 : 0.6));
  }
  float district = hash13(floor(p * 14.0 + uSeed) + 0.2);
  float block = hash13(floor(p * 70.0 + uSeed));
  col = mix(col, uPal[2], smoothstep(0.3, 0.75, block) * (0.2 + dens * 0.35));
  col *= 0.85 + 0.3 * district;
  col = mix(col, uPal[3], max(aux * 0.85, g * 0.22));
  if (seas && landH < 0.0) {
    col = uPal[0] * 0.55;
    spec = 1.0;
  }
  float cap = smoothstep(1.0 - uIceCaps * 0.3, 1.02 - uIceCaps * 0.3, lat);
  col = mix(col, uPal[4] * 0.6 + 0.4, cap * 0.6);
#else
  vec3 q = p * 3.0 * uTerrainScale + uSeed;
  float facet = hash13(floor(q) + 0.3);
  col = mix(uPal[0], uPal[1], smoothstep(-0.35, 0.4, n1));
  col = mix(col, uPal[2], step(0.55, facet) * smoothstep(-0.2, 0.4, snoise(q * 1.7)) * 0.8);
  col = mix(col, uPal[3], aux);
  col = mix(col, uPal[4], fresh * 0.5 + smoothstep(0.6, 0.9, elev) * 0.5);
  if (seas && landH < 0.0) {
    col = mix(uPal[1], uPal[0], smoothstep(0.0, 0.08, -landH));
    spec = 0.9;
  }
  spec = max(spec, step(0.55, facet) * 0.3);
#endif
  return vec4(clamp(col, 0.0, 1.0), spec);
}
#endif

#if PASS == 3
vec2 clouds(vec3 p) {
  float core;
  vec3 pc = swirlStorms(p, 5.0, 0.42, core);
#if TYPE == T_TOXIC
  vec3 q = pc * vec3(1.5, 5.5, 1.5) * uCloudScale + uSeed * 2.0;
#else
  vec3 q = pc * vec3(2.2, 3.3, 2.2) * uCloudScale + uSeed * 2.0;
#endif
  vec3 w1 = vec3(snoise(q * 0.32 + 3.1), snoise(q * 0.32 + 7.7), snoise(q * 0.32 + 1.3));
  vec3 qa = q + w1 * (0.5 + 0.45 * uTurbulence);
  float base = fbmL(qa, 5) * 0.5 + 0.5;
  float ero = fbmL(qa * 3.6 + 4.0, oct(4)) * 0.5 + 0.5;
  float lat = abs(p.y);
  float bands = 1.0;
#if TYPE != T_TOXIC
  float e0 = lat / 0.12;
  float e1 = (lat - 0.38) / 0.1;
  float e2 = (lat - 0.7) / 0.12;
  bands = 0.95 + 0.12 * exp(-e0 * e0) - 0.14 * exp(-e1 * e1) + 0.08 * exp(-e2 * e2);
#endif
  float v = base * bands + core * 0.12;
  float edge = v - (1.0 - ero) * 0.085;
  float deck = smoothstep(uCloudThr - 0.02, uCloudThr + 0.15, edge);
  deck *= 0.62 + 0.38 * smoothstep(0.3, 0.85, ero);
  float d = deck;
#if TYPE != T_TOXIC
  vec2 cc = cellsL(qa * 8.0 + 2.0);
  float puffs = smoothstep(0.85, 0.25, cc.x) * smoothstep(0.4, 0.75, ero);
  float margin = smoothstep(uCloudThr - 0.13, uCloudThr - 0.01, v) * (1.0 - deck);
  d = max(d, puffs * margin * 0.75);
  float streak = fbmL(pc * vec3(3.0, 24.0, 3.0) * uCloudScale + uSeed * 3.0 + w1 * 0.6, oct(3)) * 0.5 + 0.5;
  float cirrusZone = smoothstep(0.45, 0.7, fbmL(qa * 0.6 + 11.0, 3) * 0.5 + 0.5);
  float cirrus = smoothstep(0.5, 0.85, streak) * smoothstep(0.15, 0.4, v) * cirrusZone * 0.3;
  d = max(d, cirrus);
#endif
  return vec2(clamp(d, 0.0, 1.0), ero);
}
#endif

void main() {
  vec3 p = dirFromUv(vUv);
#if PASS == 1
  gl_FragColor = structure(p);
#elif PASS == 0
#if GIANT
  gl_FragColor = gasAlbedo(p);
#elif TYPE == T_TOXIC
  gl_FragColor = toxicAlbedo(p);
#else
  ivec2 hs = textureSize(uHeightTex, 0);
  ivec2 c = clamp(ivec2(vUv * vec2(hs)), ivec2(0), hs - 1);
  vec4 S = texelFetch(uHeightTex, c, 0);
  gl_FragColor = rockyAlbedo(p, S, terrainShape(c, hs, S.r));
  gl_FragColor.rgb += (hash13(vec3(gl_FragCoord.xy, 3.7)) - 0.5) * (1.0 / 255.0) * (gl_FragColor.rgb + 0.04);
#endif
#elif PASS == 2
  ivec2 hs = textureSize(uHeightTex, 0);
  ivec2 c = clamp(ivec2(vUv * vec2(hs)), ivec2(0), hs - 1);
  float emis = texelFetch(uHeightTex, c, 0).g;
  vec3 n = p;
#if !GIANT && TYPE != T_TOXIC
  float k = 0.01 + 0.1 * uRelief;
  bool seaFlat = uSeaLevel > 0.01;
  ivec2 xl = ivec2((c.x - 1 + hs.x) % hs.x, c.y);
  ivec2 xr = ivec2((c.x + 1) % hs.x, c.y);
  ivec2 yd = ivec2(c.x, max(c.y - 1, 0));
  ivec2 yu = ivec2(c.x, min(c.y + 1, hs.y - 1));
  vec2 inv = 1.0 / vec2(hs);
  #define DISPLACED(t) (dirFromUv((vec2(t) + 0.5) * inv) * (1.0 + (seaFlat ? max(texelFetch(uHeightTex, t, 0).r, uSea) : texelFetch(uHeightTex, t, 0).r) * k))
  vec3 du = DISPLACED(xr) - DISPLACED(xl);
  vec3 dv = DISPLACED(yu) - DISPLACED(yd);
  vec3 nn = cross(du, dv);
  if (dot(nn, nn) > 1e-20 && abs(p.y) < 0.998) {
    nn = normalize(nn);
    if (dot(nn, p) < 0.0) nn = -nn;
    n = nn;
  }
#endif
  gl_FragColor = vec4(n * 0.5 + 0.5, emis);
  gl_FragColor.rgb += (hash13(vec3(gl_FragCoord.xy, 5.1)) - 0.5) * (1.0 / 255.0);
#else
  vec2 cl = clouds(p);
  gl_FragColor = vec4(cl.x, cl.y, 0.0, 1.0);
#endif
}
`
