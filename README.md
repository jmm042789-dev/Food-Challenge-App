# Fire Feast

Fire Feast is an Expo/React Native arcade game backed by FastAPI and MongoDB.

## Development validation

From the repository root, run the deterministic Closed Beta gate before every
commit:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate.ps1
```

The command runs, in order:

1. Backend pytest tests excluding the `integration` marker.
2. Every frontend `*.test.js` file through Node's built-in test discovery.
3. TypeScript strict checking.
4. ESLint.
5. `git diff --check`.
6. `git status --short`.

Each stage prints `PASS` or `FAIL`. The script prints `VALIDATION PASS` and
exits 0 only if every stage succeeds; otherwise it prints `VALIDATION FAIL` and
exits non-zero. Deterministic tests do not require a running API, MongoDB,
production credentials, or `EXPO_PUBLIC_BACKEND_URL`.

The frontend suite can also be run independently:

```powershell
cd frontend
npm test
```

`npm test` uses `node --test`, not a shell-expanded glob, so discovery behaves
consistently on Windows and Unix-like systems.

## Integration validation

Live integration is a separate, explicit gate. Configure all three variables
in the invoking environment:

- `FIRE_FEAST_RUN_INTEGRATION=1`
- `EXPO_PUBLIC_BACKEND_URL=https://your-beta-api.example`
- `FIRE_FEAST_INTEGRATION_AUTH_TOKEN=<test-guest-bearer-token>`

Then run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate-integration.ps1
```

The URL must identify a disposable integration environment because legacy live
flow tests create and update test players. The bearer token is used for the
read-only authenticated session check. Never use a production player token.

If opt-in, URL, or credential configuration is absent, the script prints
`SKIPPED` and exits 0 without making network calls. Once explicitly configured,
test failures produce `INTEGRATION VALIDATION FAIL` and a non-zero exit code;
they are never converted into skips.

## Release validation

For a Closed Beta candidate:

1. Run `scripts/validate.ps1` and require `VALIDATION PASS`.
2. Run `scripts/validate-integration.ps1` against the configured beta backend
   and require `INTEGRATION VALIDATION PASS` rather than `SKIPPED`.
3. Run the platform release/export checks required for the target build.

## Closed Beta request diagnostics

Every backend response includes `X-Request-ID`. The backend accepts an incoming
ID only when it is 16–64 lowercase hexadecimal characters; otherwise it creates
a cryptographically random 32-character hexadecimal ID. The frontend retains a
safe response ID on API errors for future support details and includes it in
development-only failure metadata. It is not prominently shown to players.

When a technical beta tester can capture an affected response or development
log, they should send support the request ID and approximate event time. A
support operator can search the Render service logs for `request_id=<value>` to
find the matching completion or sanitized error record.

Request logs contain only correlation ID, HTTP method, route template or
redacted path, status, duration, and outcome category. They never intentionally
contain authorization headers, bearer credentials, bootstrap/recovery secrets,
request or response bodies, cookies, arbitrary query strings, or database
connection details.

### Minimum operational review

Before and during Closed Beta, manually review Render logs for:

- HTTP 5xx responses;
- readiness failures;
- guest bootstrap and recovery failures;
- match-settlement failures;
- daily-reward claim failures;
- purchase failures;
- authentication failures; and
- high-latency requests.

No automated dashboard or alerting is currently configured. Practical manual
investigation thresholds are: any repeated readiness failure, any burst of five
5xx responses in ten minutes, a 5xx rate near one percent over fifteen minutes,
five repeated failures for one sensitive route in ten minutes, or normal API
requests repeatedly exceeding one second. These are review guidelines, not
configured alerts.

## Troubleshooting

- If Python or pytest cannot be found, create the documented backend virtual
  environment and install the dependencies declared by
  `backend/requirements-test.txt`.
- If frontend commands are missing, restore the repository's locked Node
  dependencies. The validation scripts never install dependencies.
- ESLint warnings are displayed but only its exit code determines pass/fail.
- `git status` is always printed so uncommitted files remain visible; command
  failure, rather than a non-empty status, fails that stage.
- A live gate that prints `SKIPPED` was not exercised and must not be reported
  as an integration success.
