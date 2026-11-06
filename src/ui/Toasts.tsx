import clsx from 'clsx'
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'

const ICONS = {
  info: <Info className="text-ion" />,
  success: <CheckCircle2 className="text-viridis" />,
  warning: <TriangleAlert className="text-aurum" />,
  error: <AlertCircle className="text-nova" />,
}

export function Toasts() {
  const toasts = useUIStore((s) => s.toasts)
  const dismiss = useUIStore((s) => s.dismissToast)
  return (
    <div className="pointer-events-none fixed bottom-24 right-4 z-[200] flex w-[340px] flex-col items-end gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={clsx('glass-pop pointer-events-auto flex w-full animate-rise-in items-start gap-3 rounded-xl px-3.5 py-3 [&_svg]:size-4')}
        >
          <span className="mt-0.5 shrink-0">{ICONS[t.kind]}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-medium text-ink">{t.title}</div>
            {t.message && <div className="mt-0.5 break-words text-[11.5px] leading-snug text-ink-2">{t.message}</div>}
          </div>
          <button onClick={() => dismiss(t.id)} className="-mr-1 shrink-0 rounded-md p-0.5 text-ink-3 hover:bg-white/10 hover:text-ink">
            <X className="!size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
