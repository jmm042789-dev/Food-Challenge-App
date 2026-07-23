"""Persisted leaderboard projection."""

from database import leaderboard_players
from services.match_service import belt_for_xp


def get_leaderboard(limit: int = 50) -> dict:
    entries = []
    for player in leaderboard_players(limit=limit):
        entries.append(
            {
                "username": player.get("username", "Hungry Hero"),
                "country": player.get("country", "🌍"),
                "score": int(player.get("best_score", 0)),
                "avatar": player.get("avatar_emoji", "🤤"),
                "is_you": False,
                "belt": belt_for_xp(int(player.get("xp", 0))),
            }
        )
    for rank, entry in enumerate(entries, start=1):
        entry["rank"] = rank
    return {"leaderboard": entries}
