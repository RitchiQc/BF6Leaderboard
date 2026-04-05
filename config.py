import os

# Base API URL for gametools BF2042 API
API_BASE_URL = os.environ.get(
    "BF2042_API_URL", "https://api.gametools.network/bf2042"
)

# Default platform (pc, xbl, psn)
DEFAULT_PLATFORM = os.environ.get("DEFAULT_PLATFORM", "pc")

# Number of players to fetch per leaderboard category
LEADERBOARD_FETCH_AMOUNT = int(os.environ.get("LEADERBOARD_FETCH_AMOUNT", "100"))

# Leaderboard categories available for aggregation
LEADERBOARD_CATEGORIES = [
    "kills",
    "deaths",
    "wins",
    "losses",
    "assists",
    "revives",
    "headshots",
    "killsPerMinute",
    "damagePerMinute",
    "scorePerMinute",
    "winPercent",
    "killDeath",
    "infantryKillDeath",
    "bestSquad",
    "vehiclesDestroyed",
    "saviorKills",
    "avengerKills",
    "spotEnemies",
    "objectiveTime",
    "timePlayed",
]

# Categories where lower is better (will be inverted during normalization)
LOWER_IS_BETTER = ["deaths", "losses"]

# Available game modes
GAME_MODES = [
    {"id": "all", "name": "Tous les modes"},
    {"id": "conquest", "name": "Conquête"},
    {"id": "breakthrough", "name": "Percée"},
    {"id": "hazardzone", "name": "Hazard Zone"},
    {"id": "portal", "name": "Portal"},
    {"id": "rush", "name": "Ruée"},
    {"id": "strikepoint", "name": "Strikepoint"},
]

# Available platforms
PLATFORMS = [
    {"id": "pc", "name": "PC"},
    {"id": "xbl", "name": "Xbox"},
    {"id": "psn", "name": "PlayStation"},
]
