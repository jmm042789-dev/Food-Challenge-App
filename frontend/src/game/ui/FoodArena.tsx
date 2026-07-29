import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { getFoodArtwork } from "../../assets/foodArtwork";
import type { BiteMechanic } from "../../api";
import type { FoodBiteReaction, FoodProfile } from "../food/FoodProfiles";
import type { HeatTier } from "../heartburn";
import type { FoodMechanicType } from "../../achievements/AchievementTypes";
import BurgerHeavyBiteOverlay from "./BurgerHeavyBiteOverlay";
import CheesePullOverlay from "./CheesePullOverlay";
import HeatRushOverlay, { type HeatRushHandle } from "./HeatRushOverlay";
import HotDogSpeedSprintOverlay, { type HotDogSpeedSprintHandle } from "./HotDogSpeedSprintOverlay";
import ImpactEffect from "./ImpactEffect";
import NoodleSlurpOverlay from "./NoodleSlurpOverlay";
import TacoStabilityOverlay, { type TacoStabilityHandle } from "./TacoStabilityOverlay";
import GameplayActionZone, { GAMEPLAY_ACTION_ZONE_HEIGHT } from "./GameplayActionZone";

type Props = {
  contestId: string;
  combo: number;
  timeRemaining: number;
  resetKey?: string;
  active?: boolean;
  foodProfile: FoodProfile;
  foodName?: string;
  biteMechanic?: BiteMechanic;
  heatTier: HeatTier;
  overheatWarningActive: boolean;
  onAcceptedAction: () => number | null;
  onMechanicCompleted?: (mechanicType: FoodMechanicType) => void;
};

export const FOOD_ARENA_ACTION_HEIGHT = GAMEPLAY_ACTION_ZONE_HEIGHT;

type ImpactTier = 0 | 1 | 2 | 3;

const getImpactTier = (combo: number): ImpactTier => {
  if (combo >= 20) return 3;
  if (combo >= 10) return 2;
  if (combo >= 5) return 1;
  return 0;
};

type BiteStylePresentation = {
  compression: number;
  recovery: number;
  rotation: number;
  shake: number;
  flash: number;
  effect: number;
};

const BITE_STYLE_PRESENTATION: Record<FoodProfile["biteStyle"], BiteStylePresentation> = {
  heavy: { compression: 1.18, recovery: 1.15, rotation: 0.65, shake: 0.9, flash: 1, effect: 1.05 },
  quick: { compression: 0.85, recovery: 0.9, rotation: 0.85, shake: 0.9, flash: 0.95, effect: 0.95 },
  rapid: { compression: 0.65, recovery: 0.78, rotation: 0.55, shake: 0.75, flash: 0.85, effect: 0.85 },
  wobble: { compression: 0.95, recovery: 1, rotation: 1.35, shake: 1.25, flash: 1, effect: 1 },
  slurp: { compression: 0.8, recovery: 1.05, rotation: 0.7, shake: 0.8, flash: 0.9, effect: 0.9 },
  spicy: { compression: 1.05, recovery: 1, rotation: 1, shake: 1, flash: 1.25, effect: 1.2 },
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const CRUMBS = [
  { x: -48, y: -18, size: 4 },
  { x: -34, y: -40, size: 3 },
  { x: -16, y: -53, size: 5 },
  { x: 18, y: -50, size: 3 },
  { x: 39, y: -35, size: 4 },
  { x: 51, y: -14, size: 3 },
  { x: -54, y: 7, size: 3 },
  { x: 55, y: 10, size: 4 },
] as const;
const PRESENTATION_BITES_PER_ITEM = 10;
const COMPLETION_BURST = require("../../assets/ui/effects/combo-explosion.png");
const DESSERT_SPARKLE = require("../../assets/ui/effects/sparkle.png");
const DESSERT_BITE_REACTION: FoodBiteReaction = {
  palette: ["#FFF0DF", "#F4A8C5", "#8ED5E8"],
  shape: "fleck",
  spread: 1.04,
  shineColor: "#FFF7EA",
};
const PASTRAMI_BITE_REACTION: FoodBiteReaction = {
  palette: ["#D98265", "#F0C080", "#A94C3E"],
  shape: "crumb",
  spread: 1.02,
  shineColor: "#FFE0B0",
};
const FOOD_SEGMENTS = [
  { column: 0, row: 0 },
  { column: 1, row: 0 },
  { column: 0, row: 1 },
  { column: 1, row: 1 },
] as const;
const SEGMENT_REMOVAL_ORDER: Record<FoodProfile["biteStyle"], readonly number[]> = {
  heavy: [1, 3, 0, 2],
  quick: [1, 0, 3, 2],
  rapid: [3, 2, 1, 0],
  wobble: [0, 1, 2, 3],
  slurp: [1, 3, 0, 2],
  spicy: [3, 1, 2, 0],
};
const SEGMENT_REMOVAL_THRESHOLDS = [0.2, 0.44, 0.68, 0.9] as const;

type FoodPresentationEvent = {
  id: number;
  type: "ITEM_COMPLETED";
};

const EMBERS = [
  { left: "12%", delay: 0, duration: 2100, size: 4 },
  { left: "23%", delay: 480, duration: 2700, size: 3 },
  { left: "38%", delay: 850, duration: 2300, size: 5 },
  { left: "56%", delay: 250, duration: 2900, size: 3 },
  { left: "69%", delay: 1100, duration: 2500, size: 4 },
  { left: "83%", delay: 650, duration: 3100, size: 3 },
] as const;

function createLoop(
  value: Animated.Value,
  duration: number,
  delay = 0,
) {
  return Animated.loop(
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(value, {
        toValue: 1,
        duration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
      Animated.timing(value, {
        toValue: 0,
        duration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    ]),
  );
}

function createRisingLoop(
  value: Animated.Value,
  duration: number,
  delay = 0,
) {
  return Animated.loop(
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(value, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(value, {
        toValue: 0,
        duration: 1,
        useNativeDriver: true,
      }),
    ]),
  );
}

function FoodArena({
  contestId,
  combo,
  timeRemaining,
  resetKey = contestId,
  active = true,
  foodProfile,
  foodName,
  biteMechanic,
  heatTier,
  overheatWarningActive,
  onAcceptedAction,
  onMechanicCompleted,
}: Props) {
  const { width, height } = useWindowDimensions();
  const [foodRegionHeight, setFoodRegionHeight] = useState(0);

  const size = Math.min(
    Math.max(150, width * 0.62),
    Math.max(150, height * 0.31),
    Math.max(128, (foodRegionHeight || height * 0.4) - 34),
    292,
  );
  const foodHitSlop = Math.round(clamp(size * 0.1, 18, 28));

  const foodArtwork = getFoodArtwork(contestId);

  const impactScaleX = useRef(new Animated.Value(1)).current;
  const impactScaleY = useRef(new Animated.Value(1)).current;
  const holdPresentationScale = useRef(new Animated.Value(1)).current;
  const consumptionScale = useRef(new Animated.Value(1)).current;
  const consumptionProgress = useRef(new Animated.Value(0)).current;
  const completionBurst = useRef(new Animated.Value(0)).current;
  const impactRotation = useRef(new Animated.Value(0)).current;

  const idleY = useRef(new Animated.Value(0)).current;
  const idleBreath = useRef(new Animated.Value(0)).current;
  const idleRotation = useRef(new Animated.Value(0)).current;

  const shakeX = useRef(new Animated.Value(0)).current;
  const haloIntensity = useRef(new Animated.Value(0)).current;
  const haloPulse = useRef(new Animated.Value(0)).current;
  const urgency = useRef(new Animated.Value(0)).current;

  const crumbProgress = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;
  const hitFlash = useRef(new Animated.Value(0)).current;
  const floorPulse = useRef(new Animated.Value(0)).current;

  const steamA = useRef(new Animated.Value(0)).current;
  const steamB = useRef(new Animated.Value(0)).current;
  const steamC = useRef(new Animated.Value(0)).current;

  const emberA = useRef(new Animated.Value(0)).current;
  const emberB = useRef(new Animated.Value(0)).current;
  const emberC = useRef(new Animated.Value(0)).current;
  const emberD = useRef(new Animated.Value(0)).current;
  const emberE = useRef(new Animated.Value(0)).current;
  const emberF = useRef(new Animated.Value(0)).current;

  const biteAnimation =
    useRef<Animated.CompositeAnimation | null>(null);
  const completionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const biteCounter = useRef(0);
  const performBiteRef = useRef<() => number | null>(() => null);
  const heavyBiteActiveRef = useRef(false);
  const cheesePullActiveRef = useRef(false);
  const noodleSlurpActiveRef = useRef(false);
  const heatRushRef = useRef<HeatRushHandle>(null);
  const hotDogSpeedSprintRef = useRef<HotDogSpeedSprintHandle>(null);
  const tacoStabilityRef = useRef<TacoStabilityHandle>(null);

  const [reducedMotion, setReducedMotion] = useState(false);
  const [biteEvent, setBiteEvent] = useState(0);
  const [foodPresentationEvent, setFoodPresentationEvent] = useState<FoodPresentationEvent | null>(null);
  const [heavyBiteActive, setHeavyBiteActive] = useState(false);
  const [cheesePullActive, setCheesePullActive] = useState(false);
  const [noodleSlurpActive, setNoodleSlurpActive] = useState(false);
  const [tacoStability, setTacoStability] = useState(1);

  const normalizedFoodName = (foodName ?? foodProfile.displayName).toLowerCase();
  const dessertFood = /dessert|ice cream|cake|cookie/.test(normalizedFoodName);
  const pastramiFood = /pastrami|sandwich/.test(normalizedFoodName);
  const hotFood = foodProfile.biteStyle === "spicy" || /hot dog|pizza|pastrami|wing|spicy/.test(normalizedFoodName);
  const biteReaction = dessertFood
    ? DESSERT_BITE_REACTION
    : pastramiFood
      ? PASTRAMI_BITE_REACTION
      : foodProfile.biteReaction;
  const heavyBiteMechanic =
    foodProfile.specialMechanic?.type === "heavy_bite"
      ? foodProfile.specialMechanic
      : null;
  const heavyBiteInterval = heavyBiteMechanic
    ? Math.max(1, Math.round(heavyBiteMechanic.triggerEveryBites))
    : null;
  const cheesePullInterval =
    foodProfile.id === "pizza" && foodProfile.specialMechanic?.type === "cheese_pull"
      ? Math.max(1, Math.round(foodProfile.specialMechanic.triggerEveryBites))
      : null;
  const tacoStabilityInterval =
    foodProfile.specialMechanic?.type === "shell_stability"
      ? Math.max(1, Math.round(foodProfile.specialMechanic.triggerEveryBites))
      : null;
  const noodleSlurpInterval =
    foodProfile.specialMechanic?.type === "noodle_slurp"
      ? Math.max(1, Math.round(foodProfile.specialMechanic.triggerEveryBites))
      : null;
  const speedSprintMechanic =
    foodProfile.specialMechanic?.type === "speed_sprint"
      ? foodProfile.specialMechanic
      : null;
  const speedSprintInterval = speedSprintMechanic
    ? Math.max(1, Math.round(speedSprintMechanic.triggerEveryBites))
    : null;
  const heatRushMechanic =
    foodProfile.specialMechanic?.type === "heat_rush"
      ? foodProfile.specialMechanic
      : null;
  const heatRushInterval = heatRushMechanic
    ? Math.max(1, Math.round(heatRushMechanic.triggerEveryBites))
    : null;

  const comboTier =
    combo >= 30
      ? 5
      : combo >= 20
        ? 4
        : combo >= 15
          ? 3
          : combo >= 10
            ? 2
            : combo >= 5
              ? 1
              : 0;
  const impactTier = getImpactTier(combo);
  const stylePresentation = dessertFood
    ? { compression: 0.78, recovery: 0.82, rotation: 0.35, shake: 0.55, flash: 0.82, effect: 0.9 }
    : BITE_STYLE_PRESENTATION[foodProfile.biteStyle];
  const animationSpeed = clamp(foodProfile.biteAnimationSpeed, 0.75, 1.4);
  const cameraPunch = clamp(foodProfile.cameraPunch, 0.7, 1.3);
  const foodWobble = clamp(foodProfile.foodWobble, 0, 1);
  const tacoInstability = tacoStabilityInterval ? 1 - tacoStability : 0;
  const wobbleMovement = clamp(
    0.75 + foodWobble * 0.5 + (reducedMotion ? 0 : tacoInstability * 0.18),
    0.75,
    1.43,
  );
  const speedDuration = (baseDuration: number): number =>
    Math.round(clamp(baseDuration / animationSpeed, 18, 420));
  const compressionDepth = clamp(
    (0.055 + impactTier * 0.018) * cameraPunch * stylePresentation.compression,
    0.025,
    0.12,
  );
  const compression = reducedMotion ? 0.985 : 1 - compressionDepth;
  const shakeDistance = reducedMotion
    ? 0
    : clamp((1.8 + impactTier * 1.2) * cameraPunch * wobbleMovement * stylePresentation.shake, 0, 6.5);
  const rotationDistance = reducedMotion
    ? 0
    : clamp((1.45 + impactTier * 0.28) * wobbleMovement * stylePresentation.rotation, 0, 3.2);
  const recoveryTension = clamp(275 * animationSpeed / stylePresentation.recovery, 210, 360);
  const flashIntensity = clamp(cameraPunch * stylePresentation.flash, 0.7, 1.5);
  const effectIntensity = clamp(cameraPunch * stylePresentation.effect, 0.7, 1.5);
  const hitFlashOpacity = clamp((0.32 + impactTier * 0.07) * flashIntensity, 0.24, 0.62);
  const hitFlashScale = clamp(1 + (0.12 + impactTier * 0.08) * flashIntensity, 1.08, 1.48);
  const impactEffectSize = clamp((0.64 + impactTier * 0.07) * effectIntensity, 0.52, 0.92);
  const crumbDistance = reducedMotion
    ? 0
    : (1 + impactTier * 0.12) * biteReaction.spread;

  const steamValues = useMemo(
    () => [steamA, steamB, steamC] as const,
    [steamA, steamB, steamC],
  );

  const emberValues = useMemo(
    () =>
      [
        emberA,
        emberB,
        emberC,
        emberD,
        emberE,
        emberF,
      ] as const,
    [emberA, emberB, emberC, emberD, emberE, emberF],
  );

  const foodRotation = useMemo(
    () => Animated.add(
      impactRotation,
      idleRotation.interpolate({
        inputRange: [0, 1],
        outputRange: [-0.9, 0.9],
      }),
    ).interpolate({
      inputRange: [-4, 4],
      outputRange: ["-4deg", "4deg"],
    }),
    [idleRotation, impactRotation],
  );

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!mounted) {
        return;
      }

      setReducedMotion(enabled);

      if (enabled) {
        idleY.setValue(0);
        idleBreath.setValue(0);
        idleRotation.setValue(0.5);
      }
    });

    return () => {
      mounted = false;
    };
  }, [idleBreath, idleRotation, idleY]);

  useEffect(() => {
    if (!active || reducedMotion) {
      Animated.parallel([
        Animated.timing(idleY, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(idleBreath, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();

      return;
    }

    const animations: Animated.CompositeAnimation[] = [
      createLoop(idleY, 2800),
      createLoop(idleBreath, 3600, 160),
      createLoop(idleRotation, 4200, 280),
      createLoop(shine, 3300, 450),
      createLoop(haloPulse, 1800),
      createLoop(floorPulse, 2100),

      ...emberValues.map((value, index) =>
        createRisingLoop(
          value,
          EMBERS[index].duration,
          EMBERS[index].delay,
        ),
      ),

      ...(hotFood
        ? [
            createRisingLoop(steamA, 2400),
            createRisingLoop(steamB, 2800, 500),
            createRisingLoop(steamC, 3200, 900),
          ]
        : []),
    ];

    animations.forEach((animation) => animation.start());

    return () => {
      animations.forEach((animation) => animation.stop());
    };
  }, [
    active,
    emberValues,
    floorPulse,
    haloPulse,
    hotFood,
    idleBreath,
    idleRotation,
    idleY,
    reducedMotion,
    shine,
    steamA,
    steamB,
    steamC,
  ]);

  useEffect(() => {
    biteAnimation.current?.stop();
    biteAnimation.current = null;

    biteCounter.current = 0;
    heavyBiteActiveRef.current = false;
    cheesePullActiveRef.current = false;
    noodleSlurpActiveRef.current = false;

    impactScaleX.stopAnimation();
    impactScaleY.stopAnimation();
    holdPresentationScale.stopAnimation();
    consumptionScale.stopAnimation();
    consumptionProgress.stopAnimation();
    completionBurst.stopAnimation();
    impactRotation.stopAnimation();
    shakeX.stopAnimation();
    crumbProgress.stopAnimation();
    hitFlash.stopAnimation();

    impactScaleX.setValue(0.9);
    impactScaleY.setValue(0.86);
    holdPresentationScale.setValue(1);
    consumptionScale.setValue(1);
    consumptionProgress.setValue(0);
    completionBurst.setValue(0);
    impactRotation.setValue(0);
    shakeX.setValue(0);
    crumbProgress.setValue(0);
    hitFlash.setValue(0);

    setBiteEvent(0);
    setFoodPresentationEvent(null);
    if (completionTimer.current) clearTimeout(completionTimer.current);
    setHeavyBiteActive(false);
    setCheesePullActive(false);
    setNoodleSlurpActive(false);
    setTacoStability(1);
    heatRushRef.current?.reset();
    hotDogSpeedSprintRef.current?.reset();

    Animated.parallel([
      Animated.spring(impactScaleX, {
        toValue: 1,
        friction: 7,
        tension: 190,
        useNativeDriver: true,
      }),
      Animated.spring(impactScaleY, {
        toValue: 1,
        friction: 7,
        tension: 190,
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    contestId,
    completionBurst,
    consumptionScale,
    consumptionProgress,
    crumbProgress,
    hitFlash,
    holdPresentationScale,
    impactRotation,
    impactScaleX,
    impactScaleY,
    resetKey,
    shakeX,
  ]);

  useEffect(() => {
    Animated.timing(haloIntensity, {
      toValue: comboTier / 5,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [comboTier, haloIntensity]);

  useEffect(() => {
    urgency.stopAnimation();

    if (
      !active ||
      timeRemaining <= 0 ||
      timeRemaining > 5 ||
      reducedMotion
    ) {
      Animated.timing(urgency, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();

      return;
    }

    urgency.setValue(1);

    Animated.timing(urgency, {
      toValue: 0,
      duration: 540,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [active, reducedMotion, timeRemaining, urgency]);

  useEffect(() => {
    if (combo <= 0 || combo % 5 !== 0) {
      return;
    }

    haloPulse.stopAnimation();
    haloPulse.setValue(1);

    Animated.spring(haloPulse, {
      toValue: 0,
      friction: 5,
      tension: 220,
      useNativeDriver: true,
    }).start();
  }, [combo, haloPulse]);

  useEffect(() => {
    if (active) return;
    if (completionTimer.current) clearTimeout(completionTimer.current);
    completionTimer.current = null;
    setFoodPresentationEvent(null);
    completionBurst.stopAnimation();
    completionBurst.setValue(0);
  }, [active, completionBurst]);

  useEffect(
    () => () => {
      biteAnimation.current?.stop();
      biteAnimation.current = null;
      if (completionTimer.current) clearTimeout(completionTimer.current);

      [
        impactScaleX,
        impactScaleY,
        consumptionScale,
        consumptionProgress,
        completionBurst,
        holdPresentationScale,
        impactRotation,
        idleY,
        idleBreath,
        idleRotation,
        shakeX,
        haloIntensity,
        haloPulse,
        urgency,
        crumbProgress,
        shine,
        hitFlash,
        floorPulse,
        ...steamValues,
        ...emberValues,
      ].forEach((value) => value.stopAnimation());
    },
    [
      completionBurst,
      consumptionScale,
      consumptionProgress,
      crumbProgress,
      emberValues,
      floorPulse,
      haloIntensity,
      haloPulse,
      hitFlash,
      holdPresentationScale,
      idleBreath,
      idleRotation,
      idleY,
      impactRotation,
      impactScaleX,
      impactScaleY,
      shakeX,
      shine,
      steamValues,
      urgency,
    ],
  );

  const completeCheesePull = useCallback((result: "SUCCESS" | "TIMEOUT") => {
    cheesePullActiveRef.current = false;
    setCheesePullActive(false);
    if (result === "SUCCESS") onMechanicCompleted?.("cheese_pull");
  }, [onMechanicCompleted]);

  const completeNoodleSlurp = useCallback((result: "SUCCESS" | "TIMEOUT") => {
    noodleSlurpActiveRef.current = false;
    setNoodleSlurpActive(false);
    if (result === "SUCCESS") onMechanicCompleted?.("noodle_slurp");
  }, [onMechanicCompleted]);

  const completeHeavyBite = useCallback(() => {
    if (!heavyBiteActiveRef.current) return;
    heavyBiteActiveRef.current = false;
    setHeavyBiteActive(false);
    performBiteRef.current();
    onMechanicCompleted?.("heavy_bite");
  }, [onMechanicCompleted]);

  const completeTacoChallenge = useCallback(() => onMechanicCompleted?.("shell_stability"), [onMechanicCompleted]);
  const completeSpeedSprint = useCallback(() => onMechanicCompleted?.("speed_sprint"), [onMechanicCompleted]);
  const triggerHeatRush = useCallback(() => onMechanicCompleted?.("heat_rush"), [onMechanicCompleted]);

  const handleTacoStabilityChange = useCallback((stability: number) => {
    setTacoStability(stability);
  }, []);

  const handleHoldStateChange = useCallback((holding: boolean) => {
    holdPresentationScale.stopAnimation();
    Animated.timing(holdPresentationScale, {
      toValue: holding && !reducedMotion ? 0.975 : 1,
      duration: reducedMotion ? 80 : 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [holdPresentationScale, reducedMotion]);

  const performBite = () => {
    const acceptedSequence = onAcceptedAction();
    if (acceptedSequence === null) return null;
    const nextBiteCount = acceptedSequence;
    biteCounter.current = nextBiteCount;
    setBiteEvent(nextBiteCount);
    const biteWithinItem = ((nextBiteCount - 1) % PRESENTATION_BITES_PER_ITEM) + 1;
    const itemCompleted = biteWithinItem === PRESENTATION_BITES_PER_ITEM;
    consumptionScale.stopAnimation();
    consumptionProgress.stopAnimation();
    Animated.parallel([
      Animated.timing(consumptionScale, {
        toValue: 1 - (biteWithinItem / PRESENTATION_BITES_PER_ITEM) * 0.1,
        duration: reducedMotion ? 80 : 170,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(consumptionProgress, {
        toValue: biteWithinItem / PRESENTATION_BITES_PER_ITEM,
        duration: reducedMotion ? 80 : 170,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    if (itemCompleted) {
      if (completionTimer.current) clearTimeout(completionTimer.current);
      setFoodPresentationEvent({ id: nextBiteCount, type: "ITEM_COMPLETED" });
      completionBurst.stopAnimation();
      completionBurst.setValue(0);
      Animated.timing(completionBurst, {
        toValue: 1,
        duration: reducedMotion ? 180 : 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      completionTimer.current = setTimeout(() => {
        setFoodPresentationEvent(null);
        completionTimer.current = null;
      }, 620);
    }

    if (cheesePullInterval && nextBiteCount % cheesePullInterval === 0) {
      cheesePullActiveRef.current = true;
      setCheesePullActive(true);
    }

    if (noodleSlurpInterval && nextBiteCount % noodleSlurpInterval === 0) {
      noodleSlurpActiveRef.current = true;
      setNoodleSlurpActive(true);
    }

    const sprintStarted = Boolean(
      speedSprintInterval &&
      nextBiteCount % speedSprintInterval === 0 &&
      hotDogSpeedSprintRef.current?.start(1),
    );
    if (speedSprintInterval && !sprintStarted) {
      hotDogSpeedSprintRef.current?.registerTap();
    }

    const heatRushStarted = Boolean(
      heatRushInterval &&
      nextBiteCount % heatRushInterval === 0 &&
      heatRushRef.current?.start(1),
    );
    if (heatRushInterval && !heatRushStarted) {
      heatRushRef.current?.registerTap();
    }

    tacoStabilityRef.current?.registerTap(nextBiteCount);

    const direction =
      biteCounter.current % 2 === 0 ? -1 : 1;

    biteAnimation.current?.stop();
    biteAnimation.current = null;

    impactScaleX.stopAnimation();
    impactScaleY.stopAnimation();
    impactRotation.stopAnimation();
    shakeX.stopAnimation();
    crumbProgress.stopAnimation();
    hitFlash.stopAnimation();

    impactScaleX.setValue(1);
    impactScaleY.setValue(1);
    impactRotation.setValue(0);
    shakeX.setValue(0);
    crumbProgress.setValue(0);
    hitFlash.setValue(0);

    biteAnimation.current = Animated.parallel([
      Animated.parallel([
        Animated.sequence([
          Animated.timing(impactScaleX, {
            toValue: reducedMotion ? 1.004 : 0.992,
            duration: speedDuration(24),
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(impactScaleX, {
            toValue: reducedMotion ? 1.008 : 1.045 + impactTier * 0.008,
            duration: speedDuration(46),
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(impactScaleX, {
            toValue: reducedMotion ? 1 : 0.988,
            duration: speedDuration(48),
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.spring(impactScaleX, {
            toValue: 1,
            friction: 7.5,
            tension: recoveryTension,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(impactScaleY, {
            toValue: reducedMotion ? 0.998 : 1.015,
            duration: speedDuration(24),
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(impactScaleY, {
            toValue: compression,
            duration: speedDuration(46),
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(impactScaleY, {
            toValue: reducedMotion ? 1 : 1.035 + impactTier * 0.005,
            duration: speedDuration(48),
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(impactScaleY, {
            toValue: 1,
            friction: 7.5,
            tension: recoveryTension,
            useNativeDriver: true,
          }),
        ]),
      ]),

      Animated.sequence([
        Animated.timing(impactRotation, {
          toValue: direction * rotationDistance,
          duration: speedDuration(42),
          useNativeDriver: true,
        }),
        Animated.spring(impactRotation, {
          toValue: 0,
          friction: 8,
          tension: clamp(290 * animationSpeed / stylePresentation.recovery, 220, 400),
          useNativeDriver: true,
        }),
      ]),

      Animated.sequence([
        Animated.timing(shakeX, {
          toValue: direction * -shakeDistance,
          duration: speedDuration(26),
          useNativeDriver: true,
        }),
        Animated.spring(shakeX, {
          toValue: 0,
          friction: 7,
          tension: clamp(320 * animationSpeed / stylePresentation.recovery, 230, 430),
          useNativeDriver: true,
        }),
      ]),

      Animated.timing(crumbProgress, {
        toValue: 1,
        duration: reducedMotion ? 140 : speedDuration(250 + impactTier * 20),
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),

      Animated.sequence([
        Animated.delay(speedDuration(18)),
        Animated.timing(hitFlash, {
          toValue: 1,
          duration: speedDuration(42),
          useNativeDriver: true,
        }),
        Animated.timing(hitFlash, {
          toValue: 0,
          duration: speedDuration(145),
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]);

    biteAnimation.current.start(({ finished }) => {
      if (finished) {
        biteAnimation.current = null;
      }
    });
    return acceptedSequence;
  };

  performBiteRef.current = performBite;

  const tap = () => {
    if (
      !active ||
      heavyBiteActiveRef.current ||
      cheesePullActiveRef.current ||
      noodleSlurpActiveRef.current
    ) {
      return null;
    }

    const nextBiteCount = biteCounter.current + 1;
    if (heavyBiteInterval && nextBiteCount % heavyBiteInterval === 0) {
      heavyBiteActiveRef.current = true;
      setHeavyBiteActive(true);
      return null;
    }

    return performBite();
  };

  const haloOpacity = useMemo(
    () => Animated.add(
      haloIntensity.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.58] }),
      Animated.add(
        urgency.interpolate({ inputRange: [0, 1], outputRange: [0, 0.2] }),
        haloPulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] }),
      ),
    ),
    [haloIntensity, haloPulse, urgency],
  );

  const haloScale = useMemo(
    () => Animated.add(
      haloIntensity.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }),
      Animated.add(
        urgency.interpolate({ inputRange: [0, 1], outputRange: [0, 0.05] }),
        haloPulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.08] }),
      ),
    ),
    [haloIntensity, haloPulse, urgency],
  );

  const arenaGlowOpacity = useMemo(
    () => Animated.add(
      haloIntensity.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.66] }),
      hitFlash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.28] }),
    ),
    [haloIntensity, hitFlash],
  );

  const foodBackGlowOpacity = useMemo(
    () => Animated.add(
      haloIntensity.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.58] }),
      hitFlash.interpolate({
        inputRange: [0, 1],
        outputRange: [
          0,
          reducedMotion
            ? 0.1
            : clamp((0.38 + impactTier * 0.06) * flashIntensity, 0.28, 0.68),
        ],
      }),
    ),
    [flashIntensity, haloIntensity, hitFlash, impactTier, reducedMotion],
  );

  const pedestalGlowOpacity = useMemo(
    () => Animated.add(
      haloIntensity.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.66] }),
      hitFlash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.25] }),
    ),
    [haloIntensity, hitFlash],
  );

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX: shakeX }],
        },
      ]}
    >
      {heavyBiteActive && active ? (
        <BurgerHeavyBiteOverlay
          holdDurationMs={heavyBiteMechanic?.holdDurationMs}
          reducedMotion={reducedMotion}
          onComplete={completeHeavyBite}
        />
      ) : null}

      {cheesePullActive && active ? (
        <CheesePullOverlay reducedMotion={reducedMotion} onComplete={completeCheesePull} />
      ) : null}

      {noodleSlurpActive && active ? (
        <NoodleSlurpOverlay reducedMotion={reducedMotion} onComplete={completeNoodleSlurp} />
      ) : null}

      {tacoStabilityInterval ? (
        <TacoStabilityOverlay
          ref={tacoStabilityRef}
          active={active}
          reducedMotion={reducedMotion}
          resetKey={resetKey}
          triggerEveryBites={tacoStabilityInterval}
          onStabilityChange={handleTacoStabilityChange}
          onChallengeCompleted={completeTacoChallenge}
        />
      ) : null}

      {speedSprintMechanic ? (
        <HotDogSpeedSprintOverlay
          ref={hotDogSpeedSprintRef}
          active={active}
          durationMs={speedSprintMechanic.durationMs}
          reducedMotion={reducedMotion}
          resetKey={resetKey}
          tapTarget={speedSprintMechanic.tapTarget}
          onSuccess={completeSpeedSprint}
        />
      ) : null}

      {heatRushMechanic ? (
        <HeatRushOverlay
          ref={heatRushRef}
          active={active}
          durationMs={heatRushMechanic.durationMs}
          reducedMotion={reducedMotion}
          resetKey={resetKey}
          tapTarget={heatRushMechanic.tapTarget}
          onTriggered={triggerHeatRush}
        />
      ) : null}

      <View
        onLayout={(event) => setFoodRegionHeight(event.nativeEvent.layout.height)}
        style={styles.foodRegion}
      >
        <View
          pointerEvents="none"
          style={styles.emberLayer}
        >
        {emberValues.map((value, index) => {
          const ember = EMBERS[index];

          return (
            <Animated.View
              key={index}
              style={[
                styles.ember,
                {
                  height: ember.size,
                  left: ember.left,
                  opacity: value.interpolate({
                    inputRange: [0, 0.15, 0.72, 1],
                    outputRange: [0, 0.85, 0.45, 0],
                  }),
                  transform: [
                    {
                      translateY: value.interpolate({
                        inputRange: [0, 1],
                        outputRange: [50, -145],
                      }),
                    },
                    {
                      translateX: value.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [-5, 7, -3],
                      }),
                    },
                    {
                      scale: value.interpolate({
                        inputRange: [0, 0.4, 1],
                        outputRange: [0.5, 1.25, 0.7],
                      }),
                    },
                  ],
                  width: ember.size,
                },
              ]}
            />
          );
        })}
        </View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.arenaGlowOuter,
          {
            height: size + 94,
            opacity: haloOpacity,
            transform: [{ scale: haloScale }],
            width: size + 94,
          },
        ]}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.arenaGlowInner,
          {
            height: size + 36,
            opacity: arenaGlowOpacity,
            transform: [
              {
                scale: floorPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.98, 1.035],
                }),
              },
            ],
            width: size + 36,
          },
        ]}
      />

        <Pressable
        accessibilityElementsHidden
        accessible={false}
        disabled={!active}
        hitSlop={foodHitSlop}
        importantForAccessibility="no-hide-descendants"
        onPressIn={tap}
        pressRetentionOffset={foodHitSlop}
        style={styles.foodPressable}
      >
        <Animated.View
          style={[
            styles.idleStage,
            {
              transform: [
                {
                  translateY: idleY.interpolate({
                    inputRange: [0, 1],
                    outputRange: [3, -4],
                  }),
                },
                {
                  scale: idleBreath.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.996, 1.01],
                  }),
                },
              ],
            },
          ]}
        >
          {hotFood ? (
            <View
              pointerEvents="none"
              style={styles.steamLayer}
            >
              {steamValues.map((value, index) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.steam,
                    {
                      left: `${29 + index * 20}%`,
                      opacity: value.interpolate({
                        inputRange: [0, 0.25, 0.7, 1],
                        outputRange: [0, 0.24, 0.13, 0],
                      }),
                      transform: [
                        {
                          translateY: value.interpolate({
                            inputRange: [0, 1],
                            outputRange: [12, -42],
                          }),
                        },
                        {
                          translateX: value.interpolate({
                            inputRange: [0, 0.5, 1],
                            outputRange: [-3, 4, -2],
                          }),
                        },
                        {
                          scaleY: value.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.75, 1.35],
                          }),
                        },
                        {
                          scaleX: value.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.75, 1.15],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              ))}
            </View>
          ) : null}

          <Animated.View
            style={[
              styles.foodShadow,
              {
                height: size * 0.25,
                opacity: idleY.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.42, 0.24],
                }),
                transform: [
                  {
                    scaleX: idleY.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0.86],
                    }),
                  },
                ],
                width: size * 0.72,
              },
            ]}
          />

          <Animated.View
            style={[
              styles.foodBox,
              {
                height: size,
                width: size,
                transform: [
                  { scale: Animated.multiply(consumptionScale, holdPresentationScale) },
                  { scaleX: impactScaleX },
                  { scaleY: impactScaleY },
                  { rotate: foodRotation },
                ],
              },
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.foodBackGlow,
                {
                  height: size * 0.82,
                  opacity: foodBackGlowOpacity,
                  transform: [
                    {
                      scale: haloPulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.18],
                      }),
                    },
                  ],
                  width: size * 0.82,
                },
              ]}
            />

            <View
              pointerEvents="none"
              style={{
                height: size * foodArtwork.scale,
                width: size * foodArtwork.scale,
              }}
            >
              {FOOD_SEGMENTS.map((segment, segmentIndex) => {
                const artworkSize = size * foodArtwork.scale;
                const segmentSize = artworkSize / 2;
                const removalPosition = SEGMENT_REMOVAL_ORDER[foodProfile.biteStyle].indexOf(segmentIndex);
                const threshold = SEGMENT_REMOVAL_THRESHOLDS[removalPosition];
                const transitionStart = Math.max(0, threshold - 0.14);

                return (
                  <Animated.View
                    key={`${segment.column}-${segment.row}`}
                    style={[
                      styles.foodSegment,
                      {
                        height: segmentSize + 1,
                        left: segment.column * segmentSize,
                        opacity: consumptionProgress.interpolate({
                          inputRange: [0, transitionStart, threshold, 1],
                          outputRange: [1, 1, 0, 0],
                        }),
                        top: segment.row * segmentSize,
                        width: segmentSize + 1,
                      },
                    ]}
                  >
                    <Image
                      source={foodArtwork.source}
                      resizeMode="contain"
                      style={{
                        height: artworkSize,
                        left: -segment.column * segmentSize,
                        position: "absolute",
                        top: -segment.row * segmentSize,
                        width: artworkSize,
                      }}
                    />
                  </Animated.View>
                );
              })}
            </View>

            <Animated.View
              pointerEvents="none"
              style={[
                styles.hitFlash,
                {
                  height: size * 0.76,
                  opacity: hitFlash.interpolate({
                    inputRange: [0, 1],
                    outputRange: [
                      0,
                      reducedMotion
                        ? 0.16
                        : hitFlashOpacity,
                    ],
                  }),
                  transform: [
                    {
                      scale: hitFlash.interpolate({
                        inputRange: [0, 1],
                        outputRange: reducedMotion
                          ? [0.96, 1.02]
                          : [0.82, hitFlashScale],
                      }),
                    },
                  ],
                  width: size * 0.76,
                },
              ]}
            />

            <Animated.View
              pointerEvents="none"
              style={[
                styles.shine,
                {
                  backgroundColor: biteReaction.shineColor,
                  opacity: shine.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 0.14, 0],
                  }),
                  transform: [
                    {
                      translateX: shine.interpolate({
                        inputRange: [0, 1],
                        outputRange: [
                          -size * 0.34,
                          size * 0.34,
                        ],
                      }),
                    },
                    { rotate: "18deg" },
                  ],
                },
              ]}
            />

            <View
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            >
              {CRUMBS.map((crumb, index) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.crumb,
                    biteReaction.shape === "droplet" && styles.droplet,
                    {
                      backgroundColor: biteReaction.palette[index % biteReaction.palette.length],
                      borderRadius: biteReaction.shape === "droplet" ? crumb.size : 2,
                      height: biteReaction.shape === "streak"
                        ? Math.max(2, crumb.size * 0.55)
                        : biteReaction.shape === "noodle"
                          ? crumb.size * 2.4
                          : biteReaction.shape === "droplet"
                            ? crumb.size * 1.5
                            : biteReaction.shape === "fleck"
                              ? crumb.size * 0.7
                              : crumb.size,
                      opacity: crumbProgress.interpolate({
                        inputRange: [0, 0.12, 0.75, 1],
                        outputRange: reducedMotion
                          ? [0, 0.42, 0.2, 0]
                          : [
                              0,
                              0.82 + impactTier * 0.06,
                              0.45 + impactTier * 0.08,
                              0,
                            ],
                      }),
                      transform: [
                        {
                          translateX:
                            crumbProgress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [
                                0,
                                crumb.x * crumbDistance,
                              ],
                            }),
                        },
                        {
                          translateY:
                            crumbProgress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [
                                0,
                                crumb.y * crumbDistance,
                              ],
                            }),
                        },
                        {
                          scale:
                            crumbProgress.interpolate({
                              inputRange: [0, 1],
                              outputRange: reducedMotion ? [0.85, 1] : [0.55, 1.25],
                            }),
                        },
                        {
                          rotate: crumbProgress.interpolate({
                            inputRange: [0, 1],
                            outputRange: reducedMotion
                              ? ["0deg", "0deg"]
                              : ["0deg", `${(index % 2 === 0 ? -1 : 1) * (28 + index * 7)}deg`],
                          }),
                        },
                      ],
                      width: biteReaction.shape === "streak"
                        ? crumb.size * 2.4
                        : biteReaction.shape === "noodle"
                          ? Math.max(2, crumb.size * 0.55)
                          : biteReaction.shape === "droplet"
                            ? crumb.size * 0.9
                            : biteReaction.shape === "fleck"
                              ? crumb.size * 1.5
                              : crumb.size,
                    },
                  ]}
                />
              ))}
            </View>

            {!reducedMotion ? (
              <ImpactEffect
                trigger={biteEvent}
                variant="bite"
                size={size * impactEffectSize}
              />
            ) : null}
            <Animated.Image
              resizeMode="contain"
              source={dessertFood ? DESSERT_SPARKLE : COMPLETION_BURST}
              style={[styles.completionBurst, {
                opacity: completionBurst.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.86, 0] }),
                transform: [{ scale: completionBurst.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.45] }) }],
              }]}
            />
          </Animated.View>
        </Animated.View>
        </Pressable>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.pedestalGlow,
          {
            opacity: pedestalGlowOpacity,
            transform: [
              {
                scaleX: floorPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1.65, 1.82],
                }),
              },
            ],
          },
        ]}
      />

        <View
        pointerEvents="none"
        style={styles.pedestal}
      >
        <View style={styles.pedestalRim} />
        <View style={styles.pedestalCore} />
        </View>
        <View pointerEvents="none" style={styles.foodProgress}>
          <View style={styles.foodProgressTrack}>
            <View style={[styles.foodProgressFill, { width: `${foodPresentationEvent ? 100 : ((biteEvent % PRESENTATION_BITES_PER_ITEM) / PRESENTATION_BITES_PER_ITEM) * 100}%` }]} />
          </View>
          <Text maxFontSizeMultiplier={1.3} style={styles.foodProgressText}>
            {foodPresentationEvent ? "DEVOUR!" : `${biteEvent % PRESENTATION_BITES_PER_ITEM}/${PRESENTATION_BITES_PER_ITEM} BITES`}
          </Text>
        </View>

      </View>

      <GameplayActionZone
        active={active}
        combo={combo}
        heatTier={heatTier}
        mechanic={biteMechanic}
        overheatWarningActive={overheatWarningActive}
        reducedMotion={reducedMotion}
        resetKey={resetKey}
        onAction={tap}
        onHoldStateChange={handleHoldStateChange}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    overflow: "visible",
    minHeight: 0,
    width: "100%",
  },

  foodRegion: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 0,
    overflow: "visible",
    paddingBottom: 2,
    paddingHorizontal: 24,
    width: "100%",
  },

  emberLayer: {
    bottom: 72,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 0,
  },

  ember: {
    backgroundColor: "#FFB13B",
    borderRadius: 999,
    position: "absolute",
    top: "74%",
  },

  arenaGlowOuter: {
    backgroundColor: "rgba(255,82,18,0.2)",
    borderColor: "rgba(255,178,75,0.3)",
    borderRadius: 999,
    borderWidth: 1,
    position: "absolute",
    top: "6%",
  },

  arenaGlowInner: {
    backgroundColor: "rgba(255,116,30,0.26)",
    borderColor: "rgba(255,207,125,0.24)",
    borderRadius: 999,
    borderWidth: 1,
    position: "absolute",
    top: "11%",
  },

  foodPressable: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
  },

  idleStage: {
    alignItems: "center",
    justifyContent: "center",
  },

  foodShadow: {
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 999,
    bottom: -3,
    position: "absolute",
  },

  foodBox: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  foodSegment: {
    overflow: "hidden",
    position: "absolute",
  },
  completionBurst: { height: "130%", position: "absolute", width: "130%" },
  foodProgress: { alignItems: "center", bottom: 1, position: "absolute", width: 148, zIndex: 6 },
  foodProgressTrack: { backgroundColor: "rgba(18,7,6,0.96)", borderColor: "rgba(255,188,83,0.58)", borderRadius: 5, borderWidth: 1, height: 7, overflow: "hidden", width: "100%" },
  foodProgressFill: { backgroundColor: "#F7A13A", height: "100%" },
  foodProgressText: { color: "#FFE0A2", fontSize: 8, fontWeight: "900", letterSpacing: 0.8, marginTop: 3 },

  foodBackGlow: {
    backgroundColor: "rgba(255,92,23,0.38)",
    borderColor: "rgba(255,195,97,0.32)",
    borderRadius: 999,
    borderWidth: 1,
    position: "absolute",
  },

  hitFlash: {
    backgroundColor: "rgba(255,226,167,0.44)",
    borderRadius: 999,
    position: "absolute",
  },

  shine: {
    backgroundColor: "#FFF4D4",
    borderRadius: 999,
    height: "78%",
    position: "absolute",
    width: 14,
  },

  crumb: {
    left: "50%",
    position: "absolute",
    top: "48%",
  },
  droplet: {
    borderBottomLeftRadius: 2,
  },

  steamLayer: {
    height: 82,
    left: 0,
    position: "absolute",
    right: 0,
    top: -19,
    zIndex: 0,
  },

  steam: {
    backgroundColor: "#FFF0DA",
    borderRadius: 8,
    height: 42,
    position: "absolute",
    top: 9,
    width: 6,
  },

  pedestalGlow: {
    backgroundColor: "rgba(255,87,20,0.34)",
    borderRadius: 999,
    height: 52,
    marginTop: -43,
    position: "absolute",
    width: 176,
    zIndex: 0,
  },

  pedestal: {
    backgroundColor: "rgba(10,5,6,0.98)",
    borderColor: "rgba(244,146,52,0.72)",
    borderRadius: 100,
    borderWidth: 2,
    elevation: 8,
    height: 50,
    marginTop: -34,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    transform: [{ scaleX: 1.72 }],
    width: 156,
    zIndex: 1,
  },

  pedestalRim: {
    borderColor: "rgba(255,191,91,0.7)",
    borderRadius: 100,
    borderTopWidth: 3,
    height: 21,
    left: 9,
    position: "absolute",
    right: 9,
    top: 4,
  },

  pedestalCore: {
    backgroundColor: "rgba(255,112,28,0.14)",
    borderRadius: 999,
    bottom: 7,
    left: 24,
    position: "absolute",
    right: 24,
    top: 13,
  },

});

export default React.memo(FoodArena);
