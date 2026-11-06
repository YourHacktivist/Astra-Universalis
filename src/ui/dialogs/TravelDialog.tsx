import { useMemo, useState } from 'react'
import { ArrowRightLeft, Route } from 'lucide-react'
import { addRoute } from '@/app/actions'
import { brachistochrone, C_KMS } from '@/core/physics'
import type { Id } from '@/core/types'
import { formatDays, formatKm, formatLightTime, num } from '@/lib/format'
import { useActiveSystem } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import { useLiveDistanceKm } from '../hooks'
import { BodyIcon } from '../icons'
import { Button, Dialog, Field, IconButton, Select, Slider, Stat } from '../kit'

const PRESETS = [0.3, 1, 2, 3, 5]

export function TravelDialog({ onClose }: { onClose(): void }) {
  const system = useActiveSystem()
  const selectedId = useUIStore((s) => s.selectedId)
  const options = useMemo(
    () =>
      system
        ? Object.values(system.bodies)
            .filter((b) => b.kind !== 'belt' && b.kind !== 'nebula' && b.kind !== 'barycenter')
            .map((b) => ({ value: b.id, label: b.name, icon: <BodyIcon body={b} size={13} /> }))
        : [],
    [system],
  )
  const [from, setFrom] = useState<Id | null>(() => (selectedId && options.some((o) => o.value === selectedId) ? selectedId : options[0]?.value ?? null))
  const [to, setTo] = useState<Id | null>(() => options.find((o) => o.value !== from)?.value ?? null)
  const [accel, setAccel] = useState(1)
  const dist = useLiveDistanceKm(from, to)
  const t = dist !== null ? brachistochrone(dist, accel) : null
  const relativistic = t && t.peakKms > C_KMS * 0.1

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Calculateur de trajet"
      subtitle="Distance réelle à l'instant simulé, poussée constante avec retournement à mi-parcours."
      icon={<Route />}
      width={520}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
          <Button
            variant="primary"
            disabled={!from || !to || from === to}
            onClick={() => {
              if (from && to) addRoute(from, to)
              onClose()
            }}
          >
            Créer une route
          </Button>
        </>
      }
    >
      {!system || options.length < 2 ? (
        <p className="text-[12px] text-ink-3">Il faut au moins deux objets dans le système.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <label className="space-y-1">
              <span className="text-[11px] text-ink-3">Départ</span>
              <Select value={from ?? ''} options={options} onChange={setFrom} />
            </label>
            <IconButton
              label="Inverser"
              size="sm"
              onClick={() => {
                setFrom(to)
                setTo(from)
              }}
            >
              <ArrowRightLeft />
            </IconButton>
            <label className="space-y-1">
              <span className="text-[11px] text-ink-3">Arrivée</span>
              <Select value={to ?? ''} options={options} onChange={setTo} />
            </label>
          </div>
          <Field label="Accélération">
            <Slider value={accel} onChange={setAccel} min={0.1} max={5} step={0.1} format={(v) => `${num(v, 1)} g`} tone="ion" />
          </Field>
          <div className="flex justify-end gap-1">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setAccel(p)}
                className={
                  'h-6 rounded-md border px-2 font-mono text-[10.5px] transition-colors ' +
                  (Math.abs(accel - p) < 0.01 ? 'border-ion/40 bg-ion/10 text-ion-hi' : 'border-line text-ink-3 hover:text-ink-2')
                }
              >
                {num(p, 1)} g
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-aurum/25 bg-aurum/[0.05] p-4 text-center">
            <div className="eyebrow !text-aurum/80">Durée du trajet</div>
            <div className="mt-1 font-display text-[34px] font-semibold leading-none tracking-wide text-aurum-hi">
              {t ? formatDays(t.seconds / 86400) : '–'}
            </div>
            <div className="mt-1 text-[11px] text-ink-3">à {num(accel, 1)} g constants · demi-tour à mi-chemin</div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <Stat label="Distance" value={dist !== null ? formatKm(dist) : '–'} />
            <Stat label="Vitesse max" value={t ? `${num(t.peakKms, 0)} km/s` : '–'} tone={relativistic ? 'nova' : undefined} />
            <Stat label="Délai radio" value={dist !== null ? formatLightTime(dist) : '–'} tone="ion" />
          </div>
          {relativistic && (
            <p className="text-[11px] text-nova">Plus de 10 % de la vitesse de la lumière : le calcul newtonien devient approximatif.</p>
          )}
          <p className="text-[10.5px] leading-relaxed text-ink-3">
            La distance évolue avec le temps simulé : relancez le temps ou changez la date pour trouver la meilleure fenêtre de lancement.
          </p>
        </div>
      )}
    </Dialog>
  )
}
