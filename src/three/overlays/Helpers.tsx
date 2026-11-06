import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Body, StarSystem } from '@/core/types'
import { useUIStore } from '@/store/uiStore'
import { runtime } from '../runtime'
import { BodyAnchor } from '../scene/anchors'

const AURUM = new THREE.Color('#E9B96E')
const ION = new THREE.Color('#8AB0FF')

function focalLength(camera: THREE.PerspectiveCamera, height: number) {
  return height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))
}

const bracketFrag = `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uMode;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float a = 0.0;
    if (uMode < 0.5) {
      vec2 q = abs(p);
      float edge = step(0.9, max(q.x, q.y)) * step(max(q.x, q.y), 0.94);
      float corner = step(0.62, min(q.x, q.y));
      a = edge * corner;
      float ang = atan(p.y, p.x) + uTime * 0.35;
      float dash = step(0.5, fract(ang * 24.0 / 6.2831853));
      a += smoothstep(0.012, 0.0, abs(r - 0.76)) * dash * 0.55;
    } else {
      a = smoothstep(0.02, 0.0, abs(r - 0.8)) * 0.8;
    }
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a * uOpacity);
  }
`

const billboardVert = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float s = length(modelMatrix[0].xyz);
    mv.xy += position.xy * s;
    gl_Position = projectionMatrix * mv;
  }
`

function Bracket({ id, mode }: { id: string; mode: 0 | 1 }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const mesh = useRef<THREE.Mesh>(null!)
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: mode === 0 ? AURUM.clone() : ION.clone() },
          uTime: { value: 0 },
          uOpacity: { value: 1 },
          uMode: { value: mode },
        },
        vertexShader: billboardVert,
        fragmentShader: bracketFrag,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    [mode],
  )
  useEffect(() => () => material.dispose(), [material])
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useFrame((state) => {
    const rt = runtime.bodies.get(id)
    const m = mesh.current
    if (!rt || !m) return
    const ui = useUIStore.getState()
    m.visible = rt.visible && !ui.exporting && !ui.immersive
    m.position.copy(rt.pos)
    const dist = camera.position.distanceTo(tmp.copy(rt.pos))
    const minWorld = (mode === 0 ? 22 : 16) * (dist / focalLength(camera, size.height))
    const s = Math.max(rt.radius * (mode === 0 ? 1.7 : 1.45), minWorld)
    m.scale.setScalar(s)
    material.uniforms.uTime.value = state.clock.elapsedTime
  })

  return (
    <mesh ref={mesh} material={material} renderOrder={1000} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}

export function SelectionHUD() {
  const selectedId = useUIStore((s) => s.selectedId)
  const hoveredId = useUIStore((s) => s.hoveredId)
  return (
    <>
      {selectedId && <Bracket key={`s-${selectedId}`} id={selectedId} mode={0} />}
      {hoveredId && hoveredId !== selectedId && <Bracket key={`h-${hoveredId}`} id={hoveredId} mode={1} />}
    </>
  )
}

const glintVert = `
  attribute vec3 aColor;
  attribute float aRadius;
  uniform float uFocal;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float depth = max(-mv.z, 1e-4);
    float rpx = aRadius / depth * uFocal;
    vAlpha = 1.0 - smoothstep(1.5, 4.0, rpx);
    vColor = aColor;
    gl_PointSize = (aRadius > 0.0 ? 5.0 : 0.0) * uPixelRatio;
    gl_Position = projectionMatrix * mv;
  }
`

const glintFrag = `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r = length(c);
    float core = smoothstep(0.55, 0.0, r);
    float halo = smoothstep(1.0, 0.3, r) * 0.35;
    float a = (core + halo) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor * (0.9 + core), a);
  }
`

export const Glints = memo(function Glints({ system }: { system: StarSystem }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)

  const ids = useMemo(
    () =>
      Object.values(system.bodies)
        .filter((b) => b.kind !== 'star' && b.kind !== 'belt' && b.kind !== 'nebula' && b.kind !== 'barycenter')
        .map((b) => b.id),
    [system.bodies],
  )

  const { points, material } = useMemo(() => {
    const n = Math.max(1, ids.length)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    const color = new Float32Array(n * 3)
    const c = new THREE.Color()
    ids.forEach((id, i) => {
      c.set(system.bodies[id].color).lerp(new THREE.Color('#ffffff'), 0.2)
      color.set([c.r, c.g, c.b], i * 3)
    })
    g.setAttribute('aColor', new THREE.BufferAttribute(color, 3))
    g.setAttribute('aRadius', new THREE.BufferAttribute(new Float32Array(n), 1))
    const m = new THREE.ShaderMaterial({
      uniforms: { uFocal: { value: 1000 }, uPixelRatio: { value: 1 } },
      vertexShader: glintVert,
      fragmentShader: glintFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const p = new THREE.Points(g, m)
    p.frustumCulled = false
    return { points: p, material: m }
  }, [ids, system.bodies])

  useEffect(() => () => {
    points.geometry.dispose()
    material.dispose()
  }, [points, material])

  useFrame(() => {
    const pos = points.geometry.getAttribute('position') as THREE.BufferAttribute
    const rad = points.geometry.getAttribute('aRadius') as THREE.BufferAttribute
    for (let i = 0; i < ids.length; i++) {
      const rt = runtime.bodies.get(ids[i])
      if (!rt) continue
      pos.setXYZ(i, rt.pos.x, rt.pos.y, rt.pos.z)
      rad.setX(i, rt.visible ? Math.max(rt.radius, 1e-4) : 0)
    }
    pos.needsUpdate = true
    rad.needsUpdate = true
    material.uniforms.uFocal.value = focalLength(camera, size.height)
    material.uniforms.uPixelRatio.value = dpr
  })

  return <primitive object={points} />
})

function hasAxis(b: Body) {
  return b.kind === 'star' || b.kind === 'planet' || b.kind === 'moon'
}

export const Axes = memo(function Axes({ system, equators, axes }: { system: StarSystem; equators: boolean; axes: boolean }) {
  const playerMode = useUIStore((s) => s.playerMode)
  const list = useMemo(
    () => Object.values(system.bodies).filter((b) => hasAxis(b) && b.visible && (!playerMode || b.playerVisible)),
    [system.bodies, playerMode],
  )
  return (
    <>
      {list.map((b) => (
        <BodyAxis key={b.id} id={b.id} axes={axes} equators={equators} />
      ))}
    </>
  )
})

const axisMaterialNorth = new THREE.LineBasicMaterial({ color: AURUM, transparent: true, opacity: 0.85, depthWrite: false })
const axisMaterialSouth = new THREE.LineBasicMaterial({ color: ION, transparent: true, opacity: 0.7, depthWrite: false })
const equatorMaterial = new THREE.LineDashedMaterial({
  color: '#ffffff',
  transparent: true,
  opacity: 0.35,
  dashSize: 0.06,
  gapSize: 0.04,
  depthWrite: false,
})

function BodyAxis({ id, axes, equators }: { id: string; axes: boolean; equators: boolean }) {
  const group = useRef<THREE.Group>(null!)
  const { north, south, equator } = useMemo(() => {
    const ng = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0)])
    const sg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0)])
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)))
    }
    const eg = new THREE.BufferGeometry().setFromPoints(pts)
    const eq = new THREE.Line(eg, equatorMaterial.clone())
    eq.computeLineDistances()
    return { north: new THREE.Line(ng, axisMaterialNorth), south: new THREE.Line(sg, axisMaterialSouth), equator: eq }
  }, [])

  useEffect(
    () => () => {
      north.geometry.dispose()
      south.geometry.dispose()
      equator.geometry.dispose()
      ;(equator.material as THREE.Material).dispose()
    },
    [north, south, equator],
  )

  useFrame(() => {
    const rt = runtime.bodies.get(id)
    const g = group.current
    if (!rt || !g) return
    g.quaternion.copy(rt.tilt)
    const r = Math.max(rt.radius, 0.01)
    north.scale.setScalar(r * 1.9)
    south.scale.setScalar(r * 1.9)
    equator.scale.setScalar(r * 1.04)
    const m = equator.material as THREE.LineDashedMaterial
    m.dashSize = 0.05
    m.gapSize = 0.035
    m.scale = 1
  })

  return (
    <BodyAnchor id={id}>
      <group ref={group}>
        {axes && <primitive object={north} />}
        {axes && <primitive object={south} />}
        {equators && <primitive object={equator} />}
      </group>
    </BodyAnchor>
  )
}

export const BarycenterMarkers = memo(function BarycenterMarkers({ system }: { system: StarSystem }) {
  const ids = useMemo(
    () =>
      Object.values(system.bodies)
        .filter((b) => b.kind === 'barycenter' && b.props.showMarker)
        .map((b) => b.id),
    [system.bodies],
  )
  return (
    <>
      {ids.map((id) => (
        <BodyAnchor key={id} id={id}>
          <BaryCross />
        </BodyAnchor>
      ))}
    </>
  )
})

function BaryCross() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const ref = useRef<THREE.LineSegments>(null!)
  const geom = useMemo(
    () =>
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-1, 0, 0), new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, -0.6, 0), new THREE.Vector3(0, 0.6, 0),
      ]),
    [],
  )
  const tmp = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    if (!ref.current) return
    ref.current.getWorldPosition(tmp)
    const d = camera.position.distanceTo(tmp)
    ref.current.scale.setScalar((10 * d) / focalLength(camera, size.height))
  })
  return (
    <lineSegments ref={ref} geometry={geom}>
      <lineBasicMaterial color="#9AA0B2" transparent opacity={0.6} depthWrite={false} />
    </lineSegments>
  )
}
