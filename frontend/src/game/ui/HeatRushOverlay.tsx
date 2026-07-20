import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

export type HeatRushHandle = {
  start: (initialTapCount?: number) => boolean;
  registerTap: () => void;
  reset: () => void;
};

type Props = {
  active: boolean;
  durationMs?: number;
  reducedMotion: boolean;
  resetKey: string;
  tapTarget?: number;
  onTriggered?: () => void;
};

const EMBERS = [
  { left: "12%", distance: -54, delay: 0 },
  { left: "27%", distance: -72, delay: 0.16 },
  { left: "43%", distance: -60, delay: 0.3 },
  { left: "59%", distance: -78, delay: 0.08 },
  { left: "74%", distance: -66, delay: 0.24 },
  { left: "88%", distance: -56, delay: 0.38 },
] as const;

const clampDuration = (duration?: number): number =>
  Math.round(Math.min(2800, Math.max(1400, duration ?? 2000)));

const resolveRewardTarget = (target?: number): number =>
  Math.round(Math.min(8, Math.max(3, target ?? 5)));

const HeatRushOverlay = forwardRef<HeatRushHandle, Props>(function HeatRushOverlay(
  { active, durationMs, reducedMotion, resetKey, tapTarget, onTriggered },
  ref,
) {
  const duration = clampDuration(durationMs);
  const rewardTarget = resolveRewardTarget(tapTarget);
  const [visible, setVisible] = useState(false);
  const [rewardVisible, setRewardVisible] = useState(false);
  const activeRef = useRef(false);
  const rewardShown = useRef(false);
  const tapCount = useRef(0);
  const mounted = useRef(true);
  const rushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rewardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeProgress = useRef(new Animated.Value(1)).current;
  const atmosphere = useRef(new Animated.Value(0)).current;
  const emberDrift = useRef(new Animated.Value(0)).current;
  const rewardBurst = useRef(new Animated.Value(0)).current;

  const clearTimers = () => {
    if (rushTimer.current) clearTimeout(rushTimer.current);
    if (rewardTimer.current) clearTimeout(rewardTimer.current);
    rushTimer.current = null;
    rewardTimer.current = null;
  };

  const resetRush = () => {
    clearTimers();
    timeProgress.stopAnimation();
    atmosphere.stopAnimation();
    emberDrift.stopAnimation();
    rewardBurst.stopAnimation();
    timeProgress.setValue(1);
    atmosphere.setValue(0);
    emberDrift.setValue(0);
    rewardBurst.setValue(0);
    activeRef.current = false;
    rewardShown.current = false;
    tapCount.current = 0;
    if (mounted.current) {
      setVisible(false);
      setRewardVisible(false);
    }
  };

  const showReward = () => {
    if (rewardShown.current) return;
    rewardShown.current = true;
    setRewardVisible(true);
    rewardBurst.setValue(reducedMotion ? 1 : 0);
    if (!reducedMotion) {
      Animated.timing(rewardBurst, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
    rewardTimer.current = setTimeout(() => {
      if (mounted.current) setRewardVisible(false);
    }, 600);
  };

  const registerTap = () => {
    if (!activeRef.current) return;
    tapCount.current += 1;
    if (tapCount.current >= rewardTarget) showReward();
  };

  useImperativeHandle(ref, () => ({
    start: (initialTapCount = 0) => {
      if (!active || activeRef.current) return false;
      clearTimers();
      activeRef.current = true;
      rewardShown.current = false;
      tapCount.current = Math.max(0, Math.round(initialTapCount));
      setVisible(true);
      setRewardVisible(false);
      timeProgress.setValue(1);
      Animated.timing(timeProgress, {
        toValue: 0,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start();
      rushTimer.current = setTimeout(() => {
        if (mounted.current && activeRef.current) resetRush();
      }, duration);
      if (tapCount.current >= rewardTarget) showReward();
      onTriggered?.();
      return true;
    },
    registerTap,
    reset: resetRush,
  }));

  useEffect(() => {
    if (!visible || reducedMotion) {
      atmosphere.stopAnimation();
      emberDrift.stopAnimation();
      atmosphere.setValue(0);
      emberDrift.setValue(0);
      return;
    }

    const atmosphereLoop = Animated.loop(Animated.sequence([
      Animated.timing(atmosphere, { toValue: 1, duration: 320, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(atmosphere, { toValue: 0, duration: 320, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const emberLoop = Animated.loop(Animated.timing(emberDrift, {
      toValue: 1,
      duration: 900,
      easing: Easing.linear,
      useNativeDriver: true,
    }));
    atmosphereLoop.start();
    emberLoop.start();
    return () => {
      atmosphereLoop.stop();
      emberLoop.stop();
    };
  }, [atmosphere, emberDrift, reducedMotion, visible]);

  useEffect(() => {
    resetRush();
  }, [active, resetKey]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimers();
      timeProgress.stopAnimation();
      atmosphere.stopAnimation();
      emberDrift.stopAnimation();
      rewardBurst.stopAnimation();
    };
  }, [atmosphere, emberDrift, rewardBurst, timeProgress]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Animated.View
        style={[
          styles.vignette,
          {
            opacity: reducedMotion
              ? 0.42
              : atmosphere.interpolate({ inputRange: [0, 1], outputRange: [0.34, 0.52] }),
          },
        ]}
      />
      {!reducedMotion ? (
        <>
          <Animated.View
            style={[
              styles.shimmer,
              {
                opacity: atmosphere.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.18] }),
                transform: [{ translateY: atmosphere.interpolate({ inputRange: [0, 1], outputRange: [4, -4] }) }],
              },
            ]}
          />
          {EMBERS.map((ember, index) => (
            <Animated.View
              key={index}
              style={[
                styles.ember,
                {
                  left: ember.left,
                  opacity: emberDrift.interpolate({ inputRange: [0, 0.04 + ember.delay, 0.72, 1], outputRange: [0, 0.9, 0.55, 0] }),
                  transform: [{ translateY: emberDrift.interpolate({ inputRange: [0, 1], outputRange: [26, ember.distance] }) }],
                },
              ]}
            />
          ))}
        </>
      ) : null}
      <View style={styles.banner}>
        <Text style={styles.title}>🔥 HEAT RUSH!</Text>
        <View style={styles.timerTrack}>
          <Animated.View style={[styles.timerFill, { transform: [{ scaleX: timeProgress }] }]} />
        </View>
      </View>
      {rewardVisible ? (
        <Animated.View
          style={[
            styles.reward,
            {
              opacity: reducedMotion ? 1 : rewardBurst,
              transform: reducedMotion
                ? []
                : [{ scale: rewardBurst.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.08] }) }],
            },
          ]}
        >
          <Text style={styles.rewardText}>ON FIRE!</Text>
        </Animated.View>
      ) : null}
    </View>
  );
});

export default HeatRushOverlay;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    zIndex: 17,
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(206,45,7,0.12)",
    borderColor: "rgba(255,82,22,0.75)",
    borderWidth: 18,
  },
  shimmer: {
    alignSelf: "center",
    backgroundColor: "#FF7025",
    borderRadius: 999,
    bottom: "18%",
    height: "52%",
    position: "absolute",
    width: "72%",
  },
  ember: {
    backgroundColor: "#FFD05A",
    borderRadius: 999,
    bottom: "24%",
    height: 5,
    position: "absolute",
    width: 5,
  },
  banner: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(50,12,4,0.88)",
    borderColor: "rgba(255,123,43,0.85)",
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 8,
    position: "absolute",
    top: "8%",
  },
  title: {
    color: "#FFF0C4",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  timerTrack: {
    backgroundColor: "rgba(15,4,2,0.82)",
    borderRadius: 999,
    height: 6,
    marginTop: 5,
    overflow: "hidden",
    width: 145,
  },
  timerFill: {
    backgroundColor: "#FF6A24",
    borderRadius: 999,
    height: "100%",
    width: "100%",
  },
  reward: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(92,25,4,0.92)",
    borderColor: "#FFD15B",
    borderRadius: 999,
    borderWidth: 2,
    paddingHorizontal: 22,
    paddingVertical: 10,
    position: "absolute",
    top: "31%",
  },
  rewardText: {
    color: "#FFF2B8",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
});
