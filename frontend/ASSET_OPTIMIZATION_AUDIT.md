# G5.4.5 Asset Optimization Audit

Audit date: 2026-07-22

Scope: `assets/**`, `src/assets/**`, all image references in `app/**` and `src/**`, and Expo configuration in `app.json`, `app.config.js`, `eas.json`, and `package.json`.

## Measurement baseline and result

- Image files before and after: 68 files, 115,993,724 bytes (unchanged).
- All files under `assets/**` and `src/assets/**` before: 74 files, 178,850,588 bytes.
- All files under `assets/**` and `src/assets/**` after: 73 files, 116,158,837 bytes.
- Removed: `src/assets/ui.zip`, 62,691,751 bytes (35.05% of the full asset-tree baseline).
- Verification: all 37 files in the archive exactly matched the extracted `src/assets/ui/**` files by SHA-256, and repository search found no reference to the archive (only its `.gitignore` entry).
- Image compression tooling: ImageMagick, optipng, pngquant, cwebp, and ffmpeg are unavailable. No dependency was installed. Conservative source-image re-encoding was therefore not attempted.

Transparency means at least one source pixel has alpha below 255; it does not infer transparency from the PNG container. Several game assets visually contain a checkerboard but are actually opaque.

## Image inventory

Display sizes are React Native density-independent layout pixels inferred from styles. `Responsive` means the image covers a viewport or is derived from runtime layout. “Unused” means no filename reference was found in application/configuration code.

| Path | Type | Pixels | Bytes | Alpha | Group | Usage / approximate display | Unused | Recommendation |
|---|---:|---:|---:|:---:|---|---|:---:|---|
| `assets/images/adaptive-icon.png` | PNG | 512x513 | 255,372 | Yes | 10. Unused/duplicate | Exact duplicate of favicon; not configured | Yes | Remove in a later cleanup if legacy-template support is not needed |
| `assets/images/app-image.png` | PNG | 336x729 | 118,129 | Yes | 10. Unused/duplicate | Exact duplicate of splash-image; not configured | Yes | Remove in a later cleanup if legacy-template support is not needed |
| `assets/images/favicon.png` | PNG | 512x513 | 255,372 | Yes | 2. App/store branding | `app.json` web favicon; browser-controlled | No | Preserve |
| `assets/images/icon.png` | PNG | 512x513 | 255,372 | Yes | 10. Unused/duplicate | Exact duplicate of favicon; not configured | Yes | Remove in a later cleanup if legacy-template support is not needed |
| `assets/images/partial-react-logo.png` | PNG | 518x316 | 5,075 | Yes | 10. Unused/duplicate | Expo template remnant | Yes | Remove in a dedicated cleanup |
| `assets/images/react-logo.png` | PNG | 100x100 | 6,341 | Yes | 10. Unused/duplicate | Expo template remnant | Yes | Remove in a dedicated cleanup |
| `assets/images/react-logo@2x.png` | PNG | 200x200 | 14,225 | Yes | 10. Unused/duplicate | Expo template remnant | Yes | Remove in a dedicated cleanup |
| `assets/images/react-logo@3x.png` | PNG | 300x300 | 21,252 | Yes | 10. Unused/duplicate | Expo template remnant | Yes | Remove in a dedicated cleanup |
| `assets/images/splash-image.png` | PNG | 336x729 | 118,129 | Yes | 10. Unused/duplicate | Exact duplicate of app-image; not configured | Yes | Preserve until legacy usage is confirmed unnecessary |
| `src/assets/backgrounds/arena.png` | PNG | 1536x1024 | 2,349,623 | No | 1. Full-screen background | `FireArenaBackground`; full viewport, cover | No | Preserve full-screen quality |
| `src/assets/backgrounds/main-lobby.png` | PNG | 1024x1536 | 2,237,879 | No | 10. Unused/duplicate | No code/config reference | Yes | Candidate removal after product confirmation |
| `src/assets/backgrounds/splash-screen.png` | PNG | 1024x1536 | 2,417,384 | No | 2. App/store branding | Expo splash, configured at imageWidth 260 | No | Intentionally preserve |
| `src/assets/characters/blaze.png` | PNG | 1270x1239 | 2,181,657 | No | 3. Large character/food | Profile 144x144; cards 64x64; portraits responsive | No | Intentionally preserve Blaze artwork |
| `src/assets/food/bbq-platter.png` | PNG | 1254x1254 | 2,963,328 | No | 10. Unused/duplicate | Not present in food artwork mapping | Yes | Candidate removal after catalog/product confirmation |
| `src/assets/food/burger-deluxe.png` | PNG | 1254x1254 | 2,508,181 | No | 3. Large character/food | Home 58/205; countdown 190x170; gameplay up to ~285 | No | Intentionally preserve hero food |
| `src/assets/food/dessert.png` | PNG | 1254x1254 | 2,563,995 | No | 3. Large character/food | Home 58/205; countdown 190x170; gameplay up to ~285 | No | Intentionally preserve hero food |
| `src/assets/food/hot-dog.png` | PNG | 1254x1254 | 2,019,984 | No | 3. Large character/food | Home 58/205; countdown 190x170; gameplay up to ~285 | No | Intentionally preserve hero food |
| `src/assets/food/pastrami-sandwich.png` | PNG | 1254x1254 | 2,435,310 | No | 3. Large character/food | Home 58/205; countdown 190x170; gameplay up to ~285 | No | Intentionally preserve hero food |
| `src/assets/food/pizza-pepperoni.png` | PNG | 1254x1254 | 2,889,078 | No | 3. Large character/food | Home 58/205; countdown 190x170; gameplay up to ~285 | No | Intentionally preserve hero food |
| `src/assets/food/wings.png` | PNG | 1254x1254 | 2,491,652 | No | 3. Large character/food | Home 58/205; countdown 190x170; gameplay up to ~285 | No | Intentionally preserve hero food |
| `src/assets/icons/antacid.png` | PNG | 1254x1254 | 1,888,895 | No | 6. Icon | Shop/profile 22–23; welcome 34 | No | High-impact resize candidate (192–256 max); needs proper optimizer |
| `src/assets/icons/boost.png` | PNG | 1254x1254 | 1,696,374 | No | 10. Unused/duplicate | No reference | Yes | Candidate removal after product confirmation |
| `src/assets/icons/coin.png` | PNG | 1254x1254 | 2,164,130 | No | 6. Icon | Repeated across headers/shop/cards at 12–34 | No | Highest-frequency resize candidate (192–256 max); needs proper optimizer |
| `src/assets/icons/rank-badge.png` | PNG | 1254x1254 | 2,089,631 | No | 10. Unused/duplicate | No reference | Yes | Candidate removal after product confirmation |
| `src/assets/icons/trophy.png` | PNG | 1254x1254 | 1,811,260 | No | 6. Icon | Result emblem 58x58 | No | Safe resize candidate around 256 max |
| `src/assets/icons/win-streak.png` | PNG | 1024x1024 | 1,877,504 | Yes | 6. Icon | Reward row 22x22 | No | Safe resize candidate around 192 max; preserve alpha |
| `src/assets/icons/xp-crystal.png` | PNG | 1024x1536 | 3,109,091 | Yes | 6. Icon | Welcome 34; reward row 22 | No | High-impact resize candidate, max dimension ~256; preserve alpha |
| `src/assets/logo/app-icon.png` | PNG | 1254x1254 | 2,405,314 | No | 2. App/store branding | iOS icon and Android adaptive foreground | No | Intentionally preserve; note adaptive foreground is opaque |
| `src/assets/logo/fire-feast-logo-compact.png` | PNG | 1254x1254 | 1,881,744 | No | 10. Unused/duplicate | No reference | Yes | Preserve branding; review later |
| `src/assets/logo/fire-feast-logo-horizontal.png` | PNG | 1536x1024 | 2,241,263 | Yes | 10. Unused/duplicate | No reference | Yes | Preserve branding; review later |
| `src/assets/logo/fire-feast-logo-primary.png` | PNG | 1536x1024 | 2,111,686 | No | 2. App/store branding | Headers about 180x86 and 115 high | No | Intentionally preserve logo |
| `src/assets/ui/button-primary.png` | PNG | 1536x1024 | 2,386,917 | Yes | 10. Unused/duplicate | No reference | Yes | Candidate removal after UI-set confirmation |
| `src/assets/ui/button-secondary.png` | PNG | 1536x1024 | 1,871,528 | No | 10. Unused/duplicate | No reference | Yes | Candidate removal after UI-set confirmation |
| `src/assets/ui/card-frame.png` | PNG | 1536x1024 | 2,349,406 | No | 10. Unused/duplicate | No reference | Yes | Candidate removal after UI-set confirmation |
| `src/assets/ui/coin-bar-v2.png` | PNG | 1536x1024 | 2,475,574 | Yes | 5. HUD component | `ArcadeHeader` stretched to responsive width x72 | No | Candidate density-aware resize after visual device testing |
| `src/assets/ui/loading-bar.png` | PNG | 1774x887 | 1,346,812 | No | 10. Unused/duplicate | No reference | Yes | Candidate removal after UI-set confirmation |
| `src/assets/ui/notification-banner.png` | PNG | 1893x831 | 1,440,746 | No | 10. Unused/duplicate | No reference | Yes | Candidate removal after UI-set confirmation |
| `src/assets/ui/panel.png` | PNG | 1536x1024 | 1,823,784 | No | 10. Unused/duplicate | No reference | Yes | Candidate removal after UI-set confirmation |
| `src/assets/ui/popup-window.png` | PNG | 1536x1024 | 1,754,490 | No | 10. Unused/duplicate | No reference | Yes | Candidate removal after UI-set confirmation |
| `src/assets/ui/shop-panel.png` | PNG | 1536x1024 | 2,112,987 | No | 10. Unused/duplicate | No reference | Yes | Candidate removal after UI-set confirmation |
| `src/assets/ui/xp-bar-v2.png` | PNG | 1774x887 | 1,488,353 | No | 5. HUD component | `ArcadeHeader` stretched to responsive width x88 | No | Candidate density-aware resize after visual device testing |
| `src/assets/ui/animations/button-click-ring.png` | PNG | 1254x1254 | 1,363,809 | No | 9. Animation overlay | Every FireButton press at 88x88; gameplay impact scales dynamically | No | High-frequency resize candidate around 384–512 |
| `src/assets/ui/animations/button-pop.png` | PNG | 1254x1254 | 1,445,613 | No | 10. Unused/duplicate | No reference | Yes | Candidate removal after UI-set confirmation |
| `src/assets/ui/animations/button-press-glow.png` | PNG | 1254x1254 | 1,068,599 | No | 10. Unused/duplicate | No reference | Yes | Candidate removal after UI-set confirmation |
| `src/assets/ui/effects/coin-burst.png` | PNG | 1254x1254 | 1,994,418 | No | 10. Unused/duplicate | No image reference; bursts are code-rendered | Yes | Candidate removal after effects-set confirmation |
| `src/assets/ui/effects/combo-explosion.png` | PNG | 1254x1254 | 2,182,693 | No | 7. Particle/effect | Gameplay/result impact, generally ~126–285 | No | Resize candidate around 720 max |
| `src/assets/ui/effects/confetti.png` | PNG | 1536x1024 | 1,535,750 | No | 10. Unused/duplicate | No image reference; victory burst is code-rendered | Yes | Candidate removal after effects-set confirmation |
| `src/assets/ui/effects/embers-particle.png` | PNG | 1536x1024 | 1,247,501 | No | 10. Unused/duplicate | No image reference; embers are code-rendered | Yes | Candidate removal after effects-set confirmation |
| `src/assets/ui/effects/fire-burst.png` | PNG | 1254x1254 | 1,959,739 | No | 7. Particle/effect | Warning impact, dynamic ~100–285 | No | Resize candidate around 720 max |
| `src/assets/ui/effects/screen-flash.png` | PNG | 1536x1024 | 1,277,777 | No | 10. Unused/duplicate | Screen flash is code-rendered | Yes | Candidate removal after effects-set confirmation |
| `src/assets/ui/effects/smoke-puff.png` | PNG | 1536x1024 | 1,373,207 | No | 7. Particle/effect | Two continuous arena layers at 290x190 | No | High-frequency resize candidate around 720–900 wide |
| `src/assets/ui/effects/sparkle.png` | PNG | 1536x1024 | 1,486,928 | No | 7. Particle/effect | Completion impact, generally 76–285 | No | Resize candidate around 720 max |
| `src/assets/ui/effects/speed-lines.png` | PNG | 1774x887 | 2,062,139 | No | 10. Unused/duplicate | Speed overlays are code-rendered | Yes | Candidate removal after effects-set confirmation |
| `src/assets/ui/effects/xp-burst.png` | PNG | 1254x1254 | 1,865,020 | No | 10. Unused/duplicate | XP burst is code-rendered | Yes | Candidate removal after effects-set confirmation |
| `src/assets/ui/hud/belly-meter.png` | PNG | 1866x843 | 1,383,239 | No | 10. Unused/duplicate | No reference | Yes | Candidate removal after HUD-set confirmation |
| `src/assets/ui/hud/combo-meter.png` | PNG | 1774x887 | 1,512,158 | No | 10. Unused/duplicate | HUD meter is code-rendered | Yes | Candidate removal after HUD-set confirmation |
| `src/assets/ui/hud/heartburn-meter.png` | PNG | 1942x809 | 1,435,201 | No | 5. HUD component | Heartburn heading icon 16x16 | No | Extreme oversize; resize candidate ~128–192, but inspect baked background |
| `src/assets/ui/hud/opponent-panel.png` | PNG | 1761x893 | 1,501,789 | No | 10. Unused/duplicate | No reference | Yes | Candidate removal after HUD-set confirmation |
| `src/assets/ui/hud/player-panel.png` | PNG | 1967x799 | 1,697,249 | No | 10. Unused/duplicate | No reference | Yes | Candidate removal after HUD-set confirmation |
| `src/assets/ui/hud/score-panel.png` | PNG | 1885x834 | 1,742,836 | No | 10. Unused/duplicate | No reference | Yes | Candidate removal after HUD-set confirmation |
| `src/assets/ui/hud/streak-meter.png` | PNG | 1942x809 | 1,707,222 | No | 10. Unused/duplicate | No reference | Yes | Candidate removal after HUD-set confirmation |
| `src/assets/ui/hud/time-frame.png` | PNG | 1774x887 | 1,418,456 | No | 10. Unused/duplicate | No reference | Yes | Candidate removal after HUD-set confirmation |
| `src/assets/ui/toasts/toast-achievement.png` | PNG | 1536x1024 | 2,365,984 | Yes | 8. Toast | No reference; current banners are code-rendered | Yes | Candidate removal after toast-set confirmation |
| `src/assets/ui/toasts/toast-antacid.png` | PNG | 1536x1024 | 2,375,817 | Yes | 8. Toast | No reference | Yes | Candidate removal after toast-set confirmation |
| `src/assets/ui/toasts/toast-chest.png` | PNG | 1536x1024 | 1,545,042 | No | 8. Toast | No reference | Yes | Candidate removal after toast-set confirmation |
| `src/assets/ui/toasts/toast-combo.png` | PNG | 1536x1024 | 1,254,181 | No | 8. Toast | No reference | Yes | Candidate removal after toast-set confirmation |
| `src/assets/ui/toasts/toast-xp.png` | PNG | 1536x1024 | 2,420,996 | Yes | 8. Toast | No reference | Yes | Candidate removal after toast-set confirmation |
| `src/assets/ui/toasts/toasts-coins.png` | PNG | 1536x1024 | 2,335,534 | Yes | 8. Toast | No reference | Yes | Candidate removal after toast-set confirmation |

## Non-image asset inventory

Pixel dimensions and transparency do not apply to these formats.

| Path | Type | Bytes | Usage | Unused | Recommendation |
|---|---:|---:|---|:---:|---|
| `assets/fonts/SpaceMono-Regular.ttf` | TTF | 93,252 | Loaded by app layout / Expo font | No | Preserve |
| `assets/sounds/tap.mp3` | MP3 | 4,272 | AudioRegistry tap sound | No | Preserve |
| `assets/sounds/combo.mp3` | MP3 | 33,196 | AudioRegistry combo sound | No | Preserve |
| `assets/sounds/start.mp3` | MP3 | 33,481 | AudioRegistry start sound | No | Preserve |
| `src/assets/foodArtwork.ts` | TypeScript registry | 912 | Maps contest IDs to food images | No | Preserve |
| `src/assets/ui.zip` (removed) | ZIP | 62,691,751 | No runtime/config reference; exact copies of 37 extracted UI images | Yes | Removed as redundant source archive |

## Safety conclusions

- No image filenames or code references changed.
- No PNG was converted, so there is no format-compatibility or alpha-loss risk.
- No icon, adaptive icon, splash image, Fire Feast logo, full-screen background, hero food, or Blaze artwork was modified.
- The largest current image assets remain `xp-crystal.png` (3,109,091 bytes), `bbq-platter.png` (2,963,328), `pizza-pepperoni.png` (2,889,078), `dessert.png` (2,563,995), and `burger-deluxe.png` (2,508,181).
- The next best safe optimization pass requires a real lossless PNG optimizer and visual/device comparison. Priority should be coin, antacid, XP crystal, trophy, win-streak, button-click-ring, heartburn-meter, smoke-puff, and the three impact textures.
