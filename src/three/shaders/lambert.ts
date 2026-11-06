import * as THREE from 'three'
import { lightUniforms } from '../runtime'
import { LIGHTS_GLSL } from './common'

export function createStarLitMaterial(opts: { color?: THREE.ColorRepresentation; emissive?: THREE.ColorRepresentation; emissiveIntensity?: number } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...lightUniforms,
      uColor: { value: new THREE.Color(opts.color ?? '#888888') },
      uEmissive: { value: new THREE.Color(opts.emissive ?? '#000000') },
      uEmissiveIntensity: { value: opts.emissiveIntensity ?? 0 },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      ${LIGHTS_GLSL}
      uniform vec3 uColor;
      uniform vec3 uEmissive;
      uniform float uEmissiveIntensity;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        vec3 n = normalize(vNormal);
        vec3 light = vec3(uAmbient);
        for (int i = 0; i < MAX_STAR_LIGHTS; i++) {
          if (i >= uStarCount) break;
          vec3 l = normalize(uStarPos[i] - vWorldPos);
          light += uStarColor[i] * max(dot(n, l), 0.0);
        }
        vec3 col = uColor * light + uEmissive * uEmissiveIntensity;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
}
