# 🎯 BF6 Leaderboard — Classement Agrégé

Trouvez les **vrais meilleurs joueurs** de Battlefield 6 en agrégeant toutes les catégories du classement en un seul score.

**Application 100% web** — ouvrez simplement `index.html` dans votre navigateur, aucune installation requise.

## Fonctionnalités

- **Classement agrégé** : combine toutes les catégories (kills, wins, K/D, score/min, etc.) en un seul score normalisé
- **Sélection du mode de jeu** : Conquête, Percée, Hazard Zone, Portal, Ruée, Strikepoint, ou tous les modes
- **Sélection de plateforme** : PC, Xbox, PlayStation
- **Choix des catégories** : sélectionnez quelles catégories inclure dans le calcul
- **Détails par joueur** : visualisez la performance par catégorie pour chaque joueur
- **Tri** : triez par rang, nom, score total, ou moyenne par catégorie
- **Barre de progression** : suivi en temps réel du chargement des catégories

## Comment ça marche

1. Les données de classement sont récupérées via l'[API GameTools](https://api.gametools.network/) directement depuis votre navigateur
2. Les scores de chaque catégorie sont **normalisés en percentile** (0–100) pour que chaque catégorie ait le même poids
3. Le **score total** est la somme des scores normalisés de toutes les catégories
4. Les joueurs sont classés par score total décroissant

## Utilisation

### Option 1 : Ouvrir directement

Téléchargez le projet et ouvrez `index.html` dans votre navigateur.

```bash
git clone https://github.com/RitchiQc/BF6Leaderboard.git
cd BF6Leaderboard
# Ouvrez index.html dans votre navigateur
```

### Option 2 : GitHub Pages

Le site peut être hébergé gratuitement sur GitHub Pages. Activez-le dans les paramètres du dépôt (`Settings > Pages > Source: main`).

## Structure du projet

```
BF6Leaderboard/
├── index.html          # Page principale (ouvrir dans le navigateur)
├── css/
│   └── style.css       # Styles (dark theme gaming)
├── js/
│   └── app.js          # Toute la logique (config, API, normalisation, agrégation)
└── README.md
```

## Catégories de classement

| Catégorie | Description |
|---|---|
| kills | Éliminations |
| deaths | Morts (inversé: moins = mieux) |
| wins | Victoires |
| losses | Défaites (inversé: moins = mieux) |
| assists | Assistances |
| revives | Réanimations |
| headshots | Tirs à la tête |
| killsPerMinute | Éliminations par minute |
| damagePerMinute | Dégâts par minute |
| scorePerMinute | Score par minute |
| winPercent | Pourcentage de victoires |
| killDeath | Ratio K/D |
| infantryKillDeath | Ratio K/D infanterie |
| bestSquad | Meilleure escouade |
| vehiclesDestroyed | Véhicules détruits |
| saviorKills | Éliminations de sauveur |
| avengerKills | Éliminations de vengeur |
| spotEnemies | Ennemis repérés |
| objectiveTime | Temps sur objectif |
| timePlayed | Temps de jeu |

## Modes de jeu

- Tous les modes
- Conquête
- Percée
- Hazard Zone
- Portal
- Ruée
- Strikepoint