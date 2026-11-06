import { lazy, Suspense, useEffect } from 'react'
import { bootstrap } from './app/bootstrap'
import { splashDone, splashStep } from './lib/splash'
import { useUIStore } from './store/uiStore'
import { TooltipProvider } from './ui/kit'
import { CommandPalette } from './ui/CommandPalette'
import { ConfirmDialog } from './ui/dialogs/ConfirmDialog'
import { Dialogs } from './ui/dialogs/Dialogs'
import { HomeScreen } from './ui/HomeScreen'
import { useImmersiveFullscreen } from './ui/layout/ImmersiveHud'
import { SceneContextMenu } from './ui/layout/SceneContextMenu'
import { SystemWorkspace } from './ui/layout/SystemWorkspace'
import { TitleBar } from './ui/layout/TitleBar'
import { Toasts } from './ui/Toasts'
import { useGlobalShortcuts } from './ui/shortcuts'

const GalaxyView = lazy(() => import('./galaxy/GalaxyView').then((m) => ({ default: m.GalaxyView })))
const SystemSheet = lazy(() => import('./ui/sheet/SystemSheet').then((m) => ({ default: m.SystemSheet })))

function ViewLoading() {
  return (
    <div role="status" className="flex h-full items-center justify-center font-mono text-[10.5px] uppercase tracking-[0.24em] text-ink-3">
      Chargement…
    </div>
  )
}

export function App() {
  const mode = useUIStore((s) => s.mode)
  const immersive = useUIStore((s) => s.immersive && s.mode === 'system')
  useEffect(() => {
    splashStep('Ouverture du projet', 0.52)
    void bootstrap()
  }, [])
  useEffect(() => {
    if (mode !== 'system') splashDone()
  }, [mode])
  useGlobalShortcuts()
  useImmersiveFullscreen()

  return (
    <TooltipProvider>
      <div className="relative flex h-full flex-col bg-void">
        {!immersive && <TitleBar />}
        <main className="relative min-h-0 flex-1 overflow-hidden">
          <Suspense fallback={<ViewLoading />}>
            {mode === 'galaxy' ? <GalaxyView /> : mode === 'sheet' ? <SystemSheet /> : <SystemWorkspace />}
          </Suspense>
        </main>
        <HomeScreen />
        <Dialogs />
        <ConfirmDialog />
        <CommandPalette />
        <SceneContextMenu />
        <Toasts />
      </div>
    </TooltipProvider>
  )
}
