import { useEffect, useState } from 'react'
import { createProject } from '@/core/defaults'
import { createDemoSystem } from '@/core/demo'
import { generateGalaxy } from '@/core/galaxyGen'
import type { GalaxyShape } from '@/core/types'
import { GalaxyView } from '@/galaxy/GalaxyView'
import { useProjectStore } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import { TooltipProvider } from '@/ui/kit'
import { ConfirmDialog } from '@/ui/dialogs/ConfirmDialog'

export default function GalaxyLab() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const seed = params.get('seed') ?? 'ASTRA-GAL1'
    const shape = params.get('shape') as GalaxyShape | null
    const empty = params.get('empty') === '1'
    const p = createProject('Lab galaxie', createDemoSystem())
    p.galaxy = empty ? null : generateGalaxy(seed, 'Galaxie de test', {}, shape ? { shape } : {})
    useProjectStore.getState().load(p, null)
    useUIStore.getState().setMode('galaxy')
    useUIStore.getState().setShowHome(false)
    setReady(true)
  }, [])
  return (
    <TooltipProvider>
      <div className="fixed inset-0 bg-void">{ready && <GalaxyView />}</div>
      <ConfirmDialog />
    </TooltipProvider>
  )
}
