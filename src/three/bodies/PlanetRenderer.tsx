import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { planetVisualRadius } from '@/core/scale'
import type { Body, Id, PlanetType } from '@/core/types'
import { getActiveSystem } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import { runtime } from '../runtime'
import { BodyAnchor, SpinGroup } from '../scene/anchors'
import {
  cloudParams,
  cloudWidth,
  compileOffscreen,
  firstUseGate,
  getBakedSet,
  pumpBakes,
  surfaceParams,
  surfaceWidth,
  type BakedSet,
} from '../planet/baker'
import { createStarLitMaterial } from '../shaders/lambert'
import {
  createAtmoUniforms,
  createAtmosphereMaterial,
  createCloudMaterial,
  createRingMaterial,
  createShadowUniforms,
  createSurfaceMaterial,
  MAX_OCC,
  unitSphere,
} from '../planet/materials'
import type { BodyRendererProps } from './types'

const NIGHT_ONLY: Set<PlanetType> = new Set(['terran', 'ocean', 'jungle', 'desert', 'arid', 'ice', 'city', 'barren', 'toxic', 'gas', 'icegiant'])
const ROUGH: Partial<Record<PlanetType, number>> = { ice: 0.85, exotic: 0.6, lava: 0.7, city: 0.5, desert: 0.4 }

interface DetailLook {
  bump: number
  albedo: number
  stretch: number
  regolith: number
  craters?: number
}
const DETAIL: Record<PlanetType, DetailLook> = {
  terran: { bump: 0.035, albedo: 0.18, stretch: 1, regolith: 0 },
  ocean: { bump: 0.035, albedo: 0.16, stretch: 1, regolith: 0 },
  jungle: { bump: 0.03, albedo: 0.16, stretch: 1, regolith: 0 },
  desert: { bump: 0.032, albedo: 0.16, stretch: 1, regolith: 0.2 },
  arid: { bump: 0.035, albedo: 0.18, stretch: 1, regolith: 0.35, craters: 0.6 },
  ice: { bump: 0.02, albedo: 0.1, stretch: 1, regolith: 0.25, craters: 0.35 },
  lava: { bump: 0.03, albedo: 0.2, stretch: 1, regolith: 0.1 },
  barren: { bump: 0.022, albedo: 0.16, stretch: 1, regolith: 0.75, craters: 1 },
  toxic: { bump: 0, albedo: 0.06, stretch: 3, regolith: 0 },
  gas: { bump: 0, albedo: 0.1, stretch: 6, regolith: 0 },
  icegiant: { bump: 0, albedo: 0.06, stretch: 6, regolith: 0 },
  hotjupiter: { bump: 0, albedo: 0.1, stretch: 6, regolith: 0 },
  chthonian: { bump: 0.03, albedo: 0.18, stretch: 1, regolith: 0.5, craters: 0.8 },
  city: { bump: 0.015, albedo: 0.25, stretch: 1, regolith: 0 },
  exotic: { bump: 0.03, albedo: 0.18, stretch: 1, regolith: 0 },
}

const AX = new THREE.Vector3(1, 0, 0)
const UP = new THREE.Vector3(0, 1, 0)
const qRing = new THREE.Quaternion()
const qTmp = new THREE.Quaternion()

interface SetSlots {
  surface: BakedSet | null
  surfacePending: BakedSet | null
  clouds: BakedSet | null
  cloudsPending: BakedSet | null
}

function promote(slots: SetSlots, which: 'surface' | 'clouds') {
  const pendingKey = which === 'surface' ? 'surfacePending' : 'cloudsPending'
  const pending = slots[pendingKey]
  if (pending?.disposed) slots[pendingKey] = null
  else if (pending) {
    pending.touch()
    if (pending.textures) {
      slots[which] = pending
      slots[pendingKey] = null
    }
  }
  const cur = slots[which]
  if (cur) {
    cur.touch()
    if (cur.disposed) slots[which] = null
  }
}

const FADE_MS = 300
const FADE_MAX_FRAMES = 45

interface Fades {
  surface: { start: number; frames: number } | null
  clouds: { start: number; frames: number } | null
}

function stepFade(f: Fades, which: keyof Fades, now: number): number {
  const s = f[which]
  if (!s) return 1
  s.frames++
  const t = Math.min(1, Math.max((now - s.start) / FADE_MS, s.frames / FADE_MAX_FRAMES))
  if (t >= 1) f[which] = null
  return t * t * (3 - 2 * t)
}

function occluderIds(body: Body): Id[] {
  if (body.kind === 'moon') return body.parentId ? [body.parentId] : []
  const sys = getActiveSystem()
  if (!sys) return []
  return Object.values(sys.bodies)
    .filter((b) => b.parentId === body.id && (b.kind === 'moon' || b.kind === 'planet') && b.visible)
    .sort((a, b) => (b.kind === 'moon' || b.kind === 'planet' ? b.props.radius : 0) - (a.kind === 'moon' || a.kind === 'planet' ? a.props.radius : 0))
    .slice(0, MAX_OCC)
    .map((b) => b.id)
}

export const PlanetRenderer = memo(function PlanetRenderer({ body, display, quality }: BodyRendererProps<'planet' | 'moon'>) {
  const p = body.props
  const moon = body.kind === 'moon'
  const radius = planetVisualRadius(p.radius, display.bodyScale)
  const gl = useThree((s) => s.gl)

  const shadow = useMemo(() => createShadowUniforms(), [])
  const atmoU = useMemo(() => createAtmoUniforms(), [])
  const surfaceMat = useMemo(() => createSurfaceMaterial(shadow, atmoU), [shadow, atmoU])
  const cloudMat = useMemo(() => createCloudMaterial(shadow), [shadow])
  const atmoMat = useMemo(() => createAtmosphereMaterial(atmoU), [atmoU])
  const ringMat = useMemo(() => createRingMaterial(shadow), [shadow])
  const placeholderMat = useMemo(() => createStarLitMaterial({ color: '#888888' }), [])
  useEffect(() => {
    const c = new THREE.Color(p.palette[0]).lerp(new THREE.Color(p.palette[2]), 0.6)
    if (p.clouds.enabled) c.lerp(new THREE.Color(p.clouds.color), Math.min(0.6, p.clouds.coverage * 0.5))
    placeholderMat.uniforms.uColor.value.copy(c)
    surfaceMat.uniforms.uFlatColor.value.copy(c)
  }, [placeholderMat, surfaceMat, p.palette, p.clouds])
  useEffect(
    () => () => {
      surfaceMat.dispose()
      cloudMat.dispose()
      atmoMat.dispose()
      ringMat.dispose()
      placeholderMat.dispose()
    },
    [surfaceMat, cloudMat, atmoMat, ringMat, placeholderMat],
  )

  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const programsReady = useRef(false)
  useEffect(() => {
    let alive = true
    const warm = new THREE.Scene()
    for (const m of [surfaceMat, cloudMat, atmoMat, ringMat]) {
      const mesh = new THREE.Mesh(unitSphere(), m)
      mesh.frustumCulled = false
      warm.add(mesh)
    }
    compileOffscreen(gl, warm, camera, scene).then(
      () => alive && (programsReady.current = true),
      () => alive && (programsReady.current = true),
    )
    return () => {
      alive = false
    }
  }, [gl, scene, camera, surfaceMat, cloudMat, atmoMat, ringMat])

  const [hero, setHero] = useState(false)
  const heroRef = useRef(false)
  const maxTex = Math.min(4096, gl.capabilities.maxTextureSize)
  const sW = Math.min(maxTex, surfaceWidth(quality, moon) * (hero ? 2 : 1))
  const cW = Math.min(maxTex / 2, cloudWidth(quality, moon) * (hero ? 2 : 1))
  const surfaceKey = JSON.stringify(surfaceParams(p, body.seed))
  const cloudsOn = p.clouds.enabled && p.clouds.coverage > 0.005 && p.clouds.opacity > 0.005
  const cloudKey = cloudsOn ? JSON.stringify(cloudParams(p, body.seed)) : ''
  const slots = useRef<SetSlots>({ surface: null, surfacePending: null, clouds: null, cloudsPending: null })
  const wanted = useRef({ surfaceKey, sW, cloudKey, cW })
  wanted.current = { surfaceKey, sW, cloudKey, cW }

  useEffect(() => {
    slots.current.surfacePending = getBakedSet('surface', JSON.parse(surfaceKey), sW)
  }, [surfaceKey, sW])
  useEffect(() => {
    if (!cloudKey) {
      slots.current.clouds = null
      slots.current.cloudsPending = null
      return
    }
    slots.current.cloudsPending = getBakedSet('clouds', JSON.parse(cloudKey), cW)
  }, [cloudKey, cW])

  useEffect(() => {
    const u = surfaceMat.uniforms
    u.uEmissive.value = p.emissive
    u.uEmissiveColor.value.set(p.emissiveColor)
    u.uNightOnly.value = NIGHT_ONLY.has(p.planetType) ? 1 : 0
    u.uRoughness.value = ROUGH[p.planetType] ?? 0.3
    const look = DETAIL[p.planetType] ?? DETAIL.terran
    u.uDetailBump.value = look.bump * (0.5 + p.relief)
    u.uDetailAlbedo.value = look.albedo
    u.uDetailStretch.value = look.stretch
    u.uRegolith.value = look.regolith
    u.uDetailCraters.value = (look.craters ?? 0) * Math.min(1, 0.3 + p.craters)
    u.uCloudShadow.value = cloudsOn ? Math.min(1, p.clouds.opacity) * 0.6 : 0
    const a = p.atmosphere
    atmoU.uAtmoColor.value.set(a.color)
    atmoU.uSunset.value.set(a.sunsetColor)
    atmoU.uAtmoDensity.value = a.enabled ? a.density : 0
    cloudMat.uniforms.uColor.value.set(p.clouds.color)
    cloudMat.uniforms.uOpacity.value = p.clouds.opacity
    cloudMat.uniforms.uSunsetCloud.value.set(a.enabled ? a.sunsetColor : '#ffb07a')
    const r = p.rings
    shadow.uRingSeed.value = (body.seed % 9973) / 97.3
    shadow.uRingBands.value = r.bands
    shadow.uRingShadow.value = r.enabled ? 1 : 0
    shadow.uRingOpacity.value = r.opacity
    ringMat.uniforms.uColorA.value.set(r.colorA)
    ringMat.uniforms.uColorB.value.set(r.colorB)
    ringMat.uniforms.uOpacity.value = r.opacity
  }, [p, body.seed, cloudsOn, surfaceMat, cloudMat, ringMat, atmoU, shadow])

  const sphere = unitSphere(moon && quality === 'low')
  const ringInner = radius * Math.max(1.01, p.rings.inner)
  const ringOuter = radius * Math.max(p.rings.inner + 0.05, p.rings.outer)
  const ringGeometry = useMemo(
    () => (p.rings.enabled ? new THREE.RingGeometry(ringInner, ringOuter, 256, 1) : null),
    [p.rings.enabled, ringInner, ringOuter],
  )
  useEffect(() => () => ringGeometry?.dispose(), [ringGeometry])
  useEffect(() => {
    ringMat.uniforms.uInner.value = ringInner
    ringMat.uniforms.uOuter.value = ringOuter
    ringMat.uniforms.uPlanetR.value = radius
    shadow.uRingInner.value = ringInner
    shadow.uRingOuter.value = ringOuter
  }, [ringMat, shadow, ringInner, ringOuter, radius])

  const atmoScale = radius * (1 + Math.min(0.25, Math.max(0.012, p.atmosphere.height)))
  const cloudScale = radius * (1 + Math.min(0.012, 0.004 + p.atmosphere.height * 0.12))

  const surfaceMesh = useRef<THREE.Mesh>(null!)
  const cloudGroup = useRef<THREE.Group>(null!)
  const cloudMesh = useRef<THREE.Mesh>(null!)
  const placeholder = useRef<THREE.Mesh>(null!)
  const atmoMesh = useRef<THREE.Mesh>(null!)
  const ringMesh = useRef<THREE.Mesh>(null!)
  const occ = useRef<{ ids: Id[]; at: number }>({ ids: [], at: -1 })
  const fades = useRef<Fades>({ surface: null, clouds: null })

  useEffect(() => {
    const mesh = surfaceMesh.current
    if (!mesh) return
    mesh.onBeforeRender = () => {
      surfaceMat.uniforms.uModelRot.value.setFromMatrix4(mesh.matrixWorld)
    }
  }, [surfaceMat])
  useEffect(() => {
    const mesh = cloudMesh.current
    if (!mesh) return
    mesh.onBeforeRender = () => {
      cloudMat.uniforms.uModelRot.value.setFromMatrix4(mesh.matrixWorld)
    }
  }, [cloudMat, cloudsOn])
  useEffect(() => {
    surfaceMat.uniforms.uCloudAlt.value = cloudScale / radius - 1
  }, [surfaceMat, cloudScale, radius])

  useFrame((state, delta) => {
    pumpBakes(gl, state.clock.elapsedTime, delta)
    const s = slots.current
    promote(s, 'surface')
    promote(s, 'clouds')
    const w = wanted.current
    if (!s.surface && !s.surfacePending) s.surfacePending = getBakedSet('surface', JSON.parse(w.surfaceKey), w.sW)
    if (w.cloudKey && !s.clouds && !s.cloudsPending) s.cloudsPending = getBakedSet('clouds', JSON.parse(w.cloudKey), w.cW)

    const ready = programsReady.current
    const now = performance.now()
    let st = ready ? s.surface?.textures : null
    if (st && !firstUseGate('display:surface')) st = null
    const sm = surfaceMesh.current
    const su = surfaceMat.uniforms
    if (sm) {
      sm.visible = !!st
      if (st) {
        const albedo = st.albedo!.texture
        if (su.uAlbedo.value !== albedo) {
          const had = su.uAlbedo.value as THREE.Texture | null
          su.uAlbedoPrev.value = had
          su.uNormalPrev.value = had ? su.uNormal.value : null
          su.uHasPrev.value = had ? 1 : 0
          su.uAlbedo.value = albedo
          su.uNormal.value = st.normal!.texture
          su.uDetailFreq.value = st.albedo!.width / 6
          fades.current.surface = { start: now, frames: 0 }
        }
        su.uMix.value = stepFade(fades.current, 'surface', now)
        if (su.uMix.value >= 1 && su.uHasPrev.value) {
          su.uHasPrev.value = 0
          su.uAlbedoPrev.value = null
          su.uNormalPrev.value = null
        }
      }
    }
    if (placeholder.current) placeholder.current.visible = !st && firstUseGate('display:placeholder')
    if (atmoMesh.current) atmoMesh.current.visible = ready && firstUseGate('display:atmosphere')
    if (ringMesh.current) ringMesh.current.visible = ready && firstUseGate('display:ring')
    let ct = ready ? s.clouds?.textures : null
    if (ct && !firstUseGate('display:clouds')) ct = null
    if (cloudMesh.current) cloudMesh.current.visible = !!ct && cloudsOn
    const cTex = ct?.clouds?.texture ?? null
    const cu = cloudMat.uniforms
    if (cTex && cu.uClouds.value !== cTex) {
      const had = cu.uClouds.value as THREE.Texture | null
      cu.uCloudsPrev.value = had
      cu.uHasPrev.value = had ? 1 : 0
      cu.uClouds.value = cTex
      cu.uDetailFreq.value = ct!.clouds!.width / 5
      fades.current.clouds = { start: now, frames: 0 }
    }
    if (cTex) {
      cu.uMix.value = stepFade(fades.current, 'clouds', now)
      if (cu.uMix.value >= 1 && cu.uHasPrev.value) {
        cu.uHasPrev.value = 0
        cu.uCloudsPrev.value = null
      }
    }
    if (surfaceMat.uniforms.uClouds.value !== cTex) surfaceMat.uniforms.uClouds.value = cTex
    if (!cTex) surfaceMat.uniforms.uCloudShadow.value = 0
    else if (cloudsOn) surfaceMat.uniforms.uCloudShadow.value = Math.min(1, p.clouds.opacity) * 0.6 * (cu.uHasPrev.value ? 1 : cu.uMix.value)

    const rt = runtime.bodies.get(body.id)
    if (!rt) return
    const ui = useUIStore.getState()
    const cam = state.camera as THREE.PerspectiveCamera
    const px = (radius / Math.max(cam.position.distanceTo(rt.pos), 1e-6) / Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)) * (state.size.height / 2)
    const focused = ui.selectedId === body.id || ui.followId === body.id
    const wantHero = quality !== 'low' && focused && rt.visible && px > (heroRef.current ? 180 : 320)
    if (wantHero !== heroRef.current) {
      heroRef.current = wantHero
      setHero(wantHero)
    }
    const drift = p.clouds.speed * ((runtime.time / 20) % 1) * Math.PI * 2 + state.clock.elapsedTime * 0.004 * Math.sign(p.clouds.speed || 1)
    if (cloudGroup.current) cloudGroup.current.rotation.y = drift
    const off = (drift / (Math.PI * 2)) % 1
    surfaceMat.uniforms.uCloudOffset.value = off < 0 ? off + 1 : off

    atmoU.uCenter.value.copy(rt.pos)
    atmoU.uRp.value = radius
    atmoU.uRa.value = atmoScale
    shadow.uRingC.value.copy(rt.pos)
    qRing.copy(rt.tilt).multiply(qTmp.setFromAxisAngle(AX, THREE.MathUtils.degToRad(p.rings.tilt)))
    shadow.uRingN.value.copy(UP).applyQuaternion(qRing)

    if (state.clock.elapsedTime - occ.current.at > 0.5) {
      occ.current = { ids: occluderIds(body), at: state.clock.elapsedTime }
    }
    let n = 0
    for (const id of occ.current.ids) {
      const o = runtime.bodies.get(id)
      if (!o || !o.visible || o.radius <= 0) continue
      shadow.uOccPos.value[n].copy(o.pos)
      shadow.uOccRad.value[n] = o.radius
      n++
    }
    shadow.uOccCount.value = n
  })

  const atmoOn = p.atmosphere.enabled && p.atmosphere.density > 0.005

  return (
    <BodyAnchor id={body.id} tilt>
      <SpinGroup id={body.id}>
        <mesh ref={surfaceMesh} geometry={sphere} material={surfaceMat} scale={radius} visible={false} />
        <mesh ref={placeholder} geometry={unitSphere(true)} material={placeholderMat} scale={radius} />
        {cloudsOn && (
          <group ref={cloudGroup}>
            <mesh ref={cloudMesh} geometry={sphere} material={cloudMat} scale={cloudScale} renderOrder={1} visible={false} />
          </group>
        )}
      </SpinGroup>
      {atmoOn && <mesh ref={atmoMesh} geometry={sphere} material={atmoMat} scale={atmoScale} renderOrder={2} visible={false} />}
      {ringGeometry && (
        <group rotation={[THREE.MathUtils.degToRad(p.rings.tilt), 0, 0]}>
          <mesh ref={ringMesh} geometry={ringGeometry} material={ringMat} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3} visible={false} />
        </group>
      )}
    </BodyAnchor>
  )
})
