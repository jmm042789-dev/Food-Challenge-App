import React, { memo, useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import type { ArenaAtmosphereState } from "./ArenaReactionTypes";

function ArenaEffects({ atmosphere, reducedMotion }: { atmosphere: ArenaAtmosphereState; reducedMotion: boolean }) {
  const intensity = useRef(new Animated.Value(0)).current;
  const reactionPulse = useRef(new Animated.Value(0)).current;
  const calloutOpacity = useRef(new Animated.Value(0)).current;
  const calloutScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.timing(intensity, { toValue: atmosphere.excitement, duration: reducedMotion ? 0 : 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(intensity, { toValue: atmosphere.excitement * 0.35, duration: reducedMotion ? 0 : 15000, easing: Easing.linear, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [atmosphere.excitement, intensity, reducedMotion]);

  useEffect(() => {
    reactionPulse.stopAnimation();
    reactionPulse.setValue(0);
    if (reducedMotion || !atmosphere.reactionKey) return;
    const animation = Animated.sequence([
      Animated.timing(reactionPulse, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.timing(reactionPulse, { toValue: 0, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [atmosphere.reactionKey, reactionPulse, reducedMotion]);

  useEffect(() => {
    calloutOpacity.stopAnimation();
    calloutScale.stopAnimation();
    calloutOpacity.setValue(0);
    calloutScale.setValue(reducedMotion ? 1 : 0.9);
    if (!atmosphere.callout || !atmosphere.calloutKey) return;
    const animation = Animated.parallel([
      Animated.sequence([
        Animated.timing(calloutOpacity, { toValue: 1, duration: reducedMotion ? 0 : 100, useNativeDriver: true }),
        Animated.delay(850),
        Animated.timing(calloutOpacity, { toValue: 0, duration: reducedMotion ? 0 : 180, useNativeDriver: true }),
      ]),
      Animated.spring(calloutScale, { toValue: 1, friction: 7, tension: 190, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [atmosphere.callout, atmosphere.calloutKey, calloutOpacity, calloutScale, reducedMotion]);

  useEffect(() => () => {
    intensity.stopAnimation(); reactionPulse.stopAnimation(); calloutOpacity.stopAnimation(); calloutScale.stopAnimation();
  }, [calloutOpacity, calloutScale, intensity, reactionPulse]);

  const showEmbers = atmosphere.theme.ambientEffect === "embers";
  const showConfetti = atmosphere.theme.ambientEffect === "confetti" && atmosphere.lastReaction === "MATCH_FINISHED";
  return (
    <View pointerEvents="none" style={styles.layer}>
      <Animated.View style={[styles.tint, { backgroundColor: atmosphere.theme.accentPrimary, opacity: intensity.interpolate({ inputRange: [0, 1], outputRange: [0, reducedMotion ? 0.055 : 0.11] }) }]} />
      {!reducedMotion ? <Animated.View style={[styles.flash, { backgroundColor: atmosphere.theme.accentSecondary, opacity: reactionPulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.13] }) }]} /> : null}
      {!reducedMotion && atmosphere.theme.ambientEffect === "spotlight" ? <Animated.View style={[styles.spotlight, { backgroundColor: atmosphere.theme.accentPrimary, opacity: intensity.interpolate({ inputRange: [0, 1], outputRange: [0.02, 0.12] }) }]} /> : null}
      {showEmbers ? <View style={styles.ambient}>{[0, 1, 2, 3].map((item) => <View key={item} style={[styles.ember, { backgroundColor: item % 2 ? atmosphere.theme.accentPrimary : atmosphere.theme.accentSecondary, left: `${18 + item * 21}%` }]} />)}</View> : null}
      {showConfetti ? <View style={styles.ambient}>{[0, 1, 2, 3].map((item) => <View key={item} style={[styles.confetti, { backgroundColor: item % 2 ? atmosphere.theme.accentPrimary : atmosphere.theme.accentSecondary, left: `${12 + item * 24}%`, top: 45 + (item % 2) * 18 }]} />)}</View> : null}
      {atmosphere.callout ? <Animated.View accessibilityLiveRegion="polite" style={[styles.callout, { borderColor: atmosphere.theme.accentPrimary, opacity: calloutOpacity, transform: [{ scale: calloutScale }] }]}><Text style={[styles.calloutText, { color: atmosphere.theme.accentPrimary }]}>{atmosphere.callout}</Text></Animated.View> : null}
    </View>
  );
}

export default memo(ArenaEffects);

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, overflow: "hidden", zIndex: 900 }, tint: { ...StyleSheet.absoluteFillObject }, flash: { ...StyleSheet.absoluteFillObject },
  spotlight: { alignSelf: "center", borderBottomLeftRadius: 160, borderBottomRightRadius: 160, height: "52%", position: "absolute", top: -120, transform: [{ scaleX: 0.55 }], width: 260 },
  ambient: { ...StyleSheet.absoluteFillObject }, ember: { borderRadius: 4, bottom: "16%", height: 4, opacity: 0.58, position: "absolute", width: 4 }, confetti: { height: 8, opacity: 0.72, position: "absolute", transform: [{ rotate: "18deg" }], width: 3 },
  callout: { alignSelf: "center", backgroundColor: "rgba(12,7,8,0.9)", borderRadius: 10, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 7, position: "absolute", top: "25%" }, calloutText: { fontSize: 15, fontStyle: "italic", fontWeight: "900", letterSpacing: 1 },
});
