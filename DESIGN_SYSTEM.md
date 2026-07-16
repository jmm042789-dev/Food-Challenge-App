# Design System

## Brand Identity
- App name: Chomp Champs
- Tone: Dark-first utility arcade with a loud competitive sports edge.
- Personality: Fast, punchy, and visceral.
- Display typography: `Bebas Neue` for headings, scores, and metrics.
- Body typography: `DM Sans` for labels, copy, and secondary text.

## Color Tokens
- `surface`: #0F1115
- `onSurface`: #FFFFFF
- `surfaceSecondary`: #1C1F26
- `onSurfaceSecondary`: #D1D5DB
- `surfaceTertiary`: #2A2E39
- `onSurfaceTertiary`: #A1A8B5
- `surfaceInverse`: #F3F4F6
- `onSurfaceInverse`: #0F1115
- `brand`: #FF2A00
- `brandPrimary`: #FF2A00
- `onBrandPrimary`: #FFFFFF
- `brandSecondary`: #FFB800
- `onBrandSecondary`: #0F1115
- `brandTertiary`: #E05A00
- `onBrandTertiary`: #FFFFFF
- `success`: #39FF14
- `onSuccess`: #000000
- `warning`: #FFB800
- `onWarning`: #0F1115
- `error`: #FF2A00
- `onError`: #FFFFFF
- `info`: #F3F4F6
- `onInfo`: #0F1115
- `border`: #2A2E39
- `borderStrong`: #4B5563
- `divider`: #1C1F26

## Typography Scale
- `sm`: 12
- `base`: 14
- `lg`: 16
- `xl`: 20
- `2xl`: 24
- `3xl`: 48

## Spacing
- `xs`: 4
- `sm`: 8
- `md`: 12
- `lg`: 16
- `xl`: 24
- `2xl`: 32
- `3xl`: 48
- Rule: Tight spacing for HUD metrics; generous padding for primary actions and safe-area clearance.

## Corner Radius
- `sm`: 6
- `md`: 12
- `lg`: 20
- `pill`: 999

## Shadows & Elevation
- Current token: `shadow_tier`: 0
- Use subtle surface separation rather than heavy drop shadows.

## Motion & Animation
- Use expressive, high-impact motion for key events:
  - `usePulse` for active meters and combo emphasis
  - `useSlideUp` for entrance reveals and burst animations
  - `useScalePop` for tap response and reward pop
  - `useFloating` for slow rising card motion
  - `useSquashBounce` for tactile object presses
  - `useScreenFlash` for celebration or damage feedback
  - `useScreenShake` for strong combo or hit impacts
- Motion should feel crisp and supportive without distracting from gameplay.

## Layout Guidelines
- Backgrounds: dark, high-contrast surfaces with strong edges.
- Cards: solid `surfaceSecondary` backgrounds, minimal blur.
- Buttons: bold brandPrimary / brandSecondary fills with pill-shaped corners.
- Contest hero panels: high-impact imagery with scrim overlay for readability.
- Live gameplay HUD: compact top/bottom stacks, center tap area, and visible opposing progress.
- Avoid glassmorphism and blur effects to preserve performance.

## Screen Patterns
- Home Lobby:
  - Header with player level and progress.
  - Featured contest hero panel with bright CTA.
  - Progress and goals sections below.
- Play Screen:
  - Countdown overlay when match starts.
  - Full-screen arena tap zone.
  - Persistent HUD showing score, time, combo, and opponent.
  - Victory/defeat celebration layered over gameplay.
- Shop / Leaderboard / Profile:
  - List-based content with strong surface hierarchy.
  - Badges and stat panels that use the arcade brand palette.

## Component Usage
- Use `FireHeader` for top-level player status.
- Use `FirePanel` for grouped cards, stats, and hero containers.
- Use `FireSection` for screen sections with titles.
- Use `FloatingCard` for premium hero surfaces and contest previews.
- Use `ArenaMeter` or `PulseGlow` for active in-game metrics.
- Use `FireBurst`, `CoinBurst`, and `XPBurst` for reward feedback.

## Accessibility Notes
- Keep text contrast high on dark surfaces.
- Use strong color contrast for brand CTAs.
- Ensure tappable controls are large enough for rapid gameplay.
- Prefer direct action labels like `ENTER CHALLENGE` and `TAP RAPIDLY!`.
