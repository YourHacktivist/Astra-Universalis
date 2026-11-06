import { useEffect, useState } from 'react'
import { Dialog as RDialog } from 'radix-ui'
import { X } from 'lucide-react'
import { bridge } from '@/lib/platform'

export function AboutDialog({ onClose }: { onClose(): void }) {
  const [version, setVersion] = useState('0.1.0')
  useEffect(() => {
    void bridge?.app.version().then(setVersion)
  }, [])
  return (
    <RDialog.Root open onOpenChange={(o) => !o && onClose()}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-[150] animate-fade-in bg-[#020308]/60" />
        <RDialog.Content className="glass-pop fixed left-1/2 top-1/2 z-[151] w-[min(460px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 animate-scale-in overflow-hidden rounded-2xl text-center outline-none">
          <div className="relative px-8 pb-7 pt-8" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgb(138 176 255 / 0.12), transparent 65%)' }}>
            <RDialog.Close className="absolute right-3 top-3 rounded-lg p-1.5 text-ink-3 hover:bg-white/[0.07] hover:text-ink">
              <X className="size-4" />
            </RDialog.Close>
            <img src="./brand/logo-night.png" alt="" className="mx-auto size-[150px] drop-" draggable={false} />
            <RDialog.Title className="mt-2 font-display text-[34px] font-semibold tracking-[0.04em] text-ink">Astra Universalis</RDialog.Title>
            <RDialog.Description className="font-display text-[16px] italic text-ink-2">Atelier de cartographie stellaire</RDialog.Description>
            <div className="mt-2 font-mono text-[10.5px] tracking-[0.14em] text-ink-3">VERSION {version}</div>
            <div className="hairline mx-auto my-5 w-2/3" />
            <p className="text-[12px] leading-relaxed text-ink-2">
              Conçu pour les meneurs de jeu : systèmes stellaires, galaxies, routes et secrets, pour Mothership et toute autre campagne de science-fiction.
            </p>
            <p className="mt-3 text-[10.5px] leading-relaxed text-ink-3">
              Propulsé par React, Three.js et Electron. Mothership est une marque de Tuesday Knight Games ; Astra Universalis est un outil indépendant, non affilié.
            </p>
          </div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}
