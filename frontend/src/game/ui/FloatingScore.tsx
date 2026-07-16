
import React, { useEffect } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { useFadeIn, useScalePop, useSlideUp } from "../../animations";

type Props = {
  value: string;
  color?: string;
  size?: number;
  visible: boolean;
};

export default function FloatingScore({
  value,
  color = "#FFD54A",
  size = 42,
  visible,
}: Props) {
  const fade = useFadeIn({ enabled: visible, duration: 320, from: 0, to: 1 });
  const slide = useSlideUp({ enabled: visible, duration: 520, offset: 30 });
  const { scale, start: popStart } = useScalePop({ enabled: visible, duration: 420, from: 0.82, to: 1, autoStart: false });

  useEffect(() => {
    if (!visible) return;

    slide.start();
    popStart();

    fade.start();
    const timeout = setTimeout(() => {
      Animated.timing(fade.opacity, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }).start();
    }, 280);

    return () => clearTimeout(timeout);
  }, [fade, popStart, slide, visible]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        {
          opacity: fade.opacity,
          transform: [{ translateY: slide.translateY }, { scale }],
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color,
            fontSize: size,
          },
        ]}
      >
        {value}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    alignSelf: "center",
    top: -20,
    zIndex: 999,
  },
  text: {
    fontWeight: "900",
    textShadowColor: "#000",
    textShadowRadius: 10,
    textShadowOffset: {
      width: 0,
      height: 2,
    },
  },
});
