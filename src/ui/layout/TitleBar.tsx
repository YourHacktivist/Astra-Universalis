import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { FolderClock, Galaxy, ScrollText, Sparkles } from 'lucide-react'
import { openRecent } from '@/app/actions'
import { bridge, platform, type RecentEntry } from '@/lib/platform'
import { useActiveSystem, useCanRedo, useCanUndo, useProjectStore } from '@/store/projectStore'
import { useUIStore, type AppMode } from '@/store/uiStore'
import { getCommands, setMode, VIEW_TOGGLES, type Command } from '../commands'
import { Menu, MenuCheckItem, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuSub, MenuTrigger, Tooltip } from '../kit'
import { QUALITY_OPTIONS, RENDER_STYLES } from './ViewOptions'

function CmdItem({ c }: { c: Command | undefined }) {
  if (!c) return null
  const Icon = c.icon
  return (
    <MenuItem icon={Icon ? <Icon /> : <span className="size-[15px]" />} shortcut={c.shortcut} onSelect={c.run} disabled={c.enabled ? !c.enabled() : false}>
      {c.label}
    </MenuItem>
  )
}

function useCmds() {
  const cmds = getCommands()
  return (id: string) => cmds.find((c) => c.id === id)
}

function MenuButton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <button className="h-7 rounded-md px-2.5 text-[12px] text-ink-2 transition-colors hover:bg-white/[0.06] hover:text-ink data-[state=open]:bg-white/[0.08] data-[state=open]:text-ink">
          {label}
        </button>
      </MenuTrigger>
      <MenuContent align="start" className="w-[270px]">
        {children}
      </MenuContent>
    </Menu>
  )
}

function FileMenu() {
  const cmd = useCmds()
  const [recent, setRecent] = useState<RecentEntry[]>([])
  return (
    <Menu onOpenChange={(o) => o && void platform.recentList().then(setRecent)}>
      <MenuTrigger asChild>
        <button className="h-7 rounded-md px-2.5 text-[12px] text-ink-2 transition-colors hover:bg-white/[0.06] hover:text-ink data-[state=open]:bg-white/[0.08] data-[state=open]:text-ink">
          Fichier
        </button>
      </MenuTrigger>
      <MenuContent align="start" className="w-[280px]">
        <CmdItem c={cmd('file.new')} />
        <CmdItem c={cmd('file.generate')} />
        <MenuSub label="Modèles" icon={<Sparkles />}>
          <CmdItem c={cmd('file.demo')} />
          <CmdItem c={cmd('file.sol')} />
          <CmdItem c={cmd('file.binary')} />
          <CmdItem c={cmd('file.blackhole')} />
        </MenuSub>
        <MenuSeparator />
        <CmdItem c={cmd('file.open')} />
        <MenuSub label="Fichiers récents" icon={<FolderClock />}>
          {recent.length === 0 && <MenuItem disabled>Aucun fichier récent</MenuItem>}
          {recent.map((r) => (
            <MenuItem key={r.path} disabled={r.exists === false} onSelect={() => void openRecent(r.path)}>
              <span className="flex flex-col">
                <span>{r.name}</span>
                <span className="max-w-[260px] truncate text-[10px] text-ink-3">{r.path}</span>
              </span>
            </MenuItem>
          ))}
        </MenuSub>
        <MenuSeparator />
        <CmdItem c={cmd('file.save')} />
        <CmdItem c={cmd('file.saveAs')} />
        <MenuSeparator />
        <CmdItem c={cmd('file.exportImage')} />
        <CmdItem c={cmd('file.exportSystem')} />
        <CmdItem c={cmd('file.import')} />
        <MenuSeparator />
        <CmdItem c={cmd('file.home')} />
      </MenuContent>
    </Menu>
  )
}

function EditMenu() {
  const cmd = useCmds()
  useCanUndo()
  useCanRedo()
  return (
    <MenuButton label="Édition">
      <CmdItem c={cmd('edit.undo')} />
      <CmdItem c={cmd('edit.redo')} />
      <MenuSeparator />
      <CmdItem c={cmd('edit.duplicate')} />
      <CmdItem c={cmd('edit.delete')} />
      <MenuSeparator />
      <MenuItem shortcut="Ctrl+K" onSelect={() => useUIStore.getState().setCommandOpen(true)}>
        Palette de commandes…
      </MenuItem>
    </MenuButton>
  )
}

function ViewMenu() {
  const cmd = useCmds()
  const view = useUIStore((s) => s.view)
  const panels = useUIStore((s) => s.panels)
  const playerMode = useUIStore((s) => s.playerMode)
  const style = useUIStore((s) => s.renderStyle)
  const quality = useUIStore((s) => s.quality)
  const ui = useUIStore.getState()
  return (
    <MenuButton label="Affichage">
      <CmdItem c={cmd('view.immersive')} />
      <MenuSeparator />
      <CmdItem c={cmd('view.focus')} />
      <CmdItem c={cmd('view.frame')} />
      <MenuSub label="Angle de vue">
        <CmdItem c={cmd('view.top')} />
        <CmdItem c={cmd('view.side')} />
        <CmdItem c={cmd('view.iso')} />
      </MenuSub>
      <MenuSeparator />
      <MenuSub label="Repères & effets">
        {VIEW_TOGGLES.map((t) => (
          <MenuCheckItem key={t.key} checked={!!view[t.key]} onChange={() => ui.toggleView(t.key)} shortcut={t.shortcut}>
            {t.label}
          </MenuCheckItem>
        ))}
      </MenuSub>
      <MenuSub label="Style de rendu">
        {RENDER_STYLES.map((s) => (
          <MenuCheckItem key={s.value} checked={style === s.value} onChange={() => ui.setRenderStyle(s.value)}>
            {s.label}
          </MenuCheckItem>
        ))}
      </MenuSub>
      <MenuSub label="Qualité">
        {QUALITY_OPTIONS.map((q) => (
          <MenuCheckItem key={q.value} checked={quality === q.value} onChange={() => ui.setQuality(q.value)}>
            {q.label}
          </MenuCheckItem>
        ))}
      </MenuSub>
      <MenuSeparator />
      <MenuCheckItem checked={panels.hierarchy} onChange={() => ui.togglePanel('hierarchy')}>
        Hiérarchie
      </MenuCheckItem>
      <MenuCheckItem checked={panels.inspector} onChange={() => ui.togglePanel('inspector')}>
        Inspecteur
      </MenuCheckItem>
      <MenuCheckItem checked={playerMode} onChange={(v) => ui.setPlayerMode(v)} shortcut="Ctrl+Maj+P">
        Mode joueurs
      </MenuCheckItem>
      {bridge && (
        <>
          <MenuSeparator />
          <CmdItem c={cmd('win.fullscreen')} />
        </>
      )}
    </MenuButton>
  )
}

function ToolsMenu() {
  const cmd = useCmds()
  return (
    <MenuButton label="Outils">
      <CmdItem c={cmd('file.generate')} />
      <CmdItem c={cmd('tools.travel')} />
      <MenuSeparator />
      <CmdItem c={cmd('mode.sheet')} />
      <CmdItem c={cmd('mode.galaxy')} />
      <MenuSeparator />
      <CmdItem c={cmd('tools.settings')} />
      {bridge && <CmdItem c={cmd('win.devtools')} />}
    </MenuButton>
  )
}

function HelpMenu() {
  const cmd = useCmds()
  return (
    <MenuButton label="Aide">
      <CmdItem c={cmd('help.shortcuts')} />
      <MenuItem shortcut="Ctrl+K" onSelect={() => useUIStore.getState().setCommandOpen(true)}>
        Palette de commandes
      </MenuItem>
      <MenuSeparator />
      <MenuLabel>Astra Universalis</MenuLabel>
      <CmdItem c={cmd('help.about')} />
    </MenuButton>
  )
}

function DocumentName() {
  const projectName = useProjectStore((s) => s.project.name)
  const example = useProjectStore((s) => s.example)
  const dirty = useProjectStore((s) => s.dirty) && !example
  const filePath = useProjectStore((s) => s.filePath)
  const system = useActiveSystem()
  const mode = useUIStore((s) => s.mode)
  const [editing, setEditing] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (editing) input.current?.select()
  }, [editing])

  const commit = (v: string) => {
    const name = v.trim()
    if (name && name !== projectName) useProjectStore.getState().rename(name)
    setEditing(false)
  }

  return (
    <div className="flex min-w-0 items-center gap-2 text-[12px]">
      {editing ? (
        <input
          ref={input}
          defaultValue={projectName}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') commit((e.target as HTMLInputElement).value)
            if (e.key === 'Escape') setEditing(false)
          }}
          className="h-6 w-[220px] rounded-md border border-aurum/50 bg-black/40 px-2 text-center text-[12px] text-ink outline-none"
        />
      ) : (
        <Tooltip content={filePath ?? 'Non enregistré. Double-cliquez pour renommer le projet'} side="bottom">
          <button onDoubleClick={() => setEditing(true)} className="max-w-[260px] truncate rounded-md px-1.5 py-0.5 text-ink-2 transition-colors hover:bg-white/[0.05] hover:text-ink">
            {projectName}
          </button>
        </Tooltip>
      )}
      {system && mode !== 'galaxy' && (
        <>
          <span className="text-ink-3">/</span>
          <span className="max-w-[200px] truncate font-display text-[14px] font-semibold tracking-wide text-ink">{system.name}</span>
        </>
      )}
      <Tooltip
        content={example ? 'Exemple : enregistrez-le (Ctrl+S) pour en faire votre projet' : dirty ? 'Modifications non enregistrées (Ctrl+S)' : 'Enregistré'}
        side="bottom"
      >
        <span
          className={clsx(
            'size-1.5 shrink-0 rounded-full transition-colors',
            dirty ? 'bg-aurum' : 'bg-white/15',
          )}
        />
      </Tooltip>
    </div>
  )
}

const MODES: { value: AppMode; label: string; icon: React.ReactNode }[] = [
  { value: 'system', label: 'Système', icon: <Sparkles /> },
  { value: 'galaxy', label: 'Galaxie', icon: <Galaxy /> },
  { value: 'sheet', label: 'Fiche', icon: <ScrollText /> },
]

function ModeSwitch() {
  const mode = useUIStore((s) => s.mode)
  return (
    <div className="flex h-full items-stretch" role="tablist" aria-label="Mode d'affichage">
      {MODES.map((m) => (
        <button
          key={m.value}
          role="tab"
          aria-selected={mode === m.value}
          onClick={() => setMode(m.value)}
          className={clsx(
            'relative flex items-center gap-1.5 px-3 text-[12px] transition-colors [&_svg]:size-3.5',
            mode === m.value ? 'text-ink [&_svg]:text-aurum' : 'text-ink-3 hover:text-ink-2',
          )}
        >
          {m.icon}
          {m.label}
          {mode === m.value && <span className="absolute inset-x-2 bottom-0 h-[2px] bg-aurum" />}
        </button>
      ))}
    </div>
  )
}

export function TitleBar() {
  const nativeControls = platform.isElectron && bridge?.platform !== 'darwin'
  const mac = bridge?.platform === 'darwin'
  return (
    <header
      className={clsx(
        'relative z-50 flex h-10 shrink-0 items-stretch gap-1 border-b border-line bg-void pl-3',
        nativeControls ? 'pr-[148px]' : 'pr-3',
        mac && 'pl-[82px]',
      )}
    >
      <button
        onClick={() => useUIStore.getState().setShowHome(true)}
        className="group my-auto mr-2 flex items-center gap-2 rounded-lg py-1 pl-0.5 pr-2 transition-colors hover:bg-white/[0.04]"
        title="Écran d'accueil"
      >
        <img src="./brand/logo-night-128.png" alt="" className="size-[26px] transition-transform duration-300 group-hover:rotate-[-8deg]" draggable={false} />
        <span className="whitespace-nowrap font-display text-[15.5px] font-semibold tracking-[0.06em] text-ink max-[960px]:hidden">Astra Universalis</span>
      </button>
      <nav className="flex items-center">
        <FileMenu />
        <EditMenu />
        <ViewMenu />
        <ToolsMenu />
        <HelpMenu />
      </nav>
      <div className="drag flex-1" />
      <div className="flex items-center max-[1240px]:hidden">
        <DocumentName />
      </div>
      <div className="drag flex-1" />
      <ModeSwitch />
    </header>
  )
}
