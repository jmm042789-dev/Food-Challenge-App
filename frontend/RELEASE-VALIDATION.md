# Release candidate local validation

Run from this repository; paths resolve from the script location:

    node frontend/scripts/validate-local-release.js

The authoritative backend is backend/. No backend-checkout or recovery-workspace
directory is required. The original preservation manifest is tracked at
provenance/FRONTEND-PRESERVATION-MANIFEST.txt and checked against its trusted hash.
All original provenance and assembly checksum records remain historical evidence.

## Required checks and evidence

The hardened runner retains the full frontend suite, scoped TypeScript, PNG checks,
all deterministic backend tests, API source contracts, ESLint, Git diff checks,
the staging deployment contract and the Build 19 historical integrity baseline.
The root scripts/validate.ps1 additionally offers a whole-project TypeScript gate.
Neither runner installs packages or starts application/database services.
Missing dependencies, failed checks and PARTIAL API coverage never count as PASS.
No test is removed or excluded to hide a release failure.

Timestamped JSON evidence is written inside the ignored validation-results/ directory.
RUNNING/terminal=false is incomplete evidence. Terminal PASS requires every selected
stage to execute successfully and no source/index/HEAD/status mutation. A .pending
file is never a completed report. Failed evidence publication returns failure.

The source snapshot covers the repository, including backend, frontend and provenance.
Only .git, node_modules, .expo, validation-results, __pycache__ and .pytest_cache
directories are excluded from byte hashing. Dependency/cache bytes are not qualified.
Added, removed or changed source files, index, HEAD and status changes fail the check.
Links and unstable reads stop validation; no automatic repair or retry occurs.

## Isolation and credentials

Child environments retain only essential platform variables and absolute executable
search paths. They exclude inherited database credentials, live URLs and proxies.
Dotenv loading, bytecode, pytest cache and external plugin autoloading are disabled.
The Python audit hook blocks service connection/bind/DNS operations in that process,
except the Windows stdlib asyncio wakeup socketpair. Child processes do not inherit
the guard. This is not an OS network sandbox. Node/native extensions/subprocesses
are not confined by that hook. Only reviewed tests may run without live credentials.

Reports redact known sensitive values and common credential formats. Redaction
cannot guarantee removal of every secret. Review evidence before sharing it.

scripts/validate-integration.ps1 defaults to SKIPPED. With explicit approved staging
configuration it selects only the read-only authenticated-session smoke test.
Legacy live suites mutate state and are never invoked by that wrapper.
No integration checks have been run as part of restoring this infrastructure.

## Scope limitations

The source API checker is not an HTTP or database test. Forwarded options, dynamic
routes and unresolved request-field guarantees remain PARTIAL with exit 2. Actual
responses, enum/range constraints, auth, retries and transactions require staging.

The preserved Build 19 integrity baseline is not a current release-candidate baseline.
It is deliberately not regenerated; any mismatch remains a qualification gap.
Python runtime parity must be recorded (Render is pinned to 3.14.3).
Physical Android acceptance, isolated Atlas concurrency/failure/restore tests,
deployment provenance and public legal/support publication remain separate gates.
See README.md and frontend/DEPLOYMENT.md for staging and Android procedures.

The missing root deployment/validation files are now explicitly authored for this
release candidate under the user's authorization; they are not claimed as recovered
historical originals. No validation success is implied by their presence.
