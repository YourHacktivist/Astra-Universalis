import { useEffect, useLayoutEffect, useMemo, useRef, type DependencyList, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { StarBody, StarProps } from '@/core/types'
import type { Quality } from '@/store/uiStore'
import { runtime, timeUniforms } from '../runtime'
import { BodyAnchor, SpinGroup, TiltFrame } from '../scene/anchors'
import { focalPx, pointGlowPx, seedFloat, starPalette, surfaceIntensity, surfaceMode } from './common'
import { Corona, LensStreak } from './Glow'
import {
  BEAM_FRAG,
  BEAM_VERT,
  BILLBOARD_VERT,
  DISK_FRAG,
  DISK_VERT,
  FIELD_FRAG,
  FIELD_VERT,
  LENS_FRAG,
  SURFACE_FRAG,
  SURFACE_VERT,
} from './shaders'

const SEGMENTS: Record<Quality, [number, number]> = { low: [48, 24], medium: [64, 32], high: [96, 48], ultra: [128, 64] }
const tmpV = new THREE.Vector3()
const tmpN = new THREE.Vector3()
const tmpQ = new THREE.Quaternion()
const UP = new THREE.Vector3(0, 1, 0)

function useAsyncCompile(ref: RefObject<THREE.Object3D | null>, deps: DependencyList) {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  useLayoutEffect(() => {
    const o = ref.current
    if (!o) return
    let alive = true
    o.visible = false
    const show = () => {
      if (alive) o.visible = true
    }
    gl.compileAsync(o, camera, scene).then(show, show)
    return () => {
      alive = false
      o.visible = true
    }
  }, deps)
}

function Photosphere({ body, radius, quality }: { body: StarBody; radius: number; quality: Quality }) {
  const p = body.props
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const palette = useMemo(() => starPalette(p), [p])
  const baseIntensity = surfaceIntensity(p)
  const [ws, hs] = SEGMENTS[quality]

  const geometry = useMemo(() => new THREE.SphereGeometry(radius, ws, hs), [radius, ws, hs])
  const mode = surfaceMode(p)
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        defines: { MODE: mode },
        uniforms: {
          uTime: timeUniforms.uTime,
          uColor: { value: new THREE.Color() },
          uColorLimb: { value: new THREE.Color() },
          uColorHot: { value: new THREE.Color() },
          uIntensity: { value: 1 },
          uGran: { value: 1 },
          uActivity: { value: 0.5 },
          uSpots: { value: 0.1 },
          uSeed: { value: 0 },
          uDetail: { value: 1 },
        },
        vertexShader: SURFACE_VERT,
        fragmentShader: SURFACE_FRAG,
        toneMapped: false,
      }),
    [mode],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useEffect(() => {
    const u = material.uniforms
    u.uColor.value.copy(palette.base)
    u.uColorLimb.value.copy(palette.limb)
    u.uColorHot.value.copy(palette.hot)
    u.uGran.value = p.granulation
    u.uActivity.value = p.activity
    u.uSpots.value = p.spots
    u.uSeed.value = seedFloat(body.seed)
  }, [material, palette, p, body.seed])

  useFrame(() => {
    const rt = runtime.bodies.get(body.id)
    if (!rt) return
    const dist = Math.max(1e-5, camera.position.distanceTo(rt.pos))
    const diskPx = (radius / dist) * focalPx(camera, size.height)
    const u = material.uniforms
    u.uDetail.value = THREE.MathUtils.smoothstep(diskPx, 3, 40)
    u.uIntensity.value = baseIntensity * (1 - 0.5 * THREE.MathUtils.smoothstep(diskPx, 25, 320))
  })

  return <mesh geometry={geometry} material={material} />
}

export function StellarStar({ body, radius, quality }: { body: StarBody; radius: number; quality: Quality }) {
  const p = body.props
  const palette = useMemo(() => starPalette(p), [p])
  const glowIntensity = glowIntensityFor(p)
  const root = useRef<THREE.Group>(null)
  useAsyncCompile(root, [p.starClass, quality])
  return (
    <BodyAnchor id={body.id}>
      <group ref={root}>
      <TiltFrame id={body.id}>
        <SpinGroup id={body.id}>
          <Photosphere body={body} radius={radius} quality={quality} />
        </SpinGroup>
      </TiltFrame>
      <Corona
        id={body.id}
        radius={radius}
        color={palette.glow}
        intensity={glowIntensity}
        corona={p.corona}
        rays={p.rays}
        pointPx={pointGlowPx(p)}
        seed={seedFloat(body.seed)}
        reach={p.starClass === 'WD' ? 2.2 : p.starClass === 'BD' ? 0.7 : 1}
      />
      {p.flare && p.starClass !== 'BD' && <LensStreak id={body.id} radius={radius} color={palette.glow} intensity={0.55 * glowIntensity} />}
      </group>
    </BodyAnchor>
  )
}

function glowIntensityFor(p: StarProps) {
  switch (p.starClass) {
    case 'BD':
      return 0.55
    case 'WD':
      return 2.2
    case 'NS':
    case 'PSR':
      return 2.8
    default:
      return THREE.MathUtils.clamp(1.1 + 0.18 * Math.log10(Math.max(p.luminosity, 1e-3)), 0.75, 2)
  }
}

function fieldLinesGeometry(radius: number) {
  const pos: number[] = []
  const ts: number[] = []
  const shells = [2.6, 4.2, 6.5]
  const azimuths = 5
  for (const L of shells) {
    for (let k = 0; k < azimuths; k++) {
      const phi = (k / azimuths) * Math.PI * 2 + L
      const th0 = Math.asin(Math.sqrt(1 / L))
      const steps = 64
      let prev: [number, number, number] | null = null
      let prevT = 0
      for (let i = 0; i <= steps; i++) {
        const th = th0 + (Math.PI - 2 * th0) * (i / steps)
        const r = L * Math.sin(th) ** 2 * radius
        const pt: [number, number, number] = [r * Math.sin(th) * Math.cos(phi), r * Math.cos(th), r * Math.sin(th) * Math.sin(phi)]
        const t = i / steps
        if (prev) {
          pos.push(...prev, ...pt)
          ts.push(prevT, t)
        }
        prev = pt
        prevT = t
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('aT', new THREE.Float32BufferAttribute(ts, 1))
  return g
}

function beamGeometry(radius: number, length: number) {
  const L = radius * length
  const g = new THREE.CylinderGeometry(radius * length * 0.09, radius * 0.35, L, 40, 12, true)
  g.translate(0, L / 2 + radius * 0.6, 0)
  return g
}

export function NeutronStar({ body, radius, quality }: { body: StarBody; radius: number; quality: Quality }) {
  const p = body.props
  const pulsar = p.starClass === 'PSR'
  const camera = useThree((s) => s.camera)
  const palette = useMemo(() => starPalette(p), [p])
  const magnet = useRef<THREE.Group>(null!)
  const spin = useRef<THREE.Group>(null!)
  const flash = useRef(0)

  const beamColor = useMemo(() => new THREE.Color(0.55, 0.7, 1.0).lerp(palette.glow, 0.25), [palette])
  const beams = useMemo(() => {
    if (!pulsar) return null
    const geometry = beamGeometry(radius, Math.max(2, p.beamLength))
    const material = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: beamColor }, uIntensity: { value: 0.85 }, uTime: timeUniforms.uTime },
      vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    })
    return { geometry, material }
  }, [pulsar, radius, p.beamLength, beamColor])
  useEffect(() => () => {
    beams?.geometry.dispose()
    beams?.material.dispose()
  }, [beams])

  const field = useMemo(() => {
    const geometry = fieldLinesGeometry(radius)
    const material = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0.45, 0.55, 1.0) }, uIntensity: { value: 0.2 }, uTime: timeUniforms.uTime },
      vertexShader: FIELD_VERT,
      fragmentShader: FIELD_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    return new THREE.LineSegments(geometry, material)
  }, [radius])
  useEffect(
    () => () => {
      field.geometry.dispose()
      ;(field.material as THREE.Material).dispose()
    },
    [field],
  )

  useFrame((state) => {
    if (spin.current) spin.current.rotation.y = state.clock.elapsedTime * p.pulseRate * Math.PI * 2
    if (!pulsar || !magnet.current) return
    magnet.current.getWorldQuaternion(tmpQ)
    tmpN.copy(UP).applyQuaternion(tmpQ)
    magnet.current.getWorldPosition(tmpV)
    const toCam = tmpV.subVectors(camera.position, tmpV).normalize()
    const a = Math.abs(tmpN.dot(toCam))
    flash.current = Math.pow(a, 28) * 5
  })

  const root = useRef<THREE.Group>(null)
  useAsyncCompile(root, [pulsar, quality])
  return (
    <BodyAnchor id={body.id}>
      <group ref={root}>
      <TiltFrame id={body.id}>
        <SpinGroup id={body.id}>
          <Photosphere body={body} radius={radius} quality={quality} />
        </SpinGroup>
        <group ref={spin}>
          <group ref={magnet} rotation={[0, 0, THREE.MathUtils.degToRad(p.beamAngle)]}>
            <primitive object={field} />
            {beams && (
              <>
                <mesh geometry={beams.geometry} material={beams.material} frustumCulled={false} />
                <mesh geometry={beams.geometry} material={beams.material} rotation={[Math.PI, 0, 0]} frustumCulled={false} />
              </>
            )}
          </group>
        </group>
      </TiltFrame>
      <Corona
        id={body.id}
        radius={radius}
        color={palette.glow}
        intensity={glowIntensityFor(p)}
        corona={p.corona}
        rays={p.rays}
        pointPx={pointGlowPx(p)}
        seed={seedFloat(body.seed)}
        boost={flash}
        reach={3}
      />
      {p.flare && <LensStreak id={body.id} radius={radius} color={palette.glow} intensity={1.2} />}
      </group>
    </BodyAnchor>
  )
}

const lensQuad = new THREE.PlaneGeometry(1, 1)

export function BlackHole({ body, radius, quality }: { body: StarBody; radius: number; quality: Quality }) {
  const p = body.props
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const disk = useRef<THREE.Mesh>(null!)
  const lens = useRef<THREE.Mesh>(null!)
  const inner = Math.max(1.2, p.diskInner)
  const outer = Math.max(inner + 0.5, p.diskOuter)
  const [ws, hs] = SEGMENTS[quality]

  const colors = useMemo(
    () => ({ inner: new THREE.Color(p.diskColorInner), outer: new THREE.Color(p.diskColorOuter) }),
    [p.diskColorInner, p.diskColorOuter],
  )

  const diskCommon = useMemo(
    () => ({
      uInnerColor: { value: new THREE.Color() },
      uOuterColor: { value: new THREE.Color() },
      uInner: { value: inner },
      uOuter: { value: outer },
      uTime: timeUniforms.uTime,
      uSeed: { value: seedFloat(body.seed) },
      uBrightness: { value: 1 },
    }),
    [inner, outer, body.seed],
  )

  const horizonGeo = useMemo(() => new THREE.SphereGeometry(radius, ws, hs), [radius, ws, hs])
  const diskGeo = useMemo(() => new THREE.RingGeometry(radius * inner, radius * outer, 256, 6), [radius, inner, outer])

  const mats = useMemo(() => {
    const horizon = new THREE.MeshBasicMaterial({ color: 0x000000 })
    const diskMat = new THREE.ShaderMaterial({
      uniforms: {
        ...diskCommon,
        uHorizon: { value: radius },
        uCenter: { value: new THREE.Vector3() },
        uNormal: { value: new THREE.Vector3(0, 1, 0) },
      },
      vertexShader: DISK_VERT,
      fragmentShader: DISK_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    })
    const lensMat = new THREE.ShaderMaterial({
      uniforms: {
        ...diskCommon,
        uHalfSize: { value: new THREE.Vector2(1, 1) },
        uLift: { value: 0 },
        uSizeH: { value: outer * 0.75 },
        uEdgeOn: { value: 1 },
        uUpScreen: { value: new THREE.Vector2(0, 1) },
      },
      vertexShader: BILLBOARD_VERT,
      fragmentShader: LENS_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    return { horizon, disk: diskMat, lens: lensMat }
  }, [diskCommon, radius, outer])

  useEffect(() => () => {
    mats.horizon.dispose()
    mats.disk.dispose()
    mats.lens.dispose()
  }, [mats])
  useEffect(() => () => horizonGeo.dispose(), [horizonGeo])
  useEffect(() => () => diskGeo.dispose(), [diskGeo])

  useEffect(() => {
    diskCommon.uInnerColor.value.copy(colors.inner)
    diskCommon.uOuterColor.value.copy(colors.outer)
    diskCommon.uBrightness.value = 0.85 * p.diskBrightness
  }, [diskCommon, colors, p.diskBrightness])

  useFrame(() => {
    const rt = runtime.bodies.get(body.id)
    if (!rt || !disk.current) return
    tmpN.copy(UP).applyQuaternion(rt.tilt)
    mats.disk.uniforms.uCenter.value.copy(rt.pos)
    mats.disk.uniforms.uNormal.value.copy(tmpN)
    const toCam = tmpV.subVectors(camera.position, rt.pos).normalize()
    const edgeOn = 1 - Math.abs(toCam.dot(tmpN))
    const lu = mats.lens.uniforms
    lu.uEdgeOn.value = Math.pow(edgeOn, 0.8)
    tmpV.copy(tmpN).transformDirection(camera.matrixWorldInverse)
    const l = Math.hypot(tmpV.x, tmpV.y)
    if (l > 1e-4) lu.uUpScreen.value.set(tmpV.x / l, tmpV.y / l)
    const half = radius * outer * 0.75
    lu.uHalfSize.value.set(half, half)
    lu.uSizeH.value = outer * 0.75
  })

  const palette = useMemo(() => ({ glow: colors.inner.clone().lerp(colors.outer, 0.35) }), [colors])

  const root = useRef<THREE.Group>(null)
  useAsyncCompile(root, [mats])
  return (
    <BodyAnchor id={body.id}>
      <group ref={root}>
      <mesh geometry={horizonGeo} material={mats.horizon} renderOrder={1} />
      <mesh ref={lens} geometry={lensQuad} material={mats.lens} frustumCulled={false} renderOrder={4} />
      <TiltFrame id={body.id}>
        <mesh ref={disk} geometry={diskGeo} material={mats.disk} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3} />
      </TiltFrame>
      <Corona
        id={body.id}
        radius={radius}
        color={palette.glow}
        intensity={0.55 * p.diskBrightness}
        corona={p.corona}
        rays={p.rays * 0.4}
        pointPx={pointGlowPx(p)}
        seed={seedFloat(body.seed)}
        alwaysMask
        reach={outer * 0.45}
      />
      </group>
    </BodyAnchor>
  )
}
