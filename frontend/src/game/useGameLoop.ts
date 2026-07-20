import { useCallback, useEffect, useRef, useState } from "react";

import { Opponent } from "./ai/types";
import { getRandomOpponent } from "./ai/OpponentDatabase";
import {
  createOpponentState,
  updateOpponent,
  OpponentState,
} from "./ai/OpponentAI";
import { normalizeMatchDurationSeconds } from "./contestDuration";
import { resolveFoodHeat } from "./foodHeat";
import {
  addHeartburnValue,
  COMPLETED_FOOD_HEARTBURN_BONUS,
  getHeatMultiplier,
  getHeatTier,
  type HeatTier,
  OVERHEAT_DURATION_MS,
  OVERHEAT_RECOVERY_HEARTBURN,
} from "./heartburn";

// ======================================
// TYPES
// ======================================

export type GameStatus =
  | "IDLE"
  | "MATCH_INTRO"
  | "COUNTDOWN"
  | "PLAYING"
  | "FINISHED";

export interface GameState {
  score: number;
  combo: number;
  status: GameStatus;
  heartburn: number;
  heatTier: HeatTier;
  isOverheated: boolean;
  heatMultiplier: number;
  overheatRemainingMs: number;
  antacidCount: number;
  canUseAntacid: boolean;
}

export interface UseGameLoopOptions {
  duration?: number;
  matchKey?: string;
  antacidCount?: number;
  foodId?: string;
  foodName?: string;
  difficulty?: string;
  heatMultiplier?: number;
  extraHeat?: number;
}

// ======================================
// CONSTANTS
// ======================================

const COUNTDOWN_SECONDS = 3;
const COMBO_WINDOW_MS = 700;

const debugLog = (...args: unknown[]) => {
  if (__DEV__) {
    console.log(...args);
  }
};

// ======================================
// HOOK
// ======================================

export function useGameLoop({
  duration = 60,
  matchKey = "default",
  antacidCount: initialAntacidCount,
  foodId,
  foodName,
  difficulty,
  heatMultiplier: challengeHeatMultiplier,
  extraHeat,
}: UseGameLoopOptions = {}) {
  const resolvedMatchDuration =
    normalizeMatchDurationSeconds(duration);

  const resolvedBiteHeat = resolveFoodHeat(foodId, {
    foodName,
    difficulty,
    heatMultiplier: challengeHeatMultiplier,
    extraHeat,
  });

  // --------------------------
  // React State
  // --------------------------

  const fallbackAntacidCount = Number.isFinite(
    initialAntacidCount
  )
    ? Math.max(
        0,
        Math.floor(initialAntacidCount ?? 0)
      )
    : 3;

  const [state, setState] = useState<GameState>({
    score: 0,
    combo: 0,
    status: "IDLE",
    heartburn: 0,
    heatTier: "COOL",
    isOverheated: false,
    heatMultiplier: 1,
    overheatRemainingMs: 0,
    antacidCount: fallbackAntacidCount,
    canUseAntacid: false,
  });

  const [timeRemaining, setTimeRemaining] =
    useState(resolvedMatchDuration);

  const [opponentScore, setOpponentScore] =
    useState(0);

  const [countdownValue, setCountdownValue] =
    useState<number | "GO">(3);

  const [showCountdown, setShowCountdown] =
    useState(false);

  // --------------------------
  // Mutable Game Values
  // --------------------------

  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const lastTapRef = useRef(0);
  const timeRemainingRef = useRef(
    resolvedMatchDuration
  );
  const matchKeyRef = useRef(matchKey);
  const statusRef = useRef<GameStatus>("IDLE");
  const heartburnRef = useRef(0);
  const isOverheatedRef = useRef(false);
  const overheatEndsAtRef = useRef(0);
  const antacidCountRef = useRef(
    fallbackAntacidCount
  );
  const inventoryHydratedRef = useRef(false);

  // --------------------------
  // Opponent
  // --------------------------

  const currentOpponentRef =
    useRef<Opponent>(getRandomOpponent());

  const opponentStateRef =
    useRef<OpponentState>(
      createOpponentState()
    );

  // --------------------------
  // Timers
  // --------------------------

  const countdownTimerRef =
    useRef<ReturnType<typeof setInterval> | null>(
      null
    );

  const gameTimerRef =
    useRef<ReturnType<typeof setInterval> | null>(
      null
    );

  const opponentTimerRef =
    useRef<ReturnType<typeof setInterval> | null>(
      null
    );

  const overheatTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const countdownHideTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const clearOverheatTimer = useCallback(() => {
    if (overheatTimerRef.current) {
      clearTimeout(overheatTimerRef.current);
      overheatTimerRef.current = null;
    }

    overheatEndsAtRef.current = 0;
  }, []);

  // ======================================
  // STOP ALL TIMERS
  // ======================================

  const stopAllTimers = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    if (gameTimerRef.current) {
      clearInterval(gameTimerRef.current);
      gameTimerRef.current = null;
    }

    if (opponentTimerRef.current) {
      clearInterval(opponentTimerRef.current);
      opponentTimerRef.current = null;
    }

    if (countdownHideTimerRef.current) {
      clearTimeout(countdownHideTimerRef.current);
      countdownHideTimerRef.current = null;
    }

    clearOverheatTimer();
  }, [clearOverheatTimer]);

  // ======================================
  // CLEANUP
  // ======================================

  useEffect(() => {
    return () => {
      stopAllTimers();
    };
  }, [stopAllTimers]);

  // ======================================
  // INVENTORY HYDRATION
  // ======================================

  useEffect(() => {
    if (
      inventoryHydratedRef.current ||
      initialAntacidCount === undefined ||
      !Number.isFinite(initialAntacidCount)
    ) {
      return;
    }

    const hydratedCount = Math.max(
      0,
      Math.floor(initialAntacidCount)
    );

    inventoryHydratedRef.current = true;
    antacidCountRef.current = hydratedCount;

    setState((old) => ({
      ...old,
      antacidCount: hydratedCount,
      canUseAntacid:
        old.status === "PLAYING" &&
        old.heartburn > 0 &&
        hydratedCount > 0,
    }));
  }, [initialAntacidCount]);

  // ======================================
  // OVERHEAT
  // ======================================

  const startOverheatTimer = useCallback(() => {
    if (
      overheatTimerRef.current ||
      isOverheatedRef.current
    ) {
      return;
    }

    isOverheatedRef.current = true;

    overheatEndsAtRef.current =
      Date.now() + OVERHEAT_DURATION_MS;

    overheatTimerRef.current = setTimeout(() => {
      overheatTimerRef.current = null;
      overheatEndsAtRef.current = 0;
      isOverheatedRef.current = false;

      if (statusRef.current !== "PLAYING") {
        return;
      }

      heartburnRef.current =
        OVERHEAT_RECOVERY_HEARTBURN;

      const recoveredTier = getHeatTier(
        OVERHEAT_RECOVERY_HEARTBURN
      );

      setState((old) => ({
        ...old,
        heartburn:
          OVERHEAT_RECOVERY_HEARTBURN,
        heatTier: recoveredTier,
        isOverheated: false,
        heatMultiplier:
          getHeatMultiplier(recoveredTier),
        overheatRemainingMs: 0,
        canUseAntacid: old.antacidCount > 0,
      }));
    }, OVERHEAT_DURATION_MS);
  }, []);

  // ======================================
  // HEARTBURN HELPERS
  // ======================================

  const addHeartburn = useCallback(
    (amount = resolvedBiteHeat): boolean => {
      if (statusRef.current !== "PLAYING") {
        return false;
      }

      const nextHeartburn = addHeartburnValue(
        heartburnRef.current,
        amount
      );

      heartburnRef.current = nextHeartburn;

      const overheated =
        isOverheatedRef.current ||
        nextHeartburn >= 100;

      if (nextHeartburn >= 100) {
        startOverheatTimer();
      }

      const tier: HeatTier = overheated
        ? "OVERHEATED"
        : getHeatTier(nextHeartburn);

      if (overheated) {
        comboRef.current = 0;
      }

      setState((old) => ({
        ...old,
        combo: overheated ? 0 : old.combo,
        heartburn: nextHeartburn,
        heatTier: tier,
        isOverheated: overheated,
        heatMultiplier: getHeatMultiplier(tier),
        overheatRemainingMs: overheated
          ? Math.max(
              0,
              overheatEndsAtRef.current -
                Date.now()
            )
          : 0,
        canUseAntacid:
          old.antacidCount > 0 &&
          nextHeartburn > 0,
      }));

      return true;
    },
    [resolvedBiteHeat, startOverheatTimer]
  );

  const addCompletedFoodHeartburn =
    useCallback(
      () =>
        addHeartburn(
          COMPLETED_FOOD_HEARTBURN_BONUS
        ),
      [addHeartburn]
    );

  // ======================================
  // ANTACID
  // ======================================

  const useAntacid =
    useCallback((): boolean => {
      if (
        statusRef.current !== "PLAYING" ||
        antacidCountRef.current <= 0 ||
        heartburnRef.current <= 0
      ) {
        return false;
      }

      clearOverheatTimer();

      antacidCountRef.current -= 1;
      heartburnRef.current = 0;
      isOverheatedRef.current = false;

      setState((old) => ({
        ...old,
        heartburn: 0,
        heatTier: "COOL",
        isOverheated: false,
        heatMultiplier: 1,
        overheatRemainingMs: 0,
        antacidCount:
          antacidCountRef.current,
        canUseAntacid: false,
      }));

      return true;
    }, [clearOverheatTimer]);

  // ======================================
  // RESET MATCH
  // ======================================

  const resetMatch = useCallback(() => {
    debugLog("🔥 RESET MATCH");

    stopAllTimers();

    scoreRef.current = 0;
    comboRef.current = 0;
    lastTapRef.current = 0;
    timeRemainingRef.current =
      resolvedMatchDuration;
    statusRef.current = "IDLE";
    heartburnRef.current = 0;
    isOverheatedRef.current = false;
    overheatEndsAtRef.current = 0;

    currentOpponentRef.current =
      getRandomOpponent();

    opponentStateRef.current =
      createOpponentState();

    setOpponentScore(0);
    setTimeRemaining(resolvedMatchDuration);
    setShowCountdown(false);
    setCountdownValue(3);

    setState({
      score: 0,
      combo: 0,
      status: "IDLE",
      heartburn: 0,
      heatTier: "COOL",
      isOverheated: false,
      heatMultiplier: 1,
      overheatRemainingMs: 0,
      antacidCount:
        antacidCountRef.current,
      canUseAntacid: false,
    });
  }, [
    resolvedMatchDuration,
    stopAllTimers,
  ]);

  useEffect(() => {
    if (matchKeyRef.current === matchKey) {
      return;
    }

    matchKeyRef.current = matchKey;
    inventoryHydratedRef.current = false;
    resetMatch();
  }, [matchKey, resetMatch]);

  // ======================================
  // END GAME
  // ======================================

  const endGame = useCallback(() => {
    debugLog("🏁 MATCH FINISHED");

    stopAllTimers();
    statusRef.current = "FINISHED";

    setOpponentScore(
      Math.floor(
        opponentStateRef.current.score
      )
    );

    setState((old) => ({
      ...old,
      status: "FINISHED",
      canUseAntacid: false,
      overheatRemainingMs: 0,
    }));
  }, [stopAllTimers]);

  // ======================================
  // START OPPONENT AI
  // ======================================

  const startOpponentLoop =
    useCallback(() => {
      debugLog("🤖 AI STARTED");

      if (opponentTimerRef.current) {
        clearInterval(
          opponentTimerRef.current
        );
      }

      opponentTimerRef.current =
        setInterval(() => {
          opponentStateRef.current =
            updateOpponent(
              currentOpponentRef.current,
              opponentStateRef.current,
              {
                timeRemaining:
                  timeRemainingRef.current,
                matchDuration:
                  resolvedMatchDuration,
                playerScore: scoreRef.current,
                now: Date.now(),
              }
            );

          setOpponentScore(
            Math.floor(
              opponentStateRef.current.score
            )
          );
        }, 300);
    }, [resolvedMatchDuration]);

  // ======================================
  // START MATCH INTRO
  // ======================================

  const startMatchIntro = useCallback(() => {
    if (statusRef.current !== "IDLE") return;
    resetMatch();
    statusRef.current = "MATCH_INTRO";
    setState((old) => ({
      ...old,
      status: "MATCH_INTRO",
      canUseAntacid: false,
    }));
  }, [resetMatch]);

  // ======================================
  // START GAME
  // ======================================

  const startGame = useCallback(() => {
    debugLog("🔥 START GAME");

    if (statusRef.current !== "IDLE" && statusRef.current !== "MATCH_INTRO") {
      debugLog("⛔ Game already started");
      return;
    }

    if (statusRef.current === "IDLE") {
      resetMatch();
    }

    setState({
      score: 0,
      combo: 0,
      status: "COUNTDOWN",
      heartburn: 0,
      heatTier: "COOL",
      isOverheated: false,
      heatMultiplier: 1,
      overheatRemainingMs: 0,
      antacidCount:
        antacidCountRef.current,
      canUseAntacid: false,
    });

    statusRef.current = "COUNTDOWN";

    setShowCountdown(true);
    setCountdownValue(3);

    let countdown = COUNTDOWN_SECONDS;

    debugLog("⏳ Countdown started");

    countdownTimerRef.current =
      setInterval(() => {
        countdown -= 1;

        debugLog("⏳", countdown);

        if (countdown > 0) {
          setCountdownValue(countdown);
        } else {
          setCountdownValue("GO");
        }

        if (countdown <= 0) {
          if (countdownTimerRef.current) {
            clearInterval(
              countdownTimerRef.current
            );

            countdownTimerRef.current =
              null;
          }

          debugLog("▶ MATCH START");

          countdownHideTimerRef.current =
            setTimeout(() => {
              setShowCountdown(false);
              countdownHideTimerRef.current =
                null;
            }, 700);

          setState((old) => ({
            ...old,
            status: "PLAYING",
            canUseAntacid:
              old.antacidCount > 0 &&
              old.heartburn > 0,
          }));

          statusRef.current = "PLAYING";

          startOpponentLoop();

          gameTimerRef.current =
            setInterval(() => {
              setTimeRemaining((time) => {
                if (
                  overheatEndsAtRef.current > 0
                ) {
                  const remaining = Math.max(
                    0,
                    overheatEndsAtRef.current -
                      Date.now()
                  );

                  setState((old) =>
                    old.isOverheated
                      ? {
                          ...old,
                          overheatRemainingMs:
                            remaining,
                        }
                      : old
                  );
                }

                if (time <= 1) {
                  timeRemainingRef.current = 0;
                  endGame();
                  return 0;
                }

                const nextTime = time - 1;
                timeRemainingRef.current = nextTime;
                return nextTime;
              });
            }, 1000);
        }
      }, 1000);
  }, [
    endGame,
    resetMatch,
    startOpponentLoop,
  ]);

  // ======================================
  // PLAYER TAP
  // ======================================

  const tap = useCallback(() => {
    debugLog(
      "👆 TAP:",
      statusRef.current
    );

    if (
      statusRef.current !== "PLAYING"
    ) {
      debugLog("⛔ TAP IGNORED");
      return;
    }

    const now = Date.now();

    const delta =
      lastTapRef.current === 0
        ? 0
        : now - lastTapRef.current;

    lastTapRef.current = now;

    const wasOverheated =
      isOverheatedRef.current;

    if (wasOverheated) {
      comboRef.current = 0;
    } else if (
      delta <= COMBO_WINDOW_MS
    ) {
      comboRef.current += 1;
    } else {
      comboRef.current = 0;
    }

    // --------------------------
    // Base Score
    // --------------------------

    let gain = 1;

    if (comboRef.current >= 20) {
      gain = 3;
    } else if (
      comboRef.current >= 10
    ) {
      gain = 2;
    } else if (
      comboRef.current >= 5
    ) {
      gain = 1.5;
    }

    // --------------------------
    // Food-Specific Heat
    // --------------------------

    const nextHeartburn =
      addHeartburnValue(
        heartburnRef.current,
        resolvedBiteHeat
      );

    heartburnRef.current = nextHeartburn;

    const overheated =
      wasOverheated ||
      nextHeartburn >= 100;

    if (nextHeartburn >= 100) {
      startOverheatTimer();
    }

    const nextHeatTier: HeatTier =
      overheated
        ? "OVERHEATED"
        : getHeatTier(nextHeartburn);

    const nextHeatMultiplier =
      getHeatMultiplier(nextHeatTier);

    const awardedPoints = Math.round(
      gain * nextHeatMultiplier
    );

    scoreRef.current += awardedPoints;

    if (overheated) {
      comboRef.current = 0;
    }

    debugLog(
      "🍔 SCORE:",
      Math.floor(scoreRef.current),
      "COMBO:",
      comboRef.current,
      "FOOD HEAT:",
      resolvedBiteHeat,
      "HEARTBURN:",
      nextHeartburn,
      "TIER:",
      nextHeatTier
    );

    setState((old) => ({
      ...old,
      score: Math.floor(
        scoreRef.current
      ),
      combo: comboRef.current,
      heartburn: nextHeartburn,
      heatTier: nextHeatTier,
      isOverheated: overheated,
      heatMultiplier:
        nextHeatMultiplier,
      overheatRemainingMs: overheated
        ? Math.max(
            0,
            overheatEndsAtRef.current -
              Date.now()
          )
        : 0,
      canUseAntacid:
        old.antacidCount > 0 &&
        nextHeartburn > 0,
    }));
  }, [
    resolvedBiteHeat,
    startOverheatTimer,
  ]);

  // ======================================
  // WINNER
  // ======================================

  const didPlayerWin =
    state.score > opponentScore;

  const didDraw =
    state.score === opponentScore;

  const winner = didDraw
    ? "DRAW"
    : didPlayerWin
      ? "PLAYER"
      : "OPPONENT";

  // ======================================
  // DEBUG
  // ======================================

  useEffect(() => {
    debugLog("📊", {
      status: state.status,
      score: state.score,
      combo: state.combo,
      opponent: opponentScore,
      time: timeRemaining,
      foodId,
      foodName,
      difficulty,
      resolvedBiteHeat,
    });
  }, [
    difficulty,
    foodId,
    foodName,
    opponentScore,
    resolvedBiteHeat,
    state,
    timeRemaining,
  ]);

  // ======================================
  // PUBLIC API
  // ======================================

  return {
    state,

    currentOpponent:
      currentOpponentRef.current,

    timeRemaining,

    opponentScore,

    opponentBehavior:
      opponentStateRef.current.behavior,

    opponentCombo:
      opponentStateRef.current.combo,

    winner,

    showCountdown,

    countdownValue,

    startGame,

    startMatchIntro,

    tap,

    heartburn: state.heartburn,
    heatTier: state.heatTier,
    isOverheated: state.isOverheated,
    heatMultiplier:
      state.heatMultiplier,
    overheatRemainingMs:
      state.overheatRemainingMs,
    antacidCount:
      state.antacidCount,
    canUseAntacid:
      state.canUseAntacid,

    resolvedBiteHeat,

    addHeartburn,
    addCompletedFoodHeartburn,
    useAntacid,
  };
}
