import copy
import json
import unittest
from types import SimpleNamespace

from services.public_identity_backfill import audit_and_backfill, safe_report, valid_public_id
from services.social_service import generate_public_id


def valid_identity(**extra):
    return {
        "_id": extra.pop("_id", "row-a"),
        "public_id": extra.pop("public_id", generate_public_id()),
        "public_handle": extra.pop("public_handle", "feaster_ab12cd34"),
        "public_handle_normalized": extra.pop("public_handle_normalized", "feaster_ab12cd34"),
        "score": 700,
        "coins": 999,
        "xp": 123,
        "active_match": {"status": "active"},
        **extra,
    }


def matches(document, query):
    for key, expected in query.items():
        if key == "$and":
            if not all(matches(document, item) for item in expected):
                return False
            continue
        if key == "$or":
            if not any(matches(document, item) for item in expected):
                return False
            continue
        if isinstance(expected, dict) and "$exists" in expected:
            if (key in document) != expected["$exists"]:
                return False
        elif document.get(key) != expected:
            return False
    return True


class Cursor(list):
    def batch_size(self, value):
        self.requested_batch_size = value
        return self


class MemoryPlayers:
    def __init__(self, documents):
        self.documents = copy.deepcopy(documents)
        self.write_count = 0
        self.last_cursor = None

    def find(self, query, projection):
        fields = {key for key, included in projection.items() if included}
        self.last_cursor = Cursor([
            {key: copy.deepcopy(value) for key, value in document.items() if key in fields}
            for document in self.documents
        ])
        return self.last_cursor

    def update_one(self, query, update, upsert=False):
        self.write_count += 1
        self.assert_no_replacement(update, upsert)
        for document in self.documents:
            if matches(document, query):
                document.update(copy.deepcopy(update["$set"]))
                return SimpleNamespace(matched_count=1)
        return SimpleNamespace(matched_count=0)

    @staticmethod
    def assert_no_replacement(update, upsert):
        if set(update) != {"$set"} or upsert:
            raise AssertionError("backfill must use a bounded non-upsert $set")


class PublicIdentityBackfillTests(unittest.TestCase):
    def test_completely_missing_identity_is_backfilled(self):
        players = MemoryPlayers([{"_id": "missing", "coins": 50}])
        report = audit_and_backfill(players, apply=True)
        self.assertEqual(report["missing_all_identity_count"], 1)
        self.assertEqual(report["updates_applied"], 1)
        self.assertTrue(valid_public_id(players.documents[0]["public_id"]))

    def test_already_valid_identity_is_preserved_exactly(self):
        document = valid_identity()
        players = MemoryPlayers([document])
        report = audit_and_backfill(players, apply=True)
        self.assertEqual(report["complete_identity_count"], 1)
        self.assertEqual(players.write_count, 0)
        self.assertEqual(players.documents[0], document)

    def test_partial_public_id_only_keeps_id_and_generates_handle(self):
        public_id = generate_public_id()
        players = MemoryPlayers([{"_id": "partial", "public_id": public_id}])
        audit_and_backfill(players, apply=True)
        self.assertEqual(players.documents[0]["public_id"], public_id)
        self.assertEqual(players.documents[0]["public_handle"], players.documents[0]["public_handle_normalized"])

    def test_partial_handle_only_keeps_handle_and_generates_id(self):
        players = MemoryPlayers([{"_id": "partial", "public_handle": "Alpha_123"}])
        audit_and_backfill(players, apply=True)
        self.assertTrue(valid_public_id(players.documents[0]["public_id"]))
        self.assertEqual(players.documents[0]["public_handle"], "alpha_123")
        self.assertEqual(players.documents[0]["public_handle_normalized"], "alpha_123")

    def test_normalized_handle_mismatch_is_repaired_canonically(self):
        players = MemoryPlayers([valid_identity(public_handle="Hero_247", public_handle_normalized="wrong_247")])
        report = audit_and_backfill(players, apply=True)
        self.assertEqual(report["normalized_handle_mismatch_count"], 1)
        self.assertEqual(players.documents[0]["public_handle"], "hero_247")
        self.assertEqual(players.documents[0]["public_handle_normalized"], "hero_247")

    def test_duplicate_public_ids_block_all_writes(self):
        duplicate = generate_public_id()
        players = MemoryPlayers([valid_identity(_id="a", public_id=duplicate), valid_identity(_id="b", public_id=duplicate, public_handle="beta_123", public_handle_normalized="beta_123")])
        report = audit_and_backfill(players, apply=True)
        self.assertEqual(report["duplicate_public_id_count"], 2)
        self.assertTrue(report["apply_blocked_by_conflicts"])
        self.assertEqual(players.write_count, 0)

    def test_duplicate_normalized_handles_block_all_writes(self):
        players = MemoryPlayers([valid_identity(_id="a"), valid_identity(_id="b", public_handle="FEASTER_AB12CD34", public_handle_normalized="feaster_ab12cd34")])
        report = audit_and_backfill(players, apply=True)
        self.assertEqual(report["duplicate_normalized_handle_count"], 2)
        self.assertEqual(report["conflicts_skipped"], 2)
        self.assertEqual(players.write_count, 0)

    def test_null_identity_values_are_treated_as_missing(self):
        players = MemoryPlayers([{"_id": "nulls", "public_id": None, "public_handle": None, "public_handle_normalized": None}])
        report = audit_and_backfill(players, apply=True)
        self.assertEqual(report["missing_all_identity_count"], 1)
        self.assertEqual(report["updates_applied"], 1)

    def test_empty_identity_values_are_treated_as_missing(self):
        players = MemoryPlayers([{"_id": "empty", "public_id": "", "public_handle": " ", "public_handle_normalized": ""}])
        report = audit_and_backfill(players, apply=True)
        self.assertEqual(report["missing_all_identity_count"], 1)
        self.assertEqual(report["updates_applied"], 1)

    def test_invalid_nonempty_identity_requires_manual_resolution(self):
        players = MemoryPlayers([{"_id": "invalid", "public_id": "legacy-private-id", "public_handle": "bad handle!", "public_handle_normalized": "bad handle!"}])
        report = audit_and_backfill(players, apply=True)
        self.assertEqual(report["players_requiring_manual_resolution"], 1)
        self.assertEqual(players.write_count, 0)

    def test_legacy_avatar_is_not_read_or_changed(self):
        legacy = {"skinTone": "warm", "hairColor": "ember", "$where": "private"}
        document = {"_id": "legacy", "public_avatar": legacy, "coins": 77}
        players = MemoryPlayers([document])
        audit_and_backfill(players, apply=True)
        self.assertEqual(players.documents[0]["public_avatar"], legacy)

    def test_second_apply_is_idempotent(self):
        players = MemoryPlayers([{"_id": "missing", "inventory": ["item"]}])
        first = audit_and_backfill(players, apply=True)
        writes_after_first = players.write_count
        second = audit_and_backfill(players, apply=True)
        self.assertEqual(first["updates_applied"], 1)
        self.assertEqual(second["updates_applied"], 0)
        self.assertEqual(players.write_count, writes_after_first)

    def test_unrelated_player_fields_are_unchanged(self):
        document = {"_id": "missing", "score": 88, "coins": 123, "xp": 9, "inventory": ["hat"], "active_match": {"secret": "kept"}}
        players = MemoryPlayers([document])
        audit_and_backfill(players, apply=True)
        for field in ("score", "coins", "xp", "inventory", "active_match"):
            self.assertEqual(players.documents[0][field], document[field])

    def test_read_only_preflight_makes_zero_writes_and_requests_a_batch(self):
        players = MemoryPlayers([{"_id": "missing"}])
        report = audit_and_backfill(players, batch_size=37)
        self.assertFalse(report["apply_requested"])
        self.assertEqual(players.write_count, 0)
        self.assertEqual(players.last_cursor.requested_batch_size, 37)

    def test_aggregate_report_has_no_private_values_or_unapproved_keys(self):
        private_values = ["private-device-123", "opaque-auth-token", "guest-player-id"]
        players = MemoryPlayers([{"_id": private_values[0], "auth_token": private_values[1], "device_id": private_values[2]}])
        serialized = json.dumps(safe_report(audit_and_backfill(players)), sort_keys=True)
        self.assertTrue(all(value not in serialized for value in private_values))
        self.assertNotIn("documents", serialized)
        self.assertNotIn("ids", serialized)


if __name__ == "__main__":
    unittest.main()
