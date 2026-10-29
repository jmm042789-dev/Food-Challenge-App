# Current-release source integrity

Run this separate, read-only check in PowerShell from the repository root:

    & "C:\Program Files\nodejs\node.exe" frontend/scripts/check-current-release-integrity.js

This does not regenerate or replace Build 19's baseline or historical report.
The old historical gate remains separate and retains its reported differences.
This check is not a full source-tree, build, backend, dependency, device or release
acceptance gate. New validation tools and tests require code review and focused
test evidence; their presence is not itself proof of release readiness.

## Independently derived expectations

The fixed assembly commit is 7973669816bb8243850562edddde8ee0a8310ccd.
Its preserved provenance/SHA256SUMS.txt inventory has a pinned digest. Expectations
for unchanged monitored files come from that existing assembly record, not from
hashing the current working tree to create a new baseline. Historical baseline
bytes are checked against that inventory; the reviewed historical report also
has a separately pinned digest.

Scope includes every file monitored by Build 19, all PNGs recorded in the preserved
assembly, and six explicit auth/recovery source files. PNG paths must match the
preserved inventory and every PNG must decode with valid chunks, CRCs and IDAT.
Links/junctions, missing files, unexpected PNGs, unstable reads and unknown changes
fail. Reads and asset traversal are bounded; no drive-wide search occurs.

The 13 historical differences were reviewed against preserved bytes and Git
history: build configuration advanced to versionCode 23 and added a diagnostic
profile; match resume/receipt and immutable submission handling were added;
input validation, real control evidence and burnout replay/timing were improved;
four corresponding regression tests changed. The added avatar proof PNG is
independently recorded in the original preservation manifest. No asset or source
hash was accepted merely because it exists in today's working tree.

The original two deviations from assembly content are authorized by the
separately pinned current-release-reviewed.patch artifact, retained unchanged:

- src/api.ts: reviewed hunks fence stale authentication work, drain writes during local
  clearing, reject superseded sessions and prevent aborted callers from retrying.
  Mocked regressions first demonstrated credential resurrection/overwrites and
  cancelled retries; then verified these guards.
- tests/api-base.test.js: the environment template is optional because the import
  policy explicitly omitted .env.example. Required routing files still fail when
  missing; present optional templates remain scanned for forbidden hosts.

The separately pinned current-release-gameplay-reviewed.patch adds two reviewed
gameplay changes without replacing the original patch or historical evidence:

- src/game/useGameLoop.ts: version-2 snapshots preserve warning/burnout deadlines,
  cooling observation time and finished status. Restoration follows validation-v3
  replay boundaries, retains lockouts and uses an exact remaining-time deadline.
  Legacy unsafe snapshots and malformed phase clocks remain refused.
- app/play/[contestId].tsx: restoration includes time spent waiting for hydration
  using the bound match origin. A deterministic test first demonstrated the
  resulting 200 ms phase/deadline extension, then verified the correction.

The separately pinned current-release-lifecycle-reviewed.patch is an incremental
overlay on the reviewed gameplay source, not a replacement for either earlier
patch. It adds a fixed deadline for fresh rounds, foreground clock/burnout
synchronization, and guards against stale foreground responses after unmount or
a newer lifecycle cycle. Mocked AppState and process-replacement tests first
proved the timing/stale-response defects. Physical Android acceptance remains
OUTSTANDING; see ANDROID-LIFECYCLE-ACCEPTANCE.md.

Focused tests compare phase-boundary eligibility and scores against production
backend replay and cover completed matches, antacid saves, immutable retries,
repeated restoration and fractional remaining time. The independent expectations
are exact reviewed patches to assembly source, not wholesale current-file hashes.

For these four files the checker reads the immutable assembly Git objects and
applies only the exact reviewed patches in order in memory. Context, offsets and line counts
must match. The candidate must equal that result, allowing only LF/CRLF transport
differences. No fuzzy patching or automatic baseline regeneration occurs.
Every other monitored file must match its preserved byte hash exactly.

Future intended changes require independent review of the change and its tests,
followed by explicit policy updates. A passing source check does not turn dynamic
authentication retry contracts into static PASS or replace runtime qualification.
