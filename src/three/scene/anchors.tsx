import { forwardRef, useImperativeHandle, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import type { Id } from '@/core/types'
import { runtime } from '../runtime'

interface AnchorProps {
  id: Id
  children?: ReactNode
  tilt?: boolean
}

export const BodyAnchor = forwardRef<THREE.Group, AnchorProps>(function BodyAnchor({ id, children, tilt }, ref) {
  const group = useRef<THREE.Group>(null!)
  useImperativeHandle(ref, () => group.current)
  useFrame(() => {
    const rt = runtime.bodies.get(id)
    const g = group.current
    if (!rt || !g) return
    g.position.copy(rt.pos)
    g.visible = rt.visible
    if (tilt) g.quaternion.copy(rt.tilt)
  })
  return <group ref={group}>{children}</group>
})

export function TiltFrame({ id, children }: { id: Id; children?: ReactNode }) {
  const group = useRef<THREE.Group>(null!)
  useFrame(() => {
    const rt = runtime.bodies.get(id)
    if (rt && group.current) group.current.quaternion.copy(rt.tilt)
  })
  return <group ref={group}>{children}</group>
}

export function SpinGroup({
  id,
  children,
  factor = 1,
  offset = 0,
}: {
  id: Id
  children?: ReactNode
  factor?: number
  offset?: number
}) {
  const group = useRef<THREE.Group>(null!)
  useFrame(() => {
    const rt = runtime.bodies.get(id)
    if (rt && group.current) group.current.rotation.y = rt.spin * factor + offset
  })
  return <group ref={group}>{children}</group>
}

export function ParentAnchor({ id, children }: { id: Id | null; children?: ReactNode }) {
  const group = useRef<THREE.Group>(null!)
  useFrame(() => {
    const g = group.current
    if (!g) return
    if (!id) {
      g.position.set(0, 0, 0)
      return
    }
    const rt = runtime.bodies.get(id)
    if (rt) {
      g.position.copy(rt.pos)
      g.visible = rt.visible
    }
  })
  return <group ref={group}>{children}</group>
}
