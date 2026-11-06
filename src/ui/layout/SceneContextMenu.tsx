import { DropdownMenu as RMenu } from 'radix-ui'
import { useActiveSystem } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import { bodyActions, emptySpaceActions, renderMenuEntries } from '../bodyActions'
import { BodyIcon } from '../icons'

export function SceneContextMenu() {
  const menu = useUIStore((s) => s.contextMenu)
  const system = useActiveSystem()
  const mode = useUIStore((s) => s.mode)
  if (!menu || !system || mode !== 'system') return null
  const body = menu.bodyId ? system.bodies[menu.bodyId] : null
  const entries = body ? bodyActions(body, system, { onRename: () => useUIStore.getState().requestRename(body.id) }) : emptySpaceActions({ x: menu.x, y: menu.y })
  return (
    <RMenu.Root key={`${menu.x},${menu.y},${menu.bodyId}`} open onOpenChange={(o) => !o && useUIStore.getState().openContextMenu(null)} modal={false}>
      <RMenu.Trigger asChild>
        <span className="pointer-events-none fixed size-px" style={{ left: menu.x, top: menu.y }} />
      </RMenu.Trigger>
      <RMenu.Portal>
        <RMenu.Content
          align="start"
          side="bottom"
          sideOffset={2}
          collisionPadding={10}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="glass-pop z-[140] min-w-[230px] animate-scale-in rounded-xl p-1 text-[12px]"
        >
          {body && (
            <div className="mb-1 flex items-center gap-2 border-b border-line px-2 pb-2 pt-1.5">
              <BodyIcon body={body} size={15} />
              <span className="truncate font-display text-[15px] font-semibold tracking-wide text-ink">{body.name}</span>
            </div>
          )}
          {renderMenuEntries(entries)}
        </RMenu.Content>
      </RMenu.Portal>
    </RMenu.Root>
  )
}
