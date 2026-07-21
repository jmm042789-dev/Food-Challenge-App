import React, { useCallback, useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MatchIntroData } from "../MatchIntro";

type Props = {
  visible: boolean;
  data: MatchIntroData;
  reducedMotion: boolean;
  resetKey: string;
  onComplete: () => void;
};

export default function MatchIntroOverlay({ visible, data, reducedMotion, resetKey, onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const restaurantOpacity = useRef(new Animated.Value(0)).current;
  const versusOpacity = useRef(new Animated.Value(0)).current;
  const challengeOpacity = useRef(new Animated.Value(0)).current;
  const playerX = useRef(new Animated.Value(-40)).current;
  const opponentX = useRef(new Animated.Value(40)).current;
  const versusScale = useRef(new Animated.Value(0.82)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const animations = useRef<Animated.CompositeAnimation[]>([]);
  const completed = useRef(false);

  const clearWork = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    animations.current.forEach((animation) => animation.stop());
    animations.current = [];
    [restaurantOpacity, versusOpacity, challengeOpacity, playerX, opponentX, versusScale].forEach((value) => value.stopAnimation());
  }, [challengeOpacity, opponentX, playerX, restaurantOpacity, versusOpacity, versusScale]);

  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    clearWork();
    onComplete();
  }, [clearWork, onComplete]);

  useEffect(() => {
    clearWork();
    completed.current = false;
    restaurantOpacity.setValue(0);
    versusOpacity.setValue(0);
    challengeOpacity.setValue(0);
    playerX.setValue(reducedMotion ? 0 : -40);
    opponentX.setValue(reducedMotion ? 0 : 40);
    versusScale.setValue(reducedMotion ? 1 : 0.82);
    if (!visible) return;

    const totalDuration = reducedMotion ? 1800 : 2700;
    const versusDelay = reducedMotion ? 350 : 650;
    const challengeDelay = reducedMotion ? 1050 : 1750;
    const revealDuration = reducedMotion ? 120 : 220;
    const reveal = (value: Animated.Value, delay: number) => {
      timers.current.push(setTimeout(() => {
        if (completed.current) return;
        const animation = Animated.timing(value, { toValue: 1, duration: revealDuration, easing: Easing.out(Easing.cubic), useNativeDriver: true });
        animations.current.push(animation);
        animation.start();
      }, delay));
    };
    reveal(restaurantOpacity, 0);
    reveal(versusOpacity, versusDelay);
    reveal(challengeOpacity, challengeDelay);
    if (!reducedMotion) {
      timers.current.push(setTimeout(() => {
        if (completed.current) return;
        const animation = Animated.parallel([
          Animated.spring(playerX, { toValue: 0, friction: 8, tension: 190, useNativeDriver: true }),
          Animated.spring(opponentX, { toValue: 0, friction: 8, tension: 190, useNativeDriver: true }),
          Animated.spring(versusScale, { toValue: 1, friction: 6, tension: 210, useNativeDriver: true }),
        ]);
        animations.current.push(animation);
        animation.start();
      }, versusDelay));
    }
    timers.current.push(setTimeout(finish, totalDuration));
    return clearWork;
  }, [challengeOpacity, clearWork, finish, opponentX, playerX, reducedMotion, resetKey, restaurantOpacity, versusOpacity, versusScale, visible]);

  useEffect(() => clearWork, [clearWork]);

  if (!visible) return null;
  const announcement = `Match introduction. ${data.playerName} versus ${data.opponentName}${data.restaurantName ? ` at ${data.restaurantName}` : ""}.`;

  return (
    <View accessibilityViewIsModal style={styles.overlay}>
      <Text accessible accessibilityLabel={announcement} accessibilityRole="header" style={styles.screenReaderText}>{announcement}</Text>
      <View pointerEvents="none" style={styles.emberA} /><View pointerEvents="none" style={styles.emberB} />
      <Animated.View style={[styles.restaurant, { opacity: restaurantOpacity }]}>
        <Text style={styles.kicker}>TONIGHT&apos;S ARENA</Text>
        {data.restaurantName ? <Text numberOfLines={1} adjustsFontSizeToFit style={styles.restaurantName}>{data.restaurantName.toUpperCase()}</Text> : null}
        {data.restaurantTheme ? <Text numberOfLines={1} style={styles.theme}>{data.restaurantTheme.toUpperCase()}</Text> : null}
      </Animated.View>

      <Animated.View style={[styles.versus, { opacity: versusOpacity, transform: [{ scale: versusScale }] }]}>
        <Animated.View style={[styles.fighter, styles.playerCard, { transform: [{ translateX: playerX }] }]}>
          <Text style={styles.role}>PLAYER</Text><Text numberOfLines={1} style={styles.fighterName}>{data.playerName.toUpperCase()}</Text>
          {data.playerTitle ? <Text numberOfLines={1} style={styles.subtitle}>{data.playerTitle.toUpperCase()}</Text> : null}
          {data.playerRank ? <Text numberOfLines={1} style={styles.detail}>{data.playerRank.toUpperCase()}</Text> : null}
        </Animated.View>
        <View style={styles.vsBadge}><Text style={styles.vsText}>VS</Text></View>
        <Animated.View style={[styles.fighter, styles.opponentCard, { transform: [{ translateX: opponentX }] }]}>
          <Text style={styles.role}>OPPONENT</Text><Text numberOfLines={1} style={styles.fighterName}>{data.opponentName.toUpperCase()}</Text>
          {data.opponentSubtitle ? <Text numberOfLines={1} style={styles.subtitle}>{data.opponentSubtitle.toUpperCase()}</Text> : null}
          {data.opponentSignature ? <Text numberOfLines={1} style={styles.detail}>{data.opponentSignature.toUpperCase()}</Text> : null}
        </Animated.View>
      </Animated.View>

      <Animated.View style={[styles.challenge, { opacity: challengeOpacity }]}>
        <Text style={styles.kicker}>FEATURED CHALLENGE</Text>
        {data.challengeName ? <Text numberOfLines={1} adjustsFontSizeToFit style={styles.challengeName}>{data.challengeName.toUpperCase()}</Text> : null}
        {data.foodName ? <Text numberOfLines={1} style={styles.foodName}>{data.foodName.toUpperCase()}</Text> : null}
      </Animated.View>

      <Pressable accessibilityRole="button" accessibilityLabel="Skip match introduction" onPress={finish} style={[styles.skip, { top: insets.top + 12 }]}><Text style={styles.skipText}>SKIP INTRO</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", backgroundColor: "rgba(5,3,5,0.97)", justifyContent: "center", overflow: "hidden", zIndex: 10000 },
  emberA: { backgroundColor: "rgba(235,77,20,0.22)", borderRadius: 120, height: 240, left: -100, position: "absolute", top: -90, width: 240 }, emberB: { backgroundColor: "rgba(242,137,35,0.16)", borderRadius: 130, bottom: -100, height: 260, position: "absolute", right: -110, width: 260 },
  restaurant: { alignItems: "center", position: "absolute", top: "14%", width: "88%" }, kicker: { color: "#B98551", fontSize: 8, fontWeight: "900", letterSpacing: 1.8 }, restaurantName: { color: "#FFD16C", fontSize: 29, fontWeight: "900", marginTop: 3, textAlign: "center" }, theme: { color: "#BFA17F", fontSize: 9, fontWeight: "800", letterSpacing: 1, marginTop: 2 },
  versus: { alignItems: "center", flexDirection: "row", justifyContent: "center", position: "absolute", width: "96%" }, fighter: { borderRadius: 12, borderWidth: 1, justifyContent: "center", minHeight: 104, padding: 9, width: "38%" }, playerCard: { backgroundColor: "rgba(50,24,14,0.94)", borderColor: "#D98939" }, opponentCard: { backgroundColor: "rgba(42,16,18,0.94)", borderColor: "#CB5E3A" }, role: { color: "#9E8068", fontSize: 6, fontWeight: "900", letterSpacing: 1 }, fighterName: { color: "#FFF0D8", fontSize: 14, fontWeight: "900", marginTop: 3 }, subtitle: { color: "#E2A954", fontSize: 8, fontWeight: "900", marginTop: 3 }, detail: { color: "#A98E7A", fontSize: 7, fontWeight: "800", marginTop: 2 }, vsBadge: { alignItems: "center", backgroundColor: "#A34112", borderColor: "#FFB64C", borderRadius: 25, borderWidth: 2, height: 50, justifyContent: "center", marginHorizontal: -3, width: 50, zIndex: 2 }, vsText: { color: "#FFF0C7", fontSize: 20, fontStyle: "italic", fontWeight: "900" },
  challenge: { alignItems: "center", bottom: "14%", position: "absolute", width: "88%" }, challengeName: { color: "#FFF0D2", fontSize: 20, fontWeight: "900", marginTop: 3, textAlign: "center" }, foodName: { color: "#E89942", fontSize: 10, fontWeight: "900", letterSpacing: 1, marginTop: 3 },
  skip: { alignItems: "center", borderColor: "rgba(215,148,76,0.62)", borderRadius: 8, borderWidth: 1, justifyContent: "center", minHeight: 44, minWidth: 44, paddingHorizontal: 12, position: "absolute", right: 12 }, skipText: { color: "#D9C1A6", fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  screenReaderText: { height: 1, left: -10000, position: "absolute", width: 1 },
});
