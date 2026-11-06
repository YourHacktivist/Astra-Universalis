import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'
import * as THREE from 'three'

const GRADE_FRAG = `
uniform float uToe;
uniform float uContrast;
uniform float uSplit;
uniform float uSaturation;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0);
  c = max(c, 0.0);
  c = c * c / (c + uToe + 1e-5) * (1.0 + uToe);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec3 pivot = vec3(0.18);
  c = pivot * pow(max(c, vec3(0.0)) / pivot + 1e-6, vec3(uContrast));
  vec3 cool = vec3(0.92, 0.98, 1.08);
  vec3 warm = vec3(1.06, 1.0, 0.92);
  c *= mix(vec3(1.0), mix(cool, warm, smoothstep(0.05, 0.6, l)), uSplit);
  float l2 = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l2), c, uSaturation);
  outputColor = vec4(clamp(c, 0.0, 1.0), inputColor.a);
}
`

export class GradeEffect extends Effect {
  constructor({ immersive = false }: { immersive?: boolean } = {}) {
    super('GradeEffect', GRADE_FRAG, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ['uToe', new THREE.Uniform(immersive ? 0.02 : 0.012)],
        ['uContrast', new THREE.Uniform(immersive ? 1.1 : 1.05)],
        ['uSplit', new THREE.Uniform(immersive ? 1 : 0.55)],
        ['uSaturation', new THREE.Uniform(immersive ? 1.12 : 1.05)],
      ]),
    })
  }
}

const TERMINAL_FRAG = `
uniform vec3 uTint;
uniform vec3 uHot;
uniform float uCurvature;
uniform float uPixelRatio;
uniform float uTimeS;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void mainUv(inout vec2 uv) {
  vec2 c = uv * 2.0 - 1.0;
  vec2 k = c.yx * c.yx * uCurvature;
  c += c * k;
  uv = c * 0.5 + 0.5;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    outputColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  vec2 px = uv * resolution / uPixelRatio;
  float l = dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  l = pow(clamp(l, 0.0, 1.5), 0.78) * 1.2;
  vec3 col = uTint * l + uHot * smoothstep(0.65, 1.25, l) * 0.55;
  col += uTint * 0.01;

  float scan = 0.68 + 0.32 * pow(clamp(sin(px.y * 3.14159 / 1.5) * 0.5 + 0.5, 0.0, 1.0), 1.4);
  float grille = 0.92 + 0.08 * sin(px.x * 3.14159 * 0.66);
  col *= scan * grille;

  float roll = smoothstep(0.0, 0.06, fract(uv.y * 0.6 - uTimeS * 0.06)) * (1.0 - smoothstep(0.06, 0.14, fract(uv.y * 0.6 - uTimeS * 0.06)));
  col *= 1.0 + roll * 0.08;
  col *= 1.0 + 0.018 * sin(uTimeS * 52.0) + 0.012 * sin(uTimeS * 7.3);

  float n = hash12(px + fract(uTimeS * 13.7) * 311.0);
  col += uTint * (n - 0.5) * 0.04;

  vec2 c = uv * 2.0 - 1.0;
  float vig = 1.0 - smoothstep(0.55, 1.55, length(c * vec2(0.92, 1.0)));
  vec2 q = abs(c) - vec2(0.94);
  float corner = 1.0 - smoothstep(0.0, 0.05, length(max(q, 0.0)) - 0.02);
  col *= vig * corner;
  outputColor = vec4(col, inputColor.a);
}
`

export class TerminalEffect extends Effect {
  constructor() {
    super('TerminalEffect', TERMINAL_FRAG, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ['uTint', new THREE.Uniform(new THREE.Color(1.0, 0.55, 0.12))],
        ['uHot', new THREE.Uniform(new THREE.Color(1.0, 0.88, 0.62))],
        ['uCurvature', new THREE.Uniform(0.045)],
        ['uPixelRatio', new THREE.Uniform(1)],
        ['uTimeS', new THREE.Uniform(0)],
      ]),
    })
  }
  update(_renderer: THREE.WebGLRenderer, _input: THREE.WebGLRenderTarget, delta?: number) {
    const t = this.uniforms.get('uTimeS')!
    t.value = (t.value + (delta ?? 0.016)) % 1000
  }
}

const BLUEPRINT_FRAG = `
uniform float uPixelRatio;
uniform vec3 uPaper;
uniform vec3 uInk;

float lum(vec2 uv) {
  return dot(texture2D(inputBuffer, uv).rgb, vec3(0.2126, 0.7152, 0.0722));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 t = texelSize * max(1.0, uPixelRatio);
  float tl = lum(uv + vec2(-t.x, t.y));
  float tc = lum(uv + vec2(0.0, t.y));
  float tr = lum(uv + vec2(t.x, t.y));
  float ml = lum(uv + vec2(-t.x, 0.0));
  float mr = lum(uv + vec2(t.x, 0.0));
  float bl = lum(uv + vec2(-t.x, -t.y));
  float bc = lum(uv + vec2(0.0, -t.y));
  float br = lum(uv + vec2(t.x, -t.y));
  float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
  float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
  float edge = clamp(length(vec2(gx, gy)) * 2.2, 0.0, 1.0);
  float l = clamp(dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.5);

  vec3 col = uPaper;
  col += uInk * (pow(l, 0.85) * 0.55 + edge * 0.85);

  vec2 px = uv * resolution / uPixelRatio;
  vec2 f1 = abs(fract(px / 24.0 + 0.5) - 0.5) * 24.0;
  vec2 f2 = abs(fract(px / 120.0 + 0.5) - 0.5) * 120.0;
  float g1 = 1.0 - smoothstep(0.0, 0.9, min(f1.x, f1.y));
  float g2 = 1.0 - smoothstep(0.0, 1.1, min(f2.x, f2.y));
  col += uInk * (g1 * 0.035 + g2 * 0.075);

  vec2 c = uv * 2.0 - 1.0;
  col *= 1.0 - smoothstep(0.6, 1.7, length(c));
  outputColor = vec4(col, inputColor.a);
}
`

export class BlueprintEffect extends Effect {
  constructor() {
    super('BlueprintEffect', BLUEPRINT_FRAG, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, THREE.Uniform>([
        ['uPixelRatio', new THREE.Uniform(1)],
        ['uPaper', new THREE.Uniform(new THREE.Color(0.012, 0.05, 0.13))],
        ['uInk', new THREE.Uniform(new THREE.Color(0.62, 0.84, 1.0))],
      ]),
    })
  }
}
