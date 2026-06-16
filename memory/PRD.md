# Chomp Champs — Product Requirements

## Overview
A mobile arcade eating-contest game built in React Native (Expo Router) + FastAPI + MongoDB. Player races against AI competitors at famous real-world eating contests (Nathan's Hot Dogs, Wing Bowl, Pizza Hut Stuffed Crust, Katz's Pastrami, Ben & Jerry's Brain Freeze, In-N-Out Burger Bash) while managing a heartburn meter using Tums.

## Core gameplay (realistic contest mechanics)
- 3 chomps per food item (food emoji visibly shrinks each chomp, then resets when item complete)
- Belly fullness meter (🍔, 0–100) — fills 4 pts per chomp, digests 3 pts/sec passively
- Heartburn meter (🔥, 0–100) — fills per contest-specific rate; reaching 100 = KO loss
- Stuffed state at belly 100 — chomps don't register until digested or water-dunked
- Water Dunk button (💧) — Joey Chestnut-style; reduces belly −35 and heartburn −10; limited to 3/match
- Tums button (💊) — reduces heartburn −35; consumes one Tums
- Combo system — taps within 450 ms increase combo; every 6-streak = bonus item
- MC commentary at halfway, last 10 s, last 5 s; red vignette + pulsing timer on final 10 s

## Economy
- Coins (earned 10 per loss / contest prize pool per win, also bought with real money MOCKED)
- Tums (start at 5, +1 every 30 min passive refill up to 5, buy 5/15/50 packs with coins)
- Coin packs at $0.99 / $4.99 / $9.99 (MOCKED, no Stripe)

## AI Opponents (6 personas)
Big Joey C. 🇺🇸, Takeru K. 🇯🇵, Molly S. 🇺🇸, Furious Pete 🇨🇦, Matt "Megatoad" 🇺🇸, Miki Sudo 🇺🇸. Each has skill 0.85–0.95 and a unique personality. Trash-talk lines generated live by **Claude Sonnet 4.6** via Emergent LLM key for 5 events: start, midmatch_ahead, midmatch_behind, win, lose. Falls back to canned lines if LLM unavailable.

## Global leaderboard
50-row sorted list combining real player best scores + 20 seeded bot players with country flags (ChompKing 🇺🇸, KimchiCrusher 🇰🇷, etc.). Real-time PvP is **simulated** via the leaderboard ghost-race (no websockets).

## Navigation
Bottom tabs: ARENA / CONTESTS / RANKS / SHOP / ME. Full-screen modal routes for Play and Result.

## Tech
- Backend: FastAPI + Motor (MongoDB) + emergentintegrations / LiteLLM. All routes `/api/*`.
- Frontend: Expo SDK 54, Expo Router file-based, react-native-reanimated for meter + scale animations, expo-haptics for tactile feedback, react-native-safe-area-context, AsyncStorage for device-id profile.
- No auth — single local profile keyed by AsyncStorage device_id.

## Tested
21/21 backend cases pass; full frontend flow validated end-to-end via Playwright (390×844). Profile-modal scroll fix applied post-test.
