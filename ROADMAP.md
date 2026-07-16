# Project Roadmap

## Vision
Chomp Champs is a high-energy competitive eating arena built for fast mobile play. The current direction focuses on a polished arcade experience with responsive tap feedback, vivid HUD storytelling, and a clean dark sports-arcade aesthetic.

## Phase 1 — Arena 2.0 / UI Foundation (Current)
- Establish reusable animation and presentation primitives in `frontend/src/animations` and `frontend/src/components/animations`.
- Polish the Home Lobby experience with featured contest hero cards, progress panels, and animated reveal transitions.
- Improve live match feedback through:
  - responsive tap arena interactions in `frontend/src/game/ui/FoodArena.tsx`
  - combo burst visual feedback and heartburn-style game pacing
  - celebration overlays for victory/defeat
  - floating score, reward bursts, and countdown UI in `frontend/app/play/[contestId].tsx`
- Keep core gameplay state isolated in `frontend/src/game/useGameLoop.ts` while making UI feel more dynamic.
- Maintain a backend API service layer with FastAPI routes for player, matchmaking, contest, shop, and debug endpoints.

## Phase 2 — Matchmaking, Progression & Engagement
- Add real opponent matchmaking flow and persistent player profiles.
- Integrate tournament and leaderboard progression with backend match result persistence.
- Expand shop and gear ownership mechanics with live purchase flows.
- Add richer audio/haptics to reinforce taps, combos, Tums use, and victory moments.
- Harden offline/connection handling in the frontend API wrapper and UI.

## Phase 3 — Live polish and launch readiness
- Optimize performance for low-end Android devices and preserve 60fps gameplay.
- Finalize HUD hierarchy, readability, and safe-area layouts across phones and tablets.
- Complete UI accessibility checks for contrast, touch targets, and readability.
- Prepare release assets and documentation for deployment.

## Future Enhancements
- Add social features: friends list, global PvP lobby, and trash-talk interactions.
- Extend AI opponent system with personality-driven contest behaviors.
- Introduce season rewards, daily quests, and event contests.
- Explore alternate game modes beyond rapid tap arena play.
