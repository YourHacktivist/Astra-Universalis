import { FAST_NOISE_GLSL } from './noise'

export const SURFACE_VERT = `
varying vec3 vObj;
varying vec3 vNormalV;
varying vec3 vViewPos;
void main() {
  vObj = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  vNormalV = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}
`

export const SURFACE_FRAG = `
${FAST_NOISE_GLSL}
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uColorLimb;
uniform vec3 uColorHot;
uniform float uIntensity;
uniform float uGran;
uniform float uActivity;
uniform float uSpots;
uniform float uSeed;
uniform float uDetail;
varying vec3 vObj;
varying vec3 vNormalV;
varying vec3 vViewPos;

vec3 photosphere(vec3 n, float mu) {
  float t = uTime * (0.015 + 0.05 * uActivity);
  float freq = 26.0 / max(uGran, 0.2);
  vec3 p = n * freq + uSeed;
  vec3 w = vec3(
    snoise(p * 0.45 + vec3(t, 0.0, 0.0)),
    snoise(p * 0.45 + vec3(17.3, -t, 3.1)),
    snoise(p * 0.45 + vec3(5.7, 31.7, t * 0.7))
  );
  vec3 q = p + w * (0.3 + 0.45 * uActivity);
  vec2 c = cellular2(q + vec3(0.0, t * 1.6, -t));
  float cells = 1.0 - smoothstep(0.05, 0.95, c.x);
  float fine = snoise(q * 2.8 + vec3(t * 2.0)) * 0.5 + 0.5;
  float gran = mix(0.88, 1.05, cells) * mix(0.96, 1.03, fine);
  float lanes = 1.0 - smoothstep(0.0, 0.14, c.y - c.x);
  gran *= 1.0 - lanes * 0.2;
  gran = mix(0.97, gran, uDetail);
  float sg = fbm3(n * 5.0 + vec3(t * 0.4) + uSeed);
  gran *= 0.92 + 0.14 * sg;

  float sp = fbm4(n * 2.0 + uSeed * 1.7 + vec3(0.0, t * 0.08, 0.0)) * 0.5 + 0.5;
  float th = 1.0 - uSpots * 0.42;
  float pen = smoothstep(th - 0.05, th + 0.01, sp);
  float umbra = smoothstep(th + 0.02, th + 0.07, sp);
  float lat = abs(n.y);
  float belt = smoothstep(0.04, 0.18, lat) * (1.0 - smoothstep(0.5, 0.72, lat));
  float spotK = pen * belt * step(0.001, uSpots);
  float spot = mix(1.0, mix(0.5, 0.1, umbra), spotK);
  float fac = pen * (1.0 - umbra) * belt * (1.0 - mu) * 0.6;

  vec3 col = mix(uColorLimb, uColor, smoothstep(0.0, 1.0, pow(mu, 0.45)));
  col = mix(col, uColorHot, smoothstep(0.6, 1.0, cells) * 0.12 * uDetail * mu);
  return col * gran * spot + uColorHot * fac * 0.35;
}

vec3 brownDwarf(vec3 n, float mu) {
  float t = uTime * 0.02;
  float lat = n.y;
  vec3 p = n * 2.2 + uSeed;
  float warp = fbm4(p + vec3(t, 0.0, 0.0)) * (0.5 + uActivity);
  float bands = sin(lat * 13.0 + warp * 2.4) * 0.5 + 0.5;
  float storms = smoothstep(0.55, 0.85, fbm3(n * 5.0 + vec3(0.0, t * 2.0, uSeed)) * 0.5 + 0.5);
  vec3 deep = uColorLimb * 0.55;
  vec3 col = mix(deep, uColor, bands);
  col = mix(col, uColorHot, storms * 0.6);
  return col;
}

vec3 remnant(vec3 n, float mu) {
  float t = uTime * 0.6;
  float sh = fbm3(n * 6.0 + vec3(t, -t * 0.7, t * 0.3) + uSeed) * 0.5 + 0.5;
  return mix(uColor, uColorHot, sh * 0.6);
}

void main() {
  vec3 n = normalize(vObj);
  vec3 V = normalize(-vViewPos);
  float mu = clamp(dot(normalize(vNormalV), V), 0.0, 1.0);
#if MODE == 0
  vec3 col = photosphere(n, mu);
  float hot = smoothstep(-0.2, 0.3, uColor.b - uColor.r);
  float u1 = mix(0.6, 0.32, hot);
  float u2 = mix(0.26, 0.12, hot);
  float limb = 1.0 - u1 * (1.0 - mu) - u2 * (1.0 - mu) * (1.0 - mu);
#elif MODE == 1
  vec3 col = brownDwarf(n, mu);
  float limb = 0.45 + 0.55 * pow(mu, 0.6);
#else
  vec3 col = remnant(n, mu);
  float limb = 0.75 + 0.25 * mu;
#endif
  gl_FragColor = vec4(col * limb * uIntensity, 1.0);
}
`

export const BILLBOARD_VERT = `
uniform vec2 uHalfSize;
uniform float uLift;
varying vec2 vLocal;
void main() {
  vLocal = position.xy * 2.0;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float d = length(mv.xyz);
  mv.xyz += normalize(-mv.xyz) * min(uLift, d * 0.9);
  mv.xy += position.xy * 2.0 * uHalfSize;
  gl_Position = projectionMatrix * mv;
}
`

export const CORONA_FRAG = `
${FAST_NOISE_GLSL}
uniform vec3 uColor;
uniform float uIntensity;
uniform float uSizePx;
uniform float uDiskPx;
uniform float uCorona;
uniform float uRays;
uniform float uTime;
uniform float uSeed;
uniform float uResolved;
varying vec2 vLocal;

void main() {
  float q = length(vLocal) * uSizePx;
  float disk = max(uDiskPx, 0.5);
  float ang = atan(vLocal.y, vLocal.x);
  vec2 dir = vec2(cos(ang), sin(ang));

  float outside = max(q - disk, 0.0);
  float mask = mix(1.0, smoothstep(disk * 0.985, disk * 1.015, q), uResolved);

  float s = max(disk * 0.3, 1.5);
  float x = outside / s;
  float core = 1.0 / (1.0 + x * x);
  core *= core;
  float y = outside / max(disk * 0.6, 4.0 + 4.0 * uCorona);
  float tail = 1.0 / (1.0 + y);
  tail = tail * tail * tail * 0.12 * uCorona;
  float limbGlow = exp(-outside / max(disk * 0.07 * (0.6 + uCorona), 1.5)) * uResolved * 0.75;

  float t = uTime * 0.05;
  float n1 = clamp(snoise(vec3(dir * 2.2, t + uSeed)) * 0.5 + 0.5, 0.0, 1.0);
  float n2 = clamp(snoise(vec3(dir * 7.0, t * 1.7 + uSeed * 2.0)) * 0.5 + 0.5, 0.0, 1.0);
  float streamers = n1 * n1 * n1 * 0.7 + pow(n2, 6.0) * 0.5;
  float rayReach = disk * (0.35 + uCorona * 0.45) * uResolved + 5.0 + 4.0 * uCorona;
  float rays = streamers * exp(-outside / rayReach) * uRays * 0.55;

  float spikes = 0.0;
  if (uResolved < 0.99) {
    vec2 a = abs(vLocal) * uSizePx;
    float s1 = exp(-a.y * 1.1) * exp(-a.x / (uSizePx * 0.3));
    float s2 = exp(-a.x * 1.1) * exp(-a.y / (uSizePx * 0.3));
    spikes = (s1 + s2) * 0.3 * (1.0 - uResolved) * uRays;
  }

  float fade = 1.0 - smoothstep(0.7, 1.0, length(vLocal));
  float I = (core * 1.5 + tail + limbGlow + rays + spikes) * mask * fade;
  float overLimb = smoothstep(disk * 0.86, disk, q) * (1.0 - mask) * uResolved;
  I += limbGlow * overLimb * 0.6 * fade;
  vec3 col = mix(uColor, vec3(1.0), clamp(core * 0.45 * (1.0 - uResolved), 0.0, 0.6));
  gl_FragColor = vec4(col * I * uIntensity, 1.0);
}
`

export const STREAK_FRAG = `
uniform vec3 uColor;
uniform float uIntensity;
varying vec2 vLocal;
void main() {
  float x = min(abs(vLocal.x), 1.0);
  float y = abs(vLocal.y);
  float line = exp(-y * 9.0) * pow(max(1.0 - x, 0.0), 2.6);
  float core = exp(-y * 28.0) * pow(max(1.0 - x, 0.0), 6.0);
  float I = (line * 0.55 + core) * (1.0 - smoothstep(0.85, 1.0, y));
  gl_FragColor = vec4(uColor * I * uIntensity, 1.0);
}
`

const DISK_COMMON = `
uniform vec3 uInnerColor;
uniform vec3 uOuterColor;
uniform float uInner;
uniform float uOuter;
uniform float uTime;
uniform float uSeed;

float diskNoise(float r, float theta) {
  float T = 24.0;
  float ta = mod(uTime, T);
  float tb = mod(uTime + T * 0.5, T);
  float wa = 1.0 - abs(ta / T * 2.0 - 1.0);
  float omega = 1.6 * pow(r / uInner, -1.5);
  float lr = log(r);
  float sa = theta - omega * ta;
  float sb = theta - omega * tb + 1.7;
  float na = fbm4(vec3(cos(sa) * 3.0, sin(sa) * 3.0, lr * 7.0 + uSeed));
  float nb = fbm4(vec3(cos(sb) * 3.0, sin(sb) * 3.0, lr * 7.0 + uSeed + 9.1));
  float n = mix(nb, na, wa) * 0.5 + 0.5;
  float fa = fbm4(vec3(cos(sa) * 11.0, sin(sa) * 11.0, lr * 26.0 + uSeed * 1.3));
  float fb = fbm4(vec3(cos(sb) * 11.0, sin(sb) * 11.0, lr * 26.0 + uSeed * 1.3 + 4.2));
  float streaks = mix(fb, fa, wa) * 0.5 + 0.5;
  float rings = sin(lr * 64.0 + n * 9.0 + streaks * 5.0) * 0.5 + 0.5;
  return n * mix(0.62, 1.25, streaks) * mix(0.9, 1.07, rings);
}

vec3 diskColor(float r) {
  float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
  vec3 c = mix(uInnerColor, uOuterColor, smoothstep(0.0, 0.7, pow(t, 0.7)));
  c = mix(c, uOuterColor * vec3(0.6, 0.28, 0.16), smoothstep(0.5, 1.0, t));
  c = mix(c, vec3(1.0, 0.96, 0.88), (1.0 - smoothstep(0.0, 0.08, t)) * 0.6);
  return c;
}

float diskProfile(float r) {
  float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
  float inner = smoothstep(0.0, 0.025, t);
  float outer = 1.0 - smoothstep(0.45, 1.0, t);
  return inner * outer * (0.18 + 1.6 * pow(max(1.0 - t, 0.0), 2.5));
}
`

export const DISK_VERT = `
varying vec2 vPolar;
varying vec3 vWorldPos;
uniform float uHorizon;
void main() {
  vPolar = position.xy / uHorizon;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

export const DISK_FRAG = `
${FAST_NOISE_GLSL}
${DISK_COMMON}
uniform float uBrightness;
uniform vec3 uCenter;
uniform vec3 uNormal;
varying vec2 vPolar;
varying vec3 vWorldPos;
void main() {
  float r = length(vPolar);
  if (r < uInner || r > uOuter) discard;
  float theta = atan(vPolar.y, vPolar.x);
  float n = diskNoise(r, theta);
  float prof = diskProfile(r);

  vec3 radial = normalize(vWorldPos - uCenter);
  vec3 vel = normalize(cross(uNormal, radial));
  vec3 toCam = normalize(cameraPosition - vWorldPos);
  float beta = dot(vel, toCam) * 0.55 * pow(uInner / r, 0.5);
  float beam = pow(max(1.0 + beta, 0.05), 3.0);
  vec3 col = diskColor(r);
  col = mix(col, col * vec3(0.85, 0.95, 1.25), clamp(beta, 0.0, 1.0));
  col = mix(col, col * vec3(1.2, 0.8, 0.6), clamp(-beta, 0.0, 1.0));

  float I = prof * mix(0.2, 1.45, n * n) * beam * uBrightness;
  float edge = abs(dot(toCam, uNormal));
  I *= mix(0.6, 1.0, smoothstep(0.0, 0.15, edge));
  gl_FragColor = vec4(col * I, 1.0);
}
`

export const LENS_FRAG = `
${FAST_NOISE_GLSL}
${DISK_COMMON}
uniform float uBrightness;
uniform float uSizeH;
uniform float uEdgeOn;
uniform vec2 uUpScreen;
varying vec2 vLocal;
void main() {
  vec2 p = vLocal * uSizeH;
  float rho = length(p);
  if (rho < 1.0) discard;
  float phi = atan(p.y, p.x);
  vec2 d = p / rho;
  float above = abs(dot(d, uUpScreen));

  float pr1 = (rho - 1.32) / 0.045;
  float pr2 = (rho - 1.32) / 0.18;
  float photon = exp(-pr1 * pr1) * 1.4 + exp(-pr2 * pr2) * 0.22;

  float r = mix(uInner, uOuter, clamp((rho - 1.4) / (uOuter * 0.5), 0.0, 1.0));
  float band = smoothstep(1.34, 1.6, rho) * (1.0 - smoothstep(1.85, max(2.0, uOuter * 0.45), rho));
  float shape = mix(0.1, pow(above, 1.3), uEdgeOn);
  float n = diskNoise(r, phi * 1.0);
  float lensed = band * shape * mix(0.25, 1.35, n * n) * diskProfile(r) * (0.25 + 0.75 * uEdgeOn);

  vec3 col = diskColor(r) * lensed + mix(uInnerColor, vec3(1.0, 0.95, 0.85), 0.6) * photon;
  float fade = 1.0 - smoothstep(0.8, 1.0, length(vLocal));
  gl_FragColor = vec4(col * uBrightness * fade, 1.0);
}
`

export const BEAM_VERT = `
varying vec3 vNormalV;
varying vec3 vViewPos;
varying float vAlong;
void main() {
  vAlong = uv.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  vNormalV = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}
`

export const BEAM_FRAG = `
${FAST_NOISE_GLSL}
uniform vec3 uColor;
uniform float uIntensity;
uniform float uTime;
varying vec3 vNormalV;
varying vec3 vViewPos;
varying float vAlong;
void main() {
  vec3 V = normalize(-vViewPos);
  float facing = pow(abs(dot(normalize(vNormalV), V)), 3.0);
  float along = pow(clamp(1.0 - vAlong, 0.0, 1.0), 2.2) * smoothstep(0.0, 0.04, vAlong);
  float flow = snoise(vec3(vAlong * 14.0 - uTime * 5.0, facing * 2.0, 0.0)) * 0.5 + 0.5;
  float I = facing * along * mix(0.25, 1.4, flow * flow);
  gl_FragColor = vec4(uColor * I * uIntensity, 1.0);
}
`

export const FIELD_VERT = `
attribute float aT;
varying float vT;
void main() {
  vT = aT;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const FIELD_FRAG = `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uTime;
varying float vT;
void main() {
  float pulse = 0.5 + 0.5 * sin(vT * 40.0 - uTime * 6.0);
  float I = (0.35 + 0.65 * pulse) * sin(vT * 3.14159);
  gl_FragColor = vec4(uColor * I * uIntensity, 1.0);
}
`
