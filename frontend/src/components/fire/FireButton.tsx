import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useReducedMotionPreference } from "./FireProgressBar";
import { playSound } from "../../audio/AdaptiveAudioManager";
import { useAppPreferences } from "../../preferences/AppPreferences";

type Variant = "primary" | "secondary" | "danger" | "success" | "ghost" | "gold";
type Size = "compact" | "small" | "medium" | "large";
type Props = {
  title?: string; onPress: () => void; disabled?: boolean; loading?: boolean; size?: Size;
  variant?: Variant; leftIcon?: React.ReactNode; rightIcon?: React.ReactNode; subtitle?: string;
  fullWidth?: boolean; style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  haptic?: boolean;
};

const tones: Record<Variant, { base: string; trim: string }> = {
  primary: { base: "#C94A0A", trim: "#FFB347" }, secondary: { base: "#30201B", trim: "#C87937" },
  danger: { base: "#7A2424", trim: "#E36A61" }, success: { base: "#24553A", trim: "#75C78C" },
  ghost: { base: "rgba(18,14,15,0.82)", trim: "rgba(255,170,84,0.45)" }, gold: { base: "#9C6311", trim: "#FFD77A" },
};
const sizing: Record<Size, { minHeight: number; font: number; px: number }> = { compact: { minHeight: 44, font: 12, px: 13 }, small: { minHeight: 50, font: 14, px: 18 }, medium: { minHeight: 60, font: 16, px: 22 }, large: { minHeight: 72, font: 19, px: 28 } };

export default function FireButton({ title = "START CHALLENGE", onPress, disabled = false, loading = false, size = "medium", variant = "primary", leftIcon, rightIcon, subtitle, fullWidth = false, style, accessibilityLabel, accessibilityHint, haptic = true }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.55)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const [pressed, setPressed] = useState(false);
  const reducedMotion = useReducedMotionPreference();
  const { preferences } = useAppPreferences();
  const tone = tones[variant]; const measure = sizing[size]; const inactive = disabled || loading;
  const handlePress = () => {
    void playSound("BUTTON_PRESS");
    onPress();
  };
  const animate = (toValue: number) => {
    if (reducedMotion) return;
    Animated.spring(scale, { toValue, friction: 7, tension: 220, useNativeDriver: true }).start();
  };
  const release = () => {
    setPressed(false);
    if (reducedMotion) return;
    animate(1);
    ringOpacity.stopAnimation();
    ringScale.stopAnimation();
    ringOpacity.setValue(0.75);
    ringScale.setValue(0.55);
    Animated.parallel([
      Animated.timing(ringOpacity, { toValue: 0, duration: 260, useNativeDriver: true }),
      Animated.timing(ringScale, { toValue: 1.15, duration: 260, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    if (!reducedMotion) return;
    scale.stopAnimation();
    ringOpacity.stopAnimation();
    ringScale.stopAnimation();
    scale.setValue(1);
    ringOpacity.setValue(0);
    ringScale.setValue(0.55);
  }, [reducedMotion, ringOpacity, ringScale, scale]);
  useEffect(() => {
    shimmer.stopAnimation();
    shimmer.setValue(0);
    if (reducedMotion || inactive) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.delay(1500),
      Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(shimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [inactive, reducedMotion, shimmer]);
  return <View style={[styles.wrapper, fullWidth && styles.fullWidth, style]}>
    <Pressable accessibilityHint={accessibilityHint} accessibilityLabel={accessibilityLabel ?? title} accessibilityRole="button" accessibilityState={{ disabled: inactive, busy: loading }} disabled={inactive} onPress={handlePress} onPressIn={() => { setPressed(true); animate(0.93); if (haptic && preferences.hapticsEnabled && !reducedMotion) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }} onPressOut={release}>
      <Animated.View style={[styles.button, { backgroundColor: tone.base, borderColor: tone.trim, minHeight: measure.minHeight, paddingHorizontal: measure.px, opacity: inactive ? 0.48 : 1, transform: [{ scale }] }, fullWidth && styles.fullWidth]}>
        <LinearGradient colors={["rgba(255,255,255,0.12)", "transparent", "rgba(0,0,0,0.12)"]} pointerEvents="none" style={StyleSheet.absoluteFill} />
        <Animated.View pointerEvents="none" style={[styles.shimmer, { opacity: shimmer.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.42, 0] }), transform: [{ translateX: shimmer.interpolate({ inputRange: [0, 1], outputRange: [-90, 220] }) }, { rotate: "-18deg" }] }]} />
        <Animated.View pointerEvents="none" style={[styles.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}><Image source={require("../../assets/ui/animations/button-click-ring.png")} style={styles.ringImage} /></Animated.View>
        <View pointerEvents="none" style={[styles.highlight, { backgroundColor: tone.trim, opacity: pressed ? 0.28 : 0.16 }]} />
        {loading ? <ActivityIndicator color="#FFF7E8" /> : <View style={styles.content}>{leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}<View style={styles.labelBlock}><Text style={[styles.text, { fontSize: measure.font }]}>{title}</Text>{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}</View>{rightIcon ? <View style={styles.rightIcon}>{rightIcon}</View> : null}</View>}
      </Animated.View>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", justifyContent: "center", marginBottom: 8, marginTop: 12 }, fullWidth: { alignSelf: "stretch", width: "100%" },
  button: { alignItems: "center", borderRadius: 15, borderWidth: 1, elevation: 5, justifyContent: "center", overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 6 },
  shimmer: { backgroundColor: "rgba(255,244,215,0.38)", bottom: -24, position: "absolute", top: -24, width: 30 },
  ring: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  ringImage: { height: 88, tintColor: "#FF9B3D", width: 88 },
  highlight: { height: 1, left: 10, position: "absolute", right: 10, top: 1 }, content: { alignItems: "center", flexDirection: "row", justifyContent: "center", minWidth: 0 }, labelBlock: { flexShrink: 1, minWidth: 0 },
  text: { color: "#FFF7E8", fontWeight: "900", letterSpacing: 0.8, textAlign: "center" }, subtitle: { color: "#FFE0B2", fontSize: 10, fontWeight: "700", marginTop: 1, textAlign: "center" }, leftIcon: { marginRight: 7 }, rightIcon: { marginLeft: 7 },
});
