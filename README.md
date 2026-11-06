<p align="center">
  <img src="assets/brand/banner.png" alt="Astra Universalis, atlas céleste pour meneurs de jeu" width="100%" />
</p>

# Astra Universalis

Atelier de cartographie stellaire pour rôlistes : systèmes solaires, galaxies, nébuleuses, stations et
vaisseaux. Pensé pour **Mothership** et tous les jeux de science-fiction.

Application de bureau : **Electron + React + TypeScript + TailwindCSS**, rendu temps réel **Three.js**
(react-three-fiber, post-traitement HDR).

Le plan de conception complet est dans [docs/PLAN.md](docs/PLAN.md).

---

## Démarrer

Prérequis : Node.js 20+ (testé avec Node 24).

```bash
npm install
```

```bash
npm run dev
```

`npm run dev` lance le serveur Vite puis l'application Electron (outils de développement détachés).
Pour travailler uniquement dans un navigateur :

```bash
npm run dev:web
```

puis ouvrir http://127.0.0.1:5173.

### Bancs d'essai

Chaque module de rendu possède un banc d'essai isolé : http://127.0.0.1:5173/?lab=planets,
`?lab=stars`, `?lab=smallbodies`, `?lab=galaxy`, `?lab=export`… (fichiers `src/labs/*Lab.tsx`).

## Construire

```bash
npm run build
```

```bash
npm run dist
```

`npm run build` vérifie les types puis produit `dist/`. `npm run dist` crée l'installateur Windows
(NSIS) et une version portable dans `release/`. `npm start` lance Electron sur le build.

---

## Fonctionnalités

- **Astres** : étoiles O→M (sous-classes, géantes, supergéantes), naines brunes et blanches, étoiles à
  neutrons, pulsars, trous noirs à disque d'accrétion (lentille gravitationnelle, effet Doppler), ajoutables
  directement depuis le menu Ajouter ; barycentres pour les systèmes multiples.
- **Planètes & lunes** : 15 types (tellurique, océan, jungle, désert, aride, glace, lave, stérile, toxique,
  géantes gazeuses et de glace, Jupiter chaud, chthonienne, œcuménopole, exotique) avec textures
  procédurales calculées sur GPU : relief érodé et chaînes de montagnes, biomes selon le climat, océans à
  reflet solaire ondulé, nuages en volume (cyclones, cumulus, cirrus) aux ombres portées, atmosphère,
  lumières nocturnes, anneaux ombrés. En gros plan, un détail procédural (relief, petits cratères) prend
  le relais des textures, et l'astre observé est recuit en haute résolution.
- **Petits corps** : ceintures d'astéroïdes et de Kuiper (milliers de rochers cratérisés animés), disques
  de débris, nébuleuses et nuages de gaz, comètes (noyau sombre et glacé, queues ionique et de poussière).
- **Artificiels** : stations (anneau, modulaire, cylindre d'O'Neill, avant-poste, chantier, raffinerie,
  épave), vaisseaux, portails de saut, marqueurs (détresse, épave, anomalie, danger…), routes animées.
  Coques procédurales : plaques et joints, salissures, bandes de danger, panneaux solaires, brûlures sur
  les épaves.
- **Mécanique** : orbites képlériennes complètes (a, e, i, Ω, ω, M₀), périodes automatiques (3ᵉ loi de
  Kepler), rotation, inclinaison de l'axe, verrouillage par effet de marée, points de Lagrange.
- **Lisibilité** : échelles linéaire / compressée / logarithmique, axes, équateurs, grille écliptique,
  zone habitable, ligne des glaces, étiquettes intelligentes.
- **Manipulation directe** : glissez un astre dans la vue 3D pour changer son orbite (Maj + glisser, ou
  outil Déplacer `M`) ; renommage partout (F2, double-clic, clic droit, inspecteur).
- **Mode immersif** (`I`) : plein écran sans interface, dérive cinématique de la caméra, bandeau
  documentaire de l'astre suivi, bandes cinéma. Idéal pour projeter en partie.
- **Frise du temps** : glisser pour remonter ou avancer le temps, molette pour zoomer, flèches au clavier.
- **Outils de jeu** : notes MJ par astre, mode joueurs (masque les secrets), calculateur de trajet
  (accélération constante, délai de communication), générateur procédural à graine.
- **Accessibilité** : contrastes conformes WCAG AA, focus visible à deux tons, arbre navigable au clavier
  (flèches, Entrée, F2), respect de « réduire les animations » (vols de caméra instantanés, pas de dérive).
- **Galaxie** : galaxie procédurale, systèmes, routes de saut, régions.
- **Fiche système** imprimable (thèmes Atlas et Impression).
- **Sauvegarde** `.astra` (JSON versionné), autosauvegarde, fichiers récents, annuler/rétablir.
- **Export image** jusqu'à 8K, recadrages (16:9, A4…), étiquettes vectorielles, cartouche titre.

## Raccourcis principaux

| Raccourci | Action |
|---|---|
| Ctrl+N / Ctrl+O / Ctrl+S | Nouveau / Ouvrir / Enregistrer |
| Ctrl+Z / Ctrl+Y | Annuler / Rétablir |
| Ctrl+K | Palette de commandes |
| Ctrl+E | Exporter une image |
| Ctrl+G | Générateur de système |
| F / H | Centrer sur la sélection / Cadrer tout |
| I | Mode immersif |
| M · Maj + glisser | Déplacer un astre |
| F2 | Renommer la sélection |
| 1 · 2 · 3 | Vue de dessus · profil · trois-quarts |
| Espace, + / − | Lecture / pause, vitesse du temps |
| Ctrl+Maj+P | Mode joueurs |

## Structure

```
electron/        processus principal + preload (IPC sécurisé)
src/core/        modèle de données, Kepler, échelles, physique, générateurs
src/store/       état (projet + historique, interface, simulation)
src/three/       moteur de rendu du système
src/galaxy/      vue galaxie
src/ui/          interface (kit de composants, panneaux, dialogues)
src/app/         commandes, démarrage, autosauvegarde
src/labs/        bancs d'essai
```

Logo et bannière : `assets/brand/` (originaux) et `public/brand/` (versions « nuit » pour l'interface et « jour » pour
l'impression).
