import { useMemo, useState } from 'react'
import { Command } from 'cmdk'
import { Dialog as RDialog } from 'radix-ui'
import { CornerDownLeft, Search } from 'lucide-react'
import { addBody, focusBody } from '@/app/actions'
import { KIND_LABEL } from '@/core/labels'
import { useActiveSystem } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import { ADD_KINDS } from './bodyActions'
import { getCommands } from './commands'
import { ADD_ICON, BodyIcon } from './icons'
import { Kbd } from './kit'

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function paletteFilter(value: string, search: string, keywords?: string[]) {
  const q = strip(search.trim())
  if (!q) return 1
  const hay = strip(`${value.split('|')[0]} ${(keywords ?? []).join(' ')}`)
  if (hay.includes(q)) return hay.startsWith(q) || hay.includes(` ${q}`) ? 1 : 0.8
  let i = 0
  for (const ch of hay) if (ch === q[i]) i++
  return i === q.length ? 0.15 : 0
}

const ITEM =
  'flex h-9 cursor-default select-none items-center gap-3 rounded-lg px-2.5 text-[12.5px] text-ink-2 outline-none data-[selected=true]:bg-white/[0.07] data-[selected=true]:text-ink data-[disabled=true]:opacity-40 [&_svg]:size-4 [&_svg]:stroke-[1.6] [&_svg]:text-ink-3'
const GROUP =
  '[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3'

export function CommandPalette() {
  const open = useUIStore((s) => s.commandOpen)
  const setOpen = useUIStore((s) => s.setCommandOpen)
  return (
    <RDialog.Root open={open} onOpenChange={setOpen}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-[170] animate-fade-in bg-[#020308]/50" />
        <RDialog.Content
          className="glass-pop fixed left-1/2 top-[14vh] z-[171] w-[min(620px,calc(100vw-48px))] -translate-x-1/2 animate-scale-in overflow-hidden rounded-2xl outline-none"
          onKeyDown={(e) => e.stopPropagation()}
        >
          <RDialog.Title className="sr-only">Palette de commandes</RDialog.Title>
          <RDialog.Description className="sr-only">Rechercher une commande ou un objet</RDialog.Description>
          {open && <PaletteBody close={() => setOpen(false)} />}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

function PaletteBody({ close }: { close(): void }) {
  const system = useActiveSystem()
  const playerMode = useUIStore((s) => s.playerMode)
  const [search, setSearch] = useState('')
  const commands = useMemo(() => getCommands(), [])
  const groups = useMemo(() => {
    const m = new Map<string, typeof commands>()
    for (const c of commands) {
      const arr = m.get(c.group) ?? []
      arr.push(c)
      m.set(c.group, arr)
    }
    return [...m.entries()]
  }, [commands])
  const bodies = useMemo(
    () => (system ? Object.values(system.bodies).filter((b) => !playerMode || b.playerVisible) : []),
    [system, playerMode],
  )
  const run = (fn: () => void) => {
    close()
    requestAnimationFrame(fn)
  }

  return (
    <Command label="Palette de commandes" loop filter={paletteFilter} className="flex max-h-[min(560px,70vh)] flex-col">
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search className="size-4 shrink-0 text-ink-3" />
        <Command.Input
          value={search}
          onValueChange={setSearch}
          autoFocus
          placeholder="Rechercher une commande, un astre…"
          className="h-12 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3"
        />
        <Kbd>Échap</Kbd>
      </div>
      <Command.List className="min-h-0 flex-1 overflow-y-auto p-1.5">
        <Command.Empty className="px-3 py-8 text-center text-[12px] text-ink-3">Aucun résultat pour « {search} ».</Command.Empty>

        {bodies.length > 0 && (
          <Command.Group heading="Aller à" className={GROUP}>
            {bodies.map((b) => (
              <Command.Item
                key={b.id}
                value={`${b.name}|${b.id}`}
                keywords={[KIND_LABEL[b.kind], ...b.tags]}
                onSelect={() =>
                  run(() => {
                    useUIStore.getState().select(b.id)
                    focusBody(b.id, true)
                  })
                }
                className={ITEM}
              >
                <BodyIcon body={b} size={16} />
                <span className="flex-1 truncate">{b.name}</span>
                <span className="text-[10.5px] text-ink-3">{KIND_LABEL[b.kind]}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        <Command.Group heading="Ajouter" className={GROUP}>
          {ADD_KINDS.map((k) => {
            const Icon = ADD_ICON[k.kind]
            return (
              <Command.Item key={k.kind} value={`Ajouter ${k.label}|add-${k.kind}`} keywords={[k.hint]} onSelect={() => run(() => void addBody(k.kind))} className={ITEM}>
                <Icon />
                <span className="flex-1">Ajouter : {k.label}</span>
                <span className="truncate text-[10.5px] text-ink-3">{k.hint}</span>
              </Command.Item>
            )
          })}
        </Command.Group>

        {groups.map(([group, cmds]) => (
          <Command.Group key={group} heading={group} className={GROUP}>
            {cmds.map((c) => {
              const Icon = c.icon
              const disabled = c.enabled ? !c.enabled() : false
              return (
                <Command.Item
                  key={c.id}
                  value={`${c.label}|${c.id}`}
                  keywords={c.keywords ? [c.keywords] : undefined}
                  disabled={disabled}
                  onSelect={() => run(c.run)}
                  className={ITEM}
                >
                  {Icon ? <Icon /> : <span className="size-4" />}
                  <span className="flex-1 truncate">{c.label}</span>
                  {c.shortcut && <Kbd>{c.shortcut}</Kbd>}
                </Command.Item>
              )
            })}
          </Command.Group>
        ))}
      </Command.List>
      <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[10.5px] text-ink-3">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> naviguer
        </span>
        <span className="flex items-center gap-1">
          <Kbd>
            <CornerDownLeft className="size-2.5" />
          </Kbd>{' '}
          valider
        </span>
        <span className="ml-auto font-display text-[12px] italic">Astra Universalis</span>
      </div>
    </Command>
  )
}
