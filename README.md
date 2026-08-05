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
