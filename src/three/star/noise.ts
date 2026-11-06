import { NOISE_GLSL } from '../shaders/common'

export const FAST_NOISE_GLSL = `
${NOISE_GLSL}

float fbm2(vec3 p) { return (snoise(p) * 0.5 + snoise(p * 2.03) * 0.25) / 0.75; }
float fbm3(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { s += a * snoise(p); p *= 2.03; a *= 0.5; }
  return s / 0.875;
}
float fbm4(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * snoise(p); p *= 2.03; a *= 0.5; }
  return s / 0.9375;
}
float fbm5(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * snoise(p); p *= 2.03; a *= 0.5; }
  return s / 0.96875;
}
float ridged4(vec3 p) {
  float s = 0.0, a = 0.5, prev = 1.0;
  for (int i = 0; i < 4; i++) {
    float n = 1.0 - abs(snoise(p));
    n *= n;
    s += n * a * prev;
    prev = n;
    p *= 2.03;
    a *= 0.5;
  }
  return s / 0.9375;
}

vec2 cellular2(vec3 P) {
  const float K = 0.142857142857;
  const float Ko = 0.428571428571;
  const float K2 = 0.020408163265306;
  const float Kz = 0.166666666667;
  const float Kzo = 0.416666666667;
  const float jitter = 0.8;
  vec3 Pi = mod(floor(P), 289.0);
  vec3 Pf = fract(P);
  vec4 Pfx = Pf.x + vec4(0.0, -1.0, 0.0, -1.0);
  vec4 Pfy = Pf.y + vec4(0.0, 0.0, -1.0, -1.0);
  vec4 p = permute(Pi.x + vec4(0.0, 1.0, 0.0, 1.0));
  p = permute(p + Pi.y + vec4(0.0, 0.0, 1.0, 1.0));
  vec4 p1 = permute(p + Pi.z);
  vec4 p2 = permute(p + Pi.z + vec4(1.0));
  vec4 ox1 = fract(p1 * K) - Ko;
  vec4 oy1 = mod(floor(p1 * K), 7.0) * K - Ko;
  vec4 oz1 = floor(p1 * K2) * Kz - Kzo;
  vec4 ox2 = fract(p2 * K) - Ko;
  vec4 oy2 = mod(floor(p2 * K), 7.0) * K - Ko;
  vec4 oz2 = floor(p2 * K2) * Kz - Kzo;
  vec4 dx1 = Pfx + jitter * ox1;
  vec4 dy1 = Pfy + jitter * oy1;
  vec4 dz1 = Pf.z + jitter * oz1;
  vec4 dx2 = Pfx + jitter * ox2;
  vec4 dy2 = Pfy + jitter * oy2;
  vec4 dz2 = Pf.z - 1.0 + jitter * oz2;
  vec4 d1 = dx1 * dx1 + dy1 * dy1 + dz1 * dz1;
  vec4 d2 = dx2 * dx2 + dy2 * dy2 + dz2 * dz2;
  vec4 d = min(d1, d2);
  d2 = max(d1, d2);
  d.xy = (d.x < d.y) ? d.xy : d.yx;
  d.xz = (d.x < d.z) ? d.xz : d.zx;
  d.xw = (d.x < d.w) ? d.xw : d.wx;
  d.yzw = min(d.yzw, d2.yzw);
  d.y = min(d.y, d.z);
  d.y = min(d.y, d.w);
  d.y = min(d.y, d2.x);
  return sqrt(d.xy);
}
`
