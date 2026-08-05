# Fire Feast Android Release Guide

This guide covers preparation for Google Play Internal Testing and Closed Beta. It does not authorize publishing, submission, or credential creation.

## Current Android release configuration

- App name: `Fire Feast`
- Android application ID: `com.firefeast.app`
- Expo version: `1.0.0`
- Android versionCode: `1`
- EAS project ID: `3c106538-aa48-4dc2-8100-72fce495be7b`
- Native project: managed Expo workflow; no committed `android/` directory
- Production artifact: Android App Bundle (`.aab`)
- Production API: `EXPO_PUBLIC_BACKEND_URL`, currently set by the EAS production profile to `https://firefeast-backend.onrender.com`

The production profile must keep an HTTPS API URL. `app.config.js` rejects a production build when the variable is absent, invalid, or not HTTPS. Never put localhost, loopback, emulator-only hosts, or private LAN addresses in the production profile. Development host discovery and the development profile are independent and must remain available for local work.

## Build commands

Run the production Android build without submitting it:

```bash
eas build --platform android --profile production
```

This same AAB is the candidate uploaded manually to Google Play Internal Testing. After it passes the internal checklist, promote that tested release to the Closed Testing track in Play Console; do not rebuild between tracks unless the binary or configuration changes.

Before a remote build, verify the resolved configuration locally:

```powershell
$env:EAS_BUILD_PROFILE='production'
$env:EXPO_PUBLIC_BACKEND_URL='https://firefeast-backend.onrender.com'
npx expo config --type public
```

On macOS/Linux, use equivalent inline environment assignments. Confirm the documented endpoint remains the intended production service before every release.

## Version policy

- Increase the Expo semantic `version` in `app.json` for every user-visible release. Keep `package.json` at the same version.
- Increase `android.versionCode` for every AAB uploaded to Play Console, including replacements for failed or rejected builds. It must always be a previously unused, strictly increasing integer.
- Because `eas.json` uses `appVersionSource: local`, version and versionCode changes must be committed before building. EAS will not increment them remotely.
- Record the version, versionCode, commit SHA, EAS build ID, and Play track in the release notes.

## Required environment

| Variable | Required | Release rule |
| --- | --- | --- |
| `EXPO_PUBLIC_BACKEND_URL` | Yes | Absolute production `https://` URL; never localhost, loopback, emulator-only, or private LAN. |
| `EAS_BUILD_PROFILE` | Set by EAS | Must resolve to `production` for the release build so HTTPS validation is enforced. |

The production backend URL is public application configuration, not a secret. Keep credentials and secrets out of tracked files; configure future secrets through approved EAS environment/secret management. `.env` is local and ignored, while `.env.example` documents development behavior.

## Assets

The release configuration references these tracked files:

- App icon and adaptive icon foreground: `src/assets/logo/app-icon.png`
- Splash image: `src/assets/backgrounds/splash-screen.png`
- Web favicon: `assets/images/favicon.png`
- Adaptive icon background: `#070405`
- Notification icon: not configured because the current app has no notification feature

Do not regenerate or replace release artwork during release preparation. Recheck that every path resolves and inspect the generated launcher icon and splash screen on a physical Android device before upload.

## Android permissions

The managed build derives permissions from Expo modules. Current expected permissions are:

- `android.permission.INTERNET`: required for guest bootstrap and online backend APIs.
- `android.permission.MODIFY_AUDIO_SETTINGS`: added by `expo-audio` and required for game audio behavior.
- `android.permission.VIBRATE`: added by `expo-haptics` and required for optional haptic feedback.

Microphone recording is explicitly disabled in the `expo-audio` plugin configuration, so `RECORD_AUDIO` is not expected. Notifications are not configured, so notification and foreground microphone service permissions are not expected. Compare the final AAB manifest in Play Console against this list; investigate any additional permission before rollout.

## Public legal and support configuration

- Publish the privacy policy at https://firefeastgame.com/privacy and use that exact URL in Play Console.
- Verify `support@firefeastgame.com` can receive and reply to messages before inviting testers.
- Publish the Terms of Service and Gameplay & Health Disclaimer on `firefeastgame.com`, and verify the in-app Settings legal pages match the published text.
- Confirm all public legal pages work without authentication, private-host redirects, or certificate warnings.

## Play Console preparation

- [ ] Confirm the Play Console app uses package ID `com.firefeast.app`; this ID cannot be changed after first upload.
- [ ] Confirm app name, default language, category, contact details, and store listing are accurate.
- [ ] Upload the tested `.aab` only to Internal Testing first.
- [ ] Complete App access instructions for guest bootstrap and any gated flows.
- [ ] Review the Data Safety form against the shipping binary, backend, hosting, and data practices.
- [ ] Enter https://firefeastgame.com/privacy as the Play privacy policy URL and verify it is publicly reachable.
- [ ] Publish and verify the Terms of Service and Gameplay & Health Disclaimer.
- [ ] Verify the support mailbox and store-listing contact information.
- [ ] Complete content rating, target audience, ads declaration, and all other required policy declarations.
- [ ] Review Play Console's generated permission list and explain every permission.
- [ ] Add only approved tester accounts or groups and record the opt-in URL.
- [ ] Prepare release notes that identify the version and beta scope.

## Internal Testing checklist

Record device model, Android version, app version/versionCode, network condition, account state, result, and issue link for each run.

### Installation and lifecycle

- [ ] Cold install from the Play Internal Testing track; launch with no prior app data.
- [ ] Upgrade install over the immediately previous Play-delivered build; confirm guest state and settings persist.
- [ ] Background and foreground during menus, matchmaking, active play, and results; confirm timers, audio, and state resume safely.
- [ ] Force-stop and relaunch after a normal screen and during recovery from a failed request.
- [ ] Crash recovery: relaunch after a controlled test crash or OS process termination and confirm no boot loop or corrupted state.

### Account and core flow

- [ ] Guest bootstrap succeeds on first launch and does not create duplicate guests on relaunch.
- [ ] Complete match play from contest selection through results and persisted progress.
- [ ] Enter an eligible contest; verify entry state, virtual coin handling, and duplicate-tap protection against the approved baseline.
- [ ] Exercise all current virtual purchase flows; verify inventory/balance persistence and duplicate-request handling. Confirm no real-money checkout is presented.
- [ ] Claim daily rewards on eligible and already-claimed paths.
- [ ] Claim the welcome pack once and confirm it cannot be claimed twice.
- [ ] Trigger overheating and confirm presentation, controls, and recovery.
- [ ] Use Antacids when eligible and verify balance/state consistency.
- [ ] Test level progression, unlocks, and persisted XP without changing Level 2.5 validation.
- [ ] Delete the guest account from Profile > Account & Data; confirm server success, local credential cleanup, and fresh bootstrap afterward.

### Connectivity and resilience

- [ ] Launch offline and verify a clear, recoverable error state.
- [ ] Lose connectivity in menus and during each network-backed flow; confirm no duplicate entry, purchase, reward, or settlement.
- [ ] Restore connectivity without restarting and verify retry/network recovery.
- [ ] Test slow and intermittent connections for usable loading states and request timeouts.

### Accessibility and layouts

- [ ] Enable in-app Reduced Motion and verify supported motion/camera effects are minimized.
- [ ] Enable in-app Large Text and Android font scaling; check clipping, overlap, and touch targets.
- [ ] Test the smallest supported phone viewport and a narrow device with display scaling.
- [ ] Test a supported Android tablet; verify safe areas, maximum widths, orientation behavior, and readable controls.
- [ ] Verify screen-reader labels and focus on primary actions, settings, and destructive account deletion confirmation.

### Settings, legal, and support

- [ ] Verify Privacy Policy, Terms of Service, and Gameplay & Health Disclaimer open and render completely in Settings.
- [ ] Verify the published privacy page at https://firefeastgame.com/privacy from the test device.
- [ ] Verify website, support email, and bug-report links; send and receive a support test message.
- [ ] Verify version and build number shown in Settings match the installed AAB.

### Device health

- [ ] Play repeated matches and navigate all major screens while monitoring performance, crashes, ANRs, and severe frame drops.
- [ ] Run a sustained play session and check battery drain and device temperature for unexpected regressions.
- [ ] Monitor memory during repeated matches, background/foreground cycles, and asset-heavy screens; confirm no unbounded growth or OS kills.
- [ ] Review Play pre-launch report, Android vitals, crash reports, and ANRs before promotion.

## Closed Beta checklist and testing sequence

1. Freeze the candidate commit and increment version/versionCode as required.
2. Run TypeScript, ESLint, relevant tests, Expo web export, `git diff --check`, and `git status --short`.
3. Inspect the resolved production Expo/EAS configuration; confirm the HTTPS API and release identifiers.
4. Build the production AAB with EAS. Do not submit automatically and do not create credentials without the release owner's approval.
5. Upload manually to Internal Testing, complete Play declarations, and invite a small internal group.
6. Complete every applicable Internal Testing check above on representative supported devices and review Play's pre-launch report.
7. Fix blockers with a new versionCode and repeat Internal Testing; never replace evidence with a locally sideloaded APK.
8. Promote the exact tested release to Closed Testing, add the approved tester cohort, and verify the opt-in experience.
9. Monitor feedback, backend health, crashes, ANRs, performance, battery, and memory throughout the beta.

## Rollback guidance

Google Play does not permit reusing an older versionCode as a new upload. If a beta release is unsafe, halt or reduce the affected track rollout in Play Console when available, remove new tester access if necessary, and communicate the incident. Fix forward from the last known-good source with a newly incremented versionCode, build a new AAB, and repeat Internal Testing before returning it to Closed Testing. Coordinate backend rollback separately and only when its API contract remains compatible with installed clients. Preserve the failed build, logs, commit SHA, and incident notes.

## Release-owner manual gates

Before any Play submission, the release owner must confirm the production backend and public legal pages are operational, EAS and Play authentication is valid, Android signing credentials already exist and are controlled appropriately, all Play policy forms are accurate, and the tested AAB is the artifact being uploaded. Never create credentials, submit, publish, or promote solely by following this document.
