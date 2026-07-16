# Architecture Overview

## Project Layers

### Frontend (`frontend/`)
- Built with Expo + React Native + TypeScript.
- Uses `expo-router` for route-based navigation and tab structure.
- Main UI entry point redirects from `frontend/app/index.tsx` to `frontend/app/(tabs)/home.tsx`.
- Gameplay route: `frontend/app/play/[contestId].tsx`.
- Core game state is managed by the `useGameLoop` hook in `frontend/src/game/useGameLoop.ts`.
- UI composition is handled through modular screen and component layers in `frontend/src/game/ui`, `frontend/src/components/fire`, and `frontend/src/components/animations`.
- Reusable animation primitives live in `frontend/src/animations`.

## Frontend Structure

### `frontend/src/animations`
- Provides shared animation hooks and transforms for use across screens.
- Exported hooks include:
  - `useFadeIn`
  - `useSlideUp`
  - `useScalePop`
  - `usePulse`
  - `useFloating`
  - `useSquashBounce`
  - `useScreenFlash`
  - `useScreenShake`
- `AnimationProvider` is available as the animation entry point for shared context or future enhancements.

### `frontend/src/components/animations`
- Encapsulates reusable animated UI pieces for the game experience.
- Current components:
  - `ArenaMeter`
  - `CoinBurst`
  - `XPBurst`
  - `FlyingBurst`
  - `FloatingCard`
  - `FireBurst`
  - `PulseGlow`
  - `ScreenFlash`
  - `ScreenShake`
- These reusable parts are used by gameplay screens and HUD components to deliver polished visual feedback.

### `frontend/src/game/ui`
- Gameplay-specific UI components that consume game state and present the arena experience.
- Notable components:
  - `GameplayHUD.tsx` — consolidated HUD for level, XP, coins, timer, opponent score, and combo.
  - `FoodArena.tsx` — main tap interaction view with physics-like floating, burst, and combo feedback.
  - `CountdownOverlay.tsx` — startup countdown display.
  - `EffectsLayer.tsx` — on-screen score feedback.
  - `ArcadeBackground.tsx` — shared match background.

## Backend (`backend/`)
- FastAPI service providing the game backend and data APIs.
- `backend/server.py` defines HTTP routes for:
  - player creation and lookup
  - matchmaking join/status/leave
  - match result submission
  - shop and gear data
  - contest listings and featured contests
- Business logic is separated into services:
  - `backend/services/player_service.py`
  - `backend/services/contest_service.py`
- In-memory data storage is used in `backend/database.py`. This is a lightweight mock DB for current development.

## API Contract
- `frontend/src/api.ts` wraps backend requests and handles device identity persistence via AsyncStorage.
- Main API methods:
  - `api.getPlayer()`
  - `api.listContests()`
  - `api.startMatch()`
  - `api.submitResult()`
  - `api.leaderboard()`
  - `api.shop()` / `api.gear()`
  - `api.purchase()`
  - `api.matchmakingJoin()` / `api.matchmakingStatus()` / `api.matchmakingLeave()`
- Requests are sent to `BASE/api` where `BASE` is derived from `process.env.EXPO_PUBLIC_BACKEND_URL`.

## Data Flow
- Game state and logic remain in `useGameLoop`.
- Visual state and animated feedback are layered on top in screen/UI components.
- The Home screen loads contest data from the API and presents it with animated panels.
- The gameplay screen uses local game loop state to drive tap actions, countdowns, score, opponent updates, and victory/defeat transitions.

## Design Principles
- Keep game logic distinct from animation/presentation.
- Use lightweight reusable animation hooks so the same motion language can be applied consistently.
- Favor high-contrast dark surfaces, bright brand accents, and responsive tactile feedback.
- Preserve performance by avoiding heavy blur/glass effects and using solid backgrounds for the arcade visual style.

## Tech Stack
- Frontend: `expo`, `react-native`, `expo-router`, `typescript`, `react-native-reanimated`, `react-native-gesture-handler`
- Backend: `fastapi`, `uvicorn`, `pydantic`
- Shared tooling: `eslint`, `typescript`
