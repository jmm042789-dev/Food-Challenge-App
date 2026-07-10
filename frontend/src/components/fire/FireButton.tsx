import React, { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Props = {
  title?: string;
  onPress: () => void;
  disabled?: boolean;
};

const BUTTON = require("../../assets/ui/button-primary.png");
const GLOW = require("../../assets/ui/animations/button-press-glow.png");
const RING = require("../../assets/ui/animations/button-click-ring.png");
const POP = require("../../assets/ui/animations/button-pop.png");

export default function FireButton({
  title = "START CHALLENGE",
  onPress,
  disabled = false,
}: Props) {

  const pulse = useRef(new Animated.Value(1)).current;
  const press = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.85)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {

    Animated.loop(

      Animated.parallel([

        Animated.sequence([
          Animated.timing(pulse,{
            toValue:1.03,
            duration:1700,
            useNativeDriver:true,
          }),

          Animated.timing(pulse,{
            toValue:1,
            duration:1700,
            useNativeDriver:true,
          }),

        ]),

        Animated.sequence([

          Animated.timing(glow,{
            toValue:1,
            duration:1500,
            useNativeDriver:true,
          }),

          Animated.timing(glow,{
            toValue:0.82,
            duration:1500,
            useNativeDriver:true,
          }),

        ]),

      ])

    ).start();

  }, []);

  const pressIn = () => {

    Animated.parallel([

      Animated.spring(press,{
        toValue:0.96,
        useNativeDriver:true,
      }),

      Animated.timing(ring,{
        toValue:1,
        duration:250,
        useNativeDriver:true,
      }),

      Animated.timing(pop,{
        toValue:1,
        duration:140,
        useNativeDriver:true,
      }),

    ]).start();

  };

  const pressOut = () => {

    Animated.parallel([

      Animated.spring(press,{
        toValue:1,
        friction:5,
        tension:120,
        useNativeDriver:true,
      }),

      Animated.timing(ring,{
        toValue:0,
        duration:260,
        useNativeDriver:true,
      }),

      Animated.timing(pop,{
        toValue:0,
        duration:180,
        useNativeDriver:true,
      }),

    ]).start();

  };
    return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          transform: [
            {
              scale: Animated.multiply(
                pulse,
                press
              ),
            },
          ],
        },
      ]}
    >
      {/* Orange Glow */}

      <Animated.Image
        source={GLOW}
        resizeMode="contain"
        style={[
          styles.glow,
          {
            opacity: glow,
          },
        ]}
      />

      {/* Click Ring */}

      <Animated.Image
        source={RING}
        resizeMode="contain"
        style={[
          styles.ring,
          {
            opacity: ring,
            transform: [
              {
                scale: ring.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.65, 1.2],
                }),
              },
            ],
          },
        ]}
      />

      {/* Pop Flash */}

      <Animated.Image
        source={POP}
        resizeMode="contain"
        style={[
          styles.pop,
          {
            opacity: pop,
            transform: [
              {
                scale: pop.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 1.15],
                }),
              },
            ],
          },
        ]}
      />

      <Pressable
  disabled={disabled}
  onPress={() => {
    console.log("🔥 FIREBUTTON PRESSED");
    onPress();
  }}
  onPressIn={pressIn}
  onPressOut={pressOut}
>
        <Image
          source={BUTTON}
          resizeMode="contain"
          style={styles.button}
        />

        <View
          pointerEvents="none"
          style={styles.textWrap}
        >
          <Text style={styles.text}>
            {title}
          </Text>
        </View>

      </Pressable>

    </Animated.View>
  );
}
const styles = StyleSheet.create({

  wrapper: {
    width: 340,
    height: 160,

    justifyContent: "center",
    alignItems: "center",

    alignSelf: "center",

    marginVertical: 18,
  },

  glow: {
    position: "absolute",

    width: 300,
    height: 300,

    opacity: 0.9,
  },

  ring: {
    position: "absolute",

    width: 220,
    height: 220,

    top: -18,

    opacity: 0,
  },

  pop: {
    position: "absolute",

    width: 240,
    height: 240,

    opacity: 0,
  },

  button: {
    width: 270,
    height: 92,
  },

  textWrap: {
    position: "absolute",

    left: 0,
    right: 0,

    top: 0,
    bottom: 0,

    justifyContent: "center",
    alignItems: "center",
  },

  text: {
    color: "#FFFFFF",

    fontSize: 22,

    fontWeight: "900",

    letterSpacing: 1.3,

    textAlign: "center",

    textShadowColor: "rgba(0,0,0,0.75)",

    textShadowOffset: {
      width: 0,
      height: 2,
    },

    textShadowRadius: 8,
  },
    disabled: {
    opacity: 0.45,
  },

  pressed: {
    transform: [
      {
        scale: 0.98,
      },
    ],
  },

});