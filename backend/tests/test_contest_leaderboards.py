import unittest
from pathlib import Path
from unittest.mock import patch

from services import leaderboard_service


VIEWER = {
    "public_id": "pub_viewer",
    "public_handle": "viewer", "public_handle_normalized": "viewer",
    "public_display_name": "Hungry Hero",
    "contest_best_scores": [{"contest_id": "nathans-hotdogs", "score": 412, "achieved_at": "2026-01-01T00:00:00+00:00"}],
}


class ContestLeaderboardTests(unittest.TestCase):
    def test_catalog_uses_central_registry_and_personal_best(self):
        result = leaderboard_service.contest_catalog(VIEWER)
        ids = {contest["id"] for contest in result["contests"]}
        self.assertIn("nathans-hotdogs", ids)
        coney = next(contest for contest in result["contests"] if contest["id"] == "nathans-hotdogs")
        self.assertEqual(coney["personal_best"], 412)
        self.assertIn("mechanic", coney)

    def test_contest_board_is_public_safe_bounded_and_marks_viewer(self):
        row = {
            "public_id": "pub_viewer", "public_handle": "viewer", "public_handle_normalized": "viewer", "public_display_name": "Hungry Hero",
            "public_avatar": {}, "contest_score": 412, "xp": 50, "level": 2,
            "device_id": "private", "auth_token_hash": "secret", "active_match": {"secret_seed": "never"},
        }
        with (
            patch.object(leaderboard_service, "contest_leaderboard_players", return_value=[row]) as query,
            patch.object(leaderboard_service, "contest_player_rank", return_value={**row, "position": 1}),
        ):
            result = leaderboard_service.get_contest_leaderboard(VIEWER, "nathans-hotdogs", limit=10000)
        query.assert_called_once_with("nathans-hotdogs", 100)
        entry = result["leaderboard"][0]
        self.assertTrue(entry["is_you"])
        self.assertEqual(entry["score"], 412)
        self.assertNotIn("device_id", entry)
        self.assertNotIn("auth_token_hash", entry)
        self.assertNotIn("active_match", entry)

    def test_own_rank_can_be_returned_outside_top_page(self):
        top = {"public_id": "pub_other", "public_handle": "other", "contest_score": 900, "xp": 0, "level": 1}
        own = {"public_id": "pub_viewer", "public_handle": "viewer", "public_handle_normalized": "viewer", "contest_score": 412, "xp": 0, "level": 1, "position": 247}
        with (
            patch.object(leaderboard_service, "contest_leaderboard_players", return_value=[top]),
            patch.object(leaderboard_service, "contest_player_rank", return_value=own),
        ):
            result = leaderboard_service.get_contest_leaderboard(VIEWER, "nathans-hotdogs")
        self.assertEqual(result["your_rank"]["position"], 247)
        self.assertTrue(result["your_rank"]["is_you"])

    def test_unknown_contest_rejected_before_database_query(self):
        with patch.object(leaderboard_service, "contest_leaderboard_players") as query:
            with self.assertRaises(ValueError):
                leaderboard_service.get_contest_leaderboard(VIEWER, "not-a-contest")
        query.assert_not_called()

    def test_overall_semantics_remain_global_best_score(self):
        row = {"public_id": "pub_other", "public_handle": "other", "best_score": 700, "xp": 10, "level": 2}
        with patch.object(leaderboard_service, "leaderboard_players", return_value=[row]):
            result = leaderboard_service.get_leaderboard(VIEWER)
        self.assertEqual(result["kind"], "OVERALL_BEST_SCORE")
        self.assertEqual(result["leaderboard"][0]["score"], 700)


class ContestBestSettlementContractTests(unittest.TestCase):
    def test_match_settlement_updates_contest_best_atomically(self):
        source = Path("services/match_service.py").read_text(encoding="utf-8")
        self.assertIn('"contest_best_scores": {', source)
        self.assertIn('"$gt": [accepted_score', source)
        self.assertIn('"active_match": "$$REMOVE"', source)
        self.assertLess(source.index('validation, validation_outcome = _validate_result'), source.index('"contest_best_scores": {'))

    def test_pvp_does_not_feed_single_player_contest_board(self):
        source = Path("services/pvp_service.py").read_text(encoding="utf-8")
        self.assertNotIn('contest_best_scores', source)

    def test_validation_v2_contract_remains_required(self):
        source = Path("models.py").read_text(encoding="utf-8")
        self.assertGreaterEqual(source.count('validation_version: Literal[2]'), 2)


if __name__ == "__main__":
    unittest.main()