import React, { useEffect, useRef } from "react";
import { Animated, Image, type ImageSourcePropType, StyleSheet, Text, View } from "react-native";

export type CharacterReaction = "idle" | "combo" | "leading" | "behind" | "victory" | "defeat";

type Props = {
  image?: ImageSourcePropType;
  fallback?: string;
  name: string;
  subtitle?: string;
  side?: "player" | "opponent";
  size?: "compact" | "standard";
  reaction?: CharacterReaction;
  reactionKey?: string | number;
};

export default function CharacterPortrait({
  image,
  fallback,
  name,
  subtitle,
  side = "player",
  size = "standard",
  reaction = "idle",
  reactionKey = reaction,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const rotation = tilt.interpolate({ inputRange: [-1, 1], outputRange: ["-5deg", "5deg"] });
  const compact = size === "compact";

  useEffect(() => {
    if (reaction === "idle") return;
    scale.stopAnimation();
    tilt.stopAnimation();
    lift.stopAnimation();
    glow.stopAnimation();
    const strong = reaction === "combo" || reaction === "victory";
    const subdued = reaction === "behind" || reaction === "defeat";
    scale.setValue(strong ? 1.1 : subdued ? 0.96 : 1.04);
    tilt.setValue(side === "player" ? -1 : 1);
    lift.setValue(strong ? -3 : subdued ? 2 : -1);
    glow.setValue(strong ? 0.8 : 0.38);

    const animation = Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: strong ? 5 : 8, tension: 210, useNativeDriver: true }),
      Animated.spring(tilt, { toValue: 0, friction: 7, tension: 180, useNativeDriver: true }),
      Animated.spring(lift, { toValue: 0, friction: 7, tension: 190, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: strong ? 420 : 300, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [glow, lift, reaction, reactionKey, scale, side, tilt]);

  const fallbackText = fallback?.trim() || name.trim().slice(0, 2).toUpperCase();

  return (
    <Animated.View style={[styles.root, side === "opponent" && styles.opponentRoot, compact && styles.compactRoot, { transform: [{ translateY: lift }, { scale }, { rotate: rotation }] }]}>
      <View style={[styles.frame, compact && styles.compactFrame, side === "opponent" && styles.opponentFrame]}>
        <Animated.View pointerEvents="none" style={[styles.reactionGlow, { opacity: glow }]} />
        {image ? (
          <Image source={image} resizeMode="contain" style={[styles.image, compact && styles.compactImage]} />
        ) : (
          <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.fallback, compact && styles.compactFallback]}>{fallbackText}</Text>
        )}
      </View>
      <View style={[styles.identity, compact && styles.compactIdentity, side === "opponent" && styles.opponentIdentity]}>
        <Text numberOfLines={1} style={[styles.name, compact && styles.compactName]}>{name.toUpperCase()}</Text>
        {subtitle ? <Text numberOfLines={1} style={[styles.subtitle, compact && styles.compactSubtitle]}>{subtitle.toUpperCase()}</Text> : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center" },
  opponentRoot: { alignItems: "center" },
  compactRoot: { flexDirection: "row", flexShrink: 1, minWidth: 0 },
  frame: { alignItems: "center", backgroundColor: "#0B0809", borderColor: "#F0A13A", borderRadius: 34, borderWidth: 2, height: 68, justifyContent: "center", overflow: "hidden", width: 68 },
  opponentFrame: { borderColor: "#C96834" },
  compactFrame: { borderRadius: 21, height: 42, width: 42 },
  reactionGlow: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,137,45,0.42)", borderColor: "#FFD06A", borderRadius: 34, borderWidth: 2 },
  image: { height: 62, width: 62 },
  compactImage: { height: 39, width: 39 },
  fallback: { color: "#FFD087", fontSize: 28, fontWeight: "900", textAlign: "center" },
  compactFallback: { fontSize: 21 },
  identity: { alignItems: "center", marginTop: 4, maxWidth: 112 },
  compactIdentity: { flexShrink: 1, marginTop: 0, minWidth: 0 },
  opponentIdentity: { alignItems: "center" },
  compactName: { fontSize: 8, maxWidth: 58 },
  compactSubtitle: { fontSize: 5, maxWidth: 58 },
  name: { color: "#FFE5B8", fontSize: 11, fontWeight: "900", letterSpacing: 0.5, maxWidth: 112 },
  subtitle: { color: "#B98B59", fontSize: 7, fontWeight: "900", letterSpacing: 0.7, marginTop: 1, maxWidth: 112 },
});
