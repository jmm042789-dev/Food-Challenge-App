# G5.5.1 — Fire Feast Store Readiness Audit

Audit date: 2026-07-22  
Audit type: repository-evidence production-readiness review for Google Play closed testing and Apple TestFlight/App Store preparation

## 1. Executive summary

Fire Feast is **not ready for store submission or external closed beta yet**, although its frontend is technically healthy and much of the basic release configuration is sound. TypeScript and ESLint complete without errors, the backend compiles, Android production builds are configured as AABs, iOS identity exists, production frontend builds require an HTTPS API, MongoDB updates cover several important atomic/idempotent paths, and the app has loading, retry, empty, and root-error states.

The primary blockers are not gameplay polish. They are:

1. An unauthenticated, publicly enumerable player identifier permits account impersonation and economy/progression mutation.
2. No privacy policy, in-app privacy link, support destination, or store disclosure package exists.
3. Persistent server profiles have no account/data deletion path.
4. Backend production mode is not enforced by the checked-in deployment configuration; an omitted environment flag exposes documentation and diagnostics and enables wildcard CORS.
5. Matches and result recovery do not handle process death/background suspension safely, which can strand paid-entry active matches.

No gameplay, navigation, API contract, scoring, AI, persistence, progression, networking, or monetization code was changed by this audit.

## 2. Audit scope

Reviewed:

- All repository files outside dependency/build caches, including `frontend/app/**`, `frontend/src/**`, `frontend/assets/**`, `frontend/src/assets/**`, backend source/services/data/tests, configuration, documentation, backups, and prior test reports.
- Expo identity and release configuration: `frontend/app.json`, `app.config.js`, `eas.json`, `package.json`, TypeScript/ESLint configuration, environment templates, and ignore rules.
- Backend configuration and implementation: `backend/server.py`, `database.py`, models, services, catalogs, requirements, environment template, deployment descriptor, and tests.
- Repository legal/support/CI evidence, tracked environment files, legacy branding terms, local/development endpoints, logs, debug routes, and suspected credentials.
- Runtime recovery, request handling, matchmaking cleanup, result idempotency, purchase atomicity, timers/animations, audio cleanup, accessibility, and the existing `frontend/ASSET_OPTIMIZATION_AUDIT.md`.

## 3. Evidence and limitations

- This is a static repository audit plus local compile/lint validation. No store-console, EAS credentials, Apple Developer, Google Play Console, MongoDB production cluster, hosting dashboard, DNS, TLS certificate, device, or signed artifact was available.
- Release signing readiness cannot be confirmed. The repository correctly excludes common signing files, but credentials must be verified in EAS/Apple/Google systems.
- No production service was started. Existing backend tests are remote integration tests that mutate data, depend on an external URL, and contain stale contracts; they were inspected but not run.
- Dependency vulnerability scanners were not installed or run. Versions and lock files were inspected only.
- Artwork/audio/font ownership cannot be established from source files alone; no license ledger or provenance documentation exists.
- Official policy basis used for blocker classification:
  - [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) require an accessible privacy policy and, where account creation is supported, in-app deletion.
  - [Apple account deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/) describes deletion of the account record and associated data.
  - [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/) requires privacy-practice declarations for new apps and updates.
  - [Google Play Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en) applies to closed/open/production tracks and requires a privacy-policy link even when no user data is collected.
  - [Google Play account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en-EN) requires in-app and external deletion paths when in-app account creation is offered.

## 4. Application identity

| Item | Repository evidence | Assessment |
|---|---|---|
| Public name | `Fire Feast` in `frontend/app.json`; Fire Feast visible UI/log strings | Consistent in current app |
| Expo slug | `fire-feast` | Production-looking |
| Android package | `com.firefeast.app` | Production-looking; ownership not externally verified |
| iOS bundle ID | `com.firefeast.app` | Production-looking; App Store registration not verified |
| App version | `1.0.0` | Appropriate initial version |
| Android versionCode | `1` | Valid initial code |
| iOS buildNumber | `1` | Valid initial build |
| Scheme | `firefeast` | Configured; no custom inbound-link validation evidence |
| Platforms | Expo Android, iOS, and web configuration present | Mobile targets configured |
| Orientation | Portrait | Intentional; accessibility/usability limitation, not a blocker |
| Tablet | iOS `supportsTablet: true` | Requires tablet layout/device verification |
| Icon | `src/assets/logo/app-icon.png` | Resolves; source is 1254×1254 opaque PNG |
| Adaptive icon | Same opaque app icon over `#070405` | Valid path; crop/safe-zone visual verification needed |
| Splash | `src/assets/backgrounds/splash-screen.png`, contain, width 260 | Resolves and is explicitly configured |
| Notification icon | None | Not required: no notifications package or notification behavior found |
| Updates/runtime | No explicit `updates` or `runtimeVersion` | Expo defaults apply; release policy is not documented |

Legacy names exist in non-visible/internal material: `CHANGELOG.md`, `ROADMAP.md`, `DESIGN_SYSTEM.md`, `design_guidelines.json`, `memory/PRD.md`, old backend tests, and the AsyncStorage key `chompchamps_device_id`. `tums_used` and `new_tums` remain legacy API fields. Current visible app/catalog text uses “Antacid”; current contest display names are fictional. These internal compatibility strings are not store blockers.

## 5. Category statuses

| Category | Status | Score |
|---|---|---:|
| Overall production readiness | Needs Work | 32 |
| Google Play readiness | Not Ready | 42 |
| Apple App Store readiness | Not Ready | 44 |
| Closed beta readiness | Needs Work | 48 |
| Security | Not Ready | 34 |
| Performance | Nearly Ready | 78 |
| Accessibility | Needs Work | 68 |
| Branding and legal readiness | Not Ready | 40 |
| Backend readiness | Needs Work | 46 |
| Frontend readiness | Nearly Ready | 76 |

## 6. Score calculations and deductions

All categories start at 100. Deductions below are tied only to repository evidence and finding IDs. Scores do not assume future features.

| Category | Deductions | Final |
|---|---|---:|
| Overall | −18 F1; −10 F2; −8 F3; −8 F4; −8 F5; −7 F6; −5 F7; −4 F8 | 32 |
| Google Play | −14 F1 safe distribution; −14 F2 privacy/Data Safety; −10 F3 deletion; −8 F4 production exposure; −7 F5 recovery; −5 F14 legal evidence | 42 |
| Apple App Store | −14 F1 safe distribution; −14 F2 privacy/support; −10 F3 deletion; −8 F4 production exposure; −5 F5 recovery; −5 F14 rights evidence | 44 |
| Closed beta | −18 F1 account/economy compromise; −12 F2 Play closed-track privacy declarations; −10 F4 environment exposure; −8 F5 stranded matches; −4 F10 insufficient current tests | 48 |
| Security | −30 F1; −14 F4; −12 F6; −6 F7; −4 F9 | 34 |
| Performance | −10 F13 oversized runtime images; −6 F5 background/timer lifecycle; −4 F17 production logging/no telemetry; −2 F12 dense animated UI | 78 |
| Accessibility | −12 F12 small text/touch/focus/image semantics; −8 F5 background recovery clarity; −6 F2 no accessible legal/support path; −4 portrait-only/tablet uncertainty; −2 motion/haptic coverage gaps | 68 |
| Branding/legal | −24 F2; −16 F3; −14 F14; −4 F16; −2 missing store/support metadata | 40 |
| Backend | −22 F1; −12 F4; −10 F5 active-match recovery; −6 F6 validation; −4 F9; −4 F15 | 42; +4 for verified atomic/idempotent operations = **46** |
| Frontend | −8 F5 lifecycle/recovery; −5 F8 release policy; −4 F10 test gap; −4 F11 identity recovery; −3 F12 accessibility; −3 F13 assets; −2 F17 telemetry | 71; +5 for clean TS/lint, root boundary, retries, and HTTPS gating = **76** |

Positive adjustments are used only in the two implementation-specific scores to recognize directly verified safeguards; no score exceeds its 100 starting point.

## 7. Critical findings

### F1 — Public player IDs enable unauthenticated account impersonation and mutation

- **Severity:** Critical
- **Category:** Security / authorization / data integrity
- **Affected files:** `frontend/src/api.ts`; `backend/server.py`; `backend/models.py`; `backend/services/*.py`; `backend/services/leaderboard_service.py`
- **Evidence:** The client generates a bearer-like `device_id` in AsyncStorage and sends it in request bodies/paths with no authentication or signature. `/api/leaderboard` returns each player's `device_id`. Any caller can then use a disclosed ID for player lookup, match start/result, purchase, tutorial reward, matchmaking, or equipment operations.
- **Why it matters:** This is a complete authorization boundary failure. A remote caller can impersonate leaderboard players and alter their persistent economy/progression.
- **Disposition:** Google Play blocker: **Yes, for safe distribution**. Apple blocker: **Yes, for safe distribution**. Closed beta blocker: **Yes**. Public launch blocker: **Yes**. Non-blocking improvement: **No**.
- **Estimated effort:** Large
- **Recommended fix:** Introduce server-issued authenticated sessions or platform-backed anonymous accounts; never expose authorization identifiers in leaderboard responses; authorize every mutation against the authenticated principal; rotate/migrate existing IDs.
- **Code changes required:** Yes, frontend and backend/API evolution.
- **Uncertainty:** No external API gateway/auth layer is evidenced. If one exists, it must be documented and tested, but returning the device ID remains unnecessary exposure.

## 8. High findings

### F2 — Privacy policy, in-app privacy access, support contact, and disclosure package are absent

- **Severity:** High
- **Category:** Store compliance / privacy / support
- **Affected files:** repository root; `frontend/app/**`; store-console metadata (not present)
- **Evidence:** No privacy policy, terms, support document/URL, in-app legal link, marketing URL, or data-disclosure worksheet exists.
- **Why it matters:** Apple requires a privacy-policy link in metadata and in-app; Google Play requires Data Safety completion and a privacy-policy link for closed/open/production tracks. App review also expects functional support contact information.
- **Disposition:** Google Play blocker: **Yes**. Apple blocker: **Yes**. Closed beta blocker: **Yes if distributed through Play closed testing/external TestFlight review**. Public launch blocker: **Yes**.
- **Estimated effort:** Medium
- **Recommended fix:** Publish a durable HTTPS privacy policy and support page, identify the developer/entity, document device ID/profile/gameplay data, retention, security, deletion, subprocessors/hosting, and contact details; link them from Profile/Settings and both consoles; complete Play Data Safety and Apple App Privacy.
- **Code changes required:** Yes for in-app links; legal/store work also required.
- **Uncertainty:** None of the required external pages or console entries was available.

### F3 — No deletion path for persistent player profiles

- **Severity:** High
- **Category:** Privacy / account lifecycle
- **Affected files:** `frontend/src/api.ts`; `frontend/app/(tabs)/profile.tsx`; `backend/server.py`; `backend/database.py`
- **Evidence:** Startup automatically creates a persistent MongoDB player keyed to a device identifier. No frontend control, API endpoint, database deletion operation, or external request page exists.
- **Why it matters:** If this automatic persistent profile is classified as app account creation, both stores require deletion mechanisms; users also cannot delete local identity and associated server data.
- **Disposition:** Google Play blocker: **Yes if Play classifies the profile as an account**. Apple blocker: **Yes under the same classification**. Closed beta blocker: **Yes for store-distributed external testing unless classification is resolved with store guidance**. Public launch blocker: **Yes**.
- **Estimated effort:** Medium
- **Recommended fix:** Add authenticated in-app deletion, server-side cascading deletion, local identifier removal after confirmed server deletion, clear irreversible confirmation, retention documentation, and the Google-required external web request path.
- **Code changes required:** Yes.
- **Uncertainty:** The app has no login UI, so store interpretation of automatically created anonymous profiles should be confirmed; privacy-policy obligations apply regardless.

### F4 — Production backend mode is not enforced by deployment configuration

- **Severity:** High
- **Category:** Release configuration / security
- **Affected files:** `backend/server.py`; `backend/.env.example`; `render.yaml`
- **Evidence:** Safe behavior depends on `FIRE_FEAST_ENV=production`. The checked-in `render.yaml` does not set or require it. If omitted, `/docs`, `/redoc`, `/openapi.json`, `/api/`, `/api/test`, and `/api/debug-db` are enabled and CORS defaults to `*`. Production CORS also allows an empty origin list without a startup error.
- **Why it matters:** A simple deployment-variable omission exposes diagnostics/schema and weakens browser-origin controls. It does not expose Mongo credentials directly, but it increases attack surface and obscures release state.
- **Disposition:** Google Play blocker: **Yes for safe distribution against that backend**. Apple blocker: **Yes for safe distribution**. Closed beta blocker: **Yes**. Public launch blocker: **Yes**.
- **Estimated effort:** Small
- **Recommended fix:** Require explicit production mode in `render.yaml`/hosting; fail closed when production CORS origins are absent if browser access is needed; add a deployment smoke check proving docs/debug return 404.
- **Code changes required:** Configuration and validation changes required.
- **Uncertainty:** Hosting-dashboard environment values were not available; it may already be configured correctly outside the repository.

### F5 — Background/process death can strand matches, rewards, and paid entry fees

- **Severity:** High
- **Category:** Runtime recovery / persistence
- **Affected files:** `frontend/app/play/[contestId].tsx`; `frontend/src/game/useGameLoop.ts`; `backend/services/match_service.py`; `backend/database.py`
- **Evidence:** No `AppState` handling exists. Gameplay time/opponent progress use JS timers. Backend `active_match` persists and prevents another contest, but there is no cancel/expiry/recovery endpoint. Result submission retries only twice in memory, gives no durable pending-result state, and users may navigate away. Reopening the same contest returns the start response but restarts local gameplay rather than restoring elapsed state.
- **Why it matters:** Background suspension or termination can desynchronize timers, lose a result submission, leave an active match permanently open, and prevent future play after entry coins were deducted.
- **Disposition:** Google blocker: **Yes for safe external distribution**. Apple blocker: **Yes for safe external distribution**. Closed beta blocker: **Yes**. Public launch blocker: **Yes**.
- **Estimated effort:** Large
- **Recommended fix:** Define a server-authoritative match lifecycle with expiry/cancel/resume, persist pending result fingerprints locally, reconcile at startup/resume, pause or deterministically resolve matches on background, and expose a clear recovery UI.
- **Code changes required:** Yes, coordinated frontend/backend.
- **Uncertainty:** Device background behavior was not dynamically tested.

### F6 — Match outcomes remain client-authoritative and plausibility checks are weak

- **Severity:** High
- **Category:** Security / reward abuse
- **Affected files:** `backend/models.py`; `backend/services/match_service.py`; `frontend/app/play/[contestId].tsx`
- **Evidence:** The client supplies `score`, `won`, duration, opponent, and antacid usage. Server validation checks active contest/opponent, non-negative values, and only an upper duration bound. It does not derive victory, cap score/antacid against plausible match state, require minimum elapsed server time, or authenticate the caller.
- **Why it matters:** Modified clients can submit extreme scores and false victories, earning currency/XP and polluting leaderboards. Atomic settlement prevents duplicate identical rewards but does not establish result truth.
- **Disposition:** Google blocker: **No for upload/review; yes for safe public economy**. Apple blocker: **No for upload/review; yes for safe public economy**. Closed beta blocker: **No if testers are trusted and data is disposable**. Public launch blocker: **Yes**.
- **Estimated effort:** Large
- **Recommended fix:** Validate server elapsed time, derive/verify outcome, enforce contest-specific score and consumable bounds, bind signed match tokens to sessions, and add abuse telemetry/rate limits.
- **Code changes required:** Yes.
- **Uncertainty:** No external anti-cheat or gateway evidence exists.

### F7 — Repeatable zero-cost currency grant bypasses economy integrity

- **Severity:** High
- **Category:** Monetization/economy security
- **Affected files:** `backend/data/shop.py`; `backend/services/shop_service.py`; `frontend/app/(tabs)/shop.tsx`
- **Evidence:** `coin_bundle` has price `0`, reward `500`, and currency purchases use an unconditional atomic `$inc`. It can be called repeatedly; no receipt, entitlement, cooldown, idempotency key, or one-time flag exists.
- **Why it matters:** Any client can mint unlimited currency. This is not a store-billing violation by itself because no real-money purchase is implemented, but it invalidates progression, leaderboard competition, and future monetization tests.
- **Disposition:** Google blocker: **No for submission**. Apple blocker: **No for submission**. Closed beta blocker: **Only if economy/progression feedback is in scope**. Public launch blocker: **Yes**.
- **Estimated effort:** Small if removed/disabled; Large if replaced with real-money IAP.
- **Recommended fix:** Decide product intent. Remove/disable repeatable free currency for launch, or make a clearly labeled one-time/test-only grant unavailable in production. Future paid currency must use store billing and server receipt validation.
- **Code changes required:** Yes.
- **Uncertainty:** The repository does not document whether this is an intentional beta faucet.

## 9. Medium findings

### F8 — Release/version/update/signing policy is incomplete

- **Severity:** Medium
- **Category:** Build/release reliability
- **Affected files:** `frontend/eas.json`; `frontend/app.json`; EAS credentials (not available)
- **Evidence:** Production Android AAB is explicit and iOS defaults to a device archive, but there is no `autoIncrement`, explicit production iOS profile, `runtimeVersion`, update policy/channel, or documented credential verification. Preview is internal Android APK; iOS preview behavior is implicit.
- **Why it matters:** Manual build numbers can collide; OTA/native compatibility policy is undefined; signing cannot be proven.
- **Disposition:** Store blockers: **No based on repository alone**. Closed beta blocker: **No**. Public launch blocker: **No**, but release-candidate blocker if credentials/build numbers are not verified.
- **Estimated effort:** Small
- **Recommended fix:** Document/update build-number ownership, add an explicit iOS production/preview configuration, decide Expo Updates/runtime policy, and perform signed AAB/IPA smoke builds.
- **Code changes required:** Configuration changes likely.
- **Uncertainty:** EAS remote credentials and console registrations were unavailable.

### F9 — No rate limiting and weak identifier/input bounds

- **Severity:** Medium
- **Category:** Backend security/availability
- **Affected files:** `backend/server.py`; `backend/models.py`
- **Evidence:** No rate limiter or gateway policy is documented. `device_id` is an unconstrained string; path lookup and mutation endpoints accept arbitrary IDs. CORS is not an authentication control.
- **Why it matters:** Automated enumeration, queue abuse, player creation, purchase calls, and database growth are inexpensive.
- **Disposition:** Non-blocking improvement for closed beta; public launch blocker only when combined with F1 if no upstream protection exists.
- **Estimated effort:** Medium
- **Recommended fix:** Authenticate first, constrain IDs and profile fields, add per-principal/IP rate limits at proxy/application level, cap body sizes, and monitor rejected traffic.
- **Code changes required:** Yes/configuration.
- **Uncertainty:** No reverse-proxy/WAF configuration was available.

### F10 — Automated tests are stale and do not validate the current local service

- **Severity:** Medium
- **Category:** Quality assurance
- **Affected files:** `backend/tests/test_chomp_champs.py`; `backend/tests/test_new_features.py`; `test_reports/**`; `frontend/package.json`
- **Evidence:** Tests call external URLs and mutate remote data. Assertions expect obsolete endpoints/fields/items and old Chomp Champs/TUMS contracts not present in current server/catalog. Test reports are dated 2026-06-15 and describe a different implementation. No frontend test script exists.
- **Why it matters:** Passing historical reports cannot support release confidence; current atomicity, recovery, production gating, and UI flows lack repeatable CI coverage.
- **Disposition:** Not a direct store blocker. Closed beta blocker: **No**, but materially raises regression risk. Public launch blocker: **Recommended yes for a minimal current smoke suite**.
- **Estimated effort:** Large
- **Recommended fix:** Replace live tests with isolated Mongo-backed/local tests, align contracts, add idempotency/auth/production-mode cases, and add focused frontend logic/screen smoke tests. Never default tests to a public endpoint.
- **Code changes required:** Test code/configuration.
- **Uncertainty:** No GitHub workflow exists; external CI may exist elsewhere.

### F11 — Player identity and progress are not recoverable after local storage loss

- **Severity:** Medium
- **Category:** Persistence/user experience
- **Affected files:** `frontend/src/api.ts`; `backend/database.py`
- **Evidence:** The only credential is a random AsyncStorage value. There is no login, secure recovery token, account linking, export/import, or reinstall recovery.
- **Why it matters:** Clearing app data or reinstalling can orphan all server progress and create a new profile. AsyncStorage is appropriate for a non-secret preference, but not durable account recovery.
- **Disposition:** Non-blocking for closed beta if disclosed; public launch concern.
- **Estimated effort:** Large
- **Recommended fix:** After F1, use an authenticated anonymous account with a secure refresh credential and optional platform account linking/recovery; document behavior.
- **Code changes required:** Yes.
- **Uncertainty:** OS backup behavior varies and is not a reliable recovery design.

### F12 — Accessibility foundation exists, but dense HUD text and semantics need a focused pass

- **Severity:** Medium
- **Category:** Accessibility/usability
- **Affected files:** `frontend/app/**`; `frontend/src/components/**`; `frontend/src/game/ui/**`
- **Evidence:** Positive: primary `FireButton` has role, label, disabled state, and a 44+ minimum height; a root alert exists; reduced-motion support is present in core fire/game animation components. Concerns: 227 occurrences of very small text/height patterns were found, including many 6–10 px HUD labels; several image/decorative layers lack explicit accessibility exclusion/labels; custom pressables vary; modal/overlay focus trapping and announcements are not systematically implemented; portrait-only and iPad support are unverified.
- **Why it matters:** Screen-reader noise, unreadable text, insufficient custom touch targets, and motion intensity can make gameplay unusable for some testers.
- **Disposition:** Not a closed beta or store blocker by itself. Public-quality concern.
- **Estimated effort:** Large
- **Recommended fix:** Audit interactive targets to 44×44, support text scaling where layouts permit, mark decorative images/effects inaccessible, announce timer/result/error state, verify focus on overlays, test contrast and reduced motion on device.
- **Code changes required:** Yes.
- **Uncertainty:** Static styles cannot prove physical contrast, focus order, or device rendering.

### F13 — Runtime image decode/memory pressure remains high

- **Severity:** Medium
- **Category:** Performance
- **Affected files:** `frontend/src/assets/**`; `frontend/ASSET_OPTIMIZATION_AUDIT.md`
- **Evidence:** The prior audit measured 68 images totaling 115,993,724 bytes. Frequently rendered 12–58 px icons are sourced from 1024–1536 px PNGs; gameplay effects and smoke textures are similarly oversized. No image optimizer was available, so runtime images were not resized.
- **Why it matters:** Decode memory is based on pixels, not compressed bytes; oversized icons/effects can contribute to frame drops and memory pressure on lower-end Android devices.
- **Disposition:** Non-blocking for submission; closed beta performance risk; public launch optimization recommended.
- **Estimated effort:** Medium
- **Recommended fix:** Use a real lossless/quality-controlled pipeline and device comparison, prioritizing coin, antacid, XP, trophy, streak, heartburn, click ring, smoke, and impact textures. Preserve protected branding/hero art.
- **Code changes required:** Asset changes; references need not change if filenames remain.
- **Uncertainty:** No device memory/profile trace was available.

### F14 — Legal/IP and third-party provenance evidence is missing

- **Severity:** Medium
- **Category:** Branding/legal
- **Affected files:** repository root; `frontend/assets/**`; `frontend/src/assets/**`; `backend/data/contests.py`; `frontend/package-lock.json`
- **Evidence:** No LICENSE, third-party notices, asset provenance ledger, font/audio/art licenses, or open-source acknowledgment exists. Current visible contest names and locations are fictional, and restaurant URL/logo fields are absent from current catalog, but internal IDs retain famous-brand references and catalog `image` fields contain Unsplash URLs. App artwork ownership cannot be verified.
- **Why it matters:** Store review may request authorization for third-party trademarks/copyrighted content; public launch requires confidence that art, audio, fonts, and imagery are licensed.
- **Disposition:** Not a blocker for generating artifacts. Apple/Google review blocker only if unlicensed material is displayed or ownership is challenged. Public launch blocker until provenance is documented.
- **Estimated effort:** Medium
- **Recommended fix:** Create an asset/license register, retain source licenses and authorizations, document open-source notices, ensure remote catalog images are not shipped/displayed without compliant attribution/license, and keep launch contest names/logos fictional unless licensed.
- **Code changes required:** Usually documentation/content; possibly asset/catalog changes after legal review.
- **Uncertainty:** Rights may exist outside the repository.

### F15 — Operations, health, backup, and migration evidence is incomplete

- **Severity:** Medium
- **Category:** Backend operations
- **Affected files:** `render.yaml`; `backend/server.py`; `backend/database.py`
- **Evidence:** Mongo startup ping/index setup is good, but `/api/health` returns HTTP 200 with `"degraded"` when Mongo is unavailable, so hosting health checks may not replace an unhealthy instance. No shutdown close handler, backup/restore plan, retention, migration/version strategy, alerting, or capacity plan is documented. Matchmaking is intentionally process-local and incompatible with multi-instance scale.
- **Why it matters:** Database outages may remain marked healthy; recovery and horizontal scaling behavior are undefined.
- **Disposition:** Non-blocking for small closed beta if monitored; public launch concern.
- **Estimated effort:** Medium
- **Recommended fix:** Separate liveness/readiness semantics, return non-2xx when dependencies required for traffic are unavailable, close clients on shutdown, document backups/restores/migrations, and constrain beta deployment to one matchmaking instance or externalize queue state.
- **Code changes required:** Some code/configuration and operational documentation.
- **Uncertainty:** Managed Mongo/Render policies were not available.

## 10. Low findings

### F16 — Legacy branding and TUMS terminology remain internally

- **Severity:** Low
- **Category:** Branding/maintenance
- **Affected files:** `CHANGELOG.md`; `ROADMAP.md`; `DESIGN_SYSTEM.md`; `design_guidelines.json`; `memory/PRD.md`; backend tests; `frontend/src/api.ts`; legacy API fields
- **Evidence:** Old Chomp Champs and TUMS strings remain in planning/test material, an AsyncStorage key, IDs, and compatibility fields. Current visible UI uses Fire Feast/Antacid.
- **Why it matters:** Creates reviewer/developer confusion and trademark risk if old documents or fields later leak into UI.
- **Disposition:** Non-blocking improvement.
- **Estimated effort:** Medium because API/storage migrations must preserve compatibility.
- **Recommended fix:** Update documentation/tests now; defer storage/API renames to a versioned migration rather than breaking existing users.
- **Code changes required:** Documentation plus carefully planned contract migration.
- **Uncertainty:** Some legacy fields may be intentionally permanent compatibility contracts.

### F17 — Production error logging exists without crash/observability integration

- **Severity:** Low
- **Category:** Operations/performance/privacy
- **Affected files:** `frontend/src/api.ts`; `frontend/src/utils/storage/storage-base.ts`; `frontend/src/game/useGameLoop.ts`
- **Evidence:** Hot gameplay debug logging is `__DEV__`-gated, which is good. API/storage errors still use console output in production; no crash reporter, release identifier, structured backend logging configuration, or alerting integration is present.
- **Why it matters:** Console noise offers little actionable beta telemetry and response bodies could contain profile data. Failures may go unseen.
- **Disposition:** Non-blocking improvement; recommended before broad beta.
- **Estimated effort:** Medium
- **Recommended fix:** Define privacy-conscious structured telemetry, redact identifiers/payloads, tag release/build, and provide opt-out/disclosure as applicable.
- **Code changes required:** Yes and service configuration.
- **Uncertainty:** Platform-native/EAS telemetry outside the repository was unavailable.

## 11. Already production-ready items

| Feature/configuration | Evidence | Why ready |
|---|---|---|
| Type safety | `frontend/tsconfig.json`; `npx.cmd tsc --noEmit` passes | Strict TypeScript build is clean |
| Lint error gate | `frontend/eslint.config.js`; `npm.cmd run lint` exits 0 | No lint errors; warnings are quality debt, not blockers |
| Production API URL gating | `frontend/app.config.js`, `frontend/src/api.ts` | Production requires a configured HTTPS endpoint both at build/config and runtime initialization |
| Android artifact type | `frontend/eas.json` | Production uses `app-bundle` (AAB) |
| App identity basics | `frontend/app.json` | Name, slug, package, bundle ID, versions, scheme, icon, splash are present |
| Secrets hygiene | nested `.gitignore` files; `git ls-files` | `.env`, keys, signing files, service credentials are ignored; no actual env file is tracked |
| Root crash recovery | `frontend/app/_layout.tsx` | Router error boundary provides retry and return-home actions |
| Startup recovery | `frontend/app/index.tsx` | Loading, one automatic retry, explicit retry, cleanup, and cached bootstrap fallback exist |
| Request timeout | `frontend/src/api.ts` | All API requests abort after 8 seconds and clear timers |
| Screen failure/empty states | home/profile/shop/leaderboard/contests | Loading, empty, retry, and error presentations are broadly implemented |
| Match start atomicity | `backend/database.py`, `services/match_service.py` | Entry deduction and active-match creation use one conditional atomic update |
| Duplicate match-result protection | `settle_player_match`, result fingerprint | Active match is atomically consumed; identical retry returns stored response |
| Welcome reward idempotency | `services/player_service.py` | Conditional atomic claim prevents double grants |
| Gear duplicate protection | `services/shop_service.py` | Conditional balance/ownership update and `$addToSet` |
| Unique player index | `backend/database.py` | Unique `device_id` index and duplicate insert recovery |
| Matchmaking duplicate polling/cleanup | `frontend/app/matchmaking.tsx` | In-flight guard, interval cleanup, route timer cleanup, cancel/leave behavior |
| Production API docs gating | `backend/server.py` | Docs/test/debug routes become unavailable when production mode is correctly set |
| Reduced motion foundation | FireButton, FireArenaBackground, multiple game overlays | Core continuous animation paths stop or reduce based on accessibility preference |
| Audio cleanup | `AdaptiveAudioManager.ts`, `useAdaptiveAudio.ts` | Timers clear and music/effect players are released by manager paths |
| No ads/tracking/analytics | dependencies and source search | No advertising, ATT, analytics, tracking, notifications, or crash SDK is present |
| No real-money gambling/IAP | shop/catalog/source | Current prizes and purchases are virtual; no real-money betting or store billing is implemented |
| Current fictional launch presentation | `backend/data/contests.py` visible names | User-visible contest names/locations are fictional; future restaurant URL/logo fields are unused |

## 12. Google Play blockers

1. **F2 — Privacy policy/Data Safety package missing**
   - Files: repository legal docs; frontend Profile/Settings; Play Console.
   - Exact reason: Play closed/open/production tracks require Data Safety completion and a privacy-policy link; the current repository provides neither.
   - Resolution: publish/link policy and complete accurate declarations.
   - Effort: Medium.
2. **F3 — Account/data deletion unresolved**
   - Files: frontend profile/API; backend server/database; external deletion page.
   - Exact reason: if automatic persistent profiles are treated as account creation, Play requires in-app and external deletion.
   - Resolution: implement deletion or obtain/document a defensible no-account classification.
   - Effort: Medium.
3. **F1 — Unsafe account authorization**
   - Files: frontend API and backend endpoints/leaderboard.
   - Exact reason: external testers can enumerate and mutate other profiles; this prevents safe distribution even though it does not prevent AAB upload.
   - Resolution: authenticate and remove public IDs.
   - Effort: Large.
4. **F4 — Backend production mode not proven**
   - Files: `render.yaml`, backend environment/server.
   - Exact reason: a missing variable makes the public backend run with debug/docs and wildcard CORS.
   - Resolution: enforce production mode and smoke-test deployed routes.
   - Effort: Small.

Android AAB generation itself appears configured. Signing, target-SDK compliance of the generated artifact, Play App Signing enrollment, and console ownership remain unverified rather than failed.

## 13. Apple App Store blockers

1. **F2 — Privacy policy/support/App Privacy package missing**
   - Exact reason: App Store metadata and in-app privacy access are required, and App Privacy responses are required for submission.
   - Resolution: publish/link policy/support and complete App Privacy.
   - Effort: Medium.
2. **F3 — In-app account deletion unresolved**
   - Exact reason: Apple requires in-app deletion for apps supporting account creation; persistent anonymous profile classification must be resolved.
   - Resolution: implement authenticated deletion of account and associated data.
   - Effort: Medium.
3. **F1 — Unsafe account authorization**
   - Exact reason: prevents safe TestFlight/public distribution and exposes tester data/progress.
   - Resolution: authenticated principals and non-public identifiers.
   - Effort: Large.
4. **F4 — Backend production mode not proven**
   - Exact reason: review would exercise a backend that may expose development behavior if deployment variables are omitted.
   - Resolution: enforce production config and verify externally.
   - Effort: Small.

iOS archive generation is plausible from Expo defaults, but signing certificates, provisioning, App Store Connect app registration, required screenshots, privacy manifest output, and actual device archive validation were not available.

## 14. Closed beta blockers

1. F1 unauthenticated profile impersonation — fix before exposing persistent tester profiles.
2. F2 privacy/support and store disclosure basics — mandatory for Play closed testing and external review-quality distribution.
3. F4 production backend enforcement — prevent debug-mode deployment.
4. F5 match/background/result recovery — prevent paid-entry lockouts and invalid beta feedback.
5. F3 deletion/classification decision — required if using store tracks that apply account-deletion policy.

F7 may be retained only if explicitly documented as a beta economy faucet and beta data is disposable.

## 15. Public launch blockers

1. F1 authenticated identity/authorization.
2. F2 privacy policy, support, and store disclosures.
3. F3 complete deletion flow.
4. F4 fail-closed production deployment.
5. F5 durable match/result lifecycle and recovery.
6. F6 server-authoritative result validation/abuse controls.
7. F7 production economy decision and removal of unlimited currency minting.
8. F14 asset/third-party rights documentation.
9. F10 a current, isolated regression/smoke suite.

## 16. Security assessment

Security status is **Not Ready (34/100)**. Atomic database updates are a meaningful strength: match-start charging, result settlement, one-time welcome reward, and gear purchase ownership checks reduce duplicate-request damage. Production frontend HTTPS gating and secret ignore rules are also good.

The authorization model remains the dominant risk. Device IDs function as credentials but are public through leaderboard output and accepted without proof. CORS cannot protect native API calls. Match truth and economy operations are client-triggered with weak abuse controls. Production environment safety depends on an unenforced flag, and rate limiting is absent. No committed secrets were found; actual `.env` values were not printed, and `.env` files are ignored.

## 17. Performance assessment

Performance status is **Nearly Ready (78/100)** for closed beta, subject to device testing. Animations generally stop on cleanup, core gameplay timers have centralized clearing, API timeouts clear, matchmaking prevents overlapping polls, and audio players are released. Development-only hot-path logging is gated.

Primary risks are oversized runtime PNG decode surfaces documented in the asset audit, many concurrent animated layers, and no background lifecycle policy. Large lists are modest in current catalogs and do not appear to be the principal risk. A low-end Android memory/frame profile is still needed.

## 18. Accessibility assessment

Accessibility status is **Needs Work (68/100)**, not a closed-beta blocker. The app has an encouraging base: labeled primary buttons, disabled states, 44+ px FireButton targets, root alert/error recovery, accessibility live regions in some gameplay messaging, and reduced-motion integration.

Highest-value improvements are readable HUD typography, explicit decorative-image exclusion, labels/roles for every custom pressable, overlay focus/announcement behavior, non-color status cues, Dynamic Type/layout testing, and iPad/portrait testing. Haptics are supplemental rather than the only feedback, which is good.

## 19. Branding and legal assessment

Branding/legal status is **Not Ready (40/100)** because required policy/support material and rights evidence are missing—not because current visible gameplay uses obvious commercial brands. Fire Feast identity is consistent in the app configuration and visible UI. Current contest names are fictional. Future restaurant integrations are represented only by optional types/components and are not current blockers.

Internal IDs and historical documents reference famous contests/brands, and catalog records carry Unsplash URLs, but local food artwork is currently selected for UI. Before public launch, document rights to every shipped artwork/audio/font/effect, keep third-party logos/menu imagery disabled unless licensed, and prepare review notes explaining that prizes/currency are virtual and no real-money gambling, advertising, tracking, analytics, UGC, or IAP exists.

Age/content rating must be completed in each console. Competitive eating, heartburn/antacid theming, and simulated virtual rewards should be disclosed accurately; repository evidence does not show real-money gambling or sweepstakes.

## 20. Backend readiness

Backend status is **Needs Work (46/100)**. MongoDB persistence, unique indexing, atomic conditional updates, idempotent result replay, production docs gating, health path, pinned direct dependencies, and Render AAB/API separation are solid foundations.

Blocking work is authorization, authoritative match validation, active-match expiry/recovery, explicit production deployment gating, and unlimited currency abuse. Operational work includes meaningful readiness status, backup/restore/migration documentation, rate limiting, logging/alerts, graceful shutdown, and a single-instance constraint or externalized matchmaking state.

## 21. Frontend readiness

Frontend status is **Nearly Ready (76/100)**. Startup, routing, root error boundary, loading/empty/retry states, request timeout, HTTPS gating, matchmaking cleanup, result duplicate guards, type safety, and lint error status are good.

Remaining material work is authenticated identity, account/privacy controls, background/resume reconciliation, durable pending-result recovery, production support links, accessibility testing, asset memory optimization, current automated tests, and signed device builds. There is no offline gameplay mode; offline messaging/retry is adequate for startup and major list screens but result recovery is not.

## 22. Top ten remaining tasks

| Priority | Milestone | Scope / affected files | Expected outcome | Effort | Dependencies |
|---:|---|---|---|---|---|
| 1 | G5.5.2 | Authenticated anonymous identity; backend authorization; remove leaderboard device IDs | No cross-player impersonation | Large | Product identity/account decision |
| 2 | G5.5.3 | Privacy policy, support page/contact, data inventory, Play Data Safety, Apple App Privacy | Submission declarations can be completed | Medium | Hosting/legal owner details |
| 3 | G5.5.3 | In-app and external deletion; backend cascading deletion; local cleanup | Store-compliant user data control | Medium | Task 1 authentication; legal retention rules |
| 4 | G5.5.4 | Enforce backend production env/CORS; verify EAS credentials, AAB/IPA, build numbers | Reproducible fail-closed release builds | Medium | Production domains/accounts |
| 5 | G5.5.5 | Active match expiry/cancel/resume; AppState policy; durable pending-result reconciliation | No stranded entry fees or lost results | Large | Backend lifecycle design |
| 6 | G5.5.5 | Server validation of elapsed time, outcome, score/consumables; replay/rate controls | Reduced cheating/reward abuse | Large | Task 1 |
| 7 | G5.5.5 | Decide/remove beta currency faucet; document virtual economy; future IAP boundary | Production-safe economy | Small | Product decision |
| 8 | G5.5.5 | Replace stale remote tests; add local Mongo/service and frontend smoke coverage; CI | Current repeatable release evidence | Large | Tasks 1, 5, 6 contracts |
| 9 | G5.5.6 | Optimize high-frequency images and profile low-end devices | Lower decode memory/frame risk | Medium | Proper image tooling/device matrix |
| 10 | G5.5.6/7 | Accessibility pass, rights/license register, store screenshots/content ratings/review notes | Usable and legally documented store package | Large | Final UI/content freeze |

## 23. Recommended milestone plan

### G5.5.2 — Critical Store Blockers

Implement authenticated principal ownership, remove public device IDs, and add immediate abuse controls. Confirm no migration loses current test players.

### G5.5.3 — Privacy, Legal, and Data Safety

Create/publish privacy and support pages, build the data inventory and retention policy, implement deletion, complete draft Play/Apple disclosures, and establish asset/license provenance.

### G5.5.4 — Release Configuration

Fail-close backend production configuration; document EAS credentials and update/runtime policy; configure build-number handling; produce signed Android AAB and iOS archive smoke builds.

### G5.5.5 — Closed Beta Stability

Implement active-match expiry/resume/cancel, AppState reconciliation, durable result submission, stronger server result validation, economy faucet decision, rate limits, current isolated tests, and production smoke checks.

### G5.5.6 — Accessibility and Performance

Test low-end Android/iPhone/iPad, optimize prioritized assets, profile memory/frame time, improve small text/touch semantics/focus, and verify reduced motion.

### G5.5.7 — Store Listing Preparation

Finalize name/subtitle/descriptions, screenshots, age/content ratings, support/marketing URLs, privacy declarations, rights evidence, and reviewer notes about anonymous profiles and virtual-only contests/currency.

### G5.5.8 — Release Candidate Validation

Run clean installs, upgrades, offline/startup/background/process-death scenarios, deletion, restore/recovery, duplicate requests, load testing, signed artifact inspection, TestFlight/Play closed-track smoke tests, and rollback drills.

## 24. Validation results

### Frontend

- `npx.cmd tsc --noEmit` — **passed**.
- `npm.cmd run lint` — **passed with 0 errors and 30 warnings**. Warnings were not changed during this audit.
- No other frontend test script exists in `frontend/package.json`.

### Backend

- `python -m compileall -q backend` — **passed**.
- Existing pytest files were not run because they call external services, mutate persistent data, require external environment configuration, and contain stale contracts. Historical XML reports are not treated as current validation.

### Repository/search review

- Searched for localhost, loopback/LAN IPs, insecure HTTP, console logging, TODO/FIXME/HACK, Chomp Champs, TUMS, test/debug endpoints, example secrets, and credential-like strings.
- Development localhost/HTTP references are confined to templates/default local Mongo and guarded external URL handling.
- Production frontend API requires HTTPS.
- No tracked `.env`, private key, service credential, or hard-coded database password was found.
- Repository has no GitHub workflow, license, third-party notice, privacy policy, terms, or support/legal document.

## 25. Files changed and confirmations

- Created `STORE_READINESS_AUDIT.md` at the repository root.
- Final working-tree review shows only this new report as untracked; prior lint-fix and asset-audit work is part of the repository baseline.
- Gameplay behavior unchanged.
- Navigation unchanged.
- API contracts unchanged.
- No scoring, AI, networking, persistence, progression, or monetization behavior changed.
- No dependencies installed.
- No commit or push performed.
