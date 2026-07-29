import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from "react-native";

import type { GameplayPresentationEvent } from "../useGameLoop";
import { ANTACID_HEAT_REDUCTION } from "../heartburn";

type Props = {
  events: readonly GameplayPresentationEvent[];
  overheatWarningActive: boolean;
  overheatRemainingMs: number;
};

type Presentation = {
  title: string;
  subtitle?: string;
  positive?: boolean;
  subtle?: boolean;
  effect?: "cooling" | "fire" | "sparkle";
};

const FIRE_BURST = require("../../assets/ui/effects/fire-burst.png");
const SMOKE_PUFF = require("../../assets/ui/effects/smoke-puff.png");
const SPARKLE = require("../../assets/ui/effects/sparkle.png");
const priorities: Partial<Record<GameplayPresentationEvent["type"], number>> = {
  ANTACID_SAVE: 100,
  OVERHEATED: 90,
  ANTACID_USED: 70,
  PERFECT_COOLDOWN: 60,
  OVERHEAT_PENALTY_STARTED: 50,
  CRITICAL_WARNING: 30,
  OVERHEAT_PENALTY_ENDED: 20,
};

function resolvePresentation(event: GameplayPresentationEvent): Presentation | undefined {
  switch (event.type) {
    case "CRITICAL_WARNING":
      return { title: "CRITICAL", subtitle: "1.5x RISK BONUS" };
    case "ANTACID_USED":
      return { title: "ANTACID!", subtitle: `-${ANTACID_HEAT_REDUCTION} HEAT`, positive: true, effect: "cooling" };
    case "ANTACID_SAVE":
      return { title: "CLUTCH SAVE!", subtitle: "COMBO SAVED", positive: true, effect: "cooling" };
    case "OVERHEATED": {
      const subtitle = event.comboBefore !== undefined && event.comboAfter === 0 && event.comboBefore > 0
        ? "COMBO LOST"
        : event.comboBefore !== undefined && event.comboAfter !== undefined && event.comboAfter < event.comboBefore
          ? "COMBO HALVED"
          : "HEAT RESET";
      return { title: "OVERHEATED!", subtitle, effect: "fire" };
    }
    case "PERFECT_COOLDOWN":
      return { title: "PERFECT COOLDOWN", subtitle: "+5", positive: true, effect: "sparkle" };
    case "OVERHEAT_PENALTY_STARTED":
      return { title: "0.5x SCORE", subtitle: "HEAT PENALTY" };
    case "OVERHEAT_PENALTY_ENDED":
      return { title: "HEAT RECOVERED", positive: true, subtle: true };
    default:
      return undefined;
  }
}

function HeatPresentationOverlay({ events, overheatWarningActive, overheatRemainingMs }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  const effectProgress = useRef(new Animated.Value(0)).current;
  const warningPulse = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const lastEventId = useRef(0);
  const [visibleEvent, setVisibleEvent] = useState<GameplayPresentationEvent | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const presentation = useMemo(() => visibleEvent ? resolvePresentation(visibleEvent) : undefined, [visibleEvent]);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (mounted) setReducedMotion(enabled); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    warningPulse.stopAnimation();
    warningPulse.setValue(0);
    if (!overheatWarningActive || reducedMotion) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(warningPulse, { toValue: 1, duration: 280, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(warningPulse, { toValue: 0, duration: 280, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [overheatWarningActive, reducedMotion, warningPulse]);

  useEffect(() => {
    const newEvents = events.filter((event) => event.id > lastEventId.current);
    if (!newEvents.length) return;
    lastEventId.current = newEvents[newEvents.length - 1].id;
    const displayEvent = [...newEvents]
      .filter((event) => priorities[event.type] !== undefined)
      .sort((a, b) => (priorities[b.type] ?? 0) - (priorities[a.type] ?? 0) || b.id - a.id)[0];
    if (!displayEvent || !resolvePresentation(displayEvent)) return;

    if (timer.current) clearTimeout(timer.current);
    activeAnimation.current?.stop();
    opacity.stopAnimation();
    scale.stopAnimation();
    effectProgress.stopAnimation();
    setVisibleEvent(displayEvent);
    opacity.setValue(0);
    scale.setValue(reducedMotion ? 1 : 0.94);
    effectProgress.setValue(0);
    activeAnimation.current = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: reducedMotion ? 0 : 120, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 210, useNativeDriver: true }),
      Animated.timing(effectProgress, { toValue: 1, duration: reducedMotion ? 0 : 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    activeAnimation.current.start();
    const presentationDuration = displayEvent.type === "OVERHEATED" || displayEvent.type === "ANTACID_SAVE" ? 980 : displayEvent.type === "OVERHEAT_PENALTY_ENDED" ? 450 : 720;
    timer.current = setTimeout(() => {
      const exitAnimation = Animated.timing(opacity, { toValue: 0, duration: reducedMotion ? 0 : 180, useNativeDriver: true });
      activeAnimation.current = exitAnimation;
      exitAnimation.start(() => setVisibleEvent(null));
      timer.current = null;
    }, presentationDuration);
  }, [effectProgress, events, opacity, reducedMotion, scale]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    activeAnimation.current?.stop();
    opacity.stopAnimation();
    scale.stopAnimation();
    effectProgress.stopAnimation();
    warningPulse.stopAnimation();
  }, [effectProgress, opacity, scale, warningPulse]);

  if (overheatWarningActive) {
    const progress = Math.max(0, Math.min(1, overheatRemainingMs / 2000));
    return (
      <Animated.View pointerEvents="none" style={[styles.warning, {
        transform: [{ scale: warningPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }) }],
      }]}>
        <Text accessibilityRole="alert" maxFontSizeMultiplier={1.25} style={styles.warningTitle}>OVERHEATING!</Text>
        <Text maxFontSizeMultiplier={1.3} style={styles.warningSubtitle}>USE ANTACID!</Text>
        <View style={styles.warningTrack}><View style={[styles.warningFill, { width: `${progress * 100}%` }]} /></View>
        <Text maxFontSizeMultiplier={1.3} style={styles.warningTime}>{(overheatRemainingMs / 1000).toFixed(1)}s TO SAVE COMBO</Text>
      </Animated.View>
    );
  }

  if (!presentation) return null;
  const effectSource = presentation.effect === "fire" ? FIRE_BURST : presentation.effect === "sparkle" ? SPARKLE : presentation.effect === "cooling" ? SMOKE_PUFF : null;
  return (
    <View pointerEvents="none" style={styles.effectLayer}>
      {effectSource ? <Animated.Image source={effectSource} resizeMode="contain" style={[styles.effectImage, presentation.effect === "cooling" && styles.coolingImage, {
        opacity: effectProgress.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0, 0.72, 0] }),
        transform: [
          { scale: effectProgress.interpolate({ inputRange: [0, 1], outputRange: [0.65, presentation.effect === "fire" ? 1.35 : 1.15] }) },
          { translateY: effectProgress.interpolate({ inputRange: [0, 1], outputRange: [presentation.effect === "cooling" ? 36 : 4, presentation.effect === "cooling" ? -46 : -8] }) },
        ],
      }]} /> : null}
      <Animated.View style={[styles.event, presentation.positive ? styles.positive : styles.danger, presentation.subtle && styles.subtle, { opacity, transform: [{ scale }] }]}>
        <Text maxFontSizeMultiplier={1.25} style={[styles.eventTitle, presentation.positive && styles.positiveText, presentation.subtle && styles.subtleText]}>{presentation.title}</Text>
        {presentation.subtitle ? <Text maxFontSizeMultiplier={1.3} style={styles.eventSubtitle}>{presentation.subtitle}</Text> : null}
      </Animated.View>
    </View>
  );
}

export default memo(HeatPresentationOverlay);

const styles = StyleSheet.create({
  effectLayer: { ...StyleSheet.absoluteFillObject, alignItems: "center", pointerEvents: "none", zIndex: 115 },
  effectImage: { height: 170, position: "absolute", top: "20%", width: 230 },
  coolingImage: { tintColor: "#B9F6FF" },
  warning: { alignItems: "center", alignSelf: "center", backgroundColor: "rgba(85,8,7,0.97)", borderColor: "#FF4A32", borderRadius: 14, borderWidth: 2, elevation: 14, maxWidth: "84%", paddingHorizontal: 20, paddingVertical: 12, position: "absolute", shadowColor: "#FF341F", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.38, shadowRadius: 12, top: "27%", width: 246, zIndex: 120 },
  warningTitle: { color: "#FFF0DA", fontSize: 22, fontWeight: "900", letterSpacing: 1.3, textAlign: "center", textShadowColor: "rgba(255,61,31,0.72)", textShadowRadius: 8 },
  warningSubtitle: { color: "#FFD05C", fontSize: 13, fontWeight: "900", letterSpacing: 1.1, marginTop: 2 },
  warningTrack: { backgroundColor: "rgba(28,4,4,0.92)", borderColor: "rgba(255,220,120,0.45)", borderRadius: 4, borderWidth: 1, height: 8, marginTop: 8, overflow: "hidden", width: "100%" },
  warningFill: { backgroundColor: "#FFB52F", height: "100%" },
  warningTime: { color: "#FFE4B3", fontSize: 9, fontWeight: "900", letterSpacing: 0.55, marginTop: 5 },
  event: { alignItems: "center", alignSelf: "center", borderRadius: 12, borderWidth: 2, elevation: 12, maxWidth: "84%", minWidth: 190, paddingHorizontal: 22, paddingVertical: 10, position: "absolute", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.38, shadowRadius: 8, top: "28%" },
  danger: { backgroundColor: "rgba(93,11,8,0.96)", borderColor: "#FF5138" },
  positive: { backgroundColor: "rgba(7,49,56,0.96)", borderColor: "#8DE7F3" },
  subtle: { borderWidth: 1, minWidth: 0, paddingHorizontal: 14, paddingVertical: 6 },
  eventTitle: { color: "#FFF0D7", fontSize: 18, fontWeight: "900", letterSpacing: 1, textAlign: "center" },
  positiveText: { color: "#DFFFFF" },
  subtleText: { fontSize: 12 },
  eventSubtitle: { color: "#FFD27A", fontSize: 10, fontWeight: "900", letterSpacing: 1.15, marginTop: 3 },
});
