import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Animated, Easing } from "react-native";

export type CameraControllerHandle = {
  bitePunch: (strength?: number) => void;
  comboPunch: (strength?: number) => void;
  shake: (strength?: number) => void;
  victoryZoom: () => void;
  reset: () => void;
};

type CameraControllerProps = {
  children: React.ReactNode;
};

const CameraController = forwardRef<CameraControllerHandle, CameraControllerProps>(
  function CameraController({ children }, ref) {
    const scale = useRef(new Animated.Value(1)).current;
    const translateX = useRef(new Animated.Value(0)).current;
    const scaleAnimation = useRef<Animated.CompositeAnimation | null>(null);
    const shakeAnimation = useRef<Animated.CompositeAnimation | null>(null);

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
      scale.setValue(1);

      scaleAnimation.current = Animated.sequence([
        Animated.timing(scale, {
          toValue: 1 + amount * Math.max(0, strength),
          duration: 70,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 7,
          tension: 210,
          useNativeDriver: true,
        }),
      ]);
      scaleAnimation.current.start();
    };

    useImperativeHandle(ref, () => ({
      bitePunch: (strength = 1) => punch(0.03, strength),
      comboPunch: (strength = 1) => punch(0.06, strength),
      shake: (strength = 8) => {
        stopShakeAnimation();
        translateX.setValue(0);
        const distance = Math.max(0, strength);

        shakeAnimation.current = Animated.sequence([
          Animated.timing(translateX, { toValue: -distance, duration: 45, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: distance, duration: 55, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: -distance * 0.6, duration: 50, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: distance * 0.35, duration: 45, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: 0, duration: 40, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]);
        shakeAnimation.current.start();
      },
      victoryZoom: () => {
        stopScaleAnimation();
        scale.setValue(1);

        scaleAnimation.current = Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.08,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1.04,
            friction: 8,
            tension: 110,
            useNativeDriver: true,
          }),
        ]);
        scaleAnimation.current.start();
      },
      reset: () => {
        stopScaleAnimation();
        stopShakeAnimation();
        scale.setValue(1);
        translateX.setValue(0);
      },
    }));

    useEffect(() => () => {
      scaleAnimation.current?.stop();
      shakeAnimation.current?.stop();
      scale.stopAnimation();
      translateX.stopAnimation();
    }, [scale, translateX]);

    return (
      <Animated.View style={{ transform: [{ translateX }, { scale }] }}>
        {children}
      </Animated.View>
    );
  },
);

export default CameraController;
