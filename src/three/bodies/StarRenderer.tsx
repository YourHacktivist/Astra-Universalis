import { memo } from 'react'
import { starVisualRadius } from '@/core/scale'
import { BlackHole, NeutronStar, StellarStar } from '../star/Stars'
import type { BodyRendererProps } from './types'

export const StarRenderer = memo(function StarRenderer({ body, display, quality }: BodyRendererProps<'star'>) {
  const radius = starVisualRadius(body.props, display.bodyScale)
  switch (body.props.starClass) {
    case 'BH':
      return <BlackHole body={body} radius={radius} quality={quality} />
    case 'NS':
    case 'PSR':
      return <NeutronStar body={body} radius={radius} quality={quality} />
    default:
      return <StellarStar body={body} radius={radius} quality={quality} />
  }
})
