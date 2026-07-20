import React, { memo, useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import type { CommentaryItem } from "./CommentaryTypes";

function CommentaryOverlay({ item, reducedMotion }: { item: CommentaryItem | null; reducedMotion: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    opacity.stopAnimation();
    scale.stopAnimation();
    opacity.setValue(item ? 0 : 0);
    scale.setValue(reducedMotion ? 1 : 0.84);
    if (!item) return;
    const animation = Animated.parallel([
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: reducedMotion ? 0 : 130, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.delay(reducedMotion ? 1250 : 1000),
        Animated.timing(opacity, { toValue: 0, duration: reducedMotion ? 0 : 220, useNativeDriver: true }),
      ]),
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 190, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [item, opacity, reducedMotion, scale]);

  useEffect(() => () => { opacity.stopAnimation(); scale.stopAnimation(); }, [opacity, scale]);
  if (!item) return null;
  return (
    <View pointerEvents="none" style={styles.layer}>
      <Animated.View
        accessibilityLabel={`Arcade commentary: ${item.text}`}
        accessibilityLiveRegion="polite"
        style={[styles.badge, { opacity, transform: [{ scale }] }]}
      >
        <Text style={styles.shadow}>{item.text}</Text>
        <Text style={styles.text}>{item.text}</Text>
      </Animated.View>
    </View>
  );
}

export default memo(CommentaryOverlay);

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 1200 },
  badge: { alignItems: "center", backgroundColor: "rgba(17,7,7,0.88)", borderColor: "#FFB52E", borderRadius: 12, borderWidth: 2, maxWidth: "88%", paddingHorizontal: 20, paddingVertical: 9, shadowColor: "#FF4B24", shadowOpacity: 0.75, shadowRadius: 10 },
  shadow: { color: "#7E2118", fontSize: 24, fontStyle: "italic", fontWeight: "900", letterSpacing: 1.4, position: "absolute", top: 11 },
  text: { color: "#FFF3C4", fontSize: 24, fontStyle: "italic", fontWeight: "900", letterSpacing: 1.4, textAlign: "center", textShadowColor: "#FF4B24", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
});
