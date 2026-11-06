import type { ReactNode } from 'react'
import {
  Copy,
  Crosshair,
  Eye,
  EyeOff,
  Locate,
  Maximize2,
  Navigation,
  Pencil,
  Plus,
  Route,
  Split,
  Trash2,
  Triangle,
  Users,
  UserX,
} from 'lucide-react'
import { addBody, addRoute, cameraPreset, deleteBodies, focusBody, frameAll, makeBinary, placeAtLagrange } from '@/app/actions'
import type { AddKind, Body, StarSystem } from '@/core/types'
import { useProjectStore } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import { addBodyAt, flyToPoint } from '@/three/scene/viewportActions'
import { ADD_ICON, BodyIcon } from './icons'
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  MenuItem,
  MenuSeparator,
  MenuSub,
} from './kit'

export type ActionEntry =
  | { type: 'item'; label: string; icon?: ReactNode; shortcut?: string; danger?: boolean; disabled?: boolean; run(): void }
  | { type: 'sep' }
  | { type: 'sub'; label: string; icon?: ReactNode; items: ActionEntry[] }

const sep: ActionEntry = { type: 'sep' }

export const ADD_KINDS: { kind: AddKind; label: string; hint: string; group: string }[] = [
  { kind: 'star', label: 'Étoile', hint: 'Étoile centrale ou compagnon', group: 'Corps célestes' },
  { kind: 'blackhole', label: 'Trou noir', hint: 'Disque d’accrétion, lentille gravitationnelle', group: 'Corps célestes' },
  { kind: 'planet', label: 'Planète', hint: 'Placée après la dernière orbite', group: 'Corps célestes' },
  { kind: 'moon', label: 'Lune', hint: 'Autour de la planète sélectionnée', group: 'Corps célestes' },
  { kind: 'belt', label: 'Ceinture', hint: "Astéroïdes, Kuiper ou débris", group: 'Corps célestes' },
  { kind: 'comet', label: 'Comète', hint: 'Orbite très excentrique', group: 'Corps célestes' },
  { kind: 'nebula', label: 'Nébuleuse', hint: 'Nuage de gaz et de poussière', group: 'Corps célestes' },
  { kind: 'station', label: 'Station', hint: 'Habitat, raffinerie, chantier…', group: 'Artificiels' },
  { kind: 'ship', label: 'Vaisseau', hint: 'Cargo, corvette, épave…', group: 'Artificiels' },
  { kind: 'gate', label: 'Portail de saut', hint: 'Passage vers un autre système', group: 'Artificiels' },
  { kind: 'marker', label: 'Marqueur', hint: 'Balise, danger, point d’intérêt', group: 'Repères' },
]

function addItems(parentId?: string): ActionEntry[] {
  return ADD_KINDS.map((k) => {
    const Icon = ADD_ICON[k.kind]
    return { type: 'item', label: k.label, icon: <Icon />, run: () => void addBody(k.kind, parentId ? { parentId } : {}) }
  })
}

export function bodyActions(body: Body, system: StarSystem, opts: { onRename?(): void } = {}): ActionEntry[] {
  const ui = useUIStore.getState()
  const following = ui.followId === body.id
  const out: ActionEntry[] = [
    { type: 'item', label: 'Centrer la vue', icon: <Crosshair />, shortcut: 'F', run: () => focusBody(body.id, false) },
    {
      type: 'item',
      label: following ? 'Arrêter le suivi' : 'Suivre',
      icon: <Locate />,
      run: () => (following ? ui.follow(null) : focusBody(body.id, true)),
    },
    sep,
  ]

  const adds: ActionEntry[] = []
  if (body.kind === 'star' || body.kind === 'barycenter') {
    adds.push(
      { type: 'item', label: 'Ajouter une planète', icon: <Plus />, run: () => void addBody('planet', { parentId: body.id }) },
      { type: 'item', label: 'Ajouter une ceinture', icon: <Plus />, run: () => void addBody('belt', { parentId: body.id }) },
    )
    if (body.kind === 'star' && !body.parentId) adds.push({ type: 'item', label: 'Convertir en système binaire', icon: <Split />, run: () => makeBinary(body.id) })
  }
  if (body.kind === 'planet' || body.kind === 'moon') {
    adds.push(
      { type: 'item', label: 'Ajouter une lune', icon: <Plus />, run: () => void addBody('moon', { parentId: body.id }) },
      { type: 'item', label: 'Ajouter une station', icon: <Plus />, run: () => void addBody('station', { parentId: body.id }) },
      { type: 'item', label: 'Ajouter un vaisseau', icon: <Plus />, run: () => void addBody('ship', { parentId: body.id }) },
    )
  }
  if (adds.length) out.push(...adds, sep)

  const siblings = Object.values(system.bodies).filter(
    (b) => b.id !== body.id && b.parentId === body.parentId && b.orbit && !b.orbit.fixed && (b.kind === 'planet' || b.kind === 'moon'),
  )
  if (body.orbit && siblings.length && body.kind !== 'star') {
    out.push({
      type: 'sub',
      label: 'Placer au point de Lagrange',
      icon: <Triangle />,
      items: siblings.flatMap<ActionEntry>((s) => [
        { type: 'item', label: `${s.name} · L4`, icon: <BodyIcon body={s} size={14} />, run: () => placeAtLagrange(body.id, s.id, 'L4') },
        { type: 'item', label: `${s.name} · L5`, icon: <BodyIcon body={s} size={14} />, run: () => placeAtLagrange(body.id, s.id, 'L5') },
      ]),
    })
  }

  const targets = Object.values(system.bodies).filter((b) => b.id !== body.id && b.kind !== 'belt' && b.kind !== 'nebula' && b.kind !== 'barycenter')
  if (targets.length && body.kind !== 'belt' && body.kind !== 'nebula') {
    out.push({
      type: 'sub',
      label: 'Nouvelle route vers',
      icon: <Route />,
      items: targets.map<ActionEntry>((t) => ({ type: 'item', label: t.name, icon: <BodyIcon body={t} size={14} />, run: () => void addRoute(body.id, t.id) })),
    })
  }
  out.push(sep)
  if (opts.onRename) out.push({ type: 'item', label: 'Renommer', icon: <Pencil />, shortcut: 'F2', run: opts.onRename })
  out.push(
    {
      type: 'item',
      label: 'Dupliquer',
      icon: <Copy />,
      shortcut: 'Ctrl+D',
      run: () => {
        const id = useProjectStore.getState().duplicateBody(body.id)
        if (id) useUIStore.getState().select(id)
      },
    },
    {
      type: 'item',
      label: body.visible ? 'Masquer' : 'Afficher',
      icon: body.visible ? <EyeOff /> : <Eye />,
      run: () => useProjectStore.getState().updateBody(body.id, (b) => void (b.visible = !b.visible)),
    },
    {
      type: 'item',
      label: body.playerVisible ? 'Rendre secret (joueurs)' : 'Révéler aux joueurs',
      icon: body.playerVisible ? <UserX /> : <Users />,
      run: () => useProjectStore.getState().updateBody(body.id, (b) => void (b.playerVisible = !b.playerVisible)),
    },
    sep,
    { type: 'item', label: 'Supprimer', icon: <Trash2 />, shortcut: 'Suppr', danger: true, run: () => deleteBodies([body.id]) },
  )
  return out
}

export function emptySpaceActions(at?: { x: number; y: number }): ActionEntry[] {
  const here: ActionEntry[] = at
    ? ADD_KINDS.map((k) => {
        const Icon = ADD_ICON[k.kind]
        return { type: 'item', label: k.label, icon: <Icon />, run: () => void addBodyAt(k.kind, at.x, at.y) }
      })
    : addItems()
  return [
    { type: 'sub', label: at ? 'Ajouter ici' : 'Ajouter', icon: <Plus />, items: here },
    ...(at ? [{ type: 'item', label: 'Voler jusqu’ici', icon: <Navigation />, run: () => flyToPoint(at.x, at.y) } as ActionEntry] : []),
    sep,
    { type: 'item', label: "Vue d'ensemble", icon: <Maximize2 />, shortcut: 'H', run: frameAll },
    { type: 'item', label: 'Vue de dessus', shortcut: '1', run: () => cameraPreset('top') },
    { type: 'item', label: 'Vue de profil', shortcut: '2', run: () => cameraPreset('side') },
    { type: 'item', label: 'Vue trois-quarts', shortcut: '3', run: () => cameraPreset('iso') },
  ]
}

export function renderContextEntries(entries: ActionEntry[]): ReactNode {
  return entries.map((e, i) => {
    if (e.type === 'sep') return i > 0 && entries[i - 1]?.type !== 'sep' && i < entries.length - 1 ? <ContextMenuSeparator key={i} /> : null
    if (e.type === 'sub')
      return (
        <ContextMenuSub key={i} label={e.label} icon={e.icon}>
          {renderContextEntries(e.items)}
        </ContextMenuSub>
      )
    return (
      <ContextMenuItem key={i} icon={e.icon} shortcut={e.shortcut} onSelect={e.run} disabled={e.disabled} tone={e.danger ? 'danger' : undefined}>
        {e.label}
      </ContextMenuItem>
    )
  })
}

export function renderMenuEntries(entries: ActionEntry[]): ReactNode {
  return entries.map((e, i) => {
    if (e.type === 'sep') return i > 0 && entries[i - 1]?.type !== 'sep' && i < entries.length - 1 ? <MenuSeparator key={i} /> : null
    if (e.type === 'sub')
      return (
        <MenuSub key={i} label={e.label} icon={e.icon}>
          {renderMenuEntries(e.items)}
        </MenuSub>
      )
    return (
      <MenuItem key={i} icon={e.icon} shortcut={e.shortcut} onSelect={e.run} disabled={e.disabled} tone={e.danger ? 'danger' : undefined}>
        {e.label}
      </MenuItem>
    )
  })
}
