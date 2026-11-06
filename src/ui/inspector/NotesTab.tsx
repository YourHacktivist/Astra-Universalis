import type { ReactNode } from 'react'
import { BookOpen, Flag, Gem, Lock, MapPin, MessageSquareQuote, TriangleAlert, Users, Wind } from 'lucide-react'
import type { Body, Notes } from '@/core/types'
import { useUIStore } from '@/store/uiStore'
import { TextArea } from '../kit'
import { setNote } from './edit'

const FIELDS: { key: Exclude<keyof Notes, 'gm'>; label: string; icon: ReactNode; placeholder: string; rows?: number }[] = [
  { key: 'description', label: 'Description', icon: <BookOpen />, placeholder: 'Ce que les joueurs voient en arrivant…', rows: 4 },
  { key: 'population', label: 'Population', icon: <Users />, placeholder: '≈ 12 000 colons, 3 avant-postes…', rows: 1 },
  { key: 'faction', label: 'Contrôle / faction', icon: <Flag />, placeholder: 'Corporation, gouvernement, pirates…', rows: 1 },
  { key: 'atmosphere', label: 'Atmosphère', icon: <Wind />, placeholder: 'Respirable, toxique, inexistante…', rows: 1 },
  { key: 'hazards', label: 'Dangers', icon: <TriangleAlert />, placeholder: 'Radiations, tempêtes, faune hostile…', rows: 2 },
  { key: 'resources', label: 'Ressources', icon: <Gem />, placeholder: 'Minerais, eau, carburant, ruines…', rows: 2 },
  { key: 'pois', label: "Points d'intérêt", icon: <MapPin />, placeholder: 'Lieux notables, stations, épaves…', rows: 2 },
  { key: 'rumors', label: 'Rumeurs', icon: <MessageSquareQuote />, placeholder: 'Ce qui se murmure dans les bars des docks…', rows: 2 },
]

export function NotesTab({ body }: { body: Body }) {
  const playerMode = useUIStore((s) => s.playerMode)
  return (
    <div className="space-y-3 px-3 py-3">
      {FIELDS.map((f) => (
        <label key={f.key} className="block space-y-1">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-ink-2 [&_svg]:size-3.5 [&_svg]:text-ink-3">
            {f.icon}
            {f.label}
          </span>
          <TextArea rows={f.rows ?? 2} value={body.notes[f.key]} placeholder={f.placeholder} onChange={(e) => setNote(body, f.key, e.target.value)} />
        </label>
      ))}

      {playerMode ? (
        <div className="flex items-center gap-2 rounded-xl border border-line bg-white/[0.02] px-3 py-2.5 text-[11px] text-ink-3">
          <Lock className="size-3.5" /> Notes secrètes masquées en mode joueurs.
        </div>
      ) : (
        <label className="block space-y-1.5 rounded-xl border border-aurum/25 bg-aurum/[0.05] p-2.5">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-aurum-hi">
            <Lock className="size-3.5" />
            Secrets du MJ
            <span className="ml-auto font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-aurum/70">jamais montré aux joueurs</span>
          </span>
          <TextArea
            rows={4}
            value={body.notes.gm}
            placeholder="Ce que les joueurs ne doivent pas savoir… (Les apparences sont trompeuses.)"
            onChange={(e) => setNote(body, 'gm', e.target.value)}
            className="!border-aurum/20 !bg-black/20 focus:!border-aurum/50"
          />
        </label>
      )}
    </div>
  )
}
