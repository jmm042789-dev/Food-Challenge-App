# Fire Feast Backend Deployment

The backend validates configuration and MongoDB connectivity before it accepts
traffic. Configuration loads backend/.env automatically with override=False: existing
process environment values take precedence. Render sets PYTHON_DOTENV_DISABLED=1,
so no local environment file is loaded there. Staging additionally skips dotenv
unconditionally. Never commit or deploy real .env files.

## Required environment variables

These generic settings apply to existing non-staging deployments. The separate
staging deployment uses the dedicated inputs and guards documented below.

- `FIRE_FEAST_ENV`: `development`, `preview`, `production`, or `test`.
- `MONGO_URL`: a `mongodb://` or `mongodb+srv://` connection URI. Production
  rejects loopback hosts.
- `DB_NAME`: 1–64 letters, numbers, underscores, or hyphens.

Optional:

- `FIRE_FEAST_CORS_ORIGINS`: comma-separated browser origins. Production
  origins must use HTTPS. Native mobile API calls do not require CORS origins.
- `FIRE_FEAST_GUEST_RECOVERY_WINDOW_SECONDS`: bootstrap credential-recovery
  window from 60 to 3600 seconds. Defaults to 600 seconds.

Do not place credentials in source files, `.env.example`, logs, or command
arguments. Configure `MONGO_URL` through the hosting provider's secret store.

## Startup and shutdown

Startup validates configuration, connects to MongoDB, runs a ping, creates the
required unique indexes, and ensures the global settings document exists. Any
failure stops startup with a sanitized operational log.

Shutdown closes the MongoDB client and clears process-local matchmaking state.

## Health checks

- `GET /api/health/live` is process liveness. It does not access MongoDB and
  returns HTTP 200 with `status: alive` while FastAPI is running.
- `GET /api/health/ready` is deployment readiness. It performs a bounded,
  read-only MongoDB ping and returns HTTP 200 with `status: ready` only when
  MongoDB is usable. An uninitialized, timed-out, or unhealthy database returns
  HTTP 503 with `status: unavailable`.
- `GET /api/health` remains available for compatibility. Its healthy response
  remains `status: ok`, but it now follows readiness semantics and returns HTTP
  503 while MongoDB is unavailable.

The checked-in Render descriptor uses `/api/health/ready`, so Render receives
HTTP 200 only when the application can serve MongoDB-backed traffic. Liveness
remains available separately for diagnostics.

## Request correlation and logging

All API responses include `X-Request-ID`. Incoming values are preserved only
when they contain 16–64 lowercase hexadecimal characters; malformed or missing
values are replaced with a cryptographically random 32-character hexadecimal
ID. Search Render logs for `request_id=<value>` to correlate a tester report
with its completion and, for unexpected failures, sanitized error entry.

Completion logs contain request ID, method, safe route template or redacted
path, HTTP status, monotonic duration in milliseconds, and outcome category.
Health completions use debug level to limit noise. Unexpected errors record only
the request ID, method, safe route, category, and exception class. Logs exclude
headers, credentials, nonces, request/response bodies, cookies, arbitrary query
strings, database URLs, and raw exception messages.

During beta operations, manually count 5xx responses, readiness failures,
guest-bootstrap/recovery failures, match-settlement failures, daily-claim
failures, purchase failures, authentication failures, and high-latency requests.
The root README contains suggested review thresholds. They are not automated
alerts or dashboards.

Production mode disables OpenAPI/Swagger documentation and diagnostic routes.
The checked-in Render descriptor sets production mode and requires the dedicated
`STAGING_MONGO_URL` to be supplied as a secret. The staging descriptor uses dedicated STAGING_MONGO_URL/STAGING_MONGO_HOST
settings instead of MONGO_URL and explicitly sets DB_NAME to
fire_feast_staging and PYTHON_VERSION to the backend pin, 3.14.3. It runs one
instance/worker with automatic deploys disabled. It does not create resources
until a separately approved deployment. See the root README for staging setup.

## Validation

Run `scripts/validate.ps1` from the repository root for deterministic backend
and frontend validation. It does not contact MongoDB or a deployed API. Live API
and authenticated-session checks are isolated behind
`scripts/validate-integration.ps1`; configuration and expected skip behavior are
documented in the root README.

## Frontend

Set `EXPO_PUBLIC_BACKEND_URL` to the deployed API origin. Production Expo
builds reject missing or non-HTTPS backend URLs. Development builds may use a
reachable local or LAN URL supplied in the development process environment.
Environment templates were intentionally excluded from the preserved import.
The staging EAS profile is intentionally blocked by an empty backend URL; the
other profiles retain their production endpoint. Review and approve the isolated
staging origin before changing the staging profile.

## Isolated staging deployment (prepared, not provisioned)

The separate service is `fire-feast-api-staging`; this repository does not prove
that it or its database exists. Use a separate Atlas staging project/cluster,
not a production environment group or a copy of production database credentials.
Keep one Render instance and one Uvicorn worker. Automatic deployment is off.

Required provider inputs (never put secret values in commands, Git or reports):

| Setting | Source and requirement |
| --- | --- |
| STAGING_MONGO_URL | Secret: Atlas SRV URI for a unique staging-only user; database path must be `/fire_feast_staging`. Percent-encode credentials. Use verified TLS, retryWrites=true and w=majority. |
| STAGING_MONGO_HOST | Approved staging SRV hostname only, without scheme/path/port; review independently against Atlas, not by copying it blindly from the URI. Not a credential. |
| FIRE_FEAST_DEPLOYMENT | Blueprint fixes `staging`; do not remove. |
| FIRE_FEAST_ENV | Blueprint fixes `production` for secure runtime behavior, not production data. |
| DB_NAME | Blueprint fixes `fire_feast_staging`. |
| PYTHON_DOTENV_DISABLED | Blueprint fixes `1`; staging also skips dotenv loading unconditionally. |
| PYTHON_VERSION | Blueprint pins 3.14.3. |

No application signing secret or frontend bearer token is required for backend
startup. Render deploy authorization and Atlas administrative access belong in
their providers, not app environment variables. CORS is optional for native-only
acceptance; if web staging is used, approve explicit HTTPS browser origins.

The staging loader requires the dedicated URI and approved matching hostname,
SRV credentials, exact database path, and certificate-verified TLS. It ignores
an inherited generic MONGO_URL and rejects wrong DB_NAME, missing dedicated
settings and insecure TLS options before connecting. No database setting has a
staging fallback. Only standard Atlas connection options documented above plus
authSource/appName/readPreference/tls/ssl are accepted. This does not prove the
user's permissions or that an operator has selected the right cluster: independent
provider review is mandatory. Do not attach production/shared environment groups.

After separate deployment approval:

1. Review the exact source revision and paid Starter plan. Configure a separate
   Atlas project/cluster and user restricted to the staging database only. Verify
   that the user has no production roles/access. Record non-secret project/cluster
   IDs and the approved hostname. Configure restricted network access, backups,
   alerts and a staging restore drill. Never use real production player data.
2. Create the new Render service from the reviewed Blueprint, supply its dedicated
   secret/hostname through protected provider inputs, and inspect resolved settings.
   No generic MONGO_URL or production environment group should be attached.
   `sync:false` prompts at initial creation; updates require explicit dashboard
   management. Existing services are not retroactively made isolated by this file.
3. Confirm backend root, Python pin, build `pip install -r requirements.txt`, and
   start `uvicorn server:app --host 0.0.0.0 --port $PORT --workers 1`. This future
   build installs dependencies; no install or deployment was performed here.
4. Startup must validate before connecting, ping MongoDB, create unique indexes
   and initialize settings only in staging. Invalid settings, denied permissions
   or unavailable database must stop startup; never bypass validation or retry
   against production. Confirm sanitized logs without URI/credential values.
5. Record the actual provider-issued HTTPS origin; do not derive one from the
   service name. Verify ownership and no redirect to production. Read-only health
   checks: `/api/health/live` -> 200/alive; `/api/health/ready` -> 200/ready only
   with usable MongoDB; `/api/health` follows readiness. Readiness ping is bounded
   at 3000 ms. Do not deliberately interrupt any database without separate approval.
6. Independently inspect staging collections/indexes and account permissions.
   Use disposable staging accounts for separately authorized journey acceptance;
   health success alone does not prove isolation, settlement or persistence.
   Only then approve that origin for the fail-closed Android staging profile.

If verification fails, leave Android staging blocked and do not switch it to
production. Rollback means reverting the new staging service to a previously
reviewed staging revision or withholding traffic; never alter production or
reset/delete the database to make a check pass. Resource changes require approval.
