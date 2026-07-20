import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type FireArenaBackgroundProps = {
  children?: React.ReactNode;
  combo?: number;
  phase?: "intro" | "active" | "result";
  reducedMotion?: boolean;
};

type AtmosphereTier = 0 | 1 | 2 | 3;

const getAtmosphereTier = (combo: number): AtmosphereTier => {
  if (combo >= 20) return 3;
  if (combo >= 10) return 2;
  if (combo >= 5) return 1;
  return 0;
};

const ATMOSPHERE_INTENSITY: Record<AtmosphereTier, number> = {
  0: 0,
  1: 0.25,
  2: 0.52,
  3: 1,
};

const ARENA_IMAGE = require("../assets/backgrounds/arena.png");
const SMOKE_IMAGE = require("../assets/ui/effects/smoke-puff.png");

const EMBER_COUNT = 28;
type EmberSpec = { id: number; left: `${number}%`; bottom: `${number}%`; size: number; opacity: number; sway: number; speed: 0 | 1 | 2; delay: number };

function seededRandom(seed: number) {
  const value = Math.sin(seed * 9283.17) * 43758.5453;
  return value - Math.floor(value);
}

const EMBERS: readonly EmberSpec[] = Array.from({ length: EMBER_COUNT }, (_, id) => ({
  id,
  left: `${Math.round(seededRandom(id + 1) * 100)}%` as `${number}%`,
  bottom: `${Math.round(seededRandom(id + 31) * 62)}%` as `${number}%`,
  size: 2 + Math.round(seededRandom(id + 61) * 3),
  opacity: 0.2 + seededRandom(id + 91) * 0.48,
  sway: 2 + Math.round(seededRandom(id + 121) * 4),
  speed: (id % 3) as 0 | 1 | 2,
  delay: seededRandom(id + 151),
}));

function ambientLoop(value: Animated.Value, duration: number, delay = 0) {
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

function driftLoop(value: Animated.Value, duration: number, delay = 0) {
  return Animated.loop(
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(value, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
    ]),
    { resetBeforeIteration: true },
  );
}

/** Fixed native-driven atmosphere layers. No per-frame JS or runtime particle generation. */
export default function FireArenaBackground({ children, combo = 0, phase = "active", reducedMotion = false }: FireArenaBackgroundProps) {
  const spotlightLeft = useRef(new Animated.Value(0)).current;
  const spotlightRight = useRef(new Animated.Value(0)).current;
  const smokeLeft = useRef(new Animated.Value(0)).current;
  const smokeRight = useRef(new Animated.Value(0)).current;
  const emberSlow = useRef(new Animated.Value(0)).current;
  const emberMedium = useRef(new Animated.Value(0)).current;
  const emberFast = useRef(new Animated.Value(0)).current;
  const heatHaze = useRef(new Animated.Value(0)).current;
  const lightSweep = useRef(new Animated.Value(0)).current;
  const depthMotion = useRef(new Animated.Value(0)).current;
  const fireBreath = useRef(new Animated.Value(0)).current;
  const intensity = useRef(new Animated.Value(0)).current;
  const milestonePulse = useRef(new Animated.Value(0)).current;
  const previousCombo = useRef(combo);
  const emberProgress = useMemo(() => [emberSlow, emberMedium, emberFast] as const, [emberFast, emberMedium, emberSlow]);
  const atmosphereTier = getAtmosphereTier(combo);
  const atmosphereIntensity = ATMOSPHERE_INTENSITY[atmosphereTier];
  const milestoneGlowOpacity = 0.025 + atmosphereTier * 0.01;

  useEffect(() => {
    const resultSlowdown = phase === "result" ? 1.55 : 1;
    const animations = [
      ambientLoop(spotlightLeft, 7200),
      ambientLoop(spotlightRight, 8600, 900),
      ambientLoop(smokeLeft, 11200),
      ambientLoop(smokeRight, 12800, 1200),
      driftLoop(emberSlow, 10500 * resultSlowdown, 500),
      driftLoop(emberMedium, 8200 * resultSlowdown, 1100),
      driftLoop(emberFast, 6500 * resultSlowdown, 1700),
      ambientLoop(heatHaze, 5800),
      ambientLoop(depthMotion, 12400, 800),
      ambientLoop(fireBreath, 4200, 300),
      Animated.loop(Animated.sequence([
        Animated.timing(lightSweep, { toValue: 1, duration: 12000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(lightSweep, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])),
    ];
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [depthMotion, emberFast, emberMedium, emberSlow, fireBreath, heatHaze, lightSweep, phase, smokeLeft, smokeRight, spotlightLeft, spotlightRight]);

  useEffect(() => {
    const target = phase === "result" ? 0.08 : atmosphereIntensity;
    const transition = Animated.timing(intensity, {
      toValue: target,
      duration: reducedMotion ? 0 : phase === "result" ? 1100 : 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    transition.start();
    return () => transition.stop();
  }, [atmosphereIntensity, intensity, phase, reducedMotion]);

  useEffect(() => {
    const priorCombo = previousCombo.current;
    previousCombo.current = combo;
    milestonePulse.stopAnimation();
    milestonePulse.setValue(0);

    if (reducedMotion || phase !== "active" || combo <= priorCombo || combo < 5 || combo % 5 !== 0) return;

    milestonePulse.setValue(1);
    const pulse = Animated.timing(milestonePulse, {
      toValue: 0,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    pulse.start();
    return () => pulse.stop();
  }, [combo, milestonePulse, phase, reducedMotion]);

  const backdrop = (
    <View pointerEvents="none" style={styles.backdrop}>
      <LinearGradient
        colors={["#020203", "#100406", "#260707", "#080304", "#020203"]}
        locations={[0, 0.24, 0.56, 0.8, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Image source={ARENA_IMAGE} resizeMode="cover" style={styles.arenaImage} />
      <Animated.View style={[styles.depthBack, { transform: [{ translateX: depthMotion.interpolate({ inputRange: [0, 1], outputRange: [-2, 2] }) }] }]} />
      <Animated.View style={[styles.depthMiddle, { transform: [{ translateX: depthMotion.interpolate({ inputRange: [0, 1], outputRange: [3, -3] }) }, { translateY: depthMotion.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }] }]} />
      <Animated.View style={[styles.depthFront, { transform: [{ translateX: depthMotion.interpolate({ inputRange: [0, 1], outputRange: [-5, 5] }) }] }]} />
      <LinearGradient
        colors={["rgba(0,0,0,0.9)", "rgba(0,0,0,0.26)", "rgba(14,2,3,0.18)", "rgba(0,0,0,0.9)"]}
        locations={[0, 0.27, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        style={[
          styles.spotlight,
          styles.spotlightLeft,
          {
            opacity: spotlightLeft.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.12] }),
            transform: [
              { translateX: spotlightLeft.interpolate({ inputRange: [0, 1], outputRange: [-38, 30] }) },
              { rotate: "17deg" },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.spotlight,
          styles.spotlightRight,
          {
            opacity: spotlightRight.interpolate({ inputRange: [0, 1], outputRange: [0.04, 0.1] }),
            transform: [
              { translateX: spotlightRight.interpolate({ inputRange: [0, 1], outputRange: [32, -28] }) },
              { rotate: "-18deg" },
            ],
          },
        ]}
      />

      <View style={styles.upperWarmth} />
      <Animated.View
        style={[
          styles.stadiumSweep,
          {
            opacity: lightSweep.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.01, 0.065, 0.01] }),
            transform: [{ translateX: lightSweep.interpolate({ inputRange: [0, 1], outputRange: [-230, 230] }) }, { rotate: "-14deg" }],
          },
        ]}
      >
        <LinearGradient colors={["transparent", "rgba(255,183,93,0.34)", "transparent"]} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.View style={[styles.heatHaze, { opacity: heatHaze.interpolate({ inputRange: [0, 1], outputRange: [0.018, 0.045] }), transform: [{ translateY: heatHaze.interpolate({ inputRange: [0, 1], outputRange: [3, -3] }) }, { scaleY: heatHaze.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1.015] }) }] }]}>
        <LinearGradient colors={["transparent", "rgba(255,104,37,0.16)", "transparent"]} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.Image
        source={SMOKE_IMAGE}
        resizeMode="contain"
        style={[
          styles.smoke,
          styles.smokeLeft,
          {
            opacity: smokeLeft.interpolate({ inputRange: [0, 1], outputRange: [0.025, 0.06] }),
            transform: [
              { translateX: smokeLeft.interpolate({ inputRange: [0, 1], outputRange: [-18, 26] }) },
              { translateY: smokeLeft.interpolate({ inputRange: [0, 1], outputRange: [12, -24] }) },
            ],
          },
        ]}
      />
      <Animated.Image
        source={SMOKE_IMAGE}
        resizeMode="contain"
        style={[
          styles.smoke,
          styles.smokeRight,
          {
            opacity: smokeRight.interpolate({ inputRange: [0, 1], outputRange: [0.02, 0.05] }),
            transform: [
              { translateX: smokeRight.interpolate({ inputRange: [0, 1], outputRange: [20, -22] }) },
              { translateY: smokeRight.interpolate({ inputRange: [0, 1], outputRange: [8, -18] }) },
              { scaleX: -1 },
            ],
          },
        ]}
      />

      <View style={styles.emberField}>
        {EMBERS.slice(0, 20).map((ember) => {
          const progress = emberProgress[ember.speed];
          return <Animated.View key={ember.id} style={[styles.ember, { bottom: ember.bottom, height: ember.size, left: ember.left, opacity: progress.interpolate({ inputRange: [0, 0.12 + ember.delay * 0.2, 0.58 + ember.delay * 0.16, 1], outputRange: [0, ember.opacity * 0.45, ember.opacity, 0] }), transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [22, -72] }) }, { translateX: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-ember.sway, ember.sway, -ember.sway] }) }], width: ember.size }]} />;
        })}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: Animated.add(intensity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.72] }), milestonePulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.08] })) }]}>
          {EMBERS.slice(20).map((ember) => {
            const progress = emberProgress[ember.speed];
            return <Animated.View key={ember.id} style={[styles.ember, styles.emberHot, { bottom: ember.bottom, height: ember.size, left: ember.left, opacity: progress.interpolate({ inputRange: [0, 0.12 + ember.delay * 0.2, 0.58 + ember.delay * 0.16, 1], outputRange: [0, ember.opacity * 0.4, ember.opacity, 0] }), transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [18, -82] }) }, { translateX: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [ember.sway, -ember.sway, ember.sway] }) }], width: ember.size }]} />;
          })}
        </Animated.View>
      </View>

      <View style={styles.floorShadow} />
      <View style={styles.floorHorizon} />
      <View style={styles.floorGlow} />
      <View style={styles.pedestalHalo} />

      <Animated.View style={[styles.fireBowl, styles.fireBowlLeft, { opacity: fireBreath.interpolate({ inputRange: [0, 1], outputRange: [0.72, 0.9] }), transform: [{ scale: fireBreath.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.025] }) }] }]}>
        <View style={styles.bowlGlow} />
        <View style={styles.bowlCore} />
        <View style={styles.bowlBase} />
      </Animated.View>
      <Animated.View style={[styles.fireBowl, styles.fireBowlRight, { opacity: fireBreath.interpolate({ inputRange: [0, 1], outputRange: [0.68, 0.86] }), transform: [{ scale: fireBreath.interpolate({ inputRange: [0, 1], outputRange: [1.02, 0.985] }) }] }]}>
        <View style={styles.bowlGlow} />
        <View style={styles.bowlCore} />
        <View style={styles.bowlBase} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.comboWarmth, { opacity: Animated.add(intensity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }), milestonePulse.interpolate({ inputRange: [0, 1], outputRange: [0, milestoneGlowOpacity] })) }]} />

      <LinearGradient colors={["rgba(0,0,0,0.66)", "transparent"]} style={styles.hudContrast} />
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.52)"]} style={styles.controlContrast} />
      <View style={styles.vignette} />
    </View>
  );

  if (!children) return backdrop;

  return (
    <View style={styles.wrapper}>
      {backdrop}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  content: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "#020203", overflow: "hidden" },
  arenaImage: { ...StyleSheet.absoluteFillObject, height: "100%", opacity: 0.23, width: "100%" },
  depthBack: { backgroundColor: "rgba(82,13,12,0.05)", borderRadius: 180, height: "42%", left: "8%", position: "absolute", right: "8%", top: "14%" },
  depthMiddle: { borderColor: "rgba(197,65,25,0.08)", borderRadius: 220, borderWidth: 1, height: "56%", left: "-4%", position: "absolute", right: "-4%", top: "19%" },
  depthFront: { backgroundColor: "rgba(0,0,0,0.12)", bottom: "18%", height: 90, left: "-5%", position: "absolute", right: "-5%" },
  spotlight: { backgroundColor: "rgba(255,176,85,0.72)", height: "72%", position: "absolute", top: -210, width: 76 },
  spotlightLeft: { left: "12%" },
  spotlightRight: { right: "12%" },
  upperWarmth: { alignSelf: "center", backgroundColor: "rgba(211,58,14,0.1)", borderRadius: 220, height: 180, position: "absolute", top: -85, width: "92%" },
  stadiumSweep: { height: "125%", left: "50%", position: "absolute", top: "-12%", width: 150 },
  heatHaze: { alignSelf: "center", bottom: "19%", height: "36%", position: "absolute", width: "68%" },
  smoke: { height: 190, position: "absolute", width: 290 },
  smokeLeft: { bottom: "25%", left: -135 },
  smokeRight: { right: -145, top: "24%" },
  emberField: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  ember: { backgroundColor: "#F7A33C", borderRadius: 4, position: "absolute" },
  emberHot: { backgroundColor: "#FFD06A" },
  floorShadow: { alignSelf: "center", backgroundColor: "rgba(0,0,0,0.72)", borderRadius: 240, bottom: -105, height: 330, position: "absolute", width: "145%" },
  floorHorizon: { alignSelf: "center", borderColor: "rgba(220,75,22,0.2)", borderRadius: 260, borderTopWidth: 1, bottom: -70, height: 280, position: "absolute", width: "135%" },
  floorGlow: { alignSelf: "center", backgroundColor: "rgba(181,39,10,0.13)", borderRadius: 220, bottom: -78, height: 240, position: "absolute", width: "105%" },
  pedestalHalo: { alignSelf: "center", backgroundColor: "rgba(255,111,27,0.12)", borderColor: "rgba(246,137,45,0.2)", borderRadius: 150, borderTopWidth: 1, bottom: "23%", height: 72, position: "absolute", transform: [{ scaleX: 1.65 }], width: 175 },
  fireBowl: { alignItems: "center", bottom: "18%", height: 72, position: "absolute", width: 70 },
  fireBowlLeft: { left: -16 },
  fireBowlRight: { right: -16 },
  bowlGlow: { backgroundColor: "rgba(242,70,16,0.16)", borderRadius: 42, height: 76, position: "absolute", top: -25, width: 76 },
  bowlCore: { backgroundColor: "rgba(255,133,35,0.3)", borderRadius: 22, height: 34, width: 34 },
  bowlBase: { backgroundColor: "#180B0A", borderColor: "rgba(205,103,34,0.5)", borderRadius: 18, borderTopWidth: 2, height: 20, marginTop: -5, width: 58 },
  hudContrast: { height: 180, left: 0, position: "absolute", right: 0, top: 0 },
  controlContrast: { bottom: 0, height: 190, left: 0, position: "absolute", right: 0 },
  comboWarmth: { ...StyleSheet.absoluteFillObject, backgroundColor: "#B72E0B" },
  vignette: { ...StyleSheet.absoluteFillObject, borderColor: "rgba(0,0,0,0.58)", borderWidth: 24 },
});
