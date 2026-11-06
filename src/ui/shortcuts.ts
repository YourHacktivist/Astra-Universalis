import { useEffect } from 'react'
import { addBody } from '@/app/actions'
import { bridge } from '@/lib/platform'
import { useSimStore } from '@/store/simStore'
import { useUIStore } from '@/store/uiStore'
import { runCommand, togglePanels } from './commands'

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

export function useGlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      const ui = useUIStore.getState()
      const ctrl = e.ctrlKey || e.metaKey
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key

      if (ctrl && key === 'k') {
        e.preventDefault()
        ui.setCommandOpen(!ui.commandOpen)
        return
      }
      if (isTyping(e.target)) return
      const modal = !!ui.dialog || ui.commandOpen || !!ui.confirm

      if (key === 'F11' && bridge) {
        e.preventDefault()
        bridge.window.toggleFullscreen()
        return
      }
      if (ctrl && e.shiftKey && key === 'i' && bridge) {
        e.preventDefault()
        bridge.window.toggleDevtools()
        return
      }
      if (modal) return

      const run = (id: string) => {
        e.preventDefault()
        runCommand(id)
      }

      if (ctrl) {
        if (key === 'n') return run('file.new')
        if (key === 'o') return run('file.open')
        if (key === 's') return run(e.shiftKey ? 'file.saveAs' : 'file.save')
        if (key === 'z') return run(e.shiftKey ? 'edit.redo' : 'edit.undo')
        if (key === 'y') return run('edit.redo')
        if (key === 'd') return run('edit.duplicate')
        if (key === 'e') return run('file.exportImage')
        if (key === 'g') return run('file.generate')
        if (e.shiftKey && key === 'p') return run('view.player')
        return
      }
      if (e.altKey) return

      switch (key) {
        case 'Escape':
          if (ui.contextMenu) ui.openContextMenu(null)
          else if (ui.immersive) ui.setImmersive(false)
          else if (ui.placing) ui.setPlacing(null)
          else if (ui.moveTool) ui.setMoveTool(false)
          else if (ui.showHome) ui.setShowHome(false)
          else if (ui.followId) ui.follow(null)
          else if (ui.selectedId || ui.selectedRouteId) ui.select(null)
          return
        case 'Enter':
          if (ui.placing) {
            e.preventDefault()
            const kind = ui.placing
            ui.setPlacing(null)
            void addBody(kind)
          }
          return
        case 'Delete':
        case 'Backspace':
          return run('edit.delete')
        case 'Tab':
          e.preventDefault()
          if (!ui.immersive) togglePanels()
          return
        case 'i':
          return run('view.immersive')
        case 'm':
          return run('edit.moveTool')
        case 'F2':
          return run('edit.rename')
        case ' ':
          e.preventDefault()
          useSimStore.getState().togglePlaying()
          return
        case 'Home':
        case 'h':
          return run('view.frame')
        case 'f':
          return run('view.focus')
        case '1':
          return run('view.top')
        case '2':
          return run('view.side')
        case '3':
          return run('view.iso')
        case '+':
        case '=':
          e.preventDefault()
          useSimStore.getState().stepSpeed(1)
          return
        case '-':
        case '_':
          e.preventDefault()
          useSimStore.getState().stepSpeed(-1)
          return
        case 'r':
          useSimStore.getState().reverse()
          return
        case 'o':
          return ui.toggleView('orbits')
        case 'l':
          return ui.toggleView('labels')
        case 'g':
          return ui.toggleView('grid')
        case 'a':
          return ui.toggleView('axes')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export const SHORTCUT_GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Fichier',
    items: [
      ['Ctrl+N', 'Nouveau système'],
      ['Ctrl+O', 'Ouvrir un projet'],
      ['Ctrl+S', 'Enregistrer'],
      ['Ctrl+Maj+S', 'Enregistrer sous'],
      ['Ctrl+E', 'Exporter une image'],
      ['Ctrl+G', 'Générateur de système'],
      ['Ctrl+K', 'Palette de commandes'],
    ],
  },
  {
    title: 'Édition',
    items: [
      ['Ctrl+Z', 'Annuler'],
      ['Ctrl+Y', 'Rétablir'],
      ['F2', 'Renommer la sélection'],
      ['Maj + glisser', 'Déplacer un astre dans la vue'],
      ['M', 'Outil Déplacer (glisser sans Maj)'],
      ['Ctrl+D', 'Dupliquer'],
      ['Suppr', 'Supprimer la sélection'],
      ['Échap', 'Désélectionner / quitter le suivi'],
    ],
  },
  {
    title: 'Caméra',
    items: [
      ['F', 'Centrer et suivre la sélection'],
      ['H', "Vue d'ensemble : revenir à la vue normale"],
      ['1 · 2 · 3', 'Dessus · profil · trois-quarts'],
      ['Clic gauche', 'Orbiter'],
      ['Clic droit', 'Déplacer · menu contextuel'],
      ['Molette', 'Zoom sur la sélection, sinon vers le curseur'],
      ['Double-clic', 'Voler vers un astre ou un point'],
      ['Ajouter → clic', "Poser l'objet à l'endroit cliqué (Entrée : auto)"],
    ],
  },
  {
    title: 'Temps & affichage',
    items: [
      ['Espace', 'Lecture / pause'],
      ['+ / −', 'Accélérer / ralentir'],
      ['R', 'Inverser le sens du temps'],
      ['O · L · G · A', 'Orbites · étiquettes · grille · axes'],
      ['Tab', 'Masquer les panneaux'],
      ['I', 'Mode immersif (cinéma, plein écran)'],
      ['Ctrl+Maj+P', 'Mode joueurs'],
      ['F11', 'Plein écran'],
    ],
  },
]
