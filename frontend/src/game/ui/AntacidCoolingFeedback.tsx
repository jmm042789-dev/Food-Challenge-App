import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import ImpactEffect from "./ImpactEffect";

export default function AntacidCoolingFeedback({ trigger }: { trigger: number }) {
  const flash = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const message = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (trigger <= 0) return;
    [flash, wave, message].forEach((value) => { value.stopAnimation(); value.setValue(0); });
    const animation = Animated.parallel([
      Animated.sequence([Animated.timing(flash, { toValue: 1, duration: 90, useNativeDriver: true }), Animated.timing(flash, { toValue: 0, duration: 430, useNativeDriver: true })]),
      Animated.timing(wave, { toValue: 1, duration: 760, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([Animated.delay(80), Animated.timing(message, { toValue: 1, duration: 150, useNativeDriver: true }), Animated.delay(360), Animated.timing(message, { toValue: 0, duration: 170, useNativeDriver: true })]),
    ]);
    animation.start();
    return () => animation.stop();
  }, [flash, message, trigger, wave]);
  useEffect(() => () => { flash.stopAnimation(); wave.stopAnimation(); message.stopAnimation(); }, [flash, message, wave]);
  if (trigger <= 0) return null;
  return <View pointerEvents="none" style={styles.layer}>
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: flash }]}><LinearGradient colors={["rgba(97,226,255,0.52)", "rgba(30,116,167,0.2)", "transparent"]} style={StyleSheet.absoluteFill} /></Animated.View>
    <Animated.View style={[styles.wave, { opacity: wave.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0.65, 0.28, 0] }), transform: [{ translateY: wave.interpolate({ inputRange: [0, 1], outputRange: [-80, 260] }) }, { scaleX: wave.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.45] }) }] }]} />
    <ImpactEffect trigger={trigger} variant="completion" size={150} />
    <Animated.View style={[styles.message, { opacity: message, transform: [{ translateY: message.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }, { scale: message.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }]}><Text style={styles.text}>COOLED DOWN!</Text><Text style={styles.subtext}>REFRESHED</Text></Animated.View>
  </View>;
}
const styles = StyleSheet.create({ layer: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 100 }, wave: { backgroundColor: "rgba(111,225,244,0.18)", borderColor: "rgba(180,247,255,0.64)", borderRadius: 150, borderWidth: 2, height: 90, position: "absolute", width: 250 }, message: { alignItems: "center", backgroundColor: "rgba(7,33,42,0.94)", borderColor: "#8DE7F3", borderRadius: 9, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 9 }, text: { color: "#DFFFFF", fontSize: 17, fontWeight: "900", letterSpacing: 1.2 }, subtext: { color: "#82D9E9", fontSize: 7, fontWeight: "900", letterSpacing: 1.4, marginTop: 2 } });
