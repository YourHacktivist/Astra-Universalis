import {
  Clapperboard,
  Copy,
  Crosshair,
  Download,
  Eye,
  FilePlus,
  FileUp,
  FolderOpen,
  Galaxy,
  ImageDown,
  Info,
  Keyboard,
  LayoutGrid,
  Maximize2,
  Move,
  Pause,
  Pencil,
  Redo2,
  Route,
  Save,
  ScrollText,
  Settings2,
  Sparkles,
  Trash2,
  Undo2,
  Users,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react'
import {
  cameraPreset,
  deleteSelected,
  duplicateSelected,
  exportSystemFile,
  focusBody,
  frameAll,
  importSystemFile,
  newProject,
  openProject,
  redo,
  saveProject,
  saveProjectAs,
  undo,
} from '@/app/actions'
import { generateGalaxy } from '@/core/galaxyGen'
import { createBinaryTemplate, createBlackHoleTemplate } from '@/core/templates/showcase'
import { createSolSystem } from '@/core/templates/sol'
import { bridge } from '@/lib/platform'
import { randomSeedString } from '@/lib/random'
import { getProject, useProjectStore } from '@/store/projectStore'
import { useSimStore } from '@/store/simStore'
import { useUIStore, type AppMode, type ViewOptions } from '@/store/uiStore'

export interface Command {
  id: string
  label: string
  group: string
  icon?: LucideIcon
  shortcut?: string
  keywords?: string
  run(): void
  enabled?(): boolean
}

const ui = () => useUIStore.getState()

export function openGalaxy() {
  if (!getProject().galaxy) useProjectStore.getState().setGalaxy(generateGalaxy(randomSeedString()))
  ui().setMode('galaxy')
  ui().setShowHome(false)
}

export function setMode(mode: AppMode) {
  if (mode === 'galaxy') return openGalaxy()
  ui().setMode(mode)
  ui().setShowHome(false)
}

export function togglePanels() {
  const { panels } = ui()
  const anyOpen = panels.hierarchy || panels.inspector
  useUIStore.setState({ panels: { hierarchy: !anyOpen, inspector: !anyOpen } })
}

export const VIEW_TOGGLES: { key: keyof ViewOptions; label: string; shortcut?: string }[] = [
  { key: 'orbits', label: 'Orbites', shortcut: 'O' },
  { key: 'labels', label: 'Étiquettes', shortcut: 'L' },
  { key: 'moonLabels', label: 'Étiquettes des lunes' },
  { key: 'glints', label: 'Repères lumineux' },
  { key: 'axes', label: 'Axes de rotation', shortcut: 'A' },
  { key: 'equators', label: 'Équateurs' },
  { key: 'grid', label: 'Grille écliptique', shortcut: 'G' },
  { key: 'habitableZone', label: 'Zone habitable' },
  { key: 'frostLine', label: 'Ligne des glaces' },
  { key: 'routes', label: 'Routes' },
  { key: 'starfield', label: 'Ciel étoilé' },
  { key: 'bloom', label: 'Halo lumineux (bloom)' },
  { key: 'lensFlares', label: "Reflets d'objectif" },
  { key: 'grain', label: 'Grain film' },
  { key: 'vignette', label: 'Vignettage' },
]

export function getCommands(): Command[] {
  const hasSel = () => !!ui().selectedId
  const cmds: Command[] = [
    { id: 'file.new', group: 'Fichier', label: 'Nouveau système vierge', icon: FilePlus, shortcut: 'Ctrl+N', run: () => void newProject('empty') },
    { id: 'file.generate', group: 'Fichier', label: 'Générer un système…', icon: WandSparkles, shortcut: 'Ctrl+G', run: () => ui().openDialog('generator') },
    { id: 'file.demo', group: 'Fichier', label: 'Système de démonstration', icon: Sparkles, run: () => void newProject('demo') },
    { id: 'file.sol', group: 'Fichier', label: 'Système solaire (Sol)', icon: Sparkles, keywords: 'soleil terre', run: () => void newProject(createSolSystem(), { example: true }) },
    { id: 'file.binary', group: 'Fichier', label: 'Modèle : système binaire', icon: Sparkles, keywords: 'double étoile', run: () => void newProject(createBinaryTemplate(), { example: true }) },
    { id: 'file.blackhole', group: 'Fichier', label: 'Modèle : trou noir', icon: Sparkles, keywords: 'disque accrétion', run: () => void newProject(createBlackHoleTemplate(), { example: true }) },
    { id: 'file.open', group: 'Fichier', label: 'Ouvrir…', icon: FolderOpen, shortcut: 'Ctrl+O', run: () => void openProject() },
    { id: 'file.save', group: 'Fichier', label: 'Enregistrer', icon: Save, shortcut: 'Ctrl+S', run: () => void saveProject() },
    { id: 'file.saveAs', group: 'Fichier', label: 'Enregistrer sous…', icon: Save, shortcut: 'Ctrl+Maj+S', run: () => void saveProjectAs() },
    { id: 'file.exportImage', group: 'Fichier', label: 'Exporter une image…', icon: ImageDown, shortcut: 'Ctrl+E', run: () => ui().openDialog('export') },
    { id: 'file.exportSystem', group: 'Fichier', label: 'Exporter le système seul…', icon: Download, run: () => void exportSystemFile() },
    { id: 'file.import', group: 'Fichier', label: 'Importer un système…', icon: FileUp, run: () => void importSystemFile() },
    { id: 'file.home', group: 'Fichier', label: "Écran d'accueil", icon: LayoutGrid, run: () => ui().setShowHome(true) },

    { id: 'edit.undo', group: 'Édition', label: 'Annuler', icon: Undo2, shortcut: 'Ctrl+Z', run: undo, enabled: () => useProjectStore.getState().past.length > 0 },
    { id: 'edit.redo', group: 'Édition', label: 'Rétablir', icon: Redo2, shortcut: 'Ctrl+Y', run: redo, enabled: () => useProjectStore.getState().future.length > 0 },
    { id: 'edit.rename', group: 'Édition', label: 'Renommer la sélection', icon: Pencil, shortcut: 'F2', keywords: 'nom', run: () => ui().selectedId && ui().requestRename(ui().selectedId!), enabled: hasSel },
    { id: 'edit.duplicate', group: 'Édition', label: 'Dupliquer la sélection', icon: Copy, shortcut: 'Ctrl+D', run: duplicateSelected, enabled: hasSel },
    {
      id: 'edit.moveTool',
      group: 'Édition',
      label: 'Outil Déplacer (glisser les astres)',
      icon: Move,
      shortcut: 'M',
      keywords: 'déplacer bouger glisser position orbite',
      run: () => ui().setMoveTool(!ui().moveTool),
    },
    { id: 'edit.delete', group: 'Édition', label: 'Supprimer la sélection', icon: Trash2, shortcut: 'Suppr', run: deleteSelected, enabled: () => hasSel() || !!ui().selectedRouteId },

    { id: 'view.focus', group: 'Vue', label: 'Centrer sur la sélection', icon: Crosshair, shortcut: 'F', run: () => focusBody(), enabled: hasSel },
    { id: 'view.frame', group: 'Vue', label: "Vue d'ensemble (vue normale)", keywords: 'cadrer tout recentrer réinitialiser', icon: Maximize2, shortcut: 'H', run: frameAll },
    { id: 'view.top', group: 'Vue', label: 'Vue de dessus', shortcut: '1', run: () => cameraPreset('top') },
    { id: 'view.side', group: 'Vue', label: 'Vue de profil', shortcut: '2', run: () => cameraPreset('side') },
    { id: 'view.iso', group: 'Vue', label: 'Vue trois-quarts', shortcut: '3', run: () => cameraPreset('iso') },
    { id: 'view.play', group: 'Vue', label: 'Lecture / pause du temps', icon: Pause, shortcut: 'Espace', run: () => useSimStore.getState().togglePlaying() },
    { id: 'view.player', group: 'Vue', label: 'Basculer le mode joueurs', icon: Users, shortcut: 'Ctrl+Maj+P', run: () => ui().setPlayerMode(!ui().playerMode) },
    { id: 'view.panels', group: 'Vue', label: 'Afficher / masquer les panneaux', icon: Eye, shortcut: 'Tab', run: togglePanels },
    {
      id: 'view.immersive',
      group: 'Vue',
      label: 'Mode immersif',
      icon: Clapperboard,
      shortcut: 'I',
      keywords: 'cinéma plein écran présentation projection',
      run: () => {
        if (ui().mode !== 'system') ui().setMode('system')
        ui().setImmersive(!ui().immersive)
      },
    },
    ...VIEW_TOGGLES.map<Command>((t) => ({
      id: `view.toggle.${t.key}`,
      group: 'Affichage',
      label: `Afficher : ${t.label}`,
      shortcut: t.shortcut,
      run: () => ui().toggleView(t.key),
    })),

    { id: 'mode.system', group: 'Mode', label: 'Vue système', icon: Sparkles, run: () => setMode('system') },
    { id: 'mode.galaxy', group: 'Mode', label: 'Vue galaxie', icon: Galaxy, run: () => setMode('galaxy') },
    { id: 'mode.sheet', group: 'Mode', label: 'Fiche système', icon: ScrollText, run: () => setMode('sheet') },

    { id: 'tools.travel', group: 'Outils', label: 'Calculateur de trajet…', icon: Route, run: () => ui().openDialog('travel') },
    { id: 'tools.settings', group: 'Outils', label: 'Préférences…', icon: Settings2, run: () => ui().openDialog('settings') },
    { id: 'help.shortcuts', group: 'Aide', label: 'Raccourcis clavier', icon: Keyboard, run: () => ui().openDialog('shortcuts') },
    { id: 'help.about', group: 'Aide', label: "À propos d'Astra Universalis", icon: Info, run: () => ui().openDialog('about') },
  ]
  if (bridge) {
    cmds.push(
      { id: 'win.fullscreen', group: 'Fenêtre', label: 'Plein écran', shortcut: 'F11', run: () => bridge!.window.toggleFullscreen() },
      { id: 'win.devtools', group: 'Fenêtre', label: 'Outils de développement', shortcut: 'Ctrl+Maj+I', run: () => bridge!.window.toggleDevtools() },
    )
  }
  return cmds
}

export function runCommand(id: string) {
  const c = getCommands().find((x) => x.id === id)
  if (c && (!c.enabled || c.enabled())) c.run()
}
