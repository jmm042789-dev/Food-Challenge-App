# Isolated native Avatar V5 proof host

This separate development host reuses FlattenedStandardProof and the real AvatarV5Renderer.
It validates only the approved flattened composite and renderer lifecycle. It does not
establish 14-pass layered artwork completion, independent modesty coverage, tint or
wardrobe customization, equipment rendering, persistence, or production integration.
The existing PNG and production entry/configuration remain unchanged.

## Launch

Use the existing frontend node_modules; do not install in this directory.
From C:\FireFeast-Recovery\Frontend-Preservation-20261005:

```powershell
Set-Location tools/avatar-v5-preview
$env:EXPO_NO_TYPESCRIPT_SETUP = '1'
node ../../node_modules/expo/bin/cli start --offline --port 8082
```

The preview owns its entry and Expo identity. It does not launch Expo Router or the game.
For an Android device connected with USB debugging and an already available compatible
Expo Go runtime, forward port 8082 with `adb reverse tcp:8082 tcp:8082`, then open
`exp://127.0.0.1:8082` in Expo Go. Device availability and compatibility must be checked
manually; this procedure does not authorize installing software or building an app.
Stop the development server with Ctrl+C. No production build, EAS or deployment is needed.

Verified locally: Expo public config resolves the separate preview identity; Metro starts with the command above (CI=1 was also used during automated verification); /status reports running; the Android development bundle returns HTTP 200 and contains the preview and existing proof. Automatic TypeScript setup is disabled to avoid generating a host tsconfig. Remove CI from your environment for interactive watch/reload mode. The server was stopped after verification. USB forwarding and physical-device rendering have not been verified.
Physical-device acceptance is PENDING. A successful bundle is not device acceptance.

## Physical-device acceptance checklist

- [ ] Approved Average-Joe visual matches the canonical artwork.
- [ ] Entire character, head and feet/sole remain visible and uncropped.
- [ ] Genuine transparency; no baked checkerboard or background.
- [ ] Correct proportions; no stretching or squashing.
- [ ] Centered framing and expected authored padding.
- [ ] Light and dark backgrounds both display correctly.
- [ ] Every size (128, 192, 256 logical display units) remains square and usable.
- [ ] Native image load completes and replaces the complete fallback panel.
- [ ] Observe loading fallback if visible; mark unobserved if too brief.
- [ ] Error fallback only if safely demonstrable without altering source/artwork;
      otherwise record not manually demonstrated (automated error tests remain required).
- [ ] Remount control creates a fresh instance; no stale image or unexpected flicker.
- [ ] All controls are usable, including with large text and screen-reader navigation.
- [ ] Button roles, labels and selected states are announced appropriately.
- [ ] No production navigation, authentication or game UI appears.

Record device/OS/runtime, commit, date, each result and any issue when manually tested.
Controls affect in-memory presentation only. They do not select or save an appearance.
