# RC1 Beta Readiness Report

**Date:** July 24, 2026  
**Recommendation:** **Ready with blockers**  
**Closed-beta readiness score:** **78/100**

## Executive summary

Fire Feast has a sound closed-beta foundation: the frontend type-checks and lints without errors, focused backend security/configuration tests pass, authentication and deletion protections remain intact, and the principal user flows have explicit loading or error handling. RC1 added two narrowly scoped stability protections: a synchronous shop-action lock prevents rapid taps from creating multiple purchase/equip requests, and matchmaking now stops silent polling after repeated status failures and presents its existing retry state.

The app should not yet be distributed to external testers without resolving or explicitly accepting the active-match recovery blocker. A process terminated during a match can leave a persisted active match without an expiry or cancellation route; later starting a different contest can remain blocked. Physical-device lifecycle, small-screen, audio, and haptic testing is also still required.

## Baseline validation

These results were recorded before the RC1 fixes:

| Check | Result |
| --- | --- |
| `git status --short` | Dirty worktree containing the completed G5/G6 milestone changes; no RC1 changes yet |
| `git diff --check` | Pass; line-ending warnings only |
| `npx.cmd tsc --noEmit` | Pass |
| `npm.cmd run lint` | Pass with 0 errors and 30 existing warnings |
| `python -m compileall .` | Pass |
| `python -m pytest` | Not runnable: pytest is not installed |
| Focused built-in backend tests | 34/34 pass |

No dependency was installed to work around the unavailable pytest runner.

## Scope and files inspected

The audit traced the repository configuration and the major frontend/backend flows, including:

- Repository guidance, prior audit, current status and diff: `AGENTS.md`, `STORE_READINESS_AUDIT.md`, Git status/diff.
- Frontend startup and identity: `frontend/app/index.tsx`, `frontend/app/_layout.tsx`, `frontend/src/api.ts`, and credential/cache storage helpers.
- Player-facing screens: home, contests, leaderboard, profile, shop, tutorial, matchmaking, gameplay, and result UI under `frontend/app/**`.
- Gameplay/runtime presentation: `frontend/src/game/**`, `frontend/src/audio*`, haptics, camera, animation, particle, HUD, and overlay components.
- Release configuration: `frontend/app.json`, `frontend/eas.json`, `frontend/package.json`, environment examples, TypeScript and ESLint configuration.
- Backend routes and lifecycle: `backend/server.py`, `auth.py`, `config.py`, `database.py`, `models.py`, `rate_limit.py`.
- Backend data behavior: all services under `backend/services/**` and tests under `backend/tests/**`.

## Complete flows inspected

### First launch and returning player

The startup route loads isolated player credentials, uses the installation bootstrap flow, stores a new raw token only at initial issuance, and supports cached bootstrap data during a temporary network failure. Invalid credentials enter the centralized authentication recovery path rather than silently minting credentials. Partial or corrupted credential state fails visibly; it is not used as an insecure account-claim fallback.

### Match start, gameplay, and completion

Frontend match start is guarded by request/state refs, and the backend returns the existing active match for an idempotent repeat start of the same contest. Gameplay result submission has an in-flight guard, a stable submission key, bounded retry behavior, and backend duplicate-response handling. Gameplay loops and primary presentation effects clean up their timers/animations on unmount. Score, combo, Antacid, heartburn, AI, reward, and economy calculations were not changed.

### Shop

Catalog/player loading uses explicit loading and failure states. The backend purchase update checks available balance atomically. RC1 now prevents a rapid second tap before React commits the pending state and disables all shop actions while one action is in flight.

### Profile and deletion

Profile failures render a safe retry path. Account deletion requires two deliberate UI confirmations plus the fixed backend confirmation body. The backend derives the account from the bearer token, deletes linked data, invalidates the token, and the frontend clears player credentials/caches only after confirmed success. Pending local deletion cleanup is recoverable on restart.

### Leaderboard and contests

Both screens check response shapes, provide loading/error/empty handling, and expose retry behavior. The public leaderboard response is sanitized and contains neither player identifiers nor credential material.

## Issues fixed

### RC1-1: Shop requests could race on rapid taps

- **Affected file:** `frontend/app/(tabs)/shop.tsx`
- **Risk:** React state alone does not synchronously lock the handler. Two rapid taps could send two legitimate consumable/currency purchase requests, unintentionally charging and granting twice.
- **Fix:** Added a synchronous ref lock acquired before the request. All shop actions are disabled until completion.
- **Behavior impact:** Request coordination only; prices, balances, inventory rules, and backend contracts are unchanged.

### RC1-2: Matchmaking status could poll indefinitely after network failure

- **Affected file:** `frontend/app/matchmaking.tsx`
- **Risk:** Once join succeeded, repeated status failures were swallowed forever, leaving the player on an endless searching state.
- **Fix:** Three consecutive status failures stop polling and show the existing retry/cancel error state. A successful response resets the failure count.
- **Behavior impact:** Match selection and matchmaking decisions are unchanged.

## Issues intentionally deferred

### Blocker: stale persisted active match has no expiry or explicit cancellation recovery

If the process terminates during a match, the backend player document can retain `active_match`. Starting the same contest can resume from the stored start response, but selecting a different contest conflicts. No time-based expiry or authenticated abandon/cancel path was found.

**Recommendation:** add a narrowly defined stale-match policy and authenticated cancellation/recovery path, with tests proving that settlement cannot be duplicated and normal active matches cannot be abandoned into extra rewards.

### App lifecycle reconciliation is incomplete

No centralized `AppState` handling was found for backgrounding during countdown, gameplay, or result submission. Existing unmount cleanup limits duplicate loops, and backend result idempotency protects settlement, but elapsed-time reconciliation after a long background interval is not verified.

**Recommendation:** decide the product rule for backgrounded matches, then add focused lifecycle handling and physical-device tests. This was not changed because it affects match timing semantics.

### Full backend suite is not currently reproducible in this environment

`pytest` is absent and was not installed. Several remaining backend tests use pytest/external-service conventions and appear to target older contracts. The current standard-library authentication, hardening, deletion, and configuration suites pass.

### Match result request timeout remains ambiguous to the player

The client retries a timed-out result submission using a stable result identity, and the backend is duplicate-resistant. A final network failure still requires user recovery/navigation judgment and has not been exercised on a device with forced packet loss.

### Local guest token remains in AsyncStorage

Tokens are isolated from profile cache and are not logged, but AsyncStorage is not platform secure storage. This remains a known security-hardening follow-up rather than a closed-beta functional blocker.

## Loading, empty, and error states

- Startup has loading, retry, cached-bootstrap, and concise error states; it does not loop credential recovery indefinitely.
- Home, contests, leaderboard, profile, and shop render content, an empty state, or an actionable retry rather than a blank screen.
- Matchmaking now leaves repeated-failure polling for a retryable error state.
- API calls use an eight-second timeout and normalized user-facing request errors.
- No broad catch blocks were added to hide programming faults.
- Manual malformed-response and slow-network testing remains required, especially around matchmaking and result submission.

## Duplicate-action and data-integrity verification

- Match start: frontend request guard plus backend same-contest idempotency.
- Result submission: frontend in-flight/submission-key guards plus backend active-match/fingerprint duplicate handling.
- Purchases: RC1 frontend synchronous lock; backend atomic balance predicate prevents negative coin balance.
- Welcome/tutorial rewards: backend persistence and conditional updates prevent repeated welcome claims; focused inspection found no RC1 regression.
- Account deletion: UI progress state, strict authenticated endpoint, and token invalidation.
- Antacid: existing input guard/cooldown behavior retained.
- No score, XP, coin, price, reward, or progression constants were changed.

## Lifecycle and recovery findings

Startup and normal request recovery are suitable for beta. Cleanup exists for matchmaking intervals/navigation timers and gameplay presentation resources. The unresolved risks are process death with a persisted active match, lack of an explicit background-match policy, and device-level verification of an interrupted result request. The app does not implement offline gameplay, and RC1 did not add it.

## Runtime, performance, and memory

- Audio playback uses shared/cached resources and exposed cleanup rather than constructing a new player for every tap.
- Gameplay timers, polling intervals, route timers, and the inspected animation loops generally include cleanup.
- Particle and presentation systems use bounded lifetimes; no confirmed unbounded accumulation was found.
- Hot gameplay behavior was not broadly refactored.
- Remaining lint hook-dependency warnings warrant later targeted review, but none was changed without a demonstrated RC1 failure.
- Profiling on representative low/mid-range Android hardware is still required.

## Android compatibility

Safe-area insets are used by tab and gameplay shells, and gameplay accounts for narrow bounds. Touch targets and bounded labels are generally present. Remaining device checks:

- edge-to-edge status/navigation-bar overlap on gesture and three-button navigation;
- smallest supported phone and large-font scaling;
- long player/opponent names and very large currency/score values;
- system Back behavior during matchmaking, gameplay, and result submission;
- keyboard behavior in profile editing;
- audio focus/interruption and devices without haptics.

## iOS-specific unknowns

No archive/signing or TestFlight validation was performed. Safe areas, audio interruption, haptics fallback, background/resume behavior, app icon/splash rendering, and account deletion must be exercised on physical iOS hardware. Repository evidence is insufficient to verify certificates or App Store Connect configuration.

## Security regression verification

Focused backend tests verify bearer authentication, wrong-player rejection, generic 401 behavior, one-time token issuance, hash-only backend storage, sanitized public leaderboard output, strict deletion ownership, input bounds, rate limits, and deletion token invalidation. No token, token hash, Authorization header, or sensitive request-body logging was found in the inspected application code. Player authority for protected routes is derived from authenticated credentials.

## Release configuration

Verified repository values:

- App name/slug/version: Fire Feast / `fire-feast` / `1.0.0`.
- Android: `com.firefeast.app`, versionCode `1`, production profile builds an AAB.
- iOS: `com.firefeast.app`, buildNumber `1`.
- Portrait orientation, icon/splash/adaptive-icon assets configured, tablet support enabled.
- Production frontend API configuration requires an HTTPS URL and rejects loopback/insecure production values.

Remaining blockers/unknowns:

- Production `EXPO_PUBLIC_BACKEND_URL` must be supplied and verified in the EAS production environment; no production value is invented in the repository.
- Android/iOS signing credentials and store-console records cannot be verified from source.
- No release build, APK, AAB, archive, or submission was produced.
- Runtime-version/Expo Updates strategy should be decided before public launch.

## Tests

No new test runner or dependency was introduced. The two RC1 fixes are frontend request-coordination changes and are covered by type/lint validation plus static flow inspection. A future match-recovery change must add focused backend tests for stale matches, cancellation, and duplicate settlement.

## Final validation

| Check | Result |
| --- | --- |
| `npx.cmd tsc --noEmit` | Pass |
| `npm.cmd run lint` | Pass: 0 errors, 30 pre-existing warnings |
| `python -m compileall .` | Pass |
| Focused backend unittest suites | Pass: 34/34 |
| Full pytest suite | Not run: pytest is not installed |
| `git diff --check` | See final task handoff; expected pass apart from line-ending notices |
| `git status --short` | Dirty by design from uncommitted G5/G6 and RC1 work |

## Score calculation

Starting from 100:

- **-10:** persisted active matches have no expiry/cancel recovery after process termination.
- **-5:** background/countdown/gameplay lifecycle behavior is not explicitly reconciled.
- **-4:** complete backend pytest coverage is not reproducible in the current environment.
- **-2:** production API environment and release signing are not verifiable from repository evidence.
- **-1:** physical-device Android/iOS compatibility and interruption tests remain outstanding.

**Final: 78/100 — Ready with blockers.**

## Manual tests required before external beta

1. Terminate/reopen during countdown and gameplay; verify the chosen stale-match recovery policy.
2. Drop/restore network before match start and during result submission; verify one settlement.
3. Rapid-tap every purchase category and confirm one request/charge.
4. Background/resume during matchmaking, gameplay, and result reveal.
5. Delete an account during slow/lost network and relaunch with stale local credentials.
6. Exercise small Android screens, large font scaling, system Back, keyboard, audio interruption, and no-haptics hardware.
7. Smoke-test a signed Android internal AAB and iOS TestFlight archive with the real HTTPS production API.

## Change and scope confirmation

RC1 changed only `frontend/app/(tabs)/shop.tsx`, `frontend/app/matchmaking.tsx`, and this report. No new gameplay features were added. Gameplay balance, scoring, AI, rewards, XP values, coin values, shop prices, contest balance, backend contracts, and navigation structure are unchanged. No dependencies were installed. No commit or push was performed.
