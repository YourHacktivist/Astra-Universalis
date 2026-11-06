import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { newProject, openProject, openRecent } from '@/app/actions'
import { stars } from '@/core/hierarchy'
import { spectralLabel } from '@/core/starPresets'
import { createSolSystem } from '@/core/templates/sol'
import { formatSimDate } from '@/lib/format'
import { platform, type RecentEntry } from '@/lib/platform'
import { useActiveSystem, useProjectStore } from '@/store/projectStore'
import { useSimTime } from '@/store/simStore'
import { useUIStore } from '@/store/uiStore'
import { openGalaxy } from './commands'

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

function timeAgo(ts: number) {
  const s = (Date.now() - ts) / 1000
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min`
  if (s < 86400) return `${Math.round(s / 3600)} h`
  if (s < 86400 * 30) return `${Math.round(s / 86400)} j`
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

interface Entry {
  label: string
  detail: string
  run(): void
}

export function HomeScreen() {
  const show = useUIStore((s) => s.showHome)
  const [recent, setRecent] = useState<RecentEntry[]>([])
  useEffect(() => {
    if (show) void platform.recentList().then(setRecent, () => setRecent([]))
  }, [show])
  if (!show) return null
  return <TitlePlate recent={recent} />
}

function TitlePlate({ recent }: { recent: RecentEntry[] }) {
  const project = useProjectStore((s) => s.project)
  const system = useActiveSystem()
  const galaxy = project.galaxy
  const t = useSimTime(2)
  const close = () => useUIStore.getState().setShowHome(false)

  const bodies = Object.values(project.systems).reduce((n, s) => n + Object.keys(s.bodies).length, 0)
  const entries: Entry[] = useMemo(
    () => [
      { label: 'Reprendre', detail: `${project.name} · ${bodies} objets`, run: close },
      { label: 'Nouveau système', detail: 'une étoile, rien d’autre', run: () => void newProject('empty') },
      { label: 'Générer un système', detail: 'à partir d’une graine', run: () => useUIStore.getState().openDialog('generator') },
      { label: 'Ouvrir un fichier', detail: 'projet .astra', run: () => void openProject() },
      { label: 'Système solaire', detail: 'Sol, éléments orbitaux J2000', run: () => void newProject(createSolSystem(), { example: true }) },
      { label: 'Vesper', detail: 'système de démonstration', run: () => void newProject('demo') },
      { label: 'Carte galactique', detail: galaxy ? galaxy.name : 'nouvelle galaxie', run: openGalaxy },
    ],
    [project.name, project.systemOrder.length, bodies, galaxy?.name],
  )

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const n = Number(e.key)
      if (n >= 1 && n <= entries.length) {
        e.preventDefault()
        entries[n - 1].run()
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [entries])

  const primary = system ? stars(system)[0] : undefined
  const caption = system
    ? [system.name, system.designation, primary ? spectralLabel(primary.props) : null, formatSimDate(system.calendar.epochYear, t, false)].filter(Boolean).join(' · ')
    : ''

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 top-10 z-[90] animate-fade-in">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(90deg, #04050a 0%, #04050a 30%, rgb(4 5 10 / 0.75) 40%, rgb(4 5 10 / 0) 62%)' }}
      />

      <section className="pointer-events-auto relative flex h-full w-[min(470px,44vw)] min-w-[360px] flex-col overflow-y-auto px-12 pb-9 pt-11 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <header className="animate-rise-in">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.28em] text-ink-3">
            <span>Atlas céleste</span>
            <span>Pl. I</span>
          </div>
          <div className="mt-3 h-px bg-ink-3/40" />
          <div className="mt-[3px] h-px bg-ink-3/20" />
          <div className="mt-7 flex items-end gap-5">
            <img src="./brand/logo-night.png" alt="" draggable={false} className="-mb-1 -ml-3 size-[92px] shrink-0" />
            <h1 className="font-display text-[46px] font-medium leading-[0.92] tracking-[0.01em] text-ink">
              Astra
              <br />
              <em className="font-medium italic text-ink-2">Universalis</em>
            </h1>
          </div>
          <p className="mt-5 max-w-[340px] font-display text-[17px] italic leading-snug text-ink-2">
            Cartes des mondes, des routes et des secrets, à l’usage des meneurs de jeu.
          </p>
        </header>

        <nav className="mt-10 animate-rise-in" style={{ animationDelay: '90ms' }}>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-3">Sommaire</div>
          <ol>
            {entries.map((e, i) => (
              <li key={i}>
                <button
                  onClick={e.run}
                  className={clsx(
                    'group relative grid w-full grid-cols-[34px_1fr_14px] items-baseline gap-2 border-t border-white/[0.06] py-[8px] text-left outline-none transition-colors',
                    'hover:border-aurum/30 focus-visible:border-aurum/40',
                  )}
                >
                  <span className="font-mono text-[11px] text-ink-3 transition-colors group-hover:text-aurum">{ROMAN[i]}</span>
                  <span className="min-w-0">
                    <span
                      className={clsx(
                        'block truncate font-display text-[20px] leading-tight transition-colors',
                        i === 0 ? 'text-ink' : 'text-ink-2 group-hover:text-ink',
                      )}
                    >
                      {e.label}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3 transition-colors group-hover:text-aurum/80">
                      {e.detail}
                    </span>
                  </span>
                  <span className="text-right font-mono text-[10.5px] text-ink-3/70">{i + 1}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="border-t border-white/[0.06]" />
        </nav>

        <div className="mt-8 min-h-0 flex-1 animate-rise-in overflow-hidden" style={{ animationDelay: '160ms' }}>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-3">Registre</div>
          {recent.length === 0 ? (
            <p className="font-display text-[14px] italic text-ink-3">
              {platform.isElectron ? 'Aucun projet enregistré pour l’instant.' : 'Le registre des fichiers récents est tenu par l’application de bureau.'}
            </p>
          ) : (
            <ul className="max-h-full space-y-px overflow-y-auto pr-1">
              {recent.slice(0, 8).map((r) => (
                <li key={r.path}>
                  <button
                    disabled={r.exists === false}
                    onClick={() => void openRecent(r.path)}
                    title={r.path}
                    className="group grid w-full grid-cols-[1fr_auto] items-baseline gap-3 py-1 text-left disabled:opacity-40"
                  >
                    <span className="truncate text-[12.5px] text-ink-2 group-hover:text-ink">
                      {r.name}
                      {r.exists === false && <span className="ml-2 font-mono text-[10px] text-nova">introuvable</span>}
                    </span>
                    <span className="font-mono text-[10.5px] text-ink-3">{timeAgo(r.openedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="mt-6 flex items-center justify-between font-mono text-[10px] tracking-[0.12em] text-ink-3">
          <span>Échap : fermer · Ctrl K : commandes</span>
          <span>v0.1</span>
        </footer>
      </section>

      {caption && (
        <div className="pointer-events-none absolute bottom-7 right-9 animate-fade-in text-right" style={{ animationDelay: '300ms' }}>
          <div className="font-display text-[15px] italic text-ink-2 [text-shadow:0_1px_10px_rgb(0_0_0/0.9)]">Planche I</div>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-3 [text-shadow:0_1px_8px_rgb(0_0_0/0.9)]">{caption}</div>
        </div>
      )}
    </div>
  )
}
