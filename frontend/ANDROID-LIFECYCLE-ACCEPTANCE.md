# Android lifecycle acceptance — OUTSTANDING

Assessment on 2026-10-25 found no usable Android test target: no adb.exe in the
checked standard C: SDK locations or C: PATH entries, no Android/ADB PnP device,
no adb/emulator/Android subsystem process, and no local ADB listener on port 5037.
This does not prove that no unrecognized or unauthorized physical device exists.
No SDK, emulator, dependency, application build or ADB server was installed/started.

Existing scripts use Expo SDK 54. `android` starts Expo with `--android`; it is not
an acceptance runner. The development, preview and production EAS profiles point
to the production backend. They were not launched for stateful acceptance. Native
acceptance needs an already available device, an identified installed candidate
build and an explicitly configured test/staging environment with test accounts.

## Local evidence

`tests/android-lifecycle-recovery.test.js` executes the actual AppState callback,
gameplay hook, persistence and input handling with mocked native events, transport,
storage and clocks. Process replacement creates a fresh module/hook state from
completed storage writes. Backend replay is production validation-v3 logic with
synthetic events, no network or live database.

Demonstrated fixes:

- Fresh-round interval callbacks previously subtracted one second after a long
  suspension. Fresh and resumed rounds now use fixed deadlines, and foreground
  synchronizes elapsed time and burnout before checking match identity.
- Foreground identity responses now have lifecycle-generation and unmount guards,
  so an obsolete response cannot invalidate another foreground cycle or screen.

Tests cover normal play, warning, active burnout, expired burnout, completion,
antacid eligibility, ordering, scores, deadline expiry, offline checks, persisted
process replacement and concurrent receipt recovery without duplicate submissions.
Mocked success does not establish Android Activity, timer, AsyncStorage, SecureStore
or process-kill durability acceptance. A kill before a storage write completes can
leave only the previous checkpoint; no test claims every accepted input survives
an arbitrary OS kill.

## Device procedure when an existing target becomes available

Record device/emulator model, Android version, app versionCode/source revision,
test backend and test-account identity without credentials. Confirm the installed
candidate contains these changes; an older APK cannot qualify the current source.
Use app-scoped actions only. Never clear application data or run an emulator/build
installation as part of this procedure.

| Phase | Background/foreground | Process termination and relaunch | Required evidence |
| --- | --- | --- | --- |
| Normal play | Leave for known elapsed intervals, including beyond match duration. | Terminate after a confirmed checkpoint. | Same match, ordered timestamps, no extra entry fee, no time extension. |
| Warning | Leave before cutoff; return before, during or after burnout. | Restart from a version-2 warning snapshot. | Original warning deadline, one eligible antacid save, no bonus scoring from recovery. |
| Active burnout | Return before and at lockout expiry. | Restart during the original lockout. | Input/antacid blocked until cutoff; no rejected action in official log. |
| Expired burnout | Return after lockout ends. | Restart after expiry. | Cooling applied once, normal eligibility, score agrees with backend replay. |
| Near match end | Suspend across the exact terminal deadline. | Relaunch after duration expires. | FINISHED, no revival or new accepted input. |
| Pending/accepted result | Background during a synthetic delayed/lost acknowledgement. | Terminate after server acceptance and before client acknowledgement. | Same immutable IDs/log/body; receipt lookup resolves outcome without another submission/reward. |

Repeat fast inactive/background/active transitions, offline foreground checks,
screen unmount/recreation and repeated recovery taps. Keep only concise phase,
elapsed-time, score, request-count and receipt evidence; do not collect credentials
or unbounded logcat dumps. Compare recorded events with backend replay.

With an authorized target, existing ADB may list devices and inspect the app without
changing data. Background can be triggered with `shell input keyevent KEYCODE_HOME`.
Process termination may use app-scoped `shell am force-stop com.firefeast.app` only
on the test account/build. Resolve the installed launcher activity and reopen it;
do not guess an activity, reinstall, uninstall or use `pm clear`.

Device acceptance remains OUTSTANDING until this matrix is executed and reviewed
on the matching installed candidate. No physical-device result is implied by mocks.
