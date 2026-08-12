import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getRandomOpponent } from "./ai/OpponentDatabase";
import { createOpponentState, updateOpponent, type OpponentState } from "./ai/OpponentAI";
import type { Opponent } from "./ai/types";
import {
  authoritativeOpponentScoreAtElapsed,
  type AuthoritativeOpponentConfig,
} from "./authoritativeOpponent";
import { normalizeMatchDurationSeconds } from "./contestDuration";
import { resolveFoodHeat } from "./foodHeat";
import {
  canConsumeAntacid,
  COMPLETED_FOOD_HEARTBURN_BONUS,
  COOLING_DELAY_MS,
  coolHeartburn,
  getHeatMultiplier,
  getHeatTier,
  getOverheatCombo,
  MAX_HEARTBURN,
  OVERHEAT_PENALTY_MS,
  OVERHEAT_RESET_HEAT,
  OVERHEAT_WARNING_DURATION_MS,
  PERFECT_COOLDOWN_BONUS,
  PERFECT_COOLDOWN_THRESHOLD,
  shouldAwardPerfectCooldown,
  type HeatTier,
} from "./heartburn";
import {
  applyHeatGain,
  calculateTapScore,
  consumeAntacid,
  deriveMatchStats,
  effectiveTapPower,
  effectiveComboWindowMs,
  FRESH_STOMACH_DURATION_MS,
  FRESH_STOMACH_SCORE_MULTIPLIER,
  getHeatGameplayModifiers,
  HEAT_SHIELD_DURATION_MS,
} from "./matchModifiers";

export type GameStatus = "IDLE" | "MATCH_INTRO" | "COUNTDOWN" | "PLAYING" | "FINISHED";

export type GameplayPresentationEventType =
  | "HEARTBURN_TIER_CHANGED"
  | "CRITICAL_WARNING"
  | "OVERHEAT_WARNING_STARTED"
  | "ANTACID_USED"
  | "ANTACID_SAVE"
  | "OVERHEATED"
  | "PERFECT_COOLDOWN"
  | "OVERHEAT_PENALTY_STARTED"
  | "OVERHEAT_PENALTY_ENDED";

export type GameplayPresentationEvent = {
  id: number;
  type: GameplayPresentationEventType;
  timestamp: number;
  fromTier?: HeatTier;
  toTier?: HeatTier;
  comboBefore?: number;
  comboAfter?: number;
  heatReduction?: number;
};

export interface GameState {
  score: number;
  combo: number;
  acceptedTapCount: number;
  completedProgress: number;
  status: GameStatus;
  heartburn: number;
  heatTier: HeatTier;
  isOverheated: boolean;
  overheatWarningActive: boolean;
  overheatPenaltyActive: boolean;
  heatMultiplier: number;
  overheatRemainingMs: number;
  antacidCount: number;
  canUseAntacid: boolean;
  antacidProtectionRemainingMs: number;
  freshStomachRemainingMs: number;
  freshStomachMultiplier: number;
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
  equippedGear?: string | null;
  opponent?: Opponent | null;
  opponentConfig?: AuthoritativeOpponentConfig | null;
}

const COUNTDOWN_SECONDS = 3;
const COOLING_RENDER_INTERVAL_MS = 50;
const DEBUG_GAMEPLAY = __DEV__ && false;

const debugLog = (...args: unknown[]) => {
  if (DEBUG_GAMEPLAY) console.log(...args);
};

const initialState = (antacidCount: number): GameState => ({
  score: 0,
  combo: 0,
  acceptedTapCount: 0,
  completedProgress: 0,
  status: "IDLE",
  heartburn: 0,
  heatTier: "COOL",
  isOverheated: false,
  overheatWarningActive: false,
  overheatPenaltyActive: false,
  heatMultiplier: 1,
  overheatRemainingMs: 0,
  antacidCount,
  canUseAntacid: false,
  antacidProtectionRemainingMs: 0,
  freshStomachRemainingMs: 0,
  freshStomachMultiplier: 1,
});

export function useGameLoop({
  duration = 60,
  matchKey = "default",
  antacidCount: initialAntacidCount,
  foodId,
  foodName,
  difficulty,
  heatMultiplier: challengeHeatMultiplier,
  extraHeat,
  equippedGear,
  opponent: authoritativeOpponent,
  opponentConfig,
}: UseGameLoopOptions = {}) {
  const matchStats = useMemo(() => deriveMatchStats(equippedGear), [equippedGear]);
  const resolvedMatchDuration = normalizeMatchDurationSeconds(duration);
  const resolvedBiteHeat = resolveFoodHeat(foodId, {
    foodName,
    difficulty,
    heatMultiplier: challengeHeatMultiplier,
    extraHeat,
  });
  const fallbackAntacidCount = Number.isFinite(initialAntacidCount)
    ? Math.max(0, Math.floor(initialAntacidCount ?? 0))
    : 3;

  const [state, setState] = useState<GameState>(() => initialState(fallbackAntacidCount));
  const [timeRemaining, setTimeRemaining] = useState(resolvedMatchDuration);
  const [opponentScore, setOpponentScore] = useState(0);
  const [countdownValue, setCountdownValue] = useState<number | "GO">(3);
  const [showCountdown, setShowCountdown] = useState(false);
  const [presentationEvents, setPresentationEvents] = useState<GameplayPresentationEvent[]>([]);

  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const statusRef = useRef<GameStatus>("IDLE");
  const lastTapRef = useRef(0);
  const heartburnRef = useRef(0);
  const heatTierRef = useRef<HeatTier>("COOL");
  const timeRemainingRef = useRef(resolvedMatchDuration);
  const matchKeyRef = useRef(matchKey);
  const matchGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const eventIdRef = useRef(0);
  const acceptedActionSequenceRef = useRef(0);
  const acceptedTapCountRef = useRef(0);
  const antacidCountRef = useRef(fallbackAntacidCount);
  const inventoryHydratedRef = useRef(false);
  const antacidProcessingRef = useRef(false);
  const heatProtectionEndsAtRef = useRef(0);
  const freshStomachEndsAtRef = useRef(0);
  const warningEndsAtRef = useRef(0);
  const penaltyEndsAtRef = useRef(0);
  const lastOverheatAtRef = useRef(0);
  const criticalCycleActiveRef = useRef(false);
  const perfectCooldownEligibleRef = useRef(false);
  const lastCoolingFrameAtRef = useRef(0);
  const lastCoolingRenderAtRef = useRef(0);
  const lastWarningRenderAtRef = useRef(0);

  const currentOpponentRef = useRef<Opponent>(getRandomOpponent());
  const opponentStateRef = useRef<OpponentState>(createOpponentState());
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const opponentTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const penaltyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coolingFrameRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  const emitEvents = useCallback((...types: GameplayPresentationEvent[]) => {
    if (!mountedRef.current || !types.length) return;
    setPresentationEvents((current) => [...current, ...types].slice(-20));
  }, []);

  const createEvent = useCallback((
    type: GameplayPresentationEventType,
    detail: Omit<GameplayPresentationEvent, "id" | "type" | "timestamp"> = {},
  ): GameplayPresentationEvent => ({
    id: ++eventIdRef.current,
    type,
    timestamp: Date.now(),
    ...detail,
  }), []);

  const logEvent = useCallback((message: string) => {
    if (__DEV__) console.log(`[Fire Feast] ${message}`);
  }, []);

  const clearWarningTimer = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    warningTimerRef.current = null;
    warningEndsAtRef.current = 0;
  }, []);

  const clearPenaltyTimer = useCallback(() => {
    if (penaltyTimerRef.current) clearTimeout(penaltyTimerRef.current);
    penaltyTimerRef.current = null;
    penaltyEndsAtRef.current = 0;
  }, []);

  const stopAllTimers = useCallback(() => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    if (opponentTimerRef.current) clearInterval(opponentTimerRef.current);
    if (countdownHideTimerRef.current) clearTimeout(countdownHideTimerRef.current);
    if (coolingFrameRef.current !== null) cancelAnimationFrame(coolingFrameRef.current);
    countdownTimerRef.current = null;
    gameTimerRef.current = null;
    opponentTimerRef.current = null;
    countdownHideTimerRef.current = null;
    coolingFrameRef.current = null;
    clearWarningTimer();
    clearPenaltyTimer();
  }, [clearPenaltyTimer, clearWarningTimer]);

  const updateHeatState = useCallback((heartburn: number, extra: Partial<GameState> = {}) => {
    const warningActive = warningEndsAtRef.current > Date.now();
    const penaltyActive = penaltyEndsAtRef.current > Date.now();
    const tier = warningActive ? "OVERHEATED" : getHeatTier(heartburn);
    heartburnRef.current = heartburn;
    heatTierRef.current = tier;
    setState((old) => ({
      ...old,
      heartburn,
      heatTier: tier,
      isOverheated: warningActive,
      overheatWarningActive: warningActive,
      overheatPenaltyActive: penaltyActive,
      heatMultiplier: warningActive
        ? getHeatMultiplier("CRITICAL") * getHeatGameplayModifiers(MAX_HEARTBURN).scoreMultiplier
        : getHeatMultiplier(tier),
      overheatRemainingMs: warningActive ? Math.max(0, warningEndsAtRef.current - Date.now()) : 0,
      antacidProtectionRemainingMs: Math.max(0, heatProtectionEndsAtRef.current - Date.now()),
      freshStomachRemainingMs: Math.max(0, freshStomachEndsAtRef.current - Date.now()),
      freshStomachMultiplier: freshStomachEndsAtRef.current > Date.now() ? FRESH_STOMACH_SCORE_MULTIPLIER : 1,
      canUseAntacid: canConsumeAntacid(old.antacidCount, statusRef.current, heartburn, heatProtectionEndsAtRef.current, Date.now()),
      ...extra,
    }));
  }, []);

  const announceTierChange = useCallback((oldTier: HeatTier, newTier: HeatTier) => {
    if (oldTier === newTier) return;
    logEvent(`HEARTBURN TIER: ${oldTier} -> ${newTier}`);
    const events = [createEvent("HEARTBURN_TIER_CHANGED", { fromTier: oldTier, toTier: newTier })];
    if (newTier === "CRITICAL") {
      events.push(createEvent("CRITICAL_WARNING"));
      if (!criticalCycleActiveRef.current) {
        criticalCycleActiveRef.current = true;
        perfectCooldownEligibleRef.current = true;
      }
    }
    emitEvents(...events);
  }, [createEvent, emitEvents, logEvent]);

  const finishOverheatPenalty = useCallback((generation: number) => {
    if (generation !== matchGenerationRef.current || statusRef.current !== "PLAYING") return;
    penaltyTimerRef.current = null;
    penaltyEndsAtRef.current = 0;
    emitEvents(createEvent("OVERHEAT_PENALTY_ENDED"));
    updateHeatState(heartburnRef.current, { overheatPenaltyActive: false });
  }, [createEvent, emitEvents, updateHeatState]);

  const applyOverheatPenalty = useCallback((generation: number) => {
    if (generation !== matchGenerationRef.current || statusRef.current !== "PLAYING") return;
    warningTimerRef.current = null;
    warningEndsAtRef.current = 0;
    const now = Date.now();
    const comboBefore = comboRef.current;
    comboRef.current = getOverheatCombo(comboBefore, now, lastOverheatAtRef.current);
    lastOverheatAtRef.current = now;
    perfectCooldownEligibleRef.current = false;
    criticalCycleActiveRef.current = false;
    penaltyEndsAtRef.current = now + OVERHEAT_PENALTY_MS;
    heatProtectionEndsAtRef.current = penaltyEndsAtRef.current;
    heartburnRef.current = OVERHEAT_RESET_HEAT;
    heatTierRef.current = getHeatTier(OVERHEAT_RESET_HEAT);
    logEvent("OVERHEAT PENALTY");
    emitEvents(
      createEvent("OVERHEATED", { comboBefore, comboAfter: comboRef.current }),
      createEvent("OVERHEAT_PENALTY_STARTED", { comboBefore, comboAfter: comboRef.current }),
    );
    setState((old) => ({
      ...old,
      combo: comboRef.current,
      heartburn: OVERHEAT_RESET_HEAT,
      heatTier: getHeatTier(OVERHEAT_RESET_HEAT),
      isOverheated: false,
      overheatWarningActive: false,
      overheatPenaltyActive: true,
      heatMultiplier: getHeatMultiplier(getHeatTier(OVERHEAT_RESET_HEAT)),
      overheatRemainingMs: 0,
      antacidProtectionRemainingMs: OVERHEAT_PENALTY_MS,
      canUseAntacid: false,
    }));
    clearPenaltyTimer();
    penaltyEndsAtRef.current = now + OVERHEAT_PENALTY_MS;
    penaltyTimerRef.current = setTimeout(() => finishOverheatPenalty(generation), OVERHEAT_PENALTY_MS);
  }, [clearPenaltyTimer, createEvent, emitEvents, finishOverheatPenalty, logEvent]);

  const startOverheatWarning = useCallback(() => {
    if (warningTimerRef.current || warningEndsAtRef.current > 0 || statusRef.current !== "PLAYING") return;
    const generation = matchGenerationRef.current;
    warningEndsAtRef.current = Date.now() + OVERHEAT_WARNING_DURATION_MS;
    perfectCooldownEligibleRef.current = false;
    logEvent("OVERHEAT WARNING START");
    emitEvents(createEvent("OVERHEAT_WARNING_STARTED"));
    updateHeatState(MAX_HEARTBURN, {
      isOverheated: true,
      overheatWarningActive: true,
      overheatRemainingMs: OVERHEAT_WARNING_DURATION_MS,
    });
    warningTimerRef.current = setTimeout(() => applyOverheatPenalty(generation), OVERHEAT_WARNING_DURATION_MS);
  }, [applyOverheatPenalty, createEvent, emitEvents, logEvent, updateHeatState]);

  const applyNaturalCooling = useCallback((elapsedMs: number, now: number) => {
    if (
      statusRef.current !== "PLAYING"
      || warningEndsAtRef.current > now
      || heartburnRef.current <= 0
      || lastTapRef.current === 0
      || now - lastTapRef.current < COOLING_DELAY_MS
    ) return;
    const oldHeat = heartburnRef.current;
    const oldTier = heatTierRef.current;
    const nextHeat = coolHeartburn(oldHeat, elapsedMs);
    if (nextHeat === oldHeat) return;
    heartburnRef.current = nextHeat;
    const nextTier = getHeatTier(nextHeat);
    heatTierRef.current = nextTier;
    if (shouldAwardPerfectCooldown(
      perfectCooldownEligibleRef.current,
      criticalCycleActiveRef.current,
      oldHeat,
      nextHeat,
    )) {
      perfectCooldownEligibleRef.current = false;
      scoreRef.current += PERFECT_COOLDOWN_BONUS;
      logEvent("PERFECT COOLDOWN");
      emitEvents(createEvent("PERFECT_COOLDOWN"));
    }
    if (nextHeat < PERFECT_COOLDOWN_THRESHOLD && !perfectCooldownEligibleRef.current) {
      criticalCycleActiveRef.current = false;
    }
    announceTierChange(oldTier, nextTier);
    if (now - lastCoolingRenderAtRef.current >= COOLING_RENDER_INTERVAL_MS || nextHeat === 0) {
      lastCoolingRenderAtRef.current = now;
      setState((old) => ({
        ...old,
        score: Math.floor(scoreRef.current),
        heartburn: nextHeat,
        heatTier: nextTier,
        heatMultiplier: getHeatMultiplier(nextTier),
        antacidProtectionRemainingMs: Math.max(0, heatProtectionEndsAtRef.current - now),
        freshStomachRemainingMs: Math.max(0, freshStomachEndsAtRef.current - now),
        freshStomachMultiplier: freshStomachEndsAtRef.current > now ? FRESH_STOMACH_SCORE_MULTIPLIER : 1,
        canUseAntacid: canConsumeAntacid(old.antacidCount, statusRef.current, nextHeat, heatProtectionEndsAtRef.current, now),
      }));
    }
  }, [announceTierChange, createEvent, emitEvents, logEvent]);

  const startCoolingLoop = useCallback(() => {
    if (coolingFrameRef.current !== null) cancelAnimationFrame(coolingFrameRef.current);
    lastCoolingFrameAtRef.current = Date.now();
    const generation = matchGenerationRef.current;
    const frame = () => {
      if (!mountedRef.current || generation !== matchGenerationRef.current || statusRef.current !== "PLAYING") {
        coolingFrameRef.current = null;
        return;
      }
      const now = Date.now();
      const elapsed = Math.max(0, now - lastCoolingFrameAtRef.current);
      lastCoolingFrameAtRef.current = now;
      applyNaturalCooling(elapsed, now);
      if (warningEndsAtRef.current > now && now - lastWarningRenderAtRef.current >= COOLING_RENDER_INTERVAL_MS) {
        lastWarningRenderAtRef.current = now;
        setState((old) => ({
          ...old,
          overheatRemainingMs: Math.max(0, warningEndsAtRef.current - now),
        }));
      }
      coolingFrameRef.current = requestAnimationFrame(frame);
    };
    coolingFrameRef.current = requestAnimationFrame(frame);
  }, [applyNaturalCooling]);

  const addHeartburn = useCallback((amount = resolvedBiteHeat): boolean => {
    const now = Date.now();
    if (statusRef.current !== "PLAYING" || warningEndsAtRef.current > now) return false;
    if (heatProtectionEndsAtRef.current > now) return true;
    const oldTier = heatTierRef.current;
    const nextHeartburn = applyHeatGain(
      heartburnRef.current,
      amount,
      matchStats.heatGenerationMultiplier,
      heatProtectionEndsAtRef.current,
      now,
    );
    heartburnRef.current = nextHeartburn;
    const nextTier = getHeatTier(nextHeartburn);
    heatTierRef.current = nextTier;
    announceTierChange(oldTier, nextTier);
    if (nextHeartburn >= MAX_HEARTBURN) startOverheatWarning();
    else updateHeatState(nextHeartburn);
    return true;
  }, [announceTierChange, matchStats.heatGenerationMultiplier, resolvedBiteHeat, startOverheatWarning, updateHeatState]);

  const addCompletedFoodHeartburn = useCallback(
    () => addHeartburn(COMPLETED_FOOD_HEARTBURN_BONUS),
    [addHeartburn],
  );

  const applyAntacid = useCallback((): boolean => {
    const now = Date.now();
    if (
      antacidProcessingRef.current
      || !canConsumeAntacid(antacidCountRef.current, statusRef.current, heartburnRef.current, heatProtectionEndsAtRef.current, now)
    ) return false;
    antacidProcessingRef.current = true;
    const warningSave = warningEndsAtRef.current > now;
    clearWarningTimer();
    perfectCooldownEligibleRef.current = false;
    lastWarningRenderAtRef.current = 0;
    criticalCycleActiveRef.current = false;
    const oldCount = antacidCountRef.current;
    const result = consumeAntacid(oldCount, heartburnRef.current, now);
    if (!result) {
      antacidProcessingRef.current = false;
      return false;
    }
    antacidCountRef.current = result.inventory;
    heatProtectionEndsAtRef.current = result.heatShieldUntil;
    freshStomachEndsAtRef.current = result.freshStomachUntil;
    const reduction = result.heatReduction;
    const nextHeat = result.heat;
    heartburnRef.current = nextHeat;
    heatTierRef.current = getHeatTier(nextHeat);
    logEvent(`${warningSave ? "ANTACID SAVE" : "ANTACID USED"} (-${reduction} HEAT)`);
    logEvent(`ANTACID INVENTORY: ${oldCount} -> ${antacidCountRef.current}`);
    emitEvents(
      createEvent("ANTACID_USED", { heatReduction: reduction }),
      ...(warningSave ? [createEvent("ANTACID_SAVE", { heatReduction: reduction })] : []),
    );
    setState((old) => ({
      ...old,
      heartburn: nextHeat,
      heatTier: getHeatTier(nextHeat),
      isOverheated: false,
      overheatWarningActive: false,
      heatMultiplier: getHeatMultiplier(getHeatTier(nextHeat)),
      overheatRemainingMs: 0,
      antacidCount: antacidCountRef.current,
      canUseAntacid: false,
      antacidProtectionRemainingMs: HEAT_SHIELD_DURATION_MS,
      freshStomachRemainingMs: FRESH_STOMACH_DURATION_MS,
      freshStomachMultiplier: FRESH_STOMACH_SCORE_MULTIPLIER,
    }));
    antacidProcessingRef.current = false;
    return true;
  }, [clearWarningTimer, createEvent, emitEvents, logEvent]);

  const resetMatch = useCallback(() => {
    stopAllTimers();
    matchGenerationRef.current += 1;
    scoreRef.current = 0;
    comboRef.current = 0;
    acceptedActionSequenceRef.current = 0;
    acceptedTapCountRef.current = 0;
    lastTapRef.current = 0;
    heartburnRef.current = 0;
    heatTierRef.current = "COOL";
    timeRemainingRef.current = resolvedMatchDuration;
    statusRef.current = "IDLE";
    heatProtectionEndsAtRef.current = 0;
    freshStomachEndsAtRef.current = 0;
    warningEndsAtRef.current = 0;
    penaltyEndsAtRef.current = 0;
    lastOverheatAtRef.current = 0;
    criticalCycleActiveRef.current = false;
    perfectCooldownEligibleRef.current = false;
    lastWarningRenderAtRef.current = 0;
    lastCoolingRenderAtRef.current = 0;
    antacidProcessingRef.current = false;
    currentOpponentRef.current = authoritativeOpponent ?? getRandomOpponent();
    opponentStateRef.current = createOpponentState();
    setOpponentScore(0);
    setTimeRemaining(resolvedMatchDuration);
    setShowCountdown(false);
    setCountdownValue(3);
    setPresentationEvents([]);
    setState(initialState(antacidCountRef.current));
  }, [authoritativeOpponent, resolvedMatchDuration, stopAllTimers]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      matchGenerationRef.current += 1;
      stopAllTimers();
    };
  }, [stopAllTimers]);

  useEffect(() => {
    if (
      inventoryHydratedRef.current
      || initialAntacidCount === undefined
      || !Number.isFinite(initialAntacidCount)
    ) return;
    const hydratedCount = Math.max(0, Math.floor(initialAntacidCount));
    inventoryHydratedRef.current = true;
    antacidCountRef.current = hydratedCount;
    setState((old) => ({ ...old, antacidCount: hydratedCount }));
  }, [initialAntacidCount]);

  useEffect(() => {
    if (matchKeyRef.current === matchKey) return;
    matchKeyRef.current = matchKey;
    inventoryHydratedRef.current = false;
    resetMatch();
  }, [matchKey, resetMatch]);

  const endGame = useCallback(() => {
    stopAllTimers();
    statusRef.current = "FINISHED";
    const finalOpponentScore = opponentConfig?.finalScore
      ?? Math.floor(opponentStateRef.current.score);
    opponentStateRef.current = {
      ...opponentStateRef.current,
      score: finalOpponentScore,
    };
    setOpponentScore(finalOpponentScore);
    setState((old) => ({
      ...old,
      status: "FINISHED",
      canUseAntacid: false,
      isOverheated: false,
      overheatWarningActive: false,
      overheatPenaltyActive: false,
      overheatRemainingMs: 0,
      antacidProtectionRemainingMs: 0,
      freshStomachRemainingMs: 0,
      freshStomachMultiplier: 1,
    }));
  }, [opponentConfig?.finalScore, stopAllTimers]);

  const startOpponentLoop = useCallback(() => {
    if (opponentTimerRef.current) clearInterval(opponentTimerRef.current);
    opponentTimerRef.current = setInterval(() => {
      if (opponentConfig) {
        const elapsedSeconds = resolvedMatchDuration - timeRemainingRef.current;
        const score = authoritativeOpponentScoreAtElapsed(
          opponentConfig,
          elapsedSeconds,
        );
        opponentStateRef.current = { ...opponentStateRef.current, score };
        setOpponentScore(score);
        return;
      }
      opponentStateRef.current = updateOpponent(
        currentOpponentRef.current,
        opponentStateRef.current,
        {
          timeRemaining: timeRemainingRef.current,
          matchDuration: resolvedMatchDuration,
          playerScore: scoreRef.current,
          now: Date.now(),
        },
      );
      setOpponentScore(Math.floor(opponentStateRef.current.score));
    }, 300);
  }, [opponentConfig, resolvedMatchDuration]);

  const startMatchIntro = useCallback(() => {
    if (statusRef.current !== "IDLE") return;
    resetMatch();
    statusRef.current = "MATCH_INTRO";
    setState((old) => ({ ...old, status: "MATCH_INTRO" }));
  }, [resetMatch]);

  const startGame = useCallback(() => {
    if (statusRef.current !== "IDLE" && statusRef.current !== "MATCH_INTRO") return;
    if (statusRef.current === "IDLE") resetMatch();
    statusRef.current = "COUNTDOWN";
    setState((old) => ({ ...initialState(old.antacidCount), status: "COUNTDOWN" }));
    setShowCountdown(true);
    setCountdownValue(3);
    let countdown = COUNTDOWN_SECONDS;
    countdownTimerRef.current = setInterval(() => {
      countdown -= 1;
      setCountdownValue(countdown > 0 ? countdown : "GO");
      if (countdown > 0) return;
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
      countdownHideTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setShowCountdown(false);
        countdownHideTimerRef.current = null;
      }, 700);
      statusRef.current = "PLAYING";
      setState((old) => ({ ...old, status: "PLAYING" }));
      startOpponentLoop();
      startCoolingLoop();
      gameTimerRef.current = setInterval(() => {
        const now = Date.now();
        setState((old) => ({
          ...old,
          antacidProtectionRemainingMs: Math.max(0, heatProtectionEndsAtRef.current - now),
          freshStomachRemainingMs: Math.max(0, freshStomachEndsAtRef.current - now),
          freshStomachMultiplier: freshStomachEndsAtRef.current > now ? FRESH_STOMACH_SCORE_MULTIPLIER : 1,
        }));
        const nextTime = Math.max(0, timeRemainingRef.current - 1);
        timeRemainingRef.current = nextTime;
        setTimeRemaining(nextTime);
        // Never schedule the terminal state transition from inside another
        // React state updater. React may replay or discard updater work while
        // still committing the visible 0:00 clock.
        if (nextTime === 0) endGame();
      }, 1000);
    }, 1000);
  }, [endGame, resetMatch, startCoolingLoop, startOpponentLoop]);

  const tap = useCallback((): number | null => {
    if (statusRef.current !== "PLAYING") return null;
    const now = Date.now();
    const tapPower = effectiveTapPower(matchStats, heartburnRef.current);
    acceptedTapCountRef.current += 1;
    // Weighted progress remains authoritative gameplay telemetry. Keep it
    // numerically stable while the presentation layer uses the discrete,
    // accepted input count returned below.
    acceptedActionSequenceRef.current = Math.round((acceptedActionSequenceRef.current + tapPower) * 1_000_000) / 1_000_000;
    const acceptedActionSequence = acceptedActionSequenceRef.current;
    const delta = lastTapRef.current === 0 ? 0 : now - lastTapRef.current;
    lastTapRef.current = now;
    const comboWindowMs = effectiveComboWindowMs(
      matchStats.comboWindowMs,
      heartburnRef.current,
    );
    comboRef.current = delta > 0 && delta <= comboWindowMs ? comboRef.current + 1 : 0;
    let gain = comboRef.current >= 20 ? 3 : comboRef.current >= 10 ? 2 : comboRef.current >= 5 ? 1.5 : 1;
    if (heatProtectionEndsAtRef.current <= now && warningEndsAtRef.current <= now) {
      const oldTier = heatTierRef.current;
      const nextHeat = applyHeatGain(
        heartburnRef.current,
        resolvedBiteHeat,
        matchStats.heatGenerationMultiplier,
        heatProtectionEndsAtRef.current,
        now,
      );
      heartburnRef.current = nextHeat;
      const nextTier = getHeatTier(nextHeat);
      heatTierRef.current = nextTier;
      announceTierChange(oldTier, nextTier);
      if (nextHeat >= MAX_HEARTBURN) startOverheatWarning();
    }
    const warningActive = warningEndsAtRef.current > now;
    const penaltyActive = penaltyEndsAtRef.current > now;
    const multiplier = warningActive
      ? getHeatMultiplier("CRITICAL")
      : getHeatMultiplier(heatTierRef.current);
    scoreRef.current += calculateTapScore(
      gain,
      multiplier,
      matchStats,
      freshStomachEndsAtRef.current > now,
      heartburnRef.current,
      tapPower,
    );
    setState((old) => ({
      ...old,
      score: Math.floor(scoreRef.current),
      combo: comboRef.current,
      acceptedTapCount: acceptedTapCountRef.current,
      completedProgress: acceptedActionSequence,
      heartburn: heartburnRef.current,
      heatTier: warningActive ? "OVERHEATED" : heatTierRef.current,
      isOverheated: warningActive,
      overheatWarningActive: warningActive,
      overheatPenaltyActive: penaltyActive,
      heatMultiplier: multiplier * getHeatGameplayModifiers(heartburnRef.current).scoreMultiplier,
      overheatRemainingMs: Math.max(0, warningEndsAtRef.current - now),
      antacidProtectionRemainingMs: Math.max(0, heatProtectionEndsAtRef.current - now),
      freshStomachRemainingMs: Math.max(0, freshStomachEndsAtRef.current - now),
      freshStomachMultiplier: freshStomachEndsAtRef.current > now ? FRESH_STOMACH_SCORE_MULTIPLIER : 1,
      canUseAntacid: canConsumeAntacid(old.antacidCount, statusRef.current, heartburnRef.current, heatProtectionEndsAtRef.current, now),
    }));
    debugLog("TAP", scoreRef.current, comboRef.current, heartburnRef.current);
    return acceptedTapCountRef.current;
  }, [announceTierChange, matchStats, resolvedBiteHeat, startOverheatWarning]);

  const didDraw = state.score === opponentScore;
  const winner = didDraw ? "DRAW" : state.score > opponentScore ? "PLAYER" : "OPPONENT";

  return {
    state,
    currentOpponent: currentOpponentRef.current,
    timeRemaining,
    opponentScore,
    opponentBehavior: opponentStateRef.current.behavior,
    opponentCombo: opponentStateRef.current.combo,
    winner,
    showCountdown,
    countdownValue,
    startGame,
    startMatchIntro,
    tap,
    heartburn: state.heartburn,
    heatTier: state.heatTier,
    isOverheated: state.isOverheated,
    overheatWarningActive: state.overheatWarningActive,
    overheatPenaltyActive: state.overheatPenaltyActive,
    heatMultiplier: state.heatMultiplier,
    overheatRemainingMs: state.overheatRemainingMs,
    antacidCount: state.antacidCount,
    canUseAntacid: state.canUseAntacid,
    antacidProtectionRemainingMs: state.antacidProtectionRemainingMs,
    presentationEvents,
    matchStats,
    resolvedBiteHeat,
    addHeartburn,
    addCompletedFoodHeartburn,
    applyAntacid,
  };
}
