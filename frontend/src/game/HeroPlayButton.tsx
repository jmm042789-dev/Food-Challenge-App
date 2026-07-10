import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  ImageBackground,
  View,
  Dimensions,
} from "react-native";

type Props = {
  title?: string;
  onPress: () => void;
  disabled?: boolean;
};

const BUTTON = require("../assets/ui/button-primary.png");
const BUTTON_GLOW = require("../assets/ui/animations/button-press-glow.png");
const BUTTON_RING = require("../assets/ui/animations/button-click-ring.png");
const BUTTON_POP = require("../assets/ui/animations/button-pop.png");

const { width } = Dimensions.get("window");

export default function HeroPlayButton({
  title = "START CHALLENGE",
  onPress,
  disabled = false,
}: Props) {

  const buttonWidth = useMemo(
    () => Math.min(width - 40, 380),
    []
  );

  const pulse = useRef(new Animated.Value(1)).current;
  const press = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.75)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([

        Animated.sequence([
          Animated.timing(pulse,{
            toValue:1.03,
            duration:1500,
            useNativeDriver:true,
          }),
          Animated.timing(pulse,{
            toValue:1,
            duration:1500,
            useNativeDriver:true,
          }),
        ]),

        Animated.sequence([
          Animated.timing(glow,{
            toValue:1,
            duration:1400,
            useNativeDriver:true,
          }),
          Animated.timing(glow,{
            toValue:0.75,
            duration:1400,
            useNativeDriver:true,
          }),
        ]),

        Animated.sequence([
          Animated.timing(floatAnim,{
            toValue:-3,
            duration:1800,
            useNativeDriver:true,
          }),
          Animated.timing(floatAnim,{
            toValue:0,
            duration:1800,
            useNativeDriver:true,
          }),
        ]),

      ])
    ).start();
  }, []);
    const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(press, {
        toValue: 0.94,
        friction: 6,
        tension: 180,
        useNativeDriver: true,
      }),

      Animated.timing(ring, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),

      Animated.sequence([
        Animated.timing(pop, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(pop, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(press, {
        toValue: 1,
        friction: 5,
        tension: 160,
        useNativeDriver: true,
      }),

      Animated.timing(ring, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const ringScale = ring.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1.5],
  });

  const ringOpacity = ring.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 0],
  });

  const popScale = pop.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

    return (
    <Animated.View
      style={[
        styles.container,
        {
          width: buttonWidth,
          transform: [
            {
              scale: Animated.multiply(
                Animated.multiply(pulse, press),
                popScale
              ),
            },
            {
              translateY: floatAnim,
            },
          ],
        },
      ]}
    >
      <Pressable
        disabled={disabled}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View>

          {/* Glow */}

          <Animated.Image
            source={BUTTON_GLOW}
            resizeMode="stretch"
            style={[
              styles.glow,
              {
                opacity: glow,
                width: buttonWidth,
              },
            ]}
          />

          {/* Click Ring */}

          <Animated.Image
            source={BUTTON_RING}
            resizeMode="contain"
            style={[
              styles.clickRing,
              {
                opacity: ringOpacity,
                transform: [
                  {
                    scale: ringScale,
                  },
                ],
              },
            ]}
          />

          {/* Button */}

          <ImageBackground
            source={BUTTON}
            resizeMode="stretch"
            style={[
              styles.button,
              {
                width: buttonWidth,
              },
            ]}
          >
            <Animated.Image
              source={BUTTON_POP}
              resizeMode="contain"
              style={[
                styles.popEffect,
                {
                  opacity: pop,
                },
              ]}
            />

            <Text style={styles.text}>
              {title}
            </Text>

          </ImageBackground>

        </View>
      </Pressable>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 16,
  },

  glow: {
    position: "absolute",
    top: -8,
    left: 0,
    height: 110,
    alignSelf: "center",
  },

  clickRing: {
    position: "absolute",
    alignSelf: "center",
    top: -25,
    width: 160,
    height: 160,
    zIndex: 1,
  },

  button: {
    height: 96,

    justifyContent: "center",
    alignItems: "center",

    overflow: "visible",
  },

  popEffect: {
    position: "absolute",
    alignSelf: "center",

    width: 90,
    height: 90,
  },

  text: {
    color: "#FFFFFF",

    fontSize: 24,
    fontWeight: "900",

    letterSpacing: 1.4,

    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowOffset: {
      width: 0,
      height: 2,
    },
    textShadowRadius: 8,
  },
});