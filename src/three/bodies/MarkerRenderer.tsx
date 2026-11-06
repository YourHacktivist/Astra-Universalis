import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { bodyVisualRadius } from '@/core/scale'
import { useUIStore } from '@/store/uiStore'
import { runtime, timeUniforms } from '../runtime'
import { BodyAnchor } from '../scene/anchors'
import { getMarkerAtlas, makeCodeTexture, MARKER_ICON_INDEX } from '../small/markerIcons'
import type { BodyRendererProps } from './types'

const billboardVert = `
uniform vec2 uOffset;
uniform vec2 uAspect;
varying vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float s = length(modelMatrix[0].xyz);
  mv.xy += (position.xy * uAspect + uOffset) * s;
  gl_Position = projectionMatrix * mv;
}
`

const markerFrag = `
uniform sampler2D uAtlas;
uniform float uIcon;
uniform vec3 uColor;
uniform float uTime;
uniform float uPulse;
uniform float uSeed;
varying vec2 vUv;
float h11(float p) { return fract(sin(p * 127.1 + uSeed) * 43758.5453); }
void main() {
  vec2 p = vUv;
  float r = length(p);
  float ang = atan(p.y, p.x);

  vec2 iuv = p / 0.56 * 0.5 + 0.5;
  float icon = 0.0;
  if (iuv.x > 0.0 && iuv.x < 1.0 && iuv.y > 0.0 && iuv.y < 1.0) {
    vec2 cell = vec2(mod(uIcon, 3.0), 2.0 - floor(uIcon / 3.0));
    icon = texture2D(uAtlas, (cell + iuv) / 3.0).a;
  }

  float seg = fract((ang + uTime * 0.25) / 6.2831853 * 4.0);
  float ring = smoothstep(0.022, 0.0, abs(r - 0.82)) * step(0.14, abs(seg - 0.5) * 2.0);
  float ticks = smoothstep(0.02, 0.0, abs(r - 0.92)) * step(0.94, fract(ang / 6.2831853 * 24.0));
  float disc = smoothstep(0.74, 0.5, r) * 0.16;
  float t = fract(uTime * 0.55 + uSeed);
  float pd = (r - (0.55 + t * 0.45)) * 16.0;
  float pulse = exp(-pd * pd) * (1.0 - t) * uPulse;

  float scan = 0.82 + 0.18 * sin(gl_FragCoord.y * 1.6 + uTime * 5.0);
  float flicker = 0.9 + 0.1 * step(0.93, h11(floor(uTime * 12.0)));
  float a = (icon * 1.1 + ring * 0.85 + ticks * 0.5 + pulse * 0.7) * scan * flicker + disc;
  if (a < 0.01 || r > 1.0) discard;
  vec3 col = uColor * (0.8 + icon * 0.9 + pulse * 0.4);
  gl_FragColor = vec4(col, min(a, 1.0));
}
`

const codeFrag = `
uniform sampler2D uMap;
uniform vec3 uColor;
uniform float uTime;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(uMap, vUv * 0.5 + 0.5);
  float scan = 0.8 + 0.2 * sin(gl_FragCoord.y * 1.6 + uTime * 5.0);
  float a = t.a * scan;
  if (a < 0.02) discard;
  gl_FragColor = vec4(uColor * 1.2, a);
}
`

const pinVert = `
attribute float aD;
varying float vD;
void main() {
  vD = aD;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const pinFrag = `
uniform vec3 uColor;
uniform float uLen;
uniform float uDash;
uniform float uTime;
varying float vD;
void main() {
  float d = vD * uLen;
  float dash = step(0.5, fract(d / uDash - uTime * 0.4));
  float fade = mix(1.0, 0.25, vD);
  gl_FragColor = vec4(uColor, dash * fade * 0.55);
}
`

export const MarkerRenderer = memo(function MarkerRenderer({ body, display }: BodyRendererProps<'marker'>) {
  const p = body.props
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const radius = bodyVisualRadius(body, display)
  const billboard = useRef<THREE.Group>(null!)

  const mats = useMemo(() => {
    const color = new THREE.Color(body.color).multiplyScalar(1.25)
    const marker = new THREE.ShaderMaterial({
      uniforms: {
        uAtlas: { value: getMarkerAtlas() },
        uIcon: { value: MARKER_ICON_INDEX[p.markerType] ?? 0 },
        uColor: { value: color },
        uTime: timeUniforms.uTime,
        uPulse: { value: p.pulse ? 1 : 0 },
        uSeed: { value: (body.seed % 1000) / 1000 },
        uOffset: { value: new THREE.Vector2(0, 0) },
        uAspect: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: billboardVert,
      fragmentShader: markerFrag,
      transparent: true,
      depthWrite: false,
    })
    const code = p.code
      ? new THREE.ShaderMaterial({
          uniforms: {
            uMap: { value: makeCodeTexture(p.code) },
            uColor: { value: color },
            uTime: timeUniforms.uTime,
            uOffset: { value: new THREE.Vector2(0, -1.3) },
            uAspect: { value: new THREE.Vector2(1.3, 0.325) },
          },
          vertexShader: billboardVert,
          fragmentShader: codeFrag,
          transparent: true,
          depthWrite: false,
        })
      : null
    const pin = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: color }, uLen: { value: 1 }, uDash: { value: 0.05 }, uTime: timeUniforms.uTime },
      vertexShader: pinVert,
      fragmentShader: pinFrag,
      transparent: true,
      depthWrite: false,
    })
    return { marker, code, pin }
  }, [body.color, p.markerType, p.pulse, p.code, body.seed])

  const pin = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    g.setAttribute('aD', new THREE.BufferAttribute(new Float32Array([0, 1]), 1))
    const line = new THREE.Line(g, mats.pin)
    line.frustumCulled = false
    return line
  }, [mats.pin])

  const base = useMemo(() => {
    const g = new THREE.RingGeometry(0.9, 1, 40)
    g.rotateX(-Math.PI / 2)
    const m = new THREE.MeshBasicMaterial({ color: mats.pin.uniforms.uColor.value, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide })
    return new THREE.Mesh(g, m)
  }, [mats.pin])

  useEffect(
    () => () => {
      mats.marker.dispose()
      if (mats.code) {
        ;(mats.code.uniforms.uMap.value as THREE.Texture).dispose()
        mats.code.dispose()
      }
      mats.pin.dispose()
    },
    [mats],
  )
  useEffect(() => () => pin.geometry.dispose(), [pin])
  useEffect(
    () => () => {
      base.geometry.dispose()
      ;(base.material as THREE.Material).dispose()
    },
    [base],
  )

  useFrame(() => {
    const rt = runtime.bodies.get(body.id)
    const g = billboard.current
    if (!rt || !g) return
    const focal = size.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))
    const dist = camera.position.distanceTo(rt.pos)
    const exporting = useUIStore.getState().exporting
    const px = (exporting ? 26 : 22) * p.size
    const s = Math.max(radius * 1.2, (px * dist) / focal)
    g.scale.setScalar(s)

    const dy = rt.parentPos.y - rt.pos.y
    const attr = pin.geometry.getAttribute('position') as THREE.BufferAttribute
    attr.setXYZ(0, 0, -s * 0.85 * Math.sign(-dy || 1), 0)
    attr.setXYZ(1, 0, dy, 0)
    attr.needsUpdate = true
    const len = Math.abs(dy)
    mats.pin.uniforms.uLen.value = len
    mats.pin.uniforms.uDash.value = Math.max(1e-4, (6 * dist) / focal)
    const showPin = len > s * 1.5
    pin.visible = showPin
    base.visible = showPin
    base.position.set(0, dy, 0)
    base.scale.setScalar(s * 0.35)
  })

  return (
    <BodyAnchor id={body.id}>
      <group ref={billboard}>
        <mesh material={mats.marker} renderOrder={20} frustumCulled={false}>
          <planeGeometry args={[2, 2]} />
        </mesh>
        {mats.code && (
          <mesh material={mats.code} renderOrder={20} frustumCulled={false}>
            <planeGeometry args={[2, 2]} />
          </mesh>
        )}
      </group>
      <primitive object={pin} />
      <primitive object={base} />
    </BodyAnchor>
  )
})
