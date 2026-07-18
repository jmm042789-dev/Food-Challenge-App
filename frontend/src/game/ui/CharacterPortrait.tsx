import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, type ImageSourcePropType, StyleSheet, Text, View } from "react-native";

export type CharacterReaction = "idle" | "combo" | "leading" | "behind" | "scoring" | "hit" | "victory" | "defeat";

type Props = {
  image?: ImageSourcePropType;
  fallback?: string;
  name: string;
  subtitle?: string;
  side?: "player" | "opponent";
  size?: "compact" | "standard";
  reaction?: CharacterReaction;
  reactionKey?: string | number;
  reactionStrength?: number;
};

export default function CharacterPortrait({ image, fallback, name, subtitle, side = "player", size = "standard", reaction = "idle", reactionKey = reaction, reactionStrength = 0 }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const lunge = useRef(new Animated.Value(0)).current;
  const idleLift = useRef(new Animated.Value(0)).current;
  const idleBreath = useRef(new Animated.Value(0)).current;
  const idleTilt = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(0)).current;
  const [reducedMotion, setReducedMotion] = useState(false);
  const rotation = tilt.interpolate({ inputRange: [-1, 1], outputRange: ["-5deg", "5deg"] });
  const compact = size === "compact";

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (mounted) setReducedMotion(enabled); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (side !== "opponent" || reducedMotion) return;
    const breathing = Animated.loop(Animated.sequence([
      Animated.timing(idleBreath, { toValue: 1, duration: reaction === "behind" ? 1500 : 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(idleBreath, { toValue: 0, duration: reaction === "behind" ? 1500 : 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const movement = Animated.loop(Animated.sequence([
      Animated.timing(idleLift, { toValue: 1, duration: 2700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(idleLift, { toValue: 0, duration: 2700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const head = Animated.loop(Animated.sequence([
      Animated.timing(idleTilt, { toValue: 1, duration: 4300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(idleTilt, { toValue: 0, duration: 4300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    breathing.start(); movement.start(); head.start();
    return () => { breathing.stop(); movement.stop(); head.stop(); };
  }, [idleBreath, idleLift, idleTilt, reaction, reducedMotion, side]);

  useEffect(() => {
    if (side !== "opponent" || reducedMotion) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!active) return;
        blink.setValue(0);
        Animated.sequence([
          Animated.timing(blink, { toValue: 1, duration: 70, useNativeDriver: true }),
          Animated.timing(blink, { toValue: 0, duration: 90, useNativeDriver: true }),
        ]).start(() => { if (active) schedule(); });
      }, 8000 + Math.round(Math.random() * 7000));
    };
    schedule();
    return () => { active = false; if (timer) clearTimeout(timer); blink.stopAnimation(); };
  }, [blink, reducedMotion, side]);

  useEffect(() => {
    if (reaction === "idle") return;
    [scale, tilt, lift, glow, lunge].forEach((value) => value.stopAnimation());
    const comboPower = reaction === "combo" ? Math.min(4, Math.max(1, reactionStrength)) : 0;
    const strong = reaction === "combo" || reaction === "scoring" || reaction === "victory";
    const subdued = reaction === "behind" || reaction === "defeat";
    scale.setValue(reaction === "scoring" ? 0.94 : reaction === "hit" ? 0.94 : strong ? 1.06 + comboPower * 0.01 : subdued ? 0.96 : 1.04);
    tilt.setValue(reaction === "hit" ? -0.8 : side === "player" ? -0.55 : 0.55 + comboPower * 0.08);
    lift.setValue(strong ? -3 : subdued ? 2 : -1);
    lunge.setValue(reaction === "scoring" ? (side === "opponent" ? -3 : 3) : reaction === "hit" ? 2 : 0);
    glow.setValue(reaction === "scoring" ? 0.9 : strong ? 0.65 + comboPower * 0.06 : 0.38);
    const animation = Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: strong ? 6 : 8, tension: 240, useNativeDriver: true }),
      Animated.spring(tilt, { toValue: 0, friction: 7, tension: 210, useNativeDriver: true }),
      Animated.spring(lift, { toValue: 0, friction: 7, tension: 220, useNativeDriver: true }),
      Animated.spring(lunge, { toValue: 0, friction: 8, tension: 280, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: reaction === "scoring" || reaction === "hit" ? 340 : strong ? 420 : 300, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [glow, lift, lunge, reaction, reactionKey, reactionStrength, scale, side, tilt]);

  useEffect(() => () => {
    [scale, tilt, lift, glow, lunge, idleLift, idleBreath, idleTilt, blink].forEach((value) => value.stopAnimation());
  }, [blink, glow, idleBreath, idleLift, idleTilt, lift, lunge, scale, tilt]);

  const fallbackText = fallback?.trim() || name.trim().slice(0, 2).toUpperCase();
  return (
    <Animated.View style={[styles.root, side === "opponent" && styles.opponentRoot, compact && styles.compactRoot, { transform: [{ translateX: lunge }, { translateY: idleLift.interpolate({ inputRange: [0, 1], outputRange: [0, -2.5] }) }, { translateY: lift }, { scale: idleBreath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.018] }) }, { scale }, { rotate: idleTilt.interpolate({ inputRange: [0, 1], outputRange: ["-0.6deg", "0.6deg"] }) }, { rotate: rotation }] }]}>
      <View style={[styles.frame, compact && styles.compactFrame, side === "opponent" && styles.opponentFrame]}>
        <Animated.View pointerEvents="none" style={[styles.reactionGlow, { opacity: glow }]} />
        {image ? <Image source={image} resizeMode="contain" style={[styles.image, compact && styles.compactImage]} /> : <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.fallback, compact && styles.compactFallback]}>{fallbackText}</Text>}
        {side === "opponent" ? <Animated.View pointerEvents="none" style={[styles.blink, { opacity: blink, transform: [{ scaleY: blink.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }] }]} /> : null}
      </View>
      <View style={[styles.identity, compact && styles.compactIdentity, side === "opponent" && styles.opponentIdentity]}>
        <Text numberOfLines={1} style={[styles.name, compact && styles.compactName]}>{name.toUpperCase()}</Text>
        {subtitle ? <Text numberOfLines={1} style={[styles.subtitle, compact && styles.compactSubtitle]}>{subtitle.toUpperCase()}</Text> : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center" }, opponentRoot: { alignItems: "center" }, compactRoot: { flexDirection: "row", flexShrink: 1, minWidth: 0 },
  frame: { alignItems: "center", backgroundColor: "#0B0809", borderColor: "#F0A13A", borderRadius: 34, borderWidth: 2, height: 68, justifyContent: "center", overflow: "hidden", width: 68 },
  opponentFrame: { borderColor: "#C96834" }, compactFrame: { borderRadius: 21, height: 42, width: 42 },
  reactionGlow: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,137,45,0.42)", borderColor: "#FFD06A", borderRadius: 34, borderWidth: 2 },
  blink: { backgroundColor: "rgba(19,8,8,0.74)", borderRadius: 4, height: 3, left: "22%", position: "absolute", right: "22%", top: "46%" },
  image: { height: 62, width: 62 }, compactImage: { height: 39, width: 39 }, fallback: { color: "#FFD087", fontSize: 28, fontWeight: "900", textAlign: "center" }, compactFallback: { fontSize: 21 },
  identity: { alignItems: "center", marginTop: 4, maxWidth: 112 }, compactIdentity: { flexShrink: 1, marginTop: 0, minWidth: 0 }, opponentIdentity: { alignItems: "center" },
  compactName: { fontSize: 8, maxWidth: 58 }, compactSubtitle: { fontSize: 5, maxWidth: 58 }, name: { color: "#FFE5B8", fontSize: 11, fontWeight: "900", letterSpacing: 0.5, maxWidth: 112 },
  subtitle: { color: "#B98B59", fontSize: 7, fontWeight: "900", letterSpacing: 0.7, marginTop: 1, maxWidth: 112 },
});
