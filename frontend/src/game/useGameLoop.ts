import { useCallback, useEffect, useRef, useState } from "react";

import { Opponent } from "./ai/types";
import { getRandomOpponent } from "./ai/OpponentDatabase";
import {
  createOpponentState,
  updateOpponent,
  OpponentState,
} from "./ai/OpponentAI";

// ======================================
// TYPES
// ======================================

export type GameStatus =
  | "IDLE"
  | "COUNTDOWN"
  | "PLAYING"
  | "FINISHED";

export interface GameState {
  score: number;
  combo: number;
  status: GameStatus;
}

// ======================================
// CONSTANTS
// ======================================

const MATCH_DURATION = 60;
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

export function useGameLoop() {

  // --------------------------
  // React State
  // --------------------------

  const [state, setState] = useState<GameState>({
    score: 0,
    combo: 0,
    status: "IDLE",
  });

  const [timeRemaining, setTimeRemaining] =
    useState(MATCH_DURATION);

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
    useRef<ReturnType<typeof setInterval> | null>(null);

  const gameTimerRef =
    useRef<ReturnType<typeof setInterval> | null>(null);

  const opponentTimerRef =
    useRef<ReturnType<typeof setInterval> | null>(null);

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

  }, []);

  // ======================================
  // CLEANUP
  // ======================================

  useEffect(() => {

    return () => {

      stopAllTimers();

    };

  }, [stopAllTimers]);  // ======================================
  // RESET MATCH
  // ======================================

  const resetMatch = useCallback(() => {

    debugLog("🔥 RESET MATCH");

    stopAllTimers();

    scoreRef.current = 0;
    comboRef.current = 0;
    lastTapRef.current = 0;

    currentOpponentRef.current = getRandomOpponent();

    opponentStateRef.current =
      createOpponentState();

    setOpponentScore(0);

    setTimeRemaining(MATCH_DURATION);

    setState({
      score: 0,
      combo: 0,
      status: "IDLE",
    });

  }, [stopAllTimers]);

  // ======================================
  // END GAME
  // ======================================

  const endGame = useCallback(() => {

    debugLog("🏁 MATCH FINISHED");

    stopAllTimers();

    setOpponentScore(
      Math.floor(opponentStateRef.current.score)
    );

    setState((old) => ({
      ...old,
      status: "FINISHED",
    }));

  }, [stopAllTimers]);

  // ======================================
  // START OPPONENT AI
  // ======================================

  const startOpponentLoop = useCallback(() => {

    debugLog("🤖 AI STARTED");

    if (opponentTimerRef.current) {
      clearInterval(opponentTimerRef.current);
    }

    opponentTimerRef.current =
      setInterval(() => {

        opponentStateRef.current =
          updateOpponent(
            currentOpponentRef.current,
            opponentStateRef.current
          );

        setOpponentScore(
          Math.floor(
            opponentStateRef.current.score
          )
        );

      }, 300);

  }, []);  // ======================================
  // START GAME
  // ======================================

  const startGame = useCallback(() => {

    debugLog("🔥 START GAME");

    // Prevent starting twice
    if (state.status !== "IDLE") {
      debugLog("⛔ Game already started");
      return;
    }

    resetMatch();

    // Immediately enter countdown
    setState({
      score: 0,
      combo: 0,
      status: "COUNTDOWN",
    });
setShowCountdown(true);
setCountdownValue(3);
    let countdown = COUNTDOWN_SECONDS;

    debugLog("⏳ Countdown started");

    countdownTimerRef.current = setInterval(() => {

      countdown--;

debugLog("⏳", countdown);

if (countdown > 0) {
  setCountdownValue(countdown);
} else {
  setCountdownValue("GO");
}

      if (countdown <= 0) {

        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }

        debugLog("▶ MATCH START");
setTimeout(() => {
  setShowCountdown(false);
}, 700);
        setState((old) => ({
          ...old,
          status: "PLAYING",
        }));

        // Start AI
        startOpponentLoop();

        // Start match timer
        gameTimerRef.current = setInterval(() => {

          setTimeRemaining((time) => {

            if (time <= 1) {

              endGame();

              return 0;

            }

            return time - 1;

          });

        }, 1000);

      }

    }, 1000);

  }, [
    state.status,
    resetMatch,
    startOpponentLoop,
    endGame,
  ]);  // ======================================
  // PLAYER TAP
  // ======================================

  const tap = useCallback(() => {

    debugLog("👆 TAP:", state.status);

    if (state.status !== "PLAYING") {
      debugLog("⛔ TAP IGNORED");
      return;
    }

    const now = Date.now();

    const delta =
      lastTapRef.current === 0
        ? 0
        : now - lastTapRef.current;

    lastTapRef.current = now;

    // --------------------------
    // Combo
    // --------------------------

    if (delta <= COMBO_WINDOW_MS) {
      comboRef.current++;
    } else {
      comboRef.current = 0;
    }

    // --------------------------
    // Score
    // --------------------------

    let gain = 1;

    if (comboRef.current >= 20) {
      gain = 3;
    } else if (comboRef.current >= 10) {
      gain = 2;
    } else if (comboRef.current >= 5) {
      gain = 1.5;
    }

    scoreRef.current += gain;

    debugLog(
      "🍔 SCORE:",
      Math.floor(scoreRef.current),
      "COMBO:",
      comboRef.current
    );

    setState((old) => ({
      ...old,
      score: Math.floor(scoreRef.current),
      combo: comboRef.current,
    }));

  }, [state.status]);

  // ======================================
  // WINNER
  // ======================================

  const didPlayerWin =
    state.score > opponentScore;

  const didDraw =
    state.score === opponentScore;

  const winner =
    didDraw
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
    });

  }, [
    state,
    opponentScore,
    timeRemaining,
  ]);

  // ======================================
  // PUBLIC API
  // ======================================

 return {
  state,

  currentOpponent: currentOpponentRef.current,

  timeRemaining,

  opponentScore,

  winner,

  showCountdown,

  countdownValue,

  startGame,

  tap,
};

}
