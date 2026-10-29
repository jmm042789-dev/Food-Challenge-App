# Fire Feast release candidate

This repository pairs the authoritative Python backend with the Expo Android frontend.
The preserved assembly commit is 7973669816bb8243850562edddde8ee0a8310ccd.
Original frontend HEAD: 8436684b47e8f83d183b56636af7432f32a3403a.
Imported frontend HEAD: 7176c23874b0dea135e551eebff4116959c8f432.
See provenance/FRONTEND-COMMIT-MAP.json for all 21 mapped commits.

## Layout

- backend/: FastAPI/PyMongo runtime, pinned Python version, catalogs and tests.
- frontend/: Expo application, assets, package-lock.json and frontend validation.
- docs/legal/: the three preserved legal documents.
- scripts/: local validation and explicitly opted-in staging smoke checks.
- provenance/: immutable recovery and assembly evidence.
- validation-results/: ignored local evidence and dependency caches.

The assembly checksum records describe the assembly commit, not subsequent approved
infrastructure edits. Do not rewrite historical baselines or provenance to conceal changes.

## Local validation

Use Python 3.14.3 to match Render. If another patch is used, record it; a local pass
does not establish exact runtime parity. Required Python packages are pinned in
backend/requirements-test.txt. Dependency installation requires explicit approval:

    python -m pip install -r backend/requirements-test.txt

From frontend/, restore the existing lockfile only after approval:

    npm ci --ignore-scripts --no-audit --no-fund

No validator installs packages. No lifecycle scripts run in the approved lockfile install.
From the repository root on Windows:

    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/validate.ps1

For an explicitly scoped backend-only check:

    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/validate.ps1 -BackendOnly

The root gate runs all deterministic backend tests, the complete frontend test suite,
whole-project TypeScript, local Render checks, PNG integrity, ESLint and Git diff checks.
Live configuration is removed from deterministic test environments. The Python adapter
blocks network operations in its process, but child processes do not inherit the guard;
this is not an OS network sandbox. Never supply production credentials to validation.

Additional evidence, retaining the existing scoped TypeScript and historical checks:

    node frontend/scripts/validate-local-release.js

Its API source checker may report PARTIAL for unresolved dynamic code. Its Build 19
baseline is historical and can fail against intentional later work. Such gaps are real
release blockers, not evidence to suppress. Reports go to validation-results/.
No local result establishes live HTTP, database or physical Android acceptance.

## Render + MongoDB Atlas staging procedure

No resource has been created by these files. Starter is a paid plan; provisioning
requires a separate deployment decision. Review region and cost before creation.

1. Finish local gates and review the exact readiness commit. Push this repository
   to an approved Git host only when separately authorized; it currently has no remote.
2. Create an isolated Atlas staging database named fire_feast_staging. Use a unique
   database user restricted to that database, separate from production credentials.
   Configure backups, alerts and a restore drill before retaining meaningful progress.
3. Review the staging Blueprint in render.yaml. It defines one Python web service,
   backend root directory, one instance and one Uvicorn worker. Automatic deploys are
   off. Python 3.14.3 matches backend/.python-version.
4. In the separately approved Render setup, supply STAGING_MONGO_URL and STAGING_MONGO_HOST through protected
   environment settings. sync:false prompts on initial Blueprint creation; later secret
   changes must be managed explicitly in the dashboard. Never put the URI in Git,
   shell arguments, frontend configuration, logs or reports.
5. Confirm DB_NAME=fire_feast_staging, FIRE_FEAST_ENV=production and
   PYTHON_DOTENV_DISABLED=1 and FIRE_FEAST_DEPLOYMENT=staging. The Atlas user must have no production database access.
   Production mode enables the secure runtime behavior even though the data is staging.
6. Allowlist the actual Render outbound ranges in Atlas. Use the Atlas-generated SRV
   URI with TLS/certificate verification, appropriate majority write concern and retry
   options. Percent-encode credentials as required. Keep Atlas near the selected
   Render region (the descriptor uses Oregon). Do not use an all-internet allowlist.
7. After explicit deployment approval, deploy the reviewed commit. Build:
   pip install -r requirements.txt. Start:
   uvicorn server:app --host 0.0.0.0 --port $PORT --workers 1.
   Startup creates indexes and default settings, so it must target staging only.
8. Confirm /api/health/live and /api/health/ready; readiness must return 200 only when
   MongoDB is available and 503 otherwise. Check sanitized logs and request IDs.
9. Only after approval, replace the standalone Android staging profile's empty
   EXPO_PUBLIC_BACKEND_URL with the verified staging HTTPS origin. The staging
   package is separate and OTA updates are disabled. Never use preview/production
   profiles for staging acceptance. Review the resolved URL before distribution.
10. Test all six contests, bootstrap recovery, resume, receipt recovery, duplicate
    settlement, inventory, rewards, friend PvP, account deletion and server restarts.
    Test realistic network failures, concurrent operations and backup restoration.
    Queues and rate limits remain process-local: do not scale workers or instances.

Render's backend root excludes frontend/, provenance/, root scripts, legal documents
and validation-results/ from its build/runtime filesystem. Build filters are not artifact
exclusion rules. Backend operational contract documents/tests remain part of backend/.
No real .env, private keys or dependency directories may be tracked. EAS runs from
frontend/ with its own .easignore; root preservation records are outside that build root.

## Opt-in staging smoke check

scripts/validate-integration.ps1 defaults to SKIPPED with exit 0. It selects only the
existing read-only authenticated-session test, never legacy mutating integration suites.
For a separately approved staging check, supply these through the process environment,
without printing their values:

- FIRE_FEAST_RUN_INTEGRATION=1
- FIRE_FEAST_INTEGRATION_TARGET=staging
- FIRE_FEAST_STAGING_API_URL: the approved staging HTTPS origin
- EXPO_PUBLIC_BACKEND_URL: exactly the same origin
- FIRE_FEAST_INTEGRATION_AUTH_TOKEN: an existing disposable staging guest token

    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/validate-integration.ps1

This wrapper does not provision accounts or databases. An explicit target label cannot
prove the remote service is configured correctly; verify its provenance separately.

## Operational release gates

Investigate any readiness failure, recurring 5xx, settlement failure or duplicate debit.
Review p95 latency and memory under representative load before inviting more testers.
These are manual review triggers, not automated alerts or an availability guarantee.
Public launch also requires legal/support publication, account recovery policy,
dependency/security review and the physical-device checklist in frontend/DEPLOYMENT.md.

Official configuration references:
- https://render.com/docs/blueprint-spec
- https://render.com/docs/python-version
- https://render.com/docs/deploy-fastapi
- https://render.com/docs/monorepo-support
- https://render.com/docs/outbound-ip-addresses
