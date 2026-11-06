import { useEffect, useState, type ReactNode } from 'react'
import { createProject } from '@/core/defaults'
import type { StarSystem } from '@/core/types'
import { useProjectStore } from '@/store/projectStore'
import { useSimStore } from '@/store/simStore'
import { useUIStore } from '@/store/uiStore'
import { SystemCanvas } from '@/three/SystemCanvas'
import { TooltipProvider } from '@/ui/kit'

export function LabShell({ system, children, time = 0 }: { system: StarSystem; children?: ReactNode; time?: number }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(globalThis, { __astraStore: useProjectStore, __astraUI: useUIStore, __astraSim: useSimStore })
    useProjectStore.getState().load(createProject('Lab', system), null)
    useSimStore.getState().setTime(time)
    useUIStore.getState().setShowHome(false)
    setReady(true)
  }, [system, time])
  return (
    <TooltipProvider>
      <div className="fixed inset-0 bg-void">
        {ready && <SystemCanvas />}
        {children && <div data-lab-panel className="glass absolute right-3 top-3 z-10 max-h-[calc(100vh-24px)] w-[300px] overflow-y-auto rounded-2xl p-3">{children}</div>}
      </div>
    </TooltipProvider>
  )
}
