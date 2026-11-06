export const ROTATE_GLSL = `
mat3 rotAxis(vec3 axis, float a) {
  float s = sin(a);
  float c = cos(a);
  float oc = 1.0 - c;
  return mat3(
    oc * axis.x * axis.x + c,          oc * axis.x * axis.y + axis.z * s, oc * axis.z * axis.x - axis.y * s,
    oc * axis.x * axis.y - axis.z * s, oc * axis.y * axis.y + c,          oc * axis.y * axis.z + axis.x * s,
    oc * axis.z * axis.x + axis.y * s, oc * axis.y * axis.z - axis.x * s, oc * axis.z * axis.z + c
  );
}
`

export const ROCK_DETAIL_GLSL = `
vec2 rockDetail(vec3 p, vec3 rel, float size) {
  float px = length(fwidth(rel)) / max(size, 1e-9);
  float h = 0.0;
  float a = snoise(p * 0.9 + 3.7) * 0.12 + snoise(p * 2.3 + 9.1) * 0.06;
  float f = 3.0;
  float amp = 0.1;
  for (int i = 0; i < 5; i++) {
    float vis = 1.0 - smoothstep(0.3, 0.6, f * 3.0 * px);
    if (vis <= 0.0) break;
    float n = snoise(p * f + float(i) * 5.17);
    h += n * vis / f;
    a += n * vis * amp;
    amp *= 0.7;
    f *= 2.1;
  }
  return vec2(h * size * 0.08, a);
}

vec3 bumpRock(vec3 N, vec3 pos, float hgt) {
  vec3 dpdx = dFdx(pos);
  vec3 dpdy = dFdy(pos);
  float dhx = dFdx(hgt);
  float dhy = dFdy(hgt);
  vec3 r1 = cross(dpdy, N);
  vec3 r2 = cross(N, dpdx);
  float det = dot(dpdx, r1);
  if (abs(det) < 1e-24) return N;
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * N - grad);
}
`

export const ROCK_LIGHT_GLSL = `
vec3 rockLight(vec3 n, vec3 worldPos, vec3 viewDir) {
  vec3 light = vec3(uAmbient * 1.6);
  for (int i = 0; i < MAX_STAR_LIGHTS; i++) {
    if (i >= uStarCount) break;
    vec3 l = normalize(uStarPos[i] - worldPos);
    float d = dot(n, l);
    float diff = max(d, 0.0);
    float back = pow(max(dot(viewDir, l), 0.0), 6.0) * 0.25;
    light += uStarColor[i] * (diff * 1.05 + back * diff);
  }
  return light;
}
`
