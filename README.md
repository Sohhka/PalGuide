<div align="center">

<img src="public/logo.png" width="96" alt="PalGuide" />

# PalGuide

**Application de bureau — non officiel pour Palworld 1.0, en français.**

Paldex complet · Calculateur de reproduction (chemins complets) · Taux de capture · Team Builder

</div>

---

## ✨ Fonctionnalités

- 📖 **Paldex** — les 299 Pals de Palworld 1.0. Survole un Pal pour un aperçu rapide, clique pour ouvrir sa **fiche complète** (stats, éléments, aptitudes de travail, partner skill, passifs, compétences actives, drops, reproduction & capture).
- 🥚 **Breeding** — calcul direct (Parent 1 + Parent 2 = enfant), **toutes les recettes** d'un Pal, **path finder** (chemin le plus court depuis tes Pals) et **arbre de reproduction** interactif avec **planificateur de talents** : choisis les passifs visés et repère, parmi tes Pals importés, ceux qui les portent (leurs talents s'affichent dans l'arbre).
- 🎯 **Capture** — estimation du taux de capture par sphère selon le niveau, les PV, la puissance de capture et le bonus dans le dos.
- 🎒 **Objets** — recherche un objet pour voir **tous les Pals qui le lâchent**, avec la quantité et le taux de drop.
- 🎮 **Ma partie** — importe la **sauvegarde de ta partie** Palworld pour récupérer tes Pals (équipe, boîte, base) avec leurs **niveaux, IVs et passifs**. Alimente aussi le path finder. *(Import : app de bureau, nécessite Python — voir plus bas.)*
- 👥 **Team Builder** — équipe de 5, partner skills, **détection des cumuls** (stacking), synergies, couverture élémentaire et aptitudes de travail cumulées.
- 📝 **Notes & projets** — carnet local pour planifier tes objectifs.

Interface inspirée des menus du jeu, **100 % en français**, **hors-ligne** (données et images embarquées).

## 📸 Captures d'écran

### Paldex

![Paldex](https://medias.lerobro.com/screenshots/Sohhka/PalGuide_ojqhF7HXY4.png)

Survole un Pal pour un aperçu rapide, clique pour ouvrir sa fiche complète :

| Aperçu au survol | Fiche complète (popup) |
|:---:|:---:|
| ![Paldex — survol d'un Pal](https://medias.lerobro.com/screenshots/Sohhka/PalGuide_2e7NF5ci1l.png) | ![Paldex — popup fiche complète](https://medias.lerobro.com/screenshots/Sohhka/PalGuide_a8msyMZ20L.png) |

### Reproduction (Breeding)

| Calculateur de reproduction | Arbre de reproduction |
|:---:|:---:|
| ![Calculateur de reproduction](https://medias.lerobro.com/screenshots/Sohhka/PalGuide_FaKvIThQjQ.png) | ![Arbre de reproduction](https://medias.lerobro.com/screenshots/Sohhka/PalGuide_7ar0vsYmET.png) |

### Capture · Équipe · Notes

| Taux de capture | Composition d'équipe | Notes & projets |
|:---:|:---:|:---:|
| ![Calculateur de taux de capture](https://medias.lerobro.com/screenshots/Sohhka/PalGuide_lcL6rPAwFU.png) | ![Composition d'équipe](https://medias.lerobro.com/screenshots/Sohhka/PalGuide_lwv4t0f9wW.png) | ![Notes & projets](https://medias.lerobro.com/screenshots/Sohhka/PalGuide_hMoLB0Wrf6.png) |

### Recherche d'objets

![Recherche d'objets](https://medias.lerobro.com/screenshots/Sohhka/firefox_jYLT276ZxV.png)

## ⬇️ Installation (utilisateurs)

1. Va dans l'onglet **[Releases](../../releases)**.
2. Télécharge le fichier **`PalGuide-Setup-x.y.z.exe`**.
3. Lance-le et suis l'installateur. Une icône PalGuide est créée sur le bureau et dans le menu Démarrer.

> L'application n'est pas signée numériquement : Windows SmartScreen peut afficher un avertissement.
> Clique sur **« Informations complémentaires » → « Exécuter quand même »**.

## 🎮 Importer ta sauvegarde (onglet « Ma partie »)

PalGuide peut lire ta sauvegarde pour afficher tes Pals possédés (équipe / boîte / base) avec leurs niveaux, IVs et passifs, et alimenter le path finder. **Lecture seule** : ta sauvegarde n'est jamais modifiée.

Prérequis (une seule fois) :

1. Installer **[Python](https://www.python.org/downloads/)** (coche « Add Python to PATH » à l'installation).
2. Installer le paquet de lecture des saves :
   ```bash
   pip install palworld-save-tools
   ```

Ensuite, dans l'onglet **Ma partie** → « Choisir Level.sav et importer », sélectionne le fichier de ton monde :
```
%LOCALAPPDATA%\Pal\Saved\SaveGames\<SteamID>\<monde>\Level.sav
```

> La décompression Oodle des saves récentes (format `PlM`) est gérée automatiquement par l'app (via `oozextract`). Recharger une sauvegarde **remplace** l'ancienne (jamais de fusion).

## 🛠️ Développement

Prérequis : **Node.js 18+**.

```bash
npm install

npm run dev            # version web (navigateur) sur http://localhost:5180
npm run electron:dev   # application de bureau (Electron) en mode dev
npm run build          # build web de production (dossier dist/)
npm run dist:win       # génère l'installateur Windows -> dossier release/
```

## 🗂️ Données & mise à jour après un patch Palworld

Les données sont générées puis embarquées dans `src/data/` (aucun appel réseau au runtime).

| Source | Rôle |
|---|---|
| **[PalCalc](https://github.com/tylercamp/palcalc)** (licence MIT) | Noyau : liste des Pals, stats, breeding power, **graphe de reproduction complet** (combos spéciaux inclus), aptitudes de travail, passifs, genres, noms FR. |
| **[paldb.cc](https://paldb.cc)** | Élément par Pal, drops, partner skills, compétences apprises, taux de capture (`CaptureRateCorrect`), descriptions FR et images. |

Pour régénérer après une mise à jour du jeu :

```bash
# 1) Récupérer PalCalc (données noyau) — une seule fois
git clone --depth 1 https://github.com/tylercamp/palcalc data/_sources/palcalc

# 2) Régénérer
npm run scrape-paldb     # scrape paldb.cc (avec cache HTML)  -> data/_cache/paldb.json
npm run build-data       # fusionne PalCalc + paldb           -> src/data/*.json
npm run download-assets  # rapatrie les images en local       -> public/img/
```

Options : `node scripts/scrape-paldb.mjs --parse` (re-parse le cache sans re-télécharger), `--force` (re-télécharge tout).

## 🧱 Stack technique

Electron · Vite · React · TypeScript · Tailwind CSS v4 · Zustand · React Router (HashRouter).

## 🤝 Crédits

- Données : **PalCalc** (MIT) et **paldb.cc**. Merci à leurs auteurs.
- Application développée avec l'aide de **Claude** (Anthropic).
- Projet **non affilié** à Pocketpair. « Palworld » et les noms/images de Pals appartiennent à leurs propriétaires respectifs. Ce projet est fourni à des fins d'information pour la communauté.

## ⚠️ Notes

- Le **taux de capture** est une *estimation* calibrée sur les valeurs de référence : la formule native du jeu n'est pas publiée. Les valeurs sans bonus correspondent aux calculateurs de référence.
