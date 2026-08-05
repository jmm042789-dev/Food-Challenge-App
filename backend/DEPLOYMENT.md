# Fire Feast Backend Deployment

The backend validates configuration and MongoDB connectivity before it accepts
traffic. It does not load `.env` files automatically.

## Required environment variables

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

Production mode disables OpenAPI/Swagger documentation and diagnostic routes.
The checked-in Render descriptor sets production mode and requires `MONGO_URL`
to be supplied as a secret.

## Validation

Run `scripts/validate.ps1` from the repository root for deterministic backend
and frontend validation. It does not contact MongoDB or a deployed API. Live API
and authenticated-session checks are isolated behind
`scripts/validate-integration.ps1`; configuration and expected skip behavior are
documented in the root README.

## Frontend

Set `EXPO_PUBLIC_BACKEND_URL` to the deployed API origin. Production Expo
builds reject missing or non-HTTPS backend URLs. Development builds may use a
reachable local or LAN URL as documented in `frontend/.env.example`.
