import React from "react";
import {
  View,
  Image,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
} from "react-native";

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
};

const CARD = require("../../assets/ui/card-frame.png");

const { width } = Dimensions.get("window");

export default function FireCard({
  children,
  onPress,
}: Props) {

  const cardWidth = Math.min(width - 32, 420);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.wrapper,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.container,
          {
            width: cardWidth,
          },
        ]}
      >
        <Image
          source={CARD}
          resizeMode="stretch"
          style={styles.background}
        />

        <View style={styles.overlay}>
          {children}
        </View>

      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({

  wrapper:{
    alignSelf:"center",
    marginVertical:12,
  },

  pressed:{
    transform:[{scale:0.98}],
  },

  container:{
    height:235,
    justifyContent:"center",
    alignItems:"center",
  },

  background:{
    ...StyleSheet.absoluteFillObject,
    width:undefined,
    height:undefined,
  },

  overlay:{
    flex:1,

    width:"100%",

    paddingHorizontal:34,
    paddingTop:34,
    paddingBottom:26,

    justifyContent:"space-between",
  },

});