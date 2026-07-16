import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, type StyleProp, type ViewStyle } from "react-native";

export type SceneMotionPhase = "intro" | "active" | "result";

type Props = {
  children: React.ReactNode;
  phase: SceneMotionPhase;
  comboImpact?: number;
  disabled?: boolean;
  reducedMotion?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function SceneMotion({ children, phase, comboImpact = 0, disabled = false, reducedMotion = false, style }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const motionDisabled = useRef(disabled || reducedMotion);
  const seenComboImpacts = useRef(new Set<number>());
  const phaseAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const impactAnimation = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((systemReducedMotion) => {
      if (!mounted) return;
      motionDisabled.current = disabled || reducedMotion || systemReducedMotion;
      phaseAnimation.current?.stop();
      scale.stopAnimation();
      translateY.stopAnimation();
      opacity.stopAnimation();

      if (motionDisabled.current) {
        scale.setValue(1);
        translateY.setValue(0);
        opacity.setValue(1);
        return;
      }

      if (phase === "intro") {
        seenComboImpacts.current.clear();
        scale.setValue(0.968);
        translateY.setValue(5);
        opacity.setValue(0.92);
        phaseAnimation.current = Animated.sequence([
          Animated.parallel([
            Animated.timing(scale, { toValue: 1.014, duration: 2200, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
            Animated.timing(translateY, { toValue: -2, duration: 2200, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(scale, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          ]),
        ]);
      } else if (phase === "active") {
        scale.setValue(1.008);
        translateY.setValue(-1);
        opacity.setValue(1);
        phaseAnimation.current = Animated.parallel([
          Animated.spring(scale, { toValue: 1, friction: 9, tension: 150, useNativeDriver: true }),
          Animated.spring(translateY, { toValue: 0, friction: 9, tension: 150, useNativeDriver: true }),
        ]);
      } else {
        scale.setValue(1);
        translateY.setValue(0);
        opacity.setValue(1);
        phaseAnimation.current = Animated.parallel([
          Animated.timing(scale, { toValue: 0.975, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 3, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.88, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]);
      }

      phaseAnimation.current.start();
    });

    return () => {
      mounted = false;
      phaseAnimation.current?.stop();
    };
  }, [disabled, opacity, phase, reducedMotion, scale, translateY]);

  useEffect(() => {
    if (!comboImpact || phase !== "active" || motionDisabled.current || seenComboImpacts.current.has(comboImpact)) return;
    seenComboImpacts.current.add(comboImpact);
    impactAnimation.current?.stop();
    scale.stopAnimation();
    translateY.stopAnimation();
    scale.setValue(1);
    translateY.setValue(0);

    impactAnimation.current = Animated.sequence([
      Animated.parallel([
        Animated.timing(scale, { toValue: comboImpact >= 30 ? 1.014 : 1.01, duration: 55, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: comboImpact >= 30 ? -1.5 : -1, duration: 55, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 7, tension: 240, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, friction: 7, tension: 240, useNativeDriver: true }),
      ]),
    ]);
    impactAnimation.current.start();
    return () => impactAnimation.current?.stop();
  }, [comboImpact, phase, scale, translateY]);

  useEffect(() => () => {
    phaseAnimation.current?.stop();
    impactAnimation.current?.stop();
    scale.stopAnimation();
    translateY.stopAnimation();
    opacity.stopAnimation();
  }, [opacity, scale, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }, { scale }] }]}>
      {children}
    </Animated.View>
  );
}
