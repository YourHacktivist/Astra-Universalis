import { Keyboard } from 'lucide-react'
import { Dialog, Kbd } from '../kit'
import { SHORTCUT_GROUPS } from '../shortcuts'

export function ShortcutsDialog({ onClose }: { onClose(): void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Raccourcis clavier" subtitle="Tout se fait aussi à la souris : ces raccourcis vont simplement plus vite." icon={<Keyboard />} width={720}>
      <div className="grid grid-cols-2 gap-x-8 gap-y-5">
        {SHORTCUT_GROUPS.map((g) => (
          <div key={g.title}>
            <div className="eyebrow mb-2">{g.title}</div>
            <div className="space-y-1">
              {g.items.map(([k, label]) => (
                <div key={k + label} className="flex items-center justify-between gap-3 border-b border-line/60 py-1 last:border-0">
                  <span className="text-[12px] text-ink-2">{label}</span>
                  <span className="flex shrink-0 gap-1">
                    {k.split('+').map((part) => (
                      <Kbd key={part}>{part}</Kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  )
}
