import { useEffect, useMemo, useRef } from 'react'
import clsx from 'clsx'
import {
  Atom,
  Copy,
  Crosshair,
  Ellipsis,
  Eye,
  EyeOff,
  Info,
  Lock,
  LockOpen,
  Locate,
  Orbit,
  Palette,
  Pencil,
  ScrollText,
  Telescope,
  Trash2,
  Users,
  UserX,
} from 'lucide-react'
import { addBody, deleteBodies, duplicateSelected, focusBody, makeBinary } from '@/app/actions'
import { KIND_LABEL, PLANET_TYPE_LABEL } from '@/core/labels'
import { spectralLabel } from '@/core/starPresets'
import type { Body, StarSystem } from '@/core/types'
import { useActiveSystem } from '@/store/projectStore'
import { useUIStore, type InspectorTab } from '@/store/uiStore'
import { BodyIcon } from '../icons'
import { ColorField, IconButton, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Tabs, Tooltip, type TabDef } from '../kit'
import { AppearanceTab } from './AppearanceTab'
import { applyMainColor, mainColor, setField } from './edit'
import { GeneralTab } from './GeneralTab'
import { NotesTab } from './NotesTab'
import { OrbitTab } from './OrbitTab'
import { hasPhysicsTab, PhysicsTab } from './PhysicsTab'
import { RouteInspector } from './RouteInspector'
import { SystemInspector } from './SystemInspector'

export function Inspector() {
  const system = useActiveSystem()
  const selectedId = useUIStore((s) => s.selectedId)
  const routeId = useUIStore((s) => s.selectedRouteId)
  if (!system) return null
  const route = routeId ? system.routes[routeId] : null
  if (route) return <RouteInspector key={route.id} route={route} system={system} />
  const body = selectedId ? system.bodies[selectedId] : null
  if (body) return <BodyInspector key={body.id} body={body} system={system} />
  return <SystemPanel system={system} />
}

function SystemPanel({ system }: { system: StarSystem }) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-start gap-3 border-b border-line px-3.5 pb-3.5 pt-3.5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-aurum/25 bg-aurum/[0.05] text-aurum">
          <Telescope className="size-[18px]" strokeWidth={1.6} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="eyebrow !text-[9px]">Système</div>
          <div className="truncate font-display text-[22px] font-semibold leading-tight tracking-wide text-ink">{system.name}</div>
          <div className="truncate text-[11px] text-ink-3">{system.designation || 'Aucune sélection : réglages du système'}</div>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SystemInspector system={system} />
      </div>
    </div>
  )
}

function subtitle(body: Body, system: StarSystem): string {
  const parent = body.parentId ? system.bodies[body.parentId] : null
  let type: string = KIND_LABEL[body.kind]
  if (body.kind === 'star') type = spectralLabel(body.props)
  if (body.kind === 'planet' || body.kind === 'moon') type = PLANET_TYPE_LABEL[body.props.planetType]
  return parent ? `${type} · autour de ${parent.name}` : type
}

function tabsFor(body: Body, withIcons: boolean): TabDef<InspectorTab>[] {
  const i = (n: React.ReactNode) => (withIcons ? n : undefined)
  const tabs: TabDef<InspectorTab>[] = [{ value: 'general', label: 'Général', icon: i(<Info />) }]
  if (body.parentId || body.orbit) tabs.push({ value: 'orbit', label: 'Orbite', icon: i(<Orbit />) })
  if (hasPhysicsTab(body)) tabs.push({ value: 'physics', label: 'Physique', icon: i(<Atom />) })
  if (body.kind !== 'barycenter') tabs.push({ value: 'appearance', label: 'Apparence', icon: i(<Palette />) })
  tabs.push({ value: 'notes', label: 'Notes', icon: i(<ScrollText />) })
  return tabs
}

function BodyInspector({ body, system }: { body: Body; system: StarSystem }) {
  const tab = useUIStore((s) => s.inspectorTab)
  const setTab = useUIStore((s) => s.setInspectorTab)
  const followId = useUIStore((s) => s.followId)
  const width = useUIStore((s) => s.inspectorWidth)
  const tabs = useMemo(() => tabsFor(body, width >= 430), [body, width])
  const active = tabs.some((t) => t.value === tab) ? tab : 'general'
  useEffect(() => {
    if (active !== tab) setTab(active)
  }, [active, tab, setTab])
  const following = followId === body.id
  const canSatellite = body.kind === 'planet' || body.kind === 'moon' || body.kind === 'star'
  const nameRef = useRef<HTMLInputElement>(null)
  const renameRequest = useUIStore((s) => s.renameRequest)
  useEffect(() => {
    if (!renameRequest || renameRequest.id !== body.id) return
    const t = setTimeout(() => {
      nameRef.current?.focus()
      nameRef.current?.select()
    }, 60)
    return () => clearTimeout(t)
  }, [renameRequest, body.id])

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line px-3.5 pb-2.5 pt-3.5">
        <div className="flex items-start gap-3">
          <div
            className="relative flex size-10 shrink-0 items-center justify-center rounded-xl border border-line-strong"
            style={{ background: `radial-gradient(circle at 35% 30%, ${body.color}38, transparent 70%)` }}
          >
            <BodyIcon body={body} size={19} />
          </div>
          <div className="group/name relative min-w-0 flex-1">
            <input
              ref={nameRef}
              value={body.name}
              onChange={(e) => setField(body, 'name', e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur()
              }}
              onBlur={(e) => {
                if (!e.target.value.trim()) setField(body, 'name', KIND_LABEL[body.kind])
              }}
              spellCheck={false}
              aria-label="Nom de l'objet"
              title="Cliquez pour renommer (F2)"
              className="-mx-1 w-[calc(100%+8px)] truncate rounded-md bg-transparent px-1 pr-6 font-display text-[22px] font-semibold leading-tight tracking-wide text-ink outline-none transition-colors hover:bg-white/[0.04] focus:bg-white/[0.06] focus:shadow-[inset_0_0_0_1px_rgb(233_185_110/0.45)]"
            />
            <Pencil className="pointer-events-none absolute right-0 top-[7px] size-3.5 text-ink-3 opacity-0 transition-opacity group-hover/name:opacity-100 group-focus-within/name:opacity-0" />

            <div className="truncate text-[11px] text-ink-3">{subtitle(body, system)}</div>
          </div>
          <Tooltip content="Couleur principale de l'objet" side="left">
            <span>
              <ColorField compact value={mainColor(body)} onChange={(v) => applyMainColor(body, v)} className="!size-7" />
            </span>
          </Tooltip>
        </div>
        <div className="mt-2.5 flex items-center gap-0.5">
          <IconButton label="Centrer" shortcut="F" size="sm" onClick={() => focusBody(body.id, false)}>
            <Crosshair />
          </IconButton>
          <IconButton
            label={following ? 'Arrêter le suivi' : 'Suivre'}
            size="sm"
            active={following}
            onClick={() => (following ? useUIStore.getState().follow(null) : focusBody(body.id, true))}
          >
            <Locate />
          </IconButton>
          <span className="mx-1 h-4 w-px bg-line" />
          <IconButton label={body.visible ? 'Masquer dans l’éditeur' : 'Afficher'} size="sm" onClick={() => setField(body, 'visible', !body.visible)}>
            {body.visible ? <Eye /> : <EyeOff />}
          </IconButton>
          <IconButton
            label={body.playerVisible ? 'Visible par les joueurs' : 'Secret : masqué aux joueurs'}
            size="sm"
            active={!body.playerVisible}
            onClick={() => setField(body, 'playerVisible', !body.playerVisible)}
          >
            {body.playerVisible ? <Users /> : <UserX />}
          </IconButton>
          <IconButton label={body.locked ? 'Déverrouiller' : 'Verrouiller'} size="sm" active={body.locked} onClick={() => setField(body, 'locked', !body.locked)}>
            {body.locked ? <Lock /> : <LockOpen />}
          </IconButton>
          <span className="flex-1" />
          <IconButton label="Dupliquer" shortcut="Ctrl+D" size="sm" onClick={duplicateSelected}>
            <Copy />
          </IconButton>
          <Menu>
            <MenuTrigger asChild>
              <button className="inline-flex size-7 items-center justify-center rounded-lg text-ink-2 hover:bg-white/[0.07] hover:text-ink" aria-label="Plus d'actions">
                <Ellipsis className="size-4" />
              </button>
            </MenuTrigger>
            <MenuContent align="end">
              {canSatellite && body.kind !== 'star' && (
                <>
                  <MenuItem onSelect={() => addBody('moon', { parentId: body.id })}>Ajouter une lune</MenuItem>
                  <MenuItem onSelect={() => addBody('station', { parentId: body.id })}>Ajouter une station en orbite</MenuItem>
                  <MenuItem onSelect={() => addBody('ship', { parentId: body.id })}>Ajouter un vaisseau en orbite</MenuItem>
                  <MenuSeparator />
                </>
              )}
              {body.kind === 'star' && (
                <>
                  <MenuItem onSelect={() => addBody('planet', { parentId: body.id })}>Ajouter une planète</MenuItem>
                  <MenuItem onSelect={() => addBody('belt', { parentId: body.id })}>Ajouter une ceinture</MenuItem>
                  {body.parentId === null && <MenuItem onSelect={() => makeBinary(body.id)}>Convertir en système binaire</MenuItem>}
                  <MenuSeparator />
                </>
              )}
              <MenuItem icon={<Trash2 />} tone="danger" shortcut="Suppr" onSelect={() => deleteBodies([body.id])}>
                Supprimer
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </header>
      <Tabs value={active} onChange={setTab} tabs={tabs} className="shrink-0" fill />
      {body.locked && (
        <div className="flex items-center gap-2 border-b border-line bg-aurum/[0.05] px-3.5 py-2 text-[11px] text-aurum-hi">
          <Lock className="size-3.5" /> Objet verrouillé. Déverrouillez-le pour le modifier.
        </div>
      )}
      <div className={clsx('min-h-0 flex-1 overflow-y-auto', body.locked && 'pointer-events-none select-none opacity-50')}>
        {active === 'general' && <GeneralTab body={body} system={system} />}
        {active === 'orbit' && <OrbitTab body={body} system={system} />}
        {active === 'physics' && <PhysicsTab body={body} system={system} />}
        {active === 'appearance' && <AppearanceTab body={body} />}
        {active === 'notes' && <NotesTab body={body} />}
      </div>
    </div>
  )
}
