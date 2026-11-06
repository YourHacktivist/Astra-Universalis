import clsx from 'clsx'
import {
  Clapperboard,
  Crosshair,
  Locate,
  Maximize2,
  Move,
  PanelLeft,
  PanelRight,
  Plus,
  Route,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react'
import { DropdownMenu as RMenu } from 'radix-ui'
import { cameraPreset, focusBody, frameAll } from '@/app/actions'
import { useActiveSystem } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import { ADD_KINDS } from '../bodyActions'
import { ADD_ICON } from '../icons'
import { Menu, MenuContent, MenuLabel, MenuSeparator, MenuTrigger, PopoverContent, PopoverRoot, PopoverTrigger, Tooltip } from '../kit'
import { ViewOptionsPanel } from './ViewOptions'

const TOOL =
  'inline-flex h-7 min-w-7 items-center justify-center gap-1.5 rounded-sm px-1.5 text-[12px] text-ink-2 transition-colors hover:bg-white/[0.06] hover:text-ink disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-[15px] [&_svg]:stroke-[1.6]'
const ON = '!text-aurum-hi bg-aurum/[0.1]'

function Tool({
  label,
  shortcut,
  onClick,
  active,
  disabled,
  children,
  text,
}: {
  label: string
  shortcut?: string
  onClick(): void
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
  text?: string
}) {
  return (
    <Tooltip content={label} shortcut={shortcut} side="bottom">
      <button aria-label={label} aria-pressed={active} disabled={disabled} onClick={onClick} className={clsx(TOOL, active && ON)}>
        {children}
        {text && <span>{text}</span>}
      </button>
    </Tooltip>
  )
}

function Rule() {
  return <span aria-hidden className="mx-1.5 h-4 w-px bg-line" />
}

export function Toolbar({ compact }: { compact?: boolean }) {
  const selectedId = useUIStore((s) => s.selectedId)
  const followId = useUIStore((s) => s.followId)
  const playerMode = useUIStore((s) => s.playerMode)
  const panels = useUIStore((s) => s.panels)
  const moveTool = useUIStore((s) => s.moveTool)
  const placing = useUIStore((s) => s.placing)
  const system = useActiveSystem()
  const ui = useUIStore.getState()
  const followed = followId && system ? system.bodies[followId] : null

  return (
    <div
      role="toolbar"
      aria-label="Outils de la vue"
      className="flex h-9 shrink-0 items-center border-b border-line bg-abyss px-1.5"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {!panels.hierarchy && (
        <>
          <Tool label="Afficher la hiérarchie" shortcut="Tab" onClick={() => ui.togglePanel('hierarchy')}>
            <PanelLeft />
          </Tool>
          <Rule />
        </>
      )}
      <AddMenu compact={compact} />
      <Rule />
      <Tool label="Centrer sur la sélection" shortcut="F" disabled={!selectedId} onClick={() => focusBody(selectedId, false)}>
        <Crosshair />
      </Tool>
      <Tool
        label={followId ? 'Arrêter le suivi' : 'Suivre la sélection'}
        active={!!followId}
        disabled={!followId && !selectedId}
        onClick={() => (followId ? ui.follow(null) : focusBody(selectedId, true))}
      >
        <Locate />
      </Tool>
      <Tool label="Vue d'ensemble : revenir à la vue normale du système" shortcut="H" onClick={frameAll} text={compact ? undefined : "Vue d'ensemble"}>
        <Maximize2 />
      </Tool>
      <Tool
        label={moveTool ? 'Outil Déplacer actif : glissez un astre' : 'Outil Déplacer (ou Maj + glisser)'}
        shortcut="M"
        active={moveTool}
        onClick={() => ui.setMoveTool(!moveTool)}
      >
        <Move />
      </Tool>
      <Rule />
      <div role="group" aria-label="Angle de vue" className="flex items-center">
        {(
          [
            ['top', 'Dessus', '1'],
            ['side', 'Profil', '2'],
            ['iso', '3/4', '3'],
          ] as const
        ).map(([p, label, key]) => (
          <Tooltip key={p} content={`Vue ${label === '3/4' ? 'trois-quarts' : label.toLowerCase()}`} shortcut={key} side="bottom">
            <button onClick={() => cameraPreset(p)} className="h-7 rounded-sm px-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3 transition-colors hover:bg-white/[0.06] hover:text-ink">
              {label}
            </button>
          </Tooltip>
        ))}
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-3 overflow-hidden whitespace-nowrap px-3 font-mono text-[10.5px] uppercase tracking-[0.12em] [&>span]:truncate">
        {followed && (
          <span className="flex min-w-0 items-center gap-1.5 text-ion-hi">
            <span className="truncate">Suivi · {followed.name}</span>
            <button aria-label="Arrêter le suivi" onClick={() => ui.follow(null)} className="rounded-sm p-0.5 text-ink-3 hover:bg-white/10 hover:text-ink">
              <X className="size-3" />
            </button>
          </span>
        )}
        {playerMode && <span className="text-aurum-hi">Mode joueurs : secrets masqués</span>}
        {moveTool && <span className="text-aurum-hi">Déplacer : glissez un astre · Échap pour quitter</span>}
        {placing && (
          <span className="text-aurum-hi" role="status">
            Placer : {ADD_KINDS.find((k) => k.kind === placing)?.label ?? placing} · cliquez dans la vue · Entrée : position auto · Échap : annuler
          </span>
        )}
      </div>

      <PopoverRoot>
        <Tooltip content="Options d'affichage" side="bottom">
          <PopoverTrigger asChild>
            <button aria-label="Options d'affichage" className={clsx(TOOL, 'data-[state=open]:bg-white/[0.08] data-[state=open]:text-ink')}>
              <SlidersHorizontal />
              {!compact && <span>Affichage</span>}
            </button>
          </PopoverTrigger>
        </Tooltip>
        <PopoverContent side="bottom" sideOffset={6} align="end">
          <ViewOptionsPanel />
        </PopoverContent>
      </PopoverRoot>
      <Tool label="Calculateur de trajet" onClick={() => ui.openDialog('travel')}>
        <Route />
      </Tool>
      <Tool label={playerMode ? 'Quitter le mode joueurs' : 'Mode joueurs : masque les secrets'} shortcut="Ctrl+Maj+P" active={playerMode} onClick={() => ui.setPlayerMode(!playerMode)} text={compact ? undefined : 'Joueurs'}>
        <Users />
      </Tool>
      <Tool label="Mode immersif (cinéma, plein écran)" shortcut="I" onClick={() => ui.setImmersive(true)} text={compact ? undefined : 'Immersif'}>
        <Clapperboard />
      </Tool>
      {!panels.inspector && (
        <>
          <Rule />
          <Tool label="Afficher l'inspecteur" shortcut="Tab" onClick={() => ui.togglePanel('inspector')}>
            <PanelRight />
          </Tool>
        </>
      )}
    </div>
  )
}

function AddMenu({ compact }: { compact?: boolean }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          aria-label="Ajouter un objet"
          title={compact ? 'Ajouter un objet' : undefined}
          className="inline-flex h-7 items-center gap-1.5 rounded-sm px-2 text-[12px] font-medium text-aurum-hi transition-colors hover:bg-aurum/[0.1] data-[state=open]:bg-aurum/[0.12]"
        >
          <Plus className="size-4" strokeWidth={1.8} />
          {!compact && 'Ajouter'}
        </button>
      </MenuTrigger>
      <MenuContent align="start" className="w-[290px]">
        {['Corps célestes', 'Artificiels', 'Repères'].map((g, gi) => (
          <div key={g}>
            {gi > 0 && <MenuSeparator />}
            <MenuLabel>{g}</MenuLabel>
            {ADD_KINDS.filter((k) => k.group === g).map((k) => {
              const Icon = ADD_ICON[k.kind]
              return (
                <RMenu.Item
                  key={k.kind}
                  onSelect={() => useUIStore.getState().setPlacing(k.kind)}
                  className="flex h-9 cursor-default select-none items-center gap-3 rounded-sm px-2 outline-none data-[highlighted]:bg-white/[0.07]"
                >
                  <Icon className="size-[15px] shrink-0 text-ink-3" strokeWidth={1.6} />
                  <span className="min-w-0">
                    <span className="block text-[12px] text-ink">{k.label}</span>
                    <span className="block truncate text-[10.5px] text-ink-3">{k.hint}</span>
                  </span>
                </RMenu.Item>
              )
            })}
          </div>
        ))}
      </MenuContent>
    </Menu>
  )
}
