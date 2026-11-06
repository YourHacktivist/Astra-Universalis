import { useUIStore } from '@/store/uiStore'
import { AboutDialog } from './AboutDialog'
import { ExportDialog } from './ExportDialog'
import { GeneratorDialog } from './GeneratorDialog'
import { SettingsDialog } from './SettingsDialog'
import { ShortcutsDialog } from './ShortcutsDialog'
import { TravelDialog } from './TravelDialog'

export function Dialogs() {
  const dialog = useUIStore((s) => s.dialog)
  const close = () => useUIStore.getState().openDialog(null)
  return (
    <>
      <ExportDialog open={dialog === 'export'} onClose={close} />
      <GeneratorDialog open={dialog === 'generator'} onClose={close} />
      {(dialog === 'settings' || dialog === 'systemSettings') && <SettingsDialog onClose={close} />}
      {dialog === 'shortcuts' && <ShortcutsDialog onClose={close} />}
      {dialog === 'about' && <AboutDialog onClose={close} />}
      {dialog === 'travel' && <TravelDialog onClose={close} />}
    </>
  )
}
