import { useCallback, useEffect, useRef, useState } from "react";

import { Opponent } from "./ai/types";
import { getRandomOpponent } from "./ai/OpponentDatabase";
import {
  createOpponentState,
  updateOpponent,
  OpponentState,
} from "./ai/OpponentAI";

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

const MATCH_DURATION = 60;
const COUNTDOWN_SECONDS = 3;
const COMBO_WINDOW_MS = 700;

export function useGameLoop() {
  // =====================================
  // REACT STATE
  // =====================================

  const [state, setState] = useState<GameState>({
    score: 0,
    combo: 0,
    status: "IDLE",
  });

  const [timeRemaining, setTimeRemaining] =
    useState(MATCH_DURATION);

  const [opponentScore, setOpponentScore] =
    useState(0);

  // =====================================
  // GAME REFS
  // =====================================

  const scoreRef = useRef(0);
  const comboRef = useRef(0);

  const lastTapRef = useRef(Date.now());

  const currentOpponentRef =
    useRef<Opponent>(
      getRandomOpponent()
    );

  const opponentStateRef =
    useRef<OpponentState>(
      createOpponentState()
    );

  // =====================================
  // TIMER REFS
  // =====================================

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

  // =====================================
  // CLEANUP
  // =====================================

  const stopAllTimers =
    useCallback(() => {

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

  useEffect(() => {
    return () => {
      stopAllTimers();
    };
  }, [stopAllTimers]);

  // =====================================
  // RESET MATCH
  // =====================================

  const resetMatch =
    useCallback(() => {

      console.log("🔥 RESET MATCH");

      stopAllTimers();

      scoreRef.current = 0;
      comboRef.current = 0;

      lastTapRef.current = Date.now();

      currentOpponentRef.current =
        getRandomOpponent();

      opponentStateRef.current =
        createOpponentState();

      setOpponentScore(0);

      setTimeRemaining(
        MATCH_DURATION
      );

      setState({
        score: 0,
        combo: 0,
        status: "IDLE",
      });

    }, [stopAllTimers]);  // =====================================
  // END GAME
  // =====================================

  const endGame = useCallback(() => {

    console.log("🏁 MATCH FINISHED");

    stopAllTimers();

    setOpponentScore(
      Math.floor(opponentStateRef.current.score)
    );

    setState((old) => ({
      ...old,
      status: "FINISHED",
    }));

  }, [stopAllTimers]);

  // =====================================
  // OPPONENT LOOP
  // =====================================

  const startOpponentLoop =
    useCallback(() => {

      console.log("🤖 AI STARTED");

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

    }, []);

  // =====================================
  // START GAME
  // =====================================

  const startGame = useCallback(() => {

    console.log("🔥 START GAME");

    resetMatch();

    let countdown =
      COUNTDOWN_SECONDS;

    setState((old) => ({
      ...old,
      status: "COUNTDOWN",
    }));

    countdownTimerRef.current =
      setInterval(() => {

        countdown--;

        console.log(
          "⏳ Countdown:",
          countdown
        );

        if (countdown <= 0) {

          if (countdownTimerRef.current) {
            clearInterval(
              countdownTimerRef.current
            );
            countdownTimerRef.current = null;
          }

          console.log("▶ MATCH START");

          setState((old) => ({
            ...old,
            status: "PLAYING",
          }));

          startOpponentLoop();

          gameTimerRef.current =
            setInterval(() => {

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
    resetMatch,
    startOpponentLoop,
    endGame,
  ]);  // =====================================
  // PLAYER TAP
  // =====================================

  const tap = useCallback(() => {

    console.log("👆 TAP:", state.status);

    if (state.status !== "PLAYING") {
      console.log("⛔ TAP IGNORED");
      return;
    }

    const now = Date.now();
    const delta = now - lastTapRef.current;

    lastTapRef.current = now;

    // -----------------------------
    // Combo
    // -----------------------------

    if (delta <= COMBO_WINDOW_MS) {
      comboRef.current++;
    } else {
      comboRef.current = 0;
    }

    // -----------------------------
    // Score
    // -----------------------------

    let gain = 1;

    if (comboRef.current >= 20) {
      gain = 3;
    } else if (comboRef.current >= 10) {
      gain = 2;
    } else if (comboRef.current >= 5) {
      gain = 1.5;
    }

    scoreRef.current += gain;

    console.log(
      "🍔 SCORE:",
      Math.floor(scoreRef.current),
      " COMBO:",
      comboRef.current
    );

    setState((old) => ({
      ...old,
      score: Math.floor(scoreRef.current),
      combo: comboRef.current,
    }));

  }, [state.status]);

  // =====================================
  // WINNER
  // =====================================

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

  // =====================================
  // DEBUG
  // =====================================

  useEffect(() => {

    console.log(
      "📊",
      {
        status: state.status,
        score: state.score,
        combo: state.combo,
        opponent: opponentScore,
        time: timeRemaining,
      }
    );

  }, [
    state,
    opponentScore,
    timeRemaining,
  ]);

  // =====================================
  // PUBLIC API
  // =====================================

  return {

    state,

    timeRemaining,

    opponentScore,

    winner,

    startGame,

    tap,

  };

}