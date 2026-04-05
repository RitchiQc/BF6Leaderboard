"""BF6 Leaderboard — Flask application."""

import logging

from flask import Flask, jsonify, render_template, request

from config import GAME_MODES, LEADERBOARD_CATEGORIES, PLATFORMS
from services.bf2042_api import aggregate_leaderboard

logging.basicConfig(level=logging.INFO)

app = Flask(__name__)


@app.route("/")
def index():
    """Serve the main leaderboard page."""
    return render_template(
        "index.html",
        game_modes=GAME_MODES,
        platforms=PLATFORMS,
        categories=LEADERBOARD_CATEGORIES,
    )


@app.route("/api/leaderboard")
def api_leaderboard():
    """Return aggregated leaderboard data as JSON.

    Query parameters:
        platform: Gaming platform (pc, xbl, psn). Default: pc.
        game_mode: Game mode filter. Default: all.
        categories: Comma-separated list of categories. Default: all.
        amount: Number of players per category. Default: 100.
    """
    platform = request.args.get("platform", "pc")
    game_mode = request.args.get("game_mode", "all")
    categories_param = request.args.get("categories", "")
    amount = request.args.get("amount", "100")

    try:
        amount = min(int(amount), 200)
    except (ValueError, TypeError):
        amount = 100

    if categories_param:
        categories = [
            c.strip()
            for c in categories_param.split(",")
            if c.strip() in LEADERBOARD_CATEGORIES
        ]
    else:
        categories = None  # Use all

    result = aggregate_leaderboard(
        categories=categories or None,
        platform=platform,
        game_mode=game_mode,
        amount=amount,
    )

    return jsonify(result)


@app.route("/api/modes")
def api_modes():
    """Return available game modes."""
    return jsonify({"modes": GAME_MODES})


@app.route("/api/platforms")
def api_platforms():
    """Return available platforms."""
    return jsonify({"platforms": PLATFORMS})


@app.route("/api/categories")
def api_categories():
    """Return available leaderboard categories."""
    return jsonify({"categories": LEADERBOARD_CATEGORIES})


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
