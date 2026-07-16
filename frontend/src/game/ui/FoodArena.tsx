import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { getFoodArtwork } from "../../assets/foodArtwork";
import ImpactEffect from "./ImpactEffect";

type Props = { contestId: string; combo: number; active?: boolean; onTap: () => void };

export default function FoodArena({ contestId, combo, active = true, onTap }: Props) {
  const { width, height } = useWindowDimensions();
  const size = Math.min(width * 0.64, height * 0.34, 270);
  const foodArtwork = getFoodArtwork(contestId);
  const foodScale = useRef(new Animated.Value(1)).current;
  const rotationValue = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const ringEvent = useRef(0);
  const previousCombo = useRef(combo);
  const [biteEvent, setBiteEvent] = useState(0);
  const rotation = rotationValue.interpolate({ inputRange: [-2, 2], outputRange: ["-2deg", "2deg"] });

  useEffect(() => { previousCombo.current = combo; }, [combo]);

  const tap = () => {
    onTap();
    if (!active) return;
    setBiteEvent((event) => event + 1);
    ringEvent.current += 1;
    foodScale.stopAnimation();
    rotationValue.stopAnimation();
    shakeX.stopAnimation();
    foodScale.setValue(1);
    rotationValue.setValue(Math.random() * 4 - 2);
    shakeX.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(foodScale, { toValue: 0.9, duration: 55, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(foodScale, { toValue: 1, friction: 5, tension: 260, useNativeDriver: true }),
      ]),
      Animated.spring(rotationValue, { toValue: 0, friction: 7, tension: 190, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(shakeX, { toValue: -2, duration: 24, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 2, duration: 36, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 0, duration: 34, useNativeDriver: true }),
      ]),
    ]).start();
  };

  const pressButton = (pressed: boolean) => {
    buttonScale.stopAnimation();
    Animated.spring(buttonScale, {
      toValue: pressed ? 0.91 : 1,
      friction: pressed ? 8 : 4,
      tension: pressed ? 300 : 240,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: shakeX }] }]}>
      <View style={[styles.arenaGlow, { height: size + 46, width: size + 46 }]} pointerEvents="none" />
      <Pressable accessibilityRole="button" accessibilityLabel="Bite food" disabled={!active} onPress={tap} style={styles.foodPressable}>
        <Animated.View style={[styles.foodBox, { height: size, width: size, transform: [{ scale: foodScale }, { rotate: rotation }] }]}>
          <Image source={foodArtwork.source} resizeMode="contain" style={{ height: size * foodArtwork.scale, width: size * foodArtwork.scale }} />
          <ImpactEffect trigger={biteEvent} variant="bite" size={size * 0.72} />
          <ImpactEffect trigger={biteEvent} variant="warning" size={size * 0.46} />
          <ImpactEffect trigger={biteEvent} variant="completion" size={size * 0.32} />
        </Animated.View>
      </Pressable>
      <View style={styles.pedestal} pointerEvents="none"><View style={styles.pedestalRim} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Bite" disabled={!active} onPress={tap} onPressIn={() => pressButton(true)} onPressOut={() => pressButton(false)} style={[styles.biteTouchTarget, !active && styles.biteDisabled]}>
        <Animated.View style={[styles.biteOuter, { transform: [{ scale: buttonScale }] }]}>
          <ImpactEffect trigger={ringEvent.current} variant="bite" size={112} />
          <View style={styles.biteInner}>
            <Text style={styles.biteText}>BITE</Text>
            <Text style={styles.biteSub}>TAP!</Text>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", flex: 1, justifyContent: "center", paddingBottom: 4, paddingTop: 14, width: "100%" },
  arenaGlow: { backgroundColor: "rgba(200,55,12,0.14)", borderRadius: 999, position: "absolute", top: "12%" },
  foodPressable: { alignItems: "center", justifyContent: "center", zIndex: 3 },
  foodBox: { alignItems: "center", justifyContent: "center" },
  pedestal: { backgroundColor: "rgba(8,5,6,0.88)", borderColor: "rgba(222,119,33,0.4)", borderRadius: 100, borderWidth: 1, height: 42, marginTop: -28, transform: [{ scaleX: 1.75 }], width: 142, zIndex: 1 },
  pedestalRim: { borderColor: "rgba(245,158,57,0.34)", borderRadius: 100, borderTopWidth: 2, height: 18, left: 8, position: "absolute", right: 8, top: 4 },
  biteTouchTarget: { alignItems: "center", height: 118, justifyContent: "center", marginTop: 0, width: 118, zIndex: 5 },
  biteOuter: { alignItems: "center", backgroundColor: "#0B0809", borderColor: "#F0A13A", borderRadius: 52, borderWidth: 3, elevation: 9, height: 102, justifyContent: "center", shadowColor: "#FF641E", shadowOffset: { height: 0, width: 0 }, shadowOpacity: 0.76, shadowRadius: 18, width: 102 },
  biteInner: { alignItems: "center", backgroundColor: "#B83B12", borderColor: "#FF7A27", borderRadius: 42, borderWidth: 2, height: 82, justifyContent: "center", width: 82 },
  biteText: { color: "#FFF0D2", fontSize: 23, fontWeight: "900", letterSpacing: 1.2, lineHeight: 25 },
  biteSub: { color: "#FFD07B", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  biteDisabled: { opacity: 0.48 },
});
