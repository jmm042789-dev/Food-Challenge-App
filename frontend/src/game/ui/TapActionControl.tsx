import React, { memo, useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

import type { HeatTier } from "../heartburn";

export type TapActionControlProps = {
  active: boolean;
  combo: number;
  heatTier: HeatTier;
  overheatWarningActive: boolean;
  reducedMotion: boolean;
  onAction: () => number | null;
  title?: string;
  subtitle?: string;
  energyTier?: 0 | 1 | 2 | 3;
  accent?: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  onAccepted?: (acceptedSequence: number) => void;
};

function TapActionControl({
  active,
  combo,
  heatTier,
  overheatWarningActive,
  reducedMotion,
  onAction,
  title = "BITE!",
  subtitle = active ? "TAP TO DEVOUR" : "WAITING FOR MATCH",
  energyTier = 0,
  accent,
  accessibilityLabel,
  accessibilityHint,
  onAccepted,
}: TapActionControlProps) {
  const pressScale = useRef(new Animated.Value(1)).current;
  const impact = useRef(new Animated.Value(0)).current;

  const animatePress = (pressed: boolean) => {
    pressScale.stopAnimation();
    Animated.spring(pressScale, {
      toValue: pressed && !reducedMotion ? 0.965 : 1,
      friction: 8,
      tension: 320,
      useNativeDriver: true,
    }).start();
  };

  const triggerAction = () => {
    const acceptedSequence = onAction();
    if (acceptedSequence === null) return;
    onAccepted?.(acceptedSequence);
    impact.stopAnimation();
    impact.setValue(1);
    Animated.timing(impact, {
      toValue: 0,
      duration: reducedMotion ? 90 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => () => {
    pressScale.stopAnimation();
    impact.stopAnimation();
  }, [impact, pressScale]);

  return (
    <Pressable
      accessibilityHint={accessibilityHint ?? "Activates one gameplay bite when the match accepts input."}
      accessibilityLabel={accessibilityLabel ?? (active ? "Bite food" : "Bite unavailable until gameplay starts")}
      accessibilityRole="button"
      accessibilityState={{ disabled: !active }}
      disabled={!active}
      onPress={triggerAction}
      onPressIn={() => animatePress(true)}
      onPressOut={() => animatePress(false)}
      style={styles.touchTarget}
    >
      <Animated.View pointerEvents="none" style={[styles.impactGlow, energyTier >= 1 && styles.energyGlow, energyTier >= 3 && styles.maxGlow, {
        opacity: impact,
        transform: [{ scale: impact.interpolate({ inputRange: [0, 1], outputRange: [1.08, 0.96] }) }],
      }]} />
      <Animated.View style={[
        styles.pad,
        combo >= 5 && styles.comboPad,
        energyTier >= 1 && styles.energyPad,
        energyTier >= 3 && styles.maxPad,
        heatTier === "CRITICAL" || heatTier === "OVERHEATED" ? styles.criticalPad : null,
        overheatWarningActive && styles.warningPad,
        !active && styles.disabledPad,
        { transform: [{ scale: pressScale }] },
      ]}>
        {accent}
        <View style={styles.padInset}>
          <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={styles.title}>{title}</Text>
          <Text maxFontSizeMultiplier={1.4} numberOfLines={1} style={styles.subtitle}>{subtitle}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default memo(TapActionControl);

const styles = StyleSheet.create({
  touchTarget: { alignItems: "center", height: 82, justifyContent: "center", maxWidth: 520, width: "78%" },
  impactGlow: { backgroundColor: "rgba(255,141,47,0.48)", borderRadius: 24, bottom: 1, left: -5, position: "absolute", right: -5, top: 1 },
  energyGlow: { backgroundColor: "rgba(255,187,55,0.58)" },
  maxGlow: { left: -8, right: -8 },
  pad: { backgroundColor: "#24100B", borderColor: "#F09A37", borderRadius: 22, borderWidth: 3, elevation: 8, height: 76, justifyContent: "center", overflow: "hidden", shadowColor: "#FF6A21", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12, width: "100%" },
  padInset: { alignItems: "center", backgroundColor: "#B63B13", borderColor: "#FFB04B", borderRadius: 17, borderWidth: 2, bottom: 6, justifyContent: "center", left: 6, position: "absolute", right: 6, top: 6 },
  comboPad: { borderColor: "#FFC75A", shadowOpacity: 0.72 },
  energyPad: { borderColor: "#FFD35E", shadowOpacity: 0.78 },
  maxPad: { borderWidth: 4, shadowRadius: 16 },
  criticalPad: { borderColor: "#FF663D" },
  warningPad: { borderColor: "#FF8B53", shadowOpacity: 0.38 },
  disabledPad: { opacity: 0.42, shadowOpacity: 0 },
  title: { color: "#FFF4D7", fontSize: 26, fontWeight: "900", letterSpacing: 1.6, lineHeight: 28 },
  subtitle: { color: "#FFD18A", fontSize: 8, fontWeight: "900", letterSpacing: 1.2, marginTop: 1 },
});
