import React, { useEffect, useMemo, useRef } from "react";
import { Animated, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

type Variant = "xp" | "coins" | "health" | "heartburn" | "combo" | "timer" | "opponent" | "default";

type FireProgressBarProps = {
  value: number;
  max?: number;
  label?: string;
  variant?: Variant;
  showValue?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

const colors: Record<Variant, string> = {
  xp: "#FF9F1C",
  coins: "#F6C76A",
  health: "#FF6B4A",
  heartburn: "#FF4D4D",
  combo: "#FF7A18",
  timer: "#FFD166",
  opponent: "#C75050",
  default: "#FF8A00",
};

export default function FireProgressBar({
  value,
  max = 100,
  label,
  variant = "default",
  showValue = false,
  compact = false,
  style,
}: FireProgressBarProps) {
  const percent = useMemo(() => Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0)), [max, value]);
  const width = useRef(new Animated.Value(percent)).current;

  useEffect(() => {
    Animated.timing(width, { toValue: percent, duration: 260, useNativeDriver: false }).start();
  }, [percent, width]);

  const fillWidth = width.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });
  const fillColor = colors[variant];
  const accessibilityMax = Math.max(1, max);
  const accessibilityNow = Math.max(0, Math.min(accessibilityMax, value));

  return (
    <View accessibilityLabel={label ?? "Progress"} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: accessibilityMax, now: accessibilityNow }} style={style}>
      {(label || showValue) ? (
        <View style={styles.meta}>
          {label ? <Text style={styles.label}>{label}</Text> : <View />}
          {showValue ? <Text style={styles.value}>{Math.round(value)}{max !== 100 ? ` / ${Math.round(max)}` : "%"}</Text> : null}
        </View>
      ) : null}
      <View style={[styles.shell, compact && styles.shellCompact]}>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: fillWidth, backgroundColor: fillColor }]}>
            <View style={styles.fillHighlight} />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  meta: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  label: { color: "#F8D58A", fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },
  value: { color: "#FFF7E8", fontSize: 10, fontWeight: "800" },
  shell: { backgroundColor: "rgba(0, 0, 0, 0.65)", borderColor: "rgba(255, 154, 51, 0.38)", borderRadius: 999, borderWidth: 1, padding: 3 },
  shellCompact: { padding: 2 },
  track: { backgroundColor: "rgba(61, 36, 28, 0.78)", borderRadius: 999, height: 10, overflow: "hidden" },
  fill: { borderRadius: 999, height: "100%", minWidth: 0, overflow: "hidden" },
  fillHighlight: { backgroundColor: "rgba(255,255,255,0.25)", height: "32%", left: 2, position: "absolute", right: 2, top: 1 },
});
