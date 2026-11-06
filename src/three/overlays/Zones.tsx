import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { totalLuminosity } from '@/core/hierarchy'
import { frostLine, habitableZone } from '@/core/physics'
import { bodyClearanceRadius, mapStellarDistance } from '@/core/scale'
import type { Body, StarSystem } from '@/core/types'
import { num } from '@/lib/format'
import { useUIStore } from '@/store/uiStore'
import { ParentAnchor } from '../scene/anchors'
import { registerLabel, unregisterLabel, LABEL_PRIORITY } from '../scene/labels'

function luminousCentres(system: StarSystem): Body[] {
  const hosts = new Set<string>()
  for (const b of Object.values(system.bodies)) {
    if ((b.kind === 'planet' || b.kind === 'belt' || b.kind === 'comet') && b.parentId) hosts.add(b.parentId)
  }
  return Object.values(system.bodies).filter(
    (b) => (b.kind === 'star' || b.kind === 'barycenter') && (hosts.has(b.id) || b.parentId === null),
  )
}

const hzVert = `
  varying vec2 vPos;
  void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const hzFrag = `
  uniform vec3 uColor;
  uniform float uInner;
  uniform float uOuter;
  uniform float uOpacity;
  varying vec2 vPos;
  void main() {
    float r = length(vPos);
    float w = uOuter - uInner;
    float t = (r - uInner) / w;
    float band = smoothstep(0.0, 0.18, t) * smoothstep(1.0, 0.82, t);
    float edge = smoothstep(0.012, 0.0, abs(t)) + smoothstep(0.012, 0.0, abs(t - 1.0));
    float ang = atan(vPos.y, vPos.x);
    float hatch = 0.75 + 0.25 * step(0.5, fract(ang * 90.0 / 6.2831853));
    float a = (band * 0.16 * hatch + edge * 0.35) * uOpacity;
    if (a < 0.002) discard;
    gl_FragColor = vec4(uColor, a);
  }
`

const HabitableZone = memo(function HabitableZone({ centre, system }: { centre: Body; system: StarSystem }) {
  const lum = totalLuminosity(system.bodies, centre)
  const offset = bodyClearanceRadius(centre, system.display)
  const { inner, outer } = habitableZone(lum)
  const ri = mapStellarDistance(inner, offset, system.display)
  const ro = mapStellarDistance(outer, offset, system.display)
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color('#7EE2A8') },
          uInner: { value: ri },
          uOuter: { value: ro },
          uOpacity: { value: 1 },
        },
        vertexShader: hzVert,
        fragmentShader: hzFrag,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [ri, ro],
  )
  useEffect(() => () => material.dispose(), [material])
  if (lum <= 0 || !(ro > ri)) return null
  return (
    <ParentAnchor id={centre.id}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={material} renderOrder={-1}>
        <ringGeometry args={[ri * 0.98, ro * 1.02, 256, 1]} />
      </mesh>
      <ZoneLabel id={`hz-${centre.id}`} anchorId={centre.id} radius={ro} text="Zone habitable" color="#7EE2A8" />
    </ParentAnchor>
  )
})

const FrostLine = memo(function FrostLine({ centre, system }: { centre: Body; system: StarSystem }) {
  const lum = totalLuminosity(system.bodies, centre)
  const offset = bodyClearanceRadius(centre, system.display)
  const r = mapStellarDistance(frostLine(lum), offset, system.display)
  const line = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 360; i++) {
      const a = (i / 360) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r))
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts)
    const m = new THREE.LineDashedMaterial({
      color: '#9fdcff',
      dashSize: r * 0.012,
      gapSize: r * 0.01,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
    const l = new THREE.Line(g, m)
    l.computeLineDistances()
    return l
  }, [r])
  useEffect(
    () => () => {
      line.geometry.dispose()
      ;(line.material as THREE.Material).dispose()
    },
    [line],
  )
  if (lum <= 0) return null
  return (
    <ParentAnchor id={centre.id}>
      <primitive object={line} />
      <ZoneLabel id={`fl-${centre.id}`} anchorId={centre.id} radius={r} text="Ligne des glaces" color="#9fdcff" angle={0.5} />
    </ParentAnchor>
  )
})

const GRID_AU = [0.1, 0.25, 0.5, 1, 2, 3, 5, 10, 20, 30, 50, 100, 200, 500, 1000]

const gridVert = `
  varying float vR;
  void main() {
    vR = length(position.xz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const gridFrag = `
  uniform vec3 uColor;
  uniform float uMax;
  uniform float uOpacity;
  varying float vR;
  void main() {
    float a = uOpacity * (1.0 - smoothstep(uMax * 0.7, uMax, vR));
    gl_FragColor = vec4(uColor, a);
  }
`

const PolarGrid = memo(function PolarGrid({ system }: { system: StarSystem }) {
  const { display } = system
  const root = useMemo(() => Object.values(system.bodies).find((b) => b.parentId === null && (b.kind === 'star' || b.kind === 'barycenter')), [system.bodies])
  const offset = root ? bodyClearanceRadius(root, display) : 0

  const maxAU = useMemo(() => {
    let m = 1
    for (const b of Object.values(system.bodies)) {
      if (b.orbit && !b.orbit.fixed && b.parentId === root?.id) m = Math.max(m, b.orbit.a * (1 + b.orbit.e))
      if (b.kind === 'belt') m = Math.max(m, b.props.outer)
    }
    return m * 1.25
  }, [system.bodies, root])

  const rings = useMemo(() => GRID_AU.filter((au) => au <= maxAU), [maxAU])

  const { lines, material, maxR } = useMemo(() => {
    const verts: number[] = []
    const maxR = mapStellarDistance(maxAU, offset, display)
    for (const au of rings) {
      const r = mapStellarDistance(au, offset, display)
      const seg = 256
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2
        const a1 = ((i + 1) / seg) * Math.PI * 2
        verts.push(Math.cos(a0) * r, 0, Math.sin(a0) * r, Math.cos(a1) * r, 0, Math.sin(a1) * r)
      }
    }
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2
      verts.push(Math.cos(a) * offset, 0, Math.sin(a) * offset, Math.cos(a) * maxR, 0, Math.sin(a) * maxR)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    const m = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color('#8AB0FF') }, uMax: { value: maxR }, uOpacity: { value: 0.16 } },
      vertexShader: gridVert,
      fragmentShader: gridFrag,
      transparent: true,
      depthWrite: false,
    })
    return { lines: new THREE.LineSegments(g, m), material: m, maxR }
  }, [rings, offset, display, maxAU])

  useEffect(
    () => () => {
      lines.geometry.dispose()
      material.dispose()
    },
    [lines, material],
  )

  return (
    <ParentAnchor id={root?.id ?? null}>
      <primitive object={lines} />
      {rings.map((au) => {
        const r = mapStellarDistance(au, offset, display)
        if (r > maxR * 0.85) return null
        return <ZoneLabel key={au} id={`grid-${au}`} anchorId={root?.id ?? null} radius={r} text={`${num(au)} UA`} color="#8AB0FF" angle={-Math.PI / 2 + 0.02} grid />
      })}
    </ParentAnchor>
  )
})

function ZoneLabel({
  id,
  anchorId,
  radius,
  text,
  color,
  angle = 0.9,
  grid = false,
}: {
  id: string
  anchorId: string | null
  radius: number
  text: string
  color: string
  angle?: number
  grid?: boolean
}) {
  const el = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    const layer = document.getElementById('astra-zone-labels')
    if (!layer) return
    const div = document.createElement('div')
    div.className = grid ? 'astra-zone-label astra-zone-label--grid' : 'astra-zone-label'
    div.textContent = text
    div.style.setProperty('--label-color', color)
    div.style.opacity = '0'
    layer.appendChild(div)
    el.current = div
    registerLabel({
      id,
      el: div,
      kind: 'grid',
      priority: grid ? LABEL_PRIORITY.grid : LABEL_PRIORITY.grid + 10,
      point: new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius),
      anchorId,
      width: div.offsetWidth,
      height: div.offsetHeight,
    })
    return () => {
      unregisterLabel(id)
      div.remove()
    }
  }, [id, anchorId, radius, text, color, angle, grid])
  return null
}

export const Zones = memo(function Zones({ system }: { system: StarSystem }) {
  const view = useUIStore((s) => s.view)
  const centres = useMemo(() => luminousCentres(system), [system])
  return (
    <>
      {view.grid && <PolarGrid system={system} />}
      {view.habitableZone && centres.map((c) => <HabitableZone key={c.id} centre={c} system={system} />)}
      {view.frostLine && centres.map((c) => <FrostLine key={c.id} centre={c} system={system} />)}
    </>
  )
})
