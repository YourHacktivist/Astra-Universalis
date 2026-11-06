import { AlertTriangle } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { Button, Dialog } from '../kit'

export function ConfirmDialog() {
  const confirm = useUIStore((s) => s.confirm)
  const resolve = useUIStore((s) => s.resolveConfirm)
  if (!confirm) return null
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && resolve(confirm.cancelId)}
      title={confirm.title}
      subtitle={confirm.message}
      icon={<AlertTriangle />}
      width={460}
      footer={
        <>
          {[...confirm.actions].reverse().map((a) => (
            <Button
              key={a.id}
              variant={a.tone === 'primary' ? 'primary' : a.tone === 'danger' ? 'danger' : 'ghost'}
              onClick={() => resolve(a.id)}
              autoFocus={a.tone === 'primary'}
            >
              {a.label}
            </Button>
          ))}
        </>
      }
    >
      <p className="text-[12.5px] leading-relaxed text-ink-2">Que souhaitez-vous faire ?</p>
    </Dialog>
  )
}
