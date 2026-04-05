"""Service for fetching and aggregating BF2042 leaderboard data."""

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

from config import (
    API_BASE_URL,
    DEFAULT_PLATFORM,
    LEADERBOARD_CATEGORIES,
    LEADERBOARD_FETCH_AMOUNT,
    LOWER_IS_BETTER,
)

logger = logging.getLogger(__name__)

# Timeout for API requests in seconds
REQUEST_TIMEOUT = 15


def fetch_leaderboard(category, platform=None, game_mode="all", skip=0, amount=None):
    """Fetch leaderboard data for a specific category from the gametools API.

    Args:
        category: The leaderboard category (e.g., 'kills', 'deaths').
        platform: Gaming platform ('pc', 'xbl', 'psn').
        game_mode: Game mode filter (e.g., 'all', 'conquest').
        skip: Number of entries to skip for pagination.
        amount: Number of entries to fetch.

    Returns:
        A list of player entries for the given category, or an empty list on error.
    """
    if platform is None:
        platform = DEFAULT_PLATFORM
    if amount is None:
        amount = LEADERBOARD_FETCH_AMOUNT

    params = {
        "name": category,
        "platform": platform,
        "skip": skip,
        "amount": amount,
    }

    if game_mode and game_mode != "all":
        params["gamemode"] = game_mode

    url = f"{API_BASE_URL}/leaderboard/"
    try:
        response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        data = response.json()
        return data.get("data", [])
    except requests.exceptions.RequestException:
        logger.exception("Error fetching leaderboard for category '%s'", category)
        return []


def normalize_scores(players, category):
    """Normalize player scores for a category to a 0-100 scale.

    Uses percentile ranking so each category contributes equally
    to the final aggregated score, regardless of the raw value ranges.

    Args:
        players: List of player dicts with at least 'value' key.
        category: The category name (used to check LOWER_IS_BETTER).

    Returns:
        A dict mapping player names to their normalized score (0-100).
    """
    if not players:
        return {}

    values = sorted(
        [(p.get("name", "Unknown"), p.get("value", 0)) for p in players],
        key=lambda x: x[1],
    )

    total = len(values)
    if total <= 1:
        return {values[0][0]: 100.0} if values else {}

    normalized = {}
    for rank, (name, _value) in enumerate(values):
        percentile = (rank / (total - 1)) * 100
        if category in LOWER_IS_BETTER:
            percentile = 100 - percentile
        normalized[name] = round(percentile, 2)

    return normalized


def aggregate_leaderboard(
    categories=None, platform=None, game_mode="all", amount=None
):
    """Fetch multiple leaderboard categories and compute an aggregated ranking.

    For each category, player scores are normalized to a 0-100 percentile scale.
    The aggregated score is the sum of normalized scores across all categories,
    so the maximum possible score equals ``100 * len(categories)``.

    Args:
        categories: List of category names to aggregate. Defaults to all.
        platform: Gaming platform.
        game_mode: Game mode filter.
        amount: Number of entries to fetch per category.

    Returns:
        A dict with 'players' (sorted list) and 'categories' used.
    """
    if categories is None:
        categories = LEADERBOARD_CATEGORIES
    if platform is None:
        platform = DEFAULT_PLATFORM
    if amount is None:
        amount = LEADERBOARD_FETCH_AMOUNT

    # Fetch all categories in parallel for speed
    category_data = {}
    with ThreadPoolExecutor(max_workers=5) as executor:
        future_to_cat = {
            executor.submit(
                fetch_leaderboard, cat, platform, game_mode, 0, amount
            ): cat
            for cat in categories
        }
        for future in as_completed(future_to_cat):
            cat = future_to_cat[future]
            try:
                category_data[cat] = future.result()
            except Exception:
                logger.exception("Error fetching category '%s'", cat)
                category_data[cat] = []

    # Normalize scores for each category
    normalized_by_category = {}
    for cat, players in category_data.items():
        normalized_by_category[cat] = normalize_scores(players, cat)

    # Aggregate: sum normalized scores per player
    player_scores = {}
    for cat, scores in normalized_by_category.items():
        for player_name, score in scores.items():
            if player_name not in player_scores:
                player_scores[player_name] = {
                    "name": player_name,
                    "total_score": 0,
                    "categories": {},
                    "categories_count": 0,
                }
            player_scores[player_name]["total_score"] += score
            player_scores[player_name]["categories"][cat] = score
            player_scores[player_name]["categories_count"] += 1

    # Sort by total score descending
    sorted_players = sorted(
        player_scores.values(),
        key=lambda p: p["total_score"],
        reverse=True,
    )

    # Add rank
    for i, player in enumerate(sorted_players):
        player["rank"] = i + 1
        player["total_score"] = round(player["total_score"], 2)
        # Calculate average score per category
        if player["categories_count"] > 0:
            player["avg_score"] = round(
                player["total_score"] / player["categories_count"], 2
            )
        else:
            player["avg_score"] = 0

    max_possible = len(categories) * 100
    return {
        "players": sorted_players,
        "categories": categories,
        "max_possible_score": max_possible,
        "total_categories": len(categories),
    }
