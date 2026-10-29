# Fire Feast backend staging candidate

Created UTC: 2026-10-26T21:49:39.600647+00:00

Manifest: `BACKEND-STAGING-CANDIDATE-20261026T214939Z-8dd48aff.manifest.json`
Manifest SHA-256: `7d9df4e9f31a5c33a8d77b09f7bd9e7ef5d103db62d528989ab3001f1197a1d1`
Base HEAD: `7973669816bb8243850562edddde8ee0a8310ccd`
Inventory: **76 files: 65 backend and 11 staging support**, representing 1084934 bytes. No source files were copied.

This is a working-tree inventory, not an immutable deployable Git revision. Every entry records relative path, byte length, exact SHA-256 and Git status. The manifest/report exclude themselves. Existing provenance and backups are not rewritten. Frontend application code is outside this backend scope; package.json/package-lock.json are included solely to identify Node validation dependencies. Full root validation still requires the complete project; BackendOnly and focused descriptor checks are scoped options.

## Included uncommitted files

- `.gitignore`: ?? .gitignore
- `README.md`: ?? README.md
- `backend/DEPLOYMENT.md`: M backend/DEPLOYMENT.md
- `backend/config.py`: M backend/config.py
- `backend/tests/test_staging_configuration.py`: ?? backend/tests/test_staging_configuration.py
- `frontend/scripts/validation/backend-local.py`: M frontend/scripts/validation/backend-local.py
- `frontend/scripts/validation/deployment.js`: ?? frontend/scripts/validation/deployment.js
- `frontend/tests/deployment-config.test.js`: ?? frontend/tests/deployment-config.test.js
- `render.yaml`: ?? render.yaml
- `scripts/validate-integration.ps1`: ?? scripts/validate-integration.ps1
- `scripts/validate.ps1`: M scripts/validate.ps1
- `scripts/validation-common.ps1`: ?? scripts/validation-common.ps1

The core resume/receipt routes, models, match service, atomic database operations and existing recovery tests are already tracked unchanged at HEAD. The candidate requires these tracked files as well as the uncommitted staging files. Publishing only config changes would not transfer recovery functionality to the older production revision.

## Runtime and dependency requirements

Required Python: **3.14.3**, consistent between backend/.python-version and render.yaml. Local qualification used **3.14.6**. Exact patch parity remains outstanding.

backend/requirements.txt:

```text
fastapi==0.139.0
pydantic==2.13.4
pymongo==4.17.0
python-dotenv==1.2.2
uvicorn==0.51.0
```

backend/requirements-test.txt:

```text
-r requirements.txt
pytest==9.1.1
requests==2.34.2
```

Installed direct versions matched these pins during qualification. A complete transitive Python lock is absent. No dependency installation occurred.

Render descriptor: fire-feast-api-staging; release-candidate-1 branch; backend root; Starter plan; Oregon; automatic deploys off; **one instance, one Uvicorn worker**. Queue/rate-limit state is process-local, so do not increase either count without separate qualification.

Declared future build: `pip install -r requirements.txt`.
Declared start: `uvicorn server:app --host 0.0.0.0 --port $PORT --workers 1`.
Health check: `/api/health/ready`.
These commands were recorded, not run.

## Passing local qualification

The preceding task passed **222 existing backend tests and 46 subtests** across resume, receipts, lifecycle, security audit, anti-cheat, authentication, bootstrap recovery, staging configuration, configuration and health. Four existing FastAPI on_event deprecation warnings remained. Two deployment descriptor tests, descriptor/artifact validation and whitespace checks passed.

Coverage included concurrent settlement, competing terminal transitions, duplicate-credit prevention, failed writes, identity-before-expiry corrections, charge-free resume and receipt identity/proof validation. Existing process-local network blocking was enabled; bytecode and pytest caches were disabled. Tests used mocks/in-memory atomic adapters; no live MongoDB or production API was used. The process-local network guard does not extend to child processes.

The backend still matches that qualification inventory: `13f50a88bee9f3fe454f2aa70d13d135b4bb14d651ceec6db36d45b1c48ca63e`. Its digest uses Windows Path ordering of lines `<SHA-256>  <relative POSIX path>\n`. Tests were not rerun merely to produce these files. Earlier full-suite results remain historical, not a current full-suite pass.

## Staging database and index requirements

Use a separately verified isolated Atlas project/cluster and staging-only user with no production access. Set FIRE_FEAST_DEPLOYMENT=staging, FIRE_FEAST_ENV=production, DB_NAME=fire_feast_staging and PYTHON_DOTENV_DISABLED=1. Supply STAGING_MONGO_URL through protected provider inputs and independently approve STAGING_MONGO_HOST. Never copy production credentials or attach shared production environment groups.

The loader requires matching SRV host, credentials, staging database path and certificate-verified TLS; it ignores generic MONGO_URL. These checks cannot establish provider ownership or user permissions. Review retry and majority-write-concern settings independently; configuration acceptance does not prove majority write concern.

Startup pings MongoDB, creates **24 indexes (15 unique)**, and initializes global settings. The staging user needs database/index creation permissions. Inspect conflicting data before startup; unique-index failures must stop deployment. Index contracts cover player identity, social pairs, pending PvP challenge uniqueness, PvP matches, promotion codes/redemptions and lookup indexes. An expiry lookup index is not a TTL guarantee. No new collection/index migration is required for resume/receipts. Historical records without sufficient receipt evidence remain UNRESOLVED; no receipt backfill is provided.

## Outstanding live acceptance

1. Verify exact candidate revision, staging service origin with no production redirect, resolved settings, Python 3.14.3 and dependency versions.
2. Independently verify isolated cluster/database/user identity, restricted roles/network allowlist, TLS, retry/write concern, all indexes, backups, alerts and restore capability.
3. Confirm staging liveness/readiness. Startup/index/default-setting writes must target staging only. Health success does not prove gameplay or isolation.
4. With disposable staging accounts, test bootstrap/recovery, all six contests, entry and duplicate entry, original-snapshot resume, restart/expiry, validation-v3 results, lost responses, exact-payload retries and authoritative receipts.
5. Exercise competing settlement/rejection/expiry and write failures against real MongoDB. Verify one entry debit, one reward credit, atomic receipts, and no old-request expiry of a different active match. Uncertain outcomes must retain pending evidence.
6. Check daily/welcome duplicates, purchase retry semantics, persistence, restore and physical Android lifecycle. Consumable purchases have no request idempotency key and repeated successful requests can charge again.
7. Leave Android staging URL empty until its isolated HTTPS origin is approved. Preserve separate Android identity, disabled OTA updates and rejection of both production hostnames.

## What makes this immutable and deployable

After separate authorization and review, include necessary modifications/untracked files plus all tracked backend source in a complete Git revision, excluding secrets, caches, backups and unrelated frontend work. Preserve current work while selecting the revision; this task stages or commits nothing. Record the full resulting SHA, verify candidate bytes against this manifest, and bind any future deployment to that SHA instead of a mutable branch tip. New source changes require a fresh manifest and relevant qualification. The current local HEAD alone omits required uncommitted staging files. Exact Python 3.14.3 qualification and isolated real-MongoDB acceptance remain release gates.

No commit, tag, branch, push, build, deploy, production modification, backup alteration, D: access or Cricut access was performed.
