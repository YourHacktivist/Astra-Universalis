import { FAST_NOISE_GLSL } from '../star/noise'

const UV_DIR = `
vec3 uvToDir(vec2 uv) {
  float lon = (uv.x - 0.5) * 6.28318530718;
  float lat = (uv.y - 0.5) * 3.14159265359;
  return vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
}
`

export const BAKE_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
}
`

export const BAKE_A_FRAG = `
${FAST_NOISE_GLSL}
${UV_DIR}
uniform float uSeed;
varying vec2 vUv;

void main() {
  vec3 d = uvToDir(vUv);
  float b = asin(clamp(d.y, -1.0, 1.0));
  float l = atan(d.z, d.x);
  vec3 s = vec3(uSeed * 0.37, uSeed * 0.11, uSeed * 0.73);

  float warp = fbm3(d * 2.0 + s);
  float width = 0.085 + 0.05 * (snoise(vec3(cos(l), sin(l), 0.0) * 1.5 + s) * 0.5 + 0.5);
  float bw = b + warp * 0.035;
  float bn = bw / width;
  float band = exp(-bn * bn);
  float hn = bw / (width * 3.2);
  float halo = exp(-hn * hn) * 0.22;
  float clouds = fbm5(d * 3.5 + s + vec3(warp * 0.6)) * 0.5 + 0.5;
  float starClouds = fbm3(d * 16.0 + s * 2.0) * 0.5 + 0.5;
  float cl = acos(clamp(d.x, -1.0, 1.0));
  float cn = cl / 0.42;
  float bb = b / 0.2;
  float bulge = exp(-cn * cn) * exp(-bb * bb);
  float mw = band * (0.35 + 0.85 * clouds) * (0.65 + 0.6 * starClouds) + halo * clouds + bulge * (0.9 + 0.4 * clouds);

  float lanes = ridged4(d * 4.2 + s + vec3(warp));
  float dn = (bw + 0.012) / (width * 0.55);
  float dustBand = exp(-dn * dn);
  float dust = dustBand * smoothstep(0.32, 0.78, lanes);
  dust = max(dust, dustBand * smoothstep(0.55, 0.9, fbm2(d * 9.0 + s) * 0.5 + 0.5) * 0.6);

  gl_FragColor = vec4(clamp(mw, 0.0, 4.0), clamp(dust, 0.0, 1.0), 0.0, 1.0);
}
`

export const BAKE_B_FRAG = `
${FAST_NOISE_GLSL}
${UV_DIR}
uniform float uSeed;
varying vec2 vUv;

float nebula(vec3 d, vec3 o, float scale) {
  vec3 q = d * scale + o;
  vec3 w = vec3(fbm2(q + 3.1), fbm2(q + 7.7), fbm2(q + 1.9));
  float n = fbm4(q + w * 1.1) * 0.5 + 0.5;
  float wisps = fbm3(d * scale * 5.5 + w * 2.0 + o) * 0.5 + 0.5;
  return pow(smoothstep(0.48, 0.92, n), 1.6) * mix(0.55, 1.25, wisps);
}

void main() {
  vec3 d = uvToDir(vUv);
  vec3 s = vec3(uSeed * 0.37, uSeed * 0.11, uSeed * 0.73);
  gl_FragColor = vec4(nebula(d, s * 1.3, 1.25), nebula(d, -s * 0.9 + 11.0, 1.6), 0.0, 1.0);
}
`
export const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = vec4(p.xy, p.w * 0.999999, p.w);
}
`

export const SKY_FRAG = `
uniform sampler2D uFields;
uniform sampler2D uNebulae;
uniform mat3 uToGalactic;
uniform float uMilky;
uniform vec3 uNeb1;
uniform vec3 uNeb2;
uniform float uNebI;
uniform float uBright;
uniform float uReady;
varying vec3 vDir;

vec2 dirToUv(vec3 d) {
  return vec2(atan(d.z, d.x) / 6.28318530718 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.14159265359 + 0.5);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec3 g = normalize(uToGalactic * normalize(vDir));
  vec2 uv = dirToUv(g);
  vec4 f = vec4(texture2D(uFields, uv).rg, texture2D(uNebulae, uv).rg);
  float cl = acos(clamp(g.x, -1.0, 1.0));
  float cn = cl / 0.75;
  float bulge = exp(-cn * cn);
  vec3 mwColor = mix(vec3(0.52, 0.6, 0.86), vec3(1.0, 0.84, 0.64), bulge);
  vec3 col = mwColor * f.r * uMilky * 0.075;
  vec3 neb = uNeb1 * f.b * 0.11 + uNeb2 * f.a * 0.09;
  col += neb * uNebI;
  col *= 1.0 - f.g * 0.82 * clamp(uMilky * 1.3, 0.0, 1.0);
  col += vec3(0.012, 0.008, 0.006) * f.g * uMilky * f.r;
  col *= uBright * uReady;
  col *= 1.0 + (hash12(gl_FragCoord.xy) - 0.5) * 0.12;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`

export const STARS_VERT = `
attribute vec3 aColor;
attribute float aSize;
attribute float aPhase;
uniform mat3 uFromGalactic;
uniform float uTime;
uniform float uPixelRatio;
uniform float uBright;
varying vec3 vColor;
varying float vSize;
void main() {
  vec3 d = uFromGalactic * position;
  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * d, 1.0);
  gl_Position = vec4(p.xy, p.w * 0.999999, p.w);
  float tw = 0.8 + 0.2 * sin(uTime * (0.9 + aPhase * 2.6) + aPhase * 37.0) * sin(uTime * 0.37 + aPhase * 11.0);
  vColor = aColor * tw * uBright;
  vSize = aSize;
  gl_PointSize = aSize * uPixelRatio;
}
`

export const STARS_FRAG = `
varying vec3 vColor;
varying float vSize;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  float a = exp(-r2 * 5.5);
  if (vSize > 3.2) {
    float sx = exp(-abs(c.y) * vSize * 2.2) * (1.0 - abs(c.x));
    float sy = exp(-abs(c.x) * vSize * 2.2) * (1.0 - abs(c.y));
    a += (sx + sy) * 0.35;
  }
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor * a, 1.0);
}
`
