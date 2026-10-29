# Batch 4F: authoritative result receipts

Local implementation only. No deployment or frontend integration is claimed.
Canonical backend: C:/FireFeast-Recovery/backend. Reference copy remains untouched.
Frontend baseline: e29e324f97c9a78f4de90d65baa9dfb40880c568.

## Contract

POST /api/match/receipt, Authorization: Bearer <existing guest token>.
Body: {"match_id":"<exact ID>","contest_id":"<exact ID>"}.
Both identifiers are required; extra fields are rejected. Player identity comes
only from existing bearer authentication. Existing recovery rate limiting applies.
This is a read-only operation despite using POST: one player lookup, no expiry,
match creation, settlement, fees, wallet writes, or equipment changes.

200 responses always contain schema_version: 1, player_id, match_id, contest_id,
and status: SETTLED, TERMINAL_NO_REWARD, or UNRESOLVED. Identity fields in an
UNRESOLVED envelope identify the requested lookup, not proof the match exists.
Wrong match/contest or unknown ownership returns UNRESOLVED without disclosing
another player's data. Missing/invalid authentication or deleted player: 401.
Invalid request: 422. Rate limit: 429. Transport/5xx remain uncertain.

SETTLED adds receipt and result (the stored official settlement response).
TERMINAL_NO_REWARD adds receipt, with outcome rejected or expired.
UNRESOLVED contains neither a settlement nor terminal proof.
Receipt fields:
- schema_version: 1
- player_id: authoritative owning player
- match_id: authoritative match ID
- contest_id: authoritative stored contest ID
- outcome: settled, rejected, or expired
- rewards_granted: true for settled; false for rejected/expired
- settlement_final: true

## Stored evidence and atomicity

Future settlement writes receipt fields into last_match_result and
last_match_lifecycle in the SAME existing MongoDB single-document update that
credits rewards and removes active_match. Identity is derived from the server
active snapshot used by settlement, not the request's contest assertion.

Future rejection and expiry use one find_one_and_update aggregation pipeline.
That pipeline reads device_id, active_match.id, and active_match.contest_id from
the matched server document, stores last_match_lifecycle.receipt, and removes
active_match together. It never changes wallet fields. Cancellation retains its
old storage shape. No indexes, collections, migration, or historical data are
changed. Literal values are protected against MongoDB expression interpretation.

Settlement and terminal transitions compete on the same active_match.id filter.
Only the winner can remove it. A stale settlement cannot credit a removed match;
a stale rejection cannot overwrite settlement. Existing single-document MongoDB
atomicity is the guarantee; this adds no cross-document transaction or stronger
write-concern guarantee. Normal server-generated match IDs are not reused.

Receipt lookup requires consistent versioned identity/outcome evidence. Missing
or malformed proof, an active same-ID match, missing settlement response, or an
incomplete same-ID settlement conflicting with no-reward proof stays UNRESOLVED.
The endpoint does not infer failure from absence or client time.

## Race corrections and compatibility

submit_result checks the requested match and contest before attempting expiry.
expire_stale_match rechecks the expected match ID on its own read before closing
anything. An old/unrelated request cannot expire a different current match.

_reject_match checks the atomic transition result. If rejection loses, the result
service rereads last_match_result and returns the existing settlement for the
same match and payload fingerprint when available. Otherwise it returns the
existing unresolved MATCH_NOT_ACTIVE error. Rejection/expiry errors remain
compatible with old clients; only the receipt endpoint establishes terminal proof.
A settlement that loses to rejection grants nothing; receipt lookup can establish
the winning terminal state. Scoring, anti-cheat, deadlines, fees, reward amounts,
authentication semantics, and the Batch 4C resume endpoint remain unchanged.

## Historical limitations and frontend follow-up

Old records have no receipt and remain UNRESOLVED; no inferred backfill occurs.
Only the most recent stored result/lifecycle is retained by the existing model.
Older overwritten outcomes cannot be reconstructed by this endpoint. Malformed
server snapshots lacking identity cannot produce valid receipt proof.

Frontend follow-up must validate receipt version and all pending player/match/
contest identities, save local diagnostic evidence before guarded pending-record
removal, and prevent stale callbacks from clearing newer records. Never clear on
generic errors, timeout, failed storage, or UNRESOLVED. Use settlement responses
without crediting rewards locally. Deploy compatible backend first; no frontend
changes were made in this batch.

## Local validation

Final deterministic run: 229 passed, 17 subtests passed, zero failures.
Suites: test_match_receipts, test_match_lifecycle, test_match_resume,
test_match_anti_cheat, test_match_security_audit, test_authentication,
test_guest_bootstrap_recovery, test_gear_step5, test_cosmetic_equipment,
test_daily_rewards, test_closed_beta_welcome_pack, test_input_geometry_v2.
Invocation: Python -B with pytest -q -p no:cacheprovider and the existing local
validation environment/network audit guard. No live database or service used.
All backend Python files compiled in memory; database/models/server/match_service
imports passed. No bytecode/cache generated. Known missing-resource suites were
not run. One old expiry fixture was corrected to supply its actual active match;
its no-reward assertion remains. Initial runs emitted existing FastAPI on_event
deprecation warnings. No gameplay/security assertions were weakened.

Tests exercise real service/database call construction with an in-memory atomic
adapter, injected write failures and concurrent calls; they do not prove deployed
MongoDB behavior, production revision parity, or physical-device acceptance.
Real isolated database race/write-failure qualification remains before release.
