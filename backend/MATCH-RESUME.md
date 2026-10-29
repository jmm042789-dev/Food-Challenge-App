# Resume-only match contract (Release Batch 4C)

Canonical local working copy: `C:/FireFeast-Recovery/backend`.
Untouched comparison copy: `C:/FireFeast-Recovery/backend-checkout/backend`.
Neither recovered backend has Git metadata. No deployment has been performed.
Frontend reference commit: `62ba2eba278d488d814bf9df4426f2908305db46`.

## HTTP contract

`POST /api/match/resume`

Required header: `Authorization: Bearer <existing guest token>`.
JSON body: `{ "match_id": "<expected match ID>", "contest_id": "<expected contest ID>" }`.
Both fields use existing Identifier constraints. Extra fields (including device_id)
are rejected. The account is resolved from the bearer credential, never from a
client-selected account ID. Existing match-recovery rate limiting applies.

200 response:
```
{
  "status": "resumable",
  "match_id": "<same expected match>",
  "contest_id": "<same expected contest>",
  "server_time": "<current server UTC timestamp>",
  "start": { "...": "existing stored start_response, unchanged" }
}
```
`start` has the existing start response shape: match_id, contest, opponent,
opp_pace_per_sec, opponent_config, player_tums, player_coins, equipped_gear,
perk_modifiers, authoritative_duration_sec, server_started_at, server_time,
expires_at. All are original snapshot values. In particular, `start.player_coins`
is historical, NOT a current wallet read, and `start.server_time` is the original
start time. Use envelope `server_time` with `start.server_started_at` for elapsed
time. Never restart the timer or recompute the frozen gear/contest configuration.
The private match seed and player record are not returned.

Errors:
- 401: missing/invalid authentication or player deleted during lookup.
- 422: invalid request structure/identifiers (existing FastAPI validation).
- 409 with `detail.code = MATCH_NOT_RESUMABLE`: absent, wrong identity/contest,
  terminal, changed, or incompatible match snapshot. No cross-account disclosure.
- 410 with `detail.code = MATCH_EXPIRED`: requested owned active snapshot expired
  according to the existing stale-match policy.
- 429: existing recovery rate limit.
Transport failures/5xx remain uncertain, not authoritative settlement outcomes.
An already removed expired match receives generic 409, not an invented lifecycle
claim. A 409 alone must NOT clear a pending completed result.

## Safety and concurrency

The service performs no writes, even for expiry. It never calls start_match,
start_player_match, settlement, lifecycle transitions, or wallet mutation.
It reads the authenticated player's active snapshot, checks expected identities,
checks expiry, copies the stored response, then rereads the player and rejects
any changed active snapshot. Wall time is checked again after the final read.
This catches expiry during processing without changing expiry policy or schema.
Concurrent resume calls only read; there is no new match or additional fee.

The final read is an observation, not a lock or reservation. Another request can
settle/cancel the match after that observation; time can advance during response
transport. Resume does not extend validity. Authoritative result validation
continues to reject invalid/expired results. No read-only endpoint can promise a
match remains active indefinitely after its response. No database migration is
needed, and existing POST /match/start behavior is unchanged.

## Batch 4D frontend work (not implemented here)

Minimum expected production changes:
- src/api.ts: typed resume client using bearer auth and both expected IDs;
  authentication recovery must never reinterpret this call as match creation.
- app/play/[contestId].tsx: check active match before new-entry affordability;
  resume via this endpoint only, with response identity validation. On resume
  failure do not fall through to startMatch. New-match creation alone uses the
  normal affordability check and POST /match/start. Check player identity across
  authentication restoration and use the envelope server_time.
- app/index.tsx and src/game/useContestEntry.ts: prioritize unresolved durable
  completed results before active-match/new-entry/abandon navigation.
- src/game/resultSubmission.js and its declaration, plus a dedicated versioned
  pending-result persistence module and tests: persist the complete immutable
  player/contest/match-bound payload before submission and restore it on restart.
  Existing activeMatchInputLog records do not contain that complete payload and
  must not be fabricated into it. Review compatibility before integration.

Existing-match resume and pending completed-result recovery are distinct flows.
A pending result retries its exact saved POST /match/result payload (including
when the response to successful settlement was lost); it must not call resume or
start to construct a replacement payload. Only an authoritative settlement or
sufficiently identified terminal result outcome can justify clearing that record.
Timeout, auth failure, resume 409, and uncertain outcomes retain it. A fresh match
must be blocked while an unresolved conflicting result requires recovery.

## Local evidence

New deterministic suite: tests/test_match_resume.py ? 35 passed.
Existing suites: test_match_lifecycle.py, test_match_anti_cheat.py,
test_match_security_audit.py, test_gear_step5.py, test_cosmetic_equipment.py,
test_authentication.py, test_guest_bootstrap_recovery.py ? 118 passed and
17 subtests passed. Syntax parsing and imports passed for changed Python modules.

Execution used Python -B, pytest -q -p no:cacheprovider, the frontend validation
framework's filtered local environment, and backend-local.py's process-local
network audit guard. No MongoDB or live service was used. Route tests reuse the
existing in-process ASGI helper in tests/test_observability.py, not a web server.
Initial collection found TestClient's unavailable httpx2 dependency; the new test
was adapted without installing anything. A helper import was then corrected to
the existing tests package. Final suites above passed; no tests were weakened.
Four existing FastAPI on_event deprecation warnings appeared in the new suite.

Known missing-resource backend tests were not rerun. No deployed revision,
real database concurrency, live HTTP integration, or Android acceptance is
claimed by this local qualification. Frontend application code is unchanged.
