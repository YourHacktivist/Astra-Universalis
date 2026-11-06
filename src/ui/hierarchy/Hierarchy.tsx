import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { ChevronRight, Eye, EyeOff, Lock, Plus, Route as RouteIcon, Search, UserX, Users, X } from 'lucide-react'
import { addBody, addRoute, focusBody } from '@/app/actions'
import { buildChildrenMap, isSelfOrDescendant } from '@/core/hierarchy'
import type { Body, Id, StarSystem } from '@/core/types'
import { useActiveSystem, useProjectStore } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import { ADD_KINDS, bodyActions, renderContextEntries } from '../bodyActions'
import { ADD_ICON, BodyIcon } from '../icons'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from '../kit'
import { SystemSwitcher } from './SystemSwitcher'

type DropPos = 'before' | 'after' | 'inside'
const INDENT = 14

export function Hierarchy() {
  const system = useActiveSystem()
  if (!system) return null
  return <HierarchyInner system={system} />
}

function HierarchyInner({ system }: { system: StarSystem }) {
  const playerMode = useUIStore((s) => s.playerMode)
  const selectedId = useUIStore((s) => s.selectedId)
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<Id>>(() => new Set())
  const [renaming, setRenaming] = useState<Id | null>(null)
  const [drag, setDrag] = useState<Id | null>(null)
  const [drop, setDrop] = useState<{ id: Id | null; pos: DropPos } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const children = useMemo(() => buildChildrenMap(system.bodies), [system.bodies])

  const hidden = useMemo(() => {
    const out = new Set<Id>()
    if (!playerMode) return out
    const walk = (pid: Id | null, hide: boolean) => {
      for (const c of children.get(pid) ?? []) {
        const h = hide || !c.playerVisible
        if (h) out.add(c.id)
        walk(c.id, h)
      }
    }
    walk(null, false)
    return out
  }, [children, playerMode])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    const keep = new Set<Id>()
    for (const b of Object.values(system.bodies)) {
      if (hidden.has(b.id)) continue
      const hay = `${b.name} ${b.tags.join(' ')}`.toLowerCase()
      if (!hay.includes(q)) continue
      let cur: Body | undefined = b
      let guard = 0
      while (cur && guard++ < 64) {
        keep.add(cur.id)
        cur = cur.parentId ? system.bodies[cur.parentId] : undefined
      }
    }
    return keep
  }, [query, system.bodies, hidden])

  useEffect(() => {
    if (!selectedId) return
    let cur = system.bodies[selectedId]?.parentId
    let changed = false
    const next = new Set(collapsed)
    let guard = 0
    while (cur && guard++ < 64) {
      if (next.delete(cur)) changed = true
      cur = system.bodies[cur]?.parentId ?? null
    }
    if (changed) setCollapsed(next)
    requestAnimationFrame(() => {
      listRef.current?.querySelector(`[data-body="${selectedId}"]`)?.scrollIntoView({ block: 'nearest' })
    })
  }, [selectedId])

  const toggle = useCallback((id: Id) => {
    setCollapsed((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }, [])

  const rows = useMemo(() => {
    const out: { body: Body; depth: number; hasChildren: boolean; guides: boolean[] }[] = []
    const walk = (pid: Id | null, depth: number, guides: boolean[]) => {
      const list = (children.get(pid) ?? []).filter((c) => !hidden.has(c.id) && (!matches || matches.has(c.id)))
      list.forEach((c, i) => {
        const kids = (children.get(c.id) ?? []).filter((k) => !hidden.has(k.id))
        const last = i === list.length - 1
        out.push({ body: c, depth, hasChildren: kids.length > 0, guides })
        if (kids.length && (matches || !collapsed.has(c.id))) walk(c.id, depth + 1, [...guides, !last])
      })
    }
    walk(null, 0, [])
    return out
  }, [children, hidden, matches, collapsed])

  const applyDrop = useCallback(
    (dragId: Id, target: { id: Id | null; pos: DropPos }) => {
      const bodies = system.bodies
      if (target.id && isSelfOrDescendant(bodies, dragId, target.id)) return
      if (target.pos === 'inside' || target.id === null) {
        useProjectStore.getState().reparentBody(dragId, target.id)
        if (target.id) setCollapsed((s) => {
          const n = new Set(s)
          n.delete(target.id!)
          return n
        })
        return
      }
      const tgt = bodies[target.id]
      if (!tgt) return
      const parentId = tgt.parentId
      if (parentId && isSelfOrDescendant(bodies, dragId, parentId)) return
      useProjectStore.getState().updateSystem((s) => {
        const moving = s.bodies[dragId]
        if (!moving) return
        const siblings = Object.values(s.bodies)
          .filter((b) => b.parentId === parentId && b.id !== dragId)
          .sort((a, b) => a.order - b.order || (a.orbit?.a ?? 0) - (b.orbit?.a ?? 0))
        let idx = siblings.findIndex((b) => b.id === target.id)
        if (target.pos === 'after') idx++
        siblings.splice(Math.max(0, idx), 0, moving)
        moving.parentId = parentId
        siblings.forEach((b, i) => (b.order = i + 1))
      })
    },
    [system.bodies],
  )

  const count = Object.keys(system.bodies).length - hidden.size

  return (
    <div className="flex h-full flex-col">
      <div className="px-2 pb-2 pt-2">
        <SystemSwitcher />
        <div className="mt-2 flex items-center gap-1.5 px-1">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Escape') setQuery('')
              }}
              placeholder="Rechercher…"
              className="h-7 w-full rounded-lg border border-line bg-white/[0.035] pl-7 pr-6 text-[12px] text-ink outline-none transition-colors placeholder:text-ink-3 hover:border-line-strong focus:border-aurum/50"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-3 hover:text-ink">
                <X className="size-3" />
              </button>
            )}
          </div>
          <AddMenu />
        </div>
      </div>
      <div className="hairline mx-3 opacity-60" />

      <div
        ref={listRef}
        role="tree"
        aria-label="Objets du système"
        tabIndex={useUIStore.getState().selectedId && rows.some((r) => r.body.id === useUIStore.getState().selectedId) ? -1 : 0}
        onKeyDown={(e) => {
          if ((e.target as HTMLElement).tagName === 'INPUT') return
          const ui = useUIStore.getState()
          const idx = rows.findIndex((r) => r.body.id === ui.selectedId)
          const focusRow = (i: number) => {
            const r = rows[Math.max(0, Math.min(rows.length - 1, i))]
            if (!r) return
            ui.select(r.body.id)
            requestAnimationFrame(() => (listRef.current?.querySelector(`[data-body="${r.body.id}"]`) as HTMLElement | null)?.focus())
          }
          const cur = idx >= 0 ? rows[idx] : null
          switch (e.key) {
            case 'ArrowDown':
              e.preventDefault()
              focusRow(idx + 1)
              break
            case 'ArrowUp':
              e.preventDefault()
              focusRow(idx < 0 ? 0 : idx - 1)
              break
            case 'Home':
              e.preventDefault()
              e.stopPropagation()
              focusRow(0)
              break
            case 'End':
              e.preventDefault()
              focusRow(rows.length - 1)
              break
            case 'ArrowRight':
              if (!cur) return
              e.preventDefault()
              if (cur.hasChildren && collapsed.has(cur.body.id)) toggle(cur.body.id)
              else if (cur.hasChildren) focusRow(idx + 1)
              break
            case 'ArrowLeft': {
              if (!cur) return
              e.preventDefault()
              if (cur.hasChildren && !collapsed.has(cur.body.id)) toggle(cur.body.id)
              else if (cur.body.parentId) focusRow(rows.findIndex((r) => r.body.id === cur.body.parentId))
              break
            }
            case 'Enter':
              if (!cur) return
              e.preventDefault()
              focusBody(cur.body.id)
              break
          }
        }}
        className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5"
        onDragOver={(e) => {
          if (!drag) return
          if (e.target === e.currentTarget) {
            e.preventDefault()
            setDrop({ id: null, pos: 'inside' })
          }
        }}
        onDrop={(e) => {
          e.preventDefault()
          if (drag && drop) applyDrop(drag, drop)
          setDrag(null)
          setDrop(null)
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) useUIStore.getState().select(null)
        }}
      >
        {rows.length === 0 && <EmptyTree filtered={!!matches} />}
        {rows.map(({ body, depth, hasChildren, guides }) => (
          <TreeRow
            key={body.id}
            body={body}
            system={system}
            depth={depth}
            guides={guides}
            hasChildren={hasChildren}
            collapsed={!matches && collapsed.has(body.id)}
            onToggle={toggle}
            renaming={renaming === body.id}
            onRename={setRenaming}
            dragging={drag === body.id}
            dropPos={drop && drop.id === body.id ? drop.pos : null}
            onDragStart={(id) => setDrag(id)}
            onDragEnd={() => {
              setDrag(null)
              setDrop(null)
            }}
            onDragOverRow={(pos) => {
              if (!drag || drag === body.id) return setDrop(null)
              if (isSelfOrDescendant(system.bodies, drag, body.id)) return setDrop(null)
              setDrop({ id: body.id, pos })
            }}
            onDropRow={() => {
              if (drag && drop) applyDrop(drag, drop)
              setDrag(null)
              setDrop(null)
            }}
          />
        ))}
        {drag && (
          <div
            className={clsx(
              'mt-1 flex h-8 items-center justify-center rounded-lg border border-dashed text-[11px] transition-colors',
              drop?.id === null ? 'border-aurum/50 bg-aurum/[0.06] text-aurum-hi' : 'border-line-strong text-ink-3',
            )}
            onDragOver={(e) => {
              e.preventDefault()
              setDrop({ id: null, pos: 'inside' })
            }}
          >
            Déposer ici : objet racine
          </div>
        )}
      </div>

      <RoutesList system={system} />
      <div className="flex items-center justify-between border-t border-line px-3.5 py-2 font-mono text-[10px] text-ink-3">
        <span>
          {count} objet{count > 1 ? 's' : ''}
        </span>
        {playerMode && <span className="text-aurum">mode joueurs</span>}
      </div>
    </div>
  )
}

function EmptyTree({ filtered }: { filtered: boolean }) {
  if (filtered) return <div className="px-3 py-6 text-center text-[11.5px] text-ink-3">Aucun objet ne correspond.</div>
  return (
    <div className="mx-2 my-4 rounded-xl border border-dashed border-line-strong px-4 py-6 text-center">
      <div className="font-display text-[16px] text-ink-2">Le vide absolu.</div>
      <p className="mt-1 text-[11.5px] text-ink-3">Commencez par placer une étoile.</p>
      <button
        onClick={() => addBody('star')}
        className="mt-3 inline-flex h-7 items-center gap-1.5 rounded-lg border border-aurum/30 bg-aurum/10 px-3 text-[12px] text-aurum-hi hover:bg-aurum/15"
      >
        <Plus className="size-3.5" /> Ajouter une étoile
      </button>
    </div>
  )
}

function AddMenu() {
  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton label="Ajouter un objet" size="sm" tooltipSide="bottom">
          <Plus />
        </IconButton>
      </MenuTrigger>
      <MenuContent align="end" className="w-[240px]">
        {['Corps célestes', 'Artificiels', 'Repères'].map((g, gi) => (
          <div key={g}>
            {gi > 0 && <MenuSeparator />}
            <MenuLabel>{g}</MenuLabel>
            {ADD_KINDS.filter((k) => k.group === g).map((k) => {
              const Icon = ADD_ICON[k.kind]
              return (
                <MenuItem key={k.kind} icon={<Icon />} onSelect={() => useUIStore.getState().setPlacing(k.kind)}>
                  {k.label}
                </MenuItem>
              )
            })}
          </div>
        ))}
      </MenuContent>
    </Menu>
  )
}

interface RowProps {
  body: Body
  system: StarSystem
  depth: number
  guides: boolean[]
  hasChildren: boolean
  collapsed: boolean
  onToggle(id: Id): void
  renaming: boolean
  onRename(id: Id | null): void
  dragging: boolean
  dropPos: DropPos | null
  onDragStart(id: Id): void
  onDragEnd(): void
  onDragOverRow(pos: DropPos): void
  onDropRow(): void
}

const TreeRow = memo(function TreeRow(p: RowProps) {
  const { body } = p
  const selected = useUIStore((s) => s.selectedId === body.id)
  const hovered = useUIStore((s) => s.hoveredId === body.id)
  const following = useUIStore((s) => s.followId === body.id)

  const toggleVisible = (e: React.MouseEvent) => {
    e.stopPropagation()
    useProjectStore.getState().updateBody(body.id, (b) => void (b.visible = !b.visible))
  }
  const togglePlayer = (e: React.MouseEvent) => {
    e.stopPropagation()
    useProjectStore.getState().updateBody(body.id, (b) => void (b.playerVisible = !b.playerVisible))
  }

  return (
    <ContextMenu
      onOpenChange={(o) => {
        if (o) useUIStore.getState().select(body.id)
      }}
    >
      <ContextMenuTrigger asChild>
        <div
          data-body={body.id}
          draggable={!p.renaming}
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', body.id)
            e.dataTransfer.effectAllowed = 'move'
            p.onDragStart(body.id)
          }}
          onDragEnd={p.onDragEnd}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
            const f = (e.clientY - r.top) / r.height
            p.onDragOverRow(f < 0.28 ? 'before' : f > 0.72 ? 'after' : 'inside')
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            p.onDropRow()
          }}
          onClick={() => useUIStore.getState().select(body.id)}
          onDoubleClick={() => focusBody(body.id)}
          onPointerEnter={() => useUIStore.getState().hover(body.id)}
          onPointerLeave={() => useUIStore.getState().hover(null)}
          onKeyDown={(e) => {
            if (e.key === 'F2') {
              e.preventDefault()
              p.onRename(body.id)
            }
          }}
          role="treeitem"
          aria-level={p.depth + 1}
          aria-selected={selected}
          aria-expanded={p.hasChildren ? !p.collapsed : undefined}
          aria-label={`${body.name}${body.visible ? '' : ' (masqué)'}${body.playerVisible ? '' : ' (secret)'}`}
          tabIndex={selected ? 0 : -1}
          className={clsx(
            'group relative flex h-[28px] cursor-default items-center gap-1.5 rounded-lg pr-1 outline-none transition-colors duration-100',
            selected ? 'bg-aurum/[0.11] text-ink' : hovered ? 'bg-white/[0.045] text-ink' : 'text-ink-2 hover:bg-white/[0.04]',
            !body.visible && 'opacity-45',
            p.dragging && 'opacity-30',
            p.dropPos === 'inside' && 'ring-1 ring-inset ring-aurum/60 bg-aurum/[0.06]',
          )}
          style={{ paddingLeft: 6 + p.depth * INDENT }}
        >
          {selected && <span className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-aurum" />}
          {p.guides.map((show, i) =>
            show ? <span key={i} className="pointer-events-none absolute inset-y-0 w-px bg-white/[0.06]" style={{ left: 6 + i * INDENT + 7 }} /> : null,
          )}
          {p.dropPos === 'before' && <span className="pointer-events-none absolute inset-x-1 top-0 h-[2px] rounded-full bg-aurum" />}
          {p.dropPos === 'after' && <span className="pointer-events-none absolute inset-x-1 bottom-0 h-[2px] rounded-full bg-aurum" />}

          {p.hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                p.onToggle(body.id)
              }}
              className="flex size-4 shrink-0 items-center justify-center rounded text-ink-3 hover:text-ink"
            >
              <ChevronRight className={clsx('size-3 transition-transform duration-150', !p.collapsed && 'rotate-90')} />
            </button>
          ) : (
            <span className="size-4 shrink-0" />
          )}
          <BodyIcon body={body} size={14} />
          {p.renaming ? (
            <input
              autoFocus
              defaultValue={body.name}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== body.name) useProjectStore.getState().updateBody(body.id, (b) => void (b.name = v))
                p.onRename(null)
              }}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') p.onRename(null)
              }}
              className="h-5 min-w-0 flex-1 rounded border border-aurum/50 bg-black/30 px-1 text-[12px] text-ink outline-none"
            />
          ) : (
            <span
              className={clsx(
                'min-w-0 flex-1 truncate text-[12.5px]',
                body.kind === 'star' && 'font-display text-[14px] font-semibold tracking-wide',
                (body.kind === 'belt' || body.kind === 'nebula') && 'italic',
              )}
              onDoubleClick={(e) => {
                e.stopPropagation()
                p.onRename(body.id)
              }}
            >
              {body.name}
            </span>
          )}
          {following && <span className="size-1.5 shrink-0 animate-pulse-soft rounded-full bg-ion" title="Suivi" />}
          {body.locked && <Lock className="size-3 shrink-0 text-ink-3" />}
          {!body.playerVisible && (
            <button onClick={togglePlayer} title="Secret : masqué aux joueurs" className="shrink-0 rounded p-0.5 text-aurum/80 hover:text-aurum group-hover:hidden">
              <UserX className="size-3" />
            </button>
          )}
          <div className="hidden shrink-0 items-center group-hover:flex group-focus-within:flex">
            <button tabIndex={-1} onClick={togglePlayer} aria-label={body.playerVisible ? 'Rendre secret' : 'Révéler aux joueurs'} title={body.playerVisible ? 'Rendre secret' : 'Révéler aux joueurs'} className="rounded p-1 text-ink-3 hover:bg-white/10 hover:text-ink">
              {body.playerVisible ? <Users className="size-3" /> : <UserX className="size-3 text-aurum" />}
            </button>
            <button tabIndex={-1} onClick={toggleVisible} aria-label={body.visible ? 'Masquer' : 'Afficher'} title={body.visible ? 'Masquer' : 'Afficher'} className="rounded p-1 text-ink-3 hover:bg-white/10 hover:text-ink">
              {body.visible ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
            </button>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>{renderContextEntries(bodyActions(body, p.system, { onRename: () => p.onRename(body.id) }))}</ContextMenuContent>
    </ContextMenu>
  )
})

function RoutesList({ system }: { system: StarSystem }) {
  const selectedRoute = useUIStore((s) => s.selectedRouteId)
  const selectedId = useUIStore((s) => s.selectedId)
  const playerMode = useUIStore((s) => s.playerMode)
  const [open, setOpen] = useState(true)
  const routes = Object.values(system.routes).filter((r) => !playerMode || r.playerVisible)
  const from = selectedId ? system.bodies[selectedId] : null
  const targets = Object.values(system.bodies).filter((b) => b.id !== selectedId && b.kind !== 'belt' && b.kind !== 'nebula' && b.kind !== 'barycenter')

  return (
    <div className="border-t border-line">
      <div className="flex h-9 items-center gap-1.5 px-3">
        <button onClick={() => setOpen((o) => !o)} className="group flex flex-1 items-center gap-1.5 text-left">
          <ChevronRight className={clsx('size-3 text-ink-3 transition-transform', open && 'rotate-90')} />
          <RouteIcon className="size-3.5 text-ink-3" />
          <span className="eyebrow group-hover:text-ink-2">Routes</span>
          <span className="font-mono text-[10px] text-ink-3">{routes.length}</span>
        </button>
        <Menu>
          <MenuTrigger asChild>
            <IconButton label={from ? `Nouvelle route depuis ${from.name}` : 'Sélectionnez un objet de départ'} size="xs" disabled={!from}>
              <Plus />
            </IconButton>
          </MenuTrigger>
          <MenuContent align="end" className="max-h-[50vh] w-[240px] overflow-y-auto">
            <MenuLabel>Depuis {from?.name} vers…</MenuLabel>
            {targets.map((t) => (
              <MenuItem key={t.id} icon={<BodyIcon body={t} size={14} />} onSelect={() => from && addRoute(from.id, t.id)}>
                {t.name}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      </div>
      {open && (
        <div className="max-h-[132px] overflow-y-auto px-1.5 pb-1.5">
          {routes.length === 0 && <div className="px-3 pb-2 text-[11px] text-ink-3">Sélectionnez un objet puis « + » pour tracer une route.</div>}
          {routes.map((r) => (
            <div
              key={r.id}
              onClick={() => useUIStore.getState().selectRoute(r.id)}
              className={clsx(
                'group flex h-7 cursor-default items-center gap-2 rounded-lg px-2 text-[12px] transition-colors',
                selectedRoute === r.id ? 'bg-aurum/[0.11] text-ink' : 'text-ink-2 hover:bg-white/[0.04]',
                !r.visible && 'opacity-45',
              )}
            >
              <svg width="16" height="8" viewBox="0 0 16 8" className="shrink-0">
                <path d="M1 6 Q8 0 15 6" fill="none" stroke={r.color} strokeWidth="1.5" strokeDasharray={r.style === 'solid' ? undefined : r.style === 'dashed' ? '3 2' : '1 2'} />
              </svg>
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  useProjectStore.getState().updateRoute(r.id, (x) => void (x.visible = !x.visible))
                }}
                className="hidden rounded p-1 text-ink-3 hover:bg-white/10 hover:text-ink group-hover:block"
              >
                {r.visible ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
