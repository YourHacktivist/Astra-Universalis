import type { CSSProperties } from 'react'
import clsx from 'clsx'
import {
  Aperture,
  CircleDashed,
  CircleDotDashed,
  CircleHelp,
  Cloudy,
  Flag,
  Globe,
  MapPin,
  Moon,
  Orbit,
  Package,
  Rocket,
  Satellite,
  Siren,
  Skull,
  Sparkle,
  Sparkles,
  Sun,
  Swords,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import type { AddKind, Body, BodyKind, MarkerType } from '@/core/types'

export const KIND_ICON: Record<BodyKind, LucideIcon> = {
  star: Sun,
  barycenter: CircleDotDashed,
  planet: Globe,
  moon: Moon,
  belt: CircleDashed,
  nebula: Cloudy,
  comet: Sparkle,
  station: Satellite,
  ship: Rocket,
  gate: Aperture,
  marker: MapPin,
}

export const ADD_ICON: Record<AddKind, LucideIcon> = { ...KIND_ICON, blackhole: Orbit }

export const MARKER_ICON: Record<MarkerType, LucideIcon> = {
  poi: MapPin,
  distress: Siren,
  derelict: Skull,
  anomaly: Sparkles,
  danger: TriangleAlert,
  outpost: Flag,
  cache: Package,
  combat: Swords,
  unknown: CircleHelp,
}

export function iconFor(body: Pick<Body, 'kind'> & { props?: unknown }): LucideIcon {
  if (body.kind === 'marker') return MARKER_ICON[(body.props as { markerType: MarkerType }).markerType] ?? MapPin
  if (body.kind === 'star' && (body.props as { starClass?: string } | undefined)?.starClass === 'BH') return Orbit
  return KIND_ICON[body.kind]
}

export function BodyIcon({ body, className, size = 15 }: { body: Body; className?: string; size?: number }) {
  const Icon = iconFor(body)
  const style: CSSProperties = {
    color: body.color,
    filter: body.kind === 'star' ? `drop-shadow(0 0 4px ${body.color})` : undefined,
  }
  return <Icon className={clsx('shrink-0', className)} style={style} size={size} strokeWidth={1.7} />
}
