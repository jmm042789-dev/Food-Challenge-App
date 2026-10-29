# Release Batch 4D: safe resume and completed-result recovery

Frontend base: 62ba2eba278d488d814bf9df4426f2908305db46.
This changes solo-match recovery only. Scoring, evidence capture, time limits,
equipment formulas, fees, server rewards and backend runtime are unchanged.

## Deployment prerequisite

Deploy the compatible Batch 4C backend POST /api/match/resume contract first,
or use a controlled backend-first rollout. This endpoint is not yet deployed.
404/405, 409/410, and network failures never fall back to POST /match/start.
No production service was contacted during implementation.

## Resume

Startup and contest-entry navigation carry the expected resume match ID.
The play route retains an observed resume ID across retries. A missing, expired,
settled or replaced expected match cannot turn into a new match on retry.
The server catalog still determines contest availability. The resume request
contains only match_id and contest_id; bearer credentials establish the player.
The API fences credential recovery to the expected player rather than rewriting
this request to another account. The original start configuration and timing
are retained; the envelope server_time supplies authoritative elapsed time.
Only new entry uses affordability checking and the existing start endpoint.

## Durable record and compatibility

New AsyncStorage key: firefeast_pending_result_v1.
Record fields:
- schema_version: 1
- player_id: authenticated player identity (no token or recovery secret)
- match_id and contest_id: must equal payload identity
- payload: complete original result body, excluding device_id injected by the
  player-bound API: opponent_id, score, opponent_score, duration_sec,
  accepted_taps, completed_progress, maximum_combo, tums_used,
  completion_reason, optional is_tournament, validation_version 3, input_events,
  match_id and contest_id.

The completion coordinator freezes a snapshot, retaining already deeply frozen
input evidence. The store validates structure/identifiers/evidence without
inventing missing values, serializes one record, and confirms write/readback
before the first result request. Restart uses the exact saved payload.
Existing firefeast_active_match_input_log_v2 data and schema are unchanged.
Incomplete legacy finalized logs are not migrated into result records.

Storage operations and new-entry/abandon guards share a per-storage queue within
the app's single JS runtime. A different pending record is never overwritten.
Removal compares the complete stored record, so an older response cannot clear
a different newer record. AsyncStorage provides no cross-process CAS; this does
not claim safe coordination with another independent writer using the same key.

## Failure and restart behavior

Authentication is restored before reading player-bound pending evidence. Startup,
contest entry, and direct solo play access prioritize /match-recovery. Reads that
fail or find incompatible/wrong-player records fail closed without deleting them.
The recovery screen reads first and offers explicit verification retry. It never
calls match start or resume to manufacture a completed payload.

A failed save prevents network submission. The current process retains the
payload for explicit retry, but does NOT claim that failed storage survived a
restart. Process death before successful persistence can still lose completion;
no client can promise durability when storage fails. Failed reads and writes
block conflicting new entry. Timeouts, lost responses, auth errors and malformed
responses retain the pending record. Exact retries use backend idempotency; the
client never grants coins or XP. Successful settlement is validated before local
record removal. Cleanup failure retains evidence and permits another exact retry.

Batch 4G adds receipt-first recovery using POST /api/match/receipt. Deploy the
compatible Batch 4F backend before this frontend. Generic result errors still
never justify discarding evidence. Authenticated receipt schema version 1 must
match the saved player, match and contest in both envelope and receipt. SETTLED
also requires a verified, same-match official result. TERMINAL_NO_REWARD requires
rejected/expired, rewards_granted false and settlement_final true. Unsupported,
malformed or contradictory receipts fail closed. No live deployment is claimed.

On entering recovery, authentication is restored and the saved receipt is checked.
UNRESOLVED preserves the exact pending payload and blocks new solo matches. The
player can check again or explicitly retry the exact original submission. A retry
queries the receipt first; if unresolved, it submits the saved payload and queries
again. Even a successful submission leaves recovery evidence pending until a
verified receipt is available. No fallback starts or charges for a new match.
Missing endpoint, timeout, authentication errors and malformed responses retain
pending evidence. Existing normal in-match submission behavior remains unchanged.

Before terminal clearing, the store writes and reads back a separate diagnostic:
key firefeast_terminal_result_v1:<encoded player_id>:<encoded match_id>;
value {schema_version:1, pending:<complete original record>, receipt:<validated
normalized terminal response>}. No credentials, unknown response fields, or local
reward grants are added. Different matches use separate keys; exact duplicate
records are idempotent. Any conflicting existing diagnostic is preserved and
blocks clearing with a support message. Diagnostics are retained without pruning.

Diagnostic persistence and conditional pending removal use the existing shared
storage queue. Writes are awaited and verified before removal; pending identity
and complete payload are compared before clearing. Newer records are protected.
A failed clear leaves the durable diagnostic available for idempotent retry after
restart. AsyncStorage has no cross-process transaction/CAS; these guarantees apply
to this application's single JS runtime, not arbitrary independent writers.

After confirmed expiry/rejection the screen states that no rewards were granted
and permits return to contests. Legacy/overwritten backend evidence can remain
UNRESOLVED and needs support. No historical outcomes are inferred or backfilled.
Physical Android process-kill/network/UI acceptance and isolated backend/database
qualification remain outstanding.

Restart recovery displays authoritative results and rewards. It does not replay
local mission/achievement/tournament events or create retroactive local grants.
Physical Android process-kill, connectivity and UI acceptance remain required.
The server submission deadline is unchanged; no local expiry extension exists.

## Validation scope

New tests execute the actual API/auth client with in-memory storage and transport,
actual startup/recovery screen hooks with native rendering stubbed, the production
entry resolver, and completion coordinator. Existing source assertions are kept
for production play wiring, with old unsafe-start expectations replaced by safe
entry assertions. Existing guest test loading now resolves both TS and JS modules.
These tests are not deployed-backend or physical-device acceptance.
