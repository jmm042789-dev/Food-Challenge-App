import React, { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { getFoodArtwork } from "../../assets/foodArtwork";
import ImpactEffect from "./ImpactEffect";

type Props = { contestId: string; combo: number; timeRemaining: number; resetKey?: string; active?: boolean; onTap: () => void };

const HOT_FOOD_CONTESTS = new Set(["nathans-hotdogs", "wing-bowl", "pizza-hut-stuffed", "katz-pastrami", "in-n-out-burgers"]);
const CRUMBS = [
  { x: -38, y: -17, size: 4 }, { x: -27, y: -34, size: 3 }, { x: -12, y: -43, size: 5 }, { x: 15, y: -41, size: 3 },
  { x: 31, y: -30, size: 4 }, { x: 41, y: -12, size: 3 }, { x: -45, y: 4, size: 3 }, { x: 44, y: 8, size: 4 },
] as const;

function loop(value: Animated.Value, duration: number, delay = 0) {
  return Animated.loop(Animated.sequence([
    Animated.delay(delay),
    Animated.timing(value, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    Animated.timing(value, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
  ]));
}

export default function FoodArena({ contestId, combo, timeRemaining, resetKey = contestId, active = true, onTap }: Props) {
  const { width, height } = useWindowDimensions();
  const size = Math.min(width * 0.64, height * 0.34, 270);
  const foodArtwork = getFoodArtwork(contestId);
  const impactScale = useRef(new Animated.Value(1)).current;
  const impactRotation = useRef(new Animated.Value(0)).current;
  const idleY = useRef(new Animated.Value(0)).current;
  const idleBreath = useRef(new Animated.Value(0)).current;
  const idleRotation = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const haloIntensity = useRef(new Animated.Value(0)).current;
  const urgency = useRef(new Animated.Value(0)).current;
  const crumbProgress = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;
  const steamA = useRef(new Animated.Value(0)).current;
  const steamB = useRef(new Animated.Value(0)).current;
  const steamC = useRef(new Animated.Value(0)).current;
  const biteAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const biteCounter = useRef(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [biteEvent, setBiteEvent] = useState(0);
  const hotFood = HOT_FOOD_CONTESTS.has(contestId);
  const comboTier = combo >= 20 ? 4 : combo >= 15 ? 3 : combo >= 10 ? 2 : combo >= 5 ? 1 : 0;
  const steamValues = useMemo(() => [steamA, steamB, steamC] as const, [steamA, steamB, steamC]);
  const foodRotation = Animated.add(
    impactRotation,
    idleRotation.interpolate({ inputRange: [0, 1], outputRange: [-0.75, 0.75] }),
  ).interpolate({ inputRange: [-3, 3], outputRange: ["-3deg", "3deg"] });

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!mounted) return;
      setReducedMotion(enabled);
      if (enabled) {
        idleY.setValue(0);
        idleBreath.setValue(0);
        idleRotation.setValue(0.5);
      }
    });
    return () => { mounted = false; };
  }, [idleBreath, idleRotation, idleY]);

  useEffect(() => {
    const animations = active && !reducedMotion ? [
      loop(idleY, 2300), loop(idleBreath, 2800, 160), loop(idleRotation, 3400, 300), loop(shine, 3600, 500),
      ...(hotFood ? [loop(steamA, 2400), loop(steamB, 2800, 500), loop(steamC, 3200, 900)] : []),
    ] : [];
    animations.forEach((animation) => animation.start());
    if (!active) {
      Animated.parallel([
        Animated.timing(idleY, { toValue: 0, duration: 240, useNativeDriver: true }),
        Animated.timing(idleBreath, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]).start();
    }
    return () => animations.forEach((animation) => animation.stop());
  }, [active, hotFood, idleBreath, idleRotation, idleY, reducedMotion, shine, steamA, steamB, steamC]);

  useEffect(() => {
    biteAnimation.current?.stop();
    biteAnimation.current = null;
    biteCounter.current = 0;
    impactScale.stopAnimation();
    impactRotation.stopAnimation();
    shakeX.stopAnimation();
    crumbProgress.stopAnimation();
    impactScale.setValue(0.88);
    impactRotation.setValue(0);
    shakeX.setValue(0);
    crumbProgress.setValue(0);
    setBiteEvent(0);
    Animated.spring(impactScale, { toValue: 1, friction: 6, tension: 210, useNativeDriver: true }).start();
  }, [contestId, crumbProgress, impactRotation, impactScale, resetKey, shakeX]);

  useEffect(() => {
    Animated.timing(haloIntensity, { toValue: comboTier / 4, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [comboTier, haloIntensity]);

  useEffect(() => {
    urgency.stopAnimation();
    if (!active || timeRemaining <= 0 || timeRemaining > 5 || reducedMotion) {
      Animated.timing(urgency, { toValue: 0, duration: 180, useNativeDriver: true }).start();
      return;
    }
    urgency.setValue(1);
    Animated.timing(urgency, { toValue: 0, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [active, reducedMotion, timeRemaining, urgency]);

  useEffect(() => () => {
    biteAnimation.current?.stop();
    biteAnimation.current = null;
    [impactScale, impactRotation, idleY, idleBreath, idleRotation, shakeX, buttonScale, haloIntensity, urgency, crumbProgress, shine, ...steamValues].forEach((value) => value.stopAnimation());
  }, [buttonScale, crumbProgress, haloIntensity, idleBreath, idleRotation, idleY, impactRotation, impactScale, shakeX, shine, steamValues, urgency]);

  const tap = () => {
    onTap();
    if (!active) return;
    biteCounter.current += 1;
    setBiteEvent(biteCounter.current);
    const compression = 0.94 - comboTier * 0.007;
    const direction = biteCounter.current % 2 === 0 ? -1 : 1;
    biteAnimation.current?.stop();
    biteAnimation.current = null;
    impactScale.stopAnimation();
    impactRotation.stopAnimation();
    shakeX.stopAnimation();
    crumbProgress.stopAnimation();
    impactScale.setValue(1);
    impactRotation.setValue(0);
    shakeX.setValue(0);
    crumbProgress.setValue(0);
    biteAnimation.current = Animated.parallel([
      Animated.sequence([
        Animated.timing(impactScale, { toValue: compression, duration: 48, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(impactScale, { toValue: 1, friction: 7, tension: 300, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(impactRotation, { toValue: direction * (1.35 + comboTier * 0.12), duration: 44, useNativeDriver: true }),
        Animated.spring(impactRotation, { toValue: 0, friction: 8, tension: 280, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(shakeX, { toValue: direction * -1.5, duration: 28, useNativeDriver: true }),
        Animated.spring(shakeX, { toValue: 0, friction: 8, tension: 300, useNativeDriver: true }),
      ]),
      Animated.timing(crumbProgress, { toValue: 1, duration: 210, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    biteAnimation.current.start(({ finished }) => {
      if (finished) biteAnimation.current = null;
    });
  };

  const pressButton = (pressed: boolean) => {
    buttonScale.stopAnimation();
    Animated.spring(buttonScale, { toValue: pressed ? 0.91 : 1, friction: pressed ? 8 : 4, tension: pressed ? 300 : 240, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: shakeX }] }]}>
      <Animated.View pointerEvents="none" style={[styles.arenaGlow, { height: size + 46, opacity: Animated.add(haloIntensity.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.48] }), urgency.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] })), transform: [{ scale: Animated.add(haloIntensity.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }), urgency.interpolate({ inputRange: [0, 1], outputRange: [0, 0.04] })) }], width: size + 46 }]} />
      <Pressable accessibilityRole="button" accessibilityLabel="Bite food" disabled={!active} onPress={tap} style={styles.foodPressable}>
        <Animated.View style={[styles.idleStage, { transform: [{ translateY: idleY.interpolate({ inputRange: [0, 1], outputRange: [2, -3] }) }, { scale: idleBreath.interpolate({ inputRange: [0, 1], outputRange: [0.995, 1.008] }) }] }]}>
          {hotFood ? <View pointerEvents="none" style={styles.steamLayer}>{steamValues.map((value, index) => <Animated.View key={index} style={[styles.steam, { left: `${31 + index * 18}%`, opacity: value.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0.13, 0] }), transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [8, -30] }) }, { translateX: value.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-2, 2, -1] }) }, { scaleY: value.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.15] }) }] }]} />)}</View> : null}
          <Animated.View style={[styles.foodBox, { height: size, width: size, transform: [{ scale: impactScale }, { rotate: foodRotation }] }]}>
            <Image source={foodArtwork.source} resizeMode="contain" style={{ height: size * foodArtwork.scale, width: size * foodArtwork.scale }} />
            <Animated.View pointerEvents="none" style={[styles.shine, { opacity: shine.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.09, 0] }), transform: [{ translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-size * 0.28, size * 0.28] }) }, { rotate: "18deg" }] }]} />
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>{CRUMBS.map((crumb, index) => <Animated.View key={index} style={[styles.crumb, { height: crumb.size, opacity: crumbProgress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.8, 0] }), transform: [{ translateX: crumbProgress.interpolate({ inputRange: [0, 1], outputRange: [0, crumb.x] }) }, { translateY: crumbProgress.interpolate({ inputRange: [0, 1], outputRange: [0, crumb.y] }) }, { scale: crumbProgress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.1] }) }], width: crumb.size }]} />)}</View>
            <ImpactEffect trigger={biteEvent} variant="bite" size={size * 0.58} />
          </Animated.View>
        </Animated.View>
      </Pressable>
      <View style={styles.pedestal} pointerEvents="none"><View style={styles.pedestalRim} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Bite" disabled={!active} onPress={tap} onPressIn={() => pressButton(true)} onPressOut={() => pressButton(false)} style={[styles.biteTouchTarget, !active && styles.biteDisabled]}>
        <Animated.View style={[styles.biteOuter, { transform: [{ scale: buttonScale }] }]}>
          <View style={styles.biteInner}><Text style={styles.biteText}>BITE</Text><Text style={styles.biteSub}>TAP!</Text></View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", flex: 1, justifyContent: "center", paddingBottom: 4, paddingTop: 14, width: "100%" },
  arenaGlow: { backgroundColor: "rgba(222,71,17,0.32)", borderColor: "rgba(255,157,55,0.18)", borderRadius: 999, borderWidth: 1, position: "absolute", top: "12%" },
  foodPressable: { alignItems: "center", justifyContent: "center", zIndex: 3 },
  idleStage: { alignItems: "center", justifyContent: "center" },
  foodBox: { alignItems: "center", justifyContent: "center", overflow: "visible" },
  shine: { backgroundColor: "#FFF1C9", height: "74%", position: "absolute", width: 12 },
  crumb: { backgroundColor: "#F3A84D", borderRadius: 3, left: "50%", position: "absolute", top: "48%" },
  steamLayer: { height: 70, left: 0, position: "absolute", right: 0, top: -12, zIndex: 0 },
  steam: { backgroundColor: "#FFF0DA", borderRadius: 8, height: 38, position: "absolute", top: 8, width: 5 },
  pedestal: { backgroundColor: "rgba(8,5,6,0.88)", borderColor: "rgba(222,119,33,0.4)", borderRadius: 100, borderWidth: 1, height: 42, marginTop: -28, transform: [{ scaleX: 1.75 }], width: 142, zIndex: 1 },
  pedestalRim: { borderColor: "rgba(245,158,57,0.34)", borderRadius: 100, borderTopWidth: 2, height: 18, left: 8, position: "absolute", right: 8, top: 4 },
  biteTouchTarget: { alignItems: "center", height: 118, justifyContent: "center", marginTop: 0, width: 118, zIndex: 5 },
  biteOuter: { alignItems: "center", backgroundColor: "#0B0809", borderColor: "#F0A13A", borderRadius: 52, borderWidth: 3, elevation: 9, height: 102, justifyContent: "center", shadowColor: "#FF641E", shadowOffset: { height: 0, width: 0 }, shadowOpacity: 0.76, shadowRadius: 18, width: 102 },
  biteInner: { alignItems: "center", backgroundColor: "#B83B12", borderColor: "#FF7A27", borderRadius: 42, borderWidth: 2, height: 82, justifyContent: "center", width: 82 },
  biteText: { color: "#FFF0D2", fontSize: 23, fontWeight: "900", letterSpacing: 1.2, lineHeight: 25 },
  biteSub: { color: "#FFD07B", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  biteDisabled: { opacity: 0.48 },
});
