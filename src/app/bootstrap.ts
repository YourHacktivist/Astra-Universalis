import { createDemoSystem } from '@/core/demo'
import { createProject } from '@/core/defaults'
import { bridge, platform } from '@/lib/platform'
import { useProjectStore } from '@/store/projectStore'
import { useSimStore } from '@/store/simStore'
import { toast, useUIStore } from '@/store/uiStore'
import { confirmDiscardChanges, loadProjectText, readAutosave, restoreSession, writeAutosave } from './actions'

let started = false

export async function bootstrap() {
  if (started) return
  started = true
  if (import.meta.env.DEV) Object.assign(globalThis, { __astraStore: useProjectStore, __astraUI: useUIStore })

  window.addEventListener('pointerup', () => useProjectStore.getState().endCoalesce(), true)

  const pending = await platform.pendingOpen().catch(() => null)
  if (pending) {
    try {
      loadProjectText(pending.content, pending.path)
      useUIStore.getState().setShowHome(false)
    } catch (e) {
      toast({ kind: 'error', title: "Impossible d'ouvrir le fichier", message: (e as Error).message })
    }
  } else {
    const session = await readAutosave().catch(() => null)
    if (session) restoreSession(session)
    else {
      const sys = createDemoSystem()
      useProjectStore.getState().load(createProject('Premiers pas', sys), null, { example: true })
      useSimStore.getState().setTime(0)
    }
    useUIStore.getState().setShowHome(true)
  }

  bridge?.app.onOpenFile(async (f) => {
    if (!(await confirmDiscardChanges())) return
    try {
      loadProjectText(f.content, f.path)
    } catch (e) {
      toast({ kind: 'error', title: "Impossible d'ouvrir le fichier", message: (e as Error).message })
    }
  })

  bridge?.app.onBeforeClose(async () => {
    try {
      await writeAutosave()
    } finally {
      bridge?.app.confirmClose()
    }
  })

  let lastRevision = useProjectStore.getState().revision
  setInterval(() => {
    const rev = useProjectStore.getState().revision
    if (rev === lastRevision) return
    lastRevision = rev
    void writeAutosave()
  }, 20_000)
  window.addEventListener('beforeunload', () => void writeAutosave())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void writeAutosave()
  })

  const updateTitle = () => {
    const s = useProjectStore.getState()
    platform.setTitle(`${s.dirty && !s.example ? '• ' : ''}${s.project.name} · Astra Universalis`)
  }
  updateTitle()
  useProjectStore.subscribe((s, p) => {
    if (s.dirty !== p.dirty || s.example !== p.example || s.project.name !== p.project.name) updateTitle()
  })
}
