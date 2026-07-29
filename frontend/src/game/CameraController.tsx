import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";

export type CameraControllerHandle = {
  bitePunch: (strength?: number) => void;
  comboPunch: (strength?: number) => void;
  shake: (strength?: number) => void;
  countdownSettle: () => void;
  defeatSettle: () => void;
  victoryZoom: () => void;
  reset: () => void;
};

type CameraControllerProps = {
  children: React.ReactNode;
  phase?: "intro" | "active" | "result";
  reducedMotion?: boolean;
};

const CameraController = forwardRef<CameraControllerHandle, CameraControllerProps>(
  function CameraController({ children, phase = "active", reducedMotion = false }, ref) {
    const scale = useRef(new Animated.Value(1)).current;
    const ambientScale = useRef(new Animated.Value(1)).current;
    const translateX = useRef(new Animated.Value(0)).current;
    const scaleAnimation = useRef<Animated.CompositeAnimation | null>(null);
    const shakeAnimation = useRef<Animated.CompositeAnimation | null>(null);
    const ambientAnimation = useRef<Animated.CompositeAnimation | null>(null);

    const stopScaleAnimation = () => {
      scaleAnimation.current?.stop();
      scale.stopAnimation();
    };

    const stopShakeAnimation = () => {
      shakeAnimation.current?.stop();
      translateX.stopAnimation();
    };

    const punch = (amount: number, strength = 1) => {
      stopScaleAnimation();
      if (reducedMotion) {
        scale.setValue(1);
        return;
      }
      scale.setValue(1);

      scaleAnimation.current = Animated.sequence([
        Animated.timing(scale, {
          toValue: 1 + amount * Math.max(0, strength),
          duration: 58,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.997,
          duration: 72,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 8,
          tension: 185,
          useNativeDriver: true,
        }),
      ]);
      scaleAnimation.current.start();
    };

    useImperativeHandle(ref, () => ({
      bitePunch: (strength = 1) => punch(0.022, strength),
      comboPunch: (strength = 1) => punch(0.045, strength),
      countdownSettle: () => punch(0.014, 1),
      shake: (strength = 8) => {
        stopShakeAnimation();
        translateX.setValue(0);
        if (reducedMotion) return;
        const distance = Math.min(4, Math.max(0, strength) * 0.65);

        shakeAnimation.current = Animated.sequence([
          Animated.timing(translateX, { toValue: -distance, duration: 42, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(translateX, { toValue: distance * 0.72, duration: 50, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(translateX, { toValue: -distance * 0.36, duration: 46, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(translateX, { toValue: 0, duration: 60, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]);
        shakeAnimation.current.start();
      },
      victoryZoom: () => {
        stopScaleAnimation();
        if (reducedMotion) {
          scale.setValue(1.025);
          return;
        }
        scale.setValue(1);

        scaleAnimation.current = Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.045,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1.025,
            friction: 10,
            tension: 95,
            useNativeDriver: true,
          }),
        ]);
        scaleAnimation.current.start();
      },
      defeatSettle: () => {
        stopScaleAnimation();
        if (reducedMotion) {
          scale.setValue(0.992);
          return;
        }
        scale.setValue(1);
        scaleAnimation.current = Animated.sequence([
          Animated.timing(scale, { toValue: 0.986, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.spring(scale, { toValue: 0.992, friction: 12, tension: 85, useNativeDriver: true }),
        ]);
        scaleAnimation.current.start();
      },
      reset: () => {
        stopScaleAnimation();
        stopShakeAnimation();
        translateX.setValue(0);
        if (reducedMotion) {
          scale.setValue(1);
          return;
        }
        scaleAnimation.current = Animated.timing(scale, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        });
        scaleAnimation.current.start();
      },
    }));

    useEffect(() => {
      ambientAnimation.current?.stop();
      ambientScale.stopAnimation();
      ambientScale.setValue(1);
      if (reducedMotion || phase !== "active") return;

      ambientAnimation.current = Animated.loop(Animated.sequence([
        Animated.timing(ambientScale, {
          toValue: 1.006,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(ambientScale, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]));
      ambientAnimation.current.start();
      return () => ambientAnimation.current?.stop();
    }, [ambientScale, phase, reducedMotion]);

    useEffect(() => {
      if (!reducedMotion) return;
      scaleAnimation.current?.stop();
      shakeAnimation.current?.stop();
      scale.stopAnimation();
      translateX.stopAnimation();
      scale.setValue(1);
      translateX.setValue(0);
    }, [reducedMotion, scale, translateX]);

    useEffect(() => () => {
      scaleAnimation.current?.stop();
      shakeAnimation.current?.stop();
      ambientAnimation.current?.stop();
      scale.stopAnimation();
      ambientScale.stopAnimation();
      translateX.stopAnimation();
    }, [ambientScale, scale, translateX]);

    return (
      <Animated.View style={[styles.viewport, { transform: [{ translateX }, { scale: ambientScale }, { scale }] }]}>
        {children}
      </Animated.View>
    );
  },
);

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    minHeight: 0,
    width: "100%",
  },
});

export default CameraController;
