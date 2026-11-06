import { Check, ChevronsUpDown, Copy, FilePlus, Pencil, Trash2, WandSparkles } from 'lucide-react'
import { addSystemToProject, switchSystem } from '@/app/actions'
import { createStarterSystem } from '@/core/defaults'
import { uid } from '@/lib/id'
import { useActiveSystem, useProjectStore } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '../kit'

export function SystemSwitcher() {
  const system = useActiveSystem()
  const project = useProjectStore((s) => s.project)
  if (!system) return null
  const systems = project.systemOrder.map((id) => project.systems[id]).filter(Boolean)
  const index = project.systemOrder.indexOf(system.id) + 1

  const duplicate = () => {
    const copy = structuredClone(system)
    copy.id = uid('sys')
    copy.name = `${system.name} (copie)`
    addSystemToProject(copy)
  }

  const remove = async () => {
    const choice = await useUIStore.getState().askConfirm({
      title: `Supprimer « ${system.name} » ?`,
      message: 'Le système et tous ses objets seront retirés du projet (annulable avec Ctrl+Z).',
      actions: [
        { id: 'delete', label: 'Supprimer', tone: 'danger' },
        { id: 'cancel', label: 'Annuler', tone: 'secondary' },
      ],
      cancelId: 'cancel',
    })
    if (choice !== 'delete') return
    const next = project.systemOrder.find((id) => id !== system.id)
    useProjectStore.getState().removeSystem(system.id)
    if (next) switchSystem(next)
  }

  return (
    <Menu>
      <MenuTrigger asChild>
        <button className="group flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-white/[0.05] data-[state=open]:bg-white/[0.06]">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="eyebrow !text-[9px]">Système</span>
              {systems.length > 1 && (
                <span className="font-mono text-[9px] text-ink-3">
                  {index}/{systems.length}
                </span>
              )}
            </div>
            <div className="truncate font-display text-[19px] font-semibold leading-tight tracking-wide text-ink">{system.name}</div>
            {system.designation && <div className="truncate font-mono text-[10px] text-ink-3">{system.designation}</div>}
          </div>
          <ChevronsUpDown className="size-4 shrink-0 text-ink-3 group-hover:text-ink-2" />
        </button>
      </MenuTrigger>
      <MenuContent align="start" className="w-[260px]">
        <MenuLabel>Systèmes du projet</MenuLabel>
        {systems.map((s) => (
          <MenuItem key={s.id} icon={s.id === system.id ? <Check className="!text-aurum" /> : <span className="size-[15px]" />} onSelect={() => s.id !== system.id && switchSystem(s.id)}>
            {s.name}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem icon={<FilePlus />} onSelect={() => addSystemToProject(createStarterSystem('Nouveau système'))}>
          Ajouter un système vierge
        </MenuItem>
        <MenuItem icon={<WandSparkles />} onSelect={() => useUIStore.getState().openDialog('generator')}>
          Générer un système…
        </MenuItem>
        <MenuItem icon={<Copy />} onSelect={duplicate}>
          Dupliquer ce système
        </MenuItem>
        <MenuItem
          icon={<Pencil />}
          onSelect={() => {
            useUIStore.getState().select(null)
            useUIStore.setState({ panels: { ...useUIStore.getState().panels, inspector: true } })
          }}
        >
          Renommer / réglages…
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<Trash2 />} tone="danger" disabled={systems.length < 2} onSelect={() => void remove()}>
          Supprimer ce système
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
