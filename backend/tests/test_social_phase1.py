import json
import unittest
from unittest.mock import Mock, patch

from pymongo.errors import DuplicateKeyError

import database
import server
from services import social_service as social


def player(device_id="private-a", public_id="ffp_a", handle="alpha"):
    return {
        "device_id": device_id,
        "auth_token_hash": "secret-token-hash",
        "installation_id_hash": "secret-install-hash",
        "public_id": public_id,
        "public_handle": handle,
        "public_handle_normalized": handle,
        "public_display_name": "Hungry Hero",
        "public_avatar": dict(social.DEFAULT_AVATAR),
        "level": 3,
        "xp": 250,
        "wins": 4,
        "matches": 8,
        "best_score": 777,
    }


class FakeRelationships:
    def __init__(self):
        self.docs = []

    @staticmethod
    def matches(doc, query):
        if "$or" in query:
            return any(FakeRelationships.matches(doc, item) for item in query["$or"])
        return all(doc.get(key) == value for key, value in query.items())

    def find_one(self, query):
        return next((dict(item) for item in self.docs if self.matches(item, query)), None)

    def insert_one(self, document):
        if any(item["pair_key"] == document["pair_key"] for item in self.docs):
            raise DuplicateKeyError("duplicate")
        self.docs.append(dict(document))

    def find_one_and_update(self, query, update, return_document=None):
        for item in self.docs:
            if self.matches(item, query):
                item.update(update.get("$set", {}))
                return dict(item)
        return None

    def find_one_and_delete(self, query):
        for index, item in enumerate(self.docs):
            if self.matches(item, query):
                return self.docs.pop(index)
        return None

    def find(self, query):
        return [dict(item) for item in self.docs if self.matches(item, query)]

    def delete_many(self, query):
        self.docs[:] = [item for item in self.docs if not self.matches(item, query)]


class SocialPhaseOneTests(unittest.TestCase):
    def test_handle_normalization_uniqueness_and_validation(self):
        self.assertEqual(social.validate_handle("  Hero_247 "), "hero_247")
        for invalid in ("ab", "247hero", "hero-name", "ADMIN", "a" * 21):
            with self.assertRaises(social.SocialError):
                social.validate_handle(invalid)

    def test_avatar_is_allowlisted_and_complete(self):
        avatar = social.sanitize_avatar({"hair": "curls", "eyes": "injected", "$where": "evil"})
        self.assertEqual(avatar["hair"], "curls")
        self.assertEqual(avatar["eyes"], social.DEFAULT_AVATAR["eyes"])
        self.assertNotIn("$where", avatar)
        self.assertEqual(set(avatar), (set(social.AVATAR_OPTIONS) - {"skinTone", "hairColor"}) | {"presentation", "skinToneValue", "hairColorValue"})

    def test_public_projection_never_exposes_private_identity(self):
        projected = social.public_profile(player())
        serialized = json.dumps(projected)
        self.assertEqual(set(projected), social.PUBLIC_PROFILE_FIELDS | {"friendship_state"})
        for secret in ("private-a", "secret-token-hash", "secret-install-hash", "device_id", "auth_token"):
            self.assertNotIn(secret, serialized)

    def test_existing_player_receives_opaque_server_public_identity(self):
        legacy = {"device_id": "guest_private", "xp": 0}
        assigned = {**legacy, "public_id": "ffp_random", "public_handle": "feaster_abcd", "public_handle_normalized": "feaster_abcd"}
        with patch.object(social, "assign_public_identity", return_value=assigned) as assign:
            resolved = social.ensure_public_identity(legacy)
        self.assertEqual(resolved["public_id"], "ffp_random")
        args = assign.call_args.args
        self.assertNotIn("guest_private", args[1])
        self.assertTrue(args[1].startswith("ffp_"))

    def test_profile_update_is_owned_by_authenticated_private_player(self):
        current = player()
        updated = {**current, "public_handle": "newhero", "public_handle_normalized": "newhero", "public_display_name": "New Hero"}
        with patch.object(social, "find_internal_player_by_handle", return_value=None), patch.object(social, "update_public_identity", return_value=updated) as update:
            result = social.update_profile(current, "NewHero", "New Hero", {"hair": "curls"})
        self.assertEqual(update.call_args.args[0], "private-a")
        self.assertEqual(result["handle"], "newhero")

    def test_taken_handle_is_case_insensitive(self):
        with patch.object(social, "find_internal_player_by_handle", return_value=player("private-b", "ffp_b", "taken")):
            with self.assertRaisesRegex(social.SocialError, "HANDLE_TAKEN"):
                social.update_profile(player(), "TAKEN", "Hungry Hero", {})

    def test_handle_availability_allows_current_owner_not_collisions(self):
        with patch.object(social, "find_internal_player_by_handle", return_value=player()):
            self.assertTrue(social.handle_availability(player(), "ALPHA")["available"])
        with patch.object(social, "find_internal_player_by_handle", return_value=player("private-b", "ffp_b", "alpha")):
            self.assertFalse(social.handle_availability(player(), "alpha")["available"])

    def test_search_is_prefix_bounded_and_excludes_self(self):
        target = player("private-b", "ffp_b", "alpha_two")
        with patch.object(social, "search_public_players", return_value=[target]) as search, patch.object(social, "social_relationships", return_value=FakeRelationships()):
            results = social.search(player(), "ALP", 999)
        search.assert_called_once_with("alp", "ffp_a", 20)
        self.assertEqual(results[0]["public_id"], "ffp_b")
        self.assertNotIn("device_id", results[0])
        with self.assertRaises(social.SocialError):
            social.search(player(), "$ne")

    def test_send_duplicate_and_reciprocal_request_are_deterministic(self):
        relationships = FakeRelationships()
        with patch.object(social, "social_relationships", return_value=relationships), patch.object(social, "find_internal_player_by_public_id", return_value=player("private-b", "ffp_b", "beta")):
            self.assertEqual(social.send_request(player(), "ffp_b"), {"state": "OUTGOING"})
            self.assertEqual(social.send_request(player(), "ffp_b"), {"state": "OUTGOING"})
            self.assertEqual(len(relationships.docs), 1)
            self.assertEqual(social.send_request(player("private-b", "ffp_b", "beta"), "ffp_a"), {"state": "FRIENDS"})
            self.assertEqual(relationships.docs[0]["status"], "accepted")

    def test_self_request_and_unauthorized_accept_fail(self):
        relationships = FakeRelationships()
        relationships.docs.append({"pair_key": "ffp_a:ffp_b", "requester_public_id": "ffp_a", "recipient_public_id": "ffp_b", "status": "pending"})
        with patch.object(social, "social_relationships", return_value=relationships):
            with self.assertRaisesRegex(social.SocialError, "CANNOT_FRIEND_SELF"):
                social.send_request(player(), "ffp_a")
            with self.assertRaisesRegex(social.SocialError, "REQUEST_NOT_FOUND"):
                social.accept_request(player("private-c", "ffp_c", "gamma"), "ffp_a")

    def test_accept_decline_cancel_and_remove_require_relationship_role(self):
        relationships = FakeRelationships()
        with patch.object(social, "social_relationships", return_value=relationships):
            relationships.docs.append({"pair_key": "ffp_a:ffp_b", "requester_public_id": "ffp_a", "recipient_public_id": "ffp_b", "status": "pending"})
            self.assertEqual(social.accept_request(player("private-b", "ffp_b", "beta"), "ffp_a"), {"state": "FRIENDS"})
            self.assertEqual(social.remove_friend(player(), "ffp_b"), {"state": "NONE"})
            relationships.docs.append({"pair_key": "ffp_a:ffp_b", "requester_public_id": "ffp_a", "recipient_public_id": "ffp_b", "status": "pending"})
            self.assertEqual(social.cancel_request(player(), "ffp_b"), {"state": "NONE"})

    def test_friend_lists_return_only_live_public_profiles(self):
        relationships = FakeRelationships()
        relationships.docs.extend([
            {"pair_key": "ffp_a:ffp_b", "requester_public_id": "ffp_a", "recipient_public_id": "ffp_b", "status": "accepted"},
            {"pair_key": "ffp_a:ffp_c", "requester_public_id": "ffp_c", "recipient_public_id": "ffp_a", "status": "pending"},
        ])
        peers = [player("private-b", "ffp_b", "beta"), player("private-c", "ffp_c", "gamma")]
        with patch.object(social, "social_relationships", return_value=relationships), patch.object(social, "public_players_by_ids", return_value=peers):
            result = social.list_relationships(player())
        self.assertEqual(len(result["friends"]), 1)
        self.assertEqual(len(result["incoming"]), 1)
        self.assertFalse(result["outgoing"])

    def test_social_endpoint_authentication_cannot_change_match_identity(self):
        private = player()
        with patch.object(server, "authenticated_bearer_player", return_value=private), patch.object(server, "own_public_profile", return_value=social.public_profile(private, "SELF")):
            response = server.own_social_profile_endpoint("Bearer opaque")
        self.assertEqual(response["public_id"], "ffp_a")
        self.assertNotIn("device_id", response)
        self.assertNotIn("match_id", response)

    def test_database_account_deletion_removes_relationships_before_player(self):
        relationships = Mock()
        players = Mock()
        players.find_one.return_value = player()
        with patch.object(database, "player_collection", players), patch.object(database, "social_relationship_collection", relationships):
            database.delete_guest_player("private-a", "secret-token-hash")
        relationships.delete_many.assert_called_once()
        players.delete_one.assert_called_once_with({"device_id": "private-a", "auth_token_hash": "secret-token-hash"})


if __name__ == "__main__":
    unittest.main()
