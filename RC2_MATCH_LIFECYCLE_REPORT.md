# RC2 Match Lifecycle Report

**Date:** July 24, 2026  
**Recommendation:** **Ready with blockers**  
**Closed-beta readiness score:** **88/100**

## Summary

RC2 removes the stale-match trap identified by RC1 without changing match timing, scoring, rewards, contest balance, or ownership. The backend now gives every new gameplay match a server-generated ID, active status, and UTC start time; expires unresolved matches after a conservative recovery window; records a compact terminal status; provides bearer-authenticated recovery and abandonment operations; and binds result settlement to the server match ID. The frontend checks recovery at startup and foreground return, resumes a valid existing contest through the existing route, and provides a locked, authenticated return-to-arena action when gameplay cannot continue.

The lifecycle blocker is technically resolved and 48 focused backend tests pass. Physical-device interruption testing, signed-build verification, and the unavailable full pytest suite remain blockers to an unconditional closed-beta recommendation.

## Baseline validation

Recorded before RC2 implementation:

| Check | Result |
| --- | --- |
| `git status --short` | Dirty with the completed, uncommitted G5/G6/RC1 work |
| `git diff --check` | Pass; line-ending notices only |
| `npx.cmd tsc --noEmit` | Pass |
| `npm.cmd run lint` | Pass with 0 errors and 30 existing warnings |
| `python -m compileall .` | Pass |
| Existing focused backend unittest suites | 34/34 pass |
| Full pytest suite | Unavailable because pytest is not installed |

No dependency was installed.

## Files inspected

- Repository guidance and prior findings: `AGENTS.md`, `RC1_BETA_READINESS_REPORT.md`, current Git status and diff.
- Backend lifecycle and ownership: `backend/server.py`, `auth.py`, `models.py`, `database.py`, `rate_limit.py`.
- Backend player/match/shop/leaderboard services and all focused tests.
- Frontend authentication/bootstrap/API: `frontend/src/api.ts`, `frontend/app/index.tsx`, `frontend/app/_layout.tsx`.
- Match entry/runtime: `frontend/app/matchmaking.tsx`, `frontend/app/play/[contestId].tsx`, `frontend/src/game/useGameLoop.ts`, and relevant result/HUD components.
- Account deletion and player cleanup paths.

## Existing lifecycle discovered

Before RC2:

1. `/api/match/start` stored one `active_match` inside the player document.
2. The match contained an ID and UTC `started_at`, but the ID was not returned to or submitted by the frontend.
3. Starting the same contest returned the stored start response; another contest returned a conflict.
4. Result settlement atomically matched the stored active match ID internally, wrote `last_match_result`, granted the existing rewards, and removed `active_match`.
5. Exact duplicate result payloads could receive the prior response through a fingerprint.
6. No expiry, terminal lifecycle marker, recovery API, or cancellation API existed.
7. Matchmaking queue and matched-pair state were process-local and had no TTL. The leave route replaced its imported queue reference rather than mutating the shared list.
8. Account deletion already removed the player document, queue record, and process-local pair state.

## Root cause of stale-match blocking

A process killed before result settlement left `players.active_match` indefinitely. Because match start permits only one active match, the player could replay the same contest but could not start a different contest. No server transition could classify the record as expired or abandoned, and the frontend had no authenticated recovery or cancellation operation.

## Lifecycle model implemented

The player still owns at most one unresolved `active_match`; no new collection or event system was introduced.

- **Active:** `active_match.status == "active"` with server-generated `id` and UTC `started_at`.
- **Settled:** atomic result settlement records `last_match_lifecycle.status == "settled"` and removes `active_match`.
- **Cancelled:** authenticated abandonment records `cancelled` and removes `active_match` without rewards.
- **Expired:** stale detection records `expired` and removes `active_match` without rewards.

Terminal markers contain only match ID, status, and UTC end time. Public player serialization continues to hide internal match state.

## Expiration behavior

`MATCH_RECOVERY_WINDOW_SECONDS` is **900 seconds (15 minutes)**. Current contests are far shorter; 15 minutes tolerates startup, countdown, gameplay, a slow result request, and a brief interruption without changing the gameplay timer. It also bounds the period an abandoned match can block the account.

Expiration uses UTC server time only. Missing, malformed, timezone-naive, non-active, ID-less, or materially future-dated match metadata fails closed as stale. Checks occur before match start, result submission, recovery, matchmaking join, and matchmaking status.

Expiration atomically removes only the authenticated player’s matching active record. It grants no coins, XP, inventory, achievement, leaderboard, win, or loss credit.

## API changes

### Extended response: `POST /api/match/start`

The existing response now includes:

```json
{ "match_id": "<server-generated-id>" }
```

All prior response fields remain.

### Extended request: `POST /api/match/result`

The request now includes `match_id`. It remains optional at model parsing for compatibility with existing authentication/validation callers, but settlement rejects a missing value safely. The current frontend always sends it.

### New: `GET /api/match/active`

Bearer-authenticated and rate-limited. It returns one of:

- `resumable`, with match ID, contest ID, and server start timestamp;
- `expired`;
- `cancelled`;
- `settled`;
- `absent`.

No client player ID, token, token hash, opponent profile, rewards, or database record is returned.

### New: `POST /api/match/abandon`

Bearer-authenticated, rate-limited, bodyless, and owner-scoped. It returns a terminal/absent status and never grants rewards. No arbitrary player or match ID is accepted.

## Frontend recovery behavior

- Startup checks recovery immediately after authenticated player load.
- A valid resumable match routes to its existing gameplay route; the backend returns the already-paid start response and does not deduct the entry fee again.
- Expired, cancelled, settled, or absent state continues normal startup.
- Gameplay validates the route identifier and requires both server opponent ID and match ID before beginning.
- Foreground return during countdown/gameplay checks that the same server match remains resumable.
- An expired, cancelled, absent, or mismatched server match stops gameplay behind the existing error treatment.
- The error state provides retry plus `RETURN TO ARENA`; the latter calls authenticated abandonment and navigates only after a successful response.
- Transient foreground recovery-check failures do not destroy a locally active round.
- Missing/malformed routes, incomplete start responses, and temporary start failures resolve to concise retry/return UI rather than a blank screen.

True frame-by-frame gameplay state is not persisted. Reopening a still-valid match restarts the existing local round presentation with the same server match/entry, rather than reconstructing exact food positions, combo, or elapsed local state. No result is inferred.

## Background and interruption policy

- Brief background interruptions retain the current local behavior.
- Foreground return verifies the active match ID against the server.
- Process death recovers through startup and the server lifecycle.
- Matches older than 15 minutes expire and cannot settle.
- Result requests retain the existing bounded retry and synchronous in-flight lock.
- No offline gameplay or background timer was added.

## Cancellation and duplicate-action behavior

- Abandonment uses a synchronous ref lock and releases it on success or failure.
- Repeat abandonment returns the existing terminal state.
- Settled matches remain settled; cancellation cannot reverse rewards.
- Result navigation/replay now uses a synchronous navigation lock.
- Existing start, matchmaking, result, Antacid, shop, and account deletion locks remain intact.

## Result-settlement integrity

- Start generates the authoritative match ID.
- Submission must match active match ID, contest, opponent, bounded duration, and existing result validation.
- Settlement remains one atomic MongoDB pipeline guarded by player and active match ID.
- The pipeline grants the unchanged rewards, writes the result/fingerprint and `settled` marker, and removes active state.
- An identical retry with the same match ID/fingerprint returns the prior response without granting again.
- A conflicting repeat or wrong match ID is rejected.
- Cancellation/expiration racing settlement is safe: only the first atomic transition can remove the active match.
- Expired/cancelled matches cannot grant rewards.

## Queue cleanup

`MATCHMAKING_QUEUE_TTL_SECONDS` is **120 seconds** for process-local searches and pairings. Cleanup runs on join and status checks. Malformed and expired entries are discarded. Successful pairing now removes both matched queue entries. Queue leave mutates the shared list in place, preserving the canonical state imported by other modules.

Player expiration, cancellation, and account deletion also remove that player’s queue and process-local matched-session references. Cleanup is idempotent when records are already absent.

## Tests added

`backend/tests/test_match_lifecycle.py` adds 14 isolated standard-library tests:

1. valid active match remains resumable;
2. stale match expires and cleans matchmaking state;
3. expired match cannot grant rewards;
4. cancelled match cannot grant rewards;
5. cancellation uses bearer-derived ownership;
6. cancellation is idempotent;
7. identical duplicate result returns the previous response;
8. conflicting duplicate result is rejected;
9. settled match cannot be cancelled;
10. another player cannot select a match through recovery/cancellation;
11. deleted player cannot recover;
12. malformed/missing timestamps fail safely;
13. stale queue/pair records are removed;
14. a new contest starts after stale cleanup.

## Security verification

- Recovery and abandonment require bearer authentication.
- Route ownership comes from the authenticated player; neither accepts a player ID.
- Match start/result retain protected authentication.
- Recovery exposes only minimal lifecycle metadata.
- Existing rate limits, request-size middleware, strict identifier validation, generic authentication failures, and account deletion invalidation remain.
- No token, token hash, Authorization header, request body, or credential was added to logs.
- Deleted credentials cannot recover, cancel, or settle a match.

## Data-integrity verification

- Entry-fee, score, coin reward, XP reward, ELO, Antacid, win/loss, leaderboard, and contest formulas are unchanged.
- Expiration/cancellation does not refund or award currency.
- Atomic start continues to prevent negative entry-fee balance and multiple active matches.
- Atomic settlement and match-ID/fingerprint comparison prevent duplicate rewards.
- Welcome/tutorial one-time reward paths, inventory, shop, and account deletion behavior are unchanged.

## Performance and cleanup

Lifecycle checks perform bounded player lookups and small in-process list/dictionary cleanup; no timers, worker jobs, dependencies, or background polling were added. The one AppState listener is effect-cleaned. Existing gameplay/result timers retain cleanup. Recovery and abandonment locks release on all promise outcomes.

## Manual device tests required

1. Kill and reopen during countdown and gameplay; verify same-contest recovery.
2. Reopen after 15 minutes; verify expiry and ability to start another contest.
3. Background/resume before and after expiry.
4. Lose network during recovery, abandonment, and result submission.
5. Rapid-tap retry, return, replay, and continue.
6. Submit an uncertain result after network restoration and verify one reward.
7. Delete an account with an active match and confirm the old token cannot recover it.
8. Exercise Android hardware Back and iOS swipe-back during a live/result route.

## Known limitations and remaining blockers

- Exact mid-round visual/gameplay state is not persisted; valid recovery restarts the local presentation for the same server match.
- Full pytest execution remains unavailable because pytest is not installed; it was not installed for RC2.
- Physical Android/iOS lifecycle and network-interruption tests are not automated.
- Production EAS API environment, Android/iOS signing, and signed builds remain unverified.
- Result failure messaging after all bounded automatic retries can be improved in a later focused UI task.

## Final validation

| Check | Result |
| --- | --- |
| `npx.cmd tsc --noEmit` | Pass |
| `npm.cmd run lint` | Pass: 0 errors, 30 pre-existing warnings |
| `python -m compileall .` | Pass |
| Existing + RC2 focused backend tests | Pass: 48/48 |
| RC2 lifecycle suite alone | Pass: 14/14 |
| Full pytest suite | Not run: pytest is not installed |
| `git diff --check` | Recorded in final handoff; line-ending notices are non-errors |
| `git status --short` | Dirty by design; no commit performed |

## Readiness score

Starting from 100:

- **-4:** full backend pytest/external-contract suite is not reproducible in this environment.
- **-3:** physical-device lifecycle and network-interruption testing remains.
- **-2:** production API environment and release signing are not repository-verifiable.
- **-2:** valid process-death recovery restarts local round presentation rather than restoring exact mid-round state.
- **-1:** final result-submission failure messaging needs a manual recovery UX check.

**Final score: 88/100 — Ready with blockers.**

The stale-match release blocker from RC1 is resolved. External beta should follow the manual interruption tests and production build/environment verification above.

## Scope confirmation

No new gameplay features were added. The gameplay timer, gameplay balance, scoring, AI, reward amounts, XP values, coin values, shop prices, and contest balance are unchanged. No dependency was installed. No commit or push was performed.
