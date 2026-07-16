# Chomp Champs Changelog

## Unreleased

### Added
- New reusable animation hooks in `frontend/src/animations`:
  - `useFadeIn`
  - `useSlideUp`
  - `useScalePop`
  - `usePulse`
  - `useFloating`
  - `useSquashBounce`
  - `useScreenFlash`
  - `useScreenShake`
- New presentation components in `frontend/src/components/animations`:
  - `ArenaMeter`
  - `CoinBurst`
  - `XPBurst`
  - `FlyingBurst`
  - `PulseGlow`
  - `ScreenFlash`
  - `ScreenShake`
  - `FloatingCard`
- Live gameplay UI enhancements in `frontend/app/play/[contestId].tsx`:
  - Countdown overlay and effect-driven game start
  - Victory/defeat celebration overlays
  - Floating coin, XP, and loot burst animations
  - HUD integration with `GameplayHUD`
- New live arena interaction in `frontend/src/game/ui/FoodArena.tsx`:
  - tap bounce feedback
  - floating burger animation
  - combo burst and screen shake feedback
- HUD improvements via `frontend/src/game/ui/GameplayHUD.tsx` and `frontend/src/game/ui/MatchHUD.tsx`.

### Changed
- Preserved gameplay logic inside `frontend/src/game/useGameLoop.ts` while layering new visual feedback on top.
- Strengthened UI responsiveness and animation polish on the Home screen with `FireHeader`, `FirePanel`, `FireSection`, and animated entry effects.
- Improved asset-driven contest card presentation with `FloatingCard` and reveal transitions.

### Fixed
- Resolved type and state handling issues in gameplay route and animation components.

## Previous

### 0.1.0
- Initial scaffold for backend FastAPI service with player, matchmaking, shop, and contest routes.
- Initial Expo front-end scaffold with `expo-router`, home tab navigation, and basic game screens.
