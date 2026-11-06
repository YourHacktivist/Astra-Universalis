import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { sampleOrbit } from '@/core/orbits'
import { mapOrbitDistance, parentScaleInfo } from '@/core/scale'
import type { Body, DisplaySettings, StarSystem } from '@/core/types'
import { useUIStore } from '@/store/uiStore'
import { runtime } from '../runtime'
import { ParentAnchor } from '../scene/anchors'

const ION = new THREE.Color('#8AB0FF')
const AURUM = new THREE.Color('#E9B96E')

const vertexShader = `
  attribute float aPhase;
  varying float vPhase;
  varying float vDepth;
  void main() {
    vPhase = aPhase;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const fragmentShader = `
  uniform vec3 uColor;
  uniform float uPhase;
  uniform float uDir;
  uniform float uOpacity;
  uniform float uTrail;
  varying float vPhase;
  void main() {
    float d = fract(uDir * (uPhase - vPhase));
    float trail = mix(1.0, 0.22, smoothstep(0.0, uTrail, d));
    float head = smoothstep(0.035, 0.0, d) * 0.6;
    gl_FragColor = vec4(uColor * (1.0 + head), uOpacity * (trail + head));
  }
`

function isMajor(b: Body) {
  return b.kind === 'planet' || b.kind === 'star' || b.kind === 'comet' || b.kind === 'barycenter' || b.kind === 'gate'
}

export const OrbitLines = memo(function OrbitLines({ system }: { system: StarSystem }) {
  const view = useUIStore((s) => s.view)
  const selectedId = useUIStore((s) => s.selectedId)
  const playerMode = useUIStore((s) => s.playerMode)

  const items = useMemo(() => {
    if (!view.orbits) return []
    const bodies = Object.values(system.bodies)
    return bodies.filter((b) => {
      if (!b.orbit || !b.orbit.show || b.orbit.fixed || b.orbit.a <= 0) return false
      if (!b.visible || (playerMode && !b.playerVisible)) return false
      if (view.orbitScope === 'major' && !isMajor(b)) return false
      if (view.orbitScope === 'selected' && b.id !== selectedId && b.parentId !== selectedId) return false
      return true
    })
  }, [system.bodies, view.orbits, view.orbitScope, selectedId, playerMode])

  return (
    <>
      {items.map((b) => (
        <OrbitLine
          key={b.id}
          body={b}
          parent={b.parentId ? system.bodies[b.parentId] ?? null : null}
          display={system.display}
          selected={b.id === selectedId}
        />
      ))}
    </>
  )
})

const OrbitLine = memo(function OrbitLine({
  body,
  parent,
  display,
  selected,
}: {
  body: Body
  parent: Body | null
  display: DisplaySettings
  selected: boolean
}) {
  const orbit = body.orbit!
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const hovered = useUIStore((s) => s.hoveredId === body.id)

  const { geometry, maxR } = useMemo(() => {
    const segments = orbit.e > 0.5 ? 720 : orbit.e > 0.2 ? 480 : 320
    const { points, phases } = sampleOrbit(orbit, segments)
    const info = parentScaleInfo(parent, display)
    const pos = new Float32Array((segments + 1) * 3)
    const ph = new Float32Array(segments + 1)
    let maxR = 0
    for (let k = 0; k <= segments; k++) {
      const j = k % segments
      const x = points[j * 3]
      const y = points[j * 3 + 1]
      const z = points[j * 3 + 2]
      const r = Math.hypot(x, y, z)
      const d = mapOrbitDistance(r, info, display)
      const s = r > 0 ? d / r : 0
      pos[k * 3] = x * s
      pos[k * 3 + 1] = y * s
      pos[k * 3 + 2] = z * s
      ph[k] = k === segments ? 1 : phases[j]
      maxR = Math.max(maxR, d)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1))
    g.computeBoundingSphere()
    return { geometry: g, maxR }
  }, [orbit, parent, display])

  const baseOpacity = body.kind === 'moon' || body.kind === 'ship' || body.kind === 'station' ? 0.32 : 0.5

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color() },
          uPhase: { value: 0 },
          uDir: { value: 1 },
          uOpacity: { value: baseOpacity },
          uTrail: { value: 0.9 },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [baseOpacity],
  )

  useEffect(() => {
    const c = new THREE.Color(body.color).lerp(new THREE.Color('#ffffff'), 0.25)
    if (selected) c.copy(AURUM)
    else if (hovered) c.lerp(ION, 0.6)
    material.uniforms.uColor.value.copy(c)
    material.uniforms.uDir.value = orbit.retrograde ? -1 : 1
  }, [material, body.color, selected, hovered, orbit.retrograde])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  const line = useMemo(() => new THREE.Line(geometry, material), [geometry, material])
  const tmp = useRef(new THREE.Vector3())

  useFrame(() => {
    const rt = runtime.bodies.get(body.id)
    if (!rt) return
    material.uniforms.uPhase.value = rt.phase
    const dist = Math.max(1e-4, camera.position.distanceTo(tmp.current.copy(rt.parentPos)))
    const px = (maxR / dist) * (size.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)))
    const fade = THREE.MathUtils.smoothstep(px, 6, 28)
    const boost = selected ? 2 : hovered ? 1.5 : 1
    material.uniforms.uOpacity.value = Math.min(1, baseOpacity * boost) * fade
    line.visible = fade > 0.01 && rt.visible
  })

  return (
    <ParentAnchor id={body.parentId}>
      <primitive object={line} />
    </ParentAnchor>
  )
})
