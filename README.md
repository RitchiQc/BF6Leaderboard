# 🎯 BF6 Leaderboard — Classement Agrégé

Trouvez les **vrais meilleurs joueurs** de Battlefield 6 en agrégeant toutes les catégories du classement en un seul score.

**Application 100% web** — ouvrez simplement `index.html` dans votre navigateur, aucune installation requise.

## Fonctionnalités

- **Classement agrégé** : combine toutes les catégories (kills, wins, K/D, score/min, etc.) en un seul score normalisé
- **Sélection du mode de jeu** : Strike, Conquête, Percée, Ruée
- **Sélection de plateforme** : PC, Xbox, PlayStation, Steam
- **Choix des catégories** : sélectionnez quelles catégories inclure dans le calcul
- **Détails par joueur** : visualisez la performance par catégorie pour chaque joueur
- **Tri** : triez par rang, nom, score total, ou moyenne par catégorie
- **Barre de progression** : suivi en temps réel du chargement des catégories

## Comment ça marche

1. Les données de classement sont récupérées via l'[API Tracker.gg](https://tracker.gg/bf6) (leaderboard) et l'[API GameTools](https://api.gametools.network/) (joueurs en ligne)
2. Les requêtes Tracker.gg passent par un **Cloudflare Worker auto-hébergé** (ou des proxies CORS publics en secours)
3. Les scores de chaque catégorie sont **normalisés en percentile** (0–100) pour que chaque catégorie ait le même poids
4. Le **score total** est la somme des scores normalisés de toutes les catégories
5. Les joueurs sont classés par score total décroissant

## 🚀 Déployer le Cloudflare Worker (recommandé)

Les proxies CORS publics sont instables. Pour une expérience fiable, déployez votre propre proxy via **Cloudflare Workers** (gratuit, 100 000 requêtes/jour).

### Prérequis

- [Node.js](https://nodejs.org/) (v18+)
- Un compte [Cloudflare](https://dash.cloudflare.com/sign-up) (gratuit)

### Étapes

```bash
# 1. Allez dans le dossier workers
cd workers

# 2. Installez les dépendances
npm install

# 3. Déployez le Worker (va ouvrir le navigateur pour vous connecter à Cloudflare)
npx wrangler deploy
```

Après le déploiement, Wrangler affiche l'URL du Worker, par exemple :
```
https://bf6-leaderboard-proxy.<votre-compte>.workers.dev
```

### Configurer l'application

Ouvrez `js/app.js` et collez l'URL du Worker dans la constante `SELF_HOSTED_PROXY_URL` :

```js
const SELF_HOSTED_PROXY_URL = "https://bf6-leaderboard-proxy.<votre-compte>.workers.dev";
```

C'est tout ! L'application utilisera maintenant votre Worker au lieu des proxies publics.

### Vérifier que ça fonctionne

Ouvrez votre navigateur et allez à :
```
https://bf6-leaderboard-proxy.<votre-compte>.workers.dev/health
```

Vous devriez voir : `{"status":"ok","service":"bf6-leaderboard-proxy"}`

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
├── workers/            # Cloudflare Worker (proxy auto-hébergé)
│   ├── src/
│   │   └── index.js    # Code du Worker
│   ├── wrangler.toml   # Configuration Wrangler
│   └── package.json
└── README.md
```

## Catégories de classement

| Catégorie | Description |
|---|---|
| MatchesWon | Parties gagnées |
| MatchesPlayed | Parties jouées |
| Kills | Victimes |
| Deaths | Morts |
| Assists | Assistances |
| KDRatio | Ratio K/D |
| WLPercentage | % Victoires |
| Score | Score |
| TimePlayed | Temps joué |
| KillsPerMinute | Victimes/min |
| ScorePerMinute | Score/min |

## Modes de jeu

- Strike
- Conquête
- Percée
- Ruée