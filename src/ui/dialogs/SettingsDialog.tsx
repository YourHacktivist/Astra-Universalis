import { HardDriveDownload, MonitorCog, RotateCcw } from 'lucide-react'
import { platform } from '@/lib/platform'
import { DEFAULT_VIEW, useUIStore } from '@/store/uiStore'
import { Button, Dialog, Field, Segmented, Toggle } from '../kit'
import { QUALITY_OPTIONS, RENDER_STYLES } from '../layout/ViewOptions'

export function SettingsDialog({ onClose }: { onClose(): void }) {
  const quality = useUIStore((s) => s.quality)
  const style = useUIStore((s) => s.renderStyle)
  const view = useUIStore((s) => s.view)
  const ui = useUIStore.getState()
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Préférences"
      subtitle="Réglages de l'application, enregistrés sur cet ordinateur."
      icon={<MonitorCog />}
      width={560}
      footer={
        <Button variant="primary" onClick={onClose}>
          Terminé
        </Button>
      }
    >
      <div className="space-y-5">
        <section className="space-y-2">
          <div className="eyebrow">Rendu</div>
          <Field label="Qualité" hint="Résolution, anticrénelage, textures et particules">
            <Segmented value={quality} onChange={(v) => ui.setQuality(v)} options={QUALITY_OPTIONS} />
          </Field>
          <Field label="Style">
            <Segmented value={style} onChange={(v) => ui.setRenderStyle(v)} options={RENDER_STYLES.map((s) => ({ value: s.value, label: s.label }))} />
          </Field>
          <p className="text-[11px] leading-relaxed text-ink-3">
            « Terminal » reproduit un écran à phosphore ambre façon Mothership ; « Plan » un tracé technique bleu, idéal à imprimer.
          </p>
        </section>

        <section className="space-y-1.5">
          <div className="eyebrow">Effets</div>
          {(
            [
              ['bloom', 'Halo lumineux (bloom)'],
              ['lensFlares', "Reflets d'objectif"],
              ['grain', 'Grain film'],
              ['vignette', 'Vignettage'],
              ['starfield', 'Ciel étoilé'],
            ] as const
          ).map(([k, label]) => (
            <Field key={k} label={label}>
              <div className="flex justify-end">
                <Toggle checked={view[k]} onChange={() => ui.toggleView(k)} />
              </div>
            </Field>
          ))}
          <div className="flex justify-end pt-1">
            <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => ui.setView(DEFAULT_VIEW)}>
              Rétablir l'affichage par défaut
            </Button>
          </div>
        </section>

        <section className="space-y-2">
          <div className="eyebrow">Sauvegarde</div>
          <div className="flex items-start gap-3 rounded-xl border border-line bg-white/[0.02] p-3">
            <HardDriveDownload className="mt-0.5 size-4 shrink-0 text-viridis" />
            <p className="text-[11.5px] leading-relaxed text-ink-2">
              Votre session est sauvegardée automatiquement toutes les 20 secondes
              {platform.isElectron ? " dans le dossier de l'application" : ' dans le navigateur'} et restaurée au prochain lancement.
              Utilisez <span className="text-ink">Ctrl+S</span> pour enregistrer un fichier <span className="font-mono text-ink">.astra</span> à partager.
            </p>
          </div>
        </section>
      </div>
    </Dialog>
  )
}
