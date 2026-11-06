import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
  type Pass,
} from 'postprocessing'
import * as THREE from 'three'
import { useUIStore, type Quality, type RenderStyle } from '@/store/uiStore'
import { BlueprintEffect, GradeEffect, TerminalEffect } from './styleEffects'

const SAMPLES: Record<Quality, number> = { low: 0, medium: 2, high: 4, ultra: 8 }

interface Pipeline {
  composer: EffectComposer
  bloom: BloomEffect
  grade: GradeEffect
  chroma: ChromaticAberrationEffect
  vignette: VignetteEffect
  noise: NoiseEffect
  terminal: TerminalEffect
  blueprint: BlueprintEffect
  cinePass: EffectPass
  terminalPass: EffectPass
  blueprintPass: EffectPass
  lookPasses: Pass[]
}

function createPipeline(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): Pipeline {
  const composer = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: 0 })
  composer.addPass(new RenderPass(scene, camera))

  const bloom = new BloomEffect({
    mipmapBlur: true,
    levels: 6,
    luminanceThreshold: 1.0,
    luminanceSmoothing: 0.25,
    intensity: 0.88,
    radius: 0.62,
  })
  const toneMapping = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL })
  const grade = new GradeEffect()
  composer.addPass(new EffectPass(camera, bloom, toneMapping, grade))

  const chroma = new ChromaticAberrationEffect({
    offset: new THREE.Vector2(0.00055, 0.00035),
    radialModulation: true,
    modulationOffset: 0.42,
  })
  const vignette = new VignetteEffect({ offset: 0.28, darkness: 0.58 })
  const noise = new NoiseEffect({ blendFunction: BlendFunction.SOFT_LIGHT, premultiply: false })
  noise.blendMode.opacity.value = 0.1
  const cinePass = new EffectPass(camera, chroma, vignette, noise)
  const terminal = new TerminalEffect()
  const terminalPass = new EffectPass(camera, terminal)
  const blueprint = new BlueprintEffect()
  const blueprintPass = new EffectPass(camera, blueprint)
  for (const p of [cinePass, terminalPass, blueprintPass]) composer.addPass(p)

  return {
    composer,
    bloom,
    grade,
    chroma,
    vignette,
    noise,
    terminal,
    blueprint,
    cinePass,
    terminalPass,
    blueprintPass,
    lookPasses: [cinePass, terminalPass, blueprintPass],
  }
}

interface LookOptions {
  style: RenderStyle
  bloom: boolean
  vignette: boolean
  grain: boolean
  quality: Quality
  immersive: boolean
}

function applyLook(p: Pipeline, o: LookOptions) {
  const terminal = o.style === 'terminal'
  const blueprint = o.style === 'blueprint'

  const active = terminal ? p.terminalPass : blueprint ? p.blueprintPass : p.cinePass
  for (const pass of p.lookPasses) {
    pass.enabled = pass === active
    pass.renderToScreen = pass === active
  }

  const bloomOn = o.bloom || terminal
  const fn = bloomOn ? BlendFunction.ADD : BlendFunction.SKIP
  if (p.bloom.blendMode.blendFunction !== fn) p.bloom.blendMode.blendFunction = fn
  p.bloom.luminanceMaterial.threshold = terminal ? 0.55 : 1.0
  p.bloom.luminanceMaterial.smoothing = terminal ? 0.4 : 0.25
  p.bloom.intensity = terminal ? 1.5 : blueprint ? 0.5 : o.immersive ? 1.0 : 0.88
  p.bloom.mipmapBlurPass.radius = terminal ? 0.75 : 0.62

  const g = p.grade.uniforms
  const styled = terminal || blueprint
  g.get('uToe')!.value = styled ? 0.0 : o.immersive ? 0.02 : 0.012
  g.get('uContrast')!.value = styled ? 1 : o.immersive ? 1.1 : 1.05
  g.get('uSplit')!.value = styled ? 0 : o.immersive ? 1 : 0.55
  g.get('uSaturation')!.value = styled ? 1 : o.immersive ? 1.12 : 1.05

  const ca = o.quality === 'high' || o.quality === 'ultra' ? 1 : 0
  p.chroma.offset.set(0.00055 * ca, 0.00035 * ca)
  p.vignette.blendMode.opacity.value = o.vignette || o.immersive ? 1 : 0
  p.vignette.offset = o.immersive ? 0.22 : 0.28
  p.vignette.darkness = o.immersive ? 0.7 : 0.58
  p.noise.blendMode.opacity.value = o.grain ? 0.1 : 0
}

const bufferSize = new THREE.Vector2()

export function PostFX() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)
  const style = useUIStore((s) => s.renderStyle)
  const quality = useUIStore((s) => s.quality)
  const bloom = useUIStore((s) => s.view.bloom)
  const vignette = useUIStore((s) => s.view.vignette)
  const grain = useUIStore((s) => s.view.grain)
  const exporting = useUIStore((s) => s.exporting)
  const immersive = useUIStore((s) => s.immersive)

  const pipeline = useMemo(() => {
    const p = createPipeline(gl, scene, camera)
    const ui = useUIStore.getState()
    applyLook(p, { style: ui.renderStyle, bloom: ui.view.bloom, vignette: ui.view.vignette, grain: ui.view.grain, quality: ui.quality, immersive: ui.immersive })
    p.composer.multisampling = ui.exporting ? 0 : Math.min(SAMPLES[ui.quality], gl.capabilities.maxSamples ?? 4)
    return p
  }, [gl, scene, camera])
  useEffect(() => () => pipeline.composer.dispose(), [pipeline])

  useEffect(() => {
    applyLook(pipeline, { style, bloom, vignette, grain, quality, immersive })
  }, [pipeline, style, bloom, vignette, grain, quality, immersive])

  useEffect(() => {
    const samples = exporting ? 0 : Math.min(SAMPLES[quality], gl.capabilities.maxSamples ?? 4)
    if (pipeline.composer.multisampling !== samples) pipeline.composer.multisampling = samples
  }, [pipeline, quality, exporting, gl])

  useEffect(() => {
    pipeline.composer.setSize(size.width, size.height, false)
  }, [pipeline, size.width, size.height, dpr])

  useFrame((_, delta) => {
    const { composer } = pipeline
    gl.getDrawingBufferSize(bufferSize)
    if (composer.inputBuffer.width !== bufferSize.x || composer.inputBuffer.height !== bufferSize.y) {
      composer.setSize(size.width, size.height, false)
    }
    const pr = gl.getPixelRatio()
    pipeline.terminal.uniforms.get('uPixelRatio')!.value = pr
    pipeline.blueprint.uniforms.get('uPixelRatio')!.value = pr
    composer.render(delta)
  }, 1)

  return null
}
