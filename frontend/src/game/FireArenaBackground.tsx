import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type FireArenaBackgroundProps = {
  children?: React.ReactNode;
};

const ARENA_IMAGE = require("../assets/backgrounds/arena.png");
const EMBER_IMAGE = require("../assets/ui/effects/embers-particle.png");
const SMOKE_IMAGE = require("../assets/ui/effects/smoke-puff.png");

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

/** Six fixed, native-driven atmosphere planes. No per-frame JS or generated particles. */
export default function FireArenaBackground({ children }: FireArenaBackgroundProps) {
  const spotlightLeft = useRef(new Animated.Value(0)).current;
  const spotlightRight = useRef(new Animated.Value(0)).current;
  const smokeLeft = useRef(new Animated.Value(0)).current;
  const smokeRight = useRef(new Animated.Value(0)).current;
  const embersBack = useRef(new Animated.Value(0)).current;
  const embersFront = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animations = [
      ambientLoop(spotlightLeft, 7200),
      ambientLoop(spotlightRight, 8600, 900),
      ambientLoop(smokeLeft, 11200),
      ambientLoop(smokeRight, 12800, 1200),
      ambientLoop(embersBack, 10400, 500),
      ambientLoop(embersFront, 8200, 1700),
    ];
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [embersBack, embersFront, smokeLeft, smokeRight, spotlightLeft, spotlightRight]);

  const backdrop = (
    <View pointerEvents="none" style={styles.backdrop}>
      <LinearGradient
        colors={["#020203", "#100406", "#260707", "#080304", "#020203"]}
        locations={[0, 0.24, 0.56, 0.8, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Image source={ARENA_IMAGE} resizeMode="cover" style={styles.arenaImage} />
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

      <Animated.Image
        source={EMBER_IMAGE}
        resizeMode="contain"
        style={[
          styles.emberPlane,
          styles.embersBack,
          {
            opacity: embersBack.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.13] }),
            transform: [
              { translateY: embersBack.interpolate({ inputRange: [0, 1], outputRange: [36, -30] }) },
              { translateX: embersBack.interpolate({ inputRange: [0, 1], outputRange: [-8, 10] }) },
              { scale: 0.78 },
            ],
          },
        ]}
      />

      <View style={styles.floorShadow} />
      <View style={styles.floorHorizon} />
      <View style={styles.floorGlow} />
      <View style={styles.pedestalHalo} />

      <View style={[styles.fireBowl, styles.fireBowlLeft]}>
        <View style={styles.bowlGlow} />
        <View style={styles.bowlCore} />
        <View style={styles.bowlBase} />
      </View>
      <View style={[styles.fireBowl, styles.fireBowlRight]}>
        <View style={styles.bowlGlow} />
        <View style={styles.bowlCore} />
        <View style={styles.bowlBase} />
      </View>

      <Animated.Image
        source={EMBER_IMAGE}
        resizeMode="contain"
        style={[
          styles.emberPlane,
          styles.embersFront,
          {
            opacity: embersFront.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.18] }),
            transform: [
              { translateY: embersFront.interpolate({ inputRange: [0, 1], outputRange: [55, -42] }) },
              { translateX: embersFront.interpolate({ inputRange: [0, 1], outputRange: [10, -12] }) },
              { scale: 1.08 },
            ],
          },
        ]}
      />

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
  spotlight: { backgroundColor: "rgba(255,176,85,0.72)", height: "72%", position: "absolute", top: -210, width: 76 },
  spotlightLeft: { left: "12%" },
  spotlightRight: { right: "12%" },
  upperWarmth: { alignSelf: "center", backgroundColor: "rgba(211,58,14,0.1)", borderRadius: 220, height: 180, position: "absolute", top: -85, width: "92%" },
  smoke: { height: 190, position: "absolute", width: 290 },
  smokeLeft: { bottom: "25%", left: -135 },
  smokeRight: { right: -145, top: "24%" },
  emberPlane: { height: 245, position: "absolute", tintColor: "#FF9B37", width: 245 },
  embersBack: { right: -54, top: "20%" },
  embersFront: { bottom: "10%", left: -68 },
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
  vignette: { ...StyleSheet.absoluteFillObject, borderColor: "rgba(0,0,0,0.58)", borderWidth: 24 },
});
