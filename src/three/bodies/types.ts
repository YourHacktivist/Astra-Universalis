import type { Body, BodyKind, BodyOfKind, DisplaySettings } from '@/core/types'
import type { Quality } from '@/store/uiStore'

export interface BodyRendererProps<K extends BodyKind = BodyKind> {
  body: BodyOfKind<K>
  parent: Body | null
  display: DisplaySettings
  quality: Quality
}

export const QUALITY_SCALE: Record<Quality, number> = { low: 0.35, medium: 0.65, high: 1, ultra: 1.6 }
