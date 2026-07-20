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
import type { FoodProfile } from "../food/FoodProfiles";
import type { FoodMechanicType } from "../../achievements/AchievementTypes";
import BurgerHeavyBiteOverlay from "./BurgerHeavyBiteOverlay";
import CheesePullOverlay from "./CheesePullOverlay";
import HeatRushOverlay, { type HeatRushHandle } from "./HeatRushOverlay";
import HotDogSpeedSprintOverlay, { type HotDogSpeedSprintHandle } from "./HotDogSpeedSprintOverlay";
import ImpactEffect from "./ImpactEffect";
import NoodleSlurpOverlay from "./NoodleSlurpOverlay";
import TacoStabilityOverlay, { type TacoStabilityHandle } from "./TacoStabilityOverlay";

type Props = {
  contestId: string;
  combo: number;
  timeRemaining: number;
  resetKey?: string;
  active?: boolean;
  foodProfile: FoodProfile;
  onTap: () => void;
  onMechanicCompleted?: (mechanicType: FoodMechanicType) => void;
};

const HOT_FOOD_CONTESTS = new Set([
  "nathans-hotdogs",
  "wing-bowl",
  "pizza-hut-stuffed",
  "katz-pastrami",
  "in-n-out-burgers",
]);

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

export default function FoodArena({
  contestId,
  combo,
  timeRemaining,
  resetKey = contestId,
  active = true,
  foodProfile,
  onTap,
  onMechanicCompleted,
}: Props) {
  const { width, height } = useWindowDimensions();

  const size = Math.min(
    width * 0.66,
    height * 0.35,
    285,
  );

  const foodArtwork = getFoodArtwork(contestId);

  const impactScale = useRef(new Animated.Value(1)).current;
  const impactRotation = useRef(new Animated.Value(0)).current;

  const idleY = useRef(new Animated.Value(0)).current;
  const idleBreath = useRef(new Animated.Value(0)).current;
  const idleRotation = useRef(new Animated.Value(0)).current;

  const shakeX = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const buttonPulse = useRef(new Animated.Value(0)).current;

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

  const biteCounter = useRef(0);
  const performBiteRef = useRef<() => void>(() => {});
  const heavyBiteActiveRef = useRef(false);
  const cheesePullActiveRef = useRef(false);
  const noodleSlurpActiveRef = useRef(false);
  const heatRushRef = useRef<HeatRushHandle>(null);
  const hotDogSpeedSprintRef = useRef<HotDogSpeedSprintHandle>(null);
  const tacoStabilityRef = useRef<TacoStabilityHandle>(null);

  const [reducedMotion, setReducedMotion] = useState(false);
  const [biteEvent, setBiteEvent] = useState(0);
  const [heavyBiteActive, setHeavyBiteActive] = useState(false);
  const [cheesePullActive, setCheesePullActive] = useState(false);
  const [noodleSlurpActive, setNoodleSlurpActive] = useState(false);
  const [tacoStability, setTacoStability] = useState(1);

  const hotFood = HOT_FOOD_CONTESTS.has(contestId);
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
  const stylePresentation = BITE_STYLE_PRESENTATION[foodProfile.biteStyle];
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
  const recoveryTension = clamp(330 * animationSpeed / stylePresentation.recovery, 240, 440);
  const flashIntensity = clamp(cameraPunch * stylePresentation.flash, 0.7, 1.5);
  const effectIntensity = clamp(cameraPunch * stylePresentation.effect, 0.7, 1.5);
  const hitFlashOpacity = clamp((0.32 + impactTier * 0.07) * flashIntensity, 0.24, 0.62);
  const hitFlashScale = clamp(1 + (0.12 + impactTier * 0.08) * flashIntensity, 1.08, 1.48);
  const impactEffectSize = clamp((0.64 + impactTier * 0.07) * effectIntensity, 0.52, 0.92);
  const crumbDistance = reducedMotion
    ? 0
    : 1 + impactTier * 0.12;

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

  const foodRotation = Animated.add(
    impactRotation,
    idleRotation.interpolate({
      inputRange: [0, 1],
      outputRange: [-0.9, 0.9],
    }),
  ).interpolate({
    inputRange: [-4, 4],
    outputRange: ["-4deg", "4deg"],
  });

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
        Animated.timing(buttonPulse, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();

      return;
    }

    const animations: Animated.CompositeAnimation[] = [
      createLoop(idleY, 2200),
      createLoop(idleBreath, 2750, 120),
      createLoop(idleRotation, 3400, 240),
      createLoop(shine, 3300, 450),
      createLoop(haloPulse, 1800),
      createLoop(buttonPulse, 1250),
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
    buttonPulse,
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

    impactScale.stopAnimation();
    impactRotation.stopAnimation();
    shakeX.stopAnimation();
    crumbProgress.stopAnimation();
    hitFlash.stopAnimation();

    impactScale.setValue(0.86);
    impactRotation.setValue(0);
    shakeX.setValue(0);
    crumbProgress.setValue(0);
    hitFlash.setValue(0);

    setBiteEvent(0);
    setHeavyBiteActive(false);
    setCheesePullActive(false);
    setNoodleSlurpActive(false);
    setTacoStability(1);
    heatRushRef.current?.reset();
    hotDogSpeedSprintRef.current?.reset();

    Animated.spring(impactScale, {
      toValue: 1,
      friction: 6,
      tension: 210,
      useNativeDriver: true,
    }).start();
  }, [
    contestId,
    crumbProgress,
    hitFlash,
    impactRotation,
    impactScale,
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

  useEffect(
    () => () => {
      biteAnimation.current?.stop();
      biteAnimation.current = null;

      [
        impactScale,
        impactRotation,
        idleY,
        idleBreath,
        idleRotation,
        shakeX,
        buttonScale,
        buttonPulse,
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
      buttonPulse,
      buttonScale,
      crumbProgress,
      emberValues,
      floorPulse,
      haloIntensity,
      haloPulse,
      hitFlash,
      idleBreath,
      idleRotation,
      idleY,
      impactRotation,
      impactScale,
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

  const performBite = () => {
    onTap();

    const nextBiteCount = biteCounter.current + 1;
    biteCounter.current = nextBiteCount;
    setBiteEvent(nextBiteCount);

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

    impactScale.stopAnimation();
    impactRotation.stopAnimation();
    shakeX.stopAnimation();
    crumbProgress.stopAnimation();
    hitFlash.stopAnimation();

    impactScale.setValue(1);
    impactRotation.setValue(0);
    shakeX.setValue(0);
    crumbProgress.setValue(0);
    hitFlash.setValue(0);

    biteAnimation.current = Animated.parallel([
      Animated.sequence([
        Animated.timing(impactScale, {
          toValue: compression,
          duration: speedDuration(46),
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(impactScale, {
          toValue: 1,
          friction: 6,
          tension: recoveryTension,
          useNativeDriver: true,
        }),
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
        Animated.timing(hitFlash, {
          toValue: 1,
          duration: speedDuration(45),
          useNativeDriver: true,
        }),
        Animated.timing(hitFlash, {
          toValue: 0,
          duration: speedDuration(180),
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
  };

  performBiteRef.current = performBite;

  const tap = () => {
    if (
      !active ||
      heavyBiteActiveRef.current ||
      cheesePullActiveRef.current ||
      noodleSlurpActiveRef.current
    ) {
      return;
    }

    const nextBiteCount = biteCounter.current + 1;
    if (heavyBiteInterval && nextBiteCount % heavyBiteInterval === 0) {
      heavyBiteActiveRef.current = true;
      setHeavyBiteActive(true);
      return;
    }

    performBite();
  };

  const pressButton = (pressed: boolean) => {
    buttonScale.stopAnimation();

    Animated.spring(buttonScale, {
      toValue: pressed ? 0.9 : 1,
      friction: pressed ? 8 : 4,
      tension: pressed ? 320 : 250,
      useNativeDriver: true,
    }).start();
  };

  const haloOpacity = Animated.add(
    haloIntensity.interpolate({
      inputRange: [0, 1],
      outputRange: [0.22, 0.58],
    }),
    Animated.add(
      urgency.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.2],
      }),
      haloPulse.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.18],
      }),
    ),
  );

  const haloScale = Animated.add(
    haloIntensity.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.1],
    }),
    Animated.add(
      urgency.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.05],
      }),
      haloPulse.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.08],
      }),
    ),
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
            opacity: Animated.add(
              haloIntensity.interpolate({
                inputRange: [0, 1],
                outputRange: [0.28, 0.66],
              }),
              hitFlash.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.28],
              }),
            ),
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
        accessibilityRole="button"
        accessibilityLabel="Bite food"
        disabled={!active}
        onPress={tap}
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
                    outputRange: [4, -6],
                  }),
                },
                {
                  scale: idleBreath.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.992, 1.014],
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
                  { scale: impactScale },
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
                  opacity: Animated.add(
                    haloIntensity.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.15, 0.58],
                    }),
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

            <Image
              source={foodArtwork.source}
              resizeMode="contain"
              style={{
                height: size * foodArtwork.scale,
                width: size * foodArtwork.scale,
              }}
            />

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
                    {
                      height: crumb.size,
                      opacity: crumbProgress.interpolate({
                        inputRange: [0, 0.12, 0.75, 1],
                        outputRange: reducedMotion
                          ? [0, 0, 0, 0]
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
                              outputRange: [0.55, 1.25],
                            }),
                        },
                      ],
                      width: crumb.size,
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
          </Animated.View>
        </Animated.View>
      </Pressable>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.pedestalGlow,
          {
            opacity: Animated.add(
              haloIntensity.interpolate({
                inputRange: [0, 1],
                outputRange: [0.25, 0.66],
              }),
              hitFlash.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.25],
              }),
            ),
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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Bite"
        disabled={!active}
        onPress={tap}
        onPressIn={() => pressButton(true)}
        onPressOut={() => pressButton(false)}
        style={[
          styles.biteTouchTarget,
          !active && styles.biteDisabled,
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.buttonAura,
            {
              opacity: buttonPulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.2, 0.62],
              }),
              transform: [
                {
                  scale: buttonPulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1.18],
                  }),
                },
              ],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.biteOuter,
            {
              transform: [{ scale: buttonScale }],
            },
          ]}
        >
          <View style={styles.biteMiddle}>
            <View style={styles.biteInner}>
              <Text style={styles.biteText}>BITE</Text>
              <Text style={styles.biteSub}>TAP!</Text>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    overflow: "visible",
    paddingBottom: 2,
    paddingTop: 8,
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
    backgroundColor: "rgba(255,82,18,0.18)",
    borderColor: "rgba(255,167,63,0.24)",
    borderRadius: 999,
    borderWidth: 1,
    position: "absolute",
    top: "8%",
  },

  arenaGlowInner: {
    backgroundColor: "rgba(255,116,30,0.23)",
    borderColor: "rgba(255,197,105,0.18)",
    borderRadius: 999,
    borderWidth: 1,
    position: "absolute",
    top: "13%",
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
    backgroundColor: "rgba(0,0,0,0.62)",
    borderRadius: 999,
    bottom: -1,
    position: "absolute",
  },

  foodBox: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },

  foodBackGlow: {
    backgroundColor: "rgba(255,92,23,0.35)",
    borderColor: "rgba(255,185,79,0.25)",
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
    backgroundColor: "#F6B24D",
    borderRadius: 3,
    left: "50%",
    position: "absolute",
    top: "48%",
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
    backgroundColor: "rgba(255,80,18,0.28)",
    borderRadius: 999,
    height: 44,
    marginTop: -38,
    position: "absolute",
    width: 150,
    zIndex: 0,
  },

  pedestal: {
    backgroundColor: "rgba(8,5,6,0.94)",
    borderColor: "rgba(234,127,36,0.52)",
    borderRadius: 100,
    borderWidth: 1,
    height: 44,
    marginTop: -30,
    transform: [{ scaleX: 1.78 }],
    width: 142,
    zIndex: 1,
  },

  pedestalRim: {
    borderColor: "rgba(255,174,74,0.5)",
    borderRadius: 100,
    borderTopWidth: 2,
    height: 18,
    left: 8,
    position: "absolute",
    right: 8,
    top: 4,
  },

  pedestalCore: {
    backgroundColor: "rgba(255,104,25,0.09)",
    borderRadius: 999,
    bottom: 6,
    left: 22,
    position: "absolute",
    right: 22,
    top: 12,
  },

  biteTouchTarget: {
    alignItems: "center",
    height: 122,
    justifyContent: "center",
    marginTop: -1,
    width: 122,
    zIndex: 5,
  },

  buttonAura: {
    backgroundColor: "rgba(255,93,24,0.34)",
    borderRadius: 999,
    height: 112,
    position: "absolute",
    width: 112,
  },

  biteOuter: {
    alignItems: "center",
    backgroundColor: "#0A0708",
    borderColor: "#F2A13A",
    borderRadius: 54,
    borderWidth: 3,
    elevation: 10,
    height: 106,
    justifyContent: "center",
    shadowColor: "#FF641E",
    shadowOffset: {
      height: 0,
      width: 0,
    },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    width: 106,
  },

  biteMiddle: {
    alignItems: "center",
    backgroundColor: "#5E1D0B",
    borderColor: "#FFB34E",
    borderRadius: 47,
    borderWidth: 2,
    height: 92,
    justifyContent: "center",
    width: 92,
  },

  biteInner: {
    alignItems: "center",
    backgroundColor: "#C84514",
    borderColor: "#FF7D29",
    borderRadius: 40,
    borderWidth: 2,
    height: 78,
    justifyContent: "center",
    width: 78,
  },

  biteText: {
    color: "#FFF4DA",
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: 1.3,
    lineHeight: 25,
  },

  biteSub: {
    color: "#FFD486",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.7,
  },

  biteDisabled: {
    opacity: 0.48,
  },
});
