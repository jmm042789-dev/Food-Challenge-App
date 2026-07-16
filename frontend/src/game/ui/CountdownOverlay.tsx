import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";

import { getFoodArtwork } from "../../assets/foodArtwork";
import CharacterPortrait from "./CharacterPortrait";
import TournamentBanner from "./TournamentBanner";

type Props = {
  visible: boolean;
  value: number | "GO";
  contestId?: string;
  contestName?: string;
  location?: string;
  food?: string;
  difficulty?: string;
  roundLabel?: string;
  opponentName?: string;
  opponentAvatar?: string;
  opponentPersonality?: string;
  restaurantName?: string;
  restaurantLogoUrl?: string;
  city?: string;
  state?: string;
  verified?: boolean;
  sponsored?: boolean;
  sponsorName?: string;
  sponsorLogoUrl?: string;
  sponsorMessage?: string;
};

const BLAZE = require("../../assets/characters/blaze.png");

function fadeBeat(opacity: Animated.Value, delay: number, hold: number) {
  return Animated.sequence([
    Animated.delay(delay),
    Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
    Animated.delay(hold),
    Animated.timing(opacity, { toValue: 0, duration: 100, useNativeDriver: true }),
  ]);
}

export default function CountdownOverlay({
  visible,
  value,
  contestId = "",
  contestName = "Featured Challenge",
  location = "Fire Feast Arena",
  food = "Featured Feast",
  difficulty = "Elite",
  roundLabel = "WORLD TOUR EVENT",
  opponentName = "Blaze",
  opponentAvatar,
  opponentPersonality,
  restaurantName,
  restaurantLogoUrl,
  city,
  state,
  verified,
  sponsored,
  sponsorName,
  sponsorLogoUrl,
  sponsorMessage,
}: Props) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.72)).current;
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const bannerX = useRef(new Animated.Value(-26)).current;
  const foodOpacity = useRef(new Animated.Value(0)).current;
  const foodScale = useRef(new Animated.Value(0.5)).current;
  const foodRotate = useRef(new Animated.Value(-1)).current;
  const vsOpacity = useRef(new Animated.Value(0)).current;
  const playerX = useRef(new Animated.Value(-70)).current;
  const opponentX = useRef(new Animated.Value(70)).current;
  const countScale = useRef(new Animated.Value(0.55)).current;
  const countOpacity = useRef(new Animated.Value(0)).current;
  const fireOpacity = useRef(new Animated.Value(0)).current;
  const sweepX = useRef(new Animated.Value(-180)).current;
  const artwork = useMemo(() => getFoodArtwork(contestId), [contestId]);
  const rotation = foodRotate.interpolate({ inputRange: [-1, 1], outputRange: ["-7deg", "4deg"] });

  useEffect(() => {
    if (!visible) return;
    const values = [logoOpacity, bannerOpacity, foodOpacity, vsOpacity, countOpacity, fireOpacity];
    values.forEach((item) => { item.stopAnimation(); item.setValue(0); });
    logoScale.setValue(0.72);
    bannerX.setValue(-26);
    foodScale.setValue(0.5);
    foodRotate.setValue(-1);
    playerX.setValue(-70);
    opponentX.setValue(70);
    countScale.setValue(value === "GO" ? 0.45 : 0.58);
    sweepX.setValue(-180);

    let animation: Animated.CompositeAnimation;
    if (value === 3) {
      animation = Animated.parallel([
        fadeBeat(logoOpacity, 0, 150),
        Animated.spring(logoScale, { toValue: 1, friction: 7, tension: 190, useNativeDriver: true }),
        fadeBeat(bannerOpacity, 340, 250),
        Animated.sequence([
          Animated.delay(340),
          Animated.spring(bannerX, { toValue: 0, friction: 8, tension: 190, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(720),
          Animated.parallel([
            Animated.timing(foodOpacity, { toValue: 1, duration: 100, useNativeDriver: true }),
            Animated.spring(foodScale, { toValue: 1, friction: 5, tension: 180, useNativeDriver: true }),
            Animated.spring(foodRotate, { toValue: 0, friction: 6, tension: 150, useNativeDriver: true }),
          ]),
        ]),
        Animated.sequence([
          Animated.delay(850),
          Animated.parallel([
            Animated.timing(countOpacity, { toValue: 1, duration: 70, useNativeDriver: true }),
            Animated.spring(countScale, { toValue: 0.76, friction: 7, tension: 220, useNativeDriver: true }),
          ]),
        ]),
        Animated.timing(sweepX, { toValue: 180, duration: 900, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ]);
    } else if (value === 2) {
      animation = Animated.parallel([
        Animated.sequence([
          Animated.timing(vsOpacity, { toValue: 1, duration: 110, useNativeDriver: true }),
          Animated.delay(470),
          Animated.timing(vsOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
        ]),
        Animated.spring(playerX, { toValue: 0, friction: 7, tension: 180, useNativeDriver: true }),
        Animated.spring(opponentX, { toValue: 0, friction: 7, tension: 180, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(650),
          Animated.parallel([
            Animated.timing(countOpacity, { toValue: 1, duration: 90, useNativeDriver: true }),
            Animated.spring(countScale, { toValue: 1, friction: 6, tension: 210, useNativeDriver: true }),
          ]),
        ]),
      ]);
    } else {
      fireOpacity.setValue(value === "GO" ? 0.72 : 0.22);
      animation = Animated.parallel([
        Animated.sequence([
          Animated.parallel([
            Animated.spring(countScale, { toValue: value === "GO" ? 1.16 : 1, friction: 6, tension: 210, useNativeDriver: true }),
            Animated.timing(countOpacity, { toValue: 1, duration: 110, useNativeDriver: true }),
          ]),
          Animated.delay(value === "GO" ? 170 : 420),
          Animated.parallel([
            Animated.timing(countScale, { toValue: value === "GO" ? 1.42 : 1.2, duration: 150, useNativeDriver: true }),
            Animated.timing(countOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
          ]),
        ]),
        Animated.timing(fireOpacity, { toValue: 0, duration: value === "GO" ? 360 : 620, useNativeDriver: true }),
      ]);
    }

    animation.start();
    return () => animation.stop();
  }, [bannerOpacity, bannerX, countOpacity, countScale, fireOpacity, foodOpacity, foodRotate, foodScale, logoOpacity, logoScale, opponentX, playerX, sweepX, value, visible, vsOpacity]);

  if (!visible) return null;
  const go = value === "GO";

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <View style={styles.topSpotlight} />
      <Animated.View style={[styles.lightSweep, { transform: [{ translateX: sweepX }, { rotate: "18deg" }] }]} />
      <Animated.View style={[styles.fireWash, { opacity: fireOpacity }]} />

      {value === 3 ? (
        <>
          <Animated.View style={[styles.logoStage, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
            <Text style={styles.logo}>FIRE FEAST</Text>
            <Text style={styles.arenaTitle}>THE INFERNO ARENA</Text>
          </Animated.View>
          <Animated.View style={[styles.banner, { opacity: bannerOpacity, transform: [{ translateX: bannerX }] }]}>
            <TournamentBanner eventTitle="FIRE FEAST WORLD TOUR" roundLabel={roundLabel} variant="compact" restaurantName={restaurantName} restaurantLogoUrl={restaurantLogoUrl} city={city} state={state} verified={verified} sponsored={sponsored} sponsorName={sponsorName} sponsorLogoUrl={sponsorLogoUrl} sponsorMessage={sponsorMessage} showPartnerDetails />
            <View style={styles.bannerEdge} />
            <Text style={styles.bannerKicker}>TONIGHT&apos;S CHALLENGE</Text>
            <Text numberOfLines={1} style={styles.contestName}>{contestName.toUpperCase()}</Text>
            <Text numberOfLines={1} style={styles.location}>⌖ {location.toUpperCase()}</Text>
            <View style={styles.metaRow}>
              <Text numberOfLines={1} style={styles.foodName}>{food.toUpperCase()}</Text>
              <View style={styles.difficultyBadge}><Text style={styles.difficulty}>{difficulty.toUpperCase()}</Text></View>
            </View>
          </Animated.View>
          <Animated.View style={[styles.foodStage, { opacity: foodOpacity, transform: [{ scale: foodScale }, { rotate: rotation }] }]}>
            <View style={styles.foodGlow} />
            <Image source={artwork.source} resizeMode="contain" style={styles.foodImage} />
            <View style={styles.pedestalLight} />
          </Animated.View>
        </>
      ) : null}

      {value === 2 ? (
        <Animated.View style={[styles.vsStage, { opacity: vsOpacity }]}>
          <Animated.View style={[styles.fighter, { transform: [{ translateX: playerX }] }]}>
            <CharacterPortrait image={BLAZE} name="Blaze" subtitle="You" side="player" size="standard" />
          </Animated.View>
          <Text style={styles.vs}>VS</Text>
          <Animated.View style={[styles.fighter, { transform: [{ translateX: opponentX }] }]}>
            <CharacterPortrait fallback={opponentAvatar} name={opponentName} subtitle={opponentPersonality} side="opponent" size="standard" />
          </Animated.View>
        </Animated.View>
      ) : null}

      <Animated.View style={[styles.countStage, { opacity: countOpacity, transform: [{ scale: countScale }] }]}>
        <Text style={[styles.countText, go && styles.goText]}>{value}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", backgroundColor: "rgba(3,2,4,0.84)", justifyContent: "center", overflow: "hidden", zIndex: 9999, elevation: 9999 },
  topSpotlight: { backgroundColor: "rgba(255,172,67,0.11)", borderBottomLeftRadius: 170, borderBottomRightRadius: 170, height: "48%", position: "absolute", top: -95, width: 260 },
  lightSweep: { backgroundColor: "rgba(255,128,35,0.1)", height: "150%", position: "absolute", width: 88 },
  fireWash: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,71,10,0.3)" },
  logoStage: { alignItems: "center", position: "absolute" },
  logo: { color: "#FFD66F", fontSize: 46, fontStyle: "italic", fontWeight: "900", letterSpacing: 2, textShadowColor: "#F0440C", textShadowOffset: { width: 0, height: 5 }, textShadowRadius: 18 },
  arenaTitle: { color: "#D99B56", fontSize: 10, fontWeight: "900", letterSpacing: 4, marginTop: 5 },
  banner: { backgroundColor: "rgba(14,10,11,0.98)", borderColor: "#D88B35", borderRadius: 8, borderWidth: 2, maxWidth: 390, paddingHorizontal: 22, paddingVertical: 15, position: "absolute", width: "88%" },
  bannerEdge: { backgroundColor: "rgba(255,215,144,0.22)", height: 2, left: 10, position: "absolute", right: 10, top: 2 },
  bannerKicker: { color: "#A98561", fontSize: 8, fontWeight: "900", letterSpacing: 2, textAlign: "center" },
  contestName: { color: "#FFF0CF", fontSize: 25, fontWeight: "900", letterSpacing: 1, marginTop: 3, textAlign: "center" },
  location: { color: "#C7945C", fontSize: 9, fontWeight: "800", letterSpacing: 1, marginTop: 2, textAlign: "center" },
  metaRow: { alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 7 },
  foodName: { color: "#E7B671", flexShrink: 1, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  difficultyBadge: { backgroundColor: "rgba(176,57,22,0.25)", borderColor: "#F07430", borderRadius: 5, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
  difficulty: { color: "#FFD092", fontSize: 7, fontWeight: "900", letterSpacing: 0.8 },
  foodStage: { alignItems: "center", height: 210, justifyContent: "center", position: "absolute", top: "47%", width: 250 },
  foodGlow: { backgroundColor: "rgba(238,85,18,0.25)", borderRadius: 100, height: 180, position: "absolute", width: 180 },
  foodImage: { height: 170, width: 190, zIndex: 2 },
  pedestalLight: { backgroundColor: "rgba(255,145,42,0.22)", borderColor: "rgba(255,185,85,0.55)", borderRadius: 100, borderTopWidth: 2, bottom: 7, height: 28, position: "absolute", transform: [{ scaleX: 1.8 }], width: 110 },
  vsStage: { alignItems: "center", flexDirection: "row", gap: 22, justifyContent: "center", position: "absolute", width: "100%" },
  fighter: { alignItems: "center", width: 105 },
  vs: { color: "#FF8B32", fontSize: 38, fontStyle: "italic", fontWeight: "900", textShadowColor: "#FF3D0A", textShadowRadius: 15 },
  countStage: { alignItems: "center", justifyContent: "center", position: "absolute" },
  countText: { color: "#FFD54A", fontSize: 130, fontWeight: "900", textShadowColor: "#FF5A00", textShadowOffset: { width: 0, height: 6 }, textShadowRadius: 28 },
  goText: { color: "#FF4D00", fontSize: 110, textShadowColor: "#FFD54A", textShadowRadius: 35 },
});
