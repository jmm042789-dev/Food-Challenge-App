"""Public-safe overall and authoritative per-contest leaderboard projections."""

from data.contests import CONTESTS, get_contest
from database import contest_leaderboard_players, contest_player_rank, leaderboard_players
from services.match_service import belt_for_xp
from services.social_service import ensure_public_identity, sanitize_avatar

MAX_LEADERBOARD_RESULTS = 100


def _entry(player: dict, position: int, viewer_public_id: str, score_field: str = "best_score") -> dict:
    return {
        "position": position,
        "public_id": player.get("public_id"),
        "handle": player.get("public_handle", "feaster"),
        "display_name": player.get("public_display_name") or player.get("username") or "Hungry Hero",
        "avatar": sanitize_avatar(player.get("public_avatar")),
        "score": int(player.get(score_field, 0)),
        "level": int(player.get("level", 1)),
        "rank": belt_for_xp(int(player.get("xp", 0)))["name"],
        "is_you": player.get("public_id") == viewer_public_id,
    }


def get_leaderboard(viewer: dict, limit: int = 50) -> dict:
    current = ensure_public_identity(viewer)
    bounded = max(1, min(int(limit), MAX_LEADERBOARD_RESULTS))
    entries = [_entry(player, index, current["public_id"]) for index, player in enumerate(leaderboard_players(limit=bounded), 1)]
    return {"kind": "OVERALL_BEST_SCORE", "leaderboard": entries}


def contest_catalog(viewer: dict) -> dict:
    current = ensure_public_identity(viewer)
    bests = {item.get("contest_id"): item for item in current.get("contest_best_scores", []) if isinstance(item, dict)}
    return {"contests": [{
        "id": contest["id"], "name": contest["name"], "food": contest["food"],
        "mechanic": contest.get("bite_mechanic", "tap"),
        "personal_best": int(bests.get(contest["id"], {}).get("score", 0)),
    } for contest in CONTESTS]}


def get_contest_leaderboard(viewer: dict, contest_id: str, limit: int = 50) -> dict:
    contest = get_contest(contest_id)
    if not contest:
        raise ValueError("contest_not_found")
    current = ensure_public_identity(viewer)
    bounded = max(1, min(int(limit), MAX_LEADERBOARD_RESULTS))
    rows = contest_leaderboard_players(contest_id, bounded)
    entries = [_entry(row, index, current["public_id"], "contest_score") for index, row in enumerate(rows, 1)]
    own = contest_player_rank(contest_id, current["public_id"])
    own_entry = _entry(own, int(own["position"]), current["public_id"], "contest_score") if own else None
    return {
        "kind": "CONTEST_BEST_SCORE", "contest": {"id": contest["id"], "name": contest["name"], "food": contest["food"], "mechanic": contest.get("bite_mechanic", "tap")},
        "leaderboard": entries, "your_rank": own_entry,
    }