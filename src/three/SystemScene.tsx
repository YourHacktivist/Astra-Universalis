import { memo, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Body, StarSystem } from '@/core/types'
import { useUIStore, type Quality } from '@/store/uiStore'
import { ArtificialRenderer } from './bodies/ArtificialRenderer'
import { BeltRenderer } from './bodies/BeltRenderer'
import { CometRenderer } from './bodies/CometRenderer'
import { MarkerRenderer } from './bodies/MarkerRenderer'
import { NebulaRenderer } from './bodies/NebulaRenderer'
import { PlanetRenderer } from './bodies/PlanetRenderer'
import { StarRenderer } from './bodies/StarRenderer'
import { PostFX } from './effects/PostFX'
import { ExportBridge } from './export/ExportBridge'
import { Starfield } from './environment/Starfield'
import { Axes, BarycenterMarkers, Glints, SelectionHUD } from './overlays/Helpers'
import { OrbitLines } from './overlays/OrbitLines'
import { Routes } from './overlays/Routes'
import { Zones } from './overlays/Zones'
import { lightSources, MAX_STAR_LIGHTS, lightUniforms, runtime } from './runtime'
import { CameraRig } from './scene/CameraRig'
import { LabelUpdater } from './scene/LabelUpdater'
import { Picker } from './scene/Picker'
import { SimulationDriver } from './SimulationDriver'

const BodyRenderer = memo(function BodyRenderer({
  body,
  parent,
  system,
  quality,
}: {
  body: Body
  parent: Body | null
  system: StarSystem
  quality: Quality
}) {
  const display = system.display
  switch (body.kind) {
    case 'star':
      return <StarRenderer body={body} parent={parent} display={display} quality={quality} />
    case 'planet':
    case 'moon':
      return <PlanetRenderer body={body} parent={parent} display={display} quality={quality} />
    case 'belt':
      return <BeltRenderer body={body} parent={parent} display={display} quality={quality} />
    case 'nebula':
      return <NebulaRenderer body={body} parent={parent} display={display} quality={quality} />
    case 'comet':
      return <CometRenderer body={body} parent={parent} display={display} quality={quality} />
    case 'station':
    case 'ship':
    case 'gate':
      return <ArtificialRenderer body={body} parent={parent} display={display} quality={quality} />
    case 'marker':
      return <MarkerRenderer body={body} parent={parent} display={display} quality={quality} />
    default:
      return null
  }
}, (a, b) => a.body === b.body && a.parent === b.parent && a.system.display === b.system.display && a.quality === b.quality)

function SceneLights() {
  const lights = useRef<(THREE.PointLight | null)[]>([])
  useFrame(() => {
    for (let i = 0; i < MAX_STAR_LIGHTS; i++) {
      const l = lights.current[i]
      if (!l) continue
      if (i < lightUniforms.uStarCount.value) {
        const rt = runtime.bodies.get(lightSources[i])
        l.visible = true
        if (rt) l.position.copy(rt.pos)
        const c = lightUniforms.uStarColor.value[i]
        l.color.setRGB(c.x, c.y, c.z)
        l.intensity = 2.2
      } else l.visible = false
    }
  })
  return (
    <>
      <ambientLight intensity={0.06} color="#8a9ac8" />
      {Array.from({ length: MAX_STAR_LIGHTS }, (_, i) => (
        <pointLight key={i} ref={(l) => void (lights.current[i] = l)} decay={0} intensity={0} />
      ))}
    </>
  )
}

export function SystemScene({ system }: { system: StarSystem }) {
  const quality = useUIStore((s) => s.quality)
  const view = useUIStore((s) => s.view)
  const playerMode = useUIStore((s) => s.playerMode)

  const bodies = useMemo(
    () => Object.values(system.bodies).filter((b) => !playerMode || b.playerVisible),
    [system.bodies, playerMode],
  )

  return (
    <>
      <SimulationDriver system={system} />
      <SceneLights />
      {view.starfield && <Starfield environment={system.environment} />}
      {bodies.map((b) => (
        <BodyRenderer key={b.id} body={b} parent={b.parentId ? system.bodies[b.parentId] ?? null : null} system={system} quality={quality} />
      ))}
      <OrbitLines system={system} />
      <Zones system={system} />
      {(view.axes || view.equators) && <Axes system={system} axes={view.axes} equators={view.equators} />}
      <BarycenterMarkers system={system} />
      {view.glints && <Glints system={system} />}
      {view.routes && <Routes system={system} />}
      <SelectionHUD />
      <CameraRig system={system} />
      <Picker />
      <LabelUpdater />
      <ExportBridge />
      <PostFX />
    </>
  )
}
