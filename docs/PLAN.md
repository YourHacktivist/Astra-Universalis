# Astra Universalis : plan de conception

> Atelier de cartographie stellaire pour rôlistes (Mothership, et tout jeu de SF).
> Application de bureau : **Electron + React + TypeScript + TailwindCSS**, rendu **Three.js** (react-three-fiber).

---

## 1. Vision

Créer, animer, annoter et partager des systèmes stellaires et des galaxies **magnifiques et crédibles**,
en quelques clics (générateur procédural) ou dans le moindre détail (éditeur complet).

Trois piliers :

1. **Beauté.** Rendu cinématique : étoiles vivantes (granulation, couronne, bloom), planètes procédurales
   (relief, océans spéculaires, nuages, atmosphère diffusante, lumières nocturnes), anneaux ombrés,
   ceintures d'astéroïdes, nébuleuses volumétriques, comètes à double queue, trous noirs à disque d'accrétion.
2. **Lisibilité de jeu.** Orbites, axes de rotation, inclinaisons, zone habitable, ligne des glaces,
   étiquettes intelligentes, échelles compressées lisibles, mode joueurs (masque les secrets du MJ).
3. **Fiabilité d'outil.** Sauvegarde `.astra`, autosauvegarde, annuler/rétablir, export image haute
   résolution avec cartouche, fiche système imprimable.

---

## 2. Direction artistique

**Concept : « atlas céleste d'ingénieur ».** L'élégance gravée des atlas anciens (Uranographia) et la
rigueur d'un manuel technique : panneaux ancrés à fond plein, filets d'un pixel, arrondis minimes (2–4 px),
aucun flou ni dégradé ni lueur décorative, titres en petites capitales mono, données en chasse fixe.
Police d'interface IBM Plex Sans / Mono (révision : Inter et le verre givré donnaient un aspect générique).

| Rôle | Valeur | Usage |
|---|---|---|
| Vide | `#04050A` | fond, espace |
| Abysse | `#0A0C14` | surfaces opaques |
| Verre | `rgba(12,14,22,0.68)` + flou 20px | panneaux flottants |
| Filet | `rgba(255,255,255,0.07)` | bordures, séparateurs |
| Texte | `#E8EAF1` / `#9AA0B2` / `#5E6476` | primaire / secondaire / discret |
| **Aurum** | `#E9B96E` | accent principal (l'éclat doré du logo) : sélection, actions, marque |
| **Ion** | `#8AB0FF` | ATH (le bleu acier des orbites du logo) : orbites actives, temps, mesures |
| Viridis | `#7EE2A8` | zone habitable, succès |
| Nova | `#FF7B6B` | dangers, suppression |
| Nébula | `#A792FF` | galaxie, nébuleuses |

**Logo** : fourni (`assets/brand/logo-original.webp`, fond transparent). Une version « nuit » en est dérivée
pour l'interface sombre (traits fins relevés en bleu acier, planètes et halo doré conservés) :
`public/brand/logo-night.png`. La version « jour » d'origine sert à la fiche imprimable. Icône d'application :
`build/icon.ico` / `build/icon.png`.

Typographies (embarquées, hors-ligne) :
- **Cormorant Garamond** : titres, logo, noms des astres (inspiration atlas).
- **Inter** : interface.
- **JetBrains Mono** : valeurs numériques, coordonnées, dates.

Mouvement : transitions 150–250 ms, easing doux ; caméra en vol fluide (camera-controls) ; rien ne clignote sans raison.

---

## 3. Architecture technique

```
electron/            Processus principal + preload (IPC sécurisé, contextIsolation)
src/
  core/              Modèle de données, mécanique orbitale, physique, générateurs (aucune dépendance UI)
  store/             Zustand : projet (+ historique), UI, simulation (temps)
  three/             Moteur de rendu : scène système, corps, superpositions, effets, caméra, export
  galaxy/            Vue galaxie (rendu + génération)
  ui/                Kit de composants + panneaux (hiérarchie, inspecteur, temps, menus, dialogues)
  lib/               Utilitaires : PRNG, couleurs, formatage, plateforme (Electron/navigateur)
  labs/              Bancs d'essai isolés (?lab=nom) pour développer chaque module
```

### Principes de performance
- **Une seule boucle de simulation** : un `useFrame` calcule toutes les positions (Kepler) et écrit dans un
  registre partagé ; les composants lisent le registre (aucun rendu React par image).
- **Textures planétaires précalculées sur GPU** (rendu dans une cible : albédo, normales, nuages) ; le shader
  d'affichage ne fait que de l'échantillonnage. Re-cuisson uniquement si les paramètres changent.
- **Astéroïdes en `InstancedMesh`**, orbites calculées dans le vertex shader (0 coût CPU par image).
- **Nébuleuses en sprites instanciés** (atlas de fumée procédural généré une fois).
- **Queues de comètes** en particules animées dans le shader.
- **Uniforms d'éclairage partagés** (positions/couleurs des étoiles) mis à jour une fois par image.
- **Plan proche dynamique** de la caméra (précision de profondeur de 0,1 à 10 000 unités sans log-depth).
- Réglage de qualité (Basse → Ultra) : DPR, MSAA, taille des textures, nombre d'astéroïdes, bloom.

---

## 4. Modèle de données

Fichier projet `.astra` (JSON versionné) :

```
Project
 ├─ meta (nom, dates, version)
 ├─ systems: { [id]: StarSystem }
 ├─ galaxy: Galaxy | null
 └─ activeSystemId
```

**StarSystem** : nom, désignation, description, graine, calendrier (année d'époque), réglages d'affichage
(mode d'échelle, facteur de taille des corps), environnement (densité d'étoiles, voie lactée, teinte de
nébuleuse de fond), corps (`bodies` à plat, hiérarchie via `parentId`), vue enregistrée (temps, caméra).

**Body** (commun) : id, type, nom, parent, ordre, orbite, rotation, visibilité éditeur / joueurs,
verrouillage, couleur de repère, notes MJ, tags, graine.

**Types de corps** : étoile (O→M, géantes, naine blanche/brune, étoile à neutrons, pulsar, trou noir),
barycentre (systèmes multiples), planète (tellurique, océan, désert, aride, jungle, glace, lave,
stérile, toxique, géante gazeuse, géante de glace, chthonienne, œcuménopole, exotique), lune,
ceinture (astéroïdes, Kuiper, disque de débris), nébuleuse/nuage de gaz, comète, station, vaisseau,
portail de saut, marqueur (balise de détresse, épave, anomalie, danger…), route.

**Orbite** (éléments képlériens) : demi-grand axe, excentricité, inclinaison, longitude du nœud ascendant,
argument du périastre, anomalie moyenne à l'époque, période (auto par la 3ᵉ loi de Kepler ou manuelle),
rétrograde, fixe (immobile), affichage de l'orbite.

**Rotation** : période (h), inclinaison de l'axe, azimut de l'axe, verrouillage par effet de marée.

**Notes MJ (Mothership)** : description, population, contrôle/faction, atmosphère, dangers, ressources,
points d'intérêt, rumeurs, secret (masqué en mode joueurs).

---

## 5. Rendu, détail par élément

| Élément | Technique |
|---|---|
| Ciel | Sphère shader : ~12 000 étoiles scintillantes colorées par température, bande galactique bruitée, nébuleuses de fond teintables |
| Étoile | Granulation animée (bruit 3D), assombrissement centre-bord, taches, couronne en billboard à rayons, traînée anamorphique, bloom HDR, lumière ponctuelle |
| Trou noir | Horizon noir, disque d'accrétion tourbillonnant (effet Doppler), anneau de photons, arcs lentillés |
| Pulsar / étoile à neutrons | Cœur ultra-lumineux, faisceaux coniques tournants |
| Planète | Textures cuites GPU (albédo + masque spéculaire, normales objet + émissif, nuages) ; éclairage multi-étoiles, terminateur doux, reflets océaniques, lumières des villes côté nuit, lave émissive |
| Atmosphère | Coquille en diffusion de bord (fresnel) teintée, rougeoiement au terminateur |
| Nuages | Couche séparée tournant à sa propre vitesse, ombres portées sur le sol |
| Anneaux | Bandes procédurales, ombre de la planète sur l'anneau ET de l'anneau sur la planète |
| Ceintures | Milliers de rochers instanciés (rotation différentielle képlérienne) + poussière |
| Nébuleuse | Sprites instanciés, couches émissives additives + lanes sombres, étoiles enfouies |
| Comète | Noyau, coma, queue ionique (droite, bleue) + queue de poussière (courbée), longueur ∝ 1/r² |
| Station / vaisseau / portail | Géométries procédurales (anneau rotatif, modulaire, cylindre O'Neill, avant-poste, chantier, épave ; cargo, corvette, remorqueur, navette, minier), feux clignotants, réacteurs |
| Marqueurs | Hologrammes pulsants avec icône |
| Repères | Orbites à traînée dégradée, grille écliptique polaire graduée en UA, zone habitable, ligne des glaces, axes de rotation + équateur, routes animées, ATH de sélection |
| Post-traitement | Bloom, tonemapping AgX, vignette, grain ; **mode « Terminal »** (monochrome ambre, scanlines, courbure CRT) pour l'ambiance Mothership |

### Échelles
L'espace réel est illisible. Trois modes : **Linéaire** (réaliste), **Compressé** (racine, par défaut),
**Logarithmique**. Les lunes sont placées relativement au rayon de leur planète. Les tailles des corps
sont exagérées (facteur réglable). Les valeurs physiques (UA, km, jours) restent exactes dans l'inspecteur.

---

## 6. Interface

```
┌──────────────────────────────────────────────────────────────────────┐
│ ✦ Astra Universalis   Fichier Édition Affichage  │ Kepler-442 ● │ Système Galaxie Fiche │ ─ □ ✕ │
├───────────┬──────────────────────────────────────────────┬───────────┤
│ Hiérarchie│                                              │ Inspecteur│
│ (arbre,   │            Vue 3D plein écran                │ (onglets :│
│ recherche,│                                              │ Général,  │
│ visibilité│                                              │ Orbite,   │
│ glisser)  │        [ + Ajouter ]  outils de vue          │ Physique, │
│           │                                              │ Apparence,│
│           │   ⏮ ◀◀ ▶ ▶▶  1 jour/s   2491-03-14 06:32     │ Notes MJ) │
└───────────┴──────────────────────────────────────────────┴───────────┘
```

- **Barre de titre** personnalisée (sans cadre), menus, nom du document + indicateur de modification, sélecteur de vue.
- **Hiérarchie** : arbre des corps, icônes typées, visibilité éditeur / joueurs, recherche, menu contextuel.
- **Inspecteur** : champs numériques à glisser (style Figma/Blender), curseurs, sélecteurs de couleur,
  valeurs dérivées calculées (gravité, température d'équilibre, vitesse de libération, durée du jour/année).
- **Barre de temps** : lecture/pause, vitesses (1 h/s → 10 ans/s), sens, date du calendrier de campagne.
- **Options de vue** : orbites, étiquettes, axes, grille, zone habitable, ligne des glaces, routes, style de rendu.
- **Palette de commandes** (Ctrl+K), raccourcis clavier, menus contextuels, notifications.
- **Accueil** : nouveau système, générer, modèle Sol, nouvelle galaxie, ouvrir, fichiers récents.
- **Mode joueurs** : masque les corps/notes secrets, idéal pour la projection en partie.

### Outils de jeu
- **Calculateur de trajet** : distance actuelle entre deux corps, temps de trajet à accélération constante
  (0,1 g → 5 g, retournement à mi-parcours), délai de communication (temps-lumière).
- **Placement aux points de Lagrange** (L4/L5) en un clic.
- **Générateur** à graine : réaliste / varié / exotique ; stations minières, épaves, balises, portails.

---

## 7. Vue Galaxie

Galaxie procédurale (spirale, spirale barrée, elliptique, anneau, irrégulière) en ~150 000 particules
(bulbe, bras logarithmiques, poussière), systèmes placés comme marqueurs lumineux, **routes de saut**
(cote de saut, distance en années-lumière), **régions** nommées. Clic → ouvrir le système ; un marqueur
sans système peut en générer un instantanément.

---

## 8. Fiche système

Vue 2D imprimable : bandeau du système, corps alignés à l'échelle relative, lunes, stations, tableau des
caractéristiques (type, distance, période, gravité, température, atmosphère, notes). Thèmes : Atlas
(sombre) et Impression (clair, brut, façon zine Mothership). Export PNG.

---

## 9. Sauvegarde & export

- **`.astra`** : JSON versionné avec migrations ; Enregistrer / Enregistrer sous / Ouvrir ; fichiers récents ;
  association de fichier ; autosauvegarde (récupération après plantage) ; confirmation à la fermeture.
- **Export image** : PNG/JPEG/WebP, ×1 à ×4 (jusqu'à 8K), recadrage (fenêtre, 16:9, 4:3, 1:1, A4),
  étiquettes composées en vectoriel, cartouche titre + légende, fond transparent, copie presse-papiers.
- **Export/import** d'un système seul (partage entre MJ).

---

## 10. Étapes

1. Socle : Electron + Vite + React + TS + Tailwind, polices, thème, kit UI.
2. Cœur : types, fabriques, Kepler, échelles, physique, PRNG, stores, historique.
3. Moteur 3D : boucle de simulation, registre, caméra, sélection, superpositions.
4. Modules de rendu (en parallèle) : planètes · étoiles & ambiance · petits corps & artificiels.
5. Interface complète (en parallèle) · Contenu : générateur, Sol, galaxie, fiche.
6. Persistance Electron, export image, intégration.
7. Vérification visuelle, performances, empaquetage Windows (electron-builder, NSIS + portable).
