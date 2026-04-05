# 🎯 BF6 Leaderboard — Classement Agrégé

Trouvez les **vrais meilleurs joueurs** de Battlefield 2042 (BF6) en agrégeant toutes les catégories du classement en un seul score.

## Fonctionnalités

- **Classement agrégé** : combine toutes les catégories (kills, wins, K/D, score/min, etc.) en un seul score normalisé
- **Sélection du mode de jeu** : Conquête, Percée, Hazard Zone, Portal, Ruée, ou tous les modes
- **Sélection de plateforme** : PC, Xbox, PlayStation
- **Choix des catégories** : sélectionnez quelles catégories inclure dans le calcul
- **Détails par joueur** : visualisez la performance par catégorie pour chaque joueur
- **Tri** : triez par rang, nom, score total, ou moyenne par catégorie

## Comment ça marche

1. Les données de classement sont récupérées via l'[API GameTools](https://api.gametools.network/) pour chaque catégorie sélectionnée
2. Les scores de chaque catégorie sont **normalisés en percentile** (0–100) pour que chaque catégorie ait le même poids
3. Le **score total** est la somme des scores normalisés de toutes les catégories
4. Les joueurs sont classés par score total décroissant

## Installation

```bash
# Cloner le dépôt
git clone https://github.com/RitchiQc/BF6Leaderboard.git
cd BF6Leaderboard

# Créer un environnement virtuel (recommandé)
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Installer les dépendances
pip install -r requirements.txt
```

## Lancer l'application

```bash
python app.py
```

L'application sera accessible à [http://localhost:5000](http://localhost:5000).

## Configuration (variables d'environnement)

| Variable | Description | Défaut |
|---|---|---|
| `BF2042_API_URL` | URL de base de l'API | `https://api.gametools.network/bf2042` |
| `DEFAULT_PLATFORM` | Plateforme par défaut | `pc` |
| `LEADERBOARD_FETCH_AMOUNT` | Nombre de joueurs par catégorie | `100` |

## API Endpoints

| Route | Description |
|---|---|
| `GET /` | Page principale du classement |
| `GET /api/leaderboard` | Données agrégées (params: `platform`, `game_mode`, `categories`, `amount`) |
| `GET /api/modes` | Liste des modes de jeu |
| `GET /api/platforms` | Liste des plateformes |
| `GET /api/categories` | Liste des catégories disponibles |

## Tests

```bash
pip install pytest
pytest tests/
```

## Structure du projet

```
BF6Leaderboard/
├── app.py                      # Application Flask
├── config.py                   # Configuration et constantes
├── requirements.txt            # Dépendances Python
├── services/
│   ├── __init__.py
│   └── bf2042_api.py           # Client API et logique d'agrégation
├── templates/
│   └── index.html              # Interface utilisateur
├── static/
│   ├── css/style.css           # Styles
│   └── js/app.js               # Logique frontend
└── tests/
    └── test_aggregation.py     # Tests unitaires
```