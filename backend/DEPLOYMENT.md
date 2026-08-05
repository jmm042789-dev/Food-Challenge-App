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
The `/api/health` endpoint reports `ok` only while MongoDB responds.

Production mode disables OpenAPI/Swagger documentation and diagnostic routes.
The checked-in Render descriptor sets production mode and requires `MONGO_URL`
to be supplied as a secret.

## Frontend

Set `EXPO_PUBLIC_BACKEND_URL` to the deployed API origin. Production Expo
builds reject missing or non-HTTPS backend URLs. Development builds may use a
reachable local or LAN URL as documented in `frontend/.env.example`.
