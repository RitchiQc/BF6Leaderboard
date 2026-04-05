"""Tests for the BF2042 leaderboard aggregation logic."""

import json
from unittest.mock import patch

import pytest

from app import app
from services.bf2042_api import aggregate_leaderboard, normalize_scores


# --- normalize_scores tests ---


class TestNormalizeScores:
    """Tests for the normalize_scores function."""

    def test_empty_list(self):
        result = normalize_scores([], "kills")
        assert result == {}

    def test_single_player(self):
        players = [{"name": "Player1", "value": 500}]
        result = normalize_scores(players, "kills")
        assert result == {"Player1": 100.0}

    def test_two_players(self):
        players = [
            {"name": "Player1", "value": 100},
            {"name": "Player2", "value": 200},
        ]
        result = normalize_scores(players, "kills")
        assert result["Player1"] == 0.0
        assert result["Player2"] == 100.0

    def test_three_players_linear(self):
        players = [
            {"name": "Low", "value": 10},
            {"name": "Mid", "value": 50},
            {"name": "High", "value": 100},
        ]
        result = normalize_scores(players, "kills")
        assert result["Low"] == 0.0
        assert result["Mid"] == 50.0
        assert result["High"] == 100.0

    def test_lower_is_better(self):
        """For 'deaths', lower values should get higher normalized scores."""
        players = [
            {"name": "FewDeaths", "value": 10},
            {"name": "ManyDeaths", "value": 1000},
        ]
        result = normalize_scores(players, "deaths")
        assert result["FewDeaths"] == 100.0
        assert result["ManyDeaths"] == 0.0

    def test_lower_is_better_losses(self):
        players = [
            {"name": "A", "value": 5},
            {"name": "B", "value": 50},
            {"name": "C", "value": 100},
        ]
        result = normalize_scores(players, "losses")
        assert result["A"] == 100.0
        assert result["B"] == 50.0
        assert result["C"] == 0.0

    def test_missing_value_defaults_to_zero(self):
        players = [
            {"name": "Player1"},
            {"name": "Player2", "value": 100},
        ]
        result = normalize_scores(players, "kills")
        assert result["Player1"] == 0.0
        assert result["Player2"] == 100.0

    def test_missing_name_defaults_to_unknown(self):
        players = [{"value": 100}]
        result = normalize_scores(players, "kills")
        assert "Unknown" in result


# --- aggregate_leaderboard tests ---


def _mock_fetch_leaderboard(category, platform=None, game_mode="all",
                            skip=0, amount=None):
    """Return fake leaderboard data for testing."""
    data = {
        "kills": [
            {"name": "Alpha", "value": 1000},
            {"name": "Bravo", "value": 800},
            {"name": "Charlie", "value": 600},
        ],
        "deaths": [
            {"name": "Alpha", "value": 200},
            {"name": "Bravo", "value": 500},
            {"name": "Charlie", "value": 100},
        ],
        "wins": [
            {"name": "Alpha", "value": 50},
            {"name": "Bravo", "value": 80},
            {"name": "Charlie", "value": 60},
        ],
    }
    return data.get(category, [])


class TestAggregateLeaderboard:
    """Tests for the aggregate_leaderboard function."""

    @patch("services.bf2042_api.fetch_leaderboard", side_effect=_mock_fetch_leaderboard)
    def test_aggregate_returns_sorted_players(self, mock_fetch):
        result = aggregate_leaderboard(
            categories=["kills", "wins"],
            platform="pc",
            game_mode="all",
            amount=50,
        )
        assert "players" in result
        assert "categories" in result
        assert len(result["players"]) == 3
        # First player should have highest total score
        assert result["players"][0]["rank"] == 1
        assert result["players"][0]["total_score"] >= result["players"][1]["total_score"]

    @patch("services.bf2042_api.fetch_leaderboard", side_effect=_mock_fetch_leaderboard)
    def test_aggregate_includes_all_categories(self, mock_fetch):
        result = aggregate_leaderboard(
            categories=["kills", "deaths", "wins"],
            platform="pc",
        )
        assert result["total_categories"] == 3
        assert result["max_possible_score"] == 300

    @patch("services.bf2042_api.fetch_leaderboard", side_effect=_mock_fetch_leaderboard)
    def test_aggregate_player_has_category_breakdown(self, mock_fetch):
        result = aggregate_leaderboard(
            categories=["kills", "wins"],
            platform="pc",
        )
        player = result["players"][0]
        assert "categories" in player
        assert "kills" in player["categories"]
        assert "wins" in player["categories"]

    @patch("services.bf2042_api.fetch_leaderboard", side_effect=_mock_fetch_leaderboard)
    def test_aggregate_ranks_are_sequential(self, mock_fetch):
        result = aggregate_leaderboard(
            categories=["kills"],
            platform="pc",
        )
        ranks = [p["rank"] for p in result["players"]]
        assert ranks == [1, 2, 3]

    @patch("services.bf2042_api.fetch_leaderboard", side_effect=_mock_fetch_leaderboard)
    def test_aggregate_deaths_inverted(self, mock_fetch):
        """Charlie has fewest deaths (100), should get highest normalized score for deaths."""
        result = aggregate_leaderboard(
            categories=["deaths"],
            platform="pc",
        )
        # Charlie should be #1 (fewest deaths = best)
        assert result["players"][0]["name"] == "Charlie"

    @patch("services.bf2042_api.fetch_leaderboard", side_effect=_mock_fetch_leaderboard)
    def test_avg_score_calculated(self, mock_fetch):
        result = aggregate_leaderboard(
            categories=["kills", "wins"],
            platform="pc",
        )
        for player in result["players"]:
            expected_avg = round(player["total_score"] / player["categories_count"], 2)
            assert player["avg_score"] == expected_avg

    @patch("services.bf2042_api.fetch_leaderboard", return_value=[])
    def test_aggregate_empty_data(self, mock_fetch):
        result = aggregate_leaderboard(
            categories=["kills"],
            platform="pc",
        )
        assert result["players"] == []


# --- Flask route tests ---


class TestFlaskRoutes:
    """Tests for the Flask API endpoints."""

    @pytest.fixture()
    def client(self):
        app.config["TESTING"] = True
        with app.test_client() as client:
            yield client

    def test_index_returns_html(self, client):
        response = client.get("/")
        assert response.status_code == 200
        assert b"BF6 Leaderboard" in response.data

    def test_modes_endpoint(self, client):
        response = client.get("/api/modes")
        assert response.status_code == 200
        data = json.loads(response.data)
        assert "modes" in data
        assert len(data["modes"]) > 0

    def test_platforms_endpoint(self, client):
        response = client.get("/api/platforms")
        assert response.status_code == 200
        data = json.loads(response.data)
        assert "platforms" in data

    def test_categories_endpoint(self, client):
        response = client.get("/api/categories")
        assert response.status_code == 200
        data = json.loads(response.data)
        assert "categories" in data
        assert "kills" in data["categories"]

    @patch("app.aggregate_leaderboard")
    def test_leaderboard_endpoint(self, mock_agg, client):
        mock_agg.return_value = {
            "players": [
                {
                    "name": "TestPlayer",
                    "rank": 1,
                    "total_score": 95.5,
                    "avg_score": 47.75,
                    "categories_count": 2,
                    "categories": {"kills": 100, "wins": 91},
                }
            ],
            "categories": ["kills", "wins"],
            "max_possible_score": 200,
            "total_categories": 2,
        }
        response = client.get("/api/leaderboard?platform=pc&game_mode=all")
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data["players"]) == 1
        assert data["players"][0]["name"] == "TestPlayer"

    @patch("app.aggregate_leaderboard")
    def test_leaderboard_with_categories_filter(self, mock_agg, client):
        mock_agg.return_value = {
            "players": [],
            "categories": ["kills"],
            "max_possible_score": 100,
            "total_categories": 1,
        }
        response = client.get("/api/leaderboard?categories=kills")
        assert response.status_code == 200
        mock_agg.assert_called_once()
        call_kwargs = mock_agg.call_args
        assert call_kwargs[1]["categories"] == ["kills"]

    @patch("app.aggregate_leaderboard")
    def test_leaderboard_amount_capped(self, mock_agg, client):
        mock_agg.return_value = {
            "players": [],
            "categories": [],
            "max_possible_score": 0,
            "total_categories": 0,
        }
        response = client.get("/api/leaderboard?amount=999")
        assert response.status_code == 200
        call_kwargs = mock_agg.call_args
        assert call_kwargs[1]["amount"] == 200
